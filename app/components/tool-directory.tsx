import { NavBackButton } from "./nav-back-button";

const groups = {
  audio: {
    label: "AUDIO WORKSPACE",
    title: "Shape your sound.",
    description: "A focused set of tools for editing, cleaning, and preparing audio. Everything runs locally in your browser.",
    color: "audio",
    tools: [
      ["Trim audio", "Choose a section with precise start and end controls, then export WAV.", "/tools/audio/trim", "01"],
      ["Change audio speed", "Set a custom playback rate with pitch-preserving processing.", "/tools/audio/speed", "02"],
      ["Merge audio", "Put files in order, set a custom gap, and create one WAV.", "/tools/audio/merge", "03"],
      ["Split audio", "Add exact split points and download the resulting segments.", "/tools/audio/split", "04"],
      ["Volume and fades", "Set gain and shape the start or end of a recording.", "/tools/audio/volume", "05"],
      ["Normalize audio", "Choose a custom peak target and preview the result.", "/tools/audio/normalize", "06"],
      ["Reduce background noise", "Profile a quiet section and reduce matching noise locally.", "/tools/audio/noise-gate", "07"],
      ["Reduce centered vocals", "Try an adjustable stereo center-cancel effect.", "/tools/audio/vocal-reducer", "08"],
      ["Voice to transcript", "Transcribe audio, video, or mic recordings locally with Whisper Base.", "/tools/audio/transcribe", "09"],
      ["Audio editor", "Open the multitrack audio editing workspace.", "/studio/audio", "10"],
    ],
  },
  video: {
    label: "VIDEO WORKSPACE",
    title: "Give every frame a place.",
    description: "Make precise video changes and open the multitrack studio when the edit needs more room.",
    color: "video",
    tools: [
      ["Trim video", "Set a precise source range and export a local video file.", "/tools/video/trim", "01"],
      ["Extract video audio", "Save the primary audio track as a WAV file.", "/tools/video/extract-audio", "02"],
      ["Change video speed", "Use any supported custom playback rate for a local export.", "/tools/video/speed", "03"],
      ["Remove video audio", "Keep the picture and export a muted video copy.", "/tools/video/remove-audio", "04"],
      ["Replace video audio", "Add and mix local audio tracks against a video.", "/tools/video/replace-audio", "05"],
      ["Image to video", "Animate one or more images with keyframes, motion presets, and audio into an MP4 or WebM.", "/tools/video/image-to-video", "06"],
    ],
  },
  image: {
    label: "IMAGE WORKSPACE",
    title: "Make the image fit your idea.",
    description: "Prepare exact dimensions, refine a composition, and export images without sending them anywhere.",
    color: "image",
    tools: [
      ["Image editor", "Start from a blank, colored, or transparent canvas or insert an image with editable layers.", "/tools/image/editor", "01"],
      ["Image resize", "Set exact pixel dimensions and make non-destructive adjustments.", "/tools/image/resize", "02"],
      ["Downscale image", "Scale by a custom percentage or reduction factor while preserving proportions.", "/tools/image/downscale", "03"],
      ["Upscale image", "Enlarge images with browser-based AI upscaling.", "/tools/image/upscale", "04"],
      ["Crop image", "Choose a crop rectangle directly in source-image pixels.", "/tools/image/crop", "05"],
      ["Make a collage", "Arrange, fit, and caption images on a custom canvas.", "/tools/image/collage", "06"],
      ["Image to video", "Animate images with keyframes, motion presets, and audio into a video.", "/tools/video/image-to-video", "07"],
      ["Image editor project", "Open a saved local image workspace and its editable layers.", "/studio/image", "08"],
    ],
  },
} as const;

const categories = [
  { key: "audio", title: "Audio editor tools", text: "Shape sound, clean recordings, adjust speed, and bring tracks together.", href: "/tools/audio", count: "10 TOOLS" },
  { key: "video", title: "Video editor tools", text: "Make precise cuts, retime a clip, or compose a multitrack edit.", href: "/tools/video", count: "06 TOOLS" },
  { key: "image", title: "Image tools", text: "Resize, downscale, crop, refine, and compose image projects.", href: "/tools/image", count: "08 TOOLS" },
] as const;

function Icon({ type }: { type: "audio" | "video" | "image" }) {
  if (type === "audio") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 20v8m7-15v22m7-28v34m7-23v12m7-19v26m7-17v8m7-13v18" /></svg>;
  if (type === "video") return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="10" width="27" height="28" rx="5" /><path d="m32 20 11-7v22l-11-7z" /></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="5" width="38" height="38" rx="8" /><circle cx="17" cy="17" r="4" /><path d="m8 36 11-11 7 7 5-5 9 9" /></svg>;
}

export function ToolDirectory({ category }: { category?: keyof typeof groups }) {
  return <main className="catalog-page">
    <header className="site-header">
      <div className="brand-with-back"><NavBackButton fallback={category ? "/tools" : "/"} /><a href="/" className="brand"><span className="brand-mark" aria-hidden="true">L</span>Local Studio</a></div>
      <nav className="site-nav" aria-label="Main navigation"><a href="/tools">Explore tools</a><a href="/projects">Projects</a></nav>
    </header>

    {!category ? <>
      <section className="catalog-hero">
        <p className="hero-kicker"><span className="status-dot" /> PRIVATE, LOCAL WORKSPACES</p>
        <h1>Choose a place<br />to <span>make something.</span></h1>
        <p>Start with the kind of media you have. Each workspace keeps its tools together and your files on this device.</p>
      </section>
      <section className="category-grid catalog-category-grid" aria-label="Media workspaces">
        {categories.map((entry) => <a className={`category-card category-${entry.key}`} href={entry.href} key={entry.key}>
          <div className="category-card-top"><span className="category-icon"><Icon type={entry.key} /></span><span className="category-number">{entry.count}</span></div>
          <div className="category-card-copy"><h2>{entry.title}</h2><p>{entry.text}</p></div>
          <div className="category-card-bottom"><span>OPEN WORKSPACE</span><span className="category-arrow" aria-hidden="true">↗</span></div>
        </a>)}
      </section>
    </> : (() => {
      const group = groups[category];
      return <>
        <section className={`catalog-hero catalog-hero-${group.color}`}>
          <a className="catalog-back" href="/tools">← All workspaces</a>
          <p className="hero-kicker"><span className="status-dot" /> {group.label}</p>
          <h1>{group.title}</h1>
          <p>{group.description}</p>
        </section>
        <section className="catalog-tool-section" aria-label={`${category} editing tools`}>
          <div className="catalog-section-head"><span>TOOLS IN THIS WORKSPACE</span><span>{String(group.tools.length).padStart(2, "0")} TOOLS</span></div>
          <div className="catalog-tool-grid">{group.tools.map(([title, description, href, number]) => <a className="catalog-tool-card" href={href} key={title}>
            <span className="catalog-tool-number">{number}</span>
            <span className="catalog-tool-copy"><strong>{title}</strong><span>{description}</span></span>
            <span className="catalog-tool-arrow" aria-hidden="true">↗</span>
          </a>)}</div>
        </section>
      </>;
    })()}

    <footer className="home-footer"><span>LOCAL STUDIO</span><span>Private editing. Right on your device.</span><a href="/projects">Your projects ↗</a></footer>
  </main>;
}
