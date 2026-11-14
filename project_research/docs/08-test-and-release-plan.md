# Test and release plan

## Test tools and fixtures

Use Vitest for pure timing, validation, migration, and image-size calculations; Playwright for routes, controls, projects, and offline flows; and media probes/manual review for actual rendered files. Keep small, redistributable fixtures: mono/stereo audio with spoken and musical sections; MP4 and WebM videos with spoken audio, visible frame numbers, and known sync markers; images with exact dimensions, checkerboard edges, transparency, and collage subjects. Record each fixture's license and expected metadata. Never use user media in the repo or CI.

## Functional scenarios

| Area | Required checks |
|---|---|
| Numeric controls | Typed decimals and arbitrary values propagate to preview/project/export. Test 3.7×, 5×, 6×; min/max; empty, invalid, negative, and non-finite input; keyboard entry. |
| Audio | Split at exact time, trim ends, merge with changed sample rates, fades, normalization, basic denoise, custom speed duration, both pitch modes, external WAV playback. |
| Video | Drag/reorder tracks, split/trim, ripple, overlay, title, transition, keyframes, detach/replace audio, speed changes, frame/audio sync at boundaries, external MP4/WebM playback. |
| Image | Exact `400×340 → 300×300` stretch; aspect-lock calculation; crop as separate operation; collage reopen; PNG/JPEG dimensions and color/alpha behavior. |
| AI | Checksum/download recovery, offline rerun, cancellation, vocal/instrumental outputs, speech cleanup preview, upscale tile seams and requested final dimensions. |
| Projects | Autosave, refresh, reopen, duplicate/delete, migration, interrupted export, missing OPFS asset, quota exhaustion, and storage clearing explanation. |

## SEO, routing, and PWA scenarios

- Fetch each public route's raw HTML and assert useful page content, unique title/description, canonical URL, and navigation links before JavaScript runs.
- Check sitemap contains only canonical public URLs. Studio/project/settings URLs are `noindex`. Unknown paths yield 404.
- Directly load and refresh `/studio/video/?project=<id>` on the production static host; the same saved project opens after hydration.
- Install the PWA on HTTPS, wait for core offline readiness, disconnect, fully close, reopen at home and a studio URL, edit, and export. Repeat after an app update.
- Download one AI model, disconnect, fully close, reopen, and run it. Interrupt a second download and confirm it is not marked offline-ready.
- Playwright's service-worker inspection is Chromium-only; supplement with manual Firefox/Safari checks rather than assuming the same automation coverage.

## Format and device matrix

Maintain a table for each tested combination: browser/OS, container, video codec, audio codec, import, preview, export, max measured dimensions/duration, and known issue. At minimum test current desktop Chrome, Edge, Firefox, and Safari where available, plus representative Android and iOS devices for UI and claimed tools. A feature is shown as available only if its full path passes. Record actual `isConfigSupported` probes and sample output, not extension guesses.

## Performance and correctness budgets

M0 establishes a reference desktop, sample media, peak memory, export time, and a conservative file-size/duration recommendation. M6 remeasures the complete renderer. Keep the UI responsive during a running job, avoid whole-video in-memory copies, and warn before exceeding published guidance. Output dimensions, duration, channel count, frame rate, and A/V sync are inspected programmatically; a human reviews representative audio/video/image quality. Do not set blanket 4K or unlimited-duration claims without measured evidence.

## Release gates

1. Typecheck, lint, build, and relevant Vitest/Playwright suites pass.
2. Every advertised tool passes import → preview → edit → save/reopen → export → offline on its declared browsers.
3. Every export opens in an external player/viewer; preview/export timing and settings match.
4. Public page SEO and direct-route tests pass on deployed static hosting.
5. No project is lost on ordinary refresh, cancellation, quota failure, or app update; unrecoverable site-data clearing is clearly disclosed.
6. Dependency/model notices, provenance, checksums, and distribution terms are recorded.

Core may ship when M6 and the corresponding gates pass. AI tools ship when M7 passes separately. A failing optional feature remains hidden or marked unavailable rather than blocking a working core release.
