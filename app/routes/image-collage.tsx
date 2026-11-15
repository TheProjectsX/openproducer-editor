import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/image-collage";
import { createProject, getProject, readVideoAsset, saveCollageProject } from "../lib/project-store";
import { MediaImportScreen } from "../components/media-import-screen";

type ImageFile = { id: string; file: File; cellFit: "global" | "contain" | "cover"; cellScale: string; cellOffsetX: string; cellOffsetY: string };
const MAX_SOURCE_BYTES = 512 * 1024 * 1024;
const MAX_OUTPUT_PIXELS = 100_000_000;

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
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedImageId, setSelectedImageId] = useState("");
  const [projectTitle, setProjectTitle] = useState("Untitled collage");
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [projectStatus, setProjectStatus] = useState("");
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
          return { id: asset.id, file, cellFit: asset.cellFit ?? "global", cellScale: asset.cellScale ?? "1", cellOffsetX: asset.cellOffsetX ?? "0", cellOffsetY: asset.cellOffsetY ?? "0" };
        }));
        if (cancelled) return;
        setImages(restored); setSelectedImageId(restored[0]?.id ?? ""); setProjectTitle(project.title);
        setWidth(project.collageDocument.width); setHeight(project.collageDocument.height); setColumns(project.collageDocument.columns);
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
    const rows = columnCount > 0 ? Math.ceil(images.length / columnCount) : 0;
    const cellsValid = images.every((image) => image.cellScale.trim() !== "" && Number.isFinite(Number(image.cellScale)) && Number(image.cellScale) >= 0.25 && Number(image.cellScale) <= 4
      && [image.cellOffsetX, image.cellOffsetY].every((value) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= -100 && Number(value) <= 100));
    const valid = Number.isInteger(columnCount) && columnCount >= 1 && columnCount <= 10
      && Number.isInteger(gapSize) && gapSize >= 0 && gapSize <= 256
      && Number.isInteger(outputWidth) && outputWidth > 0 && Number.isInteger(outputHeight) && outputHeight > 0
      && outputWidth <= 32768 && outputHeight <= 32768 && outputWidth * outputHeight <= MAX_OUTPUT_PIXELS
      && (!caption || (Number.isFinite(Number(captionSize)) && Number(captionSize) >= 8 && Number(captionSize) <= 512)) && cellsValid;
    return { columnCount, gapSize, outputWidth, outputHeight, rows, valid };
  }, [columns, gap, width, height, images.length, caption, captionSize]);

  useEffect(() => {
    if (!images.length || !layout.valid || !canvasRef.current) return;
    let cancelled = false;
    void (async () => {
      let bitmaps: ImageBitmap[] = [];
      try {
        bitmaps = await Promise.all(images.map(({ file }) => createImageBitmap(file)));
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = layout.outputWidth; canvas.height = layout.outputHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("This browser could not create a collage canvas.");
        context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height);
        const cellWidth = (layout.outputWidth - layout.gapSize * (layout.columnCount + 1)) / layout.columnCount;
        const cellHeight = (layout.outputHeight - layout.gapSize * (layout.rows + 1)) / layout.rows;
        if (cellWidth <= 0 || cellHeight <= 0) throw new Error("The selected spacing leaves no room for image cells.");
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
        bitmaps.forEach((bitmap, index) => {
          const column = index % layout.columnCount, row = Math.floor(index / layout.columnCount);
          const x = layout.gapSize + column * (cellWidth + layout.gapSize);
          const y = layout.gapSize + row * (cellHeight + layout.gapSize);
          const image = images[index];
          const cellFit = image.cellFit === "global" ? fit : image.cellFit;
          const baseScale = cellFit === "contain" ? Math.min(cellWidth / bitmap.width, cellHeight / bitmap.height) : Math.max(cellWidth / bitmap.width, cellHeight / bitmap.height);
          const zoom = Math.max(0.25, Math.min(4, Number(image.cellScale) || 1));
          const offsetX = Math.max(-100, Math.min(100, Number(image.cellOffsetX) || 0)) / 100 * cellWidth;
          const offsetY = Math.max(-100, Math.min(100, Number(image.cellOffsetY) || 0)) / 100 * cellHeight;
          const drawWidth = bitmap.width * baseScale * zoom, drawHeight = bitmap.height * baseScale * zoom;
          context.save(); context.beginPath(); context.rect(x, y, cellWidth, cellHeight); context.clip();
          context.drawImage(bitmap, x + (cellWidth - drawWidth) / 2 + offsetX, y + (cellHeight - drawHeight) / 2 + offsetY, drawWidth, drawHeight);
          context.restore();
        });
        if (caption) {
          context.fillStyle = captionColor; context.font = `${captionSize}px system-ui, sans-serif`;
          context.textAlign = "center"; context.textBaseline = "bottom";
          context.fillText(caption, layout.outputWidth / 2, layout.outputHeight - layout.gapSize, layout.outputWidth - layout.gapSize * 2);
        }
        setError("");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "One or more images could not be decoded."); }
      finally { bitmaps.forEach((bitmap) => bitmap.close()); }
    })();
    return () => { cancelled = true; };
  }, [images, layout, background, fit, caption, captionSize, captionColor]);

  function addFiles(files: FileList | File[] | null) {
    if (!files?.length) return;
    const next: ImageFile[] = Array.from(files).filter((file) => file.type.startsWith("image/")).map((file) => ({ id: crypto.randomUUID(), file, cellFit: "global", cellScale: "1", cellOffsetX: "0", cellOffsetY: "0" }));
    const invalidCount = files.length - next.length;
    const merged = [...images, ...next];
    const totalSize = merged.reduce((sum, image) => sum + image.file.size, 0);
    if (merged.length > 20) { setError("A collage supports up to 20 images."); return; }
    if (totalSize > MAX_SOURCE_BYTES) { setError("Combined image files exceed the 512 MiB prototype limit."); return; }
    setImages(merged); setSelectedImageId((current) => current || next[0]?.id || ""); setError(invalidCount ? "Some files were skipped because they are not images." : "");
  }

  function updateCell(id: string, patch: Partial<Pick<ImageFile, "cellFit" | "cellScale" | "cellOffsetX" | "cellOffsetY">>) {
    setImages((current) => current.map((image) => image.id === id ? { ...image, ...patch } : image));
  }

  function move(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= images.length) return;
    const next = [...images]; [next[index], next[destination]] = [next[destination], next[index]]; setImages(next);
  }

  async function saveProject() {
    if (!projectLoaded || !images.length || !layout.valid || !projectTitle.trim()) return;
    try {
      let id = projectId;
      if (!id) id = (await createProject(projectTitle.trim(), "image")).id;
      const document = {
        version: 1 as const, width, height, columns, gap, background, fit, caption, captionSize, captionColor,
        assets: images.map(({ id: assetId, file, cellFit, cellScale, cellOffsetX, cellOffsetY }) => ({ id: assetId, name: file.name, type: file.type, size: file.size, cellFit, cellScale, cellOffsetX, cellOffsetY })),
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

  return <main className={`resize-page${images.length ? " has-media" : ""}`}>
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/tools/image/resize">Image editor</a></nav></header>
    <section className="resize-intro"><p className="eyebrow">IMAGE · LOCAL PROCESSING</p><h1>Make an image collage</h1><p>Add, reorder, and arrange images into a custom canvas. Everything renders locally in this browser.</p></section>
    {!images.length && projectLoaded ? <MediaImportScreen kind="image" accept="image/*" multiple onFiles={addFiles} error={error} /> : <section className="resize-workspace image-tool-workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>Add images</span><input type="file" accept="image/*" multiple onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>
        <label className="ratio-field">Project name<input maxLength={80} value={projectTitle} disabled={!projectLoaded} onChange={(event) => setProjectTitle(event.currentTarget.value)} /></label>
        <div className="dimension-fields"><label>Canvas width <span>px</span><input type="number" min="1" max="32768" step="1" value={width} onChange={(event) => setWidth(event.currentTarget.value)} /></label><label>Canvas height <span>px</span><input type="number" min="1" max="32768" step="1" value={height} onChange={(event) => setHeight(event.currentTarget.value)} /></label></div>
        <div className="dimension-fields"><label>Columns <span>1–10</span><input type="number" min="1" max="10" step="1" value={columns} onChange={(event) => setColumns(event.currentTarget.value)} /></label><label>Spacing <span>0–256 px</span><input type="number" min="0" max="256" step="1" value={gap} onChange={(event) => setGap(event.currentTarget.value)} /></label></div>
        <label className="ratio-field">Cell fit<select value={fit} onChange={(event) => setFit(event.currentTarget.value)}><option value="contain">Contain · show full image</option><option value="cover">Cover · crop to fill</option></select></label>
        <label className="ratio-field">Background color<input type="color" value={background} onChange={(event) => setBackground(event.currentTarget.value)} /></label>
        <label className="ratio-field">Collage text<input value={caption} maxLength={240} onChange={(event) => setCaption(event.currentTarget.value)} placeholder="Optional caption" /></label>
        <div className="dimension-fields"><label>Text size <span>px</span><input type="number" min="8" max="512" step="any" value={captionSize} onChange={(event) => setCaptionSize(event.currentTarget.value)} /></label><label>Text color<input type="color" value={captionColor} onChange={(event) => setCaptionColor(event.currentTarget.value)} /></label></div>
        <p className="resize-note">{images.length} image(s) · {layout.rows} row(s) · {layout.valid ? `${(layout.outputWidth * layout.outputHeight / 1_000_000).toFixed(1)} megapixels` : "Invalid canvas settings"}. Maximum 20 source files and 100 megapixels.</p>
        {!layout.valid && images.length > 0 && <p className="resize-error" role="alert">Enter valid canvas, caption, and cell values within their listed ranges.</p>}
        {error && <p className="resize-error" role="alert">{error}</p>}
        {projectStatus && <p className="source-info" role="status">{projectStatus}</p>}
        <button className="secondary-button export-button" disabled={!projectLoaded || !images.length || !layout.valid || !projectTitle.trim()} onClick={() => void saveProject()}>Save editable collage</button>
        <button className="export-button" disabled={!images.length || !layout.valid} onClick={download}>Download collage PNG</button>
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>Collage preview</strong><span>{images.length ? `${layout.outputWidth} × ${layout.outputHeight} px` : "Add images to begin"}</span></div>{images.length ? <canvas ref={canvasRef} className="preview-canvas" aria-label="Image collage preview" /> : <div className="empty-preview">Add two or more images to start a collage.</div>}</div>
    </section>}
    {images.length > 0 && <section className="resize-preview image-order"><div className="preview-heading"><strong>Image order</strong><span>Reorder, edit cells, or remove source images</span></div><ol className="clip-list">{images.map((image, index) => <li key={image.id} className={selectedImage?.id === image.id ? "selected" : ""}><button type="button" className="image-layer-select" aria-pressed={selectedImage?.id === image.id} onClick={() => setSelectedImageId(image.id)}><strong>{index + 1}. {image.file.name}</strong><small>{(image.file.size / 1024 / 1024).toFixed(1)} MiB</small></button><div><button type="button" aria-label={`Move ${image.file.name} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`Move ${image.file.name} down`} disabled={index === images.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" aria-label={`Remove ${image.file.name}`} onClick={() => { const next = images.filter((item) => item.id !== image.id); setImages(next); if (selectedImage?.id === image.id) setSelectedImageId(next[0]?.id ?? ""); }}>×</button></div></li>)}</ol>
      {selectedImage && <div className="filter-fields two-column transform-fields" aria-label={`Edit collage cell for ${selectedImage.file.name}`}><strong>Cell: {selectedImage.file.name}</strong><label>Cell fit<select value={selectedImage.cellFit} onChange={(event) => updateCell(selectedImage.id, { cellFit: event.currentTarget.value as ImageFile["cellFit"] })}><option value="global">Use collage default</option><option value="contain">Contain</option><option value="cover">Cover</option></select></label><label>Cell scale <span>custom 0.25–4×</span><input type="number" min="0.25" max="4" step="any" value={selectedImage.cellScale} onChange={(event) => updateCell(selectedImage.id, { cellScale: event.currentTarget.value })} /></label><label>Cell position X <span>custom −100–100%</span><input type="number" min="-100" max="100" step="any" value={selectedImage.cellOffsetX} onChange={(event) => updateCell(selectedImage.id, { cellOffsetX: event.currentTarget.value })} /></label><label>Cell position Y <span>custom −100–100%</span><input type="number" min="-100" max="100" step="any" value={selectedImage.cellOffsetY} onChange={(event) => updateCell(selectedImage.id, { cellOffsetY: event.currentTarget.value })} /></label><p className="resize-note">Scale and position adjust this image within its clipped cell. Other collage cells keep their own settings.</p></div>}
    </section>}
  </main>;
}
