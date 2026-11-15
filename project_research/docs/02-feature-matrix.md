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
| Core | Audio Studio project | Import and persist one local audio source, waveform, non-destructive source range, speed/pitch mode, gain and fades; reopen and export WAV offline. |
| Core | Normalize | A focused local tool measures peak level, applies a custom target from −24 to 0 dBFS in a chunked worker, reports progress, supports cancellation, previews the result, and exports WAV. |
| AI | Vocal remover | Separate vocal and instrumental outputs from music, with local model download and cancellation. |
| AI | Speech cleanup | Stronger model-based speech noise reduction; separate from the Core noise tool. |
| Later | EQ, reverb, batch processing | Add only after demand and performance review. |

## Video: basic CapCut-like editor

The video timeline is a Core feature. Standalone trim/merge cards are quick-entry workflows into this editor, not replacements for it.

Implementation status (2026-11-15): `/studio/video` has a local media bin, six independent lanes, draggable clips with configurable snapping, pointer trim handles, primary Video 1 ripple edits (enabled by default, toggleable, never shifts overlay/audio lanes), keyboard shortcuts for play/pause, frame/second seek, start, split, delete, undo, and redo, numeric source in/out and timeline start, split, duplicate, delete, 50-step undo/redo, custom clip speed/volume/mute, per-clip position/scale/rotation/opacity, linearly interpolated transform/volume keyframes, brightness/contrast/saturation/grayscale controls, editable text title clips, explicit dissolve-to-next and audio-crossfade-to-next actions, custom linear fades, source-video audio detachment into editable WAV lane clips with a visible independent-audio notice, replacement audio placement from an imported asset with a custom offset, a shared canvas composite preview/export renderer, synchronized browser audio preview, IndexedDB project/media persistence, and local timeline render/export. Audio clips expose preserve-pitch (default) and natural-pitch modes; natural mode uses linear resampling in export and disables browser pitch preservation in preview. Export checks browser codecs before selecting MP4/WebM, supports typed dimensions/frame rate/bitrates, and uses local Bungee processing for pitch-preserving speed changes. Bounds: 120 seconds, 4 MP per frame, 180 seconds of unique source audio, and 512 MiB output. Embedded video audio is omitted until explicitly detached; export resume is unimplemented. Import parses actual audio/video codecs with Mediabunny; images are validated by bitmap decode and dimension limits. In the 2026-11-14 Codex in-app browser fixture run, H.264/AAC MP4, VP9/Opus WebM, 48/44.1 kHz WAV, and a transparent PNG imported; the SVG form was rejected as undecodable. Eight assets, track placements, image/title settings, and the edit document restored after refresh. Preview source time matched between the sync video and detached audio at 9.5 seconds. A 320×180, 24 fps MP4 export opened and decoded in FFmpeg/VLC; narrow-band pulse checks found the exported sync fixture's 1 kHz pulses at 9.50, 10.50, and 11.50 seconds. A playhead event bug and Bungee's 1× transient loss were fixed. In a separate production static preview on Chrome 157.0.8103.79, pointer-dragging the first of two Video 1 fixtures shortened it by 0.5 seconds and rippled only the following primary-track clip; one undo restored both clip positions. Left trim advanced the first clip by 0.5 seconds while preserving its end and leaving the next clip in place. Refresh restored the edited positions. With the active service worker controlling the page, forcing the network offline and reloading the direct project URL restored both fixture clips without route errors. An online production render completed and the app video element reported a 1920×1080, 8.033 s MP4 (3,478,536 bytes); it was not externally inspected. The offline export attempt disconnected the browser, so no offline-export pass is claimed. M6 still needs external output inspection, a completed offline export, broader joins/boundaries, named interactive browser/device coverage, and accessibility review.

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

Image status note (2026-11-15): `/tools/image/resize` includes persisted non-destructive rectangle, ellipse, and text layers, basic filter presets, typed dimensions, rotation, flip, unified undo/redo for edit settings and layers, and PNG/JPEG export with typed quality; the image workspace saves/reopens export settings with the project. The collage route saves/reopens a versioned editable project with local source images, image order, grid columns, spacing, global and per-cell contain/cover fit, per-cell scale and X/Y position, background, canvas dimensions, and a styled caption. Per-cell controls are persisted as optional fields in the existing collage document format, so older documents default to global fit, 1× scale, and centered position. On the production static preview, Chrome 157.0.8103.79 imported two local checkerboard images, changed one cell to cover/2×/35% X, saved and refreshed, and restored those settings and the changed render. A forced offline reload restored both sources and the edit settings; offline PNG export reported 1200×900. The standalone resize tool produced a transparent 300×300 PNG from the 400×340 fixture; aspect lock at 300 px width recalculated height to 255 px. External viewer/color review and image editor layer/save/undo verification remain open, so the image Core gate is not yet fully met.

## Phase completion status (2026-11-14)

The implementation has substantial M4–M6 slices, but the Core release is not complete. Audio trim/split/merge/volume/noise-gate/normalize quick tools exist, and Audio Studio persists one source with trim, speed, gain, fades, and WAV rendering. However, Audio Studio is not multitrack; denoise is a broadband gate rather than spectral noise reduction, and full audio fixture and offline checks remain open. Synthetic Core fixtures cover H.264/AAC MP4, VP9/Opus WebM, PCM WAV at 48 kHz/44.1 kHz, the 400×340 checkerboard/transparency SVG and PNG, two collage subjects, and a 24 fps sync-marker MP4. The sync fixture passed one local in-app-browser import, preview alignment, save/reopen, and MP4 export run; it does not establish cross-browser support or offline operation. Editable collage persistence is implemented but its full import/save/reopen/export/offline path still needs verification. `/settings/storage` exposes usage, persistence status/request, and per-project deletion, but quota-failure recovery remains untested. M6 still lacks a named Chrome/Edge run, offline save/export evidence, drag-trim/ripple interactions, and broader A/V sync cases. Shared M2/M3 now inspects codecs for audio/video in Audio and Video Studio, but the full browser/format matrix, shared import for other tools, common worker job protocol, quota/missing-asset recovery, and deployed static-host route/SEO/PWA checks remain open. M7 AI work has not started and remains correctly deferred until Core gates pass.

## Browser and format policy

Chrome and Edge desktop are the full-editor targets. Firefox and Safari get only tools whose complete import/preview/export path passes tests. Mobile gets a responsive interface and only tested processing paths. Format support is a measured matrix of **container + codec + direction + browser**, not a blanket promise based on `.mp4` or `.wav` extensions. Initial export targets are PNG/JPEG for images, WAV for audio, and MP4/WebM video configurations where the device supports the encoders. AI features may have narrower support and must say so before download.
