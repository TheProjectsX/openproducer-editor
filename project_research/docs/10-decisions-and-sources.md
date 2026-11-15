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
- Visual clip transforms are optional fields on the version-1 clip record, preserving compatibility with projects that lack transform values. Preview and export both use the shared compositor, with source-fit then scale/rotation/position/opacity around the project-canvas center.
- Text title clips are zero-byte project assets containing edit instructions, not generated media files. Their text, size, color, and optional background are drawn by the shared canvas compositor during preview/export; source media remains untouched.
- Clips use optional per-clip linear `fadeIn`/`fadeOut` durations in seconds in the version-1 model. The video compositor applies alpha ramps in preview and export so lower visual lanes show through; audio playback and rendered audio mix apply the same envelope, supporting overlapping audio-clip crossfades. Other transition curves remain future work.
- Optional version-1 clip keyframes store clip-relative time, transform, and gain snapshots. One shared linear interpolation function drives the canvas compositor, live audio preview, and sample-by-sample rendered audio gain. Keyframes are explicitly authored with an Add/update-at-playhead action and editing the inspector values updates the key at that clip-local time.
- Visual clips can store custom brightness, contrast, saturation, and grayscale percentages. These use the Canvas 2D filter pipeline in the shared compositor, keeping preview and export aligned; browser-specific filter differences still need device output verification.
- Source video audio is detached on explicit user action to a local 48 kHz stereo WAV asset and inserted into Audio 1 with the selected clip's trim, start, and speed. Asset metadata records the source asset ID to prevent duplicate extraction. The source video clip stays muted in preview and embedded audio is not automatically included in export; users can mute, trim, fade, keyframe volume, move, or delete the detached audio independently.
- Audio clip export uses the bundled local Bungee stretcher for pitch-preserving speed and sums clips to stereo PCM at 48 kHz before encoding. A master gain reduces mix peaks above −0.18 dBFS. Export remains memory-backed and is restricted to 120 seconds / 4 MP / 180 seconds unique audio / 512 MiB output until measurements justify increasing those limits.

## M6 browser smoke-check (2026-11-14)

- Environment: Codex in-app browser on the local development server; exact browser build and operating-system version were not exposed by the browser tool. This is not a Chrome/Edge compatibility claim.
- Fixture: locally generated 640×360 SVG card and 2-second, 48 kHz mono 440 Hz PCM WAV; no user media or external files were used.
- Import/preview: both assets appeared in the local media bin and timeline. The image displayed in the composite preview; the audio asset was available on Audio 1.
- Editing/save/reopen: added a title, changed its text to “M6 Verification”, set 0.4-second fade-in and 1.2× scale, refreshed the studio route, and confirmed the source assets, title text, fade, and scale remained in the project.
- Export: browser codec selection produced MP4. The in-app video element reached `readyState=4`, decoded 1920×1080, and reported 5.013333 seconds for the 5-second timeline. Export completed twice, including once with the title and audio clip present.
- Limits: the output was not downloaded and opened in an independent media player. This run did not include an actual video source, inspect A/V sync markers, test source-audio detachment, emulate offline reload, or identify a named Chrome/Edge build. It is a smoke check, not the M6 release gate.
- Finding/fix: the `addTitle` handler existed but no rendered control invoked it. Added an “Add text title” button beside media import; the title edit and export smoke check then passed.

## Core implementation slices after the M6 smoke check (2026-11-14)

- Added explicit next-clip dissolve and audio crossfade actions. They create a same-track overlap and use the existing linear opacity/gain envelopes in the shared preview and export model. The M6 actual-media renderer gate remains open; transition fidelity has not been externally inspected.
- Added `/studio/audio/` as a local one-source editing project: waveform, source in/out, 0.1×–16× speed with pitch preservation default and natural-pitch mode, gain, fades, cancellable chunked WAV render, project persistence, and local source storage. This is a focused starter path and not a multitrack audio timeline.
- Added `/tools/audio/normalize` with custom peak target, source/result preview, and WAV output. Peak normalization is a distinct operation from the broadband noise gate.
- Added image layer visibility, ordering, shape/text editing and common filter presets to the existing resize editor, plus project duplication and storage estimate/persistence controls. These UI capabilities have typecheck/build coverage but no image fixture output comparison yet.
- Verification on the current workspace: `npm.cmd run typecheck`, `npm.cmd run test:core` (6/6), `npm.cmd run build`, and `git diff --check` passed. Production output prerendered 23 routes and generated a service worker precache with 41 assets. The build reports a 642.98 kB minified media chunk and an ineffective dynamic import for Bungee WASM.
- At the time of this earlier smoke check, the real-video fixture and external-player gates were open. See the subsequent fixture run below for local M6 evidence. Named Chrome/Edge, deployed route/SEO, offline close-and-reopen export, quota/missing-asset recovery, and image/collage export checks remain open. M7 AI and M8 hardening remain pending.

