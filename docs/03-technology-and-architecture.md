# Technology and architecture

## Chosen stack

At handoff on 2026-11-14, use the current stable, compatible patches in the React 19.3, React Router 8, and Vite 8 lines, TypeScript, pnpm, and a single static build. Pin exact resolved versions in `pnpm-lock.yaml` when scaffolding. React Router **Framework Mode** with `ssr: false` and explicit pre-render paths supplies real HTML for SEO pages and a client-side editing app without a runtime server. Avoid a plain SPA for public pages and avoid a Next.js runtime dependency.

Recommended libraries: Workbox for a custom service worker; Mediabunny for container reading/writing and conversion; native WebCodecs for supported codecs; Web Audio for playback and effects; Fabric.js for image objects/collage; IndexedDB via Dexie for metadata; OPFS for media bytes; ONNX Runtime Web for downloaded AI models. Use a small client state store (Zustand is suitable) only for transient editor UI; persistence lives in the project package. Use Vitest and Playwright for tests. Check current package compatibility and license before installation.

## Package responsibilities

- `app/`: public routes, editor pages, accessibility, navigation, controls, and job status. Route modules must remain safe to pre-render; browser-only APIs initialize after hydration.
- `packages/media-core/`: format/capability probing, media metadata, clocks/time units, worker job messages, resource cleanup, output contracts, and shared error codes.
- `packages/audio/`: waveform generation, trim/split/merge, gain/fades/normalization, basic cleanup, speed/time-stretch preview and render.
- `packages/video/`: track/clip edit operations, preview compositor, audio mix, keyframe interpolation, transition definitions, and streaming export.
- `packages/image/`: Fabric document adapter, non-destructive edits, exact pixel resize, collage templates, and export; AI adapter in a separate lazy-loaded module.
- `packages/projects/`: versioned project schema, OPFS asset store, IndexedDB records, autosave, migrations, garbage collection, and storage estimates.

Use a pnpm workspace to keep heavy engines out of initial public-page bundles. Dynamic imports load editors only on studio routes. AI runtime and model download code load only when the user opens the corresponding AI tool. Keep UI components separate from processing logic so jobs can run in dedicated workers.

## Media pipeline principles

1. Import a `File` or user-selected handle, inspect its real container/tracks/codecs, and derive supported actions from runtime checks.
2. Copy the source to OPFS when saving a project; preserve its original bytes and store metadata separately.
3. Represent edits as instructions against stable source IDs. Preview uses reduced-resolution proxies or selective frame decode where needed; export evaluates the same edit graph at final quality.
4. Define timeline timestamps in integer microseconds (or an equivalent integer tick unit) rather than accumulated floating-point seconds. Convert at UI boundaries. For custom speed, map project time to source time from the clip's speed function and derive duration from that mapping.
5. Render expensive work in workers. Communicate through typed job messages: `start`, `progress`, `cancel`, `complete`, and `error`. Cancel and error paths release codec objects, object URLs, audio nodes, and temporary OPFS files.
6. Stream or chunk input/output where supported; do not decode entire long videos or create multiple full-size copies in memory.

WebCodecs handles encode/decode but not media containers, which is why Mediabunny is paired with it. Test `isConfigSupported` and a real sample before advertising a codec. ffmpeg.wasm is an optional fallback only after a specific capability gap, performance benchmark, and license review; it must not be the default renderer.

## AI pipeline

ONNX Runtime Web runs in a worker with WebGPU when that execution path passes actual model tests; WASM is the tested fallback. Cache model bytes by pinned version and checksum. Use overlapped chunks for audio and overlapping tiles for images, with stitching/overlap blending. Do not promise identical speed or quality across devices. Record download size, memory peak, duration, and output quality in the feasibility report before enabling a model in the product.

## Security and privacy

Self-host scripts, workers, fonts, and model files. Set a restrictive content security policy compatible with workers/WASM/WebGPU and test it in production. Do not add analytics that capture filenames, media bytes, or project content. Use explicit external links on public pages only. Worker failures must surface actionable messages without leaking source data.
