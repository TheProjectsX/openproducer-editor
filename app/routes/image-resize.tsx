import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/image-resize";
import { getProject, readProjectSource, saveImageSettings, saveProjectSource, type ImageLayer, type ImageProjectSettings } from "../lib/project-store";
import { createImageHistory, recordImageEdit, redoImageEdit, undoImageEdit } from "../lib/image-history";
import { MediaImportScreen } from "../components/media-import-screen";

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

export function ImageResizeTool({ workspace = false }: { workspace?: boolean } = {}) {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionCanvasRef = useRef<HTMLCanvasElement>(null);
  const layerGestureRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; layer: ImageLayer; last: ImageLayer; mode: "move" | "resize" } | null>(null);
  const [source, setSource] = useState<SourceImage | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [ratioMode, setRatioMode] = useState("free");
  const [customRatioWidth, setCustomRatioWidth] = useState("1");
  const [customRatioHeight, setCustomRatioHeight] = useState("1");
  const [brightness, setBrightness] = useState("100");
  const [contrast, setContrast] = useState("100");
  const [saturation, setSaturation] = useState("100");
  const [rotation, setRotation] = useState("0");
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg">("png");
  const [jpegQuality, setJpegQuality] = useState("0.92");
  const [layers, setLayers] = useState<ImageLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const historyRef = useRef(createImageHistory<ImageProjectSettings>());
  const [, refreshHistory] = useState(0);
  const [error, setError] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectStatus, setProjectStatus] = useState("");

  const originalRatio = source ? source.width / source.height : 1;
  const selectedRatio = ratioMode === "free" ? null
    : ratioMode === "original" ? originalRatio
      : ratioMode === "custom" ? Number(customRatioWidth) / Number(customRatioHeight)
        : Number(ratioMode.split(":")[0]) / Number(ratioMode.split(":")[1]);
  const ratio = selectedRatio !== null && Number.isFinite(selectedRatio) && selectedRatio > 0 ? selectedRatio : null;
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId);
  const degrees = Number(rotation), radians = degrees * Math.PI / 180;
  const sin = Math.abs(Math.sin(radians)) < 1e-10 ? 0 : Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians)) < 1e-10 ? 0 : Math.abs(Math.cos(radians));
  const rotatedWidth = Math.ceil(Math.abs(width * cos) + Math.abs(height * sin));
  const rotatedHeight = Math.ceil(Math.abs(width * sin) + Math.abs(height * cos));
  const outputValid = Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0
    && Number.isFinite(degrees) && degrees >= -180 && degrees <= 180
    && rotatedWidth <= 32768 && rotatedHeight <= 32768 && rotatedWidth * rotatedHeight <= 100_000_000;
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
      canvas.width = rotatedWidth;
      canvas.height = rotatedHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        setError("This browser could not create an image canvas.");
        return;
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      const amount = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Math.min(300, Math.max(0, Number(value))) : 100;
      context.translate(rotatedWidth / 2, rotatedHeight / 2);
      context.rotate(radians);
      if (flipHorizontal) context.scale(-1, 1);
      context.filter = `brightness(${amount(brightness)}%) contrast(${amount(contrast)}%) saturate(${amount(saturation)}%)`;
      context.drawImage(image, -width / 2, -height / 2, width, height);
      context.filter = "none";
      for (const layer of layers) {
        if (!layer.visible) continue;
        context.fillStyle = layer.fill;
        const left = layer.x - width / 2, top = layer.y - height / 2;
        if (layer.kind === "rectangle") context.fillRect(left, top, layer.width, layer.height);
        else if (layer.kind === "ellipse") { context.beginPath(); context.ellipse(left + layer.width / 2, top + layer.height / 2, layer.width / 2, layer.height / 2, 0, 0, Math.PI * 2); context.fill(); }
        else { context.font = `700 ${layer.fontSize}px system-ui, sans-serif`; context.textBaseline = "top"; context.fillText(layer.text, left, top, Math.max(1, layer.width)); }
      }
      setError("");
    };
    image.onerror = () => setError("The selected image could not be decoded.");
    image.src = source.url;
  }, [source, width, height, rotatedWidth, rotatedHeight, radians, flipHorizontal, outputValid, brightness, contrast, saturation, layers]);

  useEffect(() => {
    const canvas = canvasRef.current, overlay = interactionCanvasRef.current;
    const context = overlay?.getContext("2d");
    if (!canvas || !overlay || !context || !source || !outputValid) return;
    overlay.width = canvas.width; overlay.height = canvas.height;
    context.clearRect(0, 0, overlay.width, overlay.height);
    const selected = layers.find((layer) => layer.id === selectedLayerId && layer.visible);
    if (!selected) return;
    const point = (x: number, y: number) => {
      let dx = x - width / 2, dy = y - height / 2;
      if (flipHorizontal) dx *= -1;
      return { x: rotatedWidth / 2 + dx * Math.cos(radians) - dy * Math.sin(radians), y: rotatedHeight / 2 + dx * Math.sin(radians) + dy * Math.cos(radians) };
    };
    const corners = [point(selected.x, selected.y), point(selected.x + selected.width, selected.y), point(selected.x + selected.width, selected.y + selected.height), point(selected.x, selected.y + selected.height)];
    context.beginPath(); context.moveTo(corners[0].x, corners[0].y);
    for (const corner of corners.slice(1)) context.lineTo(corner.x, corner.y);
    context.closePath(); context.strokeStyle = "#a7c8ff"; context.lineWidth = Math.max(1, overlay.width / 900); context.setLineDash([7, 4]); context.stroke(); context.setLineDash([]);
    const handle = corners[2], radius = Math.max(5, overlay.width / 110);
    context.fillStyle = "#dceaff"; context.strokeStyle = "#3979e6"; context.lineWidth = Math.max(2, overlay.width / 500);
    context.beginPath(); context.rect(handle.x - radius, handle.y - radius, radius * 2, radius * 2); context.fill(); context.stroke();
  }, [source, width, height, rotatedWidth, rotatedHeight, radians, flipHorizontal, outputValid, layers, selectedLayerId]);

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
    const settings: ImageProjectSettings = { width, height, ratioMode, customRatioWidth, customRatioHeight, brightness, contrast, saturation, rotation, flipHorizontal, layers, exportFormat, jpegQuality };
    const timeout = window.setTimeout(() => {
      void saveImageSettings(projectId, settings).then(() => setProjectStatus("Project changes saved on this device."))
        .catch((cause: unknown) => setProjectStatus(cause instanceof Error ? cause.message : "Could not save project changes."));
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [projectId, source, width, height, ratioMode, customRatioWidth, customRatioHeight, brightness, contrast, saturation, rotation, flipHorizontal, layers, exportFormat, jpegQuality]);

  useEffect(() => {
    if (!source) return;
    if (layerGestureRef.current) return;
    const snapshot = getSettingsSnapshot();
    if (recordImageEdit(historyRef.current, source.file, snapshot)) refreshHistory((version) => version + 1);
  }, [source, width, height, ratioMode, customRatioWidth, customRatioHeight, brightness, contrast, saturation, rotation, flipHorizontal, layers, exportFormat, jpegQuality]);

  function getSettingsSnapshot(): ImageProjectSettings {
    return structuredClone({ width, height, ratioMode, customRatioWidth, customRatioHeight, brightness, contrast, saturation, rotation, flipHorizontal, layers, exportFormat, jpegQuality });
  }

  function applySettings(settings: ImageProjectSettings) {
    setWidth(settings.width); setHeight(settings.height); setRatioMode(settings.ratioMode);
    setCustomRatioWidth(settings.customRatioWidth); setCustomRatioHeight(settings.customRatioHeight);
    setBrightness(settings.brightness); setContrast(settings.contrast); setSaturation(settings.saturation);
    setRotation(settings.rotation ?? "0"); setFlipHorizontal(settings.flipHorizontal ?? false);
    setLayers(settings.layers ?? []);
    setExportFormat(settings.exportFormat ?? "png"); setJpegQuality(settings.jpegQuality ?? "0.92");
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
      else { setWidth(image.naturalWidth); setHeight(image.naturalHeight); setLayers([]); setSelectedLayerId(""); }
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

  function updateLayers(next: ImageLayer[]) {
    setLayers(next);
  }
  function addLayer(kind: ImageLayer["kind"]) {
    const layer: ImageLayer = { id: crypto.randomUUID(), kind, x: Math.round(width * 0.1), y: Math.round(height * 0.1), width: Math.max(40, Math.round(width * 0.35)), height: Math.max(32, Math.round(height * 0.18)), fontSize: 48, fill: kind === "text" ? "#ffffff" : "#ec4899", text: "Your text", visible: true };
    updateLayers([...layers, layer]); setSelectedLayerId(layer.id);
  }
  function updateLayer(id: string, values: Partial<ImageLayer>) {
    updateLayers(layers.map((layer) => layer.id === id ? { ...layer, ...values } : layer));
  }
  function imagePointFromPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current, overlay = interactionCanvasRef.current;
    if (!canvas || !overlay) return null;
    const bounds = overlay.getBoundingClientRect();
    const outputX = (event.clientX - bounds.left) * overlay.width / bounds.width - rotatedWidth / 2;
    const outputY = (event.clientY - bounds.top) * overlay.height / bounds.height - rotatedHeight / 2;
    let x = outputX * Math.cos(radians) + outputY * Math.sin(radians);
    const y = -outputX * Math.sin(radians) + outputY * Math.cos(radians);
    if (flipHorizontal) x *= -1;
    return { x: x + width / 2, y: y + height / 2 };
  }
  function beginLayerGesture(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!source || !outputValid) return;
    const point = imagePointFromPointer(event); if (!point) return;
    const hit = [...layers].reverse().find((layer) => layer.visible && point.x >= layer.x && point.x <= layer.x + layer.width && point.y >= layer.y && point.y <= layer.y + layer.height);
    if (!hit) { setSelectedLayerId(""); return; }
    setSelectedLayerId(hit.id);
    const bounds = event.currentTarget.getBoundingClientRect();
    const tolerance = 14 * event.currentTarget.width / Math.max(1, bounds.width);
    const mode = hit.id === selectedLayerId && Math.abs(point.x - hit.x - hit.width) <= tolerance && Math.abs(point.y - hit.y - hit.height) <= tolerance ? "resize" : "move";
    layerGestureRef.current = { id: hit.id, pointerId: event.pointerId, startX: point.x, startY: point.y, layer: hit, last: hit, mode };
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function moveLayerGesture(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = layerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const point = imagePointFromPointer(event); if (!point) return;
    const dx = point.x - gesture.startX, dy = point.y - gesture.startY;
    const updated = gesture.mode === "move"
      ? { ...gesture.layer, x: gesture.layer.x + dx, y: gesture.layer.y + dy }
      : { ...gesture.layer, width: Math.max(1, gesture.layer.width + dx), height: Math.max(1, gesture.layer.height + dy) };
    gesture.last = updated;
    setLayers((current) => current.map((layer) => layer.id === gesture.id ? updated : layer));
  }
  function endLayerGesture(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = layerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    layerGestureRef.current = null;
    const finalLayers = layers.map((layer) => layer.id === gesture.id ? gesture.last : layer);
    setLayers(finalLayers);
    const snapshot = structuredClone({ width, height, ratioMode, customRatioWidth, customRatioHeight, brightness, contrast, saturation, rotation, flipHorizontal, layers: finalLayers, exportFormat, jpegQuality });
    if (recordImageEdit(historyRef.current, source?.file, snapshot)) refreshHistory((version) => version + 1);
  }
  function reorderLayer(id: string, direction: -1 | 1) {
    const index = layers.findIndex((layer) => layer.id === id), nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= layers.length) return;
    const next = [...layers]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; updateLayers(next);
  }
  function undoEdit() {
    const previous = undoImageEdit(historyRef.current); if (!previous) return;
    applySettings(previous);
    refreshHistory((version) => version + 1);
  }
  function redoEdit() {
    const next = redoImageEdit(historyRef.current); if (!next) return;
    applySettings(next);
    refreshHistory((version) => version + 1);
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
    const quality = Number(jpegQuality);
    if (exportFormat === "jpeg" && (!Number.isFinite(quality) || quality < 0 || quality > 1)) {
      setError("JPEG quality must be a number from 0 through 1.");
      return;
    }
    let outputCanvas = canvas;
    if (exportFormat === "jpeg") {
      outputCanvas = document.createElement("canvas");
      outputCanvas.width = canvas.width; outputCanvas.height = canvas.height;
      const context = outputCanvas.getContext("2d");
      if (!context) { setError("This browser could not prepare the JPEG export."); return; }
      context.fillStyle = "#ffffff"; context.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
      context.drawImage(canvas, 0, 0);
    }
    const mime = exportFormat === "jpeg" ? "image/jpeg" : "image/png";
    outputCanvas.toBlob((blob) => {
      if (!blob) {
        setError(`The ${exportFormat.toUpperCase()} image could not be exported.`);
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${source.file.name.replace(/\.[^.]+$/, "")}-${rotatedWidth}x${rotatedHeight}.${exportFormat === "jpeg" ? "jpg" : "png"}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, mime, exportFormat === "jpeg" ? quality : undefined);
  }

  return (
    <main className={`resize-page${workspace ? " has-media" : ""}`}>
      <header className="resize-header">
        <a href="/" className="brand">Local Studio</a>
        <nav aria-label="Main navigation"><a href="/projects">Projects</a></nav>
      </header>
      <section className="resize-intro">
        <p className="eyebrow">{workspace ? "IMAGE STUDIO · LOCAL PROJECT" : "IMAGE TOOL · PRIVATE BY DESIGN"}</p>
        <h1>{workspace ? "Edit your image project." : "Resize and adjust your image."}</h1>
        <p>{workspace ? "Resize, rotate, flip, adjust color, and arrange editable text and shape layers. Project instructions and source image stay on this device." : "Set exact output pixels and tune brightness, contrast, and saturation. Your image stays in this browser."}</p>
      </section>
      {!source ? <MediaImportScreen kind="image" accept="image/*" onFile={(next) => importImage(next)} error={error} /> : <section className="resize-workspace" aria-label="Image resizing workspace" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); importImage(event.dataTransfer.files?.[0]); }}>
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
          <div className="speed-presets" aria-label="Common image filter presets"><button type="button" onClick={() => { setBrightness("100"); setContrast("100"); setSaturation("0"); }}>Grayscale</button><button type="button" onClick={() => { setBrightness("105"); setContrast("115"); setSaturation("135"); }}>Vivid</button><button type="button" onClick={() => { setBrightness("100"); setContrast("92"); setSaturation("75"); }}>Muted</button><button type="button" onClick={() => { setBrightness("100"); setContrast("100"); setSaturation("100"); }}>Reset filters</button></div>
          <label className="speed-field">Rotation <span>custom degrees · −180 to 180</span><input type="number" min="-180" max="180" step="any" value={rotation} onChange={(event) => setRotation(event.currentTarget.value)} /></label>
          <label className="ratio-toggle"><input type="checkbox" checked={flipHorizontal} onChange={(event) => setFlipHorizontal(event.currentTarget.checked)} /> Flip horizontally</label>
          <label className="ratio-field">Export format<select value={exportFormat} onChange={(event) => setExportFormat(event.currentTarget.value as "png" | "jpeg")}><option value="png">PNG (lossless, transparency)</option><option value="jpeg">JPEG (white background)</option></select></label>
          {exportFormat === "jpeg" && <label className="speed-field">JPEG quality <span>custom value from 0 to 1</span><input type="number" min="0" max="1" step="any" value={jpegQuality} onChange={(event) => setJpegQuality(event.currentTarget.value)} /></label>}
          <section className="image-layers" aria-label="Image layers">
            <div className="preview-heading"><strong>Layers</strong><span>{layers.length}</span></div>
            <div className="image-layer-actions"><button type="button" className="secondary-button" disabled={!source} onClick={() => addLayer("text")}>Add text</button><button type="button" className="secondary-button" disabled={!source} onClick={() => addLayer("rectangle")}>Add rectangle</button><button type="button" className="secondary-button" disabled={!source} onClick={() => addLayer("ellipse")}>Add ellipse</button></div>
            <div className="image-layer-list">{layers.map((layer, index) => <div className={`image-layer-row ${selectedLayerId === layer.id ? "selected" : ""}`} key={layer.id}><button type="button" className="image-layer-select" onClick={() => setSelectedLayerId(layer.id)}>{index + 1}. {layer.kind === "text" ? layer.text || "Text" : layer.kind}</button><button type="button" aria-label={`Move layer ${index + 1} up`} disabled={index === 0} onClick={() => reorderLayer(layer.id, -1)}>↑</button><button type="button" aria-label={`Move layer ${index + 1} down`} disabled={index === layers.length - 1} onClick={() => reorderLayer(layer.id, 1)}>↓</button><button type="button" aria-label={`Remove layer ${index + 1}`} onClick={() => { updateLayers(layers.filter((item) => item.id !== layer.id)); if (selectedLayerId === layer.id) setSelectedLayerId(""); }}>×</button></div>)}</div>
            {selectedLayer && <div className="filter-fields two-column transform-fields">
              <label>Layer left <span>px</span><input type="number" step="any" value={selectedLayer.x} onChange={(event) => updateLayer(selectedLayer.id, { x: event.currentTarget.valueAsNumber })} /></label>
              <label>Layer top <span>px</span><input type="number" step="any" value={selectedLayer.y} onChange={(event) => updateLayer(selectedLayer.id, { y: event.currentTarget.valueAsNumber })} /></label>
              <label>Layer width <span>px</span><input type="number" min="1" step="any" value={selectedLayer.width} onChange={(event) => updateLayer(selectedLayer.id, { width: event.currentTarget.valueAsNumber })} /></label>
              <label>Layer height <span>px</span><input type="number" min="1" step="any" value={selectedLayer.height} onChange={(event) => updateLayer(selectedLayer.id, { height: event.currentTarget.valueAsNumber })} /></label>
              {selectedLayer.kind === "text" && <label>Font size <span>px</span><input type="number" min="8" max="512" step="any" value={selectedLayer.fontSize} onChange={(event) => updateLayer(selectedLayer.id, { fontSize: event.currentTarget.valueAsNumber })} /></label>}
              <label>Layer color<input type="color" value={selectedLayer.fill} onChange={(event) => updateLayer(selectedLayer.id, { fill: event.currentTarget.value })} /></label>
              {selectedLayer.kind === "text" && <label className="ratio-field">Text<textarea rows={2} maxLength={500} value={selectedLayer.text} onChange={(event) => updateLayer(selectedLayer.id, { text: event.currentTarget.value })} /></label>}
              <label className="ratio-toggle"><input type="checkbox" checked={selectedLayer.visible} onChange={(event) => updateLayer(selectedLayer.id, { visible: event.currentTarget.checked })} />Show layer</label>
            </div>}
            <div className="image-layer-actions"><button type="button" className="secondary-button" disabled={historyRef.current.undo.length === 0} onClick={undoEdit}>Undo</button><button type="button" className="secondary-button" disabled={historyRef.current.redo.length === 0} onClick={redoEdit}>Redo</button></div>
          </section>
          <button className="export-button" type="button" disabled={!source || !outputValid} onClick={download}>Download {exportFormat.toUpperCase()}</button>
          {error && <p className="resize-error" role="alert">{error}</p>}
        </div>
        <div className="resize-preview">
          <div className="preview-heading"><strong>Output preview</strong><span>{source && outputValid ? `${rotatedWidth} × ${rotatedHeight} px` : "Choose an image to begin"}</span></div>
          {!source && <div className="empty-preview">Your image preview will appear here.</div>}
          <div className={`image-editor-canvas-stage${source ? "" : " hidden"}`}>
            <canvas ref={canvasRef} className="preview-canvas" aria-label="Resized image preview" />
            {source && <canvas ref={interactionCanvasRef} className="image-layer-interaction" aria-label="Image overlay layers. Drag a selected layer to move it or drag its corner to resize." onPointerDown={beginLayerGesture} onPointerMove={moveLayerGesture} onPointerUp={endLayerGesture} onPointerCancel={endLayerGesture} />}
          </div>
          {!source && <div className="empty-preview">Your image preview will appear here.</div>}
        </div>
      </section>}
    </main>
  );
}

export default function ImageResize() {
  return <ImageResizeTool />;
}
