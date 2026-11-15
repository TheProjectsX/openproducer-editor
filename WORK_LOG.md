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
- Commit: `fa34dac feat: add local video audio replacement`.

## 2026-11-14 — M6 video timeline foundation

- Added `/studio/video` and wired video workspaces in Projects to open it. The home page now links creators into project creation rather than marking the studio as planned.
- Added a versioned timeline record with local media bin, six video/audio tracks, draggable clip placement, exact source in/out and timeline start fields, split at playhead, custom clip speed/volume/mute, timeline zoom, and topmost visual source preview.
- Source media and timeline edits persist in IndexedDB; per-file and per-project size limits are enforced. Removed media references are cleaned up when the edit model is saved.
- Updated the feature matrix and decision log to state precisely what this foundation does and does not yet render.
- Verification: `npm run typecheck` passed. `npm run build` passed and generated `build/client/studio/video/index.html`; `build/client/sw.js` lists both `/studio/video` and `/studio/video/` for offline navigation. Browser runtime behavior has not yet been exercised.
- Limitation: this is not yet a composed multitrack preview or MP4/WebM export. Audio mix, overlays/text, transforms/keyframes, transitions, history, and renderer parity remain subsequent M6 work.
- Commit: `8beb57b feat: add local multitrack video timeline foundation`.

## 2026-11-14 — M6 composited video preview

- Replaced the single-source preview with an HTML canvas compositor that layers all active video/image clips from low to high track at the current playhead. Video sources are locally sought and played at each clip's custom speed; images retain transparency.
- Updated the feature matrix and decision record. The preview uses fitted sources on a dark canvas and does not yet evaluate transforms, filters, titles, transitions, or audio mixing.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/studio/video`.
- Limitation: this is an in-app visual preview only; export parity and audio synchronization are not available until the renderer and audio mixer slices land.
- Commit: `c5c3cb5 feat: add composited video timeline preview`.

## 2026-11-14 — M6 synchronized audio preview

- Connected each audio clip to the shared timeline playhead. Multiple audio clips now play concurrently with custom clip offsets, source trims, speed, mute, and 0–1 volume; audio is paused outside its active timeline interval.
- Retained pitch where supported by setting the browser media element's `preservesPitch` behavior. Play begins directly from the user action to work with autoplay policies.
- Updated the feature matrix and browser-dependence notes. No media leaves the browser.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/studio/video`.
- Limitation: this is browser playback preview; it does not yet create a mixed audio track in export. Pitch-preservation implementation is browser-dependent and awaits device verification.
- Commit: `2401f90 feat: add synchronized video timeline audio preview`.

## 2026-11-14 — M6 timeline history and clip duplication

- Added clip duplication, 50-step undo/redo buttons, and Ctrl/Cmd+Z plus Ctrl/Cmd+Shift+Z shortcuts. Import, move, trim, split, duplicate, mute/volume/speed edits, and clip deletion are timeline history steps.
- Kept media-bin source assets when deleting their last clip so undo can restore project references without losing the local file. Timeline model remains autosaved independently of the in-memory history stack.
- Updated editor capability notes and documented that undo history resets on page reload.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/studio/video`.
- Limitation: undo history is not yet persisted and this history only covers timeline edits, not playback position or view zoom.
- Commit: `079f59c feat: add video timeline undo and clip duplication`.

## 2026-11-14 — M6 local timeline export

- Added a frame-by-frame canvas timeline renderer and export panel. The renderer checks WebCodecs encoders at runtime and picks MP4 (AVC/AAC) or WebM (VP8/VP9/Opus) only when the full combination is available.
- Added custom canvas dimensions, frame rate, video bitrate, and audio bitrate controls. Export renders audio tracks to one 48 kHz stereo mix using local Bungee pitch-preserving time stretch, per-clip trim/speed/gain/mute, and peak normalization; frames and mixed audio are written through Mediabunny.
- Added progress, cancellation, in-browser output preview/download, and explicit limits of 120 timeline seconds, 4 megapixels, 180 seconds of unique audio sources, and 512 MiB output. The project stays editable and sources unchanged.
- Updated feature matrix and decision notes with primary Mediabunny API sources and known gaps.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `build/client/studio/video/index.html`; browser output-file fidelity remains unverified.
- Limitation: this slice has not yet been browser-tested against representative files. Original audio embedded in video is muted/omitted; only explicit audio-lane clips are mixed. Full export can take longer than realtime and remains memory-backed. Transform/effects/text/transitions are not implemented.
- Commit: `3d75f5d feat: add local multitrack video export`.

## 2026-11-14 — M6 visual clip transforms

- Added custom per-clip X/Y position, scale, rotation, and opacity controls for video/image clips. Defaults preserve the existing centered fit; controls write into the saved clip model.
- Updated the shared compositor so preview and export apply transforms around the canvas center in the same order; legacy clips without transform settings keep identity values.
- Updated editor capability and data model notes.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/studio/video`.
- Limitation: no keyframe animation, transform interpolation, or per-clip transform presets yet.
- Commit: `f5b2a82 feat: add video clip transform controls`.

