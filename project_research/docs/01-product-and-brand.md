# Product and brand

## Goal and audience

Local Studio is a private, offline-capable media editor for everyday creators who need quick tools and a capable, approachable video timeline. The product should be understandable without editing jargon while still allowing exact values. Users import local files, edit them, save local projects, and download finished exports. No sign-in is needed.

The first release prioritizes desktop editing. Mobile layouts must allow browsing, import, and only the operations proven viable on mobile devices. The UI must not imply that every desktop operation will work on every phone.

## Navigation and journeys

Top navigation: **Home · Audio · Video · Image · Projects**. Home puts exactly three media category cards near the top, then the separate Creative Studio entry, then the privacy/offline explanation and other supporting information. Each category page lists only tools for that media type. The Projects page lists local projects with open, duplicate, delete, and storage actions.

Core journeys:

1. Open a tool page from search → understand input/output and offline status → launch the editor → import → adjust → preview → export or save.
2. Install the app → go offline → reopen a local project → edit and export without a connection.
3. Open Video Studio → import media → arrange tracks → add text and transitions → adjust custom speed/keyframes → preview → export.
4. Open Image Resize → enter exact width and height → optionally match aspect ratio → preview → export. AI Upscale is a separate on-device Real-ESRGAN tool with bundled model assets.
5. Open Vocal Reducer → adjust the stereo center cancellation → preview locally → export. It is a quick stereo effect, not AI stem separation.

## Visual direction

Use a clean, calm workspace with a dark charcoal base and restrained navy/blue surfaces, clear contrast, focused previews, compact grouped controls, visible units, and animated progress states. Use Ubuntu for interface text and locally bundled Inter for headings and display text. Keep the site dark from marketing pages through the editors. Put the three category cards near the top of Home and place supporting product information below them. Category pages list only their own media tools. Use a clear editorial hierarchy with concise tool descriptions and grouped utility families; avoid duplicate grids and excess empty canvas. Avoid a visual clone of CapCut or reliance on its logos, assets, or proprietary effects; reproduce familiar editing patterns with our own layout and controls.

## Name candidates

**Working name: Local Studio.** It describes the offline/local behavior and is used throughout these documents. Other candidates: MediaDock, ClipCanvas, FrameNest, EditHarbor, PixelWave, TriMedia Studio, and CraftFrame. These are brainstorming candidates, not availability or trademark claims. Before publishing, check domain, app-store/PWA name conflicts, and trademark use; then replace the working name consistently in the manifest, metadata, icons, and docs.

## Distribution package

The deliverable is a static HTTPS site and installable PWA, not a native installer. Provide a web manifest with name, short name, description, theme/background colors, start URL, standalone display, and 192/512-pixel icons. Provide maskable icons and desktop/mobile screenshots where supported. Install messaging must explain that core features and the bundled upscaler model are cached after initial installation; no model download service is required. The app's About/Storage screen lists installed models, size, and version.

## Product boundaries

No account, cloud library, collaboration, media upload, server processing, licensed stock assets, or promise of unlimited file size. Auto captions, background removal, full CapCut feature parity, and complex motion graphics are later candidates. The committed video timeline is defined in the feature matrix and editor interaction document.
