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
- Commit: pending.

## 2026-11-14 — M0 basic image adjustments

- Extended the local image resize canvas with custom numeric brightness, contrast, and saturation values (0–300%), composited before preview and PNG export.
- Invalid/temporarily empty inputs render with neutral 100% values, and valid values are bounded to the documented range.
- Verification: `npm run typecheck` passed. `npm run build` passed and regenerated the prerendered image route and offline worker; the existing 600.79 kB media-processing chunk warning remains.
- Limitation: browser canvas filters are basic destructive adjustments; there are no layers, masks, nondestructive history, or color-managed professional controls yet.
- Commit: pending.
