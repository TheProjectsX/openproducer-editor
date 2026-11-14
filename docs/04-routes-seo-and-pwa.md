# Routes, SEO, offline PWA, and deployment

## Route contract

Configure React Router Framework Mode with `ssr: false` and pre-render **every declared path**. Use trailing-slash URLs consistently. Generate tool routes from a typed tool catalog so navigation, sitemap, and feature availability cannot drift apart. The initial catalog is:

| Group | Public routes |
|---|---|
| General | `/`, `/tools/`, `/tools/audio/`, `/tools/video/`, `/tools/image/` |
| Audio Core | `/tools/audio/trim/`, `/split/`, `/merge/`, `/volume-fades/`, `/normalize/`, `/noise-reduction/`, `/speed/` (all under `/tools/audio/`) |
| Video Core | `/tools/video/editor/`, `/trim/`, `/merge/`, `/remove-audio/`, `/replace-audio/`, `/speed/` (all under `/tools/video/`) |
| Image Core | `/tools/image/edit/`, `/resize/`, `/collage/` (all under `/tools/image/`) |
| AI release | `/tools/audio/vocal-remover/`, `/tools/audio/speech-cleanup/`, `/tools/image/upscale/` |

The abbreviated cells above represent complete paths with their stated group prefix. AI routes enter the public sitemap only when the corresponding tool is actually released; before release, they may be omitted entirely rather than advertising a nonfunctional tool.

Editor paths are fixed: `/studio/audio/`, `/studio/video/`, `/studio/image/`; use `?project=<local-uuid>` for a saved project and `?tool=<catalog-id>` for a focused entry point. Never use a runtime-only `/project/:id` route. The project UUID is local state, not an SEO page. `/projects/` and `/settings/storage/` are fixed, pre-rendered shells that hydrate with local data. Generate a real `/404.html` and verify the host returns 404 for unknown paths.

## SEO contract

Each public tool page must contain useful server-generated HTML: a unique heading, short purpose, who it helps, input/output expectations, key steps, supported browser/format caveat, and a link to launch the tool. Use unique `<title>`, description, canonical link, and social-preview metadata. Tool text must not depend on JavaScript or a local project. Generate `sitemap.xml` only from canonical public routes and list it in `robots.txt`. Mark `/studio/*`, `/projects/`, `/settings/*`, and query-based local project pages `noindex`. Do not promise search rankings; verify rendered HTML, indexing directives, and Search Console after launch.

## Service worker and cache policy

Use a custom service worker built with Workbox `injectManifest` after the React Router static build. Precache the manifest, icons, public navigation HTML, fixed studio HTML, route data assets needed for navigation, core JS/CSS, and small engine binaries. Exclude user media and AI models from the precache. Cache optional model assets by pinned URL/version/checksum only after the user requests them. Use an atomic cache/update strategy: finish downloading a new app or model version before marking it ready; keep the old working version until activation. Provide an offline fallback page for an uncached route, but declared core routes must be cached.

Store user media in OPFS, project records in IndexedDB, and downloaded model files in a separately versioned app-managed store or Cache Storage. The UI must distinguish **installed app**, **core ready offline**, and **specific AI tool ready offline**. Show storage usage and deletion controls. Request persistent storage after the first saved project and handle denial gracefully. A user clearing site data can remove all local projects; say so near storage controls.

## Hosting and headers

Default deployment is Cloudflare Pages serving `build/client` (or the final static output chosen by the framework build). Commit a `public/_headers` file when implementation starts. Set HTTPS, cross-origin isolation headers where multithreaded WASM requires them (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`), and a tested Content Security Policy. Self-host every critical asset so isolation does not break CDN resources. Do not deploy Pages Functions, API routes, or server-side rendering for media jobs.

Before release, test the production deployment with: direct URL entry, refresh, internal navigation, offline reload, PWA installation, worker loading, model download, and correct MIME/CORS/header behavior. A development server passing is insufficient.

## Reference behavior

React Router's pre-rendered static mode emits HTML per route and can run without a runtime server. Google recommends static or server rendering for content that should be discoverable. Cloudflare Pages supports `_headers` on static assets. See [React Router pre-rendering](https://reactrouter.com/how-to/pre-rendering), [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [Google sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Workbox injectManifest](https://developer.chrome.com/docs/workbox/modules/workbox-build), and [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).
