# Decisions, open measurements, and sources

## Settled product decisions

| Decision | Choice and reason |
|---|---|
| Runtime | Frontend-only static PWA. User media and AI inference remain local. |
| Audience | Everyday creators, desktop first. Responsive mobile UI with only tested processing features. |
| Navigation | Home, Audio, Video, Image, Projects; category/tool overview pages and local editors. |
| Video scope | Basic CapCut-like multitrack timeline in Core, with focused quick-tool entry points. Not full CapCut feature parity. |
| Controls | Every adjustable numeric value accepts custom typing; presets are shortcuts. Speed is 0.1×–16× and pitch preservation defaults on. |
| Image resize | Independent exact width/height and stretching by default, without cropping/padding; optional aspect matching. AI upscale is separate. |
| Projects | Local, editable, autosaved projects; source media unchanged. |
| Offline | Core after installation and caching; AI after a per-tool model download. |
| SEO/routes | React Router Framework Mode static pre-rendering for public pages; fixed studio routes with query-based local project IDs; no runtime server. |
| Deployment | Static Cloudflare Pages by default, with tested headers and one origin for critical assets. |
| Naming | Local Studio is the provisional working name; availability is unverified. |

## Measurements and records M0 must add here

These are implementation evidence, not invitations to redesign the product: reference machine/browser versions; media fixtures; successful import/preview/export codec combinations; 3.7× and 6× pitch-preserved speed quality; multitrack 1080p export time and peak memory; exact image resize result; AI model size, tile settings, quality, and processing time; license/provenance decision; recommended input and output limits. If a candidate engine fails a gate, record the failure and tested replacement before moving on.

## Primary references reviewed

### Routing, SEO, PWA, and hosting

- [React 19.3 release](https://react.dev/blog/2026/09/09/react-19-3)
- [React Router current changelog](https://reactrouter.com/changelog) and [static pre-rendering](https://reactrouter.com/how-to/pre-rendering)
- [Vite supported releases](https://vite.dev/releases)
- [Google JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) and [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [MDN PWA installation requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [Workbox injectManifest](https://developer.chrome.com/docs/workbox/modules/workbox-build) and [precaching](https://developer.chrome.com/docs/workbox/modules/workbox-precaching)
- [Cloudflare Pages `_headers`](https://developers.cloudflare.com/pages/configuration/headers/)
- [MDN OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system.) and [storage quotas/eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

### Media and browser AI

- [MDN WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API), [video encoder support checks](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/isConfigSupported_static), and [video container concepts](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Video_processing_concepts)
- [Mediabunny conversion](https://mediabunny.dev/guide/converting-media-files), [reading](https://mediabunny.dev/guide/reading-media-files), and [supported formats](https://mediabunny.dev/guide/supported-formats-and-codecs)
- [MDN OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext) and [playback-rate behavior](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate)
- [Fabric.js canvas objects and filters](https://www.fabricjs.com/docs/core-concepts/)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) and [browser support matrix](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)
- [Demucs ONNX browser guide](https://github.com/StemSplit/demucs-onnx/blob/main/docs/browser.md), [RNNoise](https://github.com/xiph/rnnoise), and [Real-ESRGAN models](https://github.com/xinntao/Real-ESRGAN/blob/master/docs/model_zoo.md)
- [ffmpeg.wasm performance](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/apps/website/docs/performance.md) and [FAQ/licensing](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/apps/website/docs/faq.md)
- [CapCut's published timeline feature description](https://www.capcut.com/resource/ai-generation-and-full-timeline-editing-in-capcut-desktop)
- [Playwright service-worker testing](https://playwright.dev/docs/service-workers) and [offline browser context](https://playwright.dev/docs/api/class-browsercontext)

## Change log

- **2026-11-14:** Initial complete handoff drafted. All project decisions above come from the planning discussion; technical sources were checked at handoff. No implementation or measured benchmark has yet been completed.