## 2026-11-14 — M6 editable text titles

- Added an “Add text title” action that creates a 5-second overlay clip on the top video lane. Title text, font size, text color, optional background color, and timeline duration are editable.
- Stores title instructions as a zero-byte versioned local project asset and renders them through the same canvas compositor used for timeline preview and video export.
- Updated editor status and local-project data notes.
- Verification: `npm run typecheck` passed. `npm run build` passed and prerendered `/studio/video`; `git diff --check` passed.
- Limitation: one system sans-serif style is available; text tracks do not yet include fonts, borders, shadows, animations, or keyframes.
- Commit: `4470ef6 feat: add editable timeline text titles`.

## 2026-11-14 — M6 visual fade transitions

- Added custom per-clip linear fade-in and fade-out durations for video, image, and text overlay clips. Opacity ramps are evaluated in the shared canvas compositor, so preview and export use the same transition behavior and lower lanes show through.
- Updated the editor guidance and feature matrix. Audio crossfades and other transition curves remain unimplemented.
- Verification: `npm run typecheck` passed, `git diff --check` passed. `npm run build` passed and prerendered `/studio/video` plus generated the offline service worker.
- Commit: `3979b03 feat: add custom video fade transitions`.

## 2026-11-14 — M6 clip keyframes

- Added optional clip-relative keyframes that capture transforms and audio volume at the playhead. Inspector controls show interpolated values; changing those controls after the first key updates the key at that time. Timeline markers show key positions, and the inspector can remove a key at the playhead.
- Added linear interpolation shared by the video compositor, live audio preview, and exported audio mix. The model remains backward compatible for clips without keyframes.
- Updated the feature matrix and implementation decisions.
- Verification: `npm run typecheck` passed, `git diff --check` passed. `npm run build` passed and prerendered `/studio/video` plus generated the offline service worker.
- Commit: `bd2786a feat: add interpolated video timeline keyframes`.

## 2026-11-14 — M6 visual clip filters

- Added custom brightness, contrast, saturation, and grayscale controls for video and image clips. Filters are saved as clip instructions and applied by the shared canvas preview/export compositor.
- Updated the feature matrix and implementation decisions with the browser canvas-filter caveat.
- Verification: `npm run typecheck` passed, `git diff --check` passed. `npm run build` passed and prerendered `/studio/video` plus generated the offline service worker.
- Commit: `ae2e594 feat: add local video clip color filters`.

## 2026-11-14 — M6 audio fade transitions

- Extended per-clip custom fade-in/fade-out from visual clips to audio clips. Live audio preview and rendered PCM apply the same linear envelope; overlapping clips on audio lanes can now crossfade.
- Updated the feature matrix and implementation decisions. Curved fades remain outstanding.
- Verification: `npm run typecheck` passed, `git diff --check` passed. `npm run build` passed and prerendered `/studio/video` plus generated the offline service worker.
- Commit: `848f32e feat: add audio timeline fade transitions`.

## 2026-11-14 — M6 keyframe timeline controls

- Added visible keyframe markers on clip blocks and a control for removing the key at the playhead, completing basic key placement and cleanup affordances.
- Verification: `npm run typecheck` passed, `git diff --check` passed. `npm run build` passed and prerendered `/studio/video` plus generated the offline service worker.
- Commit: `b5657c5 feat: add timeline keyframe markers and removal`.

