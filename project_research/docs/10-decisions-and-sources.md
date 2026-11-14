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
| Audio speed prototype | `bungee-web` 0.1.2 for pitch-preserving speed preview and WAV rendering; the app caps estimated output at 512 MB during feasibility. |

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
- [Bungee Web](https://github.com/JeffreyCA/bungee-web) for WASM time stretching with fixed pitch and offline `Transport` rendering.
- [Fabric.js canvas objects and filters](https://www.fabricjs.com/docs/core-concepts/)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) and [browser support matrix](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)
- [Demucs ONNX browser guide](https://github.com/StemSplit/demucs-onnx/blob/main/docs/browser.md), [RNNoise](https://github.com/xiph/rnnoise), and [Real-ESRGAN models](https://github.com/xinntao/Real-ESRGAN/blob/master/docs/model_zoo.md)
- [ffmpeg.wasm performance](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/apps/website/docs/performance.md) and [FAQ/licensing](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/apps/website/docs/faq.md)
- [CapCut's published timeline feature description](https://www.capcut.com/resource/ai-generation-and-full-timeline-editing-in-capcut-desktop)
- [Playwright service-worker testing](https://playwright.dev/docs/service-workers) and [offline browser context](https://playwright.dev/docs/api/class-browsercontext)

## Change log

- **2026-11-14:** Initial complete handoff drafted. All project decisions above come from the planning discussion; technical sources were checked at handoff. No implementation or measured benchmark has yet been completed.

## M6 implementation decisions

- The first editor slice persists its versioned timeline model and source blobs in IndexedDB. OPFS migration and large-project benchmarks remain pending; the current editor caps each file at 256 MiB and each project at 512 MiB.
- Timeline preview draws active video/image clips bottom-to-top into a canvas at the project dimensions. Each source is fitted inside the canvas; full-bleed transforms and effect evaluation remain future work. Separate audio elements play concurrently against the same project clock, with per-clip speed, mute, and 0–1 volume. Browser behavior still requires hands-on device verification.
- Clip speed is represented in timeline duration as `(sourceEnd - sourceStart) / speed`; timeline video export and preview/export parity have not been proven.
- Timeline undo history is in-memory (up to 50 edit snapshots); project state itself is saved, but undo history resets after refresh. Source media stays in the media bin when its last clip is deleted so undo can restore a clip without re-importing.
- Timeline export uses Mediabunny `CanvasSource` with timestamped frames, `AudioBufferSource` for a single synchronized rendered PCM mix, and browser codec probes (`canEncodeVideo`/`canEncodeAudio`) before choosing MP4 AVC/AAC or WebM VP8/VP9/Opus. See the primary [CanvasSource API](https://mediabunny.dev/api/CanvasSource), [AudioBufferSource API](https://mediabunny.dev/api/AudioBufferSource), [codec support guide](https://mediabunny.dev/guide/supported-formats-and-codecs), and [writing-media guide](https://mediabunny.dev/guide/writing-media-files).
- Audio clip export uses the bundled local Bungee stretcher for pitch-preserving speed and sums clips to stereo PCM at 48 kHz before encoding. A master gain reduces mix peaks above −0.18 dBFS. Export remains memory-backed and is restricted to 120 seconds / 4 MP / 180 seconds unique audio / 512 MiB output until measurements justify increasing those limits.
