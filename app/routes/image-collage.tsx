import { ToolPageHeader } from "../components/tool-page-header";
import { CanvasResizeHandles } from "../components/canvas-resize-handles";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/image-collage";
import { createProject, getProject, readVideoAsset, saveCollageProject } from "../lib/project-store";
import { MediaImportScreen } from "../components/media-import-screen";
import { snapLayerMove } from "../lib/canvas-snap";
import { applyGapDividerDrag, applyOverlappingEdgeDrag, cellsToNormalized, deleteCellWithAutoResize, detectGapDividers, detectOverlappingCellEdges, findCollagePreset, normalizedCellsToRects, presetCellsToRects, presetsForCategory, type CollagePreset, type CollagePresetCategory, type GapDivider, type NormalizedCell, type OverlappingEdgeHandle } from "../lib/collage-presets";

type ImageFile = { id: string; file: File; slot: number; cellFit: "global" | "contain" | "cover"; cellScale: string; cellOffsetX: string; cellOffsetY: string; rotation: string; flipHorizontal: boolean; brightness: string; contrast: string; saturation: string };
type OverlayLayer = { id: string; file: File; x: number; y: number; width: number; height: number; rotation: string; opacity: string; flipHorizontal: boolean };
type CellRect = { x: number; y: number; width: number; height: number };
type CollageSnapshot = {
  images: ImageFile[];
  overlayLayers: OverlayLayer[];
  template: string;
  columns: string;
  rows: string;
  gap: string;
  cornerRadius: string;
  width: string;
  height: string;
  background: string;
  fit: string;
  caption: string;
  captionSize: string;
  captionColor: string;
  deletedCellCount: number;
  autoResizeOnDelete: boolean;
  customNormalizedCells: NormalizedCell[] | null;
};
function snapshotSignature(s: CollageSnapshot): string {
  return JSON.stringify({
    template: s.template,
    columns: s.columns,
    rows: s.rows,
    gap: s.gap,
    cornerRadius: s.cornerRadius,
    width: s.width,
    height: s.height,
    background: s.background,
    fit: s.fit,
    caption: s.caption,
    captionSize: s.captionSize,
    captionColor: s.captionColor,
    deletedCellCount: s.deletedCellCount,
    autoResizeOnDelete: s.autoResizeOnDelete,
    customNormalizedCells: s.customNormalizedCells,
    images: s.images.map(({ id, file, slot, cellFit, cellScale, cellOffsetX, cellOffsetY, rotation, flipHorizontal, brightness, contrast, saturation }) => ({
      id, name: file.name, size: file.size, slot, cellFit, cellScale, cellOffsetX, cellOffsetY, rotation, flipHorizontal, brightness, contrast, saturation,
    })),
    overlayLayers: s.overlayLayers.map(({ id, file, x, y, width, height, rotation, opacity, flipHorizontal }) => ({
      id, name: file.name, size: file.size, x, y, width, height, rotation, opacity, flipHorizontal,
    })),
  });
}
const TEMPLATES = [
  { id: "grid", label: "Classic grid", summary: "Balanced cells" },
  { id: "feature-left", label: "Big photo left", summary: "Feature + stack" },
  { id: "feature-right", label: "Big photo right", summary: "Stack + feature" },
  { id: "feature-top", label: "Big photo top", summary: "Feature + row" },
  { id: "wide-row", label: "Wide strip", summary: "One horizontal row" },
  { id: "tall-column", label: "Tall strip", summary: "One vertical column" },
  { id: "custom", label: "Custom grid", summary: "Choose rows and columns" },
] as const;
const BACKGROUND_SWATCHES = [
  { name: "Transparent", color: "transparent" },
  { name: "White", color: "#ffffff" },
  { name: "Slate", color: "#111827" },
  { name: "Soft gray", color: "#e5e7eb" },
  { name: "Sky", color: "#dbeafe" },
  { name: "Cream", color: "#fef3c7" },
  { name: "Blush", color: "#fce7f3" },
  { name: "Mint", color: "#dcfce7" },
] as const;
type LayoutCategoryId =
  | "featured"
  | "grid"
  | "big-photo-wrap"
  | "wide"
  | "tall"
  | "square"
  | "shapes"
  | "instagram"
  | "facebook-cover"
  | "pinterest"
  | "custom";

const LAYOUT_CATEGORIES: Array<{ id: LayoutCategoryId; label: string }> = [
  { id: "featured", label: "Featured" },
  { id: "grid", label: "Grid" },
  { id: "big-photo-wrap", label: "Big Photo Wrap" },
  { id: "wide", label: "Wide" },
  { id: "tall", label: "Tall" },
  { id: "square", label: "Square" },
  { id: "shapes", label: "Shapes" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook-cover", label: "Facebook Cover" },
  { id: "pinterest", label: "Pinterest" },
];

function LayoutCategoryIcon({ id }: { id: LayoutCategoryId }) {
  switch (id) {
    case "featured":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4.5 13.7 8l3.8.5-2.7 2.7.6 3.8-3.4-1.8-3.4 1.8.6-3.8L6.5 8.5l3.8-.5z" fill="#8ea4ff" />
          <path d="M6 17c-1.5-1.5-2.3-3.5-2.3-5.8 0-2.1.7-3.9 2-5.4M18 17c1.5-1.5 2.3-3.5 2.3-5.8 0-2.1-.7-3.9-2-5.4" fill="none" stroke="#8ea4ff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "grid":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="7" height="7" rx="1" fill="#f7c8a8" />
          <rect x="13" y="4" width="7" height="7" rx="1" fill="#f7c8a8" />
          <rect x="4" y="13" width="7" height="7" rx="1" fill="#f7c8a8" />
          <rect x="13" y="13" width="7" height="7" rx="1" fill="#f7c8a8" />
        </svg>
      );
    case "big-photo-wrap":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="4.5" rx="1" fill="#c39eff" />
          <rect x="4" y="10" width="4.5" height="10" rx="1" fill="#c39eff" />
          <rect x="9.75" y="10" width="4.5" height="10" rx="1" fill="#c39eff" />
          <rect x="15.5" y="10" width="4.5" height="10" rx="1" fill="#c39eff" />
        </svg>
      );
    case "wide":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="6.5" width="5" height="11" rx="1" fill="#6ee7ff" />
          <rect x="9.5" y="6.5" width="5" height="11" rx="1" fill="#6ee7ff" />
          <rect x="16" y="6.5" width="5" height="11" rx="1" fill="#6ee7ff" />
        </svg>
      );
    case "tall":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="7" y="3.5" width="10" height="4.5" rx="1" fill="#f9e66b" />
          <rect x="7" y="9.75" width="10" height="4.5" rx="1" fill="#f9e66b" />
          <rect x="7" y="16" width="10" height="4.5" rx="1" fill="#f9e66b" />
        </svg>
      );
    case "square":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
            <rect key={`${r}-${c}`} x={4 + c * 5.7} y={4 + r * 5.7} width="4.6" height="4.6" rx=".8" fill="#b49bff" />
          )))}
        </svg>
      );
    case "shapes":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9.5" y="3.5" width="5" height="5" rx="1" fill="#62c6ff" />
          <rect x="3.5" y="9.5" width="5" height="5" rx="1" fill="#62c6ff" />
          <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="#62c6ff" />
          <rect x="15.5" y="9.5" width="5" height="5" rx="1" fill="#62c6ff" />
          <rect x="9.5" y="15.5" width="5" height="5" rx="1" fill="#62c6ff" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="4.5" fill="none" stroke="#e1306c" strokeWidth="1.9" />
          <circle cx="12" cy="12" r="3.6" fill="none" stroke="#e1306c" strokeWidth="1.9" />
          <circle cx="16.5" cy="7.5" r="1.1" fill="#e1306c" />
        </svg>
      );
    case "facebook-cover":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="#1877f2" />
          <path d="M13.5 20v-7h2.3l.4-2.7h-2.7V8.6c0-.8.2-1.3 1.4-1.3H16V5c-.3 0-1.1-.1-2-.1-2 0-3.3 1.2-3.3 3.4v2H8.5V13h2.2v7z" fill="#fff" />
        </svg>
      );
    case "pinterest":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="#e60023" />
          <path d="M12.2 7c-2.8 0-4.4 1.8-4.4 3.8 0 1 .5 1.9 1.4 2.2.1.1.2 0 .3-.1l.2-.9c0-.1 0-.2-.1-.3-.3-.3-.4-.8-.4-1.3 0-1.4 1.1-2.5 2.8-2.5 1.5 0 2.4.9 2.4 2.2 0 1.6-.8 2.8-1.9 2.8-.6 0-1.1-.5-.9-1.1.2-.8.5-1.6.5-2.1 0-.5-.3-.9-.8-.9-.6 0-1.2.7-1.2 1.6 0 .6.2 1 .2 1l-.8 3.3c-.2.9 0 2 0 2.1h.2c.1-.1 1-1.2 1.3-2.3l.4-1.5c.3.5 1 .9 1.7.9 2.2 0 3.7-2 3.7-4.6C16.8 8.7 14.9 7 12.2 7z" fill="#fff" />
        </svg>
      );
  }
}

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

