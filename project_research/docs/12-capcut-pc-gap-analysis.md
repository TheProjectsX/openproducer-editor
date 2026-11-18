# CapCut PC Feature & Design Gap Analysis — Video Studio (`/studio/video`)

Recorded: 2026-11-18

This document records the baseline comparison between Local Studio's `/studio/video` editor (`app/routes/studio-video.tsx`) and CapCut PC's core desktop editing workflow, ordered into implementation batches.

## 1. Preview & Canvas Manipulation

**Status:** Passed (`npx.cmd tsc --noEmit --pretty false`, `npm.cmd run test:core` 37/37, `git diff --check`)

- [x] **Click-to-select any visible overlay/clip in preview:** Clicking any active `text`, `image`, or `video` clip in `.editor-stage` selects it and opens its inspector controls.
- [x] **Image preview rotation handle & default AR lock:** Added top rotation handle (`data-image-handle="rotate"`) and made `Maintain aspect ratio when resizing` ON by default (toggleable).
- [x] **Video overlay move / resize / rotate in preview:** `.studio-video-overlay` supports direct drag-to-move, corner resize, and top-handle rotation with single-step undo.
- [x] **Preview magnetic snap guides:** Dragging `text`, `image`, or `video` overlays snaps to canvas center X/Y and canvas edges within 6 px (`Alt` bypasses snap).
- [x] **Click empty stage to deselect:** Clicking blank stage/canvas space clears `selected`.
- [x] **Zoomable / pannable preview stage:** Added `Fit / 50% / 100% / 150% / 200%` + custom `25%–400%` zoom menu, `Ctrl/Meta+wheel` stage zoom, and drag-to-pan on empty stage space.

*(Additional candidates for later polish: side-edge stretch handles, interactive canvas crop mode.)*

## 2. Timeline & Track Editing

**Status:** Passed (`npx.cmd tsc --noEmit --pretty false`, `npm.cmd run test:core` 37/37, `git diff --check`)

- [x] **Track gutter controls:** Per-lane `Hide` (`track >= 0`), `Mute`, and `Lock` toggles in the track label gutter, respected in preview, playback, and export.
- [x] **Timeline zoom UX:** `−` / range slider / `+` zoom controls and one-click **Fit** button alongside `Ctrl+wheel` and typed `px/s`.
- [x] **Multi-clip timeline selection:** `Ctrl/Cmd+click` toggle and `Shift+click` range selection on timeline clips, with batch delete of unlocked clips.
- [x] **Clip context menu, Copy/Paste, & Freeze frame:** Right-click `.studio-clip-context-menu` (`Split at playhead`, `Copy clip`, `Paste at playhead`, `Duplicate`, `Freeze frame`, `Detach audio`, `Delete`).
- [x] **Dynamic Project Details track count:** Replaced hardcoded `3 video · 3 audio` with dynamic visual and audio lane counts.
- [x] **Audio lane placement & detach fixes:** Detached audio picks the first non-overlapping `Audio N` lane; dragging any audio clip or bin audio asset reveals `Move to new Audio N` below existing audio lanes.

## 3. Inspector & Clip Properties

**Status:** Passed (`npx.cmd tsc --noEmit --pretty false`, `npm.cmd run test:core` 37/37, `git diff --check`)

- [x] **Inline keyframe `◇` toggles:** Added `◇` / `◆` keyframe toggle buttons directly in `Basic` beside `Transform`, `Image size and position`, `Audio volume`, and `Title style`.
- [x] **Text styling parity:** Added font family, bold/italic/align, line height, stroke color/width, drop shadow (toggle/color/blur), and background corner radius/opacity in `VideoTextSettings` and `drawVideoComposition`.
- [x] **Adjust tab expansion:** Added `Hue`, `Sepia`, and `Blur` alongside `Brightness`, `Contrast`, `Saturation`, and `Grayscale`, plus `Reset adjustments`.
- [x] **Blend modes & Speed duration readout:** Added `Normal / Screen / Multiply / Overlay / Lighten / Darken` blend modes for visual clips (`drawVideoComposition` + `Basic`), plus speed preset chips (`0.25×`–`4×`), live clip duration readout, and editable `Target duration` (which computes `speed = sourceSpan / targetDuration`) in `Speed`.
- [x] **Magnetic playhead snapping:** Seeking via the timeline ruler or playhead handle snaps to timeline bounds, clip starts/ends across all tracks (video, overlays, text, audio), and keyframes when `Snap` is enabled (hold `Alt` to bypass).

## 4. Left Panel (Text, Transitions, Shapes)

**Status:** Passed (`npx.cmd tsc --noEmit --pretty false`, `npm.cmd run test:core` 37/37, `git diff --check`)

- [x] **Local text presets:** Added 6 local text presets (`Default title`, `Lower third`, `Bold caption`, `Subtitle bar`, `Neon glow`, `Minimal corner tag`) in the `Text` tab using `VideoTextSettings` + initial transform.
- [x] **More local transitions:** Added `Fade to black`, `Wipe left/right/up/down`, `Slide left/right`, and `Zoom in` alongside `Dissolve` and `Crossfade`, with duration input in the `Transitions` tab and shared rendering in `drawVideoComposition`.
- [x] **Local SVG shapes/stickers:** Added a `Shapes` tab with a color picker and 6 local SVG vector shapes (`Rectangle`, `Rounded pill`, `Circle`, `Arrow right`, `Callout badge`, `Outline frame`) placed as editable image overlays.

## 5. Shortcuts & Workflow Polish

**Status:** Passed (`npx.cmd tsc --noEmit --pretty false`, `npm.cmd run test:core` 37/37, `git diff --check`)

- [x] **Additional shortcuts:** Added `Q`/`W` (delete left/right), `J`/`K`/`L` (shuttle), `-`/`+` (timeline zoom), and `?` (shortcuts dialog) alongside `Space`, `S`/`Ctrl+B`, `Ctrl+D`, `Ctrl+C`/`Ctrl+V`, `ArrowLeft`/`ArrowRight`, `Home`, `Delete`/`Backspace`, and `Ctrl+Z`/`Ctrl+Y`.
- [x] **Shortcut reference modal & inline project rename:** Added `?` shortcut reference modal and inline project title editing in the Video Studio header (`renameProject`).