## 2026-11-14 — M6 source audio detachment

- Added a cancellable local WAV extraction action for the selected video clip. The extracted audio is stored as a normal local project asset and placed on Audio 1 with the clip's timeline start, source trim, and speed; the video source itself remains untouched.
- Enforced the existing 512 MiB project media limit and added duplicate-detachment detection. Updated the known behavior: source audio is available through explicit detachment, not auto-mixed from video clips.
- Verification: `npm run typecheck` passed, `git diff --check` passed. `npm run build` passed and prerendered `/studio/video` plus generated the offline service worker. Typecheck required workspace write permission for generated React Router route types.
- Commit: `6c5707e feat: detach video audio into timeline clips`.

## 2026-11-14 — M6 timeline snapping

- Added configurable snapping during clip drag/drop to same-lane clip starts/ends, current playhead, and nearest whole second. Users can turn snapping off or enter a custom tolerance.
- Updated the feature matrix to reflect the behavior.
- Verification: `npm run typecheck` passed, `git diff --check` passed. `npm run build` passed and prerendered `/studio/video` plus generated the offline service worker.
- Commit: `8c5d53a feat: add configurable video timeline snapping`.

## Session handoff — 2026-11-14

### Current repository state

- Single project repository on `main`, root Git only; no nested repository. Latest implementation commit: `8c5d53a`.
- Working tree was clean after the timeline snapping commit.
- Current work follows the M6 section in `project_research/docs/07-implementation-roadmap.md`. Do not start M7 until M6's real-media, save/reopen, offline, and output-file verification gate is met.

### Built and committed in this session

- Video clip transforms (position, scale, rotation, opacity) shared by preview/export: `f5b2a82`.
- Editable text title clips, color/background/font size, timeline overlay, shared rendering: `4470ef6`.
- Custom visual fade-in/fade-out: `3979b03`.
- Clip-relative transform/volume keyframes with linear interpolation: `bd2786a`.
- Per-clip brightness/contrast/saturation/grayscale filters: `ae2e594`.
- Audio fade envelopes and overlapping audio crossfades: `848f32e`.
- Keyframe markers and remove-at-playhead controls: `b5657c5`.
- Selected-video primary audio extraction into a local WAV clip: `6c5707e`.
- Configurable drag/drop snapping to same-lane clip edges, playhead, and whole seconds: `8c5d53a`.
- Every feature above passed `npm run typecheck` and `npm run build`; production builds prerender the declared routes and generate the offline service worker. No unit/browser media tests were run.

### Next work (in order)

1. **Finish the M6 gate with real files and browsers:** verify import, title/transform/filter/fade/keyframe preview, detached audio, saved-project reopen, MP4/WebM export playback outside the app, and offline direct route behavior on the declared Chrome/Edge targets. Record device, media fixtures, format/codec, duration, output playability, timing, and failures in `project_research/docs/10-decisions-and-sources.md` and the browser matrix. The current compile/build check does not establish media fidelity.
2. **Fix gaps exposed by those checks before expanding features.** In particular verify detachment WAV duration/range against video audio streams, export memory behavior, canvas filter browser support, preview/export sync and transitions, offline asset caching, and storage quota recovery.
3. **Complete remaining Core video controls** per the feature matrix: transition UI for an explicit dissolve between visual clips (current fades cover edge opacity and audio overlap); implement if M6 verification and actual renderer behavior support it. Add any missing track/clip controls from real use without broadening unsupported claims. Embedded source audio is not mixed automatically; users must detach it.
4. **Audit Core image and audio requirements** in `project_research/docs/02-feature-matrix.md` against working implementations. Image editor layers/text/shapes/project persistence and audio waveform/normalization/stronger basic noise reduction/WAV projects may remain incomplete. Finish each as a narrow, saved/exportable/offline slice and log/commit it.
5. **Only after the Core gates:** plan M7 model downloads and offline inference for vocal/instrument separation, stronger speech cleanup, and tiled AI image upscaling; record model provenance, license, checksums, resource limits, and benchmark evidence. The current image upscaler is browser resampling, not AI.
6. **Release hardening (M8):** browser/codec support matrix, accessibility/SEO, install/update/offline checks on deployment, storage recovery, CSP/headers, performance budgets, and honest feature labels. Build size still warns that a minified bundle exceeds 500 kB, largely due to the media stack.

