import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/image-upscale";
import { CanvasBackgroundPicker, ImageCanvasViewport, type CanvasBgMode } from "../components/image-canvas-viewport";
import { MediaImportScreen } from "../components/media-import-screen";
import { ProcessingProgress } from "../components/processing-progress";

const MAX_PIXELS = 50_000_000;
const MAX_SIDE = 32_768;
const TILE_SIZE = 256;
const TILE_OVERLAP = 16;
const MODEL_WEBGPU = "/models/realesr-general-x4v3-fp16.onnx";
const MODEL_WASM = "/models/realesr-general-x4v3-fp32.onnx";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Upscale image | OpenProducer Editor" },
    { name: "description", content: "Enhance and upscale a local image with an on-device AI model. Works offline." },
  ];
}

export default function ImageUpscale() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<import("onnxruntime-web").InferenceSession | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [mode, setMode] = useState("scale");
  const [scale, setScale] = useState("2");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [matchRatio, setMatchRatio] = useState(true);
  const [upscaling, setUpscaling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [backend, setBackend] = useState("");
  const [upscaleReady, setUpscaleReady] = useState(false);
  const [comparePosition, setComparePosition] = useState(50);
  const [canvasBg, setCanvasBg] = useState<CanvasBgMode>("dark-checker");
  const [error, setError] = useState("");

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => { void sessionRef.current?.release(); }, []);
  const output = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) return { width: 0, height: 0 };
    const multiplier = Number(scale);
    if (mode === "scale") return { width: Math.round(naturalSize.width * multiplier), height: Math.round(naturalSize.height * multiplier) };
    return { width, height };
  }, [naturalSize, mode, scale, width, height]);
  const valid = Number.isInteger(output.width) && Number.isInteger(output.height) && output.width >= naturalSize.width && output.height >= naturalSize.height
    && output.width <= MAX_SIDE && output.height <= MAX_SIDE && output.width * output.height <= MAX_PIXELS;

  useEffect(() => {
    setUpscaleReady(false);
    const canvas = canvasRef.current, context = canvas?.getContext("2d");
    if (context) { context.clearRect(0, 0, canvas!.width, canvas!.height); canvas!.width = 0; canvas!.height = 0; }
  }, [url, output.width, output.height]);

  function chooseFile(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("image/")) { setError("Choose an image file."); return; }
    setUpscaleReady(false); setComparePosition(50); setError("");
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

  async function upscale() {
    const canvas = canvasRef.current;
    if (!file || !url || !canvas || !valid || upscaling) return;
    setUpscaling(true); setProgress(0); setPhase("Loading the on-device AI model…"); setError(""); setUpscaleReady(false);
    let image: HTMLImageElement | null = null;
    let activeBackend = backend || "on-device inference";
    try {
      if (!sessionRef.current) {
        try {
          const runtime = await import("onnxruntime-web/webgpu");
          sessionRef.current = await runtime.InferenceSession.create(MODEL_WEBGPU, { executionProviders: ["webgpu"] });
          activeBackend = "WebGPU"; setBackend(activeBackend);
        } catch {
          const runtime = await import("onnxruntime-web/wasm");
          sessionRef.current = await runtime.InferenceSession.create(MODEL_WASM, { executionProviders: ["wasm"] });
          activeBackend = "CPU · WebAssembly"; setBackend(activeBackend);
        }
      }
      const tensorRuntime = activeBackend === "WebGPU" ? await import("onnxruntime-web/webgpu") : await import("onnxruntime-web/wasm");
      image = new Image(); image.src = url;
      await new Promise<void>((resolve, reject) => { image!.onload = () => resolve(); image!.onerror = () => reject(new Error("The source image could not be decoded.")); });
      const session = sessionRef.current;
      if (!session) throw new Error("The AI model could not be initialized.");
      const sourceWidth = image.naturalWidth, sourceHeight = image.naturalHeight;
      canvas.width = output.width; canvas.height = output.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("This browser could not create the AI output canvas.");
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high"; context.clearRect(0, 0, output.width, output.height);
      const tileCanvas = document.createElement("canvas"), tileContext = tileCanvas.getContext("2d", { willReadFrequently: true });
      const outputCanvas = document.createElement("canvas"), outputContext = outputCanvas.getContext("2d");
      if (!tileContext || !outputContext) throw new Error("This browser could not prepare image tiles for the AI model.");
      const columns = Math.ceil(sourceWidth / TILE_SIZE), rows = Math.ceil(sourceHeight / TILE_SIZE), totalTiles = columns * rows;
      let completed = 0;
      setPhase("Enhancing image tiles locally…");
      for (let y = 0; y < sourceHeight; y += TILE_SIZE) for (let x = 0; x < sourceWidth; x += TILE_SIZE) {
        const left = Math.max(0, x - TILE_OVERLAP), top = Math.max(0, y - TILE_OVERLAP);
        const right = Math.min(sourceWidth, x + TILE_SIZE + TILE_OVERLAP), bottom = Math.min(sourceHeight, y + TILE_SIZE + TILE_OVERLAP);
        const tileWidth = right - left, tileHeight = bottom - top;
        tileCanvas.width = tileWidth; tileCanvas.height = tileHeight; tileContext.clearRect(0, 0, tileWidth, tileHeight);
        tileContext.drawImage(image, left, top, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight);
        const pixels = tileContext.getImageData(0, 0, tileWidth, tileHeight).data;
        const planeSize = tileWidth * tileHeight, planar = new Float32Array(planeSize * 3);
        for (let pixel = 0; pixel < planeSize; pixel++) {
          planar[pixel] = pixels[pixel * 4] / 255;
          planar[planeSize + pixel] = pixels[pixel * 4 + 1] / 255;
          planar[planeSize * 2 + pixel] = pixels[pixel * 4 + 2] / 255;
        }
        const inputTensor = new tensorRuntime.Tensor("float32", planar, [1, 3, tileHeight, tileWidth]);
        let outputTensor: import("onnxruntime-web").Tensor | undefined;
        try {
          const result = await session.run({ [session.inputNames[0]]: inputTensor });
          outputTensor = result[session.outputNames[0]];
          if (!outputTensor || outputTensor.dims.length !== 4) throw new Error("The AI model returned an unsupported result.");
          const enhancedWidth = outputTensor.dims[3], enhancedHeight = outputTensor.dims[2], enhanced = outputTensor.data as Float32Array;
          const enhancedPixels = new Uint8ClampedArray(enhancedWidth * enhancedHeight * 4), enhancedPlaneSize = enhancedWidth * enhancedHeight;
          for (let pixel = 0; pixel < enhancedPlaneSize; pixel++) {
            enhancedPixels[pixel * 4] = Math.max(0, Math.min(255, Math.round(enhanced[pixel] * 255)));
            enhancedPixels[pixel * 4 + 1] = Math.max(0, Math.min(255, Math.round(enhanced[enhancedPlaneSize + pixel] * 255)));
            enhancedPixels[pixel * 4 + 2] = Math.max(0, Math.min(255, Math.round(enhanced[enhancedPlaneSize * 2 + pixel] * 255)));
            enhancedPixels[pixel * 4 + 3] = 255;
          }
          outputCanvas.width = enhancedWidth; outputCanvas.height = enhancedHeight;
          outputContext.putImageData(new ImageData(enhancedPixels, enhancedWidth, enhancedHeight), 0, 0);
          const coreWidth = Math.min(TILE_SIZE, sourceWidth - x), coreHeight = Math.min(TILE_SIZE, sourceHeight - y);
          context.drawImage(outputCanvas, (x - left) * 4, (y - top) * 4, coreWidth * 4, coreHeight * 4,
            x * output.width / sourceWidth, y * output.height / sourceHeight,
            coreWidth * output.width / sourceWidth, coreHeight * output.height / sourceHeight);
        } finally { inputTensor.dispose(); outputTensor?.dispose(); }
        completed++;
        setProgress(Math.round(completed / totalTiles * 100));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
      // The model is RGB-only; apply the source alpha at the requested output size.
      const alphaCanvas = document.createElement("canvas"); alphaCanvas.width = output.width; alphaCanvas.height = output.height;
      const alphaContext = alphaCanvas.getContext("2d");
      if (alphaContext) {
        alphaContext.drawImage(image, 0, 0, output.width, output.height);
        context.globalCompositeOperation = "destination-in"; context.drawImage(alphaCanvas, 0, 0); context.globalCompositeOperation = "source-over";
      }
      setUpscaleReady(true); setPhase(`AI enhancement complete · ${activeBackend}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The AI upscaler could not process this image."); setPhase("");
      canvas.width = 0; canvas.height = 0;
    } finally { setUpscaling(false); }
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas || !valid || !file || !upscaleReady) return;
    canvas.toBlob((blob) => {
      if (!blob) { setError("The upscaled image could not be exported."); return; }
      const outputUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = outputUrl;
      anchor.download = `${file.name.replace(/\.[^.]+$/, "")}-upscaled-${output.width}x${output.height}.png`;
      anchor.click(); window.setTimeout(() => URL.revokeObjectURL(outputUrl), 1000);
    }, "image/png");
  }

  return <main className={`resize-page image-tool-page${file ? " has-media" : ""}`}>
    <ToolPageHeader status={file && valid ? `${output.width} × ${output.height} px` : undefined} />
    <section className="resize-intro"><p className="eyebrow">IMAGE · ON-DEVICE AI</p><h1>Upscale an image</h1><p>Enhance image detail with Real-ESRGAN, running on this device. The app includes the model for offline use.</p></section>
    {!file ? <MediaImportScreen kind="image" accept="image/*" onFile={chooseFile} error={error} /> : <section className="resize-workspace image-tool-workspace">
      <div className="resize-controls">
        <div className="audio-file-bar">
          <div className="audio-file-meta">
            <strong>{file.name}</strong>
            <span>Original {naturalSize.width} × {naturalSize.height} px</span>
          </div>
          <label className="audio-file-change">
            <span>Change file</span>
            <input type="file" accept="image/*" onChange={(event) => chooseFile(event.currentTarget.files?.[0])} />
          </label>
        </div>

        <div className="audio-output-summary">
          <div>
            <span>Source</span>
            <strong>{naturalSize.width} × {naturalSize.height} px</strong>
          </div>
          <div>
            <span>Target</span>
            <strong>{valid ? `${output.width} × ${output.height} px` : "—"}</strong>
          </div>
        </div>
        <label className="ratio-field">Sizing mode<select value={mode} onChange={(event) => setMode(event.currentTarget.value)}><option value="scale">Custom scale multiplier</option><option value="custom">Exact custom dimensions</option></select></label>
        {mode === "scale" ? <label className="speed-field">Scale multiplier <span>custom · 1× to 8×</span><input type="number" min="1" max="8" step="any" value={scale} onChange={(event) => setScale(event.currentTarget.value)} /></label> : <div className="dimension-fields"><label>Width <span>px</span><input type="number" min={naturalSize.width || 1} step="1" value={width || ""} onChange={(event) => changeWidth(event.currentTarget.valueAsNumber)} /></label><label>Height <span>px</span><input type="number" min={naturalSize.height || 1} step="1" value={height || ""} onChange={(event) => changeHeight(event.currentTarget.valueAsNumber)} /></label></div>}
        {mode === "custom" && <label className="ratio-toggle"><input type="checkbox" checked={matchRatio} onChange={(event) => { const enabled = event.currentTarget.checked; setMatchRatio(enabled); if (enabled && naturalSize.width) setHeight(Math.max(naturalSize.height, Math.round(width * naturalSize.height / naturalSize.width))); }} /> Match original aspect ratio</label>}
        <p className="resize-note">Real-ESRGAN creates plausible detail and can alter texture. Review the result before relying on it. Output: {output.width && output.height ? `${output.width} × ${output.height} px · ~${(output.width * output.height * 4 / 1024 / 1024).toFixed(1)} MiB raw` : "not calculated"}. Maximum 50 megapixels and 32,768 px per side. Model license: <a href="/models/REAL-ESRGAN-LICENSE.txt" target="_blank" rel="noreferrer">BSD-3-Clause</a>.</p>
        {error && <p className="resize-error" role="alert">{error}</p>}
        {file && !valid && !error && <p className="resize-error" role="alert">Enter output dimensions at least as large as the source and within the 50 megapixel limit.</p>}
        {upscaling && <ProcessingProgress label={phase || "Enhancing image locally"} value={progress} />}
        {!upscaleReady ? <button className="export-button" disabled={!file || !valid || upscaling} onClick={() => void upscale()}>{upscaling ? "Enhancing image…" : "AI upscale image"}</button> : <button className="export-button" disabled={!file || !valid} onClick={download}>Download enhanced PNG</button>}
        {upscaleReady && <p className="source-info" role="status">{phase || `AI enhancement complete · ${backend}`}. This model and your image stay on this device.</p>}
      </div>
      <div className="resize-preview image-stage upscale-preview">
        <div className="preview-heading">
          <strong>{upscaleReady ? "Before / after comparison" : "Upscaled preview"}</strong>
          <div className="image-stage-meta">
            <CanvasBackgroundPicker value={canvasBg} onChange={setCanvasBg} />
            <span>{file && valid ? `${output.width} × ${output.height} px` : "Choose an image to begin"}</span>
          </div>
        </div>
        {url ? (
          <ImageCanvasViewport canvasBg={canvasBg}>
            <div className="upscale-comparison" style={{ display: upscaleReady ? "" : "none", width: `min(100%, calc((100dvh - 180px) * ${output.width / Math.max(1, output.height)}))`, aspectRatio: `${output.width} / ${output.height}` }}>
              <canvas ref={canvasRef} className="upscale-comparison-enhanced" aria-label="AI-enhanced image" />
              <div className="upscale-comparison-original" style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}><img src={url} alt="Original image before enhancement" draggable={false} /></div>
              <span className="upscale-comparison-label before">Original</span><span className="upscale-comparison-label after">Enhanced</span>
              <span className="upscale-comparison-divider" style={{ left: `${comparePosition}%` }} aria-hidden="true"><i /></span>
              <input className="upscale-comparison-range" type="range" min="0" max="100" step="1" value={comparePosition} aria-label="Drag to compare original and enhanced image" onChange={(event) => setComparePosition(event.currentTarget.valueAsNumber)} />
            </div>
            {!upscaleReady && (
              <div className="upscale-source-preview">
                <img src={url} alt="Original image to enhance" draggable={false} />
                {upscaling && <div role="status" className="upscale-processing-overlay"><ProcessingProgress label={phase || "Enhancing image locally"} value={progress} /></div>}
              </div>
            )}
          </ImageCanvasViewport>
        ) : (
          <div className="empty-preview">Choose an image to begin.</div>
        )}
      </div>
    </section>}
  </main>;
}