## Static hosting and discoverability foundation (2026-11-14)

- Added a static `404.html`, Cloudflare Pages `_headers` with baseline browser security headers, generated `robots.txt`, and a build-time sitemap sourced from rendered HTML. Route `<link rel="canonical">` values and absolute sitemap entries use `VITE_SITE_URL`; the build validates that it is an HTTPS origin. When unset, the sitemap is removed/omitted instead of embedding a fabricated production host.
- The test origin `https://example.invalid` generated a sitemap with public tools only; `/studio/*` and `/projects` were absent. The rendered `/studio/audio/` shell had `noindex,nofollow` and was excluded. Re-running without a configured origin removed the sitemap and retained the disallow rules.
- Removed the duplicate Normalize Audio home card discovered in the route audit.
- This only establishes generated artifacts. Deployed Pages 404 status, headers/CSP behavior, canonical/SEO fetches on the production host, and SPA refresh semantics remain unverified.

## Editable collage persistence (2026-11-14)

- Added a schema-versioned collage document in IndexedDB and stores each referenced image as a local source asset. Layout values, order, background, fit, canvas dimensions, and caption styling reopen from Projects; duplication remaps source IDs and deletion removes associated blobs.
- Added project migration to schema 4 and a unit check for schema 3 image records. Typecheck and the core suite pass. Browser-backed save/reopen, output inspection, and offline behavior have not been verified; the collage gate stays open until those runs.

## Public tool directory and static route checks (2026-11-14)

- Added prerendered `/tools/` plus audio, video, and image category entry pages. The updated build verifier checks route metadata and noindex behavior, static 404/headers/robots, sitemap/canonical behavior when an origin is configured, and service-worker route entries.
- Local production build emitted 26 route pages: 22 indexable public pages and 4 noindex studio/project shells. This does not prove the hosted origin's route/404 status or post-deployment header behavior. Routes remain explicitly hand-authored; the typed catalog conversion and the missing storage settings/video merge routes remain pending.

## Worker-based peak normalization (2026-11-14)

- Peak scan and WAV PCM16 encoding now run in a dedicated module worker. Source PCM is copied in 65,536-frame chunks and transferred, bounding temporary copies; output blocks are transferred back and assembled into a Blob. The user can cancel between blocks and sees progress. Audio decode still occurs on the UI thread, and other large audio/video/image processing paths remain outside a shared worker-job protocol.
- Pure tests cover gain target, silence, interleaving/clamping, malformed channel lengths, and RIFF/WAVE sizes. Typecheck, 10 core tests, and build passed; the production bundle emits `audio-normalize.worker` separately.

## Versioned source replacement and project integrity (2026-11-14)

- Source media now uses immutable asset IDs. New bytes are written to OPFS (with an IndexedDB fallback) before the project record points to them; failed writes remove the staged asset and leave the previous reference intact. Audio source replacement retains the previous source until the edit document transaction commits, then cleans old references. Legacy project-ID paths remain readable and are migrated forward to schema 5 without moving their bytes.
- Project deletion removes the project record and IndexedDB references in one transaction, then removes OPFS directories. If the IndexedDB transaction fails, source bytes remain reachable from the still-existing project.
- This prevents the prior in-place overwrite failure mode, but browser quota exhaustion, OPFS/IndexedDB partial failure, and interrupted-tab recovery still require browser-backed tests before the storage gate is met.
- Extracted the shared timeline clip-duration calculation and added checks for 3.7×, 0.1×, 16×, and invalid speed values. The current core suite passes 12/12; this covers the pure timing formula, not full preview/export sync.

