import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/image-collage";
import { createProject, getProject, readVideoAsset, saveCollageProject } from "../lib/project-store";
import { MediaImportScreen } from "../components/media-import-screen";

type ImageFile = { id: string; file: File; cellFit: "global" | "contain" | "cover"; cellScale: string; cellOffsetX: string; cellOffsetY: string; rotation: string; flipHorizontal: boolean; brightness: string; contrast: string; saturation: string };
type CellRect = { x: number; y: number; width: number; height: number };
const TEMPLATES = [
  { id: "grid", label: "Classic grid", summary: "Balanced cells" },
  { id: "feature-left", label: "Big photo left", summary: "Feature + stack" },
  { id: "feature-right", label: "Big photo right", summary: "Stack + feature" },
  { id: "feature-top", label: "Big photo top", summary: "Feature + row" },
  { id: "wide-row", label: "Wide strip", summary: "One horizontal row" },
  { id: "tall-column", label: "Tall strip", summary: "One vertical column" },
] as const;
type TemplateId = typeof TEMPLATES[number]["id"];
const MAX_SOURCE_BYTES = 512 * 1024 * 1024;
const MAX_OUTPUT_PIXELS = 100_000_000;

function gridCells(count: number, columns: number, x: number, y: number, width: number, height: number, gap: number): CellRect[] {
  if (!count || columns < 1) return [];
  const rows = Math.ceil(count / columns);
  const cellWidth = (width - gap * (columns + 1)) / columns;
  const cellHeight = (height - gap * (rows + 1)) / rows;
  return Array.from({ length: count }, (_, index) => {
    const column = index % columns, row = Math.floor(index / columns);
    return { x: x + gap + column * (cellWidth + gap), y: y + gap + row * (cellHeight + gap), width: cellWidth, height: cellHeight };
  });
}

function collageCells(template: TemplateId, count: number, columns: number, width: number, height: number, gap: number): CellRect[] {
  if (template === "grid") return gridCells(count, columns, 0, 0, width, height, gap);
  if (template === "wide-row") return gridCells(count, count, 0, 0, width, height, gap);
  if (template === "tall-column") return gridCells(count, 1, 0, 0, width, height, gap);
  if (!count) return [];
  const innerX = gap, innerY = gap, innerWidth = width - gap * 2, innerHeight = height - gap * 2;
  if (count === 1) return [{ x: gap, y: gap, width: innerWidth, height: innerHeight }];
  if (template === "feature-left" || template === "feature-right") {
    const featureWidth = (innerWidth - gap) * 0.58, stackX = template === "feature-left" ? innerX + featureWidth + gap : innerX;
    const featureX = template === "feature-left" ? innerX : innerX + featureWidth + gap;
    const stackWidth = innerWidth - featureWidth - gap;
    const feature = { x: featureX, y: innerY, width: featureWidth, height: innerHeight };
    const stack = gridCells(count - 1, 1, stackX - gap, innerY - gap, stackWidth + gap * 2, innerHeight + gap * 2, gap);
    return [feature, ...stack];
  }
  const featureHeight = (innerHeight - gap) * 0.58;
  const feature = { x: innerX, y: innerY, width: innerWidth, height: featureHeight };
  const remainderHeight = innerHeight - featureHeight - gap;
  const smallColumns = Math.min(count - 1, Math.max(1, Math.ceil(Math.sqrt((count - 1) * innerWidth / Math.max(1, remainderHeight)))));
  return [feature, ...gridCells(count - 1, smallColumns, innerX - gap, innerY + featureHeight, innerWidth + gap * 2, remainderHeight + gap * 2, gap)];
}

function newImageEntry(file: File): ImageFile {
  return { id: crypto.randomUUID(), file, cellFit: "global", cellScale: "1", cellOffsetX: "0", cellOffsetY: "0", rotation: "0", flipHorizontal: false, brightness: "100", contrast: "100", saturation: "100" };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Image collage maker | Local Studio" },
    { name: "description", content: "Arrange local images into a custom-size collage in your browser." },
  ];
}

