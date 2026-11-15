# Session handoff — Local Studio Core

**Checkpoint date:** 2026-11-16 (Asia/Dhaka)
**Goal status:** Resumed by the user on 2026-11-15. Continue the same Core objective.
**Repository:** `E:\Coding_Practice\Live Projects\openproducer-editor`
**Branch/commit:** `main`, latest `82f2d2c` (`fix: guard replace audio mix memory`).

## Latest session handoff — 2026-11-16

### Audit update — 2026-11-16

The user requested item-by-item testing of the open issues below and reported Audio Trim waveform selection lag. The Audio Trim route now caches a 4,096-bucket waveform envelope per decoded file, delays edited-WAV preview regeneration until 180 ms after pointer activity settles, and clamps edge drags against the captured gesture boundary. Browser dragging moved the selected range immediately (under 0.4 s for the interaction round trip); keep/remove exports were 3.000 s and 1.000 s as expected.

Audit evidence/status (Chrome in the in-app browser, local production build):

- **Build/typecheck/tests:** root `node_modules` could not be repaired because Windows held native module files. A clean audit copy at `C:\Users\User\.codex\visualizations\2026\11\15\01a1e04b-95f2-7511-8363-5c276fa4f669\local-studio-audit` was installed instead. Core tests passed 18/18, typecheck passed, and the final production build passed after the extractor change (27 prerendered routes, 22 public indexable; service worker generated with 106 cached assets). Repository `git diff --check` passed.
- **1. Visual redesign/responsive layout:** homepage categories and mobile stacking were reviewed; no horizontal overflow was visible at 390×844. A full route-by-route visual/accessibility review remains open.
- **2. Video Studio:** multitrack fixture project rendered H.264/AAC at 320×180, 12 fps, 13.08 s; FFmpeg decoded it. Project reload restored six assets and edits. The export contact sheet showed a 72 px test title clipped at the deliberately small 320 px output; title fitting needs review.
- **3. Audio output:** +6 dB export measured exactly +6 dB on the fixture. Noise reduction reduced noise-only RMS from −35.23 to −63.36 dB and retained tone-region RMS within 1.08 dB. Listening/subjective quality and cancellation remain open.
- **4. Result previews:** trim, speed, volume, merge, mute, and replacement mix were exercised. WAV/MP4 outputs were probed and decoded. Video Speed initially showed stale zero duration; `CustomMediaPreview` now resets and listens for metadata changes, and retest showed 2.07 s duration and live playback time. Audio Extract failed on AAC MP4 and Opus WebM fixtures despite confirmed audio streams; its selector was changed from `tracks: "primary"` to `tracks: "all"` while discarding video. This change typechecks/builds but still needs browser retest.
- **5. Video operations:** trim output was 3.02 s H.264/AAC and decoded; mute output contained video only and decoded; replacement mix produced H.264 plus AAC stereo and decoded. Offline export, VLC/external player, broader sync, and browser matrix remain open.
- **6. Replace Audio limits:** two replacement tracks at different rates and offsets mixed successfully; published memory/time bounds have not been stress-tested.
- **7. Images:** exact 400×340→300×300 transparent PNG stretch and 300×255 ratio-lock behavior passed. Upscaler CPU/WASM produced 800×680 output and retained transparent pixels. Collage PNG save/reload/order/cell settings passed with PNG inputs; SVG import failed later at decode with a generic error and should be rejected earlier with a useful message. Image quality, offline inference, memory, and external viewer review remain open.
- **8. Numeric inputs and drag:** audio trim live drag, video trim/playhead, exact image dimensions, ratio lock, mix gain/offset, and timeline size/frame-rate inputs were exercised. Broader accessibility and all-tool typed-value coverage remain open.
- **9. Progress/recovery:** visible progress and successful completion were observed on upscale and video processing; cancellation, worker recovery, cleanup, quota, and storage failures remain untested. Audio Split computed two 2 s segments and generated a ZIP link, but the browser harness did not observe a download event; output ZIP integrity remains unverified.