function compactImageSlots(images: ImageFile[]): ImageFile[] {
  return [...images].sort((left, right) => left.slot - right.slot).map((image, slot) => image.slot === slot ? image : { ...image, slot });
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Image collage maker | OpenProducer Editor" },
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
  const cellGesture = useRef<{ id: string; pointerId: number; sourceSlot: number; clientX: number; clientY: number; startX: number; startY: number; cellWidth: number; cellHeight: number; draggingCell: boolean } | null>(null);
  const suppressStageClick = useRef(false);
  const collageStageRef = useRef<HTMLDivElement>(null);
  const pendingReplaceSlot = useRef<number | null>(null);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [overlayLayers, setOverlayLayers] = useState<OverlayLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const layerGesture = useRef<{ id: string; mode: "move" | "nw" | "ne" | "sw" | "se" | "rotate"; pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number; startW: number; startH: number; startAngle: number } | null>(null);
  const [editorOpened, setEditorOpened] = useState(false);
  const [deletedCellCount, setDeletedCellCount] = useState(0);
  const [autoResizeOnDelete, setAutoResizeOnDelete] = useState(true);
  const [customNormalizedCells, setCustomNormalizedCells] = useState<NormalizedCell[] | null>(null);
  const [activeDividerId, setActiveDividerId] = useState<string | null>(null);
  const [resizingCanvas, setResizingCanvas] = useState(false);
  const [snapGuides, setSnapGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const dividerGesture = useRef<{ divider?: GapDivider; edgeHandle?: OverlappingEdgeHandle; baseCells: NormalizedCell[]; pointerId: number } | null>(null);
  const [selectedImageId, setSelectedImageId] = useState("");
  const [dragTargetSlot, setDragTargetSlot] = useState<number | null>(null);
  const [cellMenu, setCellMenu] = useState<{ imageId?: string; emptySlot?: number; slot: number; x: number; y: number } | null>(null);
  const [projectTitle, setProjectTitle] = useState("Untitled collage");
  const [projectLoaded, setProjectLoaded] = useState(() => !projectId);
  const [projectStatus, setProjectStatus] = useState("");
  const [template, setTemplate] = useState<string>("grid");
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
  const [activeLayoutCategory, setActiveLayoutCategory] = useState<LayoutCategoryId | null>(null);
  const [layoutInfoOpen, setLayoutInfoOpen] = useState(false);
  const [error, setError] = useState("");
  const [dragCommitTick, setDragCommitTick] = useState(0);
  const restoringHistoryRef = useRef(false);
  const currentSnapshot = useMemo<CollageSnapshot>(() => ({
    images, overlayLayers, template, columns, rows, gap, cornerRadius, width, height, background, fit, caption, captionSize, captionColor, deletedCellCount, autoResizeOnDelete, customNormalizedCells,
  }), [images, overlayLayers, template, columns, rows, gap, cornerRadius, width, height, background, fit, caption, captionSize, captionColor, deletedCellCount, autoResizeOnDelete, customNormalizedCells]);
  const [history, setHistory] = useState<{ entries: CollageSnapshot[]; index: number }>(() => ({ entries: [currentSnapshot], index: 0 }));

  useEffect(() => {
    if (restoringHistoryRef.current) {
      restoringHistoryRef.current = false;
      return;
    }
    if (dividerGesture.current || cellGesture.current || layerGesture.current || resizingCanvas) return;
    const nextSig = snapshotSignature(currentSnapshot);
    setHistory((prev) => {
      const current = prev.entries[prev.index];
      if (current && snapshotSignature(current) === nextSig) return prev;
      const nextEntries = [...prev.entries.slice(0, prev.index + 1), currentSnapshot].slice(-100);
      return { entries: nextEntries, index: nextEntries.length - 1 };
    });
  }, [currentSnapshot, activeDividerId, dragCommitTick, resizingCanvas]);

  function applySnapshot(snap: CollageSnapshot) {
    restoringHistoryRef.current = true;
    setImages(snap.images);
    setOverlayLayers(snap.overlayLayers);
    setTemplate(snap.template);
    setColumns(snap.columns);
    setRows(snap.rows);
    setGap(snap.gap);
    setCornerRadius(snap.cornerRadius);
    setWidth(snap.width);
    setHeight(snap.height);
    setBackground(snap.background);
    setFit(snap.fit);
    setCaption(snap.caption);
    setCaptionSize(snap.captionSize);
    setCaptionColor(snap.captionColor);
    setDeletedCellCount(snap.deletedCellCount);
    setAutoResizeOnDelete(snap.autoResizeOnDelete);
    setCustomNormalizedCells(snap.customNormalizedCells);
    setCellMenu(null);
  }

  const canUndo = history.index > 0;
  const canRedo = history.index < history.entries.length - 1;
  function undo() {
    if (history.index <= 0) return;
    const nextIndex = history.index - 1;
    applySnapshot(history.entries[nextIndex]);
    setHistory((prev) => ({ ...prev, index: nextIndex }));
  }
  function redo() {
    if (history.index >= history.entries.length - 1) return;
    const nextIndex = history.index + 1;
    applySnapshot(history.entries[nextIndex]);
    setHistory((prev) => ({ ...prev, index: nextIndex }));
  }

  useEffect(() => {
    if (!images.length && !editorOpened) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "SELECT" || (target.tagName === "INPUT" && !["checkbox", "range", "color", "button"].includes((target as HTMLInputElement).type)))) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "y" && !event.shiftKey) || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const selectedImage = images.find((image) => image.id === selectedImageId) ?? images[0] ?? null;
  const selectedLayer = overlayLayers.find((layer) => layer.id === selectedLayerId) ?? null;

  useEffect(() => () => { bitmapCache.current.forEach(({ bitmap }) => bitmap.close()); bitmapCache.current.clear(); }, []);
  useEffect(() => {
    const liveIds = new Set([...images.map((image) => image.id), ...overlayLayers.map((layer) => layer.id)]);
    for (const [id, entry] of bitmapCache.current) if (!liveIds.has(id)) { entry.bitmap.close(); bitmapCache.current.delete(id); }
  }, [images, overlayLayers]);

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
        const restoredLayers = await Promise.all((project.collageDocument.layers ?? []).map(async (layer) => {
          const file = await readVideoAsset(layer.id);
          if (!file) throw new Error(`The saved layer image “${layer.name}” is missing.`);
          return {
            id: layer.id,
            file,
            x: layer.x,
            y: layer.y,
            width: layer.width,
            height: layer.height,
            rotation: layer.rotation ?? "0",
            opacity: layer.opacity ?? "100",
            flipHorizontal: layer.flipHorizontal ?? false,
          };
        }));
        if (cancelled) return;
        setImages(restored); setOverlayLayers(restoredLayers); setSelectedImageId(restored[0]?.id ?? ""); setSelectedLayerId(""); setProjectTitle(project.title);
        setWidth(project.collageDocument.width); setHeight(project.collageDocument.height); setColumns(project.collageDocument.columns); setRows(project.collageDocument.rows ?? "3"); setCornerRadius(project.collageDocument.cornerRadius ?? "0"); setDeletedCellCount(project.collageDocument.deletedCells ?? 0); setCustomNormalizedCells(project.collageDocument.customCells ?? null);
        setTemplate(
          TEMPLATES.some((option) => option.id === project.collageDocument?.template) || findCollagePreset(project.collageDocument?.template)
            ? project.collageDocument!.template!
            : "grid"
        );
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
    const activePreset = findCollagePreset(template);
    const geometryColumns = Number.isInteger(columnCount) ? Math.max(1, Math.min(10, columnCount)) : 1;
    const rowCount = Number(rows), geometryRows = Number.isInteger(rowCount) ? Math.max(1, Math.min(10, rowCount)) : 1;
    const minimumSlots = activePreset ? activePreset.cells.length : template === "grid" || template === "custom" ? geometryColumns * geometryRows : template === "wide-row" || template === "tall-column" ? 4 : 3;
    const filledRows = template === "grid" ? Math.ceil(images.length / geometryColumns) * geometryColumns : images.length;
    const slotCount = activePreset
      ? activePreset.cells.length
      : template === "custom"
        ? Math.max(1, minimumSlots - deletedCellCount)
        : Math.max(1, Math.max(minimumSlots, filledRows, ...images.map((image) => image.slot + 1)) - deletedCellCount);
    const baseNormalizedCells = customNormalizedCells
      ? customNormalizedCells
      : activePreset
        ? activePreset.cells
        : cellsToNormalized(
            collageCells(template as TemplateId, slotCount, geometryColumns, outputWidth, outputHeight, gapSize),
            outputWidth,
            outputHeight,
            gapSize,
          );
    const cells = customNormalizedCells
      ? normalizedCellsToRects(customNormalizedCells, outputWidth, outputHeight, gapSize)
      : activePreset
        ? presetCellsToRects(activePreset, outputWidth, outputHeight, gapSize)
        : collageCells(template as TemplateId, slotCount, geometryColumns, outputWidth, outputHeight, gapSize);
    const gapDividers = detectGapDividers(baseNormalizedCells);
    const overlappingEdges = detectOverlappingCellEdges(baseNormalizedCells);
    const occupiedSlots = new Set(images.map((image) => image.slot));
    const imagesOutsideGrid = images.some((image) => !cells[image.slot]);
    const gridTooSmall = (template === "custom" || Boolean(activePreset)) && images.length > cells.length;
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
      && !gridTooSmall && !imagesOutsideGrid
      && (!caption || (Number.isFinite(Number(captionSize)) && Number(captionSize) >= 8 && Number(captionSize) <= 512)) && cellsValid && cellGeometryValid;
    return { columnCount, gapSize, outputWidth, outputHeight, cells, baseNormalizedCells, gapDividers, overlappingEdges, gridTooSmall, imagesOutsideGrid, valid };
  }, [columns, rows, gap, cornerRadius, width, height, images, caption, captionSize, template, deletedCellCount, customNormalizedCells]);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (!layout.valid) {
      const canvas = canvasRef.current;
      canvas.width = Math.max(1, layout.outputWidth || 1);
      canvas.height = Math.max(1, layout.outputHeight || 1);
      const context = canvas.getContext("2d");
      if (context) {
        if (background === "transparent") context.clearRect(0, 0, canvas.width, canvas.height);
        else { context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height); }
      }
      const selectionCanvas = selectionCanvasRef.current;
      if (selectionCanvas) {
        selectionCanvas.width = canvas.width;
        selectionCanvas.height = canvas.height;
        selectionCanvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
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
        const layerBitmaps = await Promise.all(overlayLayers.map(async ({ id, file }) => {
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
        if (background === "transparent") context.clearRect(0, 0, canvas.width, canvas.height);
        else { context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height); }
        if (layout.cells.some((cell) => cell.width <= 0 || cell.height <= 0)) throw new Error("The selected template and spacing leave no room for image cells.");
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
        const sorted = images
          .map((image, imageIndex) => ({ image, bitmap: bitmaps[imageIndex] }))
          .sort((a, b) => a.image.slot - b.image.slot);
        sorted.forEach(({ image, bitmap }) => {
          const cell = layout.cells[image.slot];
          if (!cell) return;
          const { x, y, width: cellWidth, height: cellHeight } = cell;
          const radius = Math.min(Math.max(0, Number(cornerRadius) || 0), cellWidth / 2, cellHeight / 2);
          if (layout.gapSize > 0) {
            context.save();
            if (background === "transparent") {
              context.globalCompositeOperation = "destination-out";
              context.fillStyle = "#000000";
            } else {
              context.fillStyle = background;
            }
            context.beginPath();
            context.roundRect(x - layout.gapSize, y - layout.gapSize, cellWidth + layout.gapSize * 2, cellHeight + layout.gapSize * 2, radius + layout.gapSize);
            context.fill();
            context.restore();
          }
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
          context.save(); context.beginPath(); context.roundRect(x, y, cellWidth, cellHeight, radius); context.clip();
          context.filter = `brightness(${image.brightness}%) contrast(${image.contrast}%) saturate(${image.saturation}%)`;
          context.translate(x + cellWidth / 2 + offsetX, y + cellHeight / 2 + offsetY);
          context.rotate(angle);
          context.scale(image.flipHorizontal ? -1 : 1, 1);
          context.drawImage(bitmap, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
          context.restore();
        });
        overlayLayers.forEach((layer, layerIndex) => {
          const bitmap = layerBitmaps[layerIndex];
          if (!bitmap || layer.width <= 0 || layer.height <= 0) return;
          const angle = (Number(layer.rotation) || 0) * Math.PI / 180;
          const alpha = Math.max(0, Math.min(1, (Number(layer.opacity) || 100) / 100));
          context.save();
          context.globalAlpha = alpha;
          context.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
          context.rotate(angle);
          context.scale(layer.flipHorizontal ? -1 : 1, 1);
          context.drawImage(bitmap, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
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
            const radius = Math.min(Math.max(0, Number(cornerRadius) || 0), cell.width / 2, cell.height / 2);
            if (occupiedSlots.has(slot)) {
              // Ensure an occupied later overlapping cell's gap border stays clear on selectionCanvas too
              if (layout.gapSize > 0 && layout.cells.slice(0, slot).some((prev) => prev.x < cell.x + cell.width && prev.x + prev.width > cell.x && prev.y < cell.y + cell.height && prev.y + prev.height > cell.y)) {
                selectionContext.clearRect(cell.x - layout.gapSize, cell.y - layout.gapSize, cell.width + layout.gapSize * 2, cell.height + layout.gapSize * 2);
              }
              return;
            }
            if (layout.gapSize > 0 && layout.cells.slice(0, slot).some((prev) => prev.x < cell.x + cell.width && prev.x + prev.width > cell.x && prev.y < cell.y + cell.height && prev.y + prev.height > cell.y)) {
              selectionContext.clearRect(cell.x - layout.gapSize, cell.y - layout.gapSize, cell.width + layout.gapSize * 2, cell.height + layout.gapSize * 2);
            }
            selectionContext.fillStyle = "#d9dee6";
            selectionContext.beginPath(); selectionContext.roundRect(cell.x, cell.y, cell.width, cell.height, radius); selectionContext.fill();
            selectionContext.strokeStyle = "#8996a8";
            selectionContext.lineWidth = Math.max(2, Math.min(cell.width, cell.height) * 0.006);
            selectionContext.beginPath(); selectionContext.roundRect(cell.x + 1, cell.y + 1, cell.width - 2, cell.height - 2, Math.max(0, radius - 1)); selectionContext.stroke();
          });
        }
        setError("");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "One or more images could not be decoded."); }
    })();
    return () => { cancelled = true; };
  }, [images, overlayLayers, editorOpened, layout, background, fit, caption, captionSize, captionColor, selectedImageId, cornerRadius]);

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

  function changeTemplate(nextTemplate: TemplateId) {
    const templateChanged = nextTemplate !== template;
    setTemplate(nextTemplate);
    setDeletedCellCount(0);
    setCustomNormalizedCells(null);
    if (templateChanged) setImages((current) => compactImageSlots(current));
  }

  function changeCustomGrid(nextColumns: string, nextRows: string) {
    const dimensionsChanged = nextColumns !== columns || nextRows !== rows;
    setColumns(nextColumns);
    setRows(nextRows);
    setDeletedCellCount(0);
    setCustomNormalizedCells(null);
    const columnCount = Number(nextColumns), rowCount = Number(nextRows);
    if (dimensionsChanged && Number.isInteger(columnCount) && columnCount >= 1 && columnCount <= 10
      && Number.isInteger(rowCount) && rowCount >= 1 && rowCount <= 10
      && columnCount * rowCount >= images.length) {
      setImages((current) => compactImageSlots(current));
    }
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
    const canDeleteCell = deleteCell && layout.baseNormalizedCells.length > 1;
    const next = images.filter((image) => image.id !== id).map((image) => canDeleteCell && image.slot > removed.slot ? { ...image, slot: image.slot - 1 } : image);
    setImages(next);
    if (canDeleteCell) {
      setCustomNormalizedCells(deleteCellWithAutoResize(layout.baseNormalizedCells, removed.slot, autoResizeOnDelete));
    }
    if (selectedImageId === id) setSelectedImageId(next[0]?.id ?? "");
    setCellMenu(null);
  }
  function deleteEmptyCell(slot: number) {
    if (layout.baseNormalizedCells.length <= 1) { setCellMenu(null); return; }
    setCustomNormalizedCells(deleteCellWithAutoResize(layout.baseNormalizedCells, slot, autoResizeOnDelete));
    setImages((current) => current.map((image) => image.slot > slot ? { ...image, slot: image.slot - 1 } : image));
    setCellMenu(null);
  }
  function openEmptyMenuAt(slot: number, clientX: number, clientY: number, element: HTMLElement) {
    const stageBounds = collageStageRef.current?.getBoundingClientRect();
    if (!stageBounds) return;
    const cellBounds = element.getBoundingClientRect();
    const xPos = clientX || (cellBounds.left + cellBounds.width / 2);
    const yPos = clientY || (cellBounds.top + cellBounds.height / 2);
    setCellMenu({
      emptySlot: slot,
      slot,
      x: Math.min(Math.max(8, stageBounds.width - 176), Math.max(8, xPos - stageBounds.left)),
      y: Math.min(Math.max(8, stageBounds.height - 104), Math.max(8, yPos - stageBounds.top)),
    });
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
  function findTopCellIndex(x: number, y: number) {
    for (let i = layout.cells.length - 1; i >= 0; i--) {
      const cell = layout.cells[i];
      if (x >= cell.x && x <= cell.x + cell.width && y >= cell.y && y <= cell.y + cell.height) return i;
    }
    return -1;
  }
  function stageSlotAt(clientX: number, clientY: number) {
    const stage = collageStageRef.current;
    if (!stage || !layout.outputWidth || !layout.outputHeight) return -1;
    const bounds = stage.getBoundingClientRect();
    const x = (clientX - bounds.left) / bounds.width * layout.outputWidth;
    const y = (clientY - bounds.top) / bounds.height * layout.outputHeight;
    return findTopCellIndex(x, y);
  }
  function openImageMenuAt(clientX: number, clientY: number) {
    const slot = stageSlotAt(clientX, clientY);
    const image = images.find((entry) => entry.slot === slot);
    if (!image) { setCellMenu(null); return; }
    setSelectedImageId(image.id);
    const bounds = collageStageRef.current?.getBoundingClientRect();
    if (bounds) setCellMenu({ imageId: image.id, slot, x: Math.min(bounds.width - 196, Math.max(8, clientX - bounds.left)), y: Math.min(bounds.height - 180, Math.max(8, clientY - bounds.top)) });
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
    const index = findTopCellIndex(x, y);
    const cell = layout.cells[index], image = images.find((entry) => entry.slot === index);
    if (!cell || !image) return;
    setSelectedLayerId("");
    setSelectedImageId(image.id);
    setActiveSidebarPanel("cell");
    cellGesture.current = { id: image.id, pointerId: event.pointerId, sourceSlot: index, clientX: event.clientX, clientY: event.clientY, startX: Number(image.cellOffsetX) || 0, startY: Number(image.cellOffsetY) || 0, cellWidth: cell.width, cellHeight: cell.height, draggingCell: false };
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
    const distance = Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY);
    const destinationSlot = stageSlotAt(event.clientX, event.clientY);
    if (gesture.draggingCell || (distance > 8 && destinationSlot !== gesture.sourceSlot)) {
      if (!gesture.draggingCell) {
        gesture.draggingCell = true;
        updateCell(gesture.id, { cellOffsetX: String(gesture.startX), cellOffsetY: String(gesture.startY) });
      }
      const targetSlot = destinationSlot >= 0 && destinationSlot !== gesture.sourceSlot ? destinationSlot : null;
      setDragTargetSlot((current) => current === targetSlot ? current : targetSlot);
      event.preventDefault();
      return;
    }
    if (distance <= 2) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - gesture.clientX) / bounds.width * layout.outputWidth / gesture.cellWidth * 100;
    const dy = (event.clientY - gesture.clientY) / bounds.height * layout.outputHeight / gesture.cellHeight * 100;
    updateCell(gesture.id, { cellOffsetX: String(Math.max(-100, Math.min(100, Math.round((gesture.startX + dx) * 100) / 100))), cellOffsetY: String(Math.max(-100, Math.min(100, Math.round((gesture.startY + dy) * 100) / 100))) });
  }

  function finishCellDrag(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = cellGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.draggingCell) {
      suppressStageClick.current = true;
      window.setTimeout(() => { suppressStageClick.current = false; }, 0);
      const destinationSlot = stageSlotAt(event.clientX, event.clientY);
      if (destinationSlot >= 0 && destinationSlot !== gesture.sourceSlot) placeImageInSlot(gesture.id, destinationSlot);
    }
    cellGesture.current = null;
    setDragTargetSlot(null);
    setDragCommitTick((t) => t + 1);
  }

  function cancelCellDrag(event: React.PointerEvent<HTMLCanvasElement>) {
    if (cellGesture.current?.pointerId !== event.pointerId) return;
    cellGesture.current = null;
    setDragTargetSlot(null);
    setDragCommitTick((t) => t + 1);
  }

  function beginDividerDrag(target: { divider?: GapDivider; edgeHandle?: OverlappingEdgeHandle; id: string }, event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    event.preventDefault();
    const baseCells = customNormalizedCells ?? layout.baseNormalizedCells;
    dividerGesture.current = { divider: target.divider, edgeHandle: target.edgeHandle, baseCells, pointerId: event.pointerId };
    setActiveDividerId(target.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDividerDrag(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = dividerGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !collageStageRef.current) return;
    const orientation = gesture.divider?.orientation ?? gesture.edgeHandle?.orientation;
    if (!orientation) return;
    const bounds = collageStageRef.current.getBoundingClientRect();
    const safeGap = Math.max(0, layout.gapSize);
    const totalW = Math.max(1, layout.outputWidth);
    const totalH = Math.max(1, layout.outputHeight);
    const nextPos = orientation === "vertical"
      ? (event.clientX - bounds.left - (bounds.width * safeGap / 2) / totalW) / Math.max(1, bounds.width * (totalW - safeGap) / totalW)
      : (event.clientY - bounds.top - (bounds.height * safeGap / 2) / totalH) / Math.max(1, bounds.height * (totalH - safeGap) / totalH);
    if (gesture.divider) setCustomNormalizedCells(applyGapDividerDrag(gesture.baseCells, gesture.divider, nextPos));
    else if (gesture.edgeHandle) setCustomNormalizedCells(applyOverlappingEdgeDrag(gesture.baseCells, gesture.edgeHandle, nextPos));
  }

  function endDividerDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dividerGesture.current?.pointerId !== event.pointerId) return;
    dividerGesture.current = null;
    setActiveDividerId(null);
  }

  async function addLayerFiles(files: FileList | File[] | null) {
    if (!files?.length) return;
    const validFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!validFiles.length) { setError("Some files were skipped because they are not images."); return; }
    const outW = Math.max(1, layout.outputWidth || 1200);
    const outH = Math.max(1, layout.outputHeight || 900);
    const created: OverlayLayer[] = [];
    for (const file of validFiles) {
      const bitmap = await createImageBitmap(file);
      const id = crypto.randomUUID();
      bitmapCache.current.set(id, { file, bitmap });
      const scale = Math.min((outW * 0.4) / Math.max(1, bitmap.width), (outH * 0.4) / Math.max(1, bitmap.height));
      const w = Math.max(24, Math.round(bitmap.width * scale));
      const h = Math.max(24, Math.round(bitmap.height * scale));
      created.push({
        id,
        file,
        x: Math.round((outW - w) / 2),
        y: Math.round((outH - h) / 2),
        width: w,
        height: h,
        rotation: "0",
        opacity: "100",
        flipHorizontal: false,
      });
    }
    setEditorOpened(true);
    setOverlayLayers((prev) => [...prev, ...created]);
    if (created[0]) {
      setSelectedLayerId(created[created.length - 1].id);
      setActiveSidebarPanel("cell");
    }
    setError(validFiles.length < files.length ? "Some files were skipped because they are not images." : "");
  }

  function updateOverlayLayer(id: string, patch: Partial<OverlayLayer>) {
    setOverlayLayers((prev) => prev.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  }

  function removeOverlayLayer(id: string) {
    setOverlayLayers((prev) => prev.filter((layer) => layer.id !== id));
    if (selectedLayerId === id) setSelectedLayerId("");
  }

  function moveOverlayLayer(id: string, delta: -1 | 1) {
    setOverlayLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function beginLayerDrag(layer: OverlayLayer, mode: "move" | "nw" | "ne" | "sw" | "se" | "rotate", event: React.PointerEvent<HTMLElement>) {
    event.stopPropagation();
    event.preventDefault();
    setCellMenu(null);
    setSelectedLayerId(layer.id);
    setActiveSidebarPanel("cell");
    layerGesture.current = {
      id: layer.id,
      mode,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: layer.x,
      startY: layer.y,
      startW: layer.width,
      startH: layer.height,
      startAngle: Number(layer.rotation) || 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveLayerDrag(event: React.PointerEvent<HTMLElement>) {
    const g = layerGesture.current;
    if (!g || g.pointerId !== event.pointerId || !collageStageRef.current) return;
    const bounds = collageStageRef.current.getBoundingClientRect();
    const scaleX = layout.outputWidth / Math.max(1, bounds.width);
    const scaleY = layout.outputHeight / Math.max(1, bounds.height);
    const dx = (event.clientX - g.startClientX) * scaleX;
    const dy = (event.clientY - g.startClientY) * scaleY;
    if (g.mode === "move") {
      const others = [
        ...layout.cells.map((c) => ({ x: c.x, y: c.y, width: c.width, height: c.height })),
        ...overlayLayers.filter((l) => l.id !== g.id).map((l) => ({ x: l.x, y: l.y, width: l.width, height: l.height })),
      ];
      const snapped = snapLayerMove(
        { x: Math.round(g.startX + dx), y: Math.round(g.startY + dy), width: g.startW, height: g.startH },
        layout.outputWidth,
        layout.outputHeight,
        others,
      );
      setSnapGuides({ x: snapped.guideX, y: snapped.guideY });
      updateOverlayLayer(g.id, { x: snapped.x, y: snapped.y });
      return;
    }
    if (g.mode === "rotate") {
      const cx = bounds.left + ((g.startX + g.startW / 2) / layout.outputWidth) * bounds.width;
      const cy = bounds.top + ((g.startY + g.startH / 2) / layout.outputHeight) * bounds.height;
      const angle = Math.round((Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI + 90);
      const norm = ((angle + 180) % 360 + 360) % 360 - 180;
      updateOverlayLayer(g.id, { rotation: String(norm) });
      return;
    }
    const aspect = g.startW / Math.max(1, g.startH);
    const minSize = 20;
    let nextX = g.startX, nextY = g.startY, nextW = g.startW, nextH = g.startH;
    if (g.mode === "se") {
      nextW = Math.max(minSize, g.startW + dx);
      nextH = event.shiftKey ? Math.max(minSize, g.startH + dy) : Math.max(minSize, nextW / aspect);
    } else if (g.mode === "sw") {
      nextW = Math.max(minSize, g.startW - dx);
      nextH = event.shiftKey ? Math.max(minSize, g.startH + dy) : Math.max(minSize, nextW / aspect);
      nextX = g.startX + (g.startW - nextW);
    } else if (g.mode === "ne") {
      nextW = Math.max(minSize, g.startW + dx);
      nextH = event.shiftKey ? Math.max(minSize, g.startH - dy) : Math.max(minSize, nextW / aspect);
      nextY = g.startY + (g.startH - nextH);
    } else if (g.mode === "nw") {
      nextW = Math.max(minSize, g.startW - dx);
      nextH = event.shiftKey ? Math.max(minSize, g.startH - dy) : Math.max(minSize, nextW / aspect);
      nextX = g.startX + (g.startW - nextW);
      nextY = g.startY + (g.startH - nextH);
    }
    updateOverlayLayer(g.id, { x: Math.round(nextX), y: Math.round(nextY), width: Math.round(nextW), height: Math.round(nextH) });
  }

  function endLayerDrag(event: React.PointerEvent<HTMLElement>) {
    if (layerGesture.current?.pointerId !== event.pointerId) return;
    layerGesture.current = null;
    setSnapGuides({ x: null, y: null });
    setDragCommitTick((t) => t + 1);
  }

  async function saveProject() {
    if (!projectLoaded || (!images.length && !overlayLayers.length) || !layout.valid || !projectTitle.trim()) return;
    try {
      let id = projectId;
      if (!id) id = (await createProject(projectTitle.trim(), "image")).id;
      const document = {
        version: 1 as const, template, width, height, columns, rows, gap, cornerRadius, deletedCells: deletedCellCount, ...(customNormalizedCells ? { customCells: customNormalizedCells } : {}), background, fit, caption, captionSize, captionColor,
        assets: images.map(({ id: assetId, file, slot, cellFit, cellScale, cellOffsetX, cellOffsetY, rotation, flipHorizontal, brightness, contrast, saturation }) => ({ id: assetId, name: file.name, type: file.type, size: file.size, slot, cellFit, cellScale, cellOffsetX, cellOffsetY, rotation, flipHorizontal, brightness, contrast, saturation })),
        ...(overlayLayers.length ? { layers: overlayLayers.map(({ id: layerId, file, x, y, width: lw, height: lh, rotation, opacity, flipHorizontal }) => ({ id: layerId, name: file.name, type: file.type, size: file.size, x, y, width: lw, height: lh, rotation, opacity, flipHorizontal })) } : {}),
      };
      const allFiles = [
        ...images.map(({ id: assetId, file }) => ({ id: assetId, file })),
        ...overlayLayers.map(({ id: layerId, file }) => ({ id: layerId, file })),
      ];
      await saveCollageProject(id, document, allFiles, projectTitle);
      setProjectStatus("Collage project saved on this device."); setError("");
      if (id !== projectId) setSearchParams({ project: id });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the collage project."); }
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas || (!images.length && !overlayLayers.length) || !layout.valid) return;
    canvas.toBlob((blob) => {
      if (!blob) { setError("The collage could not be exported."); return; }
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `local-studio-collage-${layout.outputWidth}x${layout.outputHeight}.png`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  const selectedCell = selectedImage ? layout.cells[selectedImage.slot] : undefined;

  function selectFixedPreset(preset: CollagePreset) {
    setTemplate(preset.id);
    setDeletedCellCount(0);
    setCustomNormalizedCells(null);
    setImages((current) => compactImageSlots(current));
    const base = 1200;
    const nextW = preset.aspectRatio >= 1 ? base : Math.round(base * preset.aspectRatio);
    const nextH = preset.aspectRatio >= 1 ? Math.round(base / preset.aspectRatio) : base;
    setWidth(String(nextW));
    setHeight(String(nextH));
  }

  return <main className={`resize-page image-collage-page${images.length || overlayLayers.length || editorOpened ? " has-media" : ""}`}>
    <ToolPageHeader />
    <section className="resize-intro"><p className="eyebrow">IMAGE · LOCAL PROCESSING</p><h1>Make an image collage</h1><p>Add, reorder, and arrange images into a custom canvas. Everything renders locally in this browser.</p></section>
    {!images.length && !overlayLayers.length && !editorOpened ? projectLoaded ? <MediaImportScreen kind="image" accept="image/*" multiple onFiles={addFiles} error={error} secondaryAction={{ label: "Open blank collage editor", onClick: () => { setActiveSidebarPanel("layouts"); setEditorOpened(true); } }} /> : <div className="empty-preview import-loading" role="status">Opening collage project from this device…</div> : <section className="resize-workspace image-tool-workspace">
      <aside className="resize-controls collage-studio-sidebar" aria-label="Collage tools">
        <nav className="collage-studio-rail" aria-label="Collage panels">
          <button type="button" className={activeSidebarPanel === "cell" ? "active" : ""} aria-pressed={activeSidebarPanel === "cell"} onClick={() => setActiveSidebarPanel("cell")}><span aria-hidden="true">▣</span><small>Cell Edit</small></button>
          {([["images", "▧", "Image Manager"], ["layouts", "▦", "Layouts"], ["customize", "☷", "Customize"], ["text", "T", "Text"]] as const).map(([id, icon, label]) => <button type="button" key={id} className={activeSidebarPanel === id ? "active" : ""} aria-pressed={activeSidebarPanel === id} onClick={() => setActiveSidebarPanel(id)}><span aria-hidden="true">{icon}</span><small>{label}</small></button>)}
        </nav>
        <div className="collage-studio-panel">
          {activeSidebarPanel !== "layouts" && <header><strong>{activeSidebarPanel === "images" ? "Image Manager" : activeSidebarPanel === "customize" ? "Customize" : activeSidebarPanel === "cell" ? "Cell Edit" : "Text"}</strong><span>{images.length} images · {layout.cells.length} cells</span></header>}
          {activeSidebarPanel !== "layouts" && <label className="file-picker collage-add-images"><span>Add images</span><input ref={imageInputRef} type="file" accept="image/*" multiple onClick={() => { if (!openingSlotPicker.current) { pendingSlotIndex.current = null; pendingReplaceSlot.current = null; } }} onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>}
          {activeSidebarPanel === "layouts" && <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/*" multiple onClick={() => { if (!openingSlotPicker.current) { pendingSlotIndex.current = null; pendingReplaceSlot.current = null; } }} onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} />}
          {activeSidebarPanel === "images" && <section className="collage-sidebar-section">
            <label className="ratio-field">Project name<input maxLength={80} value={projectTitle} disabled={!projectLoaded} onChange={(event) => setProjectTitle(event.currentTarget.value)} /></label>
            <label className="file-picker collage-add-layer"><span>Add image as layer</span><input type="file" accept="image/*" multiple onChange={(event) => { void addLayerFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>
            <ol className="collage-image-list">{images.map((image, index) => <li key={image.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", image.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const draggedId = event.dataTransfer.getData("text/plain"); const sourceIndex = images.findIndex((entry) => entry.id === draggedId); if (sourceIndex >= 0) moveTo(sourceIndex, index); }}>
              <button type="button" className={selectedImage?.id === image.id && !selectedLayerId ? "selected" : ""} onClick={() => { setSelectedLayerId(""); setSelectedImageId(image.id); }}><span className="collage-image-index">{String(image.slot + 1).padStart(2, "0")}</span><span className="collage-image-name"><strong>{image.file.name}</strong><small>{(image.file.size / 1024 / 1024).toFixed(1)} MiB</small></span></button><button type="button" aria-label={`Remove ${image.file.name}`} onClick={() => removeImage(image.id)}>×</button>
            </li>)}</ol>
            {overlayLayers.length > 0 && <>
              <strong style={{ fontSize: 11, color: "#c9d6ea" }}>Overlay layers ({overlayLayers.length})</strong>
              <ol className="collage-image-list">{overlayLayers.map((layer, idx) => <li key={layer.id}>
                <button type="button" className={selectedLayerId === layer.id ? "selected" : ""} onClick={() => { setSelectedLayerId(layer.id); setActiveSidebarPanel("cell"); }}><span className="collage-image-index">L{idx + 1}</span><span className="collage-image-name"><strong>{layer.file.name}</strong><small>{layer.width} × {layer.height} px</small></span></button>
                <button type="button" aria-label={`Remove layer ${layer.file.name}`} onClick={() => removeOverlayLayer(layer.id)}>×</button>
              </li>)}</ol>
            </>}
            <p className="resize-note">Drag photos onto any cell, or add floating image layers that can be moved, resized, and rotated anywhere.</p>
          </section>}
          {activeSidebarPanel === "layouts" && <section className="collage-sidebar-section collage-layouts-panel">
            {activeLayoutCategory === null ? <>
              <div className="collage-layouts-top">
                <div className="collage-layouts-title-row">
                  <strong>Layouts</strong>
                  <button type="button" className="collage-info-btn" aria-label="About layouts" aria-expanded={layoutInfoOpen} onClick={() => setLayoutInfoOpen((v) => !v)}>i</button>
                </div>
                {layoutInfoOpen && <p className="resize-note">Pick Collage Wizard to auto-fit your photos, Custom for rows &amp; columns, or browse fixed Layout Presets below.</p>}
                <button type="button" className="collage-wizard-btn" onClick={() => { changeTemplate("grid"); setColumns(String(Math.max(1, Math.min(4, Math.ceil(Math.sqrt(Math.max(1, images.length))))))); }}>Collage Wizard</button>
                <div className="collage-layout-mode-row">
                  <button type="button" className="collage-mode-btn" onClick={() => { changeTemplate("grid"); setProjectStatus("Freeform preset mode is ready for its presets."); }}>Freeform</button>
                  <button type="button" className={`collage-mode-btn${template === "custom" ? " is-active" : ""}`} onClick={() => { changeTemplate("custom"); setActiveLayoutCategory("custom"); }}>Custom</button>
                </div>
              </div>
              <div className="collage-presets-group">
                <strong className="collage-presets-heading">Layout Presets</strong>
                <div className="collage-preset-categories" role="list">
                  {LAYOUT_CATEGORIES.map((category) => (
                    <button type="button" key={category.id} className="collage-preset-category-btn" onClick={() => setActiveLayoutCategory(category.id)}>
                      <span className="collage-preset-category-icon"><LayoutCategoryIcon id={category.id} /></span>
                      <span>{category.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </> : <div className="collage-preset-subpage">
              <div className="collage-subpage-header">
                <button type="button" className="collage-subpage-back-icon" aria-label="Back to Layout Presets" onClick={() => setActiveLayoutCategory(null)}>←</button>
                <strong>{activeLayoutCategory === "custom" ? "Custom Grid" : LAYOUT_CATEGORIES.find((c) => c.id === activeLayoutCategory)?.label}</strong>
              </div>
              {activeLayoutCategory === "custom" ? (
                <div className="dimension-fields">
                  <label>Columns <span>1–10</span><input type="number" min="1" max="10" step="1" value={columns} onChange={(event) => changeCustomGrid(event.currentTarget.value, rows)} /></label>
                  <label>Rows <span>1–10</span><input type="number" min="1" max="10" step="1" value={rows} onChange={(event) => changeCustomGrid(columns, event.currentTarget.value)} /></label>
                </div>
              ) : (() => {
                const fixedPresets = presetsForCategory(activeLayoutCategory as CollagePresetCategory);
                if (fixedPresets.length > 0) {
                  return (
                    <div className="collage-fixed-preset-grid">
                      {fixedPresets.map((preset) => {
                        const isSelected = template === preset.id;
                        const viewW = 100;
                        const viewH = Math.round(100 / Math.max(0.35, Math.min(2.6, preset.aspectRatio)));
                        return (
                          <button
                            type="button"
                            key={preset.id}
                            className={`collage-fixed-preset-btn${isSelected ? " active" : ""}`}
                            aria-pressed={isSelected}
                            title={preset.name}
                            onClick={() => selectFixedPreset(preset)}
                          >
                            <svg viewBox={`0 0 ${viewW} ${viewH}`} aria-hidden="true">
                              {preset.category !== "shapes" && <rect x="0" y="0" width={viewW} height={viewH} fill={isSelected ? "#596ef5" : "#4b59c9"} />}
                              {preset.cells.map((cell, idx) => (
                                <rect
                                  key={idx}
                                  x={cell.x * viewW + 1.0}
                                  y={cell.y * viewH + 1.0}
                                  width={Math.max(1, cell.w * viewW - 2.0)}
                                  height={Math.max(1, cell.h * viewH - 2.0)}
                                  fill={isSelected ? "#adc3ff" : "#f4f6fb"}
                                  stroke={isSelected ? "#596ef5" : "#4b59c9"}
                                  strokeWidth={1.2}
                                />
                              ))}
                            </svg>
                          </button>
                        );
                      })}
                    </div>
                  );
                }
                const legacyTemplates = TEMPLATES.filter((option) => {
                  if (activeLayoutCategory === "grid") return option.id === "grid";
                  if (activeLayoutCategory === "big-photo-wrap") return option.id === "feature-left" || option.id === "feature-right" || option.id === "feature-top";
                  if (activeLayoutCategory === "wide") return option.id === "wide-row";
                  if (activeLayoutCategory === "tall") return option.id === "tall-column";
                  return false;
                });
                return legacyTemplates.length > 0 ? (
                  <div className="collage-template-options">
                    {legacyTemplates.map((option) => (
                      <button type="button" key={option.id} className={template === option.id ? "active" : ""} aria-pressed={template === option.id} onClick={() => changeTemplate(option.id)}>
                        <span className={`collage-template-thumb ${option.id}`} aria-hidden="true"><i /><i /><i /><i /></span>
                        <strong>{option.label}</strong>
                        <small>{option.summary}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="resize-note">Fixed presets for {LAYOUT_CATEGORIES.find((c) => c.id === activeLayoutCategory)?.label} are ready to be added.</p>
                );
              })()}
            </div>}
          </section>}
          {activeSidebarPanel === "customize" && <section className="collage-sidebar-section">
            <div className="dimension-fields"><label>Canvas width <span>px</span><input type="number" min="1" max="32768" step="1" value={width} onChange={(event) => setWidth(event.currentTarget.value)} /></label><label>Canvas height <span>px</span><input type="number" min="1" max="32768" step="1" value={height} onChange={(event) => setHeight(event.currentTarget.value)} /></label></div>
            <label className="collage-slider-field">Spacing <span>{gap} px</span><input type="range" min="0" max="256" step="1" value={gap} onChange={(event) => setGap(event.currentTarget.value)} /><input type="number" min="0" max="256" step="1" value={gap} onChange={(event) => setGap(event.currentTarget.value)} /></label>
            <label className="collage-slider-field">Corner Rounding <span>{cornerRadius} px</span><input type="range" min="0" max="256" step="1" value={cornerRadius} onChange={(event) => setCornerRadius(event.currentTarget.value)} /><input type="number" min="0" max="256" step="1" value={cornerRadius} onChange={(event) => setCornerRadius(event.currentTarget.value)} /></label>
            <label className="ratio-field">Cell fit<select value={fit} onChange={(event) => setFit(event.currentTarget.value)}><option value="contain">Contain · show full image</option><option value="cover">Cover · crop to fill</option></select></label>
            <label className="collage-check-control"><input type="checkbox" checked={autoResizeOnDelete} onChange={(event) => setAutoResizeOnDelete(event.currentTarget.checked)} />Auto-resize neighbors when deleting a cell</label>
            <div className="collage-background-picker"><strong>Background color</strong><div className="collage-background-swatches" aria-label="Background color presets">{BACKGROUND_SWATCHES.map((swatch) => <button type="button" key={swatch.color} data-transparent={swatch.color === "transparent" ? "true" : undefined} className={background.toLowerCase() === swatch.color ? "active" : ""} style={swatch.color === "transparent" ? undefined : { "--swatch-color": swatch.color } as React.CSSProperties} aria-label={`${swatch.name} background`} aria-pressed={background.toLowerCase() === swatch.color} title={swatch.name} onClick={() => setBackground(swatch.color)} />)}</div><label className="collage-custom-color">Custom color<input type="color" aria-label="Choose custom background color" value={background === "transparent" ? "#ffffff" : background} onChange={(event) => setBackground(event.currentTarget.value)} /></label></div>
          </section>}
          {activeSidebarPanel === "cell" && <section className="collage-sidebar-section">{selectedLayer ? <div className="collage-selected-controls">
            <strong>Selected layer · {selectedLayer.file.name}</strong>
            <div className="dimension-fields"><label>X <span>px</span><input type="number" step="1" value={selectedLayer.x} onChange={(event) => updateOverlayLayer(selectedLayer.id, { x: Number(event.currentTarget.value) || 0 })} /></label><label>Y <span>px</span><input type="number" step="1" value={selectedLayer.y} onChange={(event) => updateOverlayLayer(selectedLayer.id, { y: Number(event.currentTarget.value) || 0 })} /></label></div>
            <div className="dimension-fields"><label>Width <span>px</span><input type="number" min="10" step="1" value={selectedLayer.width} onChange={(event) => updateOverlayLayer(selectedLayer.id, { width: Math.max(10, Number(event.currentTarget.value) || 10) })} /></label><label>Height <span>px</span><input type="number" min="10" step="1" value={selectedLayer.height} onChange={(event) => updateOverlayLayer(selectedLayer.id, { height: Math.max(10, Number(event.currentTarget.value) || 10) })} /></label></div>
            <label>Rotate · −180–180°<input type="number" min="-180" max="180" step="any" value={selectedLayer.rotation} onChange={(event) => updateOverlayLayer(selectedLayer.id, { rotation: event.currentTarget.value })} /></label>
            <label>Opacity · 0–100%<input type="number" min="0" max="100" step="1" value={selectedLayer.opacity} onChange={(event) => updateOverlayLayer(selectedLayer.id, { opacity: event.currentTarget.value })} /></label>
            <label className="collage-check-control"><input type="checkbox" checked={selectedLayer.flipHorizontal} onChange={(event) => updateOverlayLayer(selectedLayer.id, { flipHorizontal: event.currentTarget.checked })} />Flip horizontally</label>
            <div className="dimension-fields">
              <button type="button" className="secondary-button" onClick={() => moveOverlayLayer(selectedLayer.id, -1)}>Send backward</button>
              <button type="button" className="secondary-button" onClick={() => moveOverlayLayer(selectedLayer.id, 1)}>Bring forward</button>
            </div>
            <button type="button" className="secondary-button" onClick={() => removeOverlayLayer(selectedLayer.id)}>Delete layer</button>
          </div> : selectedImage ? <div className="collage-selected-controls">
            <strong>Selected cell · {selectedImage.file.name}</strong>
            <label>Cell position<select aria-label="Move selected photo to cell" value={selectedImage.slot} onChange={(event) => placeImageInSlot(selectedImage.id, Number(event.currentTarget.value))}>{layout.cells.map((_, slot) => { const occupant = images.find((image) => image.slot === slot); const status = !occupant ? " · empty" : occupant.id === selectedImage.id ? " · current" : ` · swap with ${occupant.file.name}`; return <option key={slot} value={slot}>Cell {slot + 1}{status}</option>; })}</select></label>
            <label>Cell fit<select value={selectedImage.cellFit} onChange={(event) => updateCell(selectedImage.id, { cellFit: event.currentTarget.value as ImageFile["cellFit"] })}><option value="global">Use collage default</option><option value="contain">Contain</option><option value="cover">Cover</option></select></label>
            <label>Cell scale · 0.25–4×<input type="number" min="0.25" max="4" step="any" value={selectedImage.cellScale} onChange={(event) => updateCell(selectedImage.id, { cellScale: event.currentTarget.value })} /></label>
            <label>Position X · −100–100%<input type="number" min="-100" max="100" step="any" value={selectedImage.cellOffsetX} onChange={(event) => updateCell(selectedImage.id, { cellOffsetX: event.currentTarget.value })} /></label>
            <label>Position Y · −100–100%<input type="number" min="-100" max="100" step="any" value={selectedImage.cellOffsetY} onChange={(event) => updateCell(selectedImage.id, { cellOffsetY: event.currentTarget.value })} /></label>
            <label>Rotate · −180–180°<input type="number" min="-180" max="180" step="any" value={selectedImage.rotation} onChange={(event) => updateCell(selectedImage.id, { rotation: event.currentTarget.value })} /></label>
            <label className="collage-check-control"><input type="checkbox" checked={selectedImage.flipHorizontal} onChange={(event) => updateCell(selectedImage.id, { flipHorizontal: event.currentTarget.checked })} />Flip horizontally</label>
            <label>Brightness · 0–200%<input type="number" min="0" max="200" step="any" value={selectedImage.brightness} onChange={(event) => updateCell(selectedImage.id, { brightness: event.currentTarget.value })} /></label>
            <label>Contrast · 0–200%<input type="number" min="0" max="200" step="any" value={selectedImage.contrast} onChange={(event) => updateCell(selectedImage.id, { contrast: event.currentTarget.value })} /></label>
            <label>Saturation · 0–200%<input type="number" min="0" max="200" step="any" value={selectedImage.saturation} onChange={(event) => updateCell(selectedImage.id, { saturation: event.currentTarget.value })} /></label>
            <button type="button" className="secondary-button" onClick={() => updateCell(selectedImage.id, { cellFit: "global", cellScale: "1", cellOffsetX: "0", cellOffsetY: "0", rotation: "0", flipHorizontal: false, brightness: "100", contrast: "100", saturation: "100" })}>Reset image controls</button>
          </div> : <p className="resize-note">Select a photo in the collage to edit its cell.</p>}</section>}
          {activeSidebarPanel === "text" && <section className="collage-sidebar-section"><label className="ratio-field">Collage text<input value={caption} maxLength={240} onChange={(event) => setCaption(event.currentTarget.value)} placeholder="Optional caption" /></label><div className="dimension-fields"><label>Text size <span>px</span><input type="number" min="8" max="512" step="any" value={captionSize} onChange={(event) => setCaptionSize(event.currentTarget.value)} /></label><label>Text color<input type="color" value={captionColor} onChange={(event) => setCaptionColor(event.currentTarget.value)} /></label></div></section>}
          <footer className="collage-sidebar-footer">
            <p className="resize-note">{images.length} cell image(s) · {overlayLayers.length} layer(s) · {layout.valid ? `${(layout.outputWidth * layout.outputHeight / 1_000_000).toFixed(1)} MP` : "Check settings"}.</p>
            {!layout.valid && <p className="resize-error" role="alert">{layout.gridTooSmall ? "Add rows or columns so every photo has a cell." : layout.imagesOutsideGrid ? "Some photos are outside the current grid. Increase the grid size to fit them." : "Enter valid canvas, caption, and image values."}</p>}{error && <p className="resize-error" role="alert">{error}</p>}{projectStatus && <p className="source-info" role="status">{projectStatus}</p>}
            <button className="secondary-button export-button" disabled={!projectLoaded || (!images.length && !overlayLayers.length) || !layout.valid || !projectTitle.trim()} onClick={() => void saveProject()}>Save editable collage</button><button className="export-button" disabled={(!images.length && !overlayLayers.length) || !layout.valid} onClick={download}>Download collage PNG</button>
          </footer>
        </div>
      </aside>
      <div className="resize-preview collage-main-preview">
        <div className="preview-heading">
          <strong>Collage preview</strong>
          <div className="collage-history-actions">
            <button type="button" className="collage-history-btn" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)" aria-label="Undo">↶ Undo</button>
            <button type="button" className="collage-history-btn" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Y)" aria-label="Redo">↷ Redo</button>
            <span>{`${layout.outputWidth} × ${layout.outputHeight} px · ${layout.cells.length} cells`}</span>
          </div>
        </div>
        <div className="collage-stage-frame">
        <div className={`collage-canvas-stage${background === "transparent" ? " is-transparent" : ""}${activeDividerId || resizingCanvas ? " is-dragging-divider" : ""}`} ref={collageStageRef} style={{ width: `min(100%, ${(layout.outputWidth / layout.outputHeight) * 56}dvh, ${(layout.outputWidth / layout.outputHeight) * 680}px)`, aspectRatio: `${layout.outputWidth} / ${layout.outputHeight}`, ...(background === "transparent" ? {} : { backgroundColor: background }) }} onPointerMove={(event) => { if (!cellMenu) return; if (event.target instanceof Element && event.target.closest(".collage-cell-context-menu")) return; if (stageSlotAt(event.clientX, event.clientY) !== cellMenu.slot) setCellMenu(null); }} onPointerLeave={() => { if (cellMenu) setCellMenu(null); }} onClick={(event) => { if (suppressStageClick.current) { suppressStageClick.current = false; return; } openImageMenuAt(event.clientX, event.clientY); }} onContextMenu={(event) => { event.preventDefault(); openImageMenuAt(event.clientX, event.clientY); }} onDragOver={(event) => event.preventDefault()} onDrop={dropOnStage}>
          <canvas ref={canvasRef} className="preview-canvas collage-interactive-canvas" aria-label="Image collage preview. Drag a photo to reposition it within its cell or to another cell." onPointerDown={beginCellDrag} onPointerMove={moveCellDrag} onPointerUp={finishCellDrag} onPointerCancel={cancelCellDrag} />
          <canvas ref={selectionCanvasRef} className="preview-canvas collage-selection-overlay" aria-hidden="true" />
          {snapGuides.x !== null && <div className="collage-snap-v" style={{ left: `${(snapGuides.x / Math.max(1, layout.outputWidth)) * 100}%` }} aria-hidden="true" />}
          {snapGuides.y !== null && <div className="collage-snap-h" style={{ top: `${(snapGuides.y / Math.max(1, layout.outputHeight)) * 100}%` }} aria-hidden="true" />}
          {layout.cells.map((cell, slot) => {
            if (images.some((image) => image.slot === slot)) return null;
            const overlappingLater = layout.cells.slice(slot + 1).find(
              (other) => other.x < cell.x + cell.width && other.x + other.width > cell.x && other.y < cell.y + cell.height && other.y + other.height > cell.y,
            );
            let clipPath: string | undefined;
            if (overlappingLater) {
              const g = layout.gapSize;
              const clampPct = (v: number) => Math.max(0, Math.min(100, v));
              const L = clampPct(((overlappingLater.x - g - cell.x) / cell.width) * 100);
              const T = clampPct(((overlappingLater.y - g - cell.y) / cell.height) * 100);
              const R = clampPct(((overlappingLater.x + overlappingLater.width + g - cell.x) / cell.width) * 100);
              const B = clampPct(((overlappingLater.y + overlappingLater.height + g - cell.y) / cell.height) * 100);
              clipPath = `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${L}% ${T}%, ${R}% ${T}%, ${R}% ${B}%, ${L}% ${B}%, ${L}% ${T}%)`;
            }
            return (
              <button
                type="button"
                key={slot}
                className="collage-add-slot"
                aria-label={`Add photo to cell ${slot + 1}`}
                style={{
                  zIndex: 10 + slot,
                  left: `${cell.x / layout.outputWidth * 100}%`,
                  top: `${cell.y / layout.outputHeight * 100}%`,
                  width: `${cell.width / layout.outputWidth * 100}%`,
                  height: `${cell.height / layout.outputHeight * 100}%`,
                  borderRadius: `${Math.min(Number(cornerRadius) || 0, cell.width / 2, cell.height / 2) / cell.width * 100}% / ${Math.min(Number(cornerRadius) || 0, cell.width / 2, cell.height / 2) / cell.height * 100}%`,
                  clipPath,
                }}
                onClick={(event) => { event.stopPropagation(); openEmptyMenuAt(slot, event.clientX, event.clientY, event.currentTarget); }}
              >
                <span aria-hidden="true">+</span>
              </button>
            );
          })}
          {[
            ...layout.gapDividers.map((divider) => ({
              id: divider.id,
              orientation: divider.orientation,
              pos: divider.pos,
              spanStart: divider.spanStart,
              spanEnd: divider.spanEnd,
              label: `Resize ${divider.orientation === "vertical" ? "column" : "row"} gap`,
              divider,
              edgeHandle: undefined,
            })),
            ...layout.overlappingEdges.map((edgeHandle) => ({
              id: edgeHandle.id,
              orientation: edgeHandle.orientation,
              pos: edgeHandle.pos,
              spanStart: edgeHandle.spanStart,
              spanEnd: edgeHandle.spanEnd,
              label: `Resize overlapping cell ${edgeHandle.edge} edge`,
              divider: undefined,
              edgeHandle,
            })),
          ].map((handle) => {
            const safeGap = Math.max(0, layout.gapSize);
            const isVertical = handle.orientation === "vertical";
            const primarySize = Math.max(1, isVertical ? layout.outputWidth : layout.outputHeight);
            const perpSize = Math.max(1, isVertical ? layout.outputHeight : layout.outputWidth);
            const posPct = ((safeGap / 2 + handle.pos * Math.max(1, primarySize - safeGap)) / primarySize) * 100;
            const startPct = ((safeGap / 2 + handle.spanStart * Math.max(1, perpSize - safeGap)) / perpSize) * 100;
            const endPct = ((safeGap / 2 + handle.spanEnd * Math.max(1, perpSize - safeGap)) / perpSize) * 100;
            return (
              <div
                key={handle.id}
                role="separator"
                aria-orientation={handle.orientation}
                aria-label={handle.label}
                className={`collage-gap-divider ${handle.orientation}${activeDividerId === handle.id ? " is-active" : ""}`}
                style={isVertical
                  ? { left: `${posPct}%`, top: `${startPct}%`, height: `${Math.max(0, endPct - startPct)}%`, zIndex: handle.edgeHandle ? 28 : 25 }
                  : { top: `${posPct}%`, left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%`, zIndex: handle.edgeHandle ? 28 : 25 }}
                onPointerDown={(event) => beginDividerDrag(handle, event)}
                onPointerMove={moveDividerDrag}
                onPointerUp={endDividerDrag}
                onPointerCancel={endDividerDrag}
                onClick={(event) => event.stopPropagation()}
              />
            );
          })}
          {overlayLayers.map((layer, idx) => {
            const isSelected = selectedLayerId === layer.id;
            return (
              <div
                key={layer.id}
                className={`collage-layer-box${isSelected ? " is-selected" : ""}`}
                style={{
                  zIndex: 32 + idx,
                  left: `${(layer.x / Math.max(1, layout.outputWidth)) * 100}%`,
                  top: `${(layer.y / Math.max(1, layout.outputHeight)) * 100}%`,
                  width: `${(layer.width / Math.max(1, layout.outputWidth)) * 100}%`,
                  height: `${(layer.height / Math.max(1, layout.outputHeight)) * 100}%`,
                  transform: `rotate(${Number(layer.rotation) || 0}deg)`,
                }}
                onPointerDown={(event) => beginLayerDrag(layer, "move", event)}
                onPointerMove={moveLayerDrag}
                onPointerUp={endLayerDrag}
                onPointerCancel={endLayerDrag}
                onClick={(event) => event.stopPropagation()}
              >
                {isSelected && <>
                  <button type="button" className="collage-layer-handle nw" aria-label="Resize top-left" onPointerDown={(event) => beginLayerDrag(layer, "nw", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                  <button type="button" className="collage-layer-handle ne" aria-label="Resize top-right" onPointerDown={(event) => beginLayerDrag(layer, "ne", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                  <button type="button" className="collage-layer-handle sw" aria-label="Resize bottom-left" onPointerDown={(event) => beginLayerDrag(layer, "sw", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                  <button type="button" className="collage-layer-handle se" aria-label="Resize bottom-right" onPointerDown={(event) => beginLayerDrag(layer, "se", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                  <button type="button" className="collage-layer-handle rotate" aria-label="Rotate layer" onPointerDown={(event) => beginLayerDrag(layer, "rotate", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                </>}
              </div>
            );
          })}
          {dragTargetSlot !== null && layout.cells[dragTargetSlot] && <div className="collage-drop-target" aria-hidden="true" style={{ left: `${layout.cells[dragTargetSlot].x / layout.outputWidth * 100}%`, top: `${layout.cells[dragTargetSlot].y / layout.outputHeight * 100}%`, width: `${layout.cells[dragTargetSlot].width / layout.outputWidth * 100}%`, height: `${layout.cells[dragTargetSlot].height / layout.outputHeight * 100}%`, borderRadius: `${Math.min(Number(cornerRadius) || 0, layout.cells[dragTargetSlot].width / 2, layout.cells[dragTargetSlot].height / 2) / layout.cells[dragTargetSlot].width * 100}% / ${Math.min(Number(cornerRadius) || 0, layout.cells[dragTargetSlot].width / 2, layout.cells[dragTargetSlot].height / 2) / layout.cells[dragTargetSlot].height * 100}%` }} />}
          {cellMenu && <div className="collage-cell-context-menu" style={{ left: cellMenu.x, top: cellMenu.y }} onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.stopPropagation()}>
            {cellMenu.imageId ? <>
              <button type="button" onClick={() => { setSelectedImageId(cellMenu.imageId!); setActiveSidebarPanel("cell"); setCellMenu(null); }}>Edit Image</button>
              <button type="button" onClick={() => removeImageAt(cellMenu.imageId!, false)}>Remove Image</button>
              <button type="button" onClick={() => replaceImageInSlot(cellMenu.imageId!)}>Replace Image</button>
              <button type="button" disabled={layout.cells.length <= 1} onClick={() => removeImageAt(cellMenu.imageId!, true)}>Delete Cell</button>
            </> : cellMenu.emptySlot !== undefined ? <>
              <button type="button" onClick={() => openEmptySlot(cellMenu.emptySlot!)}>Add Image</button>
              <button type="button" disabled={layout.cells.length <= 1} onClick={() => deleteEmptyCell(cellMenu.emptySlot!)}>Delete Cell</button>
            </> : null}
          </div>}
        </div>
        {layout.outputWidth > 0 && layout.outputHeight > 0 && (
          <CanvasResizeHandles
            width={layout.outputWidth}
            height={layout.outputHeight}
            stageRef={collageStageRef}
            onResize={(nextW, nextH, shiftX, shiftY) => {
              setWidth(String(nextW));
              setHeight(String(nextH));
              if (shiftX !== 0 || shiftY !== 0) {
                setOverlayLayers((prev) => prev.map((l) => ({ ...l, x: l.x + shiftX, y: l.y + shiftY })));
              }
            }}
            onDragStateChange={setResizingCanvas}
          />
        )}
        </div>
      </div>
    </section>}
  </main>;
}
