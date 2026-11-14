# Implementation roadmap

Follow these milestones in order. Each is a reviewable work order. A later milestone may start only after the previous one's gate is met, except independent public-page copy and fixture preparation. Record benchmark results and any altered decisions in `10-decisions-and-sources.md`.

## M0 — Feasibility and constraints

**Work:** Initialize Git in this currently unversioned workspace; scaffold React Router Framework Mode with static output and minimal routes. Build vertical prototypes for (a) a two-video/two-audio-track export with title, dissolve, and keyframe; (b) custom 3.7× and 6× audio/video speed with pitch-preserved audio; (c) 400×340 to 300×300 exact stretch; (d) tiled local Real-ESRGAN candidate inference. Probe codec combinations on Chrome/Edge and test direct-route static deployment. Benchmark with a declared reference desktop and fixtures of known size.

**Output:** Executable prototypes, a measured browser/format matrix, model provenance/license notes, peak memory and time figures, and initial file/project guidance. **Not in M0:** Finished UI, a general-purpose media library, or unmeasured performance promises.

**Gate:** All four paths produce valid external output; failures are recorded with a concrete fallback or removed browser claim. If pitched time stretch or the selected AI model fails, replace the candidate processor and repeat this gate before feature implementation.

## M1 — Repository, routes, and design foundation

**Work:** Establish pnpm workspace, package boundaries, TypeScript strict mode, lint/format checks, route catalog, pre-render config, public pages, studio shells, accessible shared UI primitives, responsive layout, manifest, icons, and static 404. Generate sitemap and robots rules from the route catalog.

**Output:** Home, category, tool overview, and editor shell pages. **Not in M1:** Media processing beyond the M0 prototypes.

**Gate:** Production static build serves direct URLs and refreshes correctly; public HTML contains content/metadata without JavaScript; studio pages are `noindex`.

## M2 — Projects, offline app, and jobs

**Work:** Implement versioned project store, OPFS assets, IndexedDB records, autosave, undo/redo, duplicate/delete, storage estimate/persist, worker job protocol, progress/cancel/error cleanup, Workbox service worker, update handling, and optional-asset download manager.

**Output:** A project can be created, saved, reopened, edited as test data, and removed offline. **Not in M2:** Finished editing tools.

**Gate:** Offline reload and direct studio navigation work; quota and missing-asset tests preserve project integrity; interrupted downloads do not mark an asset ready.

## M3 — Shared import, preview, controls, and export

**Work:** Add drag/drop and picker import, metadata/codec inspection, format capability service, shared custom numeric controls, media preview shell, and export job UI. Integrate Mediabunny/WebCodecs for supported paths and create a fixture-based format matrix.

**Output:** Import and simple pass-through or no-op export for representative media. **Not in M3:** User-facing effect catalog.

**Gate:** Unsupported formats are detected before processing; every exported fixture opens outside the app; cancellation cleans temporary data.

## M4 — Core image tools

**Work:** Build image editor, non-destructive edits, text/shapes/layers, exact pixel resize, collage document/templates, PNG/JPEG export, and editable project reopen.

**Gate:** `400×340 → 300×300` produces 300×300 without crop/pad; Match aspect ratio recalculates dimensions; collage layers remain editable after reload; offline export passes.

## M5 — Core audio tools

**Work:** Implement waveform, trim/split/merge, gain/fades, normalization, basic noise reduction, 0.1×–16× custom speed, pitch-mode toggle, WAV export, and audio project persistence.

**Gate:** Custom 3.7×/5×/6× values survive project save and match preview/export duration; pitch modes are audibly distinct; boundaries and merge order pass fixture checks.

## M6 — Basic CapCut-like video editor

**Work:** Build media bin, multitrack timeline, clip editing, overlays/text/audio, transitions, filters, transform/volume keyframes, custom speed, audio detach/replace/mix, preview, and MP4/WebM export. Add focused quick-tool entry points. Use the shared project clock and render evaluation functions.

**Gate:** Representative projects with two video tracks and two audio tracks render correctly; audio remains synced across joins, transitions, and speed changes; preview and export agree; project reload preserves edits; offline export passes.

## M7 — Downloaded AI tools

**Work:** Add vocal/instrumental separation, stronger speech cleanup, and tiled image upscaling with versioned downloads, checksums, capability messages, cancellation, and before/after previews. Keep AI modules out of core route bundles.

**Gate:** After one download, each declared tool operates offline and exports usable results; output quality and resource use meet the measured limits; license/provenance checks are recorded.

## M8 — Hardening and release

**Work:** Complete browser/format matrix, accessibility pass, SEO checks, storage recovery, performance budgets from M0/M6 measurements, production CSP/headers, documentation, and release build. Verify install/update/offline behavior on deployed Cloudflare Pages.

**Gate:** All checks in `08-test-and-release-plan.md` pass for advertised features. Release Core before AI if M7 is not ready; do not advertise AI tools as available until their gate passes.

## Work-order practice

For each milestone, the implementing agent should open a small set of tasks, state the target behavior and fixtures, implement the narrowest complete vertical path, run its gate, update the docs/format matrix, and only then expand. Do not defer export or offline verification until the end: an editor control is incomplete until the file it produces has been checked.