Changes also fix a missing mounted canvas in Image Upscale and stale metadata in custom media previews. The Audio Extract track-selection fix has not yet been browser-verified. The existing root `package-lock.json` change was preserved. The repo is not release-ready: offline operation, external-player review, broader browser coverage, extractor retest, ZIP verification, cancellation/recovery, and several project/storage gates remain open.

**This section is the current status and supersedes older implementation-status claims below. The project is not finished: several problems from the user's design/functionality list still need real-browser review and may need additional fixes.**

Recent feature commits on `main` include `e546e41` (Replace Audio multitrack mix), `1e56456` (Video Trim result preview), `9ff55da` (interactive collage cells and image reference research), and `82f2d2c` (Replace Audio memory guard). Earlier in this session, separate commits also updated the homepage hierarchy, navigation, audio trim/preview, compact editor layouts, drag ordering, video output previews, and the offline upscaler. `WORK_LOG.md` records the changes.

### Implemented, awaiting user-facing review

- Homepage category cards are at the top, with supporting content below. Audio, Video, and Image have their own tool lists; Video Studio is a separate Creative Studio entry. Dark surfaces and local Ubuntu/Inter fonts are applied.
- Tool pages use clickable breadcrumbs and category menus. Media tools generally ask for a source before opening their editor. Simple audio/video layouts are compact and centered after import.
- Audio Trim has Keep only/Remove only modes. Audio time displays use three decimals; range controls and custom app transports are present. Volume/Fades creates an edited preview as settings change; Merge supports drag ordering and refreshes its preview.
- Video Trim synchronizes the selection timeline and playhead, then switches to the exported clip preview. Extract Audio shows the extracted waveform/player. Speed and Remove Audio show their generated result previews. Replace Audio has source and added-track waveforms, draggable offsets, per-track levels, and a single mixed AAC output.
- Noise Reduction uses worker-based spectral profile reduction from a selected noise sample. It remains a basic steady-noise reducer; it has not been accepted by the user as solving the “useless noise remover” complaint.
- Image Resize supports draggable edit layers. Image Upscale uses bundled Real-ESRGAN ONNX assets. Collage supports row ordering and direct canvas dragging to reposition each cell image; the canvas selection outline is kept out of export. iLoveIMG/BeFunky references are recorded in `project_research/docs/10-decisions-and-sources.md`.
- Animated processing feedback is present on the processing flows updated so far.

### Open problems and next-session checks from the user's list

1. **Do not mark the redesign done based only on a successful build.** The current session did not visually inspect the running app in Chrome. Review the homepage, tool lists, breadcrumbs/menus, simple editor spacing, timeline synchronization, and mobile layouts. Fix any remaining cheap-looking, oversized, empty, or misaligned areas.
2. **Video Studio / CapCut-like editor:** inspect `/studio/video` directly and continue polishing the multitrack layout for a clean, dense editing workspace. It was moved out of Video Tools, but this session did not perform a new design review of it.
3. **Audio quality and previews:** listen to the actual Volume/Fades output and verify positive gain works. Listen to Noise Reduction on representative noisy speech/music; compare it to the user's expectation and improve or clearly constrain the claim if it still sounds ineffective. Check that adjusted results appear in the custom preview after changes.
4. **Audio/video result preview rule:** walk through each changed tool (trim, speed, volume, merge, crop/extract, mute/remove, replace). Confirm the preview shows the edited output after processing and is not left on a stale original. The implementation was not manually exercised with representative user files this session.
5. **Video operations:** test extraction and its waveform, muted-video export, custom video speed, trim/range/playhead sync, and Replace Audio mixing with real local MP4/WebM files. Confirm output plays with sound in the app and an external player; test multiple simultaneous tracks, timing, gains, and source-audio on/off.
6. **Replace Audio limits:** the current implementation intentionally blocks video longer than 4 minutes, more than 8 added tracks, more than 128 MiB aggregate added audio, or more than 8 minutes combined decoded audio. Decide from actual user needs and device memory whether to keep or redesign these limits. AAC encoding and the mix/export path are typechecked/built but not runtime-verified.
7. **Image tools:** inspect the Image category and editor against the requested iLoveIMG/BeFunky-inspired organization. Verify canvas drag positioning, selection, export, project save/reopen, and collage appearance. Test Real-ESRGAN on WebGPU and CPU, transparency edges, quality, memory, and offline-installed use. If the upscaler still fails or looks poor, investigate an alternate model/inference strategy.
8. **Custom inputs and interaction audit:** audit dynamic settings for typed custom values, and confirm drag/drop works wherever the UI suggests reordering or moving. Retain keyboard-operable alternatives.
9. **Progress feedback:** ensure long processing actually updates progress and can recover from codec/memory errors; check that spinners/animations do not stall or block the page.

