# Packaging, distribution, licenses, and risks

## Dependency plan

Install only the packages needed by the milestone being implemented. Pin compatible stable patches with `pnpm-lock.yaml`, then audit bundles and notices before release.

| Purpose | Preferred package/API | Packaging rule |
|---|---|---|
| App and routing | React, React DOM, `react-router`, `@react-router/dev`, TypeScript, Vite | One static web build; pre-render all declared routes. |
| Offline | Workbox build/precaching/routing packages | One custom service worker generated after the static build; keep AI models outside the core precache. |
| Containers and encoding | `mediabunny`, native WebCodecs | Lazy-load on editor routes and probe exact codec support. |
| Audio | Native Web Audio; browser time-stretch candidate selected at M0 | A licensed, pinned processor must support pitch-preserved preview and offline render; validate 0.1×–16× quality. |
| Image | `fabric` and native Canvas/OffscreenCanvas | Lazy-load in image editor; app-owned serialized project format. |
| Persistence | IndexedDB with Dexie; native OPFS | Metadata and bytes stored separately; schema migrations and recovery tests. |
| AI | `onnxruntime-web`; pinned local model files | Optional downloaded assets with checksums, size display, and cache versioning. |
| UI state and validation | Zustand for transient state; Zod or equivalent for persisted document validation | Do not use UI state as the only copy of a project. |
| Quality | Vitest, Playwright, ESLint, formatter | Run in CI with a static build and representative media fixtures. |

Package boundaries are listed in `03-technology-and-architecture.md`. Keep public landing pages light; media engines, image canvas code, and AI runtime should not enter their initial JS bundles. Ship one origin and one installable PWA. No Docker image or runtime server is required for production. A local development server and build-time Node.js are allowed.

## Static deployment artifact

Publish the generated HTML/CSS/JS, manifest, icons, sitemap, robots file, service worker, `_headers`, and optional versioned engine/model files to Cloudflare Pages. Provide a deployment README with build command, output directory, HTTPS/custom domain setup, cache invalidation, cross-origin isolation verification, and smoke-test URLs. Make model assets content-addressed or versioned so the service worker cannot mix old runtime code with new weights. Verify browser cache quotas and resume/retry behavior for large downloads.

## Licensing and provenance checklist

- Record every package and model with version, source URL, license text, required attribution, checksum, and whether redistribution is permitted.
- Review **the actual FFmpeg core and enabled codecs**, not only the MIT-licensed JavaScript wrapper, before bundling ffmpeg.wasm. FFmpeg components may carry LGPL/GPL obligations and codec-specific concerns. Prefer the WebCodecs/Mediabunny path unless an identified gap justifies the weight and cost. [ffmpeg.wasm FAQ](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/apps/website/docs/faq.md)
- Review the chosen vocal separation model's weights and conversion repository separately. A code repository's license does not automatically settle every model-weight distribution question. Start feasibility with the documented browser Demucs ONNX example. [Demucs browser guide](https://github.com/StemSplit/demucs-onnx/blob/main/docs/browser.md)
- Review RNNoise code, pretrained weights, and the selected browser port separately before shipping enhanced speech cleanup. [RNNoise project](https://github.com/xiph/rnnoise)
- Review Real-ESRGAN code, original weights, and any ONNX conversion used for image upscaling. Start with the smaller general-image model as a performance candidate. [Real-ESRGAN models](https://github.com/xinntao/Real-ESRGAN/blob/master/docs/model_zoo.md)
- A time-stretch package must be selected and pinned after M0 audio-quality and license checks. SoundTouchJS and Bungee Web are candidates, not automatic dependencies; their current and historical distribution terms differ. [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS), [Bungee Web](https://github.com/JeffreyCA/bungee-web)

## Main risks and responses

| Risk | Response |
|---|---|
| Browser-specific codec support | Runtime capability probing, tested format matrix, explicit unavailable state, no extension-based promises. |
| High memory/time for video export | Worker jobs, proxies, chunked/streamed output, measured input guidance, cancellation, and progress. |
| Preview/export divergence | Shared timeline clock and effect evaluation; boundary fixture tests and external output inspection. |
| Storage eviction or quota | OPFS/IndexedDB estimate, persistent-storage request, quota recovery, visible project/storage management, clear warning that browser data can be deleted. |
| Large optional AI assets | Per-tool opt-in download, checksum, resumable/retryable fetch if supported, versioned caches, readiness state, and removal controls. |
| Cross-origin isolation conflicts | Self-host assets, test `_headers`, CSP, workers, WASM, and model loading on deployed origin. |
| SEO regression | Pre-render every public route, inspect raw HTML, maintain sitemap/canonical/404 checks in CI. |
| Scope expansion from “CapCut-like” | Use the explicit Core feature matrix. Additional effects or AI features need a new milestone and acceptance criteria. |

## Limits to communicate to users

Browser storage can be removed by the user; exported media should be downloaded. Heavy jobs may take time and require storage and RAM. Supported file formats depend on their actual codec and the browser. AI tools need a completed first download to work offline. Publish measured limits after M0/M6 instead of claiming universal file-size or format support.
