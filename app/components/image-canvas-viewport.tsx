import { useEffect, useRef, useState, type ReactNode } from "react";

export type CanvasBgMode = "dark-checker" | "light-checker" | "solid-black" | "solid-white";

export function CanvasBackgroundPicker({
  value,
  onChange,
}: {
  value: CanvasBgMode;
  onChange: (next: CanvasBgMode) => void;
}) {
  return (
    <div className="canvas-bg-picker" role="group" aria-label="Canvas background">
      {(
        [
          ["dark-checker", "Dark transparent grid"],
          ["light-checker", "White transparent grid"],
          ["solid-black", "Solid black"],
          ["solid-white", "Solid white"],
        ] as const
      ).map(([bgKey, bgLabel]) => (
        <button
          key={bgKey}
          type="button"
          className={`canvas-bg-swatch bg-${bgKey}${value === bgKey ? " is-active" : ""}`}
          aria-label={bgLabel}
          title={bgLabel}
          aria-pressed={value === bgKey}
          onClick={() => onChange(bgKey)}
        />
      ))}
    </div>
  );
}

export function ImageCanvasViewport({
  canvasBg,
  children,
  panDisabled = false,
}: {
  canvasBg: CanvasBgMode;
  children: ReactNode;
  panDisabled?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const wellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  function clampZoom(next: number) {
    return Math.min(8, Math.max(0.25, Math.round(next * 100) / 100));
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    const element = wellRef.current;
    if (!element) return;
    const handleNativeWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom((prev) => clampZoom(prev * factor));
    };
    element.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleNativeWheel);
  }, []);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const isMiddle = event.button === 1;
    if (!isMiddle && (event.button !== 0 || panDisabled)) return;
    const target = event.target as HTMLElement | null;
    if (!isMiddle && target?.closest("input, button, [data-resize-crop-selection], [data-resize-crop-handle], [data-crop-selection], [data-crop-handle], .upscale-comparison-range")) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origX: pan.x,
      origY: pan.y,
    };
    setPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({
      x: drag.origX + (event.clientX - drag.startX),
      y: drag.origY + (event.clientY - drag.startY),
    });
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setPanning(false);
    }
  }

  return (
    <div
      ref={wellRef}
      className={`image-stage-well${panDisabled ? "" : " is-pannable"}${panning ? " is-panning" : ""}`}
      data-canvas-bg={canvasBg}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div
        className="image-stage-transform"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {children}
      </div>

      <div className="canvas-viewport-hud" role="toolbar" aria-label="Canvas zoom and pan controls">
        <button
          type="button"
          onClick={() => setZoom((z) => clampZoom(z / 1.2))}
          aria-label="Zoom out"
          title="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="canvas-zoom-reset"
          onClick={resetView}
          title="Reset zoom and position (Ctrl + scroll to zoom, drag to move)"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => clampZoom(z * 1.2))}
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}
