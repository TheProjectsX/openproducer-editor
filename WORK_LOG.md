# Work log

## 2026-11-14 — Repository foundation

- Initialized an empty Git repository in the project workspace.
- Recorded the existing product and implementation handoff as the baseline documentation.
- This foundation commit contains no application code; implementation starts with roadmap milestone M0.
- Verification: `git status` showed only the handoff documents as untracked immediately after initialization.
- Next: scaffold the static React Router app and begin the M0 feasibility prototypes, one vertical path at a time.

## 2026-11-14 — M0 root scaffold

- Renamed the local branch to `main`; `master` is no longer present.
- Generated React Router 8.5.1 in a temporary `app-scaffold/` directory because the generator would overwrite the handoff README when run in the root.
- The generator's dependency installation succeeded. Its nested Git initialization reported failure; the repository already has a single root Git repo.
- Moved the research handoff and all guides into `project_research/`; kept `AGENTS.md` at the root and created a root app README.
- Copied the React Router app, changed the package name to `local-studio`, set static output with prerendering, and removed the template's remote Google Fonts request for offline readiness.
- Environment constraint: pnpm's downloaded native executable is blocked by Windows Device Guard. npm is the working package manager in this environment.
- Next: install dependencies from the root lockfile, run typecheck/build, remove the temporary scaffold after validating the root app, then commit this setup feature.
- Root `npm ci` stalled without output and was stopped. The React Router generator had already installed the same lockfile dependencies in the temporary scaffold; the root installation is usable and the production build completed after rerunning with local-port permission.
- Removed `app-scaffold/` after confirming the root app, package files, and root `node_modules/.bin/react-router.cmd` existed. This also removed the only nested `.git`; the project now has one Git repository.
- Moved the handoff README and all 11 guides into `project_research/`; `AGENTS.md` remains at the root. Root app README documents npm commands and the research folder.
- Build result: Vite 8.3.8 and React Router 8.5.1 compiled successfully; React Router prerendered `/` to `build/client/index.html` and emitted the SPA fallback.
- Commit: `08da46d chore: initialize static app in root workspace`.

## 2026-11-14 — M0 audio trim prototype

- Added a pre-rendered `/tools/audio/trim` route and made it available from the home page.
- Implemented local audio decoding, exact custom start/end times, selected-range preview, and PCM 16-bit WAV export that preserves sample rate and channel count.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/audio/trim`.
- Limitation: this prototype decodes the complete input into memory and does not yet persist an editable project; derive safe file limits and move large jobs to workers during feasibility work.
- Commit: `334efe6 feat: add local audio trim prototype`.

## 2026-11-14 — M0 custom audio speed prototype

- Added `/tools/audio/speed` with typed 0.1×–16× input, shortcut buttons, pitch-preserved preview, estimated new duration, and WAV export.
- Added `bungee-web` 0.1.2 (MIT/MPL-2.0 plus bundled third-party notices) for WebAssembly/AudioWorklet time stretching; updated the technical choice and attribution guidance.
- Export estimates output size and disables rendering above a 512 MB prototype limit to avoid predictable memory exhaustion.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/audio/speed`, including the local WASM and worklet assets.
- Limitation: large-source decode and export still use in-memory audio buffers; benchmark quality and memory across the speed range before calling the M0 audio gate complete.
- Commit: `6c141e6 feat: add pitch-preserving audio speed prototype`.

## 2026-11-14 — M0 image resize prototype

