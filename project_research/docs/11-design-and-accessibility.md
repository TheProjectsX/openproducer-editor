# Design system and accessibility

## Layout

Public pages use a clear hero, category navigation, task-oriented tool cards, a short privacy/offline explanation, and a prominent launch action. Tool pages use the same structure: what it does, accepted inputs, editing steps, output, offline readiness, and known limits. Avoid thin pages that repeat generic wording; each page should help a visitor choose the right tool.

Studio pages use a dark editing workspace. Desktop Video Studio has a media bin on the left, preview and transport center, inspector on the right, and timeline across the bottom. Audio uses a larger waveform area with a compact transport and inspector. Image uses canvas center, layers/tools left, and properties/export right. All panels must be resizable or collapsible where space is constrained. Keep the export action consistently visible.

At narrower widths, collapse secondary panels into tabs or drawers while preserving the preview and active control. On mobile, show capability limitations before import or processing; never hide a supported tool behind an unreachable desktop-only control. Use touch-sized targets and avoid hover-only interactions.

## Visual tokens to establish in M1

Define semantic tokens for page background, editor background, panel surface, text, muted text, border, primary action, selection, timeline tracks, waveform, focus, warning, and error. Use a limited type scale and spacing scale. Choose a legible interface font that can be self-hosted for offline use. Verify contrast in both the public presentation and dark studio. The selected brand name and palette can change before publication without altering product behavior.

## Interaction and accessibility requirements

- Every icon-only button has an accessible name and a tooltip. Focus is visible on all interactive controls.
- Secondary editor actions use a consistent rounded, outlined surface, distinct from primary export actions, with visible hover, pressed, focus, and disabled states.
- Tab order follows the visual workflow. Sliders have typed companions with units and bounds. Error messages identify the field and correction needed.
- Provide keyboard operations for play/pause, seek, split, delete, undo/redo, and timeline zoom; show shortcuts in a help dialog. Users can also complete these actions using visible controls.
- Drag/drop operations have a keyboard or menu alternative. Do not make track reorder or collage reorder pointer-only.
- Announce long-job state, progress, completion, and failure without repeatedly interrupting screen readers. Cancellation remains reachable during processing.
- Do not rely on color alone to distinguish selected tracks, clip types, offline readiness, or errors. Use labels and shape/state cues.
- Respect reduced-motion preferences for animated UI. Do not reduce video preview accuracy; this setting applies to interface motion.
- Confirm destructive project deletion. Export, cancel, and close actions should not silently discard autosaved work.

## Copy rules

Use task language: “Remove vocals,” “Change speed,” “Resize pixels,” “Export video.” Show exact units in controls (`px`, `×`, `s`, `dB`, `fps`, `kbps`). Distinguish standard resizing from AI upscaling. Distinguish basic noise reduction from speech cleanup. State when an AI model needs its first download and when a tool is ready offline. Avoid a generic “supports MP4” claim without explaining that actual codec support depends on the browser.

## Design acceptance

Review representative pages and each editor at desktop and narrow widths. Verify keyboard-only completion of one workflow per media type, screen-reader labels for core controls, contrast and focus, and readable progress/error states. Visual QA is part of M8, but the M1 component system must be built with these requirements from the start.
