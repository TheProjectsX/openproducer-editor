# Agent instructions for Local Studio

Read the root `README.md` and the guides under `project_research/` before changing implementation. Follow [the roadmap](project_research/docs/07-implementation-roadmap.md) in order and use [the test and release plan](project_research/docs/08-test-and-release-plan.md) as the completion gate. Keep this `AGENTS.md` at the repository root.

## Non-negotiable behavior

1. Keep media, project files, AI inference, previews, and exports on the device. No media upload, account, runtime API, telemetry containing media, or hidden external processing.
2. Keep public pages pre-rendered and indexable, and editor/project pages excluded from search. A direct refresh of any declared route must work on the static host.
3. Implement core tools for all three media types and the defined multitrack video editor. Do not substitute only standalone trim/merge tools for the timeline.
4. Every adjustable numeric setting must accept a custom typed value; presets may fill the input but must not constrain it to preset values. Audio and video speed is 0.1×–16× with pitch preservation on by default.
5. Pixel resize must support independent exact width and height, stretching without crop or padding by default. Match aspect ratio is an optional toggle. AI upscale is a separate operation.
6. Preserve source media. Save versioned edit instructions and asset references, and make preview and export derive from the same edit model.
7. A feature is complete only after import, preview, project save/reopen, export, and offline operation pass for the browsers advertised for it.

## Working rules

- Verify current package compatibility and pin resolved versions in the lockfile; do not copy a stale example dependency version from these documents.
- Implement capability detection for codecs, WebGPU, storage, and worker features. Never infer codec support from a file extension alone.
- Put expensive processing in workers. Provide cancellation, progress, error recovery, and temporary-file cleanup.
- Add tests for timing calculations, project migrations, export fidelity, route refresh, and offline behavior where failure would lose work or produce wrong media.
- Record measurements, changed choices, and their evidence in `project_research/docs/10-decisions-and-sources.md`. Update affected specifications in the same change.
- Respect third-party code and model redistribution terms before bundling assets. Do not silently add ffmpeg.wasm or an unverified model.

## Definition of a milestone complete

The milestone's listed deliverables and tests pass; representative output files play or open outside the app; no uncaught storage or export failure corrupts a project; and its supported/unsupported behavior is reflected in the feature matrix.