export default function ImageCollage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get("project") ?? "";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const bitmapCache = useRef(new Map<string, { file: File; bitmap: ImageBitmap }>());
  const cellGesture = useRef<{ id: string; pointerId: number; clientX: number; clientY: number; startX: number; startY: number; cellWidth: number; cellHeight: number } | null>(null);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedImageId, setSelectedImageId] = useState("");
  const [projectTitle, setProjectTitle] = useState("Untitled collage");
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [projectStatus, setProjectStatus] = useState("");
  const [template, setTemplate] = useState<TemplateId>("grid");
  const [columns, setColumns] = useState("2");
  const [gap, setGap] = useState("16");
  const [width, setWidth] = useState("1200");
  const [height, setHeight] = useState("900");
  const [background, setBackground] = useState("#ffffff");
  const [fit, setFit] = useState("contain");
  const [caption, setCaption] = useState("");
  const [captionSize, setCaptionSize] = useState("48");
  const [captionColor, setCaptionColor] = useState("#111827");
  const [error, setError] = useState("");
  const selectedImage = images.find((image) => image.id === selectedImageId) ?? images[0] ?? null;

  useEffect(() => () => { bitmapCache.current.forEach(({ bitmap }) => bitmap.close()); bitmapCache.current.clear(); }, []);
  useEffect(() => {
    const liveIds = new Set(images.map((image) => image.id));
    for (const [id, entry] of bitmapCache.current) if (!liveIds.has(id)) { entry.bitmap.close(); bitmapCache.current.delete(id); }
  }, [images]);

  useEffect(() => {
    let cancelled = false;
    if (!projectId) { setProjectLoaded(true); return () => { cancelled = true; }; }
    setProjectLoaded(false);
    void (async () => {
      try {
        const project = await getProject(projectId);
        if (!project || project.kind !== "image" || !project.collageDocument) throw new Error("This saved collage project is missing or unavailable.");
        const restored = await Promise.all(project.collageDocument.assets.map(async (asset) => {
          const file = await readVideoAsset(asset.id);
          if (!file) throw new Error(`The saved collage source “${asset.name}” is missing.`);
          return { ...newImageEntry(file), id: asset.id, cellFit: asset.cellFit ?? "global", cellScale: asset.cellScale ?? "1", cellOffsetX: asset.cellOffsetX ?? "0", cellOffsetY: asset.cellOffsetY ?? "0", rotation: asset.rotation ?? "0", flipHorizontal: asset.flipHorizontal ?? false, brightness: asset.brightness ?? "100", contrast: asset.contrast ?? "100", saturation: asset.saturation ?? "100" };
        }));
        if (cancelled) return;
        setImages(restored); setSelectedImageId(restored[0]?.id ?? ""); setProjectTitle(project.title);
        setWidth(project.collageDocument.width); setHeight(project.collageDocument.height); setColumns(project.collageDocument.columns);
        setTemplate(TEMPLATES.some((option) => option.id === project.collageDocument?.template) ? project.collageDocument.template as TemplateId : "grid");
        setGap(project.collageDocument.gap); setBackground(project.collageDocument.background); setFit(project.collageDocument.fit);
        setCaption(project.collageDocument.caption); setCaptionSize(project.collageDocument.captionSize); setCaptionColor(project.collageDocument.captionColor);
        setProjectStatus("Editable collage reopened from this device.");
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not open the collage project."); }
      finally { if (!cancelled) setProjectLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousContent = existing?.getAttribute("content");
    const robots = existing ?? document.createElement("meta");
    robots.name = "robots"; robots.content = "noindex,nofollow";
    if (!existing) document.head.append(robots);
    return () => {
      if (!existing) robots.remove();
      else if (previousContent == null) robots.removeAttribute("content");
      else robots.setAttribute("content", previousContent);
    };
  }, [projectId]);

  const layout = useMemo(() => {
    const columnCount = Number(columns), gapSize = Number(gap), outputWidth = Number(width), outputHeight = Number(height);
    const cells = collageCells(template, images.length, columnCount, outputWidth, outputHeight, gapSize);
    const cellGeometryValid = cells.length === images.length && cells.every((cell) => cell.width > 0 && cell.height > 0);
    const cellsValid = images.every((image) => image.cellScale.trim() !== "" && Number.isFinite(Number(image.cellScale)) && Number(image.cellScale) >= 0.25 && Number(image.cellScale) <= 4
      && [image.cellOffsetX, image.cellOffsetY].every((value) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= -100 && Number(value) <= 100)
      && Number.isFinite(Number(image.rotation)) && Number(image.rotation) >= -180 && Number(image.rotation) <= 180
      && [image.brightness, image.contrast, image.saturation].every((value) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 200));
    const valid = Number.isInteger(columnCount) && columnCount >= 1 && columnCount <= 10
      && Number.isInteger(gapSize) && gapSize >= 0 && gapSize <= 256
      && Number.isInteger(outputWidth) && outputWidth > 0 && Number.isInteger(outputHeight) && outputHeight > 0
      && outputWidth <= 32768 && outputHeight <= 32768 && outputWidth * outputHeight <= MAX_OUTPUT_PIXELS
      && (!caption || (Number.isFinite(Number(captionSize)) && Number(captionSize) >= 8 && Number(captionSize) <= 512)) && cellsValid && cellGeometryValid;
    return { columnCount, gapSize, outputWidth, outputHeight, cells, valid };
  }, [columns, gap, width, height, images, caption, captionSize, template]);

  useEffect(() => {
    if (!images.length || !layout.valid || !canvasRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const bitmaps = await Promise.all(images.map(async ({ id, file }) => {
          const existing = bitmapCache.current.get(id);
          if (existing?.file === file) return existing.bitmap;
          existing?.bitmap.close();
          const bitmap = await createImageBitmap(file);
          bitmapCache.current.set(id, { file, bitmap });
          return bitmap;
        }));
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = layout.outputWidth; canvas.height = layout.outputHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("This browser could not create a collage canvas.");
        context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height);
        if (layout.cells.some((cell) => cell.width <= 0 || cell.height <= 0)) throw new Error("The selected template and spacing leave no room for image cells.");
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
        bitmaps.forEach((bitmap, index) => {
          const cell = layout.cells[index];
          if (!cell) return;
          const { x, y, width: cellWidth, height: cellHeight } = cell;
          const image = images[index];
          const cellFit = image.cellFit === "global" ? fit : image.cellFit;
          const baseScale = cellFit === "contain" ? Math.min(cellWidth / bitmap.width, cellHeight / bitmap.height) : Math.max(cellWidth / bitmap.width, cellHeight / bitmap.height);
          const zoom = Math.max(0.25, Math.min(4, Number(image.cellScale) || 1));
          const offsetX = Math.max(-100, Math.min(100, Number(image.cellOffsetX) || 0)) / 100 * cellWidth;
          const offsetY = Math.max(-100, Math.min(100, Number(image.cellOffsetY) || 0)) / 100 * cellHeight;
          const drawWidth = bitmap.width * baseScale * zoom, drawHeight = bitmap.height * baseScale * zoom;
          context.save(); context.beginPath(); context.rect(x, y, cellWidth, cellHeight); context.clip();
          context.filter = `brightness(${image.brightness}%) contrast(${image.contrast}%) saturate(${image.saturation}%)`;
          context.translate(x + cellWidth / 2 + offsetX, y + cellHeight / 2 + offsetY);
          context.rotate(Number(image.rotation) * Math.PI / 180);
          context.scale(image.flipHorizontal ? -1 : 1, 1);
          context.drawImage(bitmap, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
          context.restore();
        });
        if (caption) {
          context.fillStyle = captionColor; context.font = `${captionSize}px system-ui, sans-serif`;
          context.textAlign = "center"; context.textBaseline = "bottom";
          context.fillText(caption, layout.outputWidth / 2, layout.outputHeight - layout.gapSize, layout.outputWidth - layout.gapSize * 2);
        }
        const selectionCanvas = selectionCanvasRef.current;
        const selectionContext = selectionCanvas?.getContext("2d");
        if (selectionCanvas && selectionContext) {
          selectionCanvas.width = canvas.width; selectionCanvas.height = canvas.height;
          selectionContext.clearRect(0, 0, canvas.width, canvas.height);
          const selectedIndex = images.findIndex((image) => image.id === selectedImageId);
          if (selectedIndex >= 0) {
            const cell = layout.cells[selectedIndex];
            if (cell) {
              selectionContext.strokeStyle = "#94b9ff"; selectionContext.lineWidth = Math.max(2, Math.min(cell.width, cell.height) * 0.006);
              selectionContext.strokeRect(cell.x + 1, cell.y + 1, cell.width - 2, cell.height - 2);
            }
          }
        }
        setError("");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "One or more images could not be decoded."); }
    })();
    return () => { cancelled = true; };
  }, [images, layout, background, fit, caption, captionSize, captionColor, selectedImageId]);

  function addFiles(files: FileList | File[] | null) {
    if (!files?.length) return;
    const next: ImageFile[] = Array.from(files).filter((file) => file.type.startsWith("image/")).map(newImageEntry);
    const invalidCount = files.length - next.length;
    const merged = [...images, ...next];
    const totalSize = merged.reduce((sum, image) => sum + image.file.size, 0);
    if (merged.length > 20) { setError("A collage supports up to 20 images."); return; }
    if (totalSize > MAX_SOURCE_BYTES) { setError("Combined image files exceed the 512 MiB prototype limit."); return; }
    setImages(merged); setSelectedImageId((current) => current || next[0]?.id || ""); setError(invalidCount ? "Some files were skipped because they are not images." : "");
  }

  function updateCell(id: string, patch: Partial<Pick<ImageFile, "cellFit" | "cellScale" | "cellOffsetX" | "cellOffsetY" | "rotation" | "flipHorizontal" | "brightness" | "contrast" | "saturation">>) {
    setImages((current) => current.map((image) => image.id === id ? { ...image, ...patch } : image));
  }

  function moveTo(index: number, destination: number) {
    if (destination < 0 || destination >= images.length) return;
    setImages((current) => { const next = [...current]; const [image] = next.splice(index, 1); next.splice(destination, 0, image); return next; });
  }
  function move(index: number, direction: -1 | 1) { moveTo(index, index + direction); }
  function removeImage(id: string) {
    const next = images.filter((image) => image.id !== id);
    setImages(next);
    if (selectedImageId === id) setSelectedImageId(next[0]?.id ?? "");
  }

  function beginCellDrag(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!layout.valid || !images.length) return;
    const canvas = event.currentTarget, bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = (event.clientX - bounds.left) / bounds.width * layout.outputWidth;
    const y = (event.clientY - bounds.top) / bounds.height * layout.outputHeight;
    const index = layout.cells.findIndex((cell) => x >= cell.x && x <= cell.x + cell.width && y >= cell.y && y <= cell.y + cell.height);
    const cell = layout.cells[index], image = images[index];
    if (!cell || !image) return;
    setSelectedImageId(image.id);
    cellGesture.current = { id: image.id, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, startX: Number(image.cellOffsetX) || 0, startY: Number(image.cellOffsetY) || 0, cellWidth: cell.width, cellHeight: cell.height };
    canvas.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function moveCellDrag(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = cellGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - gesture.clientX) / bounds.width * layout.outputWidth / gesture.cellWidth * 100;
    const dy = (event.clientY - gesture.clientY) / bounds.height * layout.outputHeight / gesture.cellHeight * 100;
    updateCell(gesture.id, { cellOffsetX: String(Math.max(-100, Math.min(100, Math.round((gesture.startX + dx) * 100) / 100))), cellOffsetY: String(Math.max(-100, Math.min(100, Math.round((gesture.startY + dy) * 100) / 100))) });
  }

  async function saveProject() {
    if (!projectLoaded || !images.length || !layout.valid || !projectTitle.trim()) return;
    try {
      let id = projectId;
      if (!id) id = (await createProject(projectTitle.trim(), "image")).id;
      const document = {
        version: 1 as const, template, width, height, columns, gap, background, fit, caption, captionSize, captionColor,
        assets: images.map(({ id: assetId, file, cellFit, cellScale, cellOffsetX, cellOffsetY, rotation, flipHorizontal, brightness, contrast, saturation }) => ({ id: assetId, name: file.name, type: file.type, size: file.size, cellFit, cellScale, cellOffsetX, cellOffsetY, rotation, flipHorizontal, brightness, contrast, saturation })),
      };
      await saveCollageProject(id, document, images.map(({ id: assetId, file }) => ({ id: assetId, file })), projectTitle);
      setProjectStatus("Collage project saved on this device."); setError("");
      if (id !== projectId) setSearchParams({ project: id });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the collage project."); }
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas || !images.length || !layout.valid) return;
    canvas.toBlob((blob) => {
      if (!blob) { setError("The collage could not be exported."); return; }
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `local-studio-collage-${layout.outputWidth}x${layout.outputHeight}.png`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  const selectedCellIndex = images.findIndex((image) => image.id === selectedImage?.id);
  const selectedCell = selectedCellIndex >= 0 ? layout.cells[selectedCellIndex] : undefined;

  return <main className={`resize-page image-collage-page${images.length ? " has-media" : ""}`}>
    <ToolPageHeader />
    <section className="resize-intro"><p className="eyebrow">IMAGE · LOCAL PROCESSING</p><h1>Make an image collage</h1><p>Add, reorder, and arrange images into a custom canvas. Everything renders locally in this browser.</p></section>
    {!images.length ? projectLoaded ? <MediaImportScreen kind="image" accept="image/*" multiple onFiles={addFiles} error={error} /> : <div className="empty-preview import-loading" role="status">Opening collage project from this device…</div> : <section className="resize-workspace image-tool-workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>Add images</span><input type="file" accept="image/*" multiple onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>
        <label className="ratio-field">Project name<input maxLength={80} value={projectTitle} disabled={!projectLoaded} onChange={(event) => setProjectTitle(event.currentTarget.value)} /></label>
        <section className="collage-template-picker" aria-label="Collage templates"><div className="preview-heading"><strong>Templates</strong><span>Choose a layout, then customize it</span></div><div className="collage-template-options">{TEMPLATES.map((option) => <button type="button" key={option.id} className={template === option.id ? "active" : ""} aria-pressed={template === option.id} onClick={() => setTemplate(option.id as TemplateId)}><span className={`collage-template-thumb ${option.id}`} aria-hidden="true"><i /><i /><i /><i /></span><strong>{option.label}</strong><small>{option.summary}</small></button>)}</div></section>
        <div className="dimension-fields"><label>Canvas width <span>px</span><input type="number" min="1" max="32768" step="1" value={width} onChange={(event) => setWidth(event.currentTarget.value)} /></label><label>Canvas height <span>px</span><input type="number" min="1" max="32768" step="1" value={height} onChange={(event) => setHeight(event.currentTarget.value)} /></label></div>
        <div className="dimension-fields">{template === "grid" && <label>Columns <span>1–10</span><input type="number" min="1" max="10" step="1" value={columns} onChange={(event) => setColumns(event.currentTarget.value)} /></label>}<label>Spacing <span>0–256 px</span><input type="number" min="0" max="256" step="1" value={gap} onChange={(event) => setGap(event.currentTarget.value)} /></label></div>
        <label className="ratio-field">Cell fit<select value={fit} onChange={(event) => setFit(event.currentTarget.value)}><option value="contain">Contain · show full image</option><option value="cover">Cover · crop to fill</option></select></label>
        <label className="ratio-field">Background color<input type="color" value={background} onChange={(event) => setBackground(event.currentTarget.value)} /></label>
        <label className="ratio-field">Collage text<input value={caption} maxLength={240} onChange={(event) => setCaption(event.currentTarget.value)} placeholder="Optional caption" /></label>
        <div className="dimension-fields"><label>Text size <span>px</span><input type="number" min="8" max="512" step="any" value={captionSize} onChange={(event) => setCaptionSize(event.currentTarget.value)} /></label><label>Text color<input type="color" value={captionColor} onChange={(event) => setCaptionColor(event.currentTarget.value)} /></label></div>
        <p className="resize-note">{images.length} image(s) · {layout.cells.length} editable cell(s) · {layout.valid ? `${(layout.outputWidth * layout.outputHeight / 1_000_000).toFixed(1)} megapixels` : "Invalid canvas settings"}. Maximum 20 source files and 100 megapixels.</p>
        {!layout.valid && images.length > 0 && <p className="resize-error" role="alert">Enter valid canvas, caption, and cell values within their listed ranges.</p>}
        {error && <p className="resize-error" role="alert">{error}</p>}
        {projectStatus && <p className="source-info" role="status">{projectStatus}</p>}
        <button className="secondary-button export-button" disabled={!projectLoaded || !images.length || !layout.valid || !projectTitle.trim()} onClick={() => void saveProject()}>Save editable collage</button>
        <button className="export-button" disabled={!images.length || !layout.valid} onClick={download}>Download collage PNG</button>
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>Collage preview</strong><span>{images.length ? `${layout.outputWidth} × ${layout.outputHeight} px · click a photo to edit, drag to reposition` : "Add images to begin"}</span></div>{images.length ? <div className="collage-canvas-stage"><canvas ref={canvasRef} className="preview-canvas collage-interactive-canvas" aria-label="Image collage preview. Click a cell to select its image and drag to reposition it." onPointerDown={beginCellDrag} onPointerMove={moveCellDrag} onPointerUp={(event) => { if (cellGesture.current?.pointerId === event.pointerId) cellGesture.current = null; }} onPointerCancel={() => { cellGesture.current = null; }} /><canvas ref={selectionCanvasRef} className="preview-canvas collage-selection-overlay" aria-hidden="true" />{selectedCell && <button type="button" className="collage-remove-cell" style={{ left: `${(selectedCell.x + selectedCell.width) / layout.outputWidth * 100}%`, top: `${selectedCell.y / layout.outputHeight * 100}%` }} aria-label={`Remove ${selectedImage?.file.name} from this collage cell`} title="Remove this collage cell" onClick={() => selectedImage && removeImage(selectedImage.id)}>×</button>}</div> : <div className="empty-preview">Add two or more images to start a collage.</div>}</div>
    </section>}
    {images.length > 0 && <section className="resize-preview image-order"><div className="preview-heading"><strong>Image order</strong><span>Drag to arrange · select a cell to edit</span></div><ol className="clip-list">{images.map((image, index) => <li key={image.id} draggable className={selectedImage?.id === image.id ? "selected" : ""} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", image.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const draggedId = event.dataTransfer.getData("text/plain"); const sourceIndex = images.findIndex((entry) => entry.id === draggedId); if (sourceIndex >= 0) moveTo(sourceIndex, index); }}><span className="clip-drag-handle" aria-hidden="true">⠿</span><button type="button" className="image-layer-select" aria-pressed={selectedImage?.id === image.id} onClick={() => setSelectedImageId(image.id)}><strong>{index + 1}. {image.file.name}</strong><small>{(image.file.size / 1024 / 1024).toFixed(1)} MiB</small></button><div><button type="button" aria-label={`Move ${image.file.name} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`Move ${image.file.name} down`} disabled={index === images.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" aria-label={`Remove ${image.file.name}`} onClick={() => { const next = images.filter((item) => item.id !== image.id); setImages(next); if (selectedImage?.id === image.id) setSelectedImageId(next[0]?.id ?? ""); }}>×</button></div></li>)}</ol>
      {selectedImage && <div className="filter-fields two-column transform-fields collage-cell-controls" aria-label={`Edit collage cell for ${selectedImage.file.name}`}><strong>Cell: {selectedImage.file.name}</strong><label>Cell fit<select value={selectedImage.cellFit} onChange={(event) => updateCell(selectedImage.id, { cellFit: event.currentTarget.value as ImageFile["cellFit"] })}><option value="global">Use collage default</option><option value="contain">Contain</option><option value="cover">Cover</option></select></label><label>Cell scale <span>custom 0.25–4×</span><input type="number" min="0.25" max="4" step="any" value={selectedImage.cellScale} onChange={(event) => updateCell(selectedImage.id, { cellScale: event.currentTarget.value })} /></label><label>Cell position X <span>custom −100–100%</span><input type="number" min="-100" max="100" step="any" value={selectedImage.cellOffsetX} onChange={(event) => updateCell(selectedImage.id, { cellOffsetX: event.currentTarget.value })} /></label><label>Cell position Y <span>custom −100–100%</span><input type="number" min="-100" max="100" step="any" value={selectedImage.cellOffsetY} onChange={(event) => updateCell(selectedImage.id, { cellOffsetY: event.currentTarget.value })} /></label><label>Rotate <span>−180–180°</span><input type="number" min="-180" max="180" step="1" value={selectedImage.rotation} onChange={(event) => updateCell(selectedImage.id, { rotation: event.currentTarget.value })} /></label><label className="collage-check-control"><input type="checkbox" checked={selectedImage.flipHorizontal} onChange={(event) => updateCell(selectedImage.id, { flipHorizontal: event.currentTarget.checked })} />Flip horizontally</label><label>Brightness <span>0–200%</span><input type="number" min="0" max="200" step="1" value={selectedImage.brightness} onChange={(event) => updateCell(selectedImage.id, { brightness: event.currentTarget.value })} /></label><label>Contrast <span>0–200%</span><input type="number" min="0" max="200" step="1" value={selectedImage.contrast} onChange={(event) => updateCell(selectedImage.id, { contrast: event.currentTarget.value })} /></label><label>Saturation <span>0–200%</span><input type="number" min="0" max="200" step="1" value={selectedImage.saturation} onChange={(event) => updateCell(selectedImage.id, { saturation: event.currentTarget.value })} /></label><button type="button" className="secondary-button" onClick={() => updateCell(selectedImage.id, { cellFit: "global", cellScale: "1", cellOffsetX: "0", cellOffsetY: "0", rotation: "0", flipHorizontal: false, brightness: "100", contrast: "100", saturation: "100" })}>Reset image controls</button><button type="button" className="project-delete" onClick={() => removeImage(selectedImage.id)}>Remove this cell</button><p className="resize-note">Click another image in the preview to edit it. Drag within the image to reposition it. Cell edits stay independent.</p></div>}
    </section>}
  </main>;
}
