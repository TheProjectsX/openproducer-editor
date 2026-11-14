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
      <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/tools/image/resize">Image tools</a></nav></header>
      <section className="resize-intro">
        <p className="eyebrow">YOUR MEDIA STAYS ON YOUR DEVICE</p>
        <h1>A private workspace for audio, video, and images.</h1>
        <p>Local Studio is built to edit in your browser, keep projects on your device, and work offline after installation.</p>
      </section>
      <section className="resize-workspace" aria-label="Available tools">
        <a className="tool-card" href="/tools/image/resize"><span className="eyebrow">IMAGE</span><strong>Resize image pixels</strong><span>Set exact width and height without cropping.</span><span className="tool-link">Open image resize →</span></a>
        <article className="tool-card coming-soon"><span className="eyebrow">AUDIO</span><strong>Audio tools</strong><span>Trim, split, merge, clean, and change speed.</span><span className="tool-link">Coming next</span></article>
        <article className="tool-card coming-soon"><span className="eyebrow">VIDEO</span><strong>Video studio</strong><span>Build edits on a multitrack timeline.</span><span className="tool-link">Coming later</span></article>
      </section>
    </main>
  );
}
