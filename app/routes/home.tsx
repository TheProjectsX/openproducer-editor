import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router";
import type { Route } from "./+types/home";
import { ALL_TOOLS, ToolIcon, type ToolSpecimen } from "../components/tool-directory";
import { BrandMark } from "../components/brand-mark";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "OpenProducer Editor | Browser media editor for audio, video, and images" },
    {
      name: "description",
      content:
        "24 browser-based tools and multitrack studios for audio, video, and image editing. All processing and project storage stay on your device.",
    },
  ];
}

type HeroMode = "audio" | "video" | "image";

const workspaces = [
  {
    key: "audio",
    code: "01",
    title: "Audio tools",
    count: "10 tools",
    formats: "WAV · MP3 · M4A · OGG",
    description:
      "Trim, split, merge, normalize, gate background noise, adjust speed from 0.1× to 16×, and transcribe speech locally.",
    href: "/tools/audio",
  },
  {
    key: "video",
    code: "02",
    title: "Video tools",
    count: "6 tools + Studio",
    formats: "MP4 · WebM · MOV",
    description:
      "Trim clips, change playback speed, extract or replace audio tracks, animate images with keyframes, and edit on a multitrack timeline.",
    href: "/tools/video",
  },
  {
    key: "image",
    code: "03",
    title: "Image tools",
    count: "8 tools",
    formats: "PNG · JPEG · WebP",
    description:
      "Resize to exact pixel dimensions, downscale by percentage, crop in source pixels, build collages, edit layers, and upscale locally.",
    href: "/tools/image",
  },
] as const;

const studios = [
  {
    title: "Video Studio",
    detail: "Multitrack timeline, keyframes, text overlays, transitions, and local export",
    href: "/studio/video",
    badge: "MULTITRACK",
  },
  {
    title: "Audio Studio",
    detail: "Layered audio tracks, waveform editing, and WAV mixdown",
    href: "/studio/audio",
    badge: "MULTITRACK",
  },
  {
    title: "Image Editor",
    detail: "Multi-layer canvas, shapes, effects, and non-destructive adjustments",
    href: "/tools/image/editor",
    badge: "LAYERS",
  },
] as const;

const specimens = [
  {
    code: "A-02",
    domain: "audio",
    title: "Change audio speed",
    spec: "0.1× – 16× · Pitch preserved",
    description: "Type any custom playback rate with pitch preservation enabled by default.",
    href: "/tools/audio/speed",
  },
  {
    code: "A-09",
    domain: "audio",
    title: "Voice to transcript",
    spec: "Whisper Base · On-device",
    description: "Transcribe audio files, video tracks, or mic recordings locally without upload.",
    href: "/tools/audio/transcribe",
  },
  {
    code: "V-03",
    domain: "video",
    title: "Change video speed",
    spec: "0.1× – 16× · MP4 / WebM",
    description: "Retime video and audio together using custom numeric rates.",
    href: "/tools/video/speed",
  },
  {
    code: "V-06",
    domain: "video",
    title: "Image to video",
    spec: "Keyframes · Audio mix",
    description: "Animate still images with pan, zoom, and motion keyframes into video.",
    href: "/tools/video/image-to-video",
  },
  {
    code: "I-02",
    domain: "image",
    title: "Resize pixels",
    spec: "Exact W × H · Optional ratio",
    description: "Set independent pixel width and height, with aspect-ratio lock as an option.",
    href: "/tools/image/resize",
  },
  {
    code: "I-04",
    domain: "image",
    title: "Upscale image",
    spec: "Real-ESRGAN · Bundled model",
    description: "Enlarge low-resolution images on-device using cached neural weights.",
    href: "/tools/image/upscale",
  },
] as const;

const architectureFacts = [
  {
    label: "PROCESSING",
    title: "Web Workers & WebCodecs",
    detail:
      "Heavy decoding, resampling, and rendering run in background workers with progress reporting and cancellation.",
  },
  {
    label: "STORAGE",
    title: "IndexedDB & local projects",
    detail:
      "Save versioned edits and asset references in browser storage. Manage quota and cached AI models anytime.",
  },
  {
    label: "COMPATIBILITY",
    title: "Offline PWA & codec detection",
    detail:
      "Installable for offline use. Video export formats adapt to the codecs your browser supports via capability checks.",
  },
] as const;

const waveformBars = [28, 46, 64, 88, 52, 74, 92, 60, 42, 78, 95, 66, 48, 84, 70, 38, 62, 86, 54, 40];

