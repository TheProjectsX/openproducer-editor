import { useLocation } from "react-router";

const groups = {
  audio: { label: "Audio tools", href: "/tools/audio", tools: [["Trim audio", "/tools/audio/trim"], ["Change speed", "/tools/audio/speed"], ["Merge audio", "/tools/audio/merge"], ["Split audio", "/tools/audio/split"], ["Volume and fades", "/tools/audio/volume"], ["Noise reduction", "/tools/audio/noise-gate"], ["Audio Studio", "/studio/audio"]] },
  video: { label: "Video tools", href: "/tools/video", tools: [["Trim video", "/tools/video/trim"], ["Change speed", "/tools/video/speed"], ["Extract audio", "/tools/video/extract-audio"], ["Remove audio", "/tools/video/remove-audio"], ["Replace audio", "/tools/video/replace-audio"]] },
  image: { label: "Image tools", href: "/tools/image", tools: [["Resize and edit", "/tools/image/resize"], ["Upscale image", "/tools/image/upscale"], ["Crop image", "/tools/image/crop"], ["Create collage", "/tools/image/collage"]] },
} as const;

function titleFromPath(path: string) {
  if (path === "/studio/video") return "Creative Studio";
  if (path === "/studio/audio") return "Audio Studio";
  if (path === "/studio/image") return "Image Studio";
  const slug = path.split("/").at(-1) ?? "Tool";
  const labels: Record<string, string> = { "trim": "Trim", "speed": "Speed", "merge": "Merge", "split": "Split", "volume": "Volume and fades", "normalize": "Normalize", "noise-gate": "Noise reduction", "vocal-reducer": "Vocal reduction", "extract-audio": "Extract audio", "remove-audio": "Remove audio", "replace-audio": "Replace audio", "resize": "Resize and edit", "upscale": "Upscale", "crop": "Crop", "collage": "Collage" };
  return labels[slug] ?? slug;
}

export function ToolPageHeader({ status }: { status?: string }) {
  const { pathname } = useLocation();
  const categoryKey = pathname.startsWith("/tools/audio") || pathname === "/studio/audio" ? "audio" : pathname.startsWith("/tools/video") || pathname === "/studio/video" ? "video" : "image";
  const category = pathname === "/studio/video" ? { label: "Creative Studio", href: "/" } : groups[categoryKey];
  const toolTitle = titleFromPath(pathname);
  return <header className="resize-header tool-page-header">
    <a href="/" className="brand"><span className="brand-mark" aria-hidden="true">L</span>Local Studio</a>
    <nav className="tool-breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Home</a><span aria-hidden="true">/</span><a href={category.href}>{category.label}</a><span aria-hidden="true">/</span><span aria-current="page">{toolTitle}</span>
    </nav>
    <nav className="tool-group-menu" aria-label="Tool groups">{Object.entries(groups).map(([key, group]) => <details key={key}>
      <summary>{group.label}<span aria-hidden="true">⌄</span></summary>
      <div className="tool-dropdown"><a className="tool-dropdown-all" href={group.href}>All {group.label.toLowerCase()} ↗</a>{group.tools.map(([label, href]) => <a href={href} key={href}>{label}</a>)}</div>
    </details>)}</nav>
    {status && <span className="tool-page-status" role="status">{status}</span>}
  </header>;
}