### Important implementation limits

- Video export is browser-memory-backed, capped at 120 seconds, 4 megapixels per frame, 180 seconds of unique source audio, and 512 MiB output. Large projects can exceed practical device memory before reaching every nominal cap.
- Video render/export has compile/build verification only so far. Test actual output; don't treat “build passed” as a playable-file or preview-parity check.
- Source-video audio extraction is user-triggered and creates a separate WAV. It is not automatically mixed from video clips.
- Keyframe values interpolate linearly and are clip-relative. Undo history is in memory and resets after reload.
- AI operations and claims are not implemented; no backend, upload, account, or runtime service should be introduced.

## 2026-11-14 — Core transition and audio project slices

- Added explicit “Dissolve into next clip” and “Crossfade into next clip” actions. They create same-track overlap and corresponding linear fades consumed by the shared preview/export timing; clips now composite in start order within a track.
- Added a dependency-free `node:test` core suite for video keyframe holds/interpolation, keyframe replacement, and fade envelope boundaries.
- Added `/studio/audio/` with local source persistence, waveform rendering, exact trim values, 0.1×–16× speed, pitch-preserved default/natural pitch option, gain/fades, cancellable chunked WAV rendering, progress, and project reopen. Audio source references are removed when deleting their project.
- Verification: `npm run test:core` passed (4 tests) and `npm run typecheck` passed. Full browser, offline, external-player, and high-memory audio checks remain outstanding.

## 2026-11-14 — M6 browser smoke check and title entry point

- Installed the exact locked npm dependencies and started the local editor.
- Found that the existing `addTitle` handler had no UI entry point. Added a responsive “Add text title” button next to media import so title clips can be created from the editor.
- Used generated local SVG and WAV fixtures to import image/audio, create and edit a title, apply a custom fade and scale, render MP4, and refresh/reopen the same project. The rendered MP4 decoded in the browser at 1920×1080 and 5.013 seconds for the 5-second timeline.
- Confirmed the canonical static production path `/studio/video/` prerenders the Video Studio shell. The no-slash path on Vite preview fell back to the public home page, so static-host direct-route behavior still needs verification against the actual deployment’s slash handling.
- Verification: `npm run typecheck`, `npm run build`, and `git diff --check` passed. Build generated the service worker with 37 assets and 21 prerendered routes; Vite still reports a 642.98 kB minified chunk.
- Updated the feature matrix and decision log with observed behavior and limitations. M6 remains incomplete: no external-player inspection, named Chrome/Edge run, actual video fixture/A/V sync check, or offline reload was completed.

## 2026-11-14 — Core audio and image slices; phase audit

- Added the `/studio/audio/` single-source local project path with waveform, trim range, custom speed and pitch mode, gain/fades, save/reopen model, and cancellable WAV render. Added a focused peak-normalize WAV tool, explicit video dissolve/crossfade controls, image shape/text layers and presets, plus project duplication/storage controls.
- Re-ran current checks: `npm.cmd run typecheck`, `npm.cmd run test:core` (6/6), `npm.cmd run build`, and `git diff --check` passed. Build generated 23 prerendered routes and 41 precache assets; it reports a 642.98 kB media chunk and an ineffective dynamic WASM import.
- Updated the feature matrix and decision log to state what exists and what is still incomplete. Core is not release-ready: collage edit documents, real-video A/V sync/output inspection, supported-browser/offline/deployed-route evidence, and storage recovery tests remain pending. Audio Studio is single-source; the existing noise tool is a broadband gate. M7 AI and M8 hardening are not complete.

## 2026-11-14 — Static hosting metadata and 404

- Added a pre-rendered static 404 page, baseline Cloudflare Pages security headers, canonical links from a configured `VITE_SITE_URL`, generated robots rules, and a sitemap derived from public prerendered HTML. An unset host omits sitemap URLs rather than guessing; a configured value must be an HTTPS origin.
- Checked the generated sitemap with `https://example.invalid`: public routes appeared and studio/project shells did not. Checked that an unconfigured build removes sitemap output and keeps studio/project disallow rules. Removed a duplicate Normalize Audio card found during the route audit.
- `npm.cmd run typecheck` and `npm.cmd run build` passed after these changes. Deployed 404 status, actual host headers, CSP, and route refresh behavior still require Pages verification.