const SEARCHABLE_TOOLS: readonly ToolSpecimen[] = [
  {
    code: "V-00",
    category: "video",
    title: "Video Studio",
    description: "Multitrack timeline editor for video, audio, images, text overlays, keyframes, and transitions.",
    spec: "Multitrack · MP4 / WebM",
    href: "/studio/video",
  },
  {
    code: "I-00",
    category: "image",
    title: "Image Editor",
    description: "Create or edit multi-layer canvases with shapes, text, and non-destructive effects.",
    spec: "Layers · PNG / JPEG / WebP",
    href: "/tools/image/editor",
  },
  {
    code: "A-00",
    category: "audio",
    title: "Audio Studio",
    description: "Open the multitrack audio workspace for layered clips and mixdowns.",
    spec: "Multitrack · WAV export",
    href: "/studio/audio",
  },
  ...ALL_TOOLS,
];

function scoreToolMatch(tool: ToolSpecimen, rawQuery: string): number {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return 1;
  const title = tool.title.toLowerCase();
  const desc = tool.description.toLowerCase();
  const spec = tool.spec.toLowerCase();
  const cat = tool.category.toLowerCase();
  const code = tool.code.toLowerCase();

  let score = 0;
  if (title === q) score += 200;
  else if (title.startsWith(q)) score += 120;
  else if (title.includes(q)) score += 80;

  if (code === q || code.includes(q)) score += 60;
  if (cat === q || cat.startsWith(q)) score += 50;
  if (spec.includes(q)) score += 45;
  if (desc.includes(q)) score += 35;

  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    let matchedWords = 0;
    for (const w of words) {
      if (title.includes(w)) {
        score += 30;
        matchedWords += 1;
      } else if (desc.includes(w) || spec.includes(w) || cat.includes(w)) {
        score += 15;
        matchedWords += 1;
      }
    }
    if (matchedWords === words.length) score += 40;
  }

  return score;
}

