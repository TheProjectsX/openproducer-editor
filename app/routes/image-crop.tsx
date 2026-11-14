import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/image-crop";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Crop image | Local Studio" },
    { name: "description", content: "Crop a local image by exact pixel coordinates in your browser." },
  ];
}

export default function ImageCrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  return <main className="resize-page">
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/tools/image/resize">Image editor</a></nav></header>
    <section className="resize-intro"><p className="eyebrow">IMAGE · LOCAL PROCESSING</p><h1>Crop by exact pixels</h1><p>Set a crop rectangle in source-image coordinates. Cropping is an explicit separate action; the resize tool keeps the full frame.</p></section>
    <section className="resize-workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>{file ? "Choose another image" : "Choose an image"}<input type="file" accept="image/*" onChange={(event) => chooseFile(event.currentTarget.files?.[0])} /></span></label>
        {file && <p className="source-info">{file.name} · Source {size.width} × {size.height} px</p>}
        <div className="dimension-fields"><label>Left <span>px</span><input type="number" min="0" max={size.width} step="1" value={left} onChange={(event) => setLeft(event.currentTarget.value)} /></label><label>Top <span>px</span><input type="number" min="0" max={size.height} step="1" value={top} onChange={(event) => setTop(event.currentTarget.value)} /></label></div>
        <div className="dimension-fields"><label>Crop width <span>px</span><input type="number" min="1" max={size.width} step="1" value={cropWidth} onChange={(event) => setCropWidth(event.currentTarget.value)} /></label><label>Crop height <span>px</span><input type="number" min="1" max={size.height} step="1" value={cropHeight} onChange={(event) => setCropHeight(event.currentTarget.value)} /></label></div>
        <p className="resize-note">{valid ? `Crop rectangle: (${crop.x}, ${crop.y}) · ${crop.width} × ${crop.height} px` : "Crop rectangle must be a positive integer area inside the source image."}</p>
        {error && <p className="resize-error" role="alert">{error}</p>}
        <button className="export-button" disabled={!valid} onClick={download}>Download cropped PNG</button>
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>Cropped result</strong><span>{valid ? `${crop.width} × ${crop.height} px` : "Choose an image to begin"}</span></div>{file ? <canvas ref={canvasRef} className="preview-canvas" aria-label="Cropped image preview" /> : <div className="empty-preview">The cropped image will appear here.</div>}</div>
    </section>
  </main>;
}