## 2026-11-14 — Editable collage projects

- Added a versioned collage document with local source asset references, dimensions, layout, spacing, fit mode, background, caption, text size/color, and source order. The collage route can save and reopen projects; Projects opens collage documents in the collage editor; duplicate/delete copy and clean up referenced assets. Project schema now migrates through version 4.
- Validation: typecheck and core suite passed (7/7), including the schema 3→4 migration. The actual browser import/save/refresh/reopen/PNG/offline path has not yet been run.

## 2026-11-14 — Pre-rendered tool directories and route verifier

- Added the all-tools index and audio, video, and image category pages with unique pre-rendered titles/descriptions. Home now links to the directory. The static build runs an output verifier for route HTML, titles/descriptions/headings, noindex pages, 404, headers, robots, optional origin-bound canonicals/sitemap, and service-worker entries.
- Verified a normal build: 26 prerendered routes, 22 indexable public pages, and 4 noindex shells. Configured-origin build checks had already confirmed canonical/sitemap behavior; default build omits sitemap. Typecheck and core suite (7/7) passed. Build still reports the large media chunk and dynamic WASM import warning.

## 2026-11-14 — Worker-based audio normalization

- Moved peak scanning and PCM16 WAV encoding into a dedicated module worker. The main thread copies/transfers bounded 65,536-frame chunks, updates progress, supports cancellation between chunks, and builds the output from transferred PCM blocks. Decode remains on the main thread.
- Added math/format tests for custom dBFS gain, silence, clipping/interleaving, channel-length validation, and WAV header fields. Core suite passes 10/10; typecheck and production build pass, and the worker is emitted as its own bundle asset. Other long-running media paths still need worker-job protocol coverage.

## 2026-11-14 — Safer source replacement

- Replaced in-place image/audio source writes with immutable asset IDs. New bytes are written before the project pointer changes; OPFS write failures remove partial directories before IndexedDB fallback. Audio keeps the prior source until its edit document commit succeeds. Legacy project source paths still reopen; project schema advances to version 5.
- Reordered deletion so IndexedDB removes the project and asset references atomically before OPFS cleanup. A failed record transaction no longer removes the project’s source first.
- Validation so far: typecheck and 10 core tests pass. Quota exhaustion, interrupted writes, and browser storage recovery are still untested, so storage integrity is not yet release-gated.
- Extracted clip-duration math into a pure timing module and covered 3.7×, 0.1×, 16×, zero, and non-finite speed behavior. Final checks for this slice: typecheck, 12/12 core tests, production build/static verifier (26 routes; 22 indexable), and `git diff --check` passed.

## 2026-11-14 — Storage settings and project cleanup

- Added `/settings/storage/` with on-device usage/quota, persistent-storage status and request, a site-data clearing explanation, and confirmed per-project deletion. Linked it from Projects and marked it `noindex`; the static verifier now enforces that settings routes are also excluded from indexing.
- Verification: typecheck passed, core suite passed 12/12, and build verified 27 prerendered routes (22 indexable, 5 noindex), including the settings shell. Quota-failure and browser eviction behavior remain unverified.

## 2026-11-14 — User-controlled app updates

- The service worker now stays waiting after a new cache is fully prepared. The app shell detects a waiting update, asks the user to finish/save active edits, and exposes a reload action that signals the worker to activate. The static verifier rejects automatic `skipWaiting` and requires the explicit activation message.
- Typecheck, 12 core tests, production build, 27-route static verification, and `git diff --check` passed. Update installation and active-edit behavior still need a deployed/offline browser run.
# 2026-11-14 — Studio import codec inspection

