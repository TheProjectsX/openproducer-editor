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
  const [horizontalLock, setHorizontalLock] = useState(false);
  const [verticalLock, setVerticalLock] = useState(false);
  const [aspectMode, setAspectMode] = useState("free");
  const [customRatioWidth, setCustomRatioWidth] = useState("1");
  const [customRatioHeight, setCustomRatioHeight] = useState("1");
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
  function selectedAspect() {
    if (aspectMode === "original") return size.width / size.height;
    if (aspectMode === "custom") return Number(customRatioWidth) / Number(customRatioHeight);
    if (aspectMode.includes(":")) { const [w, h] = aspectMode.split(":").map(Number); return w / h; }
    return 0;
  }
  function changeAspect(value: string) {
    setAspectMode(value);
    const ratio = value === "original" ? size.width / size.height : value === "custom" ? Number(customRatioWidth) / Number(customRatioHeight) : value.includes(":") ? Number(value.split(":")[0]) / Number(value.split(":")[1]) : 0;
    if (!Number.isFinite(ratio) || ratio <= 0 || !size.width || !size.height) return;
    let width = crop.width, height = Math.round(width / ratio);
    if (height > size.height) { height = size.height; width = Math.round(height * ratio); }
    const x = Math.round(crop.x + (crop.width - width) / 2), y = Math.round(crop.y + (crop.height - height) / 2);
    setCropRect(x, y, width, height);
  }
  function changeCustomRatio(width: string, height: string) {
    setCustomRatioWidth(width); setCustomRatioHeight(height);
    const ratio = Number(width) / Number(height);
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    let nextWidth = crop.width, nextHeight = Math.round(nextWidth / ratio);
    if (nextHeight > size.height) { nextHeight = size.height; nextWidth = Math.round(nextHeight * ratio); }
    setCropRect(crop.x + (crop.width - nextWidth) / 2, crop.y + (crop.height - nextHeight) / 2, nextWidth, nextHeight);
  }
  function setHorizontalInset(value: string) {
    const inset = Math.max(0, Math.min(Math.floor((size.width - 1) / 2), Math.round(Number(value))));
    setLeft(String(inset));
    if (horizontalLock) setCropWidth(String(Math.max(1, size.width - inset * 2)));
  }
  function setVerticalInset(value: string) {
    const inset = Math.max(0, Math.min(Math.floor((size.height - 1) / 2), Math.round(Number(value))));
    setTop(String(inset));
    if (verticalLock) setCropHeight(String(Math.max(1, size.height - inset * 2)));
  }
  function toggleHorizontalLock(enabled: boolean) {
    setHorizontalLock(enabled);
    if (enabled && size.width) {
      const inset = Math.round((size.width - crop.width) / 2);
      setLeft(String(Math.max(0, inset)));
      setCropWidth(String(size.width - Math.max(0, inset) * 2));
    }
  }
  function toggleVerticalLock(enabled: boolean) {
    setVerticalLock(enabled);
    if (enabled && size.height) {
      const inset = Math.round((size.height - crop.height) / 2);
      setTop(String(Math.max(0, inset)));
      setCropHeight(String(size.height - Math.max(0, inset) * 2));
    }
  }
  function changeCropDimension(axis: "width" | "height", raw: string) {
    const value = Math.max(1, Math.min(axis === "width" ? size.width : size.height, Math.round(Number(raw))));
    if (!Number.isFinite(value)) return;
    const ratio = selectedAspect();
    if (axis === "width") {
      let width = value, height = ratio > 0 ? Math.round(width / ratio) : crop.height;
      if (height > size.height) { height = size.height; width = ratio > 0 ? Math.round(height * ratio) : width; }
      const x = horizontalLock ? Math.round((size.width - width) / 2) : crop.x;
      const y = verticalLock ? Math.round((size.height - height) / 2) : Math.round(crop.y + (crop.height - height) / 2);
      setCropRect(x, y, width, height);
    } else {
      let height = value, width = ratio > 0 ? Math.round(height * ratio) : crop.width;
      if (width > size.width) { width = size.width; height = ratio > 0 ? Math.round(width / ratio) : height; }
      const y = verticalLock ? Math.round((size.height - height) / 2) : crop.y;
      const x = horizontalLock ? Math.round((size.width - width) / 2) : Math.round(crop.x + (crop.width - width) / 2);
      setCropRect(x, y, width, height);
    }
  }
  function centerCrop(axis: "horizontal" | "vertical") {
    if (axis === "horizontal") setLeft(String(Math.round((size.width - crop.width) / 2)));
    else setTop(String(Math.round((size.height - crop.height) / 2)));
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
    if (horizontalLock && (handle.includes("w") || handle.includes("e"))) {
      const center = gesture.left + gesture.width / 2;
      const half = Math.max(0.5, handle.includes("w") ? center - x : right - center);
      x = Math.max(0, center - half); right = Math.min(size.width, center + half);
    }
    if (verticalLock && (handle.includes("n") || handle.includes("s"))) {
      const center = gesture.top + gesture.height / 2;
      const half = Math.max(0.5, handle.includes("n") ? center - y : bottom - center);
      y = Math.max(0, center - half); bottom = Math.min(size.height, center + half);
    }
    const ratio = selectedAspect();
    if (ratio > 0 && Number.isFinite(ratio)) {
      let width = right - x, height = bottom - y;
      if (handle.includes("e") || handle.includes("w")) height = width / ratio;
      else width = height * ratio;
      width = Math.min(width, size.width); height = Math.min(height, size.height);
      const centerX = horizontalLock ? size.width / 2 : handle.includes("w") ? originalRight : handle.includes("e") ? gesture.left : (x + right) / 2;
      const centerY = verticalLock ? size.height / 2 : handle.includes("n") ? originalBottom : handle.includes("s") ? gesture.top : (y + bottom) / 2;
      x = horizontalLock ? centerX - width / 2 : handle.includes("w") ? centerX - width : handle.includes("e") ? centerX : centerX - width / 2;
      y = verticalLock ? centerY - height / 2 : handle.includes("n") ? centerY - height : handle.includes("s") ? centerY : centerY - height / 2;
      right = x + width; bottom = y + height;
    }
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
      setAspectMode("free"); setHorizontalLock(false); setVerticalLock(false);
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
        <h2 className="editor-sidebar-title">Crop Image</h2>
        <label className="file-picker"><span>{file ? "Choose another image" : "Choose an image"}<input type="file" accept="image/*" onChange={(event) => chooseFile(event.currentTarget.files?.[0])} /></span></label>
        {file && <p className="source-info">{file.name} · Source {size.width} × {size.height} px</p>}
        <label className="ratio-field">Aspect ratio<select value={aspectMode} onChange={(event) => changeAspect(event.currentTarget.value)}><option value="free">Free selection</option><option value="original">Original image ratio</option><option value="1:1">1:1 · Square</option><option value="4:3">4:3</option><option value="3:2">3:2</option><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="custom">Custom ratio</option></select></label>
        {aspectMode === "custom" && <div className="dimension-fields"><label>Ratio width<input type="number" min="0.001" step="any" value={customRatioWidth} onChange={(event) => changeCustomRatio(event.currentTarget.value, customRatioHeight)} /></label><label>Ratio height<input type="number" min="0.001" step="any" value={customRatioHeight} onChange={(event) => changeCustomRatio(customRatioWidth, event.currentTarget.value)} /></label></div>}
        <div className="dimension-fields"><label>Crop width <span>px</span><input type="number" min="1" max={size.width} step="1" value={cropWidth} onChange={(event) => changeCropDimension("width", event.currentTarget.value)} /></label><label>Crop height <span>px</span><input type="number" min="1" max={size.height} step="1" value={cropHeight} onChange={(event) => changeCropDimension("height", event.currentTarget.value)} /></label></div>
        <section className="crop-locks-group" aria-label="Symmetric crop spacing">
          <h3>Lock spacing</h3>
          <div className="crop-lock-control"><div className="crop-lock-heading"><strong>Lock horizontal spacing</strong><button type="button" role="switch" aria-checked={horizontalLock} aria-label="Lock horizontal spacing" className={`crop-space-switch${horizontalLock ? " active" : ""}`} onClick={() => toggleHorizontalLock(!horizontalLock)}><span /></button></div><label className="crop-inset-field"><span className="crop-inset-label">Horizontal inset</span><span className="crop-inset-value"><input type="number" min="0" max={Math.floor(size.width / 2)} step="1" value={left} onChange={(event) => setHorizontalInset(event.currentTarget.value)} /><small>px</small></span></label></div>
          <div className="crop-lock-control"><div className="crop-lock-heading"><strong>Lock vertical spacing</strong><button type="button" role="switch" aria-checked={verticalLock} aria-label="Lock vertical spacing" className={`crop-space-switch${verticalLock ? " active" : ""}`} onClick={() => toggleVerticalLock(!verticalLock)}><span /></button></div><label className="crop-inset-field"><span className="crop-inset-label">Vertical inset</span><span className="crop-inset-value"><input type="number" min="0" max={Math.floor(size.height / 2)} step="1" value={top} onChange={(event) => setVerticalInset(event.currentTarget.value)} /><small>px</small></span></label></div>
        </section>
        <section className="crop-centering-group" aria-label="Center crop selection">
          <h3>Center crop</h3>
          <div className="crop-center-actions">
            <button type="button" className="crop-center-button" onClick={() => centerCrop("horizontal")}><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="4" width="10" height="12" rx="1" /><path d="M2 10h4m-2-2-2 2 2 2m12-2h4m-2-2 2 2-2 2" /></svg><span>Center horizontally</span></button>
            <button type="button" className="crop-center-button" onClick={() => centerCrop("vertical")}><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="5" width="12" height="10" rx="1" /><path d="M10 2v4M8 4l2-2 2 2m-2 12v4m-2-2 2 2 2-2" /></svg><span>Center vertically</span></button>
          </div>
        </section>
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
