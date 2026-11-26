import { useEffect, useState } from "react";
import { NavBackButton } from "./nav-back-button";

export type ToolCategory = "audio" | "video" | "image";

export interface ToolSpecimen {
  code: string;
  category: ToolCategory;
  title: string;
  description: string;
  spec: string;
  href: string;
}

export function ToolIcon({ code }: { code: string }) {
  switch (code) {
    case "A-01": // Trim audio
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 4v16M18 4v16M9 12h6M10 9v6M14 8v8" />
        </svg>
      );
    case "A-02": // Merge audio
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h6l3 5-3 5H4M13 12h7M17 9l3 3-3 3" />
        </svg>
      );
    case "A-03": // Split audio
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v18M4 9h5v6H4zM15 9h5v6h-5z" />
        </svg>
      );
    case "A-04": // Volume and fades
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 10h4l5-4v12l-5-4H4z" />
          <path d="M16.5 9a4.5 4.5 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" />
        </svg>
      );
    case "A-05": // Change audio speed
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 15a8 8 0 1 1 16 0" />
          <path d="M12 15l4-4" />
          <circle cx="12" cy="15" r="1.5" />
        </svg>
      );
    case "A-06": // Voice to transcript
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="5" height="9" rx="2.5" />
          <path d="M6.5 13v4M12 7h8M12 12h8M12 17h5" />
        </svg>
      );
    case "A-07": // Reduce background noise
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 16h18M5 12v7M9 7v12M13 10v9M17 14v5M21 15v4" />
        </svg>
      );
    case "A-08": // Normalize audio
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18M5 18V9M9 18V7M13 18v-8M17 18V7M21 18v-6" />
        </svg>
      );
    case "A-09": // Reduce centered vocals
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9" y="3" width="6" height="10" rx="3" />
          <path d="M6 11a6 6 0 0 0 12 0M12 17v4M4 4l16 16" />
        </svg>
      );
    case "A-00": // Audio studio
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 4v16M12 4v16M18 4v16" />
          <path d="M4 9h4M10 15h4M16 7h4" />
        </svg>
      );
    case "V-01": // Trim video
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M9 5v14M15 5v14" />
        </svg>
      );
    case "V-02": // Change video speed
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7l6 5-6 5V7zM13 7l6 5-6 5V7z" />
        </svg>
      );
    case "V-03": // Extract video audio
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="6" width="11" height="12" rx="2" />
          <path d="M17 10v4M20 8v8M14 12h2" />
        </svg>
      );
    case "V-04": // Remove video audio
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 10h4l5-4v12l-5-4H4z" />
          <path d="M16 9l5 6M21 9l-5 6" />
        </svg>
      );
    case "V-05": // Replace video audio
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8h13l-2.5-2.5M20 16H7l2.5 2.5" />
          <path d="M10 12h4" />
        </svg>
      );
    case "V-00": // Video studio
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18M9 10v9" />
        </svg>
      );
    case "V-06": // Image to video
    case "I-06": // Image to video
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="6" width="14" height="12" rx="2" />
          <path d="M9 9.5l4.5 2.5-4.5 2.5zM20 8v8" />
        </svg>
      );
    case "I-00": // Image editor
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4l8 4.5-8 4.5-8-4.5z" />
          <path d="M4 12.5l8 4.5 8-4.5M4 16.5l8 4.5 8-4.5" />
        </svg>
      );
    case "I-01": // Crop image
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3v14a1 1 0 0 0 1 1h14" />
          <path d="M3 6h14a1 1 0 0 1 1 1v14" />
        </svg>
      );
    case "I-02": // Resize pixels
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M9 15l6-6M11 9h4v4" />
        </svg>
      );
    case "I-03": // Downscale image
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="4" y="12" width="8" height="8" rx="1" />
          <path d="M16 8l-4 4m0-3v3h3" />
        </svg>
      );
    case "I-04": // Upscale image
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="12" width="8" height="8" rx="1" />
          <path d="M4 9V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
          <path d="M12 12l5-5m-4 0h4v4" />
        </svg>
      );
    case "I-05": // Make a collage
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M12 4v16M12 12h8" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
      );
  }
}