## Storage settings route (2026-11-14)

- Added `/settings/storage/` for browser-reported usage/quota, persistent-storage request/status, a clear-site-data warning, and per-project deletion. The route is pre-rendered but marked noindex and disallowed in robots. The static output verifier checks the setting shell’s noindex status.
- Local typecheck and 12 core tests passed; build verifies 27 prerendered routes and excludes five private shells from the indexable set. User-agent eviction, quota exhaustion, and deletion recovery still need runtime coverage.

## User-controlled service-worker activation (2026-11-14)

- Removed install-time `skipWaiting`. A fully precached worker stays waiting; the app shell detects it, presents a save/review notice, and only sends `SKIP_WAITING` after the user selects reload. The active worker then claims clients and the app reloads on `controllerchange`.
- A static build check confirms the explicit message handler and absence of automatic activation. Typecheck, 12 core tests, and the 27-route build pass. Real update install, active project autosave, and offline reload behavior remain unverified.
# 2026-11-14 — Inspect studio media codecs before project import

Studio import paths inspect container and track metadata from the local file bytes with Mediabunny. Imports check every audio/video track with `canDecode()` and report detected container and codecs; tracks unsupported by the browser are rejected before persistence. This avoids treating file extensions or MIME declarations as codec evidence. The check covers Audio and Video Studio; other quick tools still rely on their individual decoders, and support is not a substitute for the outstanding browser/format/export matrix. Verification: typecheck, 12 core tests, and static production build pass. Real browser fixture matrix is still required.

# 2026-11-14 — JPEG export for image workspace

Added JPEG export with custom quality input and an explicit white matte for transparent source pixels, alongside PNG. Persisted the format and quality in image project settings as optional fields, so existing schema-5 projects default to PNG at 0.92 quality. This closes the missing JPEG output control in the image UI but does not verify color, alpha, dimensions, or offline reopening using real fixture images.

Image undo/redo now stores up to 100 edit-document snapshots and covers adjustments, resize settings, transforms, export controls, and layers. Selecting a different source resets the history so undo does not cross between images. Pure core tests do not exercise this browser interaction; route-level edit/undo/reopen still requires runtime verification.

Video Studio import now classifies audio/video from parsed track content and validates image inputs by bitmap decode and supported dimensions. MIME declarations are retained as asset metadata but do not determine codec capability or media kind. Direct nested route load was observed in the built static preview; fixture import, refresh with a saved project, and offline operation remain open.

Video Studio audio clips gained an optional `pitchMode`. Missing values migrate implicitly to preserve mode; natural mode uses linear source-rate resampling for output and disables preview pitch preservation. A unit test covers fractional-speed chunk interpolation. This confirms the calculation path only; audible comparison, export duration, and A/V sync still need representative fixtures.

Added synthetic CC0 Core fixtures under `tests/fixtures/core-media`: H.264/AAC MP4 (320×180, 24 fps, 4 s), VP9/Opus WebM (320×180, 24 fps, 4.008 s), PCM sine WAVs at 48 kHz and 44.1 kHz, a 400×340 checkerboard/transparency image, and two collage subjects. FFprobe 7.1.4 confirms the expected stream metadata. This creates repeatable inputs but does not prove app import/preview/export, spoken intelligibility, or visible A/V sync.

Added `sync-markers-24fps.mp4`, a synthetic four-second H.264/AAC fixture with a colored visual marker each second and 20 ms, 1 kHz audio pulses at 1, 2, and 3 seconds. FFprobe 7.1.4 confirms 320×180 at 24 fps and mono 48 kHz audio; FFmpeg silence detection locates the pulses at 1.000, 2.000, and 3.000 seconds. This establishes fixture metadata only; browser import, timeline offsets, exported sync, and external-player playback remain unverified.

## M6 synthetic multitrack browser run (2026-11-14)