- Added a pre-rendered `/tools/image/resize` tool page and linked it from the home page.
- Implemented local image import, exact custom width/height, aspect matching off by default, optional aspect locking, full-image stretch without crop/padding, canvas preview, and PNG download.
- Added responsive styling and removed the starter welcome screen from the primary route.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/` plus `/tools/image/resize`.
- Limitation: this is a feasibility prototype, not yet connected to local project persistence or a dedicated worker. Large-image limits still need measurement.
- Commit: `7b09843 feat: add local exact image resize prototype`.

## 2026-11-14 — M0 video trim/export prototype

- Added `/tools/video/trim` with local video preview, custom start/end seconds, duration validation, conversion progress, and MP4 download.
- Added Mediabunny for browser-side media demuxing/conversion. Export attempts to use the primary audio/video tracks and supports browser codec paths through its conversion API.
- Added a 512 MiB source-file ceiling because this prototype buffers exported output in memory; error messaging explains compatibility and memory limitations.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/video/trim`; Vite reports one 600.79 kB minified lazy media-processing chunk, which is expected from the codec library and should be profiled/code-split as the tool set grows.
- Limitation: this is a single-range trim proof of feasibility, not a CapCut-style timeline. Browser codec support, trim boundaries, and output quality vary by media; sample files still need interactive browser QA.
- Commit: `b0da596 feat: add local video trim prototype`.

## 2026-11-14 — M0 audio merge prototype

- Added `/tools/audio/merge` for importing up to 20 local audio clips, reordering/removing them, setting a custom 0–600 second inter-clip gap, and exporting one WAV.
- Added linear resampling to the highest input sample rate and mono-to-multichannel duplication where needed. Decoded and exported buffers each have a 512 MiB prototype guard.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/audio/merge`; the existing 600.79 kB lazy media-processing chunk warning remains.
- Limitation: export renders the entire file in memory and uses 16-bit PCM WAV; workers, streaming output, project persistence, and broader export formats remain future work.
- Commit: `ab575d7 feat: add local audio merge prototype`.

## 2026-11-14 — M0 image aspect controls

- Expanded `/tools/image/resize` with selectable free/original/common/custom ratios. Locked ratios update the paired dimension when either width or height changes; free mode keeps independent custom dimensions.
- Kept the full-frame resize behavior without cropping or padding, and added a 100-megapixel / 32,768-pixel-per-side guard to prevent unreasonable canvas allocations.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered the updated `/tools/image/resize` route; the existing lazy media-processing chunk warning remains.
- Limitation: browser canvas resampling is not a dedicated high-quality image-processing pipeline; image editing filters, layers, and AI upscaling remain separate work.
- Commit: `6723091 feat: add selectable image aspect ratios`.

## 2026-11-14 — M0 installable offline app shell

- Added a PWA web manifest, 192px and 512px icons, theme color, and browser service-worker registration.
- Added a post-build generator that versions the offline cache from built file contents, precaches generated local assets and each prerendered route (including slash/no-slash aliases), retains the active cache until a complete new install, and serves an offline fallback for uncached navigations.
- User-selected media is never added to service-worker caches.
- Verification: `npm run typecheck` and the production build passed; the build generated the worker with 18 static assets and 7 prerendered HTML routes. `node --check build/client/sw.js` passed. Browser installation/offline behavior still needs hands-on verification on the deployed HTTPS origin.
- Limitation: this is the core app shell only; project storage, OPFS, persistence UX, and large optional models are not cached or implemented. Cache install needs connectivity and enough browser storage for all listed app assets.
- Commit: `fae6e5f feat: add installable offline app shell`.

## 2026-11-14 — M0 basic image adjustments

- Extended the local image resize canvas with custom numeric brightness, contrast, and saturation values (0–300%), composited before preview and PNG export.
- Invalid/temporarily empty inputs render with neutral 100% values, and valid values are bounded to the documented range.
- Verification: `npm run typecheck` passed. `npm run build` passed and regenerated the prerendered image route and offline worker; the existing 600.79 kB media-processing chunk warning remains.
- Limitation: browser canvas filters are basic destructive adjustments; there are no layers, masks, nondestructive history, or color-managed professional controls yet.
- Commit: `3d2b784 feat: add basic image adjustment controls`.

## 2026-11-14 — M1 IndexedDB project registry

- Added a versioned IndexedDB store for local project records with create, list-by-recent-update, and delete operations.
- Added a prerendered `/projects` page with typed audio/video/image workspace creation and deletion. The page is `noindex` and clearly states that this stage saves metadata only; editor state and source media are not yet attached.
- Added a link to project management from the home navigation. The build-time service-worker generator includes the new prerendered route automatically.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/projects`; the generated offline worker now includes 19 assets and 8 local HTML routes.
- Limitation at this step: project metadata was local to the browser profile and audio/video editing states were not connected.
- Commit: `7eaf2a9 feat: add local project registry`.

