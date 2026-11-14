import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Local Studio | Private media editing" },
    {
      name: "description",
      content: "Edit audio, video, and images locally in an installable offline studio.",
    },
  ];
}

export default function Home() {
  return (
    <main className="resize-page">
      <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/projects">Projects</a></nav></header>
      <section className="resize-intro">
        <p className="eyebrow">YOUR MEDIA STAYS ON YOUR DEVICE</p>
        <h1>A private workspace for audio, video, and images.</h1>
        <p>Local Studio is built to edit in your browser, keep projects on your device, and work offline after installation.</p>
      </section>
      <section className="resize-workspace" aria-label="Available tools">
        <a className="tool-card" href="/tools/image/resize"><span className="eyebrow">IMAGE</span><strong>Resize image pixels</strong><span>Set exact width and height without cropping.</span><span className="tool-link">Open image resize →</span></a>
        <a className="tool-card" href="/tools/image/upscale"><span className="eyebrow">IMAGE</span><strong>Upscale image</strong><span>Set a custom multiplier or exact output dimensions.</span><span className="tool-link">Open image upscaler →</span></a>
        <a className="tool-card" href="/tools/image/collage"><span className="eyebrow">IMAGE</span><strong>Make a collage</strong><span>Arrange, reorder, and fit images on a custom canvas.</span><span className="tool-link">Open collage maker →</span></a>
        <a className="tool-card" href="/tools/image/crop"><span className="eyebrow">IMAGE</span><strong>Crop image</strong><span>Choose an exact crop rectangle in source pixels.</span><span className="tool-link">Open image crop →</span></a>
        <a className="tool-card" href="/tools/audio/trim"><span className="eyebrow">AUDIO</span><strong>Trim audio</strong><span>Choose exact start and end times and export WAV.</span><span className="tool-link">Open audio trim →</span></a>
        <a className="tool-card" href="/tools/audio/speed"><span className="eyebrow">AUDIO</span><strong>Change audio speed</strong><span>Set a custom speed while keeping pitch steady.</span><span className="tool-link">Open audio speed →</span></a>
        <a className="tool-card" href="/tools/audio/merge"><span className="eyebrow">AUDIO</span><strong>Merge audio files</strong><span>Arrange multiple files, add a custom gap, and export one WAV.</span><span className="tool-link">Open audio merge →</span></a>
        <a className="tool-card" href="/tools/audio/split"><span className="eyebrow">AUDIO</span><strong>Split audio</strong><span>Enter custom timestamps and download all segments together.</span><span className="tool-link">Open audio split →</span></a>
        <a className="tool-card" href="/tools/audio/noise-gate"><span className="eyebrow">AUDIO</span><strong>Reduce quiet noise</strong><span>Control a broadband gate with your own threshold and timing.</span><span className="tool-link">Open noise gate →</span></a>
        <a className="tool-card" href="/tools/audio/vocal-reducer"><span className="eyebrow">AUDIO</span><strong>Reduce centered vocals</strong><span>Try an adjustable stereo center-cancel effect.</span><span className="tool-link">Open vocal reducer →</span></a>
        <a className="tool-card" href="/tools/video/trim"><span className="eyebrow">VIDEO</span><strong>Trim video</strong><span>Choose a precise range and export a local MP4.</span><span className="tool-link">Open video trim →</span></a>
        <a className="tool-card" href="/tools/video/extract-audio"><span className="eyebrow">VIDEO</span><strong>Extract video audio</strong><span>Export the primary audio track as a local WAV.</span><span className="tool-link">Open audio extractor →</span></a>
        <article className="tool-card coming-soon"><span className="eyebrow">VIDEO</span><strong>Multitrack video studio</strong><span>Build edits on a CapCut-style timeline.</span><span className="tool-link">Planned</span></article>
      </section>
    </main>
  );
}
