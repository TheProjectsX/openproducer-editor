# Work log

## 2026-11-18 — Header navigation polish and CapCut PC Video Studio parity (Batches 1–5)

- Moved `.tool-breadcrumbs` out of `.tool-page-header` to the top-left of tool pages above `.resize-intro`, added hover/outside-click/Escape auto-close for header tool-group dropdowns and Video Studio `<details>` menus.
- Logged the CapCut PC feature gap analysis in `project_research/docs/12-capcut-pc-gap-analysis.md` and implemented Batches 1–5 in `/studio/video`:
  - **Preview & Canvas:** Click-to-select any active visual clip in `.editor-stage`, image preview rotation handle, default-on `Maintain aspect ratio when resizing`, video overlay move/resize/rotate handles, 6 px center/edge magnetic snap guides, click-empty-stage deselection, and zoomable/pannable preview stage (`Fit / 50%–200% / 25%–400%`, `Ctrl+wheel`, drag-to-pan).
  - **Timeline & Tracks:** Per-lane `Hide`, `Mute`, and `Lock` gutter controls (`trackStates` across preview/playback/export); `−`/slider/`+`/`Fit` timeline zoom; `Ctrl`/`Shift` multi-clip selection; right-click context menu (`Split`, `Copy`, `Paste`, `Duplicate`, `Freeze frame`, `Detach audio`, `Delete`); dynamic Project Details track counts; non-overlapping `Audio N` placement on detach and `Move to new Audio N` drop target on audio drag; magnetic playhead snapping; preserved clip selection during seekbar movement and restricted `.track-lane` clicks to deselection.
  - **Inspector, Left Panel, & Shortcuts:** Inline `◇`/`◆` keyframe toggles; text styling parity (font, bold/italic, align, line height, stroke, shadow, background radius/opacity); `Hue`/`Sepia`/`Blur` + reset; blend modes; speed presets + reverse `Target duration` input; 6 text presets, `Shapes` tab (6 SVG shapes + color picker), and Wipe/Slide/Zoom/Fade-to-black transitions rendered as 3-column rectangular preview tiles; `Q`/`W`/`J`/`K`/`L`/`-`/`+`/`?` shortcuts, shortcut modal, and inline `renameProject`.
- Verification: `npx.cmd tsc --noEmit --pretty false`, `npm.cmd run test:core` (37/37), and `git diff --check` passed.

## 2026-11-17 — Dynamic Video Studio lanes

- Replaced the fixed six-lane display with an empty main drop area and lanes derived from placed clips. Dragging visual or audio media temporarily exposes a new compatible lane; text titles create an overlay lane above the main lane. Existing numeric track assignments remain unchanged.
- Centered the main lane vertically with balanced flexible space above and below it, compensating for unequal overlay and audio lane counts.
- Moved centering space outside the lane stack so adjacent lanes have no gap. Audio lanes remain hidden until occupied. General audio drops create or append Audio 1; targeted audio drops use their timeline position and open another lane when overlapping. Visual media requires a lane drop (keyboard activation uses the playhead).
- Bound Ctrl+wheel zoom directly to the timeline viewport with a non-passive listener. The existing shared scale changes clip widths and maintains the pointer's timeline time by scrolling the viewport. Direct TypeScript compilation and diff checks pass; browser gesture review remains open.
- Built the current production app and opened it on port 5173. A five-second local color clip measured 300 px wide at 60 px/s and 600 px at 120 px/s. The browser tool could not send Ctrl and wheel as one gesture, so that specific input path is still unverified.
- Corrected pointer-centered zoom on short timelines: added enough scrollable width, retained the hovered timeline time after React lays out the new clip widths, and covered the required scroll position with a pure regression check. Direct TypeScript compilation and 28 Core tests pass; modifier-wheel browser input is still unverified.
- Fixed text title timeline dragging: allowed text on positive overlay tracks, stopped temporary lane insertion from shifting existing clips during a drag, added an independent higher-overlay drop target, and cleared drag state on drop. In a fresh production browser preview, a title moved from 0 to 3 s on Overlay 1, then to Overlay 2; refresh restored Track 2/start 3 s. TypeScript, 29 Core tests, and production build pass.
- Added focused lane-layout checks. Browser drag/drop, save/reopen, export ordering, and offline verification remain open.

## 2026-11-16 — Drag collage photos between cells and add background swatches

- A drag that stays within a photo's source cell continues to pan the photo. Dragging across a cell boundary now highlights the target, swaps with an occupied cell, or moves into an empty cell. Added a Cell position selector as a keyboard alternative.
- Added eight labeled background presets (White, Slate, Soft gray, Sky, Cream, Blush, Mint, Lavender) and kept the custom color input.
- Verification: in the running app, dragging Cell 1 onto occupied Cell 2 swapped the images; dragging that photo to empty Cell 6 moved it and restored Add Photo in Cell 2. A short within-cell drag changed the photo position without moving cells; the selector moved it to Cell 3. Mint preset changed the canvas and the custom color picker remained available. Direct `tsc --noEmit` and `git diff --check` passed; no formal suite was run.

## 2026-11-16 — Polish secondary editor buttons

- Reset and utility buttons only had background, border, and text colors, so the browser's square default shape and control styling remained visible.
- Added a shared outlined, rounded secondary-button treatment with consistent sizing, hover/pressed/focus/disabled states. Export buttons keep their existing primary sizing and colors.
- Verification: the running collage editor showed the Reset image controls button with an 8 px radius, 36 px minimum height, and layered blue-gray surface. `git diff --check` passed; no formal test suite was run for this CSS-only change.

## 2026-11-16 — Reflow collage photos when custom grid dimensions change

- Reproduced the supplied screenshots by placing photos in Cells 5 and 9, then reducing the custom grid from 3×3 to 3×2. The stored cell slots no longer fit the new geometry, rendering was rejected as invalid, and the previous canvas remained underneath the newly positioned Add Photo buttons.
- Custom grid dimension and template changes now compact photos in their prior cell order into the new cell geometry. When a grid has fewer cells than photos, the stale canvas is cleared and the message tells the user to add rows or columns.
- Verification: the running app reflowed two photos into Cells 1 and 2 after changing to 3×2; all four remaining Add Photo cells aligned within the new grid. A 1×1 grid with two photos showed a blank preview, the specific capacity message, and disabled export. Expanding to 2×2 and choosing Big Photo Top restored the photos in the resized layout. Core tests passed 18/18 and direct `tsc --noEmit` passed. `npm.cmd run typecheck` could not load the existing Windows Tailwind native binding (EPERM); `git diff --check` passed.