## 2026-11-14 — M1 image project persistence

- Upgraded project storage to IndexedDB schema v2 and added image project settings, source metadata, get/update operations, and deletion cleanup.
- Source image files use the Origin Private File System (OPFS) when available, with a Blob-in-IndexedDB fallback. Image adjustment settings auto-save and restore from `/studio/image?project=<id>`.
- Image workspaces created from `/projects` now open the saved image editor; the route is prerendered and marked noindex. Audio/video workspace records remain metadata-only.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/studio/image`; the generated offline worker includes 23 static assets and 9 HTML routes.
- Limitation: OPFS/browser quota errors can still prevent project media saves; there is no quota dashboard or storage cleanup UI yet.
- Commit: `9b4a028 feat: persist local image project edits`.

## 2026-11-14 — M0 video audio extraction

- Added `/tools/video/extract-audio` with local video preview, primary audio track extraction, progress, and 48 kHz stereo 16-bit WAV export.
- Uses Mediabunny browser-side conversion and predicts PCM output size before export; input and output are capped at 512 MiB.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/video/extract-audio`; the lazy Mediabunny bundle is now 614.01 kB minified and triggers Vite's chunk-size warning.
- Limitation: this exports only the primary audio track and depends on browser decoding/encoding support; broader audio format selection and streaming writes remain future improvements.
- Commit: `9510506 feat: add local video audio extraction`.

## 2026-11-14 — M0 audio split prototype

- Added `/tools/audio/split` with arbitrary comma-separated custom cut timestamps, segment plan preview, and multi-file 16-bit PCM WAV output packaged into a ZIP.
- Added `fflate` 0.8.3 (MIT) for local ZIP creation; source decoding is capped at 512 MiB and combined output at 256 MiB.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/audio/split`; the generated offline worker includes 26 static assets and 11 HTML routes.
- Limitation: full decoded source, WAV segments, and ZIP are memory-backed; long files need worker/streaming export before production use.
- Commit: `b95f3b6 feat: add custom audio splitting`.

## 2026-11-14 — M0 broadband audio noise gate

- Added `/tools/audio/noise-gate` with custom threshold, reduction amount, attack, and release controls; processed audio preview and WAV export run locally.
- Uses envelope-following gain reduction with a soft knee, preserving the source sample rate and channel count.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/audio/noise-gate`; the generated offline worker includes 27 static assets and 12 HTML routes.
- Limitation: this is a broadband gate for quieter noise, not neural or spectral denoising; voice quality and threshold tuning need sample-based browser evaluation. Audio processing currently runs on the UI thread.
- Commit: `9df2245 feat: add local audio noise gate`.

## 2026-11-14 — M0 image upscaling prototype

- Added `/tools/image/upscale` with custom 1×–8× multipliers, exact target dimensions, optional aspect matching, preview, output estimates, and PNG download.
- Uses high-quality browser canvas resampling with 100-megapixel and 32,768-pixel side limits. The interface explicitly states that this enlarges/interpolates pixels and does not invent details with AI.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/image/upscale`; the generated worker includes 28 static assets and 13 HTML routes.
- Limitation: the requested AI super-resolution model, optional offline model download, tiling/progress, and before/after zoom comparison remain future work.
- Commit: `4d76720 feat: add custom browser image upscaling`.

## 2026-11-14 — M0 image collage prototype

- Added `/tools/image/collage` with multiple local images, custom canvas size, columns, spacing, background color, cell-fit behavior, ordering/removal, live preview, and PNG export.
- Uses `createImageBitmap` and Canvas locally; source files are capped at 20 and 512 MiB total, output at 100 megapixels.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/image/collage`; the generated worker contains 29 static assets and 14 HTML routes.
- Limitation: this is a uniform grid collage with one shared fit mode; freeform cell placement, text, layers, and project persistence remain future editor work.
- Commit: `b622d82 feat: add local image collage maker`.

## 2026-11-14 — M0 explicit image crop tool

