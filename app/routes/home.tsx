import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Local Studio | A private media workspace" },
    {
      name: "description",
      content: "A focused local workspace for audio, video, and image editing. Your media stays on your device.",
    },
  ];
}

const categories = [
  {
    title: "Audio editor tools",
    description: "Shape sound, clean recordings, adjust speed, and bring tracks together.",
    href: "/tools/audio",
    type: "audio",
    number: "01",
    tools: "Trim · Split · Mix · Clean",
  },
  {
    title: "Video editor tools",
    description: "Make precise cuts, control playback speed, and work across video and audio.",
    href: "/tools/video",
    type: "video",
    number: "02",
    tools: "Trim · Speed · Audio · Studio",
  },
  {
    title: "Image tools",
    description: "Refine dimensions, crop with control, compose collages, and prepare exports.",
    href: "/tools/image",
    type: "image",
    number: "03",
    tools: "Resize · Crop · Compose · Export",
  },
] as const;

function CategoryMark({ type }: { type: (typeof categories)[number]["type"] }) {
  if (type === "audio") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 20v8m7-15v22m7-28v34m7-23v12m7-19v26m7-17v8m7-13v18" /></svg>;
  if (type === "video") return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="10" width="27" height="28" rx="5" /><path d="m32 20 11-7v22l-11-7z" /></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="5" width="38" height="38" rx="8" /><circle cx="17" cy="17" r="4" /><path d="m8 36 11-11 7 7 5-5 9 9" /></svg>;
}

export default function Home() {
  return (
    <main className="marketing-page">
      <header className="site-header">
        <a href="/" className="brand"><span className="brand-mark" aria-hidden="true">L</span>Local Studio</a>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="/tools">Explore tools</a>
          <a href="/projects">Projects</a>
          <a href="/settings/storage">Storage</a>
        </nav>
      </header>

      <section className="category-section home-workspaces" aria-labelledby="category-heading">
        <div className="category-grid">
          {categories.map((category) => <a className={`category-card category-${category.type}`} href={category.href} key={category.type}>
            <div className="category-card-top"><span className="category-icon"><CategoryMark type={category.type} /></span><span className="category-number">{category.number}</span></div>
            <div className="category-card-copy"><h2>{category.title}</h2><p>{category.description}</p></div>
            <div className="category-card-bottom"><span>{category.tools}</span><span className="category-arrow" aria-hidden="true">↗</span></div>
          </a>)}
        </div>
        <a className="creative-studio-card" href="/studio/video">
          <span className="creative-studio-mark" aria-hidden="true">✦</span>
          <span><strong>Creative Studio</strong><small>Multitrack editing for video, audio, and images</small></span>
          <span className="category-arrow" aria-hidden="true">↗</span>
        </a>
      </section>

      <section className="home-hero">
        <div className="hero-copy">
          <span className="hero-kicker"><span className="status-dot" /> PRIVATE BY DESIGN · READY OFFLINE</span>
          <h1>Make more of<br /><span>your media.</span></h1>
          <p>Thoughtful tools for the details that make audio, video, and images feel right. Your files stay on your device.</p>
          <a className="hero-link" href="/tools">Explore the workspace <span aria-hidden="true">↗</span></a>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="art-glow" />
          <div className="art-window">
            <div className="art-window-top"><span /><span /><span /><i>LOCAL / 01</i></div>
            <div className="art-wave"><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /></div>
            <div className="art-track"><i /><i /><i /></div>
            <div className="art-image"><span /><span /><span /></div>
          </div>
          <div className="art-chip chip-a">✳ &nbsp; LOCAL FIRST</div>
          <div className="art-chip chip-b">NO UPLOADS. NO ACCOUNTS.</div>
        </div>
      </section>

      <footer className="home-footer"><span>LOCAL STUDIO</span><span>Private editing. Right on your device.</span><a href="/projects">Your projects ↗</a></footer>
    </main>
  );
}