- Added byte-based container and codec inspection to Audio and Video Studio import using the already pinned Mediabunny dependency.
- Check rejects files with unknown containers, missing A/V tracks, or any audio/video track that this browser cannot decode. Detected format, codecs, and dimensions/sample format are available in the inspection result; project UI confirms recognized container and codec after import.
- Verified with `npm.cmd run typecheck`, `npm.cmd run test:core` (12 passing), and `npm.cmd run build` (27 prerendered routes). Build continues to report the known ~643 kB media-processing chunk and Bungee WASM dynamic-import warning.
- This does not close M3: shared import is not yet wired into every tool, and a fixture-based format matrix, external output inspection, and browser/device verification remain pending.
- Audio Studio uses the same inspection before decoding and saving an audio source.

## 2026-11-14 — Image export formats

- Added JPEG export alongside PNG, with a typed 0–1 quality value and explicit white background for JPEG transparency handling.
- Saved export format and quality with image-project settings; older projects default to PNG at quality 0.92 without a schema migration.
- Updated the image workspace heading and product notes. Typecheck, 12 core tests, production build, 27-route static verification, and `git diff --check` pass. Browser route visually showed the new format selector; image fixture export and project reopen are not runtime-verified.
- Replaced layer-only undo with one bounded 100-step history for image settings and layers. Source replacement starts a fresh history; older schema-5 project records remain compatible. Typecheck, 14 core tests, production build, 27-route static verification, and `git diff --check` pass. Browser-level undo/redo and reopen still require fixture-based verification.
- Static preview direct-loaded `/studio/video` at its nested URL. Import now classifies audio/video media from parsed track bytes, not MIME prefixes; declared images are decoded and checked against project dimension limits before saving.
- Added per-audio-clip pitch mode in Video Studio. Pitch preservation remains the default; natural mode uses browser playback without pitch preservation and matching linear resampling during export. Existing saved clips without the field retain preserve mode. Added resampling tests; typecheck and 15 core tests pass.
- Added locally generated CC0 fixtures for H.264/AAC MP4, VP9/Opus WebM, mono PCM WAV at 48/44.1 kHz, a 400×340 checkerboard/transparency image, and two collage subjects. FFprobe 7.1.4 confirmed codecs, dimensions, rates, channels, and durations; fixture provenance and expected metadata are in `tests/fixtures/core-media/README.md`. No browser media import/export or spoken sync-marker check has passed yet.
- Added a four-second H.264/AAC sync fixture with visual second markers and 1 kHz pulses at 1, 2, and 3 seconds. FFprobe confirmed 320×180/24 fps and mono/48 kHz; FFmpeg silence detection measured all pulses at their expected timestamps. The fixture still needs app-level import/preview/export verification.
- Attempted the requested internal browser test against a fresh local preview origin. The browser tool reported that Computer Use was stopped with the physical Escape key and instructed that no further Computer Use calls be made this turn, so fixture testing in the browser could not proceed. This was resolved in the next turn using a fresh internal browser preview; see the M6 gate result below.

## 2026-11-14 — M6 synthetic multitrack browser gate

- Imported generated H.264/AAC MP4, VP9/Opus WebM, PCM WAV at 48/44.1 kHz, sync-marker MP4, and transparent PNG in the Codex in-app browser. SVG decoding failed with a user-visible unsupported-container error; raster PNG rendered.
- Built two occupied video tracks, two audio tracks, text/image overlays, dissolve, crossfade, 1.5× natural-pitch audio, and detached sync audio. Refresh restored eight media assets and edit positions. At timeline 9.5s, sync video and detached audio were both at source time 1.0s; the second 1.5× audio clip advanced at the expected source rate.
- Fixed playhead change crash by reading `event.currentTarget.value` before scheduling the React state updater. Added a regression helper so pitch-preserving processing is bypassed at exactly 1×, where no time stretch is required.
- Exported and downloaded a 320×180, 24 fps, 15.168 s H.264/AAC file. FFmpeg fully decoded it; VLC returned exit code 0. Narrow-band analysis found 1 kHz sync pulses at 9.50, 10.50, and 11.50s. This caught and verified the 1× Bungee transient-loss fix.
- Local dev preview cannot serve `sw.js`; offline/PWA checks are not covered. Named Chrome/Edge and longer sync/boundary checks remain open. The accompanying PNG was generated locally with Pillow from the documented CC0 pattern.

## 2026-11-14 — M6 static preview checkpoint and pause