export const ALL_TOOLS: readonly ToolSpecimen[] = [
  {
    code: "A-01",
    category: "audio",
    title: "Trim audio",
    description: "Keep or remove a section with start and end controls, then export a WAV file.",
    spec: "WAV · Keep / Remove",
    href: "/tools/audio/trim",
  },
  {
    code: "A-02",
    category: "audio",
    title: "Merge audio",
    description: "Order multiple clips, set a custom silence gap, and render one WAV.",
    spec: "Multi-file · Custom gap",
    href: "/tools/audio/merge",
  },
  {
    code: "A-03",
    category: "audio",
    title: "Split audio",
    description: "Place exact split markers on the waveform and download each segment.",
    spec: "WAV segments · Marker list",
    href: "/tools/audio/split",
  },
  {
    code: "A-04",
    category: "audio",
    title: "Volume and fades",
    description: "Adjust gain in dB and shape fade-in and fade-out durations.",
    spec: "Gain dB · Fade in/out",
    href: "/tools/audio/volume",
  },
  {
    code: "A-05",
    category: "audio",
    title: "Change audio speed",
    description: "Set a custom playback rate with pitch-preserving processing enabled by default.",
    spec: "0.1× – 16× · Pitch preserved",
    href: "/tools/audio/speed",
  },
  {
    code: "A-06",
    category: "audio",
    title: "Voice to transcript",
    description: "Transcribe audio, video, or mic recordings locally with Whisper Base.",
    spec: "Whisper Base · SRT / VTT / TXT",
    href: "/tools/audio/transcribe",
  },
  {
    code: "A-07",
    category: "audio",
    title: "Reduce background noise",
    description: "Sample a quiet noise floor section and attenuate matching frequencies locally.",
    spec: "Noise gate · Local worker",
    href: "/tools/audio/noise-gate",
  },
  {
    code: "A-08",
    category: "audio",
    title: "Normalize audio",
    description: "Target a custom peak dB level and preview the normalized waveform locally.",
    spec: "Custom peak dB · Worker",
    href: "/tools/audio/normalize",
  },
  {
    code: "A-09",
    category: "audio",
    title: "Reduce centered vocals",
    description: "Apply an adjustable stereo center-cancellation filter to stereo tracks.",
    spec: "Stereo phase · Adjustable",
    href: "/tools/audio/vocal-reducer",
  },
  {
    code: "V-01",
    category: "video",
    title: "Trim video",
    description: "Keep or remove a time range on the timeline and export a local MP4.",
    spec: "MP4 · Keep / Remove",
    href: "/tools/video/trim",
  },
  {
    code: "V-02",
    category: "video",
    title: "Change video speed",
    description: "Set any supported custom playback rate between 0.1× and 16×.",
    spec: "0.1× – 16× · Audio/Video",
    href: "/tools/video/speed",
  },
  {
    code: "V-03",
    category: "video",
    title: "Extract video audio",
    description: "Separate the primary audio stream from a video and save as WAV.",
    spec: "WAV · Audio extraction",
    href: "/tools/video/extract-audio",
  },
  {
    code: "V-04",
    category: "video",
    title: "Remove video audio",
    description: "Strip the audio track and export a muted copy of the video.",
    spec: "Muted export · Local",
    href: "/tools/video/remove-audio",
  },
  {
    code: "V-05",
    category: "video",
    title: "Replace video audio",
    description: "Mix or swap local audio tracks against a video timeline.",
    spec: "Track mix · Gain control",
    href: "/tools/video/replace-audio",
  },
  {
    code: "V-06",
    category: "video",
    title: "Image to video",
    description: "Animate one or more images with keyframes, motion presets, and audio.",
    spec: "Keyframes · MP4 / WebM",
    href: "/tools/video/image-to-video",
  },
  {
    code: "I-01",
    category: "image",
    title: "Crop image",
    description: "Define a crop rectangle directly in source-image pixel coordinates.",
    spec: "Pixel coords · Aspect presets",
    href: "/tools/image/crop",
  },
  {
    code: "I-02",
    category: "image",
    title: "Resize pixels",
    description: "Set independent exact width and height in pixels, with optional aspect lock.",
    spec: "Exact W × H px · Stretch/Ratio",
    href: "/tools/image/resize",
  },
  {
    code: "I-03",
    category: "image",
    title: "Downscale image",
    description: "Scale down by a custom percentage or factor while preserving proportions.",
    spec: "Custom % · Ratio locked",
    href: "/tools/image/downscale",
  },
  {
    code: "I-04",
    category: "image",
    title: "Upscale image",
    description: "Enlarge images on-device using bundled Real-ESRGAN neural upscaling.",
    spec: "Real-ESRGAN · On-device AI",
    href: "/tools/image/upscale",
  },
  {
    code: "I-05",
    category: "image",
    title: "Make a collage",
    description: "Arrange multiple images into editable grid layouts with custom spacing and text.",
    spec: "Grid layouts · Layer text",
    href: "/tools/image/collage",
  },
  {
    code: "I-06",
    category: "image",
    title: "Image to video",
    description: "Turn still images into animated video clips with keyframes and audio.",
    spec: "Keyframes · MP4 / WebM",
    href: "/tools/video/image-to-video",
  },
] as const;

