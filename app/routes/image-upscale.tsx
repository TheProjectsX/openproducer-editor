import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/image-upscale";
import { MediaImportScreen } from "../components/media-import-screen";

const MAX_PIXELS = 100_000_000;
const MAX_SIDE = 32_768;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Upscale image | Local Studio" },
    { name: "description", content: "Upscale a local image with custom dimensions and high-quality browser resampling." },
  ];
}

export default function ImageUpscale() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [mode, setMode] = useState("scale");
  const [scale, setScale] = useState("2");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [matchRatio, setMatchRatio] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const output = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) return { width: 0, height: 0 };
    const multiplier = Number(scale);
    if (mode === "scale") return { width: Math.round(naturalSize.width * multiplier), height: Math.round(naturalSize.height * multiplier) };
    return { width, height };
  }, [naturalSize, mode, scale, width, height]);
  const valid = Number.isInteger(output.width) && Number.isInteger(output.height) && output.width >= naturalSize.width && output.height >= naturalSize.height
    && output.width <= MAX_SIDE && output.height <= MAX_SIDE && output.width * output.height <= MAX_PIXELS;

  useEffect(() => {
    if (!url || !valid || !canvasRef.current) return;
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = output.width; canvas.height = output.height;
      const context = canvas.getContext("2d");
      if (!context) { setError("This browser could not create an image canvas."); return; }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, output.width, output.height);
      setError("");
    };
    image.onerror = () => setError("The image could not be decoded.");
    image.src = url;
  }, [url, output.width, output.height, valid]);

  function chooseFile(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("image/")) { setError("Choose an image file."); return; }
    const nextUrl = URL.createObjectURL(next);
    const image = new Image();
    image.onload = () => {
      setFile(next); setUrl(nextUrl);
      setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
      setWidth(image.naturalWidth * 2); setHeight(image.naturalHeight * 2); setError("");
    };
    image.onerror = () => { URL.revokeObjectURL(nextUrl); setError("The image could not be opened."); };
    image.src = nextUrl;
  }

  function changeWidth(value: number) {
    setMode("custom"); setWidth(value);
    if (matchRatio && Number.isFinite(value) && value > 0) setHeight(Math.max(naturalSize.height, Math.round(value * naturalSize.height / naturalSize.width)));
  }
  function changeHeight(value: number) {
    setMode("custom"); setHeight(value);
    if (matchRatio && Number.isFinite(value) && value > 0) setWidth(Math.max(naturalSize.width, Math.round(value * naturalSize.width / naturalSize.height)));
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas || !valid || !file) return;
    canvas.toBlob((blob) => {
      if (!blob) { setError("The upscaled image could not be exported."); return; }
      const outputUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = outputUrl;
      anchor.download = `${file.name.replace(/\.[^.]+$/, "")}-upscaled-${output.width}x${output.height}.png`;
      anchor.click(); window.setTimeout(() => URL.revokeObjectURL(outputUrl), 1000);
    }, "image/png");
  }

  return <main className={`resize-page${file ? " has-media" : ""}`}>
    <ToolPageHeader />
    <section className="resize-intro"><p className="eyebrow">IMAGE · LOCAL PROCESSING</p><h1>Upscale an image</h1><p>Choose a custom multiplier or exact output dimensions. Source pixels stay on this device.</p></section>
    {!file ? <MediaImportScreen kind="image" accept="image/*" onFile={chooseFile} error={error} /> : <section className="resize-workspace image-tool-workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>{file ? "Choose another image" : "Choose an image"}<input type="file" accept="image/*" onChange={(event) => chooseFile(event.currentTarget.files?.[0])} /></span></label>
        {file && <p className="source-info">{file.name} · Original {naturalSize.width} × {naturalSize.height} px</p>}
        <label className="ratio-field">Sizing mode<select value={mode} onChange={(event) => setMode(event.currentTarget.value)}><option value="scale">Custom scale multiplier</option><option value="custom">Exact custom dimensions</option></select></label>
        {mode === "scale" ? <label className="speed-field">Scale multiplier <span>custom · 1× to 8×</span><input type="number" min="1" max="8" step="any" value={scale} onChange={(event) => setScale(event.currentTarget.value)} /></label> : <div className="dimension-fields"><label>Width <span>px</span><input type="number" min={naturalSize.width || 1} step="1" value={width || ""} onChange={(event) => changeWidth(event.currentTarget.valueAsNumber)} /></label><label>Height <span>px</span><input type="number" min={naturalSize.height || 1} step="1" value={height || ""} onChange={(event) => changeHeight(event.currentTarget.valueAsNumber)} /></label></div>}
        {mode === "custom" && <label className="ratio-toggle"><input type="checkbox" checked={matchRatio} onChange={(event) => { const enabled = event.currentTarget.checked; setMatchRatio(enabled); if (enabled && naturalSize.width) setHeight(Math.max(naturalSize.height, Math.round(width * naturalSize.height / naturalSize.width))); }} /> Match original aspect ratio</label>}
        <p className="resize-note">High-quality browser canvas resampling enlarges pixels but does not generate new detail like an AI super-resolution model. Output: {output.width && output.height ? `${output.width} × ${output.height} px · ~${(output.width * output.height * 4 / 1024 / 1024).toFixed(1)} MiB raw` : "not calculated"}. Maximum 100 megapixels and 32,768 px per side.</p>
        {error && <p className="resize-error" role="alert">{error}</p>}
        {file && !valid && !error && <p className="resize-error" role="alert">Enter an upscale size at least as large as the source, within the output limits.</p>}
        <button className="export-button" disabled={!file || !valid} onClick={download}>Download upscaled PNG</button>
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>Upscaled preview</strong><span>{file && valid ? `${output.width} × ${output.height} px` : "Choose an image to begin"}</span></div>{url ? <canvas ref={canvasRef} className="preview-canvas" aria-label="Upscaled output preview" /> : <div className="empty-preview">The upscaled result will appear here.</div>}</div>
    </section>}
  </main>;
}
