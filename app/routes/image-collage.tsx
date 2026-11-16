import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/image-collage";
import { createProject, getProject, readVideoAsset, saveCollageProject } from "../lib/project-store";
import { MediaImportScreen } from "../components/media-import-screen";

type ImageFile = { id: string; file: File; slot: number; cellFit: "global" | "contain" | "cover"; cellScale: string; cellOffsetX: string; cellOffsetY: string; rotation: string; flipHorizontal: boolean; brightness: string; contrast: string; saturation: string };
type CellRect = { x: number; y: number; width: number; height: number };
const TEMPLATES = [
  { id: "grid", label: "Classic grid", summary: "Balanced cells" },
  { id: "feature-left", label: "Big photo left", summary: "Feature + stack" },
  { id: "feature-right", label: "Big photo right", summary: "Stack + feature" },
  { id: "feature-top", label: "Big photo top", summary: "Feature + row" },
  { id: "wide-row", label: "Wide strip", summary: "One horizontal row" },
  { id: "tall-column", label: "Tall strip", summary: "One vertical column" },
  { id: "custom", label: "Custom grid", summary: "Choose rows and columns" },
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
  if (template === "custom") return gridCells(count, columns, 0, 0, width, height, gap);
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

function newImageEntry(file: File, slot: number): ImageFile {
  return { id: crypto.randomUUID(), file, slot, cellFit: "global", cellScale: "1", cellOffsetX: "0", cellOffsetY: "0", rotation: "0", flipHorizontal: false, brightness: "100", contrast: "100", saturation: "100" };
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotIndex = useRef<number | null>(null);
  const openingSlotPicker = useRef(false);
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const bitmapCache = useRef(new Map<string, { file: File; bitmap: ImageBitmap }>());
  const cellGesture = useRef<{ id: string; pointerId: number; clientX: number; clientY: number; startX: number; startY: number; cellWidth: number; cellHeight: number } | null>(null);
  const collageStageRef = useRef<HTMLDivElement>(null);
  const pendingReplaceSlot = useRef<number | null>(null);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [editorOpened, setEditorOpened] = useState(false);
  const [deletedCellCount, setDeletedCellCount] = useState(0);
  const [selectedImageId, setSelectedImageId] = useState("");
  const [cellMenu, setCellMenu] = useState<{ imageId: string; x: number; y: number } | null>(null);
  const [projectTitle, setProjectTitle] = useState("Untitled collage");
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [projectStatus, setProjectStatus] = useState("");
  const [template, setTemplate] = useState<TemplateId>("grid");
  const [columns, setColumns] = useState("3");
  const [rows, setRows] = useState("3");
  const [gap, setGap] = useState("16");
  const [cornerRadius, setCornerRadius] = useState("0");
  const [width, setWidth] = useState("1200");
  const [height, setHeight] = useState("900");
  const [background, setBackground] = useState("#ffffff");
  const [fit, setFit] = useState("cover");
  const [caption, setCaption] = useState("");
  const [captionSize, setCaptionSize] = useState("48");
  const [captionColor, setCaptionColor] = useState("#111827");
  const [activeSidebarPanel, setActiveSidebarPanel] = useState<"images" | "layouts" | "customize" | "cell" | "text">("images");
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
        const restored = await Promise.all(project.collageDocument.assets.map(async (asset, index) => {
          const file = await readVideoAsset(asset.id);
          if (!file) throw new Error(`The saved collage source “${asset.name}” is missing.`);
          return { ...newImageEntry(file, asset.slot ?? index), id: asset.id, cellFit: asset.cellFit ?? "global", cellScale: asset.cellScale ?? "1", cellOffsetX: asset.cellOffsetX ?? "0", cellOffsetY: asset.cellOffsetY ?? "0", rotation: asset.rotation ?? "0", flipHorizontal: asset.flipHorizontal ?? false, brightness: asset.brightness ?? "100", contrast: asset.contrast ?? "100", saturation: asset.saturation ?? "100" };
        }));
        if (cancelled) return;
        setImages(restored); setSelectedImageId(restored[0]?.id ?? ""); setProjectTitle(project.title);
        setWidth(project.collageDocument.width); setHeight(project.collageDocument.height); setColumns(project.collageDocument.columns); setRows(project.collageDocument.rows ?? "3"); setCornerRadius(project.collageDocument.cornerRadius ?? "0"); setDeletedCellCount(project.collageDocument.deletedCells ?? 0);
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
    const geometryColumns = Number.isInteger(columnCount) ? Math.max(1, Math.min(10, columnCount)) : 1;
    const rowCount = Number(rows), geometryRows = Number.isInteger(rowCount) ? Math.max(1, Math.min(10, rowCount)) : 1;
    const minimumSlots = template === "grid" || template === "custom" ? geometryColumns * geometryRows : template === "wide-row" || template === "tall-column" ? 4 : 3;
    const filledRows = template === "grid" ? Math.ceil(images.length / geometryColumns) * geometryColumns : images.length;
    const slotCount = template === "custom" ? Math.max(1, minimumSlots - deletedCellCount) : Math.max(1, Math.max(minimumSlots, filledRows, ...images.map((image) => image.slot + 1)) - deletedCellCount);
    const cells = collageCells(template, slotCount, geometryColumns, outputWidth, outputHeight, gapSize);
    const occupiedSlots = new Set(images.map((image) => image.slot));
    const cellGeometryValid = cells.length >= images.length && cells.every((cell) => cell.width > 0 && cell.height > 0)
      && occupiedSlots.size === images.length && images.every((image) => Number.isInteger(image.slot) && image.slot >= 0 && image.slot < cells.length);
    const cellsValid = images.every((image) => image.cellScale.trim() !== "" && Number.isFinite(Number(image.cellScale)) && Number(image.cellScale) >= 0.25 && Number(image.cellScale) <= 4
      && [image.cellOffsetX, image.cellOffsetY].every((value) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= -100 && Number(value) <= 100)
      && Number.isFinite(Number(image.rotation)) && Number(image.rotation) >= -180 && Number(image.rotation) <= 180
      && [image.brightness, image.contrast, image.saturation].every((value) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 200));
    const valid = Number.isInteger(columnCount) && columnCount >= 1 && columnCount <= 10
      && Number.isInteger(rowCount) && rowCount >= 1 && rowCount <= 10
      && Number.isInteger(gapSize) && gapSize >= 0 && gapSize <= 256
      && Number.isInteger(Number(cornerRadius)) && Number(cornerRadius) >= 0 && Number(cornerRadius) <= 256
      && Number.isInteger(outputWidth) && outputWidth > 0 && Number.isInteger(outputHeight) && outputHeight > 0
      && outputWidth <= 32768 && outputHeight <= 32768 && outputWidth * outputHeight <= MAX_OUTPUT_PIXELS
      && (template !== "custom" || images.length <= geometryColumns * geometryRows)
      && (!caption || (Number.isFinite(Number(captionSize)) && Number(captionSize) >= 8 && Number(captionSize) <= 512)) && cellsValid && cellGeometryValid;
    return { columnCount, gapSize, outputWidth, outputHeight, cells, valid };
  }, [columns, rows, gap, cornerRadius, width, height, images, caption, captionSize, template, deletedCellCount]);

  useEffect(() => {
    if (!layout.valid || !canvasRef.current) return;
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
        bitmaps.forEach((bitmap, imageIndex) => {
          const image = images[imageIndex];
          const cell = image ? layout.cells[image.slot] : undefined;
          if (!cell) return;
          const { x, y, width: cellWidth, height: cellHeight } = cell;
          if (!image) return;
          const cellFit = image.cellFit === "global" ? fit : image.cellFit;
          const baseScale = cellFit === "contain" ? Math.min(cellWidth / bitmap.width, cellHeight / bitmap.height) : Math.max(cellWidth / bitmap.width, cellHeight / bitmap.height);
          const angle = Number(image.rotation) * Math.PI / 180;
          const requestedZoom = Math.max(0.25, Math.min(4, Number(image.cellScale) || 1));
          const baseRotatedWidth = Math.abs(bitmap.width * baseScale * Math.cos(angle)) + Math.abs(bitmap.height * baseScale * Math.sin(angle));
          const baseRotatedHeight = Math.abs(bitmap.width * baseScale * Math.sin(angle)) + Math.abs(bitmap.height * baseScale * Math.cos(angle));
          const fillZoom = cellFit === "cover" ? Math.max(cellWidth / baseRotatedWidth, cellHeight / baseRotatedHeight) : 0.25;
          const zoom = Math.max(requestedZoom, fillZoom);
          const drawWidth = bitmap.width * baseScale * zoom, drawHeight = bitmap.height * baseScale * zoom;
          const rotatedWidth = Math.abs(drawWidth * Math.cos(angle)) + Math.abs(drawHeight * Math.sin(angle));
          const rotatedHeight = Math.abs(drawWidth * Math.sin(angle)) + Math.abs(drawHeight * Math.cos(angle));
          const maxX = cellFit === "cover" ? Math.max(0, (rotatedWidth - cellWidth) / 2) : cellWidth;
          const maxY = cellFit === "cover" ? Math.max(0, (rotatedHeight - cellHeight) / 2) : cellHeight;
          const offsetX = Math.max(-maxX, Math.min(maxX, (Number(image.cellOffsetX) || 0) / 100 * cellWidth));
          const offsetY = Math.max(-maxY, Math.min(maxY, (Number(image.cellOffsetY) || 0) / 100 * cellHeight));
          const radius = Math.min(Math.max(0, Number(cornerRadius) || 0), cellWidth / 2, cellHeight / 2);
          context.save(); context.beginPath(); context.roundRect(x, y, cellWidth, cellHeight, radius); context.clip();
          context.filter = `brightness(${image.brightness}%) contrast(${image.contrast}%) saturate(${image.saturation}%)`;
          context.translate(x + cellWidth / 2 + offsetX, y + cellHeight / 2 + offsetY);
          context.rotate(angle);
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
          const occupiedSlots = new Set(images.map((image) => image.slot));
          layout.cells.forEach((cell, slot) => {
            if (occupiedSlots.has(slot)) return;
            const radius = Math.min(Math.max(0, Number(cornerRadius) || 0), cell.width / 2, cell.height / 2);
            selectionContext.fillStyle = "#d9dee6";
            selectionContext.beginPath(); selectionContext.roundRect(cell.x, cell.y, cell.width, cell.height, radius); selectionContext.fill();
            selectionContext.strokeStyle = "#8996a8";
            selectionContext.lineWidth = Math.max(2, Math.min(cell.width, cell.height) * 0.006);
            selectionContext.beginPath(); selectionContext.roundRect(cell.x + 1, cell.y + 1, cell.width - 2, cell.height - 2, Math.max(0, radius - 1)); selectionContext.stroke();
          });
          if (selectedImage) {
            const cell = layout.cells[selectedImage.slot];
            if (cell) {
              selectionContext.strokeStyle = "#94b9ff"; selectionContext.lineWidth = Math.max(2, Math.min(cell.width, cell.height) * 0.006);
              selectionContext.beginPath(); selectionContext.roundRect(cell.x + 1, cell.y + 1, cell.width - 2, cell.height - 2, Math.max(0, Math.min(Number(cornerRadius) || 0, cell.width / 2, cell.height / 2) - 1)); selectionContext.stroke();
            }
          }
        }
        setError("");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "One or more images could not be decoded."); }
    })();
    return () => { cancelled = true; };
  }, [images, layout, background, fit, caption, captionSize, captionColor, selectedImageId, cornerRadius]);

  function addFiles(files: FileList | File[] | null) {
    if (!files?.length) return;
    const validFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const invalidCount = files.length - validFiles.length;
    const occupied = new Set(images.map((image) => image.slot));
    let preferredSlot = pendingSlotIndex.current;
    const targetReplaceSlot = pendingReplaceSlot.current;
    let replaceSlot = targetReplaceSlot;
    pendingSlotIndex.current = null;
    pendingReplaceSlot.current = null;
    const next: ImageFile[] = validFiles.map((file) => {
      let slot = preferredSlot !== null && (!occupied.has(preferredSlot) || replaceSlot === preferredSlot) ? preferredSlot : -1;
      preferredSlot = null;
      replaceSlot = null;
      if (slot < 0) { slot = 0; while (occupied.has(slot)) slot += 1; }
      occupied.add(slot);
      return newImageEntry(file, slot);
    });
    const merged = [...images];
    for (const entry of next) {
      const index = merged.findIndex((image) => image.slot === entry.slot);
      if (index >= 0) merged[index] = entry;
      else merged.push(entry);
    }
    const totalSize = merged.reduce((sum, image) => sum + image.file.size, 0);
    if (merged.length > 20) { setError("A collage supports up to 20 images."); return; }
    if (totalSize > MAX_SOURCE_BYTES) { setError("Combined image files exceed the 512 MiB prototype limit."); return; }
    if (validFiles.length) setEditorOpened(true);
    setImages(merged); setSelectedImageId((current) => targetReplaceSlot !== null ? next[0]?.id ?? current : current || next[0]?.id || ""); setError(invalidCount ? "Some files were skipped because they are not images." : "");
  }

  function updateCell(id: string, patch: Partial<Pick<ImageFile, "cellFit" | "cellScale" | "cellOffsetX" | "cellOffsetY" | "rotation" | "flipHorizontal" | "brightness" | "contrast" | "saturation">>) {
    setImages((current) => current.map((image) => image.id === id ? { ...image, ...patch } : image));
  }

  function moveTo(index: number, destination: number) {
    if (destination < 0 || destination >= images.length) return;
    setImages((current) => {
      const moving = current[index], target = current[destination];
      if (!moving || !target) return current;
      const next = [...current]; const [image] = next.splice(index, 1); next.splice(destination, 0, image);
      return next.map((entry) => entry.id === moving.id ? { ...entry, slot: target.slot } : entry.id === target.id ? { ...entry, slot: moving.slot } : entry);
    });
  }
  function move(index: number, direction: -1 | 1) { moveTo(index, index + direction); }
  function removeImage(id: string) {
    removeImageAt(id, false);
  }
  function removeImageAt(id: string, deleteCell: boolean) {
    const removed = images.find((image) => image.id === id);
    if (!removed) return;
    const next = images.filter((image) => image.id !== id).map((image) => deleteCell && image.slot > removed.slot ? { ...image, slot: image.slot - 1 } : image);
    setImages(next);
    if (deleteCell) setDeletedCellCount((count) => count + 1);
    if (selectedImageId === id) setSelectedImageId(next[0]?.id ?? "");
    setCellMenu(null);
  }
  function replaceImageInSlot(imageId: string) {
    const entry = images.find((image) => image.id === imageId);
    if (!entry) return;
    pendingSlotIndex.current = entry.slot;
    pendingReplaceSlot.current = entry.slot;
    setCellMenu(null);
    openingSlotPicker.current = true;
    imageInputRef.current?.click();
    openingSlotPicker.current = false;
  }
  function placeImageInSlot(imageId: string, slot: number) {
    setSelectedImageId(imageId);
    setActiveSidebarPanel("cell");
    setCellMenu(null);
    setImages((current) => {
      const moving = current.find((image) => image.id === imageId);
      if (!moving || moving.slot === slot) return current;
      const occupant = current.find((image) => image.slot === slot);
      return current.map((image) => image.id === moving.id ? { ...image, slot } : occupant && image.id === occupant.id ? { ...image, slot: moving.slot } : image);
    });
  }
  function stageSlotAt(clientX: number, clientY: number) {
    const stage = collageStageRef.current;
    if (!stage || !layout.outputWidth || !layout.outputHeight) return -1;
    const bounds = stage.getBoundingClientRect();
    const x = (clientX - bounds.left) / bounds.width * layout.outputWidth;
    const y = (clientY - bounds.top) / bounds.height * layout.outputHeight;
    return layout.cells.findIndex((cell) => x >= cell.x && x <= cell.x + cell.width && y >= cell.y && y <= cell.y + cell.height);
  }
  function openImageMenuAt(clientX: number, clientY: number) {
    const slot = stageSlotAt(clientX, clientY);
    const image = images.find((entry) => entry.slot === slot);
    if (!image) { setCellMenu(null); return; }
    setSelectedImageId(image.id);
    const bounds = collageStageRef.current?.getBoundingClientRect();
    if (bounds) setCellMenu({ imageId: image.id, x: Math.min(bounds.width - 196, Math.max(8, clientX - bounds.left)), y: Math.min(bounds.height - 180, Math.max(8, clientY - bounds.top)) });
  }
  function dropOnStage(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const slot = stageSlotAt(event.clientX, event.clientY);
    if (slot < 0) return;
    const files = event.dataTransfer.files;
    if (files.length) {
      pendingSlotIndex.current = slot;
      pendingReplaceSlot.current = images.some((image) => image.slot === slot) ? slot : null;
      addFiles(files);
      return;
    }
    const draggedId = event.dataTransfer.getData("text/plain");
    if (images.some((image) => image.id === draggedId)) placeImageInSlot(draggedId, slot);
  }

  function beginCellDrag(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!layout.valid || !images.length) return;
    const canvas = event.currentTarget, bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = (event.clientX - bounds.left) / bounds.width * layout.outputWidth;
    const y = (event.clientY - bounds.top) / bounds.height * layout.outputHeight;
    const index = layout.cells.findIndex((cell) => x >= cell.x && x <= cell.x + cell.width && y >= cell.y && y <= cell.y + cell.height);
    const cell = layout.cells[index], image = images.find((entry) => entry.slot === index);
    if (!cell || !image) return;
    setSelectedImageId(image.id);
    setActiveSidebarPanel("cell");
    cellGesture.current = { id: image.id, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, startX: Number(image.cellOffsetX) || 0, startY: Number(image.cellOffsetY) || 0, cellWidth: cell.width, cellHeight: cell.height };
    canvas.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function openEmptySlot(slot: number) {
    setCellMenu(null);
    pendingSlotIndex.current = slot;
    openingSlotPicker.current = true;
    imageInputRef.current?.click();
    openingSlotPicker.current = false;
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
        version: 1 as const, template, width, height, columns, rows, gap, cornerRadius, deletedCells: deletedCellCount, background, fit, caption, captionSize, captionColor,
        assets: images.map(({ id: assetId, file, slot, cellFit, cellScale, cellOffsetX, cellOffsetY, rotation, flipHorizontal, brightness, contrast, saturation }) => ({ id: assetId, name: file.name, type: file.type, size: file.size, slot, cellFit, cellScale, cellOffsetX, cellOffsetY, rotation, flipHorizontal, brightness, contrast, saturation })),
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

  const selectedCell = selectedImage ? layout.cells[selectedImage.slot] : undefined;

  return <main className={`resize-page image-collage-page${images.length || editorOpened ? " has-media" : ""}`}>
    <ToolPageHeader />
    <section className="resize-intro"><p className="eyebrow">IMAGE · LOCAL PROCESSING</p><h1>Make an image collage</h1><p>Add, reorder, and arrange images into a custom canvas. Everything renders locally in this browser.</p></section>
    {!images.length && !editorOpened ? projectLoaded ? <MediaImportScreen kind="image" accept="image/*" multiple onFiles={addFiles} error={error} secondaryAction={{ label: "Open blank collage editor", onClick: () => { setActiveSidebarPanel("layouts"); setEditorOpened(true); } }} /> : <div className="empty-preview import-loading" role="status">Opening collage project from this device…</div> : <section className="resize-workspace image-tool-workspace">
      <aside className="resize-controls collage-studio-sidebar" aria-label="Collage tools">
        <nav className="collage-studio-rail" aria-label="Collage panels">
          <button type="button" className={activeSidebarPanel === "cell" ? "active" : ""} aria-pressed={activeSidebarPanel === "cell"} onClick={() => setActiveSidebarPanel("cell")}><span aria-hidden="true">▣</span><small>Cell Edit</small></button>
          {([["images", "▧", "Image Manager"], ["layouts", "▦", "Layouts"], ["customize", "☷", "Customize"], ["text", "T", "Text"]] as const).map(([id, icon, label]) => <button type="button" key={id} className={activeSidebarPanel === id ? "active" : ""} aria-pressed={activeSidebarPanel === id} onClick={() => setActiveSidebarPanel(id)}><span aria-hidden="true">{icon}</span><small>{label}</small></button>)}
        </nav>
        <div className="collage-studio-panel">
          <header><strong>{activeSidebarPanel === "images" ? "Image Manager" : activeSidebarPanel === "layouts" ? "Layouts" : activeSidebarPanel === "customize" ? "Customize" : activeSidebarPanel === "cell" ? "Cell Edit" : "Text"}</strong><span>{images.length} images · {layout.cells.length} cells</span></header>
          <label className="file-picker collage-add-images"><span>Add images</span><input ref={imageInputRef} type="file" accept="image/*" multiple onClick={() => { if (!openingSlotPicker.current) { pendingSlotIndex.current = null; pendingReplaceSlot.current = null; } }} onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>
          {activeSidebarPanel === "images" && <section className="collage-sidebar-section">
            <label className="ratio-field">Project name<input maxLength={80} value={projectTitle} disabled={!projectLoaded} onChange={(event) => setProjectTitle(event.currentTarget.value)} /></label>
            <ol className="collage-image-list">{images.map((image, index) => <li key={image.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", image.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const draggedId = event.dataTransfer.getData("text/plain"); const sourceIndex = images.findIndex((entry) => entry.id === draggedId); if (sourceIndex >= 0) moveTo(sourceIndex, index); }}>
              <button type="button" className={selectedImage?.id === image.id ? "selected" : ""} onClick={() => setSelectedImageId(image.id)}><span className="collage-image-index">{String(image.slot + 1).padStart(2, "0")}</span><span className="collage-image-name"><strong>{image.file.name}</strong><small>{(image.file.size / 1024 / 1024).toFixed(1)} MiB</small></span></button><button type="button" aria-label={`Remove ${image.file.name}`} onClick={() => removeImage(image.id)}>×</button>
            </li>)}</ol>
            <p className="resize-note">Drag photos onto any cell to place or replace them. Click or right-click a placed photo for its actions.</p>
          </section>}
          {activeSidebarPanel === "layouts" && <section className="collage-sidebar-section"><p className="resize-note">Choose a layout. Empty cells stay available for photos.</p><div className="collage-template-options">{TEMPLATES.map((option) => <button type="button" key={option.id} className={template === option.id ? "active" : ""} aria-pressed={template === option.id} onClick={() => { setTemplate(option.id as TemplateId); setDeletedCellCount(0); }}><span className={`collage-template-thumb ${option.id}`} aria-hidden="true"><i /><i /><i /><i /></span><strong>{option.label}</strong><small>{option.summary}</small></button>)}</div>{template === "custom" && <div className="dimension-fields"><label>Columns <span>1–10</span><input type="number" min="1" max="10" step="1" value={columns} onChange={(event) => { setColumns(event.currentTarget.value); setDeletedCellCount(0); }} /></label><label>Rows <span>1–10</span><input type="number" min="1" max="10" step="1" value={rows} onChange={(event) => { setRows(event.currentTarget.value); setDeletedCellCount(0); }} /></label></div>}</section>}
          {activeSidebarPanel === "customize" && <section className="collage-sidebar-section">
            <div className="dimension-fields"><label>Canvas width <span>px</span><input type="number" min="1" max="32768" step="1" value={width} onChange={(event) => setWidth(event.currentTarget.value)} /></label><label>Canvas height <span>px</span><input type="number" min="1" max="32768" step="1" value={height} onChange={(event) => setHeight(event.currentTarget.value)} /></label></div>
            <label className="collage-slider-field">Spacing <span>{gap} px</span><input type="range" min="0" max="256" step="1" value={gap} onChange={(event) => setGap(event.currentTarget.value)} /><input type="number" min="0" max="256" step="1" value={gap} onChange={(event) => setGap(event.currentTarget.value)} /></label>
            <label className="collage-slider-field">Corner Rounding <span>{cornerRadius} px</span><input type="range" min="0" max="256" step="1" value={cornerRadius} onChange={(event) => setCornerRadius(event.currentTarget.value)} /><input type="number" min="0" max="256" step="1" value={cornerRadius} onChange={(event) => setCornerRadius(event.currentTarget.value)} /></label>
            <label className="ratio-field">Cell fit<select value={fit} onChange={(event) => setFit(event.currentTarget.value)}><option value="contain">Contain · show full image</option><option value="cover">Cover · crop to fill</option></select></label>
            <label className="ratio-field">Background color<input type="color" value={background} onChange={(event) => setBackground(event.currentTarget.value)} /></label>
          </section>}
          {activeSidebarPanel === "cell" && <section className="collage-sidebar-section">{selectedImage ? <div className="collage-selected-controls"><strong>Selected cell · {selectedImage.file.name}</strong><label>Cell fit<select value={selectedImage.cellFit} onChange={(event) => updateCell(selectedImage.id, { cellFit: event.currentTarget.value as ImageFile["cellFit"] })}><option value="global">Use collage default</option><option value="contain">Contain</option><option value="cover">Cover</option></select></label><label>Cell scale · 0.25–4×<input type="number" min="0.25" max="4" step="any" value={selectedImage.cellScale} onChange={(event) => updateCell(selectedImage.id, { cellScale: event.currentTarget.value })} /></label><label>Position X · −100–100%<input type="number" min="-100" max="100" step="any" value={selectedImage.cellOffsetX} onChange={(event) => updateCell(selectedImage.id, { cellOffsetX: event.currentTarget.value })} /></label><label>Position Y · −100–100%<input type="number" min="-100" max="100" step="any" value={selectedImage.cellOffsetY} onChange={(event) => updateCell(selectedImage.id, { cellOffsetY: event.currentTarget.value })} /></label><label>Rotate · −180–180°<input type="number" min="-180" max="180" step="any" value={selectedImage.rotation} onChange={(event) => updateCell(selectedImage.id, { rotation: event.currentTarget.value })} /></label><label className="collage-check-control"><input type="checkbox" checked={selectedImage.flipHorizontal} onChange={(event) => updateCell(selectedImage.id, { flipHorizontal: event.currentTarget.checked })} />Flip horizontally</label><label>Brightness · 0–200%<input type="number" min="0" max="200" step="any" value={selectedImage.brightness} onChange={(event) => updateCell(selectedImage.id, { brightness: event.currentTarget.value })} /></label><label>Contrast · 0–200%<input type="number" min="0" max="200" step="any" value={selectedImage.contrast} onChange={(event) => updateCell(selectedImage.id, { contrast: event.currentTarget.value })} /></label><label>Saturation · 0–200%<input type="number" min="0" max="200" step="any" value={selectedImage.saturation} onChange={(event) => updateCell(selectedImage.id, { saturation: event.currentTarget.value })} /></label><button type="button" className="secondary-button" onClick={() => updateCell(selectedImage.id, { cellFit: "global", cellScale: "1", cellOffsetX: "0", cellOffsetY: "0", rotation: "0", flipHorizontal: false, brightness: "100", contrast: "100", saturation: "100" })}>Reset image controls</button></div> : <p className="resize-note">Select a photo in the collage to edit its cell.</p>}</section>}
          {activeSidebarPanel === "text" && <section className="collage-sidebar-section"><label className="ratio-field">Collage text<input value={caption} maxLength={240} onChange={(event) => setCaption(event.currentTarget.value)} placeholder="Optional caption" /></label><div className="dimension-fields"><label>Text size <span>px</span><input type="number" min="8" max="512" step="any" value={captionSize} onChange={(event) => setCaptionSize(event.currentTarget.value)} /></label><label>Text color<input type="color" value={captionColor} onChange={(event) => setCaptionColor(event.currentTarget.value)} /></label></div></section>}
          <footer className="collage-sidebar-footer">
            <p className="resize-note">{images.length} image(s) · {layout.valid ? `${(layout.outputWidth * layout.outputHeight / 1_000_000).toFixed(1)} MP` : "Check settings"}. Limit: 20 images / 100 MP.</p>
            {!layout.valid && <p className="resize-error" role="alert">Enter valid canvas, caption, and image values.</p>}{error && <p className="resize-error" role="alert">{error}</p>}{projectStatus && <p className="source-info" role="status">{projectStatus}</p>}
            <button className="secondary-button export-button" disabled={!projectLoaded || !images.length || !layout.valid || !projectTitle.trim()} onClick={() => void saveProject()}>Save editable collage</button><button className="export-button" disabled={!images.length || !layout.valid} onClick={download}>Download collage PNG</button>
          </footer>
        </div>
      </aside>
      <div className="resize-preview collage-main-preview">
        <div className="preview-heading"><strong>Collage preview</strong><span>{`${layout.outputWidth} × ${layout.outputHeight} px · ${layout.cells.length} cells`}</span></div>
        <div className="collage-canvas-stage" ref={collageStageRef} style={{ width: `min(100%, ${(layout.outputWidth / layout.outputHeight) * 75}dvh, ${(layout.outputWidth / layout.outputHeight) * 900}px)`, aspectRatio: `${layout.outputWidth} / ${layout.outputHeight}` }} onClick={(event) => openImageMenuAt(event.clientX, event.clientY)} onContextMenu={(event) => { event.preventDefault(); openImageMenuAt(event.clientX, event.clientY); }} onDragOver={(event) => event.preventDefault()} onDrop={dropOnStage}>
          <canvas ref={canvasRef} className="preview-canvas collage-interactive-canvas" aria-label="Image collage preview. Drag a photo to reposition it." onPointerDown={beginCellDrag} onPointerMove={moveCellDrag} onPointerUp={(event) => { if (cellGesture.current?.pointerId === event.pointerId) cellGesture.current = null; }} onPointerCancel={() => { cellGesture.current = null; }} />
          <canvas ref={selectionCanvasRef} className="preview-canvas collage-selection-overlay" aria-hidden="true" />
          {layout.cells.map((cell, slot) => !images.some((image) => image.slot === slot) && <button type="button" key={slot} className="collage-add-slot" style={{ left: `${cell.x / layout.outputWidth * 100}%`, top: `${cell.y / layout.outputHeight * 100}%`, width: `${cell.width / layout.outputWidth * 100}%`, height: `${cell.height / layout.outputHeight * 100}%`, borderRadius: `${Math.min(Number(cornerRadius) || 0, cell.width / 2, cell.height / 2) / cell.width * 100}% / ${Math.min(Number(cornerRadius) || 0, cell.width / 2, cell.height / 2) / cell.height * 100}%` }} onClick={(event) => { event.stopPropagation(); openEmptySlot(slot); }}><span aria-hidden="true">＋</span><strong>Add photo</strong><small>Cell {slot + 1}</small></button>)}
          {cellMenu && <div className="collage-cell-context-menu" style={{ left: cellMenu.x, top: cellMenu.y }} onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => { setSelectedImageId(cellMenu.imageId); setActiveSidebarPanel("cell"); setCellMenu(null); }}>Edit Image</button>
            <button type="button" onClick={() => removeImageAt(cellMenu.imageId, false)}>Remove Image</button>
            <button type="button" onClick={() => replaceImageInSlot(cellMenu.imageId)}>Replace Image</button>
            <button type="button" onClick={() => removeImageAt(cellMenu.imageId, true)}>Delete Cell</button>
          </div>}
        </div>
      </div>
    </section>}
  </main>;
}
