const groups = {
  audio: {
    title: "Audio tools",
    description: "Trim, arrange, shape, and export audio locally in your browser.",
    tools: [
      ["Trim audio", "Choose exact start and end times and export WAV.", "/tools/audio/trim"],
      ["Change audio speed", "Set a custom speed with pitch-preserving processing.", "/tools/audio/speed"],
      ["Merge audio", "Arrange files, set a custom gap, and export one WAV.", "/tools/audio/merge"],
      ["Split audio", "Choose custom timestamps and download each segment.", "/tools/audio/split"],
      ["Volume and fades", "Set gain, fade-in, and fade-out values.", "/tools/audio/volume"],
      ["Normalize audio", "Set a peak target and preview the normalized WAV.", "/tools/audio/normalize"],
      ["Reduce quiet noise", "Use a local broadband noise gate.", "/tools/audio/noise-gate"],
      ["Reduce centered vocals", "Apply a basic stereo center-cancel filter.", "/tools/audio/vocal-reducer"],
      ["Audio Studio", "Save a local audio source with trim, speed, gain, and fades.", "/projects"],
    ],
  },
  video: {
    title: "Video tools",
    description: "Trim, retime, and adjust local video, or open the multitrack editor.",
    tools: [
      ["Trim video", "Choose a precise range and export a local video file.", "/tools/video/trim"],
      ["Extract video audio", "Export a primary audio track as WAV.", "/tools/video/extract-audio"],
      ["Change video speed", "Set a custom playback rate for a local export.", "/tools/video/speed"],
      ["Remove video audio", "Export a muted video copy.", "/tools/video/remove-audio"],
      ["Replace video audio", "Add a local soundtrack with a custom offset.", "/tools/video/replace-audio"],
      ["Video Studio", "Create or reopen a local multitrack video project.", "/projects"],
    ],
  },
  image: {
    title: "Image tools",
    description: "Resize, crop, enlarge, arrange, and export images locally.",
    tools: [
      ["Image editor and resize", "Set exact pixel dimensions and make non-destructive edits.", "/tools/image/resize"],
      ["Enlarge an image", "Use browser resampling for larger output dimensions.", "/tools/image/upscale"],
      ["Crop image", "Choose an exact crop rectangle in source pixels.", "/tools/image/crop"],
      ["Make a collage", "Arrange source images, add a caption, save, and export.", "/tools/image/collage"],
      ["Image Studio", "Create or reopen a local image workspace.", "/projects"],
    ],
  },
} as const;

export function ToolDirectory({ category }: { category?: keyof typeof groups }) {
  const selected = category ? [groups[category]] : Object.values(groups);
  return <main className="resize-page">
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/tools">All tools</a><a href="/projects">Projects</a></nav></header>
    <section className="resize-intro"><p className="eyebrow">PRIVATE, LOCAL MEDIA TOOLS</p><h1>{category ? groups[category].title : "Explore Local Studio tools"}</h1><p>{category ? groups[category].description : "Choose a tool for audio, video, or images. Your media stays on this device."}</p></section>
    {selected.map((group) => <section className="resize-workspace" key={group.title} aria-label={group.title}>
      {!category && <h2>{group.title}</h2>}
      <div className="tool-directory-grid">{group.tools.map(([title, description, href]) => <a className="tool-card" href={href} key={title}><strong>{title}</strong><span>{description}</span><span className="tool-link">Open {title} →</span></a>)}</div>
    </section>)}
    <p className="resize-note">Supported formats and export options depend on the browser. Media processing and project storage run locally.</p>
  </main>;
}