- After the hydration guard fix, started a fresh production static preview at `127.0.0.1:4177` and loaded a new Video Studio project with the sync-marker MP4, transparent PNG overlay, text overlay, detached source audio, and 320×180/24 fps export settings.
- The latest render produced a downloadable MP4 link without a browser error on the initial route load. A prior static preview export (`local-studio-edit (4).mp4`) was inspected: H.264/AAC, 320×180, 24 fps, 5.013 s; FFmpeg decoded it and VLC exited successfully. Narrow-band audio analysis found sync pulses at approximately 1.001, 2.001, and 3.001 seconds.
- Stopped local preview sessions 4173, 4174, 4175, 4176, and 4177 at the user's request. The 4175 development server logged `/sw.js` as an unmatched route, so no offline pass is claimed.
- Still pending: download and inspect the latest 4177 output; reload the post-fix static project route; test service-worker install and offline reload/export; complete the remaining M6 timing, interaction, browser, and representative-output gates. The phase is not complete.

## 2026-11-15 — Paused-session handoff

- Recorded the full active Core objective, worktree/process state, latest verified evidence and limitations, exact browser project IDs/outputs, roadmap-ordered open gates, useful commands, and next-session instructions in `SESSION_HANDOFF.md`.
- Goal remains paused by user request; all local preview processes remain stopped. This entry is handoff documentation only, not phase completion or permission to begin M7.

## 2026-11-15 — M6 drag trim and primary-track ripple

- Added left/right pointer trim handles on timeline clips. Left trim preserves the prior clip end while adjusting source-in and timeline start; right trim adjusts source-out. Existing numeric source in/out fields remain available.
- Added the “Ripple edits on Video 1” switch, enabled by default. Changes to source-in, source-out, or speed shift later clips on Video 1 by the clip end-time delta; overlay and audio lanes are not moved. One drag gesture creates one undo entry and the preview/autosave follows the trim.
- Updated interaction and feature documentation. Direct trim/ripple interaction checks remain open; the production build and static route verifier do not prove pointer behavior.
- Verification: `npm.cmd run typecheck`, `npm.cmd run build` (27 routes verified, 22 indexable, service worker generated), and `git diff --check` passed. The core test suite was not run in this slice.
- Commit: `c5e626f feat: add video timeline trim and ripple editing`.

## 2026-11-15 — M6 video editor keyboard shortcuts

- Added Space play/pause, frame-step Left/Right, Shift+Left/Right one-second seek, Home to start, S split, Delete/Backspace remove, Ctrl/Cmd+Z undo, and Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo.
- Kept text and numeric input behavior intact and avoided intercepting normal Space behavior on focused buttons and links.
- Updated the interaction specification and feature matrix. Cross-browser keyboard and screen-reader behavior still needs direct accessibility review.
- Verification: `npm.cmd run typecheck`, production build (27 routes verified, 22 indexable, service worker generated), and `git diff --check` passed. Cross-browser key testing was not performed.
- Commit: `6529d85 feat: add video studio keyboard shortcuts`.

## 2026-11-15 — M6 imported-audio replacement

- Added selected-video inspector controls to choose a local audio asset already in the project and enter a custom offset. The editor places a new editable Audio 1 clip with the selected video's speed and an in-range source duration.
- If the selected video placement has a detached primary-audio WAV, the replacement action mutes that matching detached clip while preserving other audio clips and assets.
- Updated the interaction spec and feature matrix. Runtime interaction, save/reopen, and export sync checks remain open.
- Verification: `npm.cmd run typecheck`, production build (27 routes verified, 22 indexable, service worker generated), and `git diff --check` passed. Runtime interaction and output sync were not verified.
- Commit: `4acdc15 feat: add timeline source audio replacement`.

## 2026-11-15 — M6 detached-audio relationship notice

- Added a selected-audio-inspector notice that identifies the source video and explains that detached audio is independent from later video speed edits.
- Updated the interaction guidance and feature matrix to reflect the user-visible behavior.
- Verification: `npm.cmd run typecheck`, production build (27 routes verified, 22 indexable, service worker generated), and `git diff --check` passed. No browser interaction was performed.

## 2026-11-15 — M6 browser verification: trim, ripple, reload, offline route

