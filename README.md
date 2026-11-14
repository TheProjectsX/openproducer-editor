# Local Studio — implementation handoff

Local Studio is the working name for an installable, offline-first web application for editing audio, video, and images. All user media is processed on the device. Production hosting serves static files; it does not receive media or run editing jobs.

**Status:** specification and research handoff. No application code has been created. The next agent should begin with the feasibility work in [docs/07-implementation-roadmap.md](docs/07-implementation-roadmap.md), then implement milestones in order.

## Read in this order

1. [Product and brand](docs/01-product-and-brand.md): audience, workflows, names, and presentation.
2. [Feature matrix](docs/02-feature-matrix.md): committed tools and release boundaries.
3. [Technology and architecture](docs/03-technology-and-architecture.md): chosen stack and module boundaries.
4. [Routes, SEO, and PWA](docs/04-routes-seo-and-pwa.md): static routing and offline behavior.
5. [Project data and media pipelines](docs/05-project-data-and-media-pipelines.md): storage and processing contracts.
6. [Editor interactions](docs/06-editor-interactions.md): exact behavior of controls and editors.
7. [Implementation roadmap](docs/07-implementation-roadmap.md): step-by-step work orders.
8. [Test and release plan](docs/08-test-and-release-plan.md): acceptance fixtures and gates.
9. [Packaging, licenses, and risks](docs/09-packaging-licenses-and-risks.md): packages, distribution, and constraints.
10. [Decisions and sources](docs/10-decisions-and-sources.md): settled decisions and research links.
11. [Design and accessibility](docs/11-design-and-accessibility.md): layout, visual rules, keyboard use, and responsive behavior.

## Product commitments

- Desktop-first, responsive PWA; current Chrome and Edge desktop are the full editor target.
- Public home, category, and tool pages are pre-rendered for direct navigation and SEO. Editors are client-side and local.
- Audio: split, merge, trim, cleanup, and arbitrary decimal speed control, with vocal removal in the downloaded AI release.
- Video: a basic CapCut-like multitrack timeline, including clips, overlays, text, audio, transitions, keyframes, filters, custom speed, and export.
- Image: editing, collage, exact pixel resizing, and downloaded AI upscaling.
- Every adjustable number has a typed custom input. Presets are shortcuts.
- Local editable projects survive refresh; original source files remain unchanged.
- Core tools work offline after installation. AI tools work offline after their model downloads finish.

## First engineering task

Create the project scaffold and run the vertical feasibility prototypes in roadmap milestone M0. Do not build the complete UI before proving multitrack export, pitch-preserved custom speed, exact pixel resize, and tiled browser upscaling. Record the results in the decision log and derive supported file limits from measurements.

## Repo layout to create

```text
app/                 React Router routes, shell, editors, and UI
packages/media-core/ shared capability checks, jobs, timing, and export contracts
packages/audio/      audio operations and time stretching
packages/video/      timeline renderer and video export
packages/image/      image operations and collage document
packages/projects/   OPFS and IndexedDB persistence, migrations
public/              manifest, icons, headers, and local engine assets
tests/               unit, media fixture, browser, and offline tests
docs/                durable product and technical specifications
```

Use one pnpm workspace and one static web deployment. Package boundaries are for code ownership and testing, not separate services. The repository should contain no uploaded example user media; use small, redistributable fixtures under `tests/fixtures/`.
