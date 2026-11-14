# Project data and media pipelines

## Storage contract

Each project has a UUID, schema version, media kind (`audio`, `video`, `image`), title, creation/update timestamps, thumbnail reference, source asset IDs, editor document, export defaults, and an autosave revision. Store project records and asset metadata in IndexedDB. Store imported source bytes, proxies, and generated results in OPFS under project-scoped directories. A temporary job directory is deleted on completion, cancellation, or startup recovery. Store only serializable edit state, not DOM, Canvas, AudioBuffer, File, or WebCodecs objects.

Asset metadata includes UUID, original filename, media type, byte size, content hash when feasible, codec/container inspection result, dimensions or sample rate/channels, duration, OPFS path, and whether the bytes still exist. Reopen validates references and offers recovery/reimport when data is missing. Copying a source into the project is required for durable local projects; a temporary unsaved session may read directly from a selected `File`.

Migrations are sequential from one schema version to the next and run before opening a project. Write new data atomically or keep the prior revision until a successful commit. Never discard a project merely because a later app version cannot read a field; show a recovery/export option. Project deletion removes associated OPFS data only after confirming the project record no longer references it.

## Common editing rules

Edits are non-destructive commands over source assets. A command records its forward change and undo information or is derived from immutable document revisions. Autosave debounces ordinary edits and flushes before navigation/export. The active job captures an immutable project revision; further UI edits do not silently modify an export already running. Numeric UI values are validated and normalized once at the editor boundary; processing receives typed values with explicit units.

## Audio document and pipeline

An audio project holds ordered clips with source ID, source in/out, timeline start, speed, gain, fades, optional cleanup settings, and channel routing. Speed is a decimal multiplier from 0.1 through 16; the duration of a constant-speed clip is `(source out - source in) / speed`. The pitch mode defaults to `preserve` and can be `natural`. Waveforms are cached proxies, not the source of truth. The first saved Audio Studio document stores one source asset and its trim, speed, pitch, gain, and fade instructions; it is a project-ready single-file workflow rather than the full multitrack audio arrangement model.

Pipeline: inspect/decode → waveform proxy → user edits → preview graph → chunked offline render → encode/write output. Split and trim must use source timestamps, not pixel coordinates. Merge normalizes sample rate/channel layout before mixing. Basic noise cleanup and AI speech cleanup are distinct processors. Output initially targets WAV; other audio formats require tested encoder support.

## Video document and pipeline

A video project has canvas width/height, frame rate, background, and ordered tracks. Track types: video/overlay, text, and audio. Each clip has stable ID, source ID, source in/out, timeline start, layer order, speed and pitch mode, transforms, effects, and keyframes. A transition has adjacent clip references, kind, start, and duration. Text records content, font, style, placement, and lifetime. The current M6 implementation uses finite numeric seconds as the shared project clock, with one clip-duration helper and frame/sample indices derived at renderer boundaries. This supersedes the earlier integer-tick proposal: a local 24 fps export retained 1 kHz sync pulses at 9.500, 10.500, and 11.500 seconds after the video and detached audio clips were aligned at 8.5 seconds. Long-run drift and frame-boundary behavior remain release checks.

Preview decodes only required frames and uses lower-resolution proxies when needed. Export evaluates the same timeline model, composites frames at the selected output frame rate, renders/mixes audio against the same clock, encodes supported codecs, and muxes a playable file. The UI must indicate when a requested export requires transcoding. A track with no audio must not produce a silent phantom track unless selected. Validate audio/video sync at clip joins, speed changes, and transitions.

## Image document and pipeline

An image project stores canvas dimensions, a base source image, layers/objects, filters, resize operation, and collage cells. Fabric.js serialization may be an implementation detail, but wrap it in an app-owned versioned document so library upgrades do not define the only durable format. Exact pixel resize changes output dimensions and resamples the entire image; with aspect matching off it can change proportions. AI upscale is a separate operation producing a new derived asset, then optionally resampling to a custom final size. Export targets PNG/JPEG at specified dimensions and quality.

The current collage document is version 1 within the versioned project record and persists ordered local image references, grid columns, spacing, contain/cover fit, canvas dimensions, background, and caption styling. Per-cell transforms/crop are not implemented yet. Project schema migration currently advances local records through schema version 5. Imported image/audio sources are stored under immutable asset IDs; the project record switches to a new ID after the bytes are stored, then the old source is removed. Audio source cleanup waits until both its project pointer and audio edit document have been updated.

The focused peak normalizer decodes a bounded input on the main thread, then transfers 65,536-frame PCM chunks to a worker for peak analysis and WAV encoding. The editor shows progress and can cancel between chunks. This worker path is not yet the shared job manager required for all expensive operations.

## Capability and failure contracts

Probe browser APIs, actual track metadata, decoder/encoder configuration, available storage, and model readiness before enabling a job. Return typed errors such as unsupported codec, insufficient storage, corrupted source, cancelled, out of memory, model unavailable, and export failed. Keep the project editable after every failure. On successful export, verify the resulting blob/container metadata and make a user-controlled download available.
