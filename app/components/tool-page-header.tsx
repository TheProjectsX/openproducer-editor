import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "react-router";
import { NavBackButton } from "./nav-back-button";
import { BrandMark } from "./brand-mark";

const groups = {
  audio: {
    label: "Audio tools",
    href: "/tools/audio",
    tools: [
      ["Trim audio", "/tools/audio/trim"],
      ["Merge audio", "/tools/audio/merge"],
      ["Split audio", "/tools/audio/split"],
      ["Volume and fades", "/tools/audio/volume"],
      ["Change audio speed", "/tools/audio/speed"],
      ["Voice to transcript", "/tools/audio/transcribe"],
      ["Reduce background noise", "/tools/audio/noise-gate"],
      ["Normalize audio", "/tools/audio/normalize"],
      ["Reduce centered vocals", "/tools/audio/vocal-reducer"],
      ["Audio Studio", "/studio/audio"],
    ],
  },
  video: {
    label: "Video tools",
    href: "/tools/video",
    tools: [
      ["Trim video", "/tools/video/trim"],
      ["Change video speed", "/tools/video/speed"],
      ["Extract video audio", "/tools/video/extract-audio"],
      ["Remove video audio", "/tools/video/remove-audio"],
      ["Replace video audio", "/tools/video/replace-audio"],
      ["Image to video", "/tools/video/image-to-video"],
      ["Video Studio", "/studio/video"],
    ],
  },
  image: {
    label: "Image tools",
    href: "/tools/image",
    tools: [
      ["Crop image", "/tools/image/crop"],
      ["Resize pixels", "/tools/image/resize"],
      ["Downscale image", "/tools/image/downscale"],
      ["Upscale image", "/tools/image/upscale"],
      ["Make a collage", "/tools/image/collage"],
      ["Image to video", "/tools/video/image-to-video"],
      ["Image Editor", "/tools/image/editor"],
    ],
  },
} as const;

function titleFromPath(path: string) {
  if (path === "/studio/video") return "Video Studio";
  if (path === "/studio/audio") return "Audio Studio";
  if (path === "/studio/image") return "Image editor project";
  const slug = path.split("/").at(-1) ?? "Tool";
  const labels: Record<string, string> = {
    editor: "Image editor",
    transcribe: "Voice to transcript",
    trim: "Trim",
    speed: "Speed",
    merge: "Merge",
    split: "Split",
    volume: "Volume and fades",
    normalize: "Normalize",
    "noise-gate": "Reduce background noise",
    "vocal-reducer": "Reduce centered vocals",
    "extract-audio": "Extract audio",
    "remove-audio": "Remove audio",
    "replace-audio": "Replace audio",
    "image-to-video": "Image to video",
    resize: "Image resize",
    downscale: "Downscale image",
    upscale: "Upscale image",
    crop: "Crop image",
    collage: "Make a collage",
  };
  return labels[slug] ?? slug;
}

export function ToolPageHeader({ status }: { status?: string }) {
  const { pathname } = useLocation();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const menuRef = useRef<HTMLElement>(null);
  const lastPointerTypeRef = useRef<string>("mouse");
  const categoryKey =
    pathname.startsWith("/tools/audio") || pathname === "/studio/audio"
      ? "audio"
      : pathname.startsWith("/tools/video") || pathname === "/studio/video"
        ? "video"
        : "image";
  const category = groups[categoryKey];
  const toolTitle = titleFromPath(pathname);

  useEffect(() => {
    setOpenGroup(null);
  }, [pathname]);

  useEffect(() => {
    if (!openGroup) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpenGroup(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenGroup(null);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openGroup]);

  return (
    <>
      <header className="resize-header tool-page-header">
        <div className="brand-with-back">
          <NavBackButton
            fallback={category.href}
            onBeforeBack={() => {
              if (
                typeof window !== "undefined" &&
                pathname !== "/tools/image/editor" &&
                !pathname.startsWith("/studio/") &&
                document.querySelector(".resize-page.has-media")
              ) {
                window.dispatchEvent(new CustomEvent("openproducer:reset-tool"));
                return true;
              }
              return false;
            }}
          />
          <Link to="/" className="brand">
            <BrandMark />
            <span>OpenProducer Editor</span>
          </Link>
        </div>

        <nav ref={menuRef} className="tool-group-menu" aria-label="Tool groups">
          {Object.entries(groups).map(([key, group]) => (
            <details
              key={key}
              open={openGroup === key}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setOpenGroup(key);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") {
                  setOpenGroup((current) => (current === key ? null : current));
                }
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setOpenGroup((current) => (current === key ? null : current));
                }
              }}
            >
              <summary
                className={key === categoryKey ? `is-current tone-${key}` : undefined}
                onPointerDown={(event) => {
                  lastPointerTypeRef.current = event.pointerType;
                }}
                onClick={(event) => {
                  event.preventDefault();
                  const isMouseClick = event.detail > 0 && lastPointerTypeRef.current === "mouse";
                  setOpenGroup((current) => (isMouseClick ? key : current === key ? null : key));
                }}
              >
                {group.label}
                <span aria-hidden="true">⌄</span>
              </summary>
              <div className="tool-dropdown">
                <Link className="tool-dropdown-all" to={group.href}>
                  All {group.label.toLowerCase()} ↗
                </Link>
                {group.tools.map(([label, href]) => (
                  <Link
                    to={href}
                    key={href}
                    aria-current={pathname === href ? "page" : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </details>
          ))}
          <Link className="tool-header-link" to="/tools">All tools</Link>
          <Link className="tool-header-link" to="/projects">Projects</Link>
        </nav>

        {status && (
          <span className="tool-page-status" role="status">
            {status}
          </span>
        )}
      </header>

      <nav className="tool-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link to="/tools">Tools</Link>
        <span aria-hidden="true">/</span>
        <Link to={category.href}>{category.label}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{toolTitle}</span>
      </nav>
    </>
  );
}