### Validation state at handoff

- The latest sequential `npm.cmd run typecheck` and `npm.cmd run build` passed. The static build verified 27 prerendered routes and generated a service worker with 106 cached assets.
- This session did **not** run the test suite or a real-browser interaction/listening review. Typecheck/build success does not establish that the listed tool problems are solved.
- The upscaler runtime adds a sizable offline cache payload. Browser model inference and PWA install/offline use remain to verify.
- Git is on `main`. `git status` still shows `app/routes/projects.tsx` and `app/routes/storage-settings.tsx` as modified, although `git diff` shows no text diff; these were deliberately left untouched. Check them before changing or committing anything.
- Preserve the roadmap order and existing work; do not reset or clean files. Update this handoff and `WORK_LOG.md` when the next session changes status.

## Objective and guardrails

Complete the remaining Local Studio Core scope in roadmap order: finish the M6 multitrack video gate and missing controls; audit and finish Core audio and image workflows; then complete shared foundations and release checks. Do not begin M7 AI until all preceding Core gates pass. Record verified outcomes in the affected specifications, `project_research/docs/10-decisions-and-sources.md`, `project_research/docs/02-feature-matrix.md`, and `WORK_LOG.md`.

Keep all media, projects, inference, previews, and exports on-device. Do not add uploads, accounts, media telemetry, or hidden external processing. Preserve source media and store versioned edit instructions plus local asset references. Preview/export must share the edit model. Every adjustable number accepts typed custom values. Verify actual codec/device capabilities rather than inferring them from extensions. Expensive work belongs in cancellable workers with progress, recovery, and cleanup. Follow the M0–M8 sequence in `project_research/docs/07-implementation-roadmap.md` and the completion gate in `project_research/docs/08-test-and-release-plan.md`.

## Current process and worktree state

- All task-started local preview/development process handles were stopped: sessions for ports 4173, 4174, 4175, 4176, and 4177. Do not expect those listeners to exist. No server was started after the pause.
- The active goal was explicitly marked **paused**. The request to pause processes was not a request to abandon or complete the Core objective.
- No other Codex thread handoff was performed. Codex's `handoff_thread` operation cannot move the calling thread itself; this document is the saved handoff for resuming this thread.
- The worktree was clean at the `50c9a98` resume checkpoint. Do not reset or clean other-session work.
- This sandbox reports the project at `C:\Users\Modasser Hasan\Contents\openproducer-editor`; Git may require a per-command `safe.directory` setting. Do not change global Git config.

## Last verified implementation and evidence

These are targeted results, not proof that Core is release-ready:

