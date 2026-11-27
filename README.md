# OpenProducer Editor

OpenProducer Editor is a local-first, browser-based media production suite for video, audio, and image editing. All media decoding, timeline composition, AI inference, project storage, and rendering run entirely on the user's device with no media uploads, user accounts, or backend processing.

## Key Principles

- **On-device processing**: Media files, project state, previews, and exports never leave the browser.
- **Non-destructive editing**: Source media is preserved; studios store versioned edit instructions and asset references so previews and exports derive from the same edit model.
- **Static & offline-capable**: Built as a pre-rendered static Progressive Web App (PWA) with a generated service worker and direct route refresh support on static hosts.
- **Precision controls**: Numeric parameters accept custom typed values rather than restricting users to presets, including `0.1x–16x` speed with pitch preservation and independent width/height pixel resizing.

## Workspaces & Tools

### Multitrack & Dedicated Studios
- **Video Studio** (`/studio/video`): Multitrack timeline editor supporting video, image, audio, text, and caption tracks, keyframe animation, speed control, snapping, zoom, and local export.
- **Audio Studio** (`/studio/audio`): Multitrack audio editor with per-track waveforms, track gain/mute/solo, master level control, split, trim, remove left/right, join, duplicate, fades, `0.1x–16x` speed with pitch preservation, and WAV export.
- **Image Studio** (`/studio/image`): Layer-capable local image workspace.

### Standalone Tools (`/tools`)
- **Image** (`/tools/image`): Editor, Resize, Downscale, Upscale, Collage, Crop.
- **Audio** (`/tools/audio`): Trim, Speed, Merge, Split, Noise Gate, Vocal Reducer, Volume, Normalize, Transcribe (local speech-to-text).
- **Video** (`/tools/video`): Trim, Extract Audio, Speed, Remove Audio, Replace Audio, Image to Video.

### Local Data
- **Projects** (`/projects`): Manage saved on-device projects.
- **Storage Settings** (`/settings/storage`): Inspect and manage browser storage (OPFS / IndexedDB) and cached assets.

## Tech Stack

- **Framework**: React 19, React Router 8 (Framework Mode, static pre-rendering), TypeScript, Vite 8, Tailwind CSS 4
- **Media & DSP**: WebCodecs (`mediabunny`), Web Audio API & AudioWorklets, `bungee-web` (time-stretching & pitch preservation), `fflate`
- **On-device AI**: `onnxruntime-web` and `@huggingface/transformers` running in Web Workers
- **Offline & Packaging**: Custom static output verification and service worker build scripts (`scripts/build-service-worker.mjs`, `scripts/verify-static-output.mjs`)

## Local Development

### Prerequisites
- Node.js 24 LTS
- npm (used with `package-lock.json`)

### Setup & Commands

```bash
npm ci
npm run dev
```

Available scripts:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local Vite / React Router development server |
| `npm run typecheck` | Generate React Router types and run `tsc` |
| `npm run test:core` | Run the core Node test suite (`tests/*.test.mjs`) |
| `npm run build` | Build client/server static output, generate the service worker, and verify routes |
| `npm run preview` | Preview the production build locally |

Serve the generated `build/client` output over HTTPS (or `localhost`) to test PWA installation and service worker caching.

## Repository Structure

```text
app/
  components/    Studio and shared UI components
  lib/           Timeline engines, media codecs, storage, and capability detection
  routes/        Pre-rendered public routes and studio/tool pages
  workers/       Web Workers for audio DSP, image effects, and on-device inference
public/          Static assets, icons, and web app manifest
scripts/         Service worker generator and static build verifier
tests/           Unit tests for timeline math, snapping, keyframes, speed, and formats
project_research/ Architecture specifications, roadmap, and engineering decisions
WORK_LOG.md      Sequential log of completed milestones
```

## Documentation

Product specifications, architecture decisions, and testing gates are maintained in [`project_research/`](project_research/README.md):

- [Implementation Roadmap](project_research/docs/07-implementation-roadmap.md)
- [Test and Release Plan](project_research/docs/08-test-and-release-plan.md)
- [Decisions and Sources](project_research/docs/10-decisions-and-sources.md)