## 2026-11-16 — Keep collage Add Photo cells aligned to the canvas

- At a 1096×738 browser viewport, the collage stage was 640.8×480.6 px while the generic image preview rule capped its canvas at 428 px high. Empty-cell buttons remained positioned against the full stage, so they visibly extended past the rendered collage.
- Added a collage-specific max-height override so both preview canvases fill the stage and stay aligned with the Add Photo cells.
- Verification: running app reproduced the mismatch and, after the override, measured a 640.8×480.6 px stage and canvas with all eight empty-cell buttons inside the stage at 1096×738. Repeated the requested one-image → custom 2×2, two-image → custom 4×2, and two-image → Big photo top changes; visible empty cells stayed inside the canvas in each state. No formal test suite was run.

## 2026-11-16 — Collage template geometry and studio sidebar

- Diagnosed the malformed single-photo grid: template geometry was derived directly from uploaded image count, so a two-column layout with one image had only one row and stretched its cell across the canvas height. Layouts now retain at least two full rows (or their template-specific minimum), independently of photo count.
- Added visible empty cell placeholders with direct Add photo actions. Photos occupy stable cell slots; remove/reorder and saved/reopened collage projects preserve those slots, including older projects without slot metadata.
- Reorganized collage tools into an Image Manager, Layouts, Customize, and Text sidebar. Moved image order and per-photo controls into their relevant panels and removed the long settings stack below the canvas.
- Took interaction cues from BeFunky's documented layout customization, cell add/remove, and in-collage image editing workflow. Verification: `tsc --noEmit` passed; browser visual and pointer interaction review remain pending because browser/computer-use controls are unavailable in this session. Git status/add still fail with “this operation must be run in a work tree,” so this feature could not be committed.

## 2026-11-16 — Distinguish proportional downscaling from exact resize

- Reworked Downscale Image into a proportional scale tool with custom percentage and 1 ÷ n reduction-factor modes. Switching modes preserves the same effective scale (for example, 50% ↔ 2× smaller).
- Output dimensions are derived from the original pixels, rounded to the nearest pixel, and always preserve the source aspect ratio. Removed the exact width/height and aspect-ratio editor from this tool; those remain in Resize.
- Updated Downscale page description and catalog copy. Verification: `tsc --noEmit` and manual trailing-whitespace checks passed; browser UI review remains pending.

## 2026-11-16 — Crop aspect and exact-dimension controls

- Added free, keep-current-selection, common preset, and custom crop ratios. Aspect locking constrains drag-to-draw and all eight resize handles while preserving the opposite edge/corner; the crop can still be moved freely.
- Added custom ratio inputs and exact crop width/height fields. Editing either dimension follows the selected ratio, and the selection stays inside the source image.
- Verification: `tsc --noEmit` and manual trailing-whitespace checks passed; interactive browser review remains pending.

## 2026-11-16 — Crop inside Image Resize

- Removed the color-adjustment and overlay-layer control groups from the standalone Resize and Downscale tools; those controls remain in the Image Studio project workspace.
- Added an in-place crop view to `/tools/image/resize`: users can draw a selection, move it, resize it from eight handles, apply it, then set output pixels. The output canvas and download now resample the applied source rectangle without an intermediate file. Reset restores the full source image and dimensions.
- Added Crop and Output preview tabs so the source selection and resulting resized image are both available in the same editor.
- Verification: `tsc --noEmit` and manual trailing-whitespace validation passed. The app-level typecheck is still blocked by the checkout's missing Rolldown native binding; browser pointer interaction and crop/export fidelity remain pending.

## 2026-11-16 — Upscale before/after comparison slider

- Added a synchronized before/after viewer for Image Upscale. The AI result fills the comparison stage, the original is clipped over it, and a keyboard-accessible range control moves the visible split line from 0 to 100 percent.
- Show the uploaded original before processing; show the existing progress component over it during enhancement. Comparison resets to the center when a new source image is chosen.
- Verification: `git diff --check` and typecheck pending; drag/keyboard/browser layout review remains pending.

## 2026-11-16 — Collage templates and per-image editing