- The most recent sequential production build passed and verified 27 pre-rendered routes (22 indexable public routes and 5 noindex private shells). Typecheck passed; `npm.cmd run test:core` passed 16/16 at the last full check. `git diff --check` passed after the pause checkpoint was logged. An earlier concurrent build/typegen race failed with a missing generated route chunk; the subsequent sequential build passed.
- Known build notices: media processing chunk is roughly 643 kB and Bungee WASM dynamic import is reported as ineffective. Keep these visible for M8 bundle/performance work.
- Video Studio has a local bin, six tracks, clip move/reorder by drag/drop, split, duplicate/delete, source/timeline numeric edits, snap, playhead, zoom, undo/redo, text/image overlays, transforms, keyframes, filters, fades/transitions, custom speed/volume/mute, detached audio, and local MP4/WebM export after capability checks. Its preview and export use the shared composition/timing path. Drag trim handles and a default-on, Video-1-only ripple toggle were added after this checkpoint; typecheck/build pass, but the new pointer interactions still need direct runtime verification.
- An in-app local development-browser M6 run imported locally generated H.264/AAC MP4, VP9/Opus WebM, 48 kHz and 44.1 kHz WAV, a sync-marker MP4, and transparent PNG. SVG was rejected as an unsupported container. Two visual lanes, two audio lanes, title/image overlays, dissolve, crossfade, detached audio, and 1.5× natural-pitch audio were exercised. A refresh restored eight asset entries and edits. At timeline 9.5 s, the sync video and detached audio were both at source time 1.0 s.
- That run exposed and fixed a React playhead event-value issue and unity-speed audio transient loss. After the unity-speed fix, a 320×180, 24 fps, 15.168 s H.264/AAC export was fully decoded by FFmpeg and opened in VLC (exit code 0). Narrow-band analysis located 1 kHz pulses at 9.50, 10.50, and 11.50 s, aligned with the clip start and source markers.
- A subsequent production static preview on port 4176 produced `C:\Users\User\Downloads\local-studio-edit (4).mp4`: H.264/AAC, 320×180, 24 fps, 5.013 s; FFmpeg decoded it and VLC exited successfully; pulse analysis found peaks near 1.001, 2.001, and 3.001 s. This older static project showed a hydration error on refresh; the query/project-ready hydration guard was then added and a sequential production build passed.
- A fresh static preview on port 4177 loaded project `3cc8062c-3689-4c21-8ef9-3862ed13f854` at `/studio/video?project=3cc8062c-3689-4c21-8ef9-3862ed13f854`. Its initial load had no observed browser error and the export action created a download link, but that latest output was **not** downloaded or inspected before pause. The post-fix query route was not reloaded after refresh, so hydration on refresh is still unverified.
- The development server on 4175 returned an unmatched-route error for `/sw.js`. That is not offline/PWA evidence. Service worker install, offline navigation, offline project editing/export, and update flow have not passed.
- Earlier core work added local fixture files and metadata under `tests/fixtures/core-media/`, audio timing/normalization and image history modules, storage settings/deletion, user-controlled SW activation, image JPEG export, and studio codec inspection. The feature matrix and specs list boundaries and gaps; read their current content before implementation rather than assuming earlier claims prove the gates.

## Exact resume priority, following roadmap order

### 1. M6 video implementation and gate

1. Directly verify the new trim handles and Video 1 ripple toggle. Check left trim preserves the end, right trim changes source-out, ripple shifts only later Video 1 clips on duration changes, undo is one step per drag, and autosave/reopen preserves the result. The code typechecks/builds but pointer behavior is not manually verified yet.
2. Resolve and verify the pending static-export artifact if it remains available; otherwise rerun the fresh static build preview, export, download, inspect streams/duration/dimensions and sync pulses, and open the file outside the app. The prior handoff artifact was not found in this session's Downloads, and `ffprobe`, FFmpeg, VLC, Playwright, Puppeteer, and the in-app CUA tool were unavailable.
3. Start a production static preview on an unused port. Direct-load **and refresh** a query URL with an existing local project; check hydration, project asset recovery, and state. A dev server alone cannot prove offline behavior.
4. Exercise two visual tracks and two audio tracks, overlays/title, transition, keyframes/filters, speed and pitch modes, detach/replace/mix controls, edit-save-refresh-reopen, and compare preview timing to external output, including boundaries and joins. Ensure unsupported codecs are rejected from parsed capability evidence.
6. Test real service-worker installation and offline operation from the production static build/HTTPS-equivalent environment: install/cache readiness, close/reopen, direct studio navigation, edit/save/export, and update waiting/activation. Record exact environment/browser versions. If the internal browser cannot simulate required install/offline behavior, document that limitation and use an available named browser or a browser automation harness; do not call an unavailable check passed.

