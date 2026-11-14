# Feature matrix and release boundaries

Legend: **Core** = first usable release; **AI** = subsequent downloaded-model release; **Later** = candidate, not a commitment. All processing is local. Every adjustable setting has a typed numeric input alongside any slider or preset. Core assets must be cached for offline work; each AI model becomes offline-ready after its own successful download.

## Shared application features

| Release | Capability | Required behavior |
|---|---|---|
| Core | Import | Local file picker and drag/drop; inspect actual media/container/codec; show unsupported-reason messages. Never upload. |
| Core | Projects | Create, name, autosave, reopen, duplicate, delete, undo/redo; keep sources unchanged; show storage use and handle quota errors. |
| Core | Jobs | Progress, cancellation, failure recovery, export destination, cleanup of temporary artifacts. |
| Core | Offline PWA | Installable, accessible core routes and tools after initial cache; visible per-tool offline readiness. |
| Core | Export | Named output, supported formats only, custom quality/bitrate/dimensions where applicable, and a resulting file that opens outside the app. |

## Audio

| Release | Tool | Inputs, controls, and output |
|---|---|---|
| Core | Trim/split | Waveform selection and typed start/end times; split at playhead; export one or all segments. |
| Core | Merge | Ordered clip list with gap/crossfade duration; resample or channel-match as needed; one continuous audio export. |
| Core | Volume and fades | Typed gain and fade durations; preview; no destructive source change. |
| Core | Normalize | Target peak level, preview, and rendered output. |
| Core | Basic noise reduction | Adjustable strength and before/after preview for steady background noise; explain that it is not vocal separation. |
| Core | Speed | Custom decimal 0.1×–16×; pitch preservation on by default, toggle for natural pitch change; accurate new duration in preview and output. |
| AI | Vocal remover | Separate vocal and instrumental outputs from music, with local model download and cancellation. |
| AI | Speech cleanup | Stronger model-based speech noise reduction; separate from the Core noise tool. |
| Later | EQ, reverb, batch processing | Add only after demand and performance review. |

## Video: basic CapCut-like editor

The video timeline is a Core feature. Standalone trim/merge cards are quick-entry workflows into this editor, not replacements for it.

Implementation status (2026-11-14): `/studio/video` has a local media bin, six independent lanes, draggable clips, numeric source in/out, split, duplicate, delete, 50-step undo/redo, custom clip speed/volume/mute, per-clip position/scale/rotation/opacity for visual clips, a shared canvas composite preview/export renderer, browser-mixed synchronized audio preview, IndexedDB project/media persistence, and local timeline render/export. Export checks browser codecs before selecting MP4/WebM, supports typed dimensions/frame rate/bitrates, and uses local Bungee processing for pitch-preserved audio-clip speed. The first export is bounded to 120 seconds, 4 MP per frame, 180 seconds of unique source audio, and 512 MiB output. The source video's embedded audio, keyframes, text/effects, transitions, and export resume remain unimplemented. Do not advertise the studio as a complete editor until renderer, save/reopen, output-file, and offline gates pass on supported browsers.

| Release | Capability | Required behavior |
|---|---|---|
| Core | Media bin and timeline | Import video, audio, and images. Multiple video/overlay, text, and audio tracks; clip move, reorder, trim, split, duplicate, delete, snapping, playhead, timeline zoom, and undo/redo. |
| Core | Preview and composition | Canvas with output aspect ratio and safe bounds; show current frame, overlays, titles, audio, effects, and transitions at timeline time. |
| Core | Audio | Detach source audio, mute, replace, adjust volume, fade, mix tracks, and maintain sync. |
| Core | Speed | Custom decimal 0.1×–16× on each clip; recompute timeline duration. Preserve pitch by default for attached audio; allow natural-pitch mode. |
| Core | Transform and keyframes | Position, scale, rotation, opacity, and volume keyframes with linear interpolation; typed values and time positions. |
| Core | Transitions | Cut, dissolve, and crossfade as initial transitions; custom duration. Other transitions require their own verified renderer. |
| Core | Titles and effects | Editable text with font, size, color, placement, and duration; basic brightness, contrast, saturation, and grayscale controls. |
| Core | Export | Choose supported MP4 or WebM configuration, output dimensions, frame rate, bitrate, and audio; render a synced playable file. |
| Later | Auto captions, chroma key, advanced motion effects, stock library | Not part of Core unless separately approved as a new milestone. |

## Image

| Release | Tool | Inputs, controls, and output |
|---|---|---|
| Core | Basic edit | Crop, rotate, flip, brightness, contrast, saturation, common filters, text, shapes, undo/redo; PNG/JPEG export. |
| Core | Exact pixel resize | Independent integer width and height by default. `400×340 → 300×300` yields exactly `300×300` by stretching, without crop or padding. Match-aspect-ratio toggle recalculates the other dimension. |
| Core | Collage | Select layout, add/reorder images, adjust cells and spacing, background, text, and output dimensions; save editable composition. |
| AI | Upscale | Downloaded local super-resolution model; 2×/4× shortcuts and custom final dimensions; tiled processing and before/after preview. |
| Later | Background removal, object removal, batch templates | Not committed. |

## Browser and format policy

Chrome and Edge desktop are the full-editor targets. Firefox and Safari get only tools whose complete import/preview/export path passes tests. Mobile gets a responsive interface and only tested processing paths. Format support is a measured matrix of **container + codec + direction + browser**, not a blanket promise based on `.mp4` or `.wav` extensions. Initial export targets are PNG/JPEG for images, WAV for audio, and MP4/WebM video configurations where the device supports the encoders. AI features may have narrower support and must say so before download.