export default function Home() {
  const navigate = useNavigate();
  const [heroMode, setHeroMode] = useState<HeroMode>("video");
  const [sampleSpeed, setSampleSpeed] = useState(1.25);
  const [sampleWidth, setSampleWidth] = useState(1920);
  const [sampleHeight, setSampleHeight] = useState(1080);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return SEARCHABLE_TOOLS.slice(0, 8);
    return SEARCHABLE_TOOLS
      .map((tool) => ({ tool, score: scoreToolMatch(tool, q) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.tool);
  }, [searchQuery]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    const onGlobalKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, []);

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % searchResults.length);
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
      }
    } else if (event.key === "Enter") {
      const target = searchResults[selectedIndex] ?? searchResults[0];
      if (target) {
        event.preventDefault();
        setSearchOpen(false);
        navigate(target.href);
      }
    }
  }

  return (
    <div className="marketing-page">
      <header className="site-header">
        <div className="wrap header-wrap">
          <Link to="/" className="brand">
            <BrandMark />
            <span>OpenProducer Editor</span>
          </Link>
          <nav className="site-nav" aria-label="Main navigation">
            <Link to="/tools">Tools</Link>
            <Link to="/tools/audio">Audio</Link>
            <Link to="/tools/video">Video</Link>
            <Link to="/tools/image">Image</Link>
            <Link to="/projects">Projects</Link>
          </nav>
          <div className="header-actions">
            <button
              type="button"
              className="header-search-btn"
              onClick={() => setSearchOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <span>Search</span>
            </button>
            <Link className="header-cta" to="/studio/video">
              Open Video Studio
            </Link>
          </div>
        </div>
      </header>

      {searchOpen && (
        <div
          className="search-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSearchOpen(false);
          }}
        >
          <div
            className="search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Search tools"
          >
            <div className="search-modal-input-row">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={searchInputRef}
                type="search"
                placeholder="Search tools by name or description (e.g. trim, 16x, whisper, crop)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                aria-label="Search tools by name or description"
              />
              <button
                type="button"
                className="search-modal-close"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
              >
                Esc
              </button>
            </div>

            <div className="search-modal-results" role="listbox" aria-label="Matching tools">
              {searchResults.length > 0 ? (
                searchResults.map((tool, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <Link
                      key={tool.code}
                      to={tool.href}
                      role="option"
                      aria-selected={isSelected}
                      className={`search-result-item tone-${tool.category}${isSelected ? " is-selected" : ""}`}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => setSearchOpen(false)}
                    >
                      <span className="specimen-icon">
                        <ToolIcon code={tool.code} />
                      </span>
                      <div className="search-result-copy">
                        <div className="search-result-head">
                          <strong>{tool.title}</strong>
                          <span className="specimen-domain">{tool.category.toUpperCase()}</span>
                        </div>
                        <p>{tool.description}</p>
                      </div>
                      <span className="search-result-meta">
                        {isSelected ? "Enter ↵" : tool.spec}
                      </span>
                    </Link>
                  );
                })
              ) : (
                <div className="search-modal-empty">
                  No tools match “{searchQuery}”. Try “speed”, “trim”, “resize”, or “transcript”.
                </div>
              )}
            </div>

            <div className="search-modal-footer">
              <span>↑↓ Select</span>
              <span>Enter Open tool</span>
              <span>Esc Close</span>
            </div>
          </div>
        </div>
      )}

      <main id="top">
        <section className="home-hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <p className="hero-kicker">
                <span className="status-dot" aria-hidden="true" />
                24 BROWSER TOOLS · 0 UPLOADS · OFFLINE PWA
              </p>
              <h1>
                Browser media editor for <span>audio, video, and images.</span>
              </h1>
              <p className="hero-lead">
                Trim, retime, resize, transcribe, and edit multitrack timelines directly on your
                device. No accounts, no server uploads, and no watermarks.
              </p>
              <div className="hero-actions">
                <Link className="btn-primary-action" to="/studio/video">
                  Open Video Studio
                </Link>
                <Link className="btn-secondary-action" to="/tools">
                  Browse all 24 tools
                </Link>
              </div>
              <dl className="hero-facts">
                <div>
                  <dt>Speed range</dt>
                  <dd>0.1× – 16×</dd>
                </div>
                <div>
                  <dt>Execution</dt>
                  <dd>On-device Workers</dd>
                </div>
                <div>
                  <dt>Project save</dt>
                  <dd>Local IndexedDB</dd>
                </div>
              </dl>
            </div>

            <div className="hero-stage" role="region" aria-label="Interactive workspace preview">
              <div className="app-frame">
                <div className="app-frame-bar">
                  <div className="app-frame-tabs" role="tablist" aria-label="Preview media workspace">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={heroMode === "video"}
                      className={heroMode === "video" ? "is-active" : undefined}
                      onClick={() => setHeroMode("video")}
                    >
                      Video timeline
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={heroMode === "audio"}
                      className={heroMode === "audio" ? "is-active" : undefined}
                      onClick={() => setHeroMode("audio")}
                    >
                      Audio waveform
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={heroMode === "image"}
                      className={heroMode === "image" ? "is-active" : undefined}
                      onClick={() => setHeroMode("image")}
                    >
                      Image canvas
                    </button>
                  </div>
                  <span className="app-frame-status">LOCAL ENGINE READY</span>
                </div>

                {heroMode === "video" && (
                  <div className="stage-panel">
                    <div className="stage-viewport">
                      <div className="stage-canvas-frame">
                        <span className="stage-badge">1920 × 1080 · 30 fps</span>
                        <div className="stage-title-preview">Multitrack Composition</div>
                        <span className="stage-timecode">00:04.12 / 00:12.00</span>
                      </div>
                    </div>
                    <div className="stage-timeline">
                      <div className="stage-track">
                        <span>V1</span>
                        <div className="stage-lane">
                          <div className="stage-clip is-video" style={{ left: "4%", width: "44%" }}>
                            intro_clip.mp4 · {sampleSpeed.toFixed(2)}×
                          </div>
                          <div className="stage-clip is-video" style={{ left: "51%", width: "38%" }}>
                            broll_cut.webm
                          </div>
                        </div>
                      </div>
                      <div className="stage-track">
                        <span>A1</span>
                        <div className="stage-lane">
                          <div className="stage-clip is-audio" style={{ left: "4%", width: "85%" }}>
                            voice_normalized.wav · -1.0 dB
                          </div>
                        </div>
                      </div>
                      <div className="stage-track">
                        <span>T1</span>
                        <div className="stage-lane">
                          <div className="stage-clip is-text" style={{ left: "14%", width: "30%" }}>
                            Title overlay
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="stage-controls-row">
                      <label className="stage-inline-control">
                        <span>Playback rate</span>
                        <input
                          type="range"
                          min="0.25"
                          max="4"
                          step="0.25"
                          value={sampleSpeed}
                          onChange={(e) => setSampleSpeed(Number(e.target.value))}
                        />
                        <strong>{sampleSpeed.toFixed(2)}×</strong>
                      </label>
                      <Link to="/studio/video" className="stage-launch-link">
                        Launch Video Studio ↗
                      </Link>
                    </div>
                  </div>
                )}

                {heroMode === "audio" && (
                  <div className="stage-panel">
                    <div className="stage-waveform-box">
                      <div className="stage-waveform-head">
                        <span>podcast_take_02.wav</span>
                        <span>48 kHz · Stereo · Pitch preserved</span>
                      </div>
                      <div className="stage-waveform-bars" aria-hidden="true">
                        {waveformBars.map((height, index) => (
                          <span
                            key={index}
                            className={index >= 3 && index <= 15 ? "is-selected" : undefined}
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                      <div className="stage-range-meta">
                        <span>In: 00:01.40</span>
                        <span>Selected: 00:09.80</span>
                        <span>Out: 00:11.20</span>
                      </div>
                    </div>
                    <div className="stage-controls-row">
                      <label className="stage-inline-control">
                        <span>Speed (0.1×–16×)</span>
                        <input
                          type="range"
                          min="0.25"
                          max="4"
                          step="0.25"
                          value={sampleSpeed}
                          onChange={(e) => setSampleSpeed(Number(e.target.value))}
                        />
                        <strong>{sampleSpeed.toFixed(2)}×</strong>
                      </label>
                      <Link to="/tools/audio/speed" className="stage-launch-link">
                        Open Audio Speed ↗
                      </Link>
                    </div>
                  </div>
                )}

                {heroMode === "image" && (
                  <div className="stage-panel">
                    <div className="stage-image-box">
                      <div
                        className="stage-image-preview"
                        style={{
                          aspectRatio: `${Math.max(0.4, Math.min(2.4, sampleWidth / Math.max(1, sampleHeight)))}`,
                        }}
                      >
                        <span>
                          {sampleWidth} × {sampleHeight} px
                        </span>
                      </div>
                    </div>
                    <div className="stage-controls-row stage-image-inputs">
                      <label>
                        <span>Width (px)</span>
                        <input
                          type="number"
                          min={1}
                          max={8192}
                          value={sampleWidth}
                          onChange={(e) => setSampleWidth(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </label>
                      <label>
                        <span>Height (px)</span>
                        <input
                          type="number"
                          min={1}
                          max={8192}
                          value={sampleHeight}
                          onChange={(e) => setSampleHeight(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </label>
                      <Link to="/tools/image/resize" className="stage-launch-link">
                        Open Pixel Resize ↗
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="home-section" aria-labelledby="workspaces-heading">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="eyebrow">WORKSPACES &amp; STUDIOS</p>
                <h2 id="workspaces-heading">Three media workspaces and three studios.</h2>
              </div>
              <Link className="section-head-link" to="/tools">
                Open full catalogue ↗
              </Link>
            </div>

            <div className="workspace-grid">
              {workspaces.map((ws) => (
                <Link className={`workspace-card tone-${ws.key}`} to={ws.href} key={ws.key}>
                  <div className="workspace-card-top">
                    <span className="workspace-code">{ws.code}</span>
                    <span className="workspace-count">{ws.count}</span>
                  </div>
                  <div className="workspace-card-body">
                    <h3>{ws.title}</h3>
                    <p>{ws.description}</p>
                  </div>
                  <div className="workspace-card-foot">
                    <span>{ws.formats}</span>
                    <span aria-hidden="true">↗</span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="studio-strip" aria-label="Full studio editors">
              {studios.map((studio) => (
                <Link className="studio-strip-card" to={studio.href} key={studio.href}>
                  <span className="studio-strip-badge">{studio.badge}</span>
                  <div>
                    <strong>{studio.title}</strong>
                    <span>{studio.detail}</span>
                  </div>
                  <span className="studio-strip-arrow" aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="home-section home-section-alt" aria-labelledby="specimens-heading">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="eyebrow">SPECIMEN PREVIEW</p>
                <h2 id="specimens-heading">Core tools with exact numeric controls.</h2>
              </div>
              <Link className="section-head-link" to="/tools">
                Filter all 24 tools ↗
              </Link>
            </div>

            <div className="specimen-grid">
              {specimens.map((item) => (
                <Link className={`specimen-card tone-${item.domain}`} to={item.href} key={item.code}>
                  <div className="specimen-card-top">
                    <span className="specimen-code">{item.code}</span>
                    <span className="specimen-domain">{item.domain.toUpperCase()}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div className="specimen-card-foot">
                    <span>{item.spec}</span>
                    <span aria-hidden="true">↗</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="home-section" aria-labelledby="architecture-heading">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="eyebrow">ON-DEVICE ARCHITECTURE</p>
                <h2 id="architecture-heading">Runs on your hardware. Keeps your files local.</h2>
              </div>
              <Link className="section-head-link" to="/settings/storage">
                Inspect local storage ↗
              </Link>
            </div>

            <div className="architecture-grid">
              {architectureFacts.map((fact) => (
                <div className="architecture-card" key={fact.label}>
                  <span className="eyebrow">{fact.label}</span>
                  <h3>{fact.title}</h3>
                  <p>{fact.detail}</p>
                </div>
              ))}
            </div>
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
            <Link to="/tools">All tools</Link>
            <Link to="/tools/audio">Audio</Link>
            <Link to="/tools/video">Video</Link>
            <Link to="/tools/image">Image</Link>
            <Link to="/studio/video">Video Studio</Link>
            <Link to="/projects">Projects</Link>
            <Link to="/settings/storage">Storage</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