- Added `/tools/image/crop` with local image import, exact left/top/width/height crop coordinates, live result preview, validation against source bounds, and PNG export.
- Kept cropping as its own explicit workflow; exact resize continues to stretch the full source frame unless a user visits this crop tool first.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/image/crop`; the generated offline worker includes 30 static assets and 15 routes.
- Limitation: crop selection currently uses exact fields rather than a draggable overlay; common/custom ratio constraints are future improvements.
- Commit: `0ab8071 feat: add exact image crop tool`.

## 2026-11-14 — M0 stereo vocal reducer

- Added `/tools/audio/vocal-reducer` with stereo-only center cancellation, custom 0–100% strength, original/processed preview, and WAV download.
- The tool explains that center cancellation also removes centered instruments and is not neural voice separation; mono sources are rejected with an explanation.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/audio/vocal-reducer`; the generated worker contains 31 assets and 16 routes.
- Limitation: quality varies significantly by mix and stereo placement; actual AI vocal separation requires a separate model and license review.
- Commit: `563db3f feat: add stereo center vocal reducer`.

## 2026-11-14 — M0 audio gain and fade controls

- Added `/tools/audio/volume` with custom gain from −60 to +24 dB and custom fade-in/fade-out seconds, preview comparison, and WAV export.
- Fades use sample-level linear envelopes and validate their combined duration against the source; output preserves sample rate and channel count.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/audio/volume`; the generated worker contains 32 assets and 17 routes.
- Limitation: this prototype renders full buffers in memory and clamps boosted samples if the selected gain clips; production export needs metering and workers.
- Commit: `20b6906 feat: add custom audio gain and fades`.

## 2026-11-14 — M0 image rotation and flip

- Added arbitrary −180° to 180° rotation and horizontal flip to the image editor; the renderer expands canvas bounds to keep the complete rotated image visible.
- Added rotated-size output limits, custom degree input, preview dimensions, PNG naming, and project auto-save/restore for transform settings.
- Verification: `npm run typecheck` passed. `npm run build` passed with all routes prerendered and the offline worker regenerated; its route/asset count remains 17/32.
- Limitation: no arbitrary-angle drag control, vertical flip, rotation interpolation modes, or nondestructive transform stack yet.
- Commit: `a2e660d feat: add image rotation and flip controls`.

## 2026-11-14 — M0 custom video speed prototype

- Added `/tools/video/speed` with a custom 0.1×–16× playback rate, pitch-preservation toggle, estimated output duration, local preview, and realtime browser recording.
- Uses `HTMLMediaElement.captureStream` and `MediaRecorder` only when the browser reports a compatible capture/recording path; the output container/extension is selected from supported MIME types.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/video/speed`; the generated worker contains 33 assets and 18 routes.
- Limitation: export runs in real time, browser codecs and captured audio behavior vary, and output is WebM in browsers without MP4 MediaRecorder support. User must inspect output, especially at extreme speeds where browsers may mute audio.
- Commit: `886cfd1 feat: add custom local video speed recording`.

## 2026-11-14 — M0 video audio removal

- Added `/tools/video/remove-audio` with local preview, primary audio discard, Mediabunny conversion progress, and muted MP4 export.
- Limits input and buffered output to 512 MiB; video packet copying is preferred by Mediabunny where supported, with conversion fallback.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/video/remove-audio`; the generated worker contains 34 assets and 19 routes.
- Limitation: this removes the primary audio track only; multiple audio tracks, container choice, and streaming output remain future work.
- Commit: `9be1af1 feat: add local video audio removal`.

## 2026-11-14 — M0 video audio replacement

- Added `/tools/video/replace-audio` to compose a local video track and replacement audio track into MP4, with a custom 0–600 second start offset and synchronized progress.
- Uses Mediabunny composable conversions, trims new audio to the remaining video duration, and caps each source/output at 512 MiB.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/tools/video/replace-audio`; the generated worker now includes 35 assets and 20 routes.
- Limitation: output requires supported video/audio browser codecs; no custom gain/fades, waveform alignment, multiple audio tracks, or streaming target yet.
- Commit: pending.