### 2. M4 image audit and gate

- Use `tests/fixtures/core-media/image-checker-alpha-400x340.png` to prove the exact resize output is 300×300 with stretch/no crop/no padding by default. Verify aspect-ratio toggle recalculation and custom dimensions.
- Verify PNG and JPEG output dimensions and pixel/alpha behavior in an external image viewer/probe. Inspect transform, filters, shapes/text layers, unified undo/redo, project save/reopen, and source immutability.
- Verify collage source selection, editable cells/order/spacing/background/text/dimensions, project save/reopen/duplicate/delete, output file, and offline path. Record any missing per-cell editing/crop work and implement it if required by the matrix.

### 3. M5 audio audit and gate

- Exercise waveform and exact trim/split/merge order; mixed sample rates/channels; gain/fades/normalize; basic denoise behavior; and WAV output in an external player.
- Verify arbitrary typed 3.7×/5×/6× as well as 0.1× and 16×; preview/export duration and both preserve-pitch and natural-pitch modes. Save/reopen project and repeat offline.
- Current Audio Studio is a one-source editor; current noise reduction is described as a broadband gate rather than the stronger steady-noise reduction promised in Core. Decide/implement an honest complete Core behavior or clearly mark unsupported; update spec/matrix based on evidence. Verify cancellation, progress, and temporary cleanup for worker-backed normalization.

### 4. M2/M3 foundations and M8 release gate

- Verify asset/project migrations, source preservation, autosave/undo/redo, duplicate/delete, missing-asset recovery, OPFS/IndexedDB fallback, quota errors, and storage clearing disclosure.
- Complete shared import/capability behavior for the declared tools; verify worker cancellation/progress/error/cleanup. Test public prerendered HTML/SEO, canonical/sitemap/robots, noindex studio routes, static direct-route/refresh and 404, headers/CSP, PWA install/update/offline, accessibility, and supported format/browser matrix.
- Build representative output files and inspect them externally. Record browser/OS/version, codecs, dimensions, durations, timing/sync measurements, and unsupported behavior in the feature matrix and decision log. Do not advertise paths without full import → preview → edit → save/reopen → export → offline evidence for the named browser.
- Only begin M7 after these Core gates pass. This handoff does not authorize starting AI work early.

## Useful commands and artifacts

From the repository root (PowerShell):

```powershell
npm.cmd run typecheck
npm.cmd run test:core
npm.cmd run build
git -c safe.directory='E:/Coding_Practice/Live Projects/openproducer-editor' diff --check
```

The build command includes service-worker generation and static-output verification. Keep validation sequential to avoid the earlier route-type generation/build race. Fixture provenance is in `tests/fixtures/core-media/README.md`. The feature and work logs are living status records; correct stale statements when stronger evidence is obtained.

## Next-session opening instruction

First inspect this handoff, the current `git status --short`, the roadmap, release plan, feature matrix, and current source/spec versions. Preserve the existing uncommitted work. The immediate next check is to run the latest production build and browser-test `/tools/video/extract-audio` on `tests/fixtures/core-media/av-red-blue.mp4` and `av-green-yellow.webm` after changing track selection to `tracks: "all"`; verify the generated WAV stream, duration, playback, and download. Then verify Audio Split ZIP download and inspect the archive. Continue the remaining roadmap-ordered Core gates; do not treat the audit as release completion. No local preview server is currently expected to be running.
