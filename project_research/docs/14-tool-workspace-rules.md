# Split-Section Tool Workspace Rules (Audio & Image Tools)

These rules govern all standalone **Audio** and **Image** tool pages once a file is loaded (`.has-media`). The three multitrack studios (`/studio/video`, `/studio/audio`, `/tools/image/editor`) are separate full-studio workspaces and are excluded from this specification.

## 1. Viewport & Overflow Rule
- **No full-page overflow on desktop (`> 900px`):** `.has-media` locks the page shell to `height: 100dvh; overflow: hidden; display: flex; flex-direction: column;`.
- Once media is loaded, the pre-import `.resize-intro` banner is hidden; the header (`ToolPageHeader`) and breadcrumbs already identify the active tool and status.
- Mobile / narrow screens (`<= 900px`) stack the controls and preview cleanly and restore natural scrolling (`height: auto; overflow: visible;`).

## 2. Split-Section Layout
- **Two-column grid (`flex: 1; min-height: 0;`):**
  - **Left column (Controls — `minmax(290px, 340px)`):** Holds all movable/editable controls, file switcher, numeric inputs with units, mode toggles, output summary, and export action. Scrolls internally (`overflow-y: auto`) if controls exceed viewport height; never pushes the page to scroll.
  - **Right column (Preview Canvas — `minmax(0, 1fr)`):** Takes the maximum remaining width and full remaining height (`height: 100%; min-height: 0; display: flex; flex-direction: column;`).

## 3. Right-Side Preview Canvas Rules
- **Header & basic meta:** Top bar inside the preview panel shows the stage title and basic media metadata (e.g., duration, sample rate, channels, pixel dimensions, or active selection range).
- **Direct on-canvas tools:** Interactive operations that belong on the media itself live directly on the canvas:
  - **Audio tools:** Interactive `<canvas>` waveform (drag-to-trim selection handles, split markers, fade ranges, or live decoded waveform) + custom Play/Pause and scrub transport bar. Never use a static music-note placeholder or raw `<audio controls>`.
  - **Image tools:** Interactive `<canvas>` stage (drag-to-crop handles, resize preview, before/after comparison, checkerboard transparency background) + zoom/dimension readout.

## 4. Domain Tokens
- **Audio tools (`.audio-tool-page`):** `--tone: var(--cyan)` (`#5ed4d5`).
- **Image tools (`.image-tool-page`):** `--tone: var(--green)` (`#62d7b0`).
- **Shared surfaces:** `--bg: #090d18`, `--surface: #101726`, `--surface-raised: #151f31`, `--line: #27364e`, `--line-soft: #1d2a3d`.

## 5. Pre-Import Front Page (`!has-media`)
- Before a file is loaded, every tool uses the 2-column `.wrap` grid (`ToolPageHeader` + `.resize-intro` on the left, `MediaImportScreen` on the right) with `←` returning to the previous route, and `←` inside `.has-media` returning to the tool's own "Add file" screen.
