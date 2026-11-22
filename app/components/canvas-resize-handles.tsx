import { useRef, useState } from "react";

type ResizeHandle = "top" | "bottom" | "left" | "right" | "nw" | "ne" | "sw" | "se";

export function CanvasResizeHandles({
  width,
  height,
  stageRef,
  onResize,
  onDragStateChange,
}: {
  width: number;
  height: number;
  stageRef: React.RefObject<HTMLDivElement | null>;
  onResize: (nextWidth: number, nextHeight: number, shiftX: number, shiftY: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const gestureRef = useRef<{
    handle: ResizeHandle;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startW: number;
    startH: number;
    lastW: number;
    lastH: number;
    scaleX: number;
    scaleY: number;
  } | null>(null);

  function begin(handle: ResizeHandle, event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    event.preventDefault();
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds || width <= 0 || height <= 0) return;
    gestureRef.current = {
      handle,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startW: width,
      startH: height,
      lastW: width,
      lastH: height,
      scaleX: width / Math.max(1, bounds.width),
      scaleY: height / Math.max(1, bounds.height),
    };
    setActiveHandle(handle);
    onDragStateChange?.(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: React.PointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (!g || g.pointerId !== event.pointerId) return;
    const dx = (event.clientX - g.startClientX) * g.scaleX * 2;
    const dy = (event.clientY - g.startClientY) * g.scaleY * 2;

    let nextW = g.startW;
    let nextH = g.startH;
    const fromLeft = g.handle === "left" || g.handle === "nw" || g.handle === "sw";
    const fromTop = g.handle === "top" || g.handle === "nw" || g.handle === "ne";
    if (g.handle === "right" || g.handle === "ne" || g.handle === "se") nextW = g.startW + dx;
    if (fromLeft) nextW = g.startW - dx;
    if (g.handle === "bottom" || g.handle === "se" || g.handle === "sw") nextH = g.startH + dy;
    if (fromTop) nextH = g.startH - dy;

    if (event.shiftKey && (g.handle === "nw" || g.handle === "ne" || g.handle === "sw" || g.handle === "se")) {
      const aspect = g.startW / Math.max(1, g.startH);
      nextH = nextW / aspect;
    }

    nextW = Math.max(64, Math.min(32768, Math.round(nextW)));
    nextH = Math.max(64, Math.min(32768, Math.round(nextH)));
    if (nextW * nextH > 100_000_000) {
      const factor = Math.sqrt(100_000_000 / (nextW * nextH));
      nextW = Math.max(64, Math.floor(nextW * factor));
      nextH = Math.max(64, Math.floor(nextH * factor));
    }
    const shiftX = fromLeft ? nextW - g.lastW : 0;
    const shiftY = fromTop ? nextH - g.lastH : 0;
    g.lastW = nextW;
    g.lastH = nextH;
    onResize(nextW, nextH, shiftX, shiftY);
  }

  function end(event: React.PointerEvent<HTMLDivElement>) {
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    setActiveHandle(null);
    onDragStateChange?.(false);
  }

  const bars: { id: ResizeHandle; label: string }[] = [
    { id: "top", label: "Resize canvas height from top" },
    { id: "bottom", label: "Resize canvas height from bottom" },
    { id: "left", label: "Resize canvas width from left" },
    { id: "right", label: "Resize canvas width from right" },
  ];
  const corners: { id: ResizeHandle; label: string }[] = [
    { id: "nw", label: "Resize canvas from top-left corner" },
    { id: "ne", label: "Resize canvas from top-right corner" },
    { id: "sw", label: "Resize canvas from bottom-left corner" },
    { id: "se", label: "Resize canvas from bottom-right corner" },
  ];

  return (
    <>
      {bars.map((bar) => (
        <div
          key={bar.id}
          role="separator"
          aria-label={bar.label}
          className={`canvas-resize-bar ${bar.id}${activeHandle === bar.id ? " is-active" : ""}`}
          onPointerDown={(e) => begin(bar.id, e)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onClick={(e) => e.stopPropagation()}
        />
      ))}
      {corners.map((corner) => (
        <div
          key={corner.id}
          role="separator"
          aria-label={corner.label}
          className={`canvas-resize-corner ${corner.id}${activeHandle === corner.id ? " is-active" : ""}`}
          onPointerDown={(e) => begin(corner.id, e)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onClick={(e) => e.stopPropagation()}
        />
      ))}
      {activeHandle && <div className="canvas-resize-readout" aria-live="polite">{`${width} × ${height} px`}</div>}
    </>
  );
}
