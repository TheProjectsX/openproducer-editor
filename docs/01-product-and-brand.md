# Product and brand

## Goal and audience

Local Studio is a private, offline-capable media editor for everyday creators who need quick tools and a capable, approachable video timeline. The product should be understandable without editing jargon while still allowing exact values. Users import local files, edit them, save local projects, and download finished exports. No sign-in is needed.

The first release prioritizes desktop editing. Mobile layouts must allow browsing, import, and only the operations proven viable on mobile devices. The UI must not imply that every desktop operation will work on every phone.

## Navigation and journeys

Top navigation: **Home · Audio · Video · Image · Projects**. The home page provides a short privacy/offline explanation, recent local projects, and tool cards. Each category page groups tools by task and leads to an editor with an imported file or new project. The Projects page lists local projects with open, duplicate, delete, and storage actions.

Core journeys:

1. Open a tool page from search → understand input/output and offline status → launch the editor → import → adjust → preview → export or save.
2. Install the app → go offline → reopen a local project → edit and export without a connection.
3. Open Video Studio → import media → arrange tracks → add text and transitions → adjust custom speed/keyframes → preview → export.
4. Open Image Resize → enter exact width and height → optionally match aspect ratio → compare → export. AI Upscale is a separate tool with a one-time model download.
5. Open Vocal Remover → download the model once → extract vocal and instrumental tracks locally → export either or both.

## Visual direction

Use a clean, calm workspace: dark neutral editing canvas, clear contrast, large preview, compact tool panels, visible units, and strong progress states. Public pages can use a lighter presentation while sharing brand colors and typography. Avoid a visual clone of CapCut or reliance on its logos, assets, or proprietary effects.

## Name candidates

**Working name: Local Studio.** It describes the offline/local behavior and is used throughout these documents. Other candidates: MediaDock, ClipCanvas, FrameNest, EditHarbor, PixelWave, TriMedia Studio, and CraftFrame. These are brainstorming candidates, not availability or trademark claims. Before publishing, check domain, app-store/PWA name conflicts, and trademark use; then replace the working name consistently in the manifest, metadata, icons, and docs.

## Distribution package

The deliverable is a static HTTPS site and installable PWA, not a native installer. Provide a web manifest with name, short name, description, theme/background colors, start URL, standalone display, and 192/512-pixel icons. Provide maskable icons and desktop/mobile screenshots where supported. Install messaging must explain that core features work offline after initial loading and optional AI tools need a separate download. The app's About/Storage screen lists installed models, size, version, and removal control.

## Product boundaries

No account, cloud library, collaboration, media upload, server processing, licensed stock assets, or promise of unlimited file size. Auto captions, background removal, full CapCut feature parity, and complex motion graphics are later candidates. The committed video timeline is defined in the feature matrix and editor interaction document.
