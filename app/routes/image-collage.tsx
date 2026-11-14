import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/image-collage";

type ImageFile = { id: string; file: File };
const MAX_SOURCE_BYTES = 512 * 1024 * 1024;
const MAX_OUTPUT_PIXELS = 100_000_000;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Image collage maker | Local Studio" },
    { name: "description", content: "Arrange local images into a custom-size collage in your browser." },
  ];
}

export default function ImageCollage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [columns, setColumns] = useState("2");
  const [gap, setGap] = useState("16");
  const [width, setWidth] = useState("1200");
  const [height, setHeight] = useState("900");
  const [background, setBackground] = useState("#ffffff");
  const [fit, setFit] = useState("contain");
  const [error, setError] = useState("");

  const layout = useMemo(() => {
    const columnCount = Number(columns), gapSize = Number(gap), outputWidth = Number(width), outputHeight = Number(height);
    const rows = columnCount > 0 ? Math.ceil(images.length / columnCount) : 0;
    const valid = Number.isInteger(columnCount) && columnCount >= 1 && columnCount <= 10
      && Number.isInteger(gapSize) && gapSize >= 0 && gapSize <= 256
      && Number.isInteger(outputWidth) && outputWidth > 0 && Number.isInteger(outputHeight) && outputHeight > 0
      && outputWidth <= 32768 && outputHeight <= 32768 && outputWidth * outputHeight <= MAX_OUTPUT_PIXELS;
    return { columnCount, gapSize, outputWidth, outputHeight, rows, valid };
  }, [columns, gap, width, height, images.length]);

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
          if (fit === "contain") {
            const scale = Math.min(cellWidth / bitmap.width, cellHeight / bitmap.height);
            const drawWidth = bitmap.width * scale, drawHeight = bitmap.height * scale;
            context.drawImage(bitmap, x + (cellWidth - drawWidth) / 2, y + (cellHeight - drawHeight) / 2, drawWidth, drawHeight);
          } else {
            const sourceAspect = bitmap.width / bitmap.height, cellAspect = cellWidth / cellHeight;
            let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
            if (sourceAspect > cellAspect) { sw = bitmap.height * cellAspect; sx = (bitmap.width - sw) / 2; }
            else { sh = bitmap.width / cellAspect; sy = (bitmap.height - sh) / 2; }
            context.drawImage(bitmap, sx, sy, sw, sh, x, y, cellWidth, cellHeight);
          }
        });
        setError("");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "One or more images could not be decoded."); }
      finally { bitmaps.forEach((bitmap) => bitmap.close()); }
    })();
    return () => { cancelled = true; };
  }, [images, layout, background, fit]);

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files).filter((file) => file.type.startsWith("image/")).map((file) => ({ id: crypto.randomUUID(), file }));
    const invalidCount = files.length - next.length;
    const merged = [...images, ...next];
    const totalSize = merged.reduce((sum, image) => sum + image.file.size, 0);
    if (merged.length > 20) { setError("A collage supports up to 20 images."); return; }
    if (totalSize > MAX_SOURCE_BYTES) { setError("Combined image files exceed the 512 MiB prototype limit."); return; }
    setImages(merged); setError(invalidCount ? "Some files were skipped because they are not images." : "");
  }

  function move(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= images.length) return;
    const next = [...images]; [next[index], next[destination]] = [next[destination], next[index]]; setImages(next);
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

  return <main className="resize-page">
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/tools/image/resize">Image editor</a></nav></header>
    <section className="resize-intro"><p className="eyebrow">IMAGE · LOCAL PROCESSING</p><h1>Make an image collage</h1><p>Add, reorder, and arrange images into a custom canvas. Everything renders locally in this browser.</p></section>
    <section className="resize-workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>Add images</span><input type="file" accept="image/*" multiple onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>
        <div className="dimension-fields"><label>Canvas width <span>px</span><input type="number" min="1" max="32768" step="1" value={width} onChange={(event) => setWidth(event.currentTarget.value)} /></label><label>Canvas height <span>px</span><input type="number" min="1" max="32768" step="1" value={height} onChange={(event) => setHeight(event.currentTarget.value)} /></label></div>
        <div className="dimension-fields"><label>Columns <span>1–10</span><input type="number" min="1" max="10" step="1" value={columns} onChange={(event) => setColumns(event.currentTarget.value)} /></label><label>Spacing <span>0–256 px</span><input type="number" min="0" max="256" step="1" value={gap} onChange={(event) => setGap(event.currentTarget.value)} /></label></div>
        <label className="ratio-field">Cell fit<select value={fit} onChange={(event) => setFit(event.currentTarget.value)}><option value="contain">Contain · show full image</option><option value="cover">Cover · crop to fill</option></select></label>
        <label className="ratio-field">Background color<input type="color" value={background} onChange={(event) => setBackground(event.currentTarget.value)} /></label>
        <p className="resize-note">{images.length} image(s) · {layout.rows} row(s) · {layout.valid ? `${(layout.outputWidth * layout.outputHeight / 1_000_000).toFixed(1)} megapixels` : "Invalid canvas settings"}. Maximum 20 source files and 100 megapixels.</p>
        {error && <p className="resize-error" role="alert">{error}</p>}
        <button className="export-button" disabled={!images.length || !layout.valid} onClick={download}>Download collage PNG</button>
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>Collage preview</strong><span>{images.length ? `${layout.outputWidth} × ${layout.outputHeight} px` : "Add images to begin"}</span></div>{images.length ? <canvas ref={canvasRef} className="preview-canvas" aria-label="Image collage preview" /> : <div className="empty-preview">Add two or more images to start a collage.</div>}</div>
    </section>
    <section className="resize-preview image-order"><div className="preview-heading"><strong>Image order</strong><span>Reorder or remove source images</span></div>{images.length ? <ol className="clip-list">{images.map((image, index) => <li key={image.id}><span><strong>{index + 1}. {image.file.name}</strong><small>{(image.file.size / 1024 / 1024).toFixed(1)} MiB</small></span><div><button type="button" aria-label={`Move ${image.file.name} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`Move ${image.file.name} down`} disabled={index === images.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" aria-label={`Remove ${image.file.name}`} onClick={() => setImages(images.filter((_, imageIndex) => imageIndex !== index))}>×</button></div></li>)}</ol> : <p className="resize-note">No images added.</p>}</section>
  </main>;
}