- Environment: Codex in-app browser against local Vite development preview. The exact browser/OS build was not exposed. The development preview does not serve the production service worker (404), so this run is not offline evidence and does not establish Chrome/Edge support.
- Imported locally generated H.264/AAC MP4, VP9/Opus WebM, 48 kHz and 44.1 kHz WAV, 24 fps sync-marker MP4, and transparent RGBA PNG. SVG import was rejected with “container is not recognized”; the raster fixture decoded and rendered. No user media was used.
- Built a saved project with two occupied video tracks, two audio tracks, text and transparent image overlays, 0.5-second visual dissolve, 0.5-second audio crossfade, natural-pitch 1.5× audio, and detached sync-fixture audio. Refresh restored eight media entries, track positions, dimensions, edit settings, and local assets.
- Preview check at 9.5 seconds: sync video source `currentTime` and detached audio source `currentTime` were both 1.0 seconds. During playback, both advanced together; the second 1.5× audio clip advanced at the corresponding 1.5× source rate.
- The first export showed that the pitch-preserving Bungee path lost later 1 kHz transients at unity speed. Since unity speed does not alter pitch, `renderTimelineAudio` now bypasses Bungee at 1× and copies/resamples the decoded source directly. A pure helper regression test covers mode selection.
- After the fix, the 320×180, 24 fps, 48 kHz stereo AAC/H.264 MP4 was downloaded, fully decoded by FFmpeg, and played by VLC (exit code 0). A narrow 1 kHz bandpass/silence check located exported pulses at 9.50, 10.50, and 11.50 seconds, matching the video clip start at 8.5 seconds plus source markers at 1, 2, and 3 seconds. Output duration was 15.168 seconds.
- This is a targeted M6 renderer gate pass for the tested local configuration only. It does not close M6: static-host offline export, named browser matrix, speech review, longer sync/boundary cases, drag-trim/ripple, or cross-browser support remain unverified.

## M6 static preview checkpoint (2026-11-14)

- The post-hydration-fix production build was previewed on localhost port 4177. A new project with sync-marker video/audio, transparent image and text overlays, detached audio, and 320×180/24 fps output rendered a downloadable MP4 link on initial load. The output was not downloaded before the user asked to pause.
- A preceding static preview export was inspected externally: H.264/AAC, 320×180, 24 fps, 5.013 s; FFmpeg decoded all streams and VLC exited successfully. Narrow-band pulse peaks were measured at approximately 1.001, 2.001, and 3.001 seconds.
- All task-started local preview/development sessions were stopped. The development server does not serve `/sw.js`; service-worker install, offline reload, and offline export remain unverified. No result here closes M6 or establishes support for a named browser/OS combination.

## M6 trim, ripple, reload, and offline route check (2026-11-15)

- Environment: production static preview at `127.0.0.1:4178`, isolated headless Chrome 157.0.8103.79 on Windows, with two local video fixtures: H.264/AAC MP4 (4.000 s) and VP9/Opus WebM (4.008 s). The service worker was installed from the generated production build and controlled the studio page.
- At 60 px/s, dragging the first clip's right handle 30 px left changed its timeline width from 240 px (4.0 s) to 210 px (3.5 s) and moved the following Video 1 clip from 240 px to 210 px. Ctrl+Z restored both positions with one action.
- Dragging the first clip's left handle 30 px right moved its timeline start from 0 to 0.5 s and reduced its width to 210 px, preserving the prior 4.0 s end. The following clip stayed at 4.0 s. Refresh restored those positions; no route alerts appeared.
- With the service worker controlling the project page, network emulation was switched offline and the direct project URL was force-reloaded. The Video Studio shell and both locally persisted fixture clips reopened without alerts.
- An online production-preview render produced an in-app MP4 whose media element reported 1920×1080, 8.033 s, and 3,478,536 bytes. The export completed, but it was not downloaded for an independent player check. A first attempt to change export settings through automation did not change the app state, so this measurement reflects the project's saved default output settings.
- A following offline export attempt disconnected the isolated headless Chrome DevTools target before output metadata could be collected. It is not an export pass. Offline editing/saving and offline export remain open; this local headless check does not establish installed-device or cross-browser support.

## M4 resize and editable collage browser check (2026-11-15)

