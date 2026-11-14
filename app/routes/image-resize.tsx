import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/image-resize";
import { getProject, readProjectSource, saveImageSettings, saveProjectSource, type ImageProjectSettings } from "../lib/project-store";

type SourceImage = { file: File; url: string; width: number; height: number };

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Image Resize | Local Studio" },
    {
      name: "description",
      content: "Resize an image to exact pixel dimensions in your browser.",
    },
    { name: "robots", content: "index,follow" },
  ];
}

export function ImageResizeTool() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState<SourceImage | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [ratioMode, setRatioMode] = useState("free");
  const [customRatioWidth, setCustomRatioWidth] = useState("1");
  const [customRatioHeight, setCustomRatioHeight] = useState("1");
  const [brightness, setBrightness] = useState("100");
  const [contrast, setContrast] = useState("100");
  const [saturation, setSaturation] = useState("100");
  const [error, setError] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectStatus, setProjectStatus] = useState("");

  const originalRatio = source ? source.width / source.height : 1;
  const selectedRatio = ratioMode === "free" ? null
    : ratioMode === "original" ? originalRatio
      : ratioMode === "custom" ? Number(customRatioWidth) / Number(customRatioHeight)
        : Number(ratioMode.split(":")[0]) / Number(ratioMode.split(":")[1]);
  const ratio = selectedRatio !== null && Number.isFinite(selectedRatio) && selectedRatio > 0 ? selectedRatio : null;
  const outputValid = Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0
    && width <= 32768 && height <= 32768 && width * height <= 100_000_000;
  const ratioText = useMemo(
    () => (source ? `${source.width} × ${source.height}` : "No image selected"),
    [source],
  );

  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source.url);
    };
  }, [source]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!source || !canvas || !outputValid) return;
    const image = new Image();
    image.onload = () => {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        setError("This browser could not create an image canvas.");
        return;
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      const amount = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Math.min(300, Math.max(0, Number(value))) : 100;
      context.filter = `brightness(${amount(brightness)}%) contrast(${amount(contrast)}%) saturate(${amount(saturation)}%)`;
      context.drawImage(image, 0, 0, width, height);
      context.filter = "none";
      setError("");
    };
    image.onerror = () => setError("The selected image could not be decoded.");
    image.src = source.url;
  }, [source, width, height, outputValid, brightness, contrast, saturation]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      try {
        const project = await getProject(projectId);
        if (!project || project.kind !== "image") throw new Error("This image project is missing or has the wrong workspace type.");
        const file = await readProjectSource(projectId);
        if (cancelled) return;
        setProjectTitle(project.title);
        if (project.imageSettings) applySettings(project.imageSettings);
        if (!file) { setProjectStatus("Choose an image to attach it to this project."); return; }
        importImage(file, true, project.imageSettings);
      } catch (cause) {
        if (!cancelled) setProjectStatus(cause instanceof Error ? cause.message : "Could not restore this image project.");
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !source) return;
    const settings: ImageProjectSettings = { width, height, ratioMode, customRatioWidth, customRatioHeight, brightness, contrast, saturation };
    const timeout = window.setTimeout(() => {
      void saveImageSettings(projectId, settings).then(() => setProjectStatus("Project changes saved on this device."))
        .catch((cause: unknown) => setProjectStatus(cause instanceof Error ? cause.message : "Could not save project changes."));
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [projectId, source, width, height, ratioMode, customRatioWidth, customRatioHeight, brightness, contrast, saturation]);

  function applySettings(settings: ImageProjectSettings) {
    setWidth(settings.width); setHeight(settings.height); setRatioMode(settings.ratioMode);
    setCustomRatioWidth(settings.customRatioWidth); setCustomRatioHeight(settings.customRatioHeight);
    setBrightness(settings.brightness); setContrast(settings.contrast); setSaturation(settings.saturation);
  }

  function importImage(file?: File, restoring = false, settings?: ImageProjectSettings) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setSource({ file, url, width: image.naturalWidth, height: image.naturalHeight });
      if (settings) applySettings(settings);
      else { setWidth(image.naturalWidth); setHeight(image.naturalHeight); }
      setError("");
      if (projectId && !restoring) {
        setProjectStatus("Saving source image…");
        void saveProjectSource(projectId, file).then(() => setProjectStatus("Source image saved on this device."))
          .catch((cause: unknown) => setProjectStatus(cause instanceof Error ? cause.message : "Could not save the source image."));
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setError("The selected image could not be opened.");
    };
    image.src = url;
  }

  function changeWidth(value: number) {
    setWidth(value);
    if (ratio && Number.isFinite(value) && value > 0) {
      setHeight(Math.max(1, Math.round(value / ratio)));
    }
  }

  function changeHeight(value: number) {
    setHeight(value);
    if (ratio && Number.isFinite(value) && value > 0) {
      setWidth(Math.max(1, Math.round(value * ratio)));
    }
  }

  function chooseRatio(value: string) {
    setRatioMode(value);
    if (value !== "free" && source) {
      const nextRatio = value === "original" ? originalRatio
        : value === "custom" ? Number(customRatioWidth) / Number(customRatioHeight)
          : Number(value.split(":")[0]) / Number(value.split(":")[1]);
      if (Number.isFinite(nextRatio) && nextRatio > 0) setHeight(Math.max(1, Math.round(width / nextRatio)));
    }
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas || !source || !outputValid) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("The resized image could not be exported.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${source.file.name.replace(/\.[^.]+$/, "")}-${width}x${height}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  return (
    <main className="resize-page">
      <header className="resize-header">
        <a href="/" className="brand">Local Studio</a>
        <nav aria-label="Main navigation"><a href="/projects">Projects</a></nav>
      </header>
      <section className="resize-intro">
        <p className="eyebrow">IMAGE TOOL · PRIVATE BY DESIGN</p>
        <h1>Resize and adjust your image.</h1>
        <p>Set exact output pixels and tune brightness, contrast, and saturation. Your image stays in this browser.</p>
      </section>
      <section className="resize-workspace" aria-label="Image resizing workspace">
        <div className="resize-controls">
          <label className="file-picker">
            <span>{source ? "Choose another image" : "Choose an image"}</span>
            <input type="file" accept="image/*" onChange={(event) => importImage(event.currentTarget.files?.[0])} />
          </label>
          {projectId && <p className="resize-note" role="status">Project: {projectTitle || "Loading…"}. {projectStatus}</p>}
          {source && <p className="source-info">Original: {ratioText} px</p>}
          <div className="dimension-fields">
            <label>Width <span>px</span><input type="number" min="1" step="1" value={width || ""} onChange={(event) => changeWidth(event.currentTarget.valueAsNumber)} /></label>
            <label>Height <span>px</span><input type="number" min="1" step="1" value={height || ""} onChange={(event) => changeHeight(event.currentTarget.valueAsNumber)} /></label>
          </div>
          <label className="ratio-field">Aspect ratio<select value={ratioMode} onChange={(event) => chooseRatio(event.currentTarget.value)}><option value="free">Custom dimensions (stretch)</option><option value="original">Original ratio</option><option value="1:1">1:1 · Square</option><option value="4:3">4:3</option><option value="3:2">3:2</option><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="custom">Custom ratio</option></select></label>
          {ratioMode === "custom" && <div className="dimension-fields"><label>Ratio width<input type="number" min="1" step="any" value={customRatioWidth} onChange={(event) => { setCustomRatioWidth(event.currentTarget.value); if (Number(event.currentTarget.value) > 0) setHeight(Math.max(1, Math.round(width * Number(customRatioHeight) / Number(event.currentTarget.value)))); }} /></label><label>Ratio height<input type="number" min="1" step="any" value={customRatioHeight} onChange={(event) => { setCustomRatioHeight(event.currentTarget.value); if (Number(event.currentTarget.value) > 0) setHeight(Math.max(1, Math.round(width * Number(event.currentTarget.value) / Number(customRatioWidth)))); }} /></label></div>}
          <p className="resize-note">{ratio ? "Changing either dimension keeps the selected ratio. The full image is stretched to fit; no crop or padding is added." : "Custom dimensions resize the full image without cropping or padding."} Exports are limited to 100 megapixels and 32,768 px per side.</p>
          <div className="filter-fields" aria-label="Image adjustments">
            <label>Brightness <span>0–300%</span><input type="number" min="0" max="300" step="any" value={brightness} onChange={(event) => setBrightness(event.currentTarget.value)} /></label>
            <label>Contrast <span>0–300%</span><input type="number" min="0" max="300" step="any" value={contrast} onChange={(event) => setContrast(event.currentTarget.value)} /></label>
            <label>Saturation <span>0–300%</span><input type="number" min="0" max="300" step="any" value={saturation} onChange={(event) => setSaturation(event.currentTarget.value)} /></label>
          </div>
          <button className="export-button" type="button" disabled={!source || !outputValid} onClick={download}>Download PNG</button>
          {error && <p className="resize-error" role="alert">{error}</p>}
        </div>
        <div className="resize-preview">
          <div className="preview-heading"><strong>Output preview</strong><span>{source && outputValid ? `${width} × ${height} px` : "Choose an image to begin"}</span></div>
          {!source && <div className="empty-preview">Your image preview will appear here.</div>}
          <canvas ref={canvasRef} className={source ? "preview-canvas" : "preview-canvas hidden"} aria-label="Resized image preview" />
        </div>
      </section>
    </main>
  );
}

export default function ImageResize() {
  return <ImageResizeTool />;
}