- Reviewed [BeFunky's collage workflow](https://www.befunky.com/create/collage/), which highlights customizable layouts, changing aspect ratio, adding/removing cells, and editing photos directly in the collage. Added classic grid, big-photo left/right/top, wide-row, and tall-column templates with adjustable canvas dimensions, grid columns, and spacing.
- Made every cell directly selectable and draggable in the collage preview. Added an on-canvas remove-cell action plus per-image fit, zoom, X/Y placement, rotation, horizontal flip, brightness, contrast, and saturation controls. Image-list removal/reordering remains available.
- Persisted the template and per-image controls in locally saved collage projects, with defaults when opening older saved projects. Export uses the same edited canvas rendering.
- Verification: `git diff --check` and `tsc --noEmit` passed. Browser drag, template, save/reopen, and export review remain pending.

## 2026-11-16 — Interactive image crop selection

- Added a crop overlay directly on the source image. Users can drag the crop area to move it, drag any of eight edge/corner handles to resize, or drag outside the current selection to draw a new rectangle.
- The crop overlay and existing pixel fields stay synchronized; the generated cropped result remains visible below the source editor and is still the exported PNG.
- Verification: source/CSS diff and `git diff --check` reviewed; pointer interaction and browser layout remain pending.

## 2026-11-16 — Give Video Trim result preview a full-height stage

- Increased the trimmed-result video stage to a 350 px minimum, with the containing preview growing to at least 400 px. The result preview can now fit its video, custom transport, and edit action before the control panel begins, instead of overflowing over the controls.
- Kept the result video contained at its source aspect ratio and let the workspace scroll when the larger preview and controls exceed the viewport.
- Verification: source/CSS diff and `git diff --check` reviewed; browser layout verification remains pending.

## 2026-11-16 — Skip service-worker registration in development

- The service worker is generated into the production client output after the static build. The app previously attempted to register `/sw.js` during the dev server session too, where that file does not exist, causing React Router's “No route matches” error.
- Limited registration/update handling to production. Production builds and installed PWAs continue to register the generated worker.
- Verification: source and `git diff --check` reviewed; browser dev-server check remains pending.

## 2026-11-16 — Preserve portrait ratio in Video Trim preview

- Video Trim now reads the source video's encoded frame dimensions and constrains portrait preview stages to that aspect ratio. A 9:16 source displays in a narrow portrait stage instead of a wide landscape stage; the video frame is contained without stretching.
- Capped the portrait preview to 24dvh (up to 360px) so it fits alongside the trim ruler, timeline, and transport inside the preview panel rather than overlapping the controls below.
- Reset stored dimensions when a new source is chosen. Labels already embedded in a clip remain part of the source frame, not preview UI.
- Verification: source and CSS diff reviewed; browser playback and aspect-ratio review remain pending.

## 2026-11-16 — Localize trim resize and drag cursors

- Audio and video trim timelines now show `ew-resize` only within 7 px of a trim boundary. The default/selected-area cursor stays normal for click-to-seek; dragging the selected range changes to a grabbing cursor only after the pointer moves.
- Video timeline clicks now seek, while a drag moves the selected range. Audio timeline clicks continue to seek, and dragging inside the range moves it. Both dedicated playheads remain draggable and show grabbing only while held.
- Verification: `git diff --check` passed. Browser pointer review was not run.

## 2026-11-16 — Seekable audio waveform and continuous video trim playhead

- Made Audio Trim's source waveform seekable by clicking or dragging its playhead. The separate trim range remains full-source aligned, and its playhead does not resize to the edited output length; the output transport also reports and seeks on the full-source timeline, mapping through removed sections to the nearest edit boundary.
- Made Video Trim's playhead seekable by dragging it directly and synchronized it with the media clock on every animation frame during playback, keeping the playhead visually continuous instead of waiting for coarse `timeupdate` events. The trim range remains independently draggable.
- Audio waveform selection now treats a stationary click as a seek and a drag as a range edit. Added a wider pointer target around both waveform playheads while retaining the thin visual indicator.
- Verification: `git diff --check` passed. Typecheck/build and browser playback review were not run in this session; the project-local dependency tree has a previously recorded missing Rolldown WASI binding, and browser interaction remains to be confirmed.

## 2026-11-15 — Handover issue audit and Audio Trim responsiveness

- Reviewed `SESSION_HANDOFF.md` and recorded all nine open audit areas individually with current evidence and remaining browser/runtime checks.
- Audio Trim previously rescanned the full decoded waveform and synchronously rebuilt an edited WAV for every pointer move. It now caches waveform peaks, updates selection state without full-audio rescans, defers edited preview regeneration until movement settles, and uses the original gesture boundaries for edge drags.
- `npm.cmd run test:core` passed 18/18 before attempting dependency repair. `npm.cmd run typecheck` failed because Tailwind's Windows native binding could not load and Vite resolution returned `EPERM`; a sequential retry reproduced it. `npm ci` failed because Windows denied unlinking a locked Lightning CSS native module, after which `bungee-web` was missing and a second core test run failed during module loading. Direct `tsc` also found missing `@types/node` and `vite/client`. Browser interaction checks were not possible; the pre-existing package-lock change was preserved.

## 2026-11-15 — Dark visual system and media workspace navigation (in progress)

- Replaced the flat homepage tool list with exactly three entry cards: Audio Editor Tools, Video Editor Tools, and Image Tools. `/tools` is now the same three-way workspace selector, and each category page displays only that category's tools.
- Added a shared dark charcoal/navy palette, blue/cyan/violet accents, a responsive editorial landing layout, and dark full-width styling for existing tool and video-studio shells.
- Added locally bundled Ubuntu 400/500/700 and Inter Variable fonts so typography does not depend on a network font service. General text uses Ubuntu; headings use Inter.
- Updated route metadata and feature/design notes. Later design slices below add editor onboarding, time-selection timelines, custom players, direct-manipulation image layers, and workspace-level fit/scroll behavior; manual visual review is still pending.
- Verification: `npm.cmd run typecheck` passed. `npm.cmd run build` passed and verified 27 prerendered routes (22 indexable). The generated service worker includes local font files. The known ~643 kB processing chunk and Bungee dynamic-import warning remain. Visual browser review is pending because this session still does not expose direct Chrome controls; the localhost preview has been queued in the Codex browser panel.
- Commit: `e456214 feat: redesign dark media workspaces`.

## 2026-11-15 — Interactive image overlay canvas

- Added a separate transparent interaction canvas over Image Resize's export canvas. Users can select a visible overlay by clicking it, drag it to reposition, and drag the selected lower-right handle to resize it. Pointer coordinates are mapped back through preview scaling, image rotation, and horizontal flip.
- Selection outlines and handles are rendered on the interaction canvas and therefore do not appear in exported PNG/JPEG output. Existing numeric position/size inputs remain available for precise values. A pointer gesture is recorded as one undo history action.
- Verification: typecheck and production build passed (27 prerendered routes, 94 cached assets). Visual drag, transformed-image hit testing, export cleanliness, and single-step undo need browser interaction review.

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
- Commit: `de6183c feat: add worker-based spectral noise reduction`.

## 2026-11-15 — Audio Studio preview effect parity

- Found that Audio Studio preview applied source range and playback speed but ignored saved gain, fade-in, and fade-out values that are applied during WAV rendering.
- Routed the local audio element through a lazily created Web Audio gain node. Playback schedules the selected gain and fade envelope against the current source position and custom speed; the audio source remains local and no edit is applied to the original file.
- Updated the feature matrix and phase status. Project save/reopen, preview/export listening parity, speed boundary cases, and WAV external-player checks remain open.
- Verification: `npm.cmd run typecheck` passed; `npm.cmd run test:core` passed 18/18; `npm.cmd run build` passed and verified 27 prerendered routes (22 indexable) and 51 cached assets. The existing ~643 kB bundle warning and Bungee WASM dynamic-import notice remain. Browser listening and project reopen checks are still pending.

## 2026-11-15 — Audio Studio settings undo and redo

- Added a bounded 50-step history for Audio Studio edit settings, reset when a new source is imported. Undo/redo buttons are available in the workspace; Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl/Cmd+Y work outside editable fields so native text editing remains intact.
- Undo/redo restores the full saved edit document, so autosave continues to persist the selected range, speed/pitch mode, gain, and fades together.
- Updated Audio Studio feature and gate notes. Route-level history and save/reopen checks are pending.
- Verification: `npm.cmd run typecheck` passed; `npm.cmd run test:core` passed 18/18; `npm.cmd run build` passed and verified 27 prerendered routes (22 indexable) and 51 cached assets. The existing ~643 kB bundle warning and Bungee WASM dynamic-import notice remain. Route-level history and save/reopen interaction checks remain pending.
- Follow-up: recorded the preview graph and bounded history design plus validation limits in `project_research/docs/10-decisions-and-sources.md`.
# 2026-11-15 — Design: source-first tool entry, custom previews, and full-screen workspaces

- Added a reusable drag/drop and local-file picker screen for audio, video, and image workflows. Audio Merge and Image Collage accept multiple files from the same screen; saved-project loading remains supported for collage. The multitrack Video Studio remains directly open as the requested exception.
- Applied source-first entry to all standalone media tools and Audio Studio, including image resize/crop/upscale/collage, audio trim/split/speed/merge/effects/normalization, and video trim/speed/audio operations. Replacing the source stays available within each loaded editor.
- After media loads, the tool description collapses and the editor expands to the viewport. Dense controls scroll inside their workspace; smaller-screen layouts return to normal document scrolling.
- Replaced visible browser-native media controls in the standalone audio/video tools and Audio/Video Studio export previews with app-styled local play and timeline controls. Audio previews use a designed media surface; Video Speed keeps its capture-capable media element and uses app transport controls.
- Updated the interface direction and status in the feature matrix. Image pointer controls and trim timeline interactions still need a human browser review.
- Verification: `npm.cmd run typecheck` passed; `npm.cmd run build` passed and verified 27 prerendered routes (22 indexable) with 95 service-worker assets. Existing Bungee dynamic-import warning remains.
# 2026-11-15 — Design: waveform ranges and split markers

- Added a shared waveform range timeline with direct edge trim, selection move, and drag-to-create behavior. Noise Reduction uses it to choose a noise-only sample; Volume/Fades uses it to place fade boundaries; Audio Studio uses it to select source in/out points.
- Audio Studio records one undo-history entry per waveform gesture while keeping its typed source range fields synchronized. Added an interactive split timeline that creates cut points on the track and lets users drag them; the comma-separated custom input and segment list stay synchronized.
- Updated the feature matrix. Browser interaction, accessibility, and narrow viewport review are still pending.
- Verification: `npm.cmd run typecheck` passed; `npm.cmd run build` passed and verified 27 prerendered routes (22 indexable), with 97 service-worker assets. Browser interaction, accessibility, and narrow viewport review are still pending.
- Commit: `90e7ae2 feat: add interactive audio timelines`.
# 2026-11-15 — Design: merge and replacement-audio timelines

- Added a proportional audio merge sequence above its existing reorder list so users can see clip order and relative duration at a glance.
- Added a video/audio placement lane to Video Replace Audio. Dragging its scrub input updates the same custom offset value used by the typed field; audio length is read from local metadata when available.
- Verification: `npm.cmd run typecheck` passed; `npm.cmd run build` passed and verified 27 prerendered routes (22 indexable), with 97 service-worker assets. Browser interaction remains pending.

## 2026-11-15 — Design: Image Studio viewport gate

- Corrected the Image Studio shell to enter full-screen mode only after an image has loaded. Before import, its title and source-selection screen remain visible together.
- Verification: `npm.cmd run typecheck` passed; `git diff --check` passed.

## 2026-11-15 — Design: Audio Speed timeline transport

- Replaced Audio Speed's static preview placeholder with a local audio surface and app play/pause/scrub controls. The timeline follows Bungee's pitch-preserved source-position reports and seeking operates in source frames.
- Updated the interface status and removed the last decorative, fake waveform bars from generic audio preview cards; labels now identify each local audio preview.
- Verification: `npm.cmd run typecheck` passed; `git diff --check` passed; `npm.cmd run build` passed and verified 27 prerendered routes (22 indexable), with 97 service-worker assets.

## 2026-11-15 — Design: grouped Image Resize controls

- Grouped Image Resize settings into canvas size, color adjustments, transform/export, and overlay-layer panels. Canvas size and adjustments start open; less frequent export and layer settings can be collapsed.
- Updated the feature matrix. Verification: `npm.cmd run typecheck` and `git diff --check` passed; production build passed and verified 27 prerendered routes (22 indexable), with 97 service-worker assets.

## 2026-11-15 — Design: homepage workspaces and Creative Studio placement

- Moved the three media workspace cards to the top of the homepage, ahead of the marketing hero.
- Added a distinct Creative Studio shortcut for multitrack audio, video, and image editing.
- Removed the multitrack video editor from Video Tools and linked Audio Studio and Image Studio to their actual editor routes. Updated the displayed video tool count.
- Verification: `npm.cmd run typecheck` passed. Visual review remains pending.

## 2026-11-15 — Navigation: tool breadcrumbs and group menus

- Replaced the misleading standalone editor headers with a shared navigation header: linked Home and media-workspace breadcrumbs, the current tool name, and hover/focus/click dropdowns for audio, video, and image tools.
- Added the Creative Studio breadcrumb at the multitrack editor route while keeping it outside the Video Tools category. Existing project and storage headers remain unchanged.
- Verification: `npm.cmd run typecheck` passed. Browser pointer, keyboard, and narrow-screen navigation review remains pending.

## 2026-11-15 — Audio Trim: keep or remove selection

- Added Keep only selection and Remove only selection modes to Audio Trim. The output WAV is assembled from one or two source ranges, so removing a middle selection joins the surrounding audio.
- The edited WAV preview refreshes when the selection or mode changes and has its own app transport and seek control. The source waveform indicates the selected region as kept or removed.
- Time fields, waveform labels, status, and preview transport now display three decimal places; time fields use a 1 ms step.
- Verification: `npm.cmd run typecheck` and `git diff --check` passed. Playback and export interaction review remains pending.

## 2026-11-15 — Audio Volume and video extraction previews

- Volume and Fades now builds the processed WAV preview automatically after import and after each valid gain/fade change. The preview is the edited output and has a working custom transport; removed the extra manual preview action and original-player comparison that obscured the result.
- Added a reusable local WAV waveform renderer and placed the extracted-audio waveform and custom player beneath the source video after extraction. The extraction route now also releases replaced result URLs and reports source duration to three decimals.
- Added a reusable animated processing spinner for local preview work.
- Verification: `npm.cmd run typecheck` and `git diff --check` passed. Audio-level listening and video-file extraction/export checks remain pending.

## 2026-11-15 — Compact media tool layouts and time precision

- Standalone audio and video editors now use a centered, compact vertical workspace after import: preview/timeline above and controls beneath, instead of stretching a small control panel beside a mostly empty preview. This covers Audio Trim, Speed, Split, Merge, effects, Volume, Video Trim, Speed, Extract, Remove, and Replace Audio.
- Video Trim's range fields and direct timeline gestures now use millisecond precision, while the linked playhead slider is also movable at 1 ms increments. Audio/video tool time readouts now show three decimal places.
- Custom media transport displays time in seconds to three decimals.
- Verification: `npm.cmd run typecheck` and `git diff --check` passed. Visual review at desktop and mobile sizes remains pending.

## 2026-11-15 — Interactive clip ordering and collage containment

- Audio Merge now supports dragging clips in both the proportional timeline and its order list. Its WAV preview is regenerated after clip order or gap changes, and the same preview is used for download.
- Image Collage image rows can be reordered by drag and drop with keyboard-friendly move buttons retained. Added a dedicated collage page class, clipped the canvas preview to its panel, and kept the image order area below the editor without allowing the canvas to paint over it.
- Verification: `npm.cmd run typecheck` and `git diff --check` passed. Drag/drop and image canvas visual review remain pending.

## 2026-11-15 — Video export result previews and progress feedback

- Video Speed now switches its preview panel to the completed speed-adjusted WebM/MP4 after recording, and exposes a custom playback/seek transport for the actual output.
- Remove Audio now previews the muted export and includes Mediabunny's track-discard reasons in compatibility errors. Video Trim, Extract Audio, Remove Audio, and Speed show an animated progress bar with a percentage during processing.
- Verification: `npm.cmd run typecheck` and `git diff --check` passed. Actual source-file conversion behavior still requires browser interaction with representative MP4/WebM files.

## 2026-11-15 — AI image upscaling with offline model assets

- Replaced plain Canvas resizing in Image Upscale with tiled Real-ESRGAN general v3 ×4 inference through ONNX Runtime Web. WebGPU is preferred; WebAssembly CPU is the fallback. Users can choose any larger output dimensions within the 50 megapixel memory limit; the source alpha is composited at the final size.
- Pinned model revision `0e95d93e454cf6b5de9bdf5a1c9e7ec340d38231`; bundled 2.4 MB FP16 and 4.9 MB FP32 model assets plus the BSD-3-Clause license. Added `.onnx` files to the service-worker asset precache so installation includes the model.
- Documented that generative enhancement can invent texture and requires review. Updated the feature matrix and decision log with source, design choice, and validation limits.
- Verification: `npm.cmd run typecheck` passed; `npm.cmd run build` passed and verified 27 prerendered routes. The generated worker precaches both model files (105 assets total). WebGPU/CPU inference, visual quality, alpha edges, memory ceiling, and offline browser interaction remain to validate.

## 2026-11-15 — Video Replace Audio multitrack mix

- Reworked Replace Audio into a source-video audio controller plus multiple added audio lanes. The source video audio is extracted locally to a 48 kHz waveform; added lanes show waveforms, have typed offset and dB controls, can be enabled/removed, and can be moved by dragging them on the timeline.
- Corrected export so enabled lanes are actually rendered together into one AAC audio track instead of being muxed as separate selectable tracks. A light compressor reduces clipping; AAC encoder capability is checked before work. Export result replaces the source video in the custom preview. Processing UI communicates the mix render stages.
- Added memory limits: eight added tracks, 128 MiB aggregate added audio, eight-minute source duration, and 192 MiB PCM output buffer. Documented the current constraints and Mediabunny API sources in the feature matrix and decision log.
- Verification: `npm.cmd run typecheck` passed. `npm.cmd run build` passed and verified 27 prerendered routes with 106 service-worker assets. Listening, real-world source combinations, output file playback, AAC capability failures, and memory use remain pending browser validation.

## 2026-11-15 — Video Trim result preview

- After exporting a trim, Video Trim now switches its preview panel to the actual trimmed file and offers an Edit selection action to return to the source timeline. Changing either range endpoint clears the old output preview so it cannot be mistaken for the current selection.
- Fixed the source/result object URL cleanup effects so replacing a result does not revoke the still-loaded source video URL.
- Verification: `npm.cmd run typecheck` and `git diff --check` passed. Production build and playback review are pending.

## 2026-11-15 — Refresh image design and offline research notes

- Checked the current iLoveIMG and BeFunky public tool catalogs. Updated the image UX research notes to reflect task-grouped image utilities and distinct, canvas-centered photo-editing and collage workspaces.
- Corrected stale product documentation: the public site remains dark, Ubuntu/Inter are local fonts, the upscaler's pinned ONNX models are already bundled and precached, and Vocal Reducer is stereo center cancellation rather than downloaded AI stem separation.
- Updated the current route and offline PWA notes to distinguish the multitrack video merger path from a standalone video-merge tool.
- Verification: documentation source links were checked against the current public pages. Code changes were validated in the earlier typecheck/build; these documentation edits do not change the bundle.

## 2026-11-15 — Collage canvas direct manipulation

- Added click-to-select and drag-to-reposition behavior on the collage canvas so users can arrange each photo directly within its cell. A separate non-exported canvas draws the selected-cell outline, while numeric position controls remain available for exact placement.
- Added a decoded `ImageBitmap` cache keyed by each local image asset so dragging and changing cell settings redraws from cached pixels rather than repeatedly decoding all source files.
- Updated the feature matrix and image design notes to describe the canvas-centered collage interaction inspired by BeFunky's customizable layouts.
- Verification: `npm.cmd run typecheck` and `git diff --check` passed. Production build, save/reopen, and drag interaction are pending.

## 2026-11-15 — Replace Audio decoded-memory guard

- Tightened the Replace Audio export limits to four-minute videos and added an eight-minute combined decoded-audio budget across source audio and enabled lanes. Tracks must report their duration before export; over-budget exports are blocked with an actionable message instead of being decoded until the tab runs out of memory.
- Updated the current feature matrix and implementation decision note with the actual memory limits.
- Verification: `npm.cmd run typecheck` passed; `git diff --check` passed; `npm.cmd run build` passed and verified 27 prerendered routes with 106 cached assets. Runtime memory measurements remain pending browser validation.

## 2026-11-15 — Session handoff for unresolved user requests

- Updated `SESSION_HANDOFF.md` with the current `main` checkpoint and a clear statement that the redesign/functionality work is not fully verified or complete.
- Added the user's remaining problem list: browser visual review; CapCut-like studio polish; listening checks for volume/noise reduction; edited-result preview audit; real-file video trim/extract/speed/mute/mix checks; Replace Audio memory/codec limits; image design/upscaler/collage review; custom-input/drag audit; and processing progress/error behavior.
- Recorded that typecheck/build passed, while this session did not run the test suite or manually verify browser media behavior. Left the two status-only projects/storage route entries untouched.

## 2026-11-16 — Browser audit of handover issues

- Ran item-by-item browser checks across homepage/mobile layout, audio trim/split/merge/gain/noise reduction, video trim/speed/mute/extract/replace and multitrack export, image resize/upscale/collage, and project reload. Audio Trim waveform movement now updates immediately; keep/remove WAVs were 3.000/1.000 s. Added a persistent canvas in Image Upscale after discovering inference returned early when the canvas was not mounted. Fixed `CustomMediaPreview` metadata reset/synchronization after Video Speed preview retained a zero duration; retest showed 2.07 s and live playback.
- Fixture checks: gain measured +6 dB; noise-only RMS fell −35.23→−63.36 dB while tone region changed −15.01→−16.08 dB. Trim, mute, replacement mix, multitrack H.264/AAC, resize, upscale, and collage outputs were probed/decoded with FFmpeg. Image resize preserved RGBA; CPU upscale produced 800×680 with transparent pixels; collage PNG save/reload restored ordering and cell edits.
- Remaining observed gaps: Audio Extract incorrectly rejects AAC MP4 and Opus WebM containing audio streams. Collage SVG import fails late with generic decode feedback. Audio Split created a ZIP link, but the browser harness did not observe a download event; archive integrity remains unverified. A 72 px title was clipped in the 320 px-wide test export. Offline export, external player review, listening, cancellation/recovery, quota handling, full accessibility/browser coverage remain open.
- Verification ran in an isolated audit copy because Windows blocked removal of locked root native modules. `npm.cmd run test:core` passed 18/18, `npm.cmd run typecheck` passed, and production build passed (27 route pages, 106 precache assets). The pre-existing root `package-lock.json` edit was preserved.

## 2026-11-16 — Sync with follow-up session commits

- Read the updated handoff, work log, current branch/status, and commits after the prior checkpoint. `main` was at `907e0a8`, matching `origin/main`, with a clean worktree at inspection time.
- Confirmed the follow-up changes: cached Audio Trim waveform peaks and debounced preview rebuilds to reduce drag lag; corrected edge-drag bounds; synchronized custom-player metadata on source changes; kept the upscale canvas mounted before inference; and changed video extraction to include all tracks while discarding video.
- The handoff records targeted Chrome fixture results and remaining gaps. Audio Extract still needs browser retest on AAC MP4 and Opus WebM; Audio Split ZIP integrity/download, collage SVG messaging, small-output title fitting, offline operation, and recovery/accessibility checks remain open.
- Corrected the handoff's stale latest-commit line. No application code was modified during this sync.
## 2026-11-16 — Dedicated image downscale tool

- Added `/tools/image/downscale` as a focused entry point over the existing local canvas resampling/export pipeline. It initializes to half the source dimensions, preserves the original aspect ratio by default, and requires output dimensions to stay within the source with at least one dimension reduced.
- Added Downscale Image to the image workspace catalog and image tool dropdown; updated the workspace count and corrected the Upscale catalog description to identify its AI processing.
- Verification: `tsc --noEmit` passed. `npm run typecheck` could not start because the installed Rolldown package is missing its optional native binding. Git status/diff/add commands are currently failing with “this operation must be run in a work tree,” so no commit was created.

## 2026-11-16 — Resize crop controls moved into sidebar

- Restored the Resize tool's single output preview canvas and removed the in-flow crop workspace/tabs that displaced the preview and controls.
- Added a dedicated Crop Image sidebar section with an on/off toggle. When enabled, it exposes crop aspect, custom ratio, crop dimensions, Crop Selection, apply, close, and reset controls.
- Crop selection now overlays the existing preview canvas only after Crop Selection is clicked; the overlay is absolutely positioned within the preview stage so it does not add layout height or shift neighboring content.
- Verification: `tsc --noEmit` passed. Browser visual validation was not available in this turn.

## 2026-11-16 — Crop tool spacing locks and aspect controls

- Replaced the plain Left/Top coordinate fields with horizontal and vertical inset controls. Optional spacing locks keep the crop margins equal on both sides as the inset changes and when the corresponding crop edge is dragged.
- Added one-time Center horizontally and Center vertically buttons.
- Added an aspect-ratio selector with original, common presets, free selection, and custom ratio. Crop width/height inputs and edge resizing respect the chosen ratio.
- Verification: `tsc --noEmit` passed. Browser interaction checks were not available in this turn.

## 2026-11-16 — Tool title placement in loaded image editors

- Hid the large title/description intro whenever Resize, Downscale, or Crop has an image loaded; upload screens continue to show the full introduction.
- Added compact tool-name headings at the top of each loaded editor sidebar. Resize, Downscale, Image Editor, and Crop Image get context-specific labels.
- Verification: `tsc --noEmit` passed. Browser visual validation was not available in this turn.

## 2026-11-16 — Downscale before/after comparison

- Added a before/after comparison slider to the Downscale preview, matching the Upscale comparison interaction and visual treatment.
- The divider reveals the original source on one side and the actual resampled output on the other. Labels identify each side, and the range control is keyboard accessible.
- Verification: `tsc --noEmit` passed. Browser visual validation was not available in this turn.

## 2026-11-16 — Blank collage editor entry

- Added a collage-only “Open blank collage editor” action on the collage upload screen. It opens the editor without requiring a source image.
- The blank editor draws the selected canvas layout with interactive Add photo cells. Once opened or used with images, it stays in the editor if all photos are removed.
- The existing file picker remains available in the sidebar, and the blank editor cannot be exported or saved until images are added.
- Verification: `tsc --noEmit` passed. Browser visual validation was not available in this turn.

## 2026-11-16 — Collage studio behavior and layout fixes

- Made Add Images available regardless of the active collage sidebar panel. Corrected the preview frame sizing so canvas pixels, empty-cell buttons, hit-testing, and drag/drop cells share the same aspect-ratio frame; empty layouts now open as a 3×3 grid.
- Added click/right-click cell context actions (Edit Image, Remove Image, Replace Image, Delete Cell), file drops onto any cell, and drag/drop of Image Manager assets to fill or swap cells. Remove Image leaves its cell empty; Delete Cell removes the slot and shifts later cells up. Removed the preview's floating cross control.
- Added a dedicated Cell Edit sidebar tab, moved per-image controls out of Customize, removed Columns from Customize, and added a Custom layout with row/column inputs.
- Set Crop to Fill as the default and constrained cover-mode image scale/position so a photo cannot be dragged out of its cell and reveal gaps.
- Added a draggable Spacing range control and per-cell Corner Rounding, included in the rendered/exported canvas and empty-cell preview. Changed layout thumbnails to white cells with colored outlines.
- Persisted custom rows, corner radius, and deleted-cell count in local collage projects.
- Verification: `tsc --noEmit` passed. Browser interaction/visual checks were not available in this turn.

## 2026-11-16 — Resize crop controls and sidebar expansion

- Fixed the loaded Resize sidebar's flex shrinking: expandable control groups and the crop section retain their full content height and scroll within the sidebar, so opening Transform & Export no longer collapses it.
- Restored comfortable crop-control padding and moved the Crop Selection action directly after the crop dimensions so it remains visible without scrolling. The action activates the crop overlay over the existing preview; selecting a preset also updates the crop rectangle and displays the interactive selection.
- Verification: `tsc --noEmit` passed. Browser visual validation was not available in this turn.

## 2026-11-16 — Separate crop spacing and centering controls

- Split the Crop tool sidebar into distinct Lock Spacing and Center Crop groups. Horizontal/vertical inset fields now sit directly under their corresponding toggle switches.
- Styled centering actions as bordered, rounded buttons with directional SVG icons, padding, hover/pressed feedback, and visible keyboard focus.
- Verification: `tsc --noEmit` passed. Browser visual validation was not available in this turn.

## 2026-11-16 — Inline crop inset values

- Kept each horizontal/vertical inset label on the same row as its numeric pixel input and `px` unit.
- Verification: `tsc --noEmit` passed.

## 2026-11-16 — Crop Selection placement and preview sizing

- Moved Crop Selection immediately below the Crop Image toggle, ahead of aspect and dimension controls.
- Sized the absolute crop overlay to the rendered output aspect and preview bounds so enabling selection does not enlarge or reflow the image preview.
- Verification: `tsc --noEmit` passed. Browser visual validation was not available in this turn.


## 2026-11-16 — Resize crop selector immediate activation

- The Crop Image toggle now immediately displays the Resize tool's own selector over the existing preview; removed the extra Crop Selection activation button from the expanded controls.
- The overlay now exactly fills the preview stage and only draws the selection outline, handles, and dimming outside it. It no longer adds a second image or changes the preview image's appearance or layout.
- Separated the draft crop rectangle from the applied crop. Dragging the selector no longer redraws the full-resolution output canvas on every pointer movement; the canvas updates only when the crop is applied.
- Verification: TypeScript check run; browser visual validation not available in this turn.

# 2026-11-17 — Fix Video Studio scrolled timeline coordinates

- Fixed timeline seeking and clip drops to include the parent timeline viewport's horizontal scroll offset. The old handlers read `scrollLeft` from the inner ruler/lane, which stays at zero while the timeline itself scrolls.
- Shifted ruler time marks and its click mapping by the sticky track-label gutter so second marks align with clip time zero and the playhead.
- Clip drops now preserve where the user grabbed the clip instead of jumping its left edge to the pointer.
- Added pure regression tests for scrolled coordinates, ruler alignment, grab-offset positioning, and invalid scales. Verification: core suite passed 22/22; direct `tsc --noEmit --pretty false` and `git diff --check` passed. The running browser initially rendered Video Studio's empty state, then a hot reload produced a React Router `useContext` runtime error that persisted after hard reload; populated timeline interactions could not be verified until the dev server is recovered.

# 2026-11-17 — Rebuild Video Studio workspace around the desktop editor reference

- Replaced the tall Video Studio introduction with a compact local-project bar and prominent export action. Direct entry can create a local video project.
- Reworked the left pane into Media, Text, and Transitions tabs with actual available actions, a local import control, and media thumbnails. Added project details when no clip is selected, Basic/Speed/Adjust inspector tabs for selected clips, and source imagery on visual timeline clips.
- Moved export settings and rendered-file preview into a dialog so the player and six-track timeline can use the full workspace height. Added direct split and delete controls to the timeline toolbar and tightened the dark editor layout.
- Verification: direct `tsc --noEmit` and 22/22 Core tests passed. Full build and browser review remain blocked by the checkout's missing Windows Rolldown binding; this is not a visual or export gate pass.

# 2026-11-17 — Fix blank Video Studio import and player seeking

- Enabled Import media before a project exists. A successful import now creates a local video project, saves its assets and clips, and opens the saved project. The picker resets after selection so the same file can be imported again.
- Disabled empty-timeline playback, including when the final clip is removed. Added current/total timecode, frame-step buttons, centered play/pause, and fullscreen below the preview.
- Made the ruler a draggable and keyboard-operable seek control. Corrected seek and drop coordinates to use the scroll viewport's left edge, including its scroll offset and sticky track-label gutter.
- Verification: direct TypeScript compilation and all 22 Core tests passed. Browser import, ruler drag, fullscreen, and offline project reload remain unverified because the Windows build binding is missing in this checkout.

# 2026-11-17 — Correct bin placement, canvas fit, playhead drag, and timeline zoom

- Import saves local assets into the media bin without making timeline clips. Each bin item can be clicked to add a clip or dragged to a compatible track; the first placed visual source sets the Original canvas aspect ratio.
- Added Original, common ratio presets, and custom typed canvas dimensions beside the player. Recorded source dimensions from media inspection and made the displayed output canvas fit fully within the player. The renderer no longer resets its canvas backing size on every frame.
- Added relative grab-drag movement to the playhead handle. Ctrl+wheel over the timeline changes its pixels-per-second scale while keeping the time under the pointer stable.
- Verification: direct TypeScript compilation and 24/24 Core tests pass, including new ratio and zoom checks. Build/browser gates remain pending because this Windows checkout lacks the required Rolldown native binding.

# 2026-11-17 — Embedded video sound and production retest

- Restored embedded video audio in preview using each clip's volume, mute, speed, pitch mode, and fade settings. The export mixer now includes video source audio. Detach and replacement mute the original clip audio to avoid doubling it.
- Repaired the local Windows native build packages and completed the production build and static route/service-worker verification. In a fresh local production preview, a fixture imported into the bin without auto-placement, stayed unplayable until placed, then played with its video element unmuted. A 320×180 MP4 render completed with an AAC audio track; FFmpeg measured −21.1 dB mean and −16.7 dB peak. Listening quality still needs direct review.
- A portrait-ratio screenshot revealed that the canvas box overflowed the player. Constrained it to the player and added paused seek redraw triggers; the follow-up screenshot showed a visible portrait source frame and frame stepping advanced by 0.033333 s. Native fullscreen was denied by the in-app browser, so a full-window in-page fallback now opens when that API fails.

# 2026-11-17 — Magnetic timeline placement

- Fixed edge snapping for moved clips and media-bin drops. Hovering over a clip inserts before or after it, shifts later same-track clips to make room, and shows a placement ghost. Replaced unreliable native bin drag with pointer-based placement. These edits remain undoable and persist in the local project.
- Browser check with a 4 s fixture confirmed edge snapping, insertion that shifted the next clip, undo, and two-clip restoration after reload. TypeScript, 26 Core tests, and the production build passed. Offline and cross-browser release checks remain open.

# 2026-11-17 — Selected video controls and waveforms

- Added selected-video sliders for scale, rotation, audio volume, and speed with values shown to at most three decimals. Added canvas alignment, X/Y mirror, silence, extract/replace audio, split, and duplicate controls. Mirror flags persist in the clip transform and are applied in the composite renderer.
- Audio and video clips with audio streams now show locally decoded peak waveforms; embedded video audio does not need extraction first. Sampling scales to up to 16 buckets per source second (capped at 8,192), then reduces to about one bar per 2.5 timeline pixels. Each source's peaks are normalized to its own peak, video uses a compact strip, and trimmed clips display the corresponding source range. Removed the repeated-bar background and fabricated fallback so silent or unsupported streams do not pretend to have a waveform. Added thin custom scrollbar styling for the inspector.
- Verification: `npm.cmd run typecheck` and `git diff --check` passed. Browser interaction, output parity, and offline behavior for these new controls still need validation.

# 2026-11-17 — Inspector grouping and clip amplification

- Put Track/Timeline start and Source in/Source out into paired rows below volume. Audio and video clips can now use 0–4× gain. Preview applies gain through local Web Audio nodes; export applies the same gain once before project peak protection.
- Verification: typecheck and the static production build passed (28 routes, 106 cached assets). Browser loudness and export measurements remain unverified.

# 2026-11-17 — Timeline split defaults and clip edge actions

- Empty lane/ruler clicks clear selection. Split now falls back to the Video 1 clip under the playhead when nothing is selected. Added toolbar icon actions with tooltips to keep the hovered clip's left or right portion at the playhead.
- Fixed checkbox sizing so Ripple/Snap labels sit close to their controls instead of inheriting the numeric input width.
- Verification: typecheck and `git diff --check` passed. Browser interaction review remains outstanding.

- Replaced the ambiguous Delete Left/Right arrows with mirrored clip/playhead icons that mark the removed side with an X.
- Fixed Delete Left/Right target priority to use the hovered clip's stable ID before an older selection, preventing actions from trimming the previous clip. Delete Left now shifts the kept source range back to the clip's original start and enabled primary-track ripple moves following clips left to close the time gap. Delete Right keeps the clip start while shortening its end.
- Kept both actions enabled at all times and added predictable target fallback plus clear handling when the playhead is outside a clip. Typecheck passes.
- Fixed target priority after a reported split case: selection now beats stale hover state, and splitting assigns the new right segment as both selected and hovered. Clips are addressed by project IDs, never by names.


# 2026-11-17 — Timeline toolbar grouping

- Added thin vertical separator lines between side-delete tools, undo/redo, split/delete, ripple/snap, and timeline setting groups.

# 2026-11-17 — Local media library

- Added Library with Image, Video, and Sound effects subtabs separate from imported project assets. Library catalog sections stay empty until catalog content is available. The Image section uses a compact black tile with a top-right color-picker icon; clicking the tile saves a local SVG image asset and creates a five-second Video 1 clip.
- Typecheck and static production build pass; the Library panel was visually reviewed.

# 2026-11-17 — Interactive preview titles

- Added direct title selection, move, resize, and rotation in the video preview. Gestures edit the persisted clip transform and produce one undo entry on release. The overlay aligns to the contained preview canvas and is excluded from the rendered export.
