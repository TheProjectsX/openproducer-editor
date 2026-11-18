# Video Studio Right-Side Inspector — CapCut PC Parity Plan

Recorded: 2026-11-18

This document tracks the CapCut PC cross-check and phased update of the right-side inspector (`.video-inspector`) in `app/routes/studio-video.tsx`.

## Phased Rollout

### 1. No Selected Details (`Details`) — [x] Complete

- **Summary info:** Media count, dynamic track count (`video · audio`), duration, local storage status.
- **Editable Canvas & Project settings in Details:**
    - Inline project name (synced with header title & `renameProject`).
    - `Aspect ratio` selector (`Original`, `Custom`, `16:9`, `4:3`, `2.35:1`, `2:1`, `1.85:1`, `9:16`, `3:4`, `1:1`).
    - `Resolution` (`Width` / `Height` custom inputs when `Custom`, or live `W × H` readout).
    - `Frame rate` (`12–60 fps` custom input synced with export modal).
    - `Canvas background` color picker + reset (`timeline.backgroundColor ?? "#11131a"`), shared between preview and export in `drawVideoComposition`.
    - `Export settings` action button.

### 2. Audio Clip (`track < 0`) — [x] Complete

- **Tabs:** Show `Basic` and `Speed` only (hide `Adjust` tab, which has no audio adjustments).
- **Basic:**
    - `Audio volume` (0–4×) + keyframe `◇/◆` toggle + `Reset` (1×).
    - `Fade in` / `Fade out` (seconds) moved into `Basic` (from `Speed`).
    - `Silence audio` (`muted`) toggle.
    - `Crossfade into next clip` + duration.
    - `Track`, `Timeline start`, `Source in`, `Source out`.
    - `Split`, `Duplicate`, `Delete`.
- **Speed:**
    - `Speed` slider + presets (`0.25×–4×`) + custom `0.1–16×` input + `Target duration` + live duration readout.
    - `Audio pitch mode` (`Preserve pitch` / `Natural pitch`).
    - Detached audio note when derived from a video asset.

### 3. Video Clip — [x] Complete

- **Tabs:** `Video` (or `Basic`), `Audio`, `Speed`, `Adjust` (or `Basic`, `Speed`, `Adjust` with collapsible `Transform`, `Audio`, `Blend`, `Placement`, `Transitions` sections).
- **Basic / Video:**
    - `Transform` (`Scale` slider + custom input, `Position X / Y`, `Rotate`, `Opacity`, `Align`, `Mirror X / Y`, `Reset transform`) + keyframe `◇/◆`.
    - `Blend mode` (`Normal`, `Screen`, `Multiply`, `Overlay`, `Lighten`, `Darken`).
    - `Audio` section (`Audio volume` 0–4× + keyframe `◇/◆`, `Fade in / Fade out`, `Silence audio`, `Extract audio`, `Replace clip audio` + offset).
    - `Transitions` (`Dissolve into next clip` + duration).
    - `Placement` (`Track`, `Timeline start`, `Source in`, `Source out`).
    - `Split`, `Duplicate`, `Freeze frame`, `Delete`.
- **Speed:**
    - `Speed` slider + presets + custom `0.1–16×` + `Target duration` + live duration readout.
- **Adjust:**
    - `Brightness`, `Contrast`, `Saturation`, `Grayscale`, `Hue`, `Sepia`, `Blur`, `Reset adjustments` (without duplicating `Position X/Y/Opacity` from `Basic`).

### 4. Image / Shape Clip — [x] Complete

- **Tabs:** `Basic`, `Duration`, `Adjust`.
- **Basic:**
    - `Transform` (`Scale` slider + `Width / Height` px, `Maintain aspect ratio`, `Position X / Y`, `Rotate`, `Opacity`, `Align`, `Mirror X / Y`, `Reset size to fit`) + keyframe `◇/◆`.
    - `Crop source` (`Left / Top / Right / Bottom %`, `Reset crop`).
    - `Blend mode`.
    - `Transitions` (`Dissolve into next clip` + duration).
    - `Placement` (`Track`, `Timeline start`, `Source in`, `Source out`).
    - Remove irrelevant `Mute clip` checkbox.
    - `Split`, `Duplicate`, `Delete`.
- **Duration (instead of audio-style `Speed`):**
    - Direct `Duration` (seconds) + `Fade in / Fade out`.
- **Adjust:**
    - `Brightness`, `Contrast`, `Saturation`, `Grayscale`, `Hue`, `Sepia`, `Blur`, `Reset adjustments`.

### 5. Text Clip — [x] Complete

- **Tabs:** `Text`, `Basic`, `Duration` (hide irrelevant color `Adjust` tab and `Mute clip` checkbox).
- **Text:**
    - `Title text`, `Font`, `Font size`, `Bold / Italic / Underline / All caps`, `Align (L/C/R)`, `Letter spacing`, `Line height`.
    - `Text color`, `Stroke color / width`, `Drop shadow (toggle, color, blur, offset X/Y)`, `Background (toggle, color, radius, opacity, padding)` + keyframe `◇/◆`.
- **Basic:**
    - `Transform` (`Scale`, `Position X / Y`, `Rotate`, `Opacity`, `Align to canvas`, `Reset transform`) + keyframe `◇/◆`.
    - `Blend mode`, `Transitions`, `Placement` (`Track`, `Timeline start`), `Split`, `Duplicate`, `Delete`.
- **Duration:**
    - Direct `Duration` (seconds) + `Fade in / Fade out`.

### 6. Multi-Clip Selection & Remaining Polish — [x] Complete

- When `selectedClips.length > 1`:
    - Show `{count} clips selected` header and hide single-clip-only controls (`Title text`, `Source in/out`, `Crop`, `Replace audio`, `Dissolve into next clip`, `Extract audio`).
    - Keep shared batchable controls (`Transform / Opacity / Blend`, `Audio volume / Mute`, `Speed`, `Fade in / out`, `Color Adjust`, `Delete`).
- Visual & CSS polish for `.video-inspector` collapsible/grouped sections (`clip-control-group`).