- Environment: production static preview at `127.0.0.1:4178`, isolated headless Chrome 157.0.8103.79. Imported the local 400×340 transparent checkerboard PNG in Image Resize. Entered custom 300×300 dimensions; the preview canvas and generated PNG were exactly 300×300. Decoding the output with `createImageBitmap` showed corner alpha values 255 and 0, confirming the output retained both opaque and transparent pixels. Selecting the original aspect ratio with width 300 recalculated height to 255.
- Imported the checkerboard fixture twice in Collage, changed the selected cell to `cover`, scale `2`, and X position `35%`, and confirmed the canvas pixel hash changed. Saved the project and refreshed its query URL; both image sources, per-cell settings, and the edited canvas returned with no route alerts.
- With the service worker controlling the reloaded project, forced network-offline mode, reloaded the direct project URL, and exported a PNG. Both local source images and the project reopened; the output decoded as a 1200×900 PNG (44,541 bytes) while `navigator.onLine` was false.
- This verifies the tested Chrome local-static path only. It does not replace external image-viewer/color review, other browser checks, or the separate image-studio layer/undo/save workflow.

## M5 custom-speed export fidelity (2026-11-15)

- Environment: production static preview at `127.0.0.1:4178`, isolated headless Chrome 157.0.8103.79, network emulation offline. Input was the CC0 4.000-second, mono 48 kHz, 440 Hz PCM fixture. Typed custom speed was 3.7×.
- The first browser export was 1.0811 seconds as estimated, but sample analysis found only 0.5973 seconds of tone followed by silence. A local Bungee `Transport` reproduction tied the truncation to 4,096-frame `render()` requests: its 16-grain-per-call limit was reached, while 2,048-frame requests rendered the complete 51,891 active frames with 440.31 Hz. The shared pitch-preserving block size is now 2,048 frames in Audio Speed, Audio Studio, and Video Studio's timeline audio renderer.
- After the change, the rebuilt Audio Speed page exported with the network offline. The WAV was 48 kHz stereo, 51,892 frames/1.0811 seconds; non-silent analysis spanned 1.0811 seconds and measured 439.85 Hz. The app status reached “Export complete” with no alert.
- Added a Core regression that runs the bundled Bungee WASM on a generated 4-second sine and checks full 3.7× duration, pitch, and zero transport underruns. Typecheck passed; the Core suite passed 17/17; production build/static verification passed with 27 routes, 22 indexable routes, and 50 cached assets. This does not close Audio Studio project, merge-boundary, browser-matrix, or noise-reduction gates.

## M5 profile-based noise reduction (2026-11-15)

- Replaced the broadband level gate with a basic spectral subtraction gate. The user chooses a noise-only sample range and custom 0–100% strength; a per-channel 2,048-frame STFT profile is used to reduce matching bins in the full recording. Preview keeps the original and cleaned WAV available for comparison. A bounded module worker handles analysis, progress, cancellation, and PCM WAV encoding. The route accepts files up to 128 MiB but limits decoded working audio to 64 MiB.
- Added `noisy-440-background.wav`, a four-second, mono 48 kHz CC0 signal with deterministic broadband noise and a 440 Hz tone beginning at 0.5 s. The Core signal check at 80% strength reduced noise-only RMS to 3.9% of source and retained 88.4% of tone-region RMS.
- In Chrome 157.0.8103.79, an offline export produced a 48 kHz mono WAV of four seconds with no alert. Repeated from a fresh tab controlled by the production service worker, the worker completed while offline and returned the same-format four-second WAV. Typecheck, 18/18 Core tests, and production static build/verifier passed (27 routes, 22 indexable, 51 cached assets).
- Cancellation UI and the progress message path are implemented, but explicit cancellation timing, external-player review, speech intelligibility, and additional noisy speech/music samples remain open. This is a basic steady-noise tool, not speech cleanup or vocal separation.

## Audio Studio preview effects and history (2026-11-15)

