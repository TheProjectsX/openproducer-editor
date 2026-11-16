import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/image-crop";
import { MediaImportScreen } from "../components/media-import-screen";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Crop image | Local Studio" },
    { name: "description", content: "Crop a local image by exact pixel coordinates in your browser." },
  ];
}

export default function ImageCrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropStageRef = useRef<HTMLDivElement>(null);
  const cropGesture = useRef<{ pointerId: number; mode: "create" | "move" | `resize-${string}`; anchorX: number; anchorY: number; left: number; top: number; width: number; height: number; moved: boolean } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [left, setLeft] = useState("0");
  const [top, setTop] = useState("0");
  const [cropWidth, setCropWidth] = useState("");
  const [cropHeight, setCropHeight] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const crop = useMemo(() => ({ x: Number(left), y: Number(top), width: Number(cropWidth), height: Number(cropHeight) }), [left, top, cropWidth, cropHeight]);
  const valid = Boolean(file && Number.isInteger(crop.x) && Number.isInteger(crop.y) && Number.isInteger(crop.width) && Number.isInteger(crop.height)
    && crop.x >= 0 && crop.y >= 0 && crop.width > 0 && crop.height > 0 && crop.x + crop.width <= size.width && crop.y + crop.height <= size.height
    && crop.width * crop.height <= 100_000_000);

  function imagePoint(event: React.PointerEvent<HTMLDivElement>) {
    const image = cropStageRef.current?.querySelector("img");
    if (!image || !size.width || !size.height) return { x: 0, y: 0 };
    const bounds = image.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(size.width, (event.clientX - bounds.left) / bounds.width * size.width)),
      y: Math.max(0, Math.min(size.height, (event.clientY - bounds.top) / bounds.height * size.height)),
    };
  }
  function setCropRect(x: number, y: number, width: number, height: number) {
    const nextWidth = Math.max(1, Math.min(size.width, Math.round(width)));
    const nextHeight = Math.max(1, Math.min(size.height, Math.round(height)));
    setLeft(String(Math.max(0, Math.min(size.width - nextWidth, Math.round(x)))));
    setTop(String(Math.max(0, Math.min(size.height - nextHeight, Math.round(y)))));
    setCropWidth(String(nextWidth)); setCropHeight(String(nextHeight));
  }
  function beginCropGesture(event: React.PointerEvent<HTMLDivElement>) {
    if (!size.width || !size.height) return;
    const point = imagePoint(event), target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-crop-handle]")?.dataset.cropHandle;
    const isSelection = target.closest("[data-crop-selection]");
    const mode = handle ? `resize-${handle}` as const : isSelection ? "move" as const : "create" as const;
    cropGesture.current = { pointerId: event.pointerId, mode, anchorX: point.x, anchorY: point.y, left: crop.x, top: crop.y, width: crop.width, height: crop.height, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function moveCropGesture(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = cropGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const point = imagePoint(event);
    if (!gesture.moved && Math.hypot(point.x - gesture.anchorX, point.y - gesture.anchorY) < 2) return;
    gesture.moved = true;
    if (gesture.mode === "create") {
      setCropRect(Math.min(gesture.anchorX, point.x), Math.min(gesture.anchorY, point.y), Math.abs(point.x - gesture.anchorX), Math.abs(point.y - gesture.anchorY));
      return;
    }
    if (gesture.mode === "move") {
      setCropRect(Math.max(0, Math.min(size.width - gesture.width, gesture.left + point.x - gesture.anchorX)), Math.max(0, Math.min(size.height - gesture.height, gesture.top + point.y - gesture.anchorY)), gesture.width, gesture.height);
      return;
    }
    const handle = gesture.mode.slice(7);
    const originalRight = gesture.left + gesture.width, originalBottom = gesture.top + gesture.height;
    let x = gesture.left, y = gesture.top, right = originalRight, bottom = originalBottom;
    if (handle.includes("w")) x = Math.max(0, Math.min(originalRight - 1, point.x));
    if (handle.includes("e")) right = Math.max(gesture.left + 1, Math.min(size.width, point.x));
    if (handle.includes("n")) y = Math.max(0, Math.min(originalBottom - 1, point.y));
    if (handle.includes("s")) bottom = Math.max(gesture.top + 1, Math.min(size.height, point.y));
    setCropRect(x, y, right - x, bottom - y);
  }
  function endCropGesture(event: React.PointerEvent<HTMLDivElement>) {
    if (cropGesture.current?.pointerId === event.pointerId) cropGesture.current = null;
  }

  useEffect(() => {
    if (!url || !valid || !canvasRef.current) return;
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = crop.width; canvas.height = crop.height;
      const context = canvas.getContext("2d");
      if (!context) { setError("This browser could not create an image canvas."); return; }
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      setError("");
    };
    image.onerror = () => setError("The image could not be decoded.");
    image.src = url;
  }, [url, valid, crop.x, crop.y, crop.width, crop.height]);

  function chooseFile(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("image/")) { setError("Choose an image file."); return; }
    const nextUrl = URL.createObjectURL(next); const image = new Image();
    image.onload = () => {
      setFile(next); setUrl(nextUrl); setSize({ width: image.naturalWidth, height: image.naturalHeight });
      setLeft("0"); setTop("0"); setCropWidth(String(image.naturalWidth)); setCropHeight(String(image.naturalHeight)); setError("");
    };
    image.onerror = () => { URL.revokeObjectURL(nextUrl); setError("The image could not be opened."); };
    image.src = nextUrl;
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas || !file || !valid) return;
    canvas.toBlob((blob) => {
      if (!blob) { setError("The cropped image could not be exported."); return; }
      const result = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = result; anchor.download = `${file.name.replace(/\.[^.]+$/, "")}-crop-${crop.width}x${crop.height}.png`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(result), 1000);
    }, "image/png");
  }

  return <main className={`resize-page image-crop-page${file ? " has-media" : ""}`}>
    <ToolPageHeader />
    <section className="resize-intro"><p className="eyebrow">IMAGE · LOCAL PROCESSING</p><h1>Crop by exact pixels</h1><p>Set a crop rectangle in source-image coordinates. Cropping is an explicit separate action; the resize tool keeps the full frame.</p></section>
    {!file ? <MediaImportScreen kind="image" accept="image/*" onFile={chooseFile} error={error} /> : <section className="resize-workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>{file ? "Choose another image" : "Choose an image"}<input type="file" accept="image/*" onChange={(event) => chooseFile(event.currentTarget.files?.[0])} /></span></label>
        {file && <p className="source-info">{file.name} · Source {size.width} × {size.height} px</p>}
        <div className="dimension-fields"><label>Left <span>px</span><input type="number" min="0" max={size.width} step="1" value={left} onChange={(event) => setLeft(event.currentTarget.value)} /></label><label>Top <span>px</span><input type="number" min="0" max={size.height} step="1" value={top} onChange={(event) => setTop(event.currentTarget.value)} /></label></div>
        <div className="dimension-fields"><label>Crop width <span>px</span><input type="number" min="1" max={size.width} step="1" value={cropWidth} onChange={(event) => setCropWidth(event.currentTarget.value)} /></label><label>Crop height <span>px</span><input type="number" min="1" max={size.height} step="1" value={cropHeight} onChange={(event) => setCropHeight(event.currentTarget.value)} /></label></div>
        <p className="resize-note">{valid ? `Crop rectangle: (${crop.x}, ${crop.y}) · ${crop.width} × ${crop.height} px` : "Crop rectangle must be a positive integer area inside the source image."}</p>
        {error && <p className="resize-error" role="alert">{error}</p>}
        <button className="export-button" disabled={!valid} onClick={download}>Download cropped PNG</button>
      </div>
      <div className="resize-preview image-crop-preview">
        <div className="preview-heading"><strong>Select crop area</strong><span>{size.width} × {size.height} px source · drag handles to resize, drag inside to move</span></div>
        <div className="image-crop-stage" ref={cropStageRef} onPointerDown={beginCropGesture} onPointerMove={moveCropGesture} onPointerUp={endCropGesture} onPointerCancel={endCropGesture}>
          <img src={url} alt="Source image with an interactive crop selection" draggable={false} />
          <span className="crop-shade top" style={{ height: `${crop.y / size.height * 100}%` }} />
          <span className="crop-shade left" style={{ left: 0, top: `${crop.y / size.height * 100}%`, width: `${crop.x / size.width * 100}%`, height: `${crop.height / size.height * 100}%` }} />
          <span className="crop-shade right" style={{ left: `${(crop.x + crop.width) / size.width * 100}%`, top: `${crop.y / size.height * 100}%`, width: `${(size.width - crop.x - crop.width) / size.width * 100}%`, height: `${crop.height / size.height * 100}%` }} />
          <span className="crop-shade bottom" style={{ height: `${(size.height - crop.y - crop.height) / size.height * 100}%` }} />
          <div className="crop-selection" data-crop-selection="true" style={{ left: `${crop.x / size.width * 100}%`, top: `${crop.y / size.height * 100}%`, width: `${crop.width / size.width * 100}%`, height: `${crop.height / size.height * 100}%` }}>
            {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map((handle) => <span key={handle} className={`crop-selection-handle ${handle}`} data-crop-handle={handle} aria-hidden="true" />)}
          </div>
        </div>
        <div className="preview-heading crop-result-heading"><strong>Cropped result</strong><span>{valid ? `${crop.width} × ${crop.height} px` : "Adjust the crop selection"}</span></div>
        {file ? <canvas ref={canvasRef} className="preview-canvas crop-result-canvas" aria-label="Cropped image preview" /> : <div className="empty-preview">The cropped image will appear here.</div>}
      </div>
    </section>}
  </main>;
}