- In an isolated production preview on Chrome 157.0.8103.79, imported the H.264/AAC MP4 and VP9/Opus WebM fixtures. Dragged the first right trim handle by 30 px at 60 px/s: its duration changed 4.0→3.5 s and the following Video 1 clip rippled 4.0→3.5 s. One Ctrl+Z restored both clips.
- Dragged the first left trim handle 30 px right: timeline start changed to 0.5 s, duration became 3.5 s, the prior end stayed at 4.0 s, and the following clip stayed at 4.0 s. Refresh restored this state without a route alert.
- Confirmed the production service worker controlled the project page. With network emulation offline, a forced reload of the direct project URL restored both clips without a route alert.
- An online render completed and the app's video element reported MP4, 1920×1080, 8.033 s, 3,478,536 bytes. The file was not inspected outside the app. The automated attempt to alter output dimensions did not update the controlled input state, so these are the saved project defaults.
- An offline export attempt disconnected the isolated browser before a resulting file could be checked; no offline-export pass is claimed. See `project_research/docs/10-decisions-and-sources.md` for environment and measured positions.

## 2026-11-15 — M4 per-cell collage editing and browser gate

- Added per-image `global`/`contain`/`cover` fit, 0.25×–4× scale, and typed X/Y pan controls. The preview/export clips each independently transformed image to its cell. Settings save as optional fields in the version-1 collage document; old records default to the global fit, 1×, and centered placement.
- Added validation for each per-cell numeric value and updated the data-pipeline and feature-matrix guidance.
- Production browser verification: exact 400×340→300×300 resize output, PNG alpha retained, original aspect mode recalculated 300×255; two-image collage changed one cell to cover/2×/35% X, saved and refreshed with the settings intact, then reloaded offline and exported 1200×900 PNG while offline.
- `npm.cmd run typecheck` and `npm.cmd run build` passed. Build verified 27 static routes (22 indexable) and generated the service worker. External viewer/color inspection and the image-studio layer/undo/save path remain open.

## 2026-11-15 — M5 pitch-preserving speed truncation fix

- A production-browser check of custom 3.7× found that the 4-second 440 Hz fixture exported only 0.597 s of tone inside a 1.081 s WAV. Isolating Bungee showed 4,096-frame `Transport.render()` calls could reach the library's 16-grain limit and stop output early; 2,048-frame requests rendered the full duration with no underruns.
- Added a shared 2,048-frame constant and applied it to Audio Speed, Audio Studio, and Video Studio timeline audio. Added a regression test using the bundled Bungee WASM, a generated four-second 440 Hz signal, and the 3.7× setting.
- Rebuilt the production app and repeated the Audio Speed export with network disabled. The resulting WAV had 51,892 stereo frames at 48 kHz (1.0811 s), active signal for 1.0811 s, and a measured pitch of 439.85 Hz. Typecheck passed, the Core suite passed 17/17, and build/static route verification passed (27 routes; 22 indexable; 50 cached assets).
- Other M5 gates remain open: Audio Studio save/reopen, 0.1×/16× and 5×/6× output checks, pitch-mode listening comparison, merge boundaries/rates, noise-reduction quality, and external-player inspection.

## 2026-11-15 — M5 profile-based noise reduction

- Replaced the broadband threshold gate with a noise-profile spectral reduction tool. It accepts a custom noise-only source range and strength, keeps original and processed previews, and exports WAV.
- Moved STFT analysis and WAV encoding to a module worker with progress, cancellation messages, chunked worker yields, and cleanup. Capped file input at 128 MiB and decoded audio at 64 MiB to bound memory use.
- Added a deterministic CC0 noisy-tone fixture and a Core check that confirms background RMS reduction while retaining the 440 Hz tone.
- Production browser check on Chrome 157: 4-second fixture produced a 4-second 48 kHz mono WAV; noise-only RMS fell to 3.9% of the source and tone-region RMS stayed at 88.4%. Repeated from a service-worker-controlled tab with the network offline and received the same-format WAV without an alert.
- Typecheck passed, Core suite passed 18/18, and production build/static verification passed (27 routes, 22 indexable, 51 cached assets). Worker cancellation timing and external-listener quality review remain open.
- Commit: `07da27c fix: explain detached audio speed behavior`.