- Decision: keep preview attached to the source media element so custom speed and the browser pitch-preservation switch use native media playback, while routing the decoded output through a local Web Audio gain node for gain and fades. Schedule the envelope from the current source position and selected speed; use the same edit fields as WAV rendering. Do not rewrite source media for preview.
- Decision: keep a bounded 50-document, in-memory undo/redo history for the current editor session. Persist each resulting edit document through existing autosave; history itself is not serialized into the project format.
- Evidence/limit: typecheck, all 18 Core tests, and the production build passed (27 prerendered routes; 22 indexable; 51 precached assets). Browser audio listening, preview/export level comparison, history interactions, and project reopen remain unverified. These are implementation choices, not completion-gate evidence.

## Image Upscale: bundled on-device Real-ESRGAN (2026-11-15)

- Decision: replace browser canvas interpolation with ONNX Runtime Web and the Real-ESRGAN general v3 ×4 model. The pinned model revision is `0e95d93e454cf6b5de9bdf5a1c9e7ec340d38231`; both FP16 weights for WebGPU and FP32 weights for WebAssembly CPU are checked into `public/models/` with the BSD-3-Clause license. The static service worker precaches `.onnx` assets so the model is locally available offline after the PWA install.
- Implementation: run RGB inference in overlapping 256 px tiles with 16 px context; composite the source alpha at the requested final dimensions. Users can request custom output dimensions up to 50 megapixels; the model performs 4× inference and canvas resampling fits that result to the requested size.
- Sources: [ONNX Runtime Web browser guide](https://onnxruntime.ai/docs/tutorials/web/), [ONNX Runtime WebGPU guide](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html), and the pinned [Real-ESRGAN model card](https://huggingface.co/vlad-grig/realesr-general-x4v3-onnx/tree/0e95d93e454cf6b5de9bdf5a1c9e7ec340d38231).
- Evidence/limit: package install and typecheck passed. Browser WebGPU/CPU inference, image-quality review, alpha edge behavior, memory peak, and a PWA offline-install/export check are pending. The model may synthesize plausible detail; this can change texture and does not recover known original detail.

## Video Replace Audio: render one mixed output track (2026-11-15)

- Decision: turn the source-video audio and enabled additional lanes into one audible AAC mix in the MP4. Keep separate waveform/player previews for each source, while per-track start offsets and dB controls drive the mix. This matches the user's request to combine tracks, instead of muxing several selectable audio tracks that many players do not play simultaneously.
- Implementation: Mediabunny `AudioBufferSource` feeds the rendered Web Audio `AudioBuffer` into the MP4 output; the video conversion discards the original audio stream. Audio is decoded locally, scheduled through gain nodes in an `OfflineAudioContext`, and passed through a light dynamics compressor to reduce clipping. The source waveform is generated locally as 48 kHz stereo PCM. Limits are eight added lanes, 128 MiB aggregate added source files, four minutes of video, an eight-minute combined decoded-audio duration budget, and 192 MiB for the stereo PCM mix buffer. AAC encoder capability is checked before rendering.
- Sources: Mediabunny [AudioBufferSource API](https://mediabunny.dev/api/AudioBufferSource), [media sources guide](https://mediabunny.dev/guide/media-sources), and [writing media files guide](https://mediabunny.dev/guide/writing-media-files).
- Evidence/limit: typecheck and production static build passed (27 prerendered routes). Real source video/audio combinations, listening, memory use, AAC capability errors, and output playback in an external player still require browser review.

## Image tool discovery and editor reference review (2026-11-15)

- Reviewed the live [iLoveIMG home and tool catalog](https://www.iloveimg.com/). The catalog separates common image operations into Optimize, Create, Edit, Convert, and Security groups, and each tool has a direct name and short explanatory sentence. Adaptation: keep the Image category page as a clean, single list of image-only tools with task groups and concise descriptions; do not repeat category headings as a second grid of cards.
- Reviewed the live [BeFunky home](https://www.befunky.com/). It presents Photo Editor, Collage Maker, and Graphic Designer as distinct but connected workspaces; its collage description emphasizes editable layouts, automatic placement, and personalization. Adaptation: keep this app's collage distinct from the single-image editor, prioritize a visible canvas, selected-cell controls, and direct manipulation, with lower-frequency settings grouped below or collapsible. Use the interaction pattern, not BeFunky's branding or assets.
- These reference sites do not change the product's privacy boundary: imported images and all edits remain local. The user's product-wide dark palette and Ubuntu/Inter typography remain the design system.
