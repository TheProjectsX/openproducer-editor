import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve("build/client");
const files = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(absolute);
    else files.push(path.relative(root, absolute).split(path.sep).join("/"));
  }
}

await collect(root);
const htmlFiles = files.filter((file) => file.endsWith(".html") && !["404.html", "offline.html", "__spa-fallback.html"].includes(path.basename(file)));
const staticAssets = files.filter((file) => /\.(?:js|css|wasm|svg|png|ico|webmanifest)$/.test(file));
const buildHash = createHash("sha256");
for (const file of [...htmlFiles, ...staticAssets].sort()) {
  buildHash.update(file);
  buildHash.update(await readFile(path.join(root, file)));
}
const cacheVersion = buildHash.digest("hex").slice(0, 12);
const routeEntries = htmlFiles.map((file) => {
  const route = file === "index.html" ? "/" : `/${file.replace(/\/index\.html$/, "").replace(/\.html$/, "")}`;
  return { file: `/${file}`, paths: route === "/" ? ["/"] : [route, `${route}/`] };
});

const worker = `/* Generated after the static site build. Do not edit by hand. */
const CACHE_NAME = "local-studio-core-${cacheVersion}";
const ASSETS = ${JSON.stringify(staticAssets.map((file) => `/${file}`))};
const ROUTES = ${JSON.stringify(routeEntries)};
const OFFLINE = "/offline.html";
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll([...ASSETS, OFFLINE]);
      for (const route of ROUTES) {
        const response = await fetch(route.file, { cache: "no-cache" });
        if (!response.ok) throw new Error("Could not precache " + route.file);
        for (const alias of route.paths) await cache.put(alias, response.clone());
      }
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("local-studio-core-") && key !== CACHE_NAME) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url.pathname);
      if (cached) return cached;
      try { return await fetch(request); }
      catch { return (await cache.match(OFFLINE)) ?? Response.error(); }
    })());
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((response) => response ?? fetch(request)));
  }
});
`;

await writeFile(path.join(root, "sw.js"), worker);

const configuredSiteUrl = process.env.VITE_SITE_URL ?? process.env.PUBLIC_SITE_URL;
let siteOrigin = "";
if (configuredSiteUrl) {
  const parsedSiteUrl = new URL(configuredSiteUrl);
  if (parsedSiteUrl.protocol !== "https:" || parsedSiteUrl.pathname !== "/" || parsedSiteUrl.search || parsedSiteUrl.hash) {
    throw new Error("VITE_SITE_URL must be an HTTPS origin, for example https://example.com");
  }
  siteOrigin = parsedSiteUrl.origin;
  const publicRoutes = [];
  for (const file of htmlFiles) {
    const html = await readFile(path.join(root, file), "utf8");
    if (/name=[\"']robots[\"'][^>]*content=[\"'][^\"']*noindex/i.test(html) || /content=[\"'][^\"']*noindex[^\"']*[\"'][^>]*name=[\"']robots[\"']/i.test(html)) continue;
    const route = file === "index.html" ? "/" : `/${file.replace(/\/index\.html$/, "").replace(/\.html$/, "")}/`;
    if (/\/(?:studio|projects|settings)(?:\/|$)/i.test(route)) continue;
    const canonical = html.match(/<link\s+rel=[\"']canonical[\"']\s+href=[\"']([^\"']+)[\"']/i)?.[1];
    publicRoutes.push(canonical ?? `${siteOrigin}${route}`);
  }
  const locations = [...new Set(publicRoutes)].sort().map((url) => `  <url><loc>${url.replaceAll("&", "&amp;")}</loc></url>`).join("\n");
  await writeFile(path.join(root, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations}\n</urlset>\n`);
} else {
  await unlink(path.join(root, "sitemap.xml")).catch(() => undefined);
}
await writeFile(path.join(root, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /studio/\nDisallow: /projects\nDisallow: /settings/\n${siteOrigin ? `Sitemap: ${siteOrigin}/sitemap.xml\n` : ""}`);

const manifest = JSON.parse(await readFile(path.join(root, "manifest.webmanifest"), "utf8"));
if (!manifest.icons?.some((icon) => icon.sizes === "192x192") || !manifest.icons?.some((icon) => icon.sizes === "512x512")) {
  throw new Error("PWA manifest must include 192px and 512px icons.");
}
console.log(`Generated service worker with ${staticAssets.length} assets and ${routeEntries.length} prerendered routes.`);
