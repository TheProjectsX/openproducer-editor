import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("build/client");
const pages = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else if (absolute.endsWith(".html") && !["404.html", "offline.html", "__spa-fallback.html"].includes(entry.name)) {
      pages.push({ file: path.relative(root, absolute).split(path.sep).join("/"), html: await readFile(absolute, "utf8") });
    }
  }
}

function check(condition, message) {
  if (!condition) throw new Error(`Static output check failed: ${message}`);
}

await walk(root);
check(pages.length > 0, "no prerendered route HTML was found");
check(await stat(path.join(root, "404.html")).then(() => true, () => false), "404.html is missing");
check(await stat(path.join(root, "_headers")).then(() => true, () => false), "Cloudflare _headers is missing");

const titles = new Set();
const publicRoutes = [];
const configuredSite = process.env.VITE_SITE_URL ?? process.env.PUBLIC_SITE_URL;
const siteOrigin = configuredSite ? new URL(configuredSite).origin : "";
for (const page of pages) {
  const title = page.html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const description = page.html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)/i)?.[1];
  const noindex = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(page.html);
  check(title, `${page.file} has no prerendered title`);
  check(!titles.has(title), `${page.file} duplicates title “${title}”`);
  titles.add(title);
  if (noindex) {
    check(/^(?:studio\/|projects\/|settings\/)/.test(page.file), `${page.file} unexpectedly has noindex`);
    continue;
  }
  check(description, `${page.file} has no prerendered description`);
  check(/<h1\b/i.test(page.html), `${page.file} has no prerendered main heading`);
  if (siteOrigin) {
    const route = page.file === "index.html" ? "/" : `/${page.file.replace(/\/index\.html$/, "").replace(/\.html$/, "")}/`;
    const canonical = page.html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
    check(canonical === `${siteOrigin}${route}`, `${page.file} has a missing or incorrect canonical URL`);
  }
  publicRoutes.push(page);
}

const robots = await readFile(path.join(root, "robots.txt"), "utf8");
check(robots.includes("Disallow: /studio/"), "robots.txt does not exclude editor routes");
check(robots.includes("Disallow: /projects"), "robots.txt does not exclude project pages");
check(robots.includes("Disallow: /settings/"), "robots.txt does not exclude settings pages");
const sitemapPath = path.join(root, "sitemap.xml");
const hasSitemap = await stat(sitemapPath).then(() => true, () => false);
if (configuredSite) {
  check(hasSitemap, "configured public origin did not produce sitemap.xml");
  const sitemap = await readFile(sitemapPath, "utf8");
  check(!/\/(?:studio|projects)(?:\/|<)/i.test(sitemap), "sitemap contains editor/project routes");
  check(sitemap.includes(siteOrigin), "sitemap does not use the configured site origin");
  check(robots.includes(`${siteOrigin}/sitemap.xml`), "robots.txt does not reference sitemap.xml");
} else check(!hasSitemap, "sitemap was emitted without a configured public origin");

const worker = await readFile(path.join(root, "sw.js"), "utf8");
check(worker.includes('event.data?.type === "SKIP_WAITING"'), "service worker update activation message is missing");
check(!worker.includes("await self.skipWaiting()"), "service worker activates without waiting for the user update action");
for (const page of pages) {
  const route = page.file === "index.html" ? "/" : `/${page.file.replace(/\/index\.html$/, "").replace(/\.html$/, "")}`;
  check(worker.includes(route), `service worker route table is missing ${route}`);
}

console.log(`Verified ${pages.length} prerendered routes (${publicRoutes.length} indexable), 404, headers, robots, and service-worker entries.`);
