# Exact editor interactions

## Shared numeric-control rule

Every adjustable numeric option has a labeled text or number field showing its unit, alongside an optional slider and preset buttons. Typing a value updates preview after validation; presets populate the same field. Display min/max and precision. Reject empty, non-finite, zero where invalid, negative where invalid, and out-of-range values with an inline message while retaining the last valid render value. Keyboard arrows, focus states, and screen-reader labels are required. Export must use the committed value, not a rounded slider value.

## Audio speed

User selects a clip or whole-file operation, types any decimal multiplier from 0.1× to 16×, and sees the calculated output duration. Preset buttons may include 0.5×, 1×, 2×, 4× but cannot constrain input. Pitch preservation is on by default. A toggle selects natural pitch change. Preview and exported audio must agree on duration and pitch mode. At extreme speeds, show quality guidance if processing creates artifacts; do not quietly clamp a valid typed value.

## Video timeline

Layout: media bin on the left, preview center, inspector on the right, timeline below. Users drag media into tracks and see thumbnails/waveforms. Timeline supports play/pause, seek, zoom, snap toggle, split at playhead, trim handles, drag/reorder, duplicate, delete, undo/redo, and keyboard shortcuts. The inspector shows exact numeric controls for selected clip transform, opacity, volume, speed, fade, transition, and effect values.

Video Studio keyboard shortcuts: Space toggles playback; Left/Right Arrow seeks one frame (Shift seeks one second); Home seeks to the start; S splits the selected clip at the playhead; Delete/Backspace removes the selected clip; Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes. Typing controls and focused text fields keep their normal key behavior.

Video speed is per clip, 0.1×–16×, with custom decimal input. A speed change updates clip length and downstream positions according to the chosen ripple-edit mode; default is ripple on for a primary video track and off for overlays/audio. Attached audio remains synchronized and pitch-preserved by default. Detaching audio creates an independently editable audio clip with its current timeline alignment. If the clip's speed changes after detachment, the detached audio does not automatically change; the UI must make this visible.

Keyframes are supported for position, scale, rotation, opacity, and volume. A property without keyframes uses one constant value. Adding a keyframe at the playhead captures the current value. Values between keyframes interpolate linearly; before the first and after the last, hold the nearest value. Keyframes move with their clip. Initial transitions are cut, dissolve, and crossfade with a custom duration, limited to the available overlapping media. The current editor exposes “Dissolve into next clip” and “Crossfade into next clip” actions that create overlap with the next clip on the same track and apply linear fades. The preview and renderer must share the same timing/effect functions.

M6 browser fixture check (2026-11-14): the current editor exposes typed source in/out and timeline-start fields, track assignment, clip move, title/effect/transform controls, keyframes, dissolve, crossfade, per-clip speed and pitch mode, detach-audio, and render. A React event-value capture bug in the playhead field and a 1× Bungee transient-loss bug were found and fixed during the local fixture run. Drag-trim handles and primary-track ripple behavior are now implemented, but direct interaction verification remains open. Ripple is enabled by default on Video 1 and can be switched off; it does not move overlays or audio. Replacement-audio quick flow and cross-browser keyboard/accessibility coverage remain implementation or release gaps; this note does not waive the interaction requirements above.

Quick video tools (Trim, Merge, Remove Audio, Replace Audio) create or open a Video Studio project with a focused inspector and prearranged track state. Users can switch to the full timeline without losing changes. The first release includes text titles, basic filters/color adjustments, and export controls; it does not include auto captions or an effect marketplace.

## Image resize and collage

Show original width/height and editable output width/height. Default **Match aspect ratio = off**. With it off, width and height are independent and the full image stretches to the exact output canvas with no crop or padding. Example: 400×340 to 300×300 gives an exactly 300×300 file, possibly with changed proportions. With it on, changing one dimension recalculates the other using the original aspect ratio and integer rounding. Toggling it on immediately reconciles dimensions using the last-edited field. Crop is a separate explicit tool.

Collage begins from a layout template but remains editable: add/remove/reorder images, adjust cell fit, spacing, background, canvas size, and text. Save cell positions and source references rather than flattening until export. Provide a before/after or original/output comparison for filters and resizing.

## AI image upscaling

Display model download size and readiness before starting. Offer 2×/4× buttons plus custom target width/height. The super-resolution model produces its supported scale; a final deterministic resample reaches a custom target. Preserve aspect by default in AI Upscale unless the user disables Match aspect ratio, in which case final resampling may stretch. Show estimated output size, tile progress, cancellation, and a zoomed before/after comparison. Model failure leaves the original and project intact.

## Export interaction

Show output format choices only after checking the browser/device. The export sheet lists exact dimensions, frame rate or sample rate, bitrate/quality, estimated duration/file size when feasible, destination filename, and a warning for unsupported combinations. Progress can be cancelled. On completion, offer download and keep the editable project. Do not auto-replace the source asset.