const CATEGORY_META: Record<
  ToolCategory,
  { label: string; title: string; description: string; count: number }
> = {
  audio: {
    label: "AUDIO CATALOGUE",
    title: "Audio editing tools.",
    description:
      "Nine browser-based tools for trimming, merging, splitting, volume, speed, transcription, noise reduction, and normalization.",
    count: 9,
  },
  video: {
    label: "VIDEO CATALOGUE",
    title: "Video editing tools.",
    description:
      "Six focused video utilities for trimming, speed changes, audio extraction/mixing, and keyframe animation.",
    count: 6,
  },
  image: {
    label: "IMAGE CATALOGUE",
    title: "Image editing tools.",
    description:
      "Six local image tools covering pixel crop, exact pixel resize, downscaling, Real-ESRGAN upscaling, collages, and image animation.",
    count: 6,
  },
};

export function ToolDirectory({ category }: { category?: ToolCategory }) {
  const [selectedCategory, setSelectedCategory] = useState<"all" | ToolCategory>(category ?? "all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setSelectedCategory(category ?? "all");
  }, [category]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleTools = ALL_TOOLS.filter((tool) => {
    if (selectedCategory !== "all" && tool.category !== selectedCategory) return false;
    if (!normalizedQuery) return true;
    return (
      tool.title.toLowerCase().includes(normalizedQuery) ||
      tool.description.toLowerCase().includes(normalizedQuery) ||
      tool.spec.toLowerCase().includes(normalizedQuery) ||
      tool.code.toLowerCase().includes(normalizedQuery)
    );
  });

  const activeMeta = category ? CATEGORY_META[category] : null;

  return (
    <div className="catalog-page">
      <header className="site-header">
        <div className="wrap header-wrap">
          <div className="brand-with-back">
            <NavBackButton fallback={category ? "/tools" : "/"} />
            <a href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">L</span>
              <span>OpenProducer Editor</span>
            </a>
          </div>
          <nav className="site-nav" aria-label="Main navigation">
            <a href="/tools" aria-current={!category ? "page" : undefined}>Tools</a>
            <a href="/tools/audio" aria-current={category === "audio" ? "page" : undefined}>Audio</a>
            <a href="/tools/video" aria-current={category === "video" ? "page" : undefined}>Video</a>
            <a href="/tools/image" aria-current={category === "image" ? "page" : undefined}>Image</a>
            <a href="/projects">Projects</a>
          </nav>
          <a className="header-cta" href="/studio/video">
            Open Video Studio
          </a>
        </div>
      </header>

      <main>
        <section className="catalog-hero-section">
          <div className="wrap">
            {category && (
              <a className="catalog-back" href="/tools">
                ← All {ALL_TOOLS.length} tools
              </a>
            )}
            <p className="hero-kicker">
              <span className="status-dot" aria-hidden="true" />
              {activeMeta ? activeMeta.label : `SPECIMEN CATALOGUE · ${ALL_TOOLS.length} QUICK TOOLS`}
            </p>
            <h1>{activeMeta ? activeMeta.title : "Browser tools for audio, video, and images."}</h1>
            <p className="catalog-lead">
              {activeMeta
                ? activeMeta.description
                : "Filter by media type or search by operation. Every tool runs on your device without uploads."}
            </p>

            <div className="catalog-toolbar">
              <div className="catalog-filters" role="group" aria-label="Filter tools by media type">
                <button
                  type="button"
                  className={selectedCategory === "all" ? "catalog-filter is-active" : "catalog-filter"}
                  onClick={() => setSelectedCategory("all")}
                >
                  All <span>{ALL_TOOLS.length}</span>
                </button>
                <button
                  type="button"
                  className={selectedCategory === "audio" ? "catalog-filter is-active" : "catalog-filter"}
                  onClick={() => setSelectedCategory("audio")}
                >
                  Audio <span>{CATEGORY_META.audio.count}</span>
                </button>
                <button
                  type="button"
                  className={selectedCategory === "video" ? "catalog-filter is-active" : "catalog-filter"}
                  onClick={() => setSelectedCategory("video")}
                >
                  Video <span>{CATEGORY_META.video.count}</span>
                </button>
                <button
                  type="button"
                  className={selectedCategory === "image" ? "catalog-filter is-active" : "catalog-filter"}
                  onClick={() => setSelectedCategory("image")}
                >
                  Image <span>{CATEGORY_META.image.count}</span>
                </button>
              </div>

              <label className="catalog-search-field">
                <span className="visually-hidden">Filter tools by name or format</span>
                <input
                  type="search"
                  placeholder="Filter by tool, format, or unit..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="catalog-list-section" aria-label="Tool specimen catalogue">
          <div className="wrap">
            <div className="catalog-section-head">
              <span>STUDIOS &amp; FULL EDITORS</span>
              <span>03 WORKSPACES</span>
            </div>

            <div className="studio-strip catalog-studio-strip" aria-label="Full studio workspaces">
              <a className="studio-strip-card" href="/studio/video">
                <span className="studio-strip-badge">MULTITRACK</span>
                <div>
                  <strong>Video Studio</strong>
                  <span>Timeline editing for video, audio, images, text, and keyframes</span>
                </div>
                <span className="studio-strip-arrow" aria-hidden="true">↗</span>
              </a>
              <a className="studio-strip-card" href="/tools/image/editor">
                <span className="studio-strip-badge">LAYERS</span>
                <div>
                  <strong>Image Editor</strong>
                  <span>Layer-based canvas with shapes, text, and effects</span>
                </div>
                <span className="studio-strip-arrow" aria-hidden="true">↗</span>
              </a>
              <a className="studio-strip-card" href="/studio/audio">
                <span className="studio-strip-badge">MULTITRACK</span>
                <div>
                  <strong>Audio Studio</strong>
                  <span>Multi-track audio mixing and WAV export</span>
                </div>
                <span className="studio-strip-arrow" aria-hidden="true">↗</span>
              </a>
            </div>

            <div className="catalog-section-head">
              <span>
                {selectedCategory === "all"
                  ? "QUICK TOOLS"
                  : `${selectedCategory.toUpperCase()} QUICK TOOLS`}
              </span>
              <span>{String(visibleTools.length).padStart(2, "0")} SHOWN</span>
            </div>

            {visibleTools.length > 0 ? (
              <div className="specimen-grid">
                {visibleTools.map((tool) => (
                  <a className={`specimen-card tone-${tool.category}`} href={tool.href} key={tool.code}>
                    <div className="specimen-card-top">
                      <span className="specimen-id-group">
                        <span className="specimen-icon">
                          <ToolIcon code={tool.code} />
                        </span>
                        <span className="specimen-code">{tool.code}</span>
                      </span>
                      <span className="specimen-domain">{tool.category.toUpperCase()}</span>
                    </div>
                    <h2>{tool.title}</h2>
                    <p>{tool.description}</p>
                    <div className="specimen-card-foot">
                      <span>{tool.spec}</span>
                      <span aria-hidden="true">↗</span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="catalog-empty">
                <p>No tools match “{query}”.</p>
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => {
                    setSelectedCategory("all");
                    setQuery("");
                  }}
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="wrap footer-wrap">
          <div className="footer-brand">
            <strong>OPENPRODUCER EDITOR</strong>
            <span>Browser-based audio, video, and image editing.</span>
          </div>
          <nav className="footer-links" aria-label="Footer navigation">
            <a href="/">Home</a>
            <a href="/tools/audio">Audio</a>
            <a href="/tools/video">Video</a>
            <a href="/tools/image">Image</a>
            <a href="/projects">Projects</a>
            <a href="/settings/storage">Storage</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
