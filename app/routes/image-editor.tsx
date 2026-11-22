import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasResizeHandles } from "../components/canvas-resize-handles";
import { ToolPageHeader } from "../components/tool-page-header";
import { snapAxisCoordinate, snapLayerMove } from "../lib/canvas-snap";
import type { Route } from "./+types/image-editor";

type BaseImage = { id: string; file: File; width: number; height: number };

type EditorLayer =
  | {
      id: string;
      kind: "image";
      name: string;
      file: File;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: string;
      opacity: string;
      flipHorizontal: boolean;
      brightness: string;
      contrast: string;
      saturation: string;
      visible: boolean;
    }
  | {
      id: string;
      kind: "text";
      name: string;
      text: string;
      fontFamily: string;
      fontSize: number;
      bold: boolean;
      italic: boolean;
      fill: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: string;
      opacity: string;
      visible: boolean;
    }
  | {
      id: string;
      kind: "rectangle" | "ellipse";
      name: string;
      fill: string;
      strokeColor: string;
      strokeWidth: number;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: string;
      opacity: string;
      visible: boolean;
    };

type EditorSnapshot = {
  width: string;
  height: string;
  background: string;
  baseImage: BaseImage | null;
  baseBrightness: string;
  baseContrast: string;
  baseSaturation: string;
  baseRotation: string;
  baseFlipHorizontal: boolean;
  layers: EditorLayer[];
};

const BACKGROUND_SWATCHES = [
  { name: "Transparent", color: "transparent" },
  { name: "White", color: "#ffffff" },
  { name: "Black", color: "#000000" },
  { name: "Slate", color: "#111827" },
  { name: "Soft gray", color: "#e5e7eb" },
  { name: "Sky", color: "#dbeafe" },
  { name: "Cream", color: "#fef3c7" },
  { name: "Blush", color: "#fce7f3" },
] as const;

const CANVAS_PRESETS = [
  { label: "1200 × 900", w: "1200", h: "900" },
  { label: "1080 × 1080", w: "1080", h: "1080" },
  { label: "1920 × 1080", w: "1920", h: "1080" },
  { label: "1080 × 1920", w: "1080", h: "1920" },
] as const;

const FONT_FAMILIES = [
  { label: "System Sans", value: "system-ui, sans-serif" },
  { label: "Inter", value: '"Inter", system-ui, sans-serif' },
  { label: "Ubuntu", value: '"Ubuntu", system-ui, sans-serif' },
  { label: "Georgia Serif", value: 'Georgia, "Times New Roman", serif' },
  { label: "Times Serif", value: '"Times New Roman", serif' },
  { label: "Trebuchet", value: '"Trebuchet MS", sans-serif' },
  { label: "Courier Mono", value: '"Courier New", monospace' },
  { label: "Impact", value: "Impact, Haettenschweiler, sans-serif" },
] as const;

const MAX_PIXELS = 100_000_000;

let textMeasureCtx: CanvasRenderingContext2D | null = null;
function measureTextLayerSize(
  layer: { text: string; fontFamily: string; fontSize: number; bold: boolean; italic: boolean },
  constrainWidth?: number,
): { width: number; height: number } {
  if (typeof document === "undefined") {
    const lineCount = Math.max(1, layer.text.split("\n").length);
    return { width: constrainWidth ?? Math.max(40, Math.round(layer.text.length * layer.fontSize * 0.6)), height: Math.ceil(lineCount * layer.fontSize * 1.25) };
  }
  if (!textMeasureCtx) {
    textMeasureCtx = document.createElement("canvas").getContext("2d");
  }
  const ctx = textMeasureCtx;
  if (!ctx) return { width: constrainWidth ?? 160, height: Math.ceil(layer.fontSize * 1.25) };
  ctx.font = `${layer.italic ? "italic " : ""}${layer.bold ? "700" : "500"} ${layer.fontSize}px ${layer.fontFamily || "system-ui, sans-serif"}`;
  const paragraphs = layer.text.split("\n");
  if (constrainWidth === undefined) {
    const maxW = Math.max(...paragraphs.map((p) => ctx.measureText(p || " ").width));
    return {
      width: Math.max(16, Math.ceil(maxW) + 4),
      height: Math.max(16, Math.ceil(paragraphs.length * layer.fontSize * 1.25)),
    };
  }
  const maxW = Math.max(16, constrainWidth);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ");
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxW || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return {
    width: Math.round(maxW),
    height: Math.max(16, Math.ceil(lines.length * layer.fontSize * 1.25)),
  };
}

function snapshotKey(s: EditorSnapshot): string {
  return JSON.stringify({
    width: s.width,
    height: s.height,
    background: s.background,
    baseImageId: s.baseImage?.id ?? null,
    baseBrightness: s.baseBrightness,
    baseContrast: s.baseContrast,
    baseSaturation: s.baseSaturation,
    baseRotation: s.baseRotation,
    baseFlipHorizontal: s.baseFlipHorizontal,
    layers: s.layers.map((layer) => {
      if (layer.kind === "image") {
        const { file: _file, ...rest } = layer;
        return rest;
      }
      return layer;
    }),
  });
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Image Editor | Local Studio" },
    {
      name: "description",
      content: "Start with a blank or colored/transparent canvas or insert an image, add image, text, and shape layers, and export locally.",
    },
    { name: "robots", content: "index,follow" },
  ];
}

export default function ImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const bitmapCache = useRef(new Map<string, { file: File; bitmap: ImageBitmap }>());
  const panGesture = useRef<{ pointerId: number; startClientX: number; startClientY: number; startPanX: number; startPanY: number } | null>(null);
  const [viewTransform, setViewTransform] = useState({ zoom: 1, panX: 0, panY: 0 });
  const layerGesture = useRef<{
    id: string;
    mode: "move" | "nw" | "ne" | "sw" | "se" | "e" | "w" | "rotate";
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startFontSize?: number;
  } | null>(null);

  const [panel, setPanel] = useState<"canvas" | "layers" | "export">("canvas");
  const [width, setWidth] = useState("1200");
  const [height, setHeight] = useState("900");
  const [background, setBackground] = useState("#ffffff");
  const [baseImage, setBaseImage] = useState<BaseImage | null>(null);
  const [baseBrightness, setBaseBrightness] = useState("100");
  const [baseContrast, setBaseContrast] = useState("100");
  const [baseSaturation, setBaseSaturation] = useState("100");
  const [baseRotation, setBaseRotation] = useState("0");
  const [baseFlipHorizontal, setBaseFlipHorizontal] = useState(false);
  const [layers, setLayers] = useState<EditorLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg">("png");
  const [jpegQuality, setJpegQuality] = useState("0.92");
  const [error, setError] = useState("");
  const [dragCommitTick, setDragCommitTick] = useState(0);
  const [snapGuides, setSnapGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [resizingCanvas, setResizingCanvas] = useState(false);
  const restoringHistoryRef = useRef(false);

  const outWidth = Number(width);
  const outHeight = Number(height);
  const canvasValid =
    Number.isInteger(outWidth) &&
    outWidth > 0 &&
    outWidth <= 32768 &&
    Number.isInteger(outHeight) &&
    outHeight > 0 &&
    outHeight <= 32768 &&
    outWidth * outHeight <= MAX_PIXELS;

  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) ?? null;

  const currentSnapshot = useMemo<EditorSnapshot>(
    () => ({
      width,
      height,
      background,
      baseImage,
      baseBrightness,
      baseContrast,
      baseSaturation,
      baseRotation,
      baseFlipHorizontal,
      layers,
    }),
    [width, height, background, baseImage, baseBrightness, baseContrast, baseSaturation, baseRotation, baseFlipHorizontal, layers],
  );

  const [history, setHistory] = useState<{ entries: EditorSnapshot[]; index: number }>(() => ({
    entries: [currentSnapshot],
    index: 0,
  }));

  useEffect(() => {
    if (restoringHistoryRef.current) {
      restoringHistoryRef.current = false;
      return;
    }
    if (layerGesture.current || resizingCanvas) return;
    const nextSig = snapshotKey(currentSnapshot);
    setHistory((prev) => {
      const current = prev.entries[prev.index];
      if (current && snapshotKey(current) === nextSig) return prev;
      const nextEntries = [...prev.entries.slice(0, prev.index + 1), currentSnapshot].slice(-100);
      return { entries: nextEntries, index: nextEntries.length - 1 };
    });
  }, [currentSnapshot, dragCommitTick, resizingCanvas]);

  function applySnapshot(snap: EditorSnapshot) {
    restoringHistoryRef.current = true;
    setWidth(snap.width);
    setHeight(snap.height);
    setBackground(snap.background);
    setBaseImage(snap.baseImage);
    setBaseBrightness(snap.baseBrightness);
    setBaseContrast(snap.baseContrast);
    setBaseSaturation(snap.baseSaturation);
    setBaseRotation(snap.baseRotation);
    setBaseFlipHorizontal(snap.baseFlipHorizontal);
    setLayers(snap.layers);
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          (target.tagName === "INPUT" && !["checkbox", "range", "color", "button"].includes((target as HTMLInputElement).type)))
      ) {
        return;
      }
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

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setViewTransform((prev) => {
        const nextZoom = Math.max(0.2, Math.min(5, Math.round(prev.zoom * factor * 100) / 100));
        if (Math.abs(nextZoom - 1) < 0.04 && prev.zoom !== 1) {
          return { zoom: 1, panX: 0, panY: 0 };
        }
        const rect = el.getBoundingClientRect();
        const mx = event.clientX - (rect.left + rect.width / 2);
        const my = event.clientY - (rect.top + rect.height / 2);
        const ratio = nextZoom / prev.zoom;
        return {
          zoom: nextZoom,
          panX: mx - (mx - prev.panX) * ratio,
          panY: my - (my - prev.panY) * ratio,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => () => {
    bitmapCache.current.forEach(({ bitmap }) => bitmap.close());
    bitmapCache.current.clear();
  }, []);

  useEffect(() => {
    const liveIds = new Set<string>();
    if (baseImage) liveIds.add(baseImage.id);
    for (const layer of layers) if (layer.kind === "image") liveIds.add(layer.id);
    for (const [id, entry] of bitmapCache.current) {
      if (!liveIds.has(id)) {
        entry.bitmap.close();
        bitmapCache.current.delete(id);
      }
    }
  }, [baseImage, layers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasValid) return;
    let cancelled = false;
    void (async () => {
      try {
        const getBitmap = async (id: string, file: File) => {
          const existing = bitmapCache.current.get(id);
          if (existing?.file === file) return existing.bitmap;
          existing?.bitmap.close();
          const bitmap = await createImageBitmap(file);
          bitmapCache.current.set(id, { file, bitmap });
          return bitmap;
        };
        const baseBitmap = baseImage ? await getBitmap(baseImage.id, baseImage.file) : null;
        const imageBitmaps = new Map<string, ImageBitmap>();
        for (const layer of layers) {
          if (layer.kind === "image" && layer.visible) {
            imageBitmaps.set(layer.id, await getBitmap(layer.id, layer.file));
          }
        }
        if (cancelled) return;
        canvas.width = outWidth;
        canvas.height = outHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setError("This browser could not create an image canvas.");
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        if (background === "transparent") {
          ctx.clearRect(0, 0, outWidth, outHeight);
        } else {
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, outWidth, outHeight);
        }
        const clampPct = (v: string) => {
          const n = Number(v);
          return Number.isFinite(n) ? Math.min(300, Math.max(0, n)) : 100;
        };
        if (baseBitmap) {
          const angle = (Number(baseRotation) || 0) * Math.PI / 180;
          ctx.save();
          ctx.translate(outWidth / 2, outHeight / 2);
          ctx.rotate(angle);
          if (baseFlipHorizontal) ctx.scale(-1, 1);
          ctx.filter = `brightness(${clampPct(baseBrightness)}%) contrast(${clampPct(baseContrast)}%) saturate(${clampPct(baseSaturation)}%)`;
          ctx.drawImage(baseBitmap, -outWidth / 2, -outHeight / 2, outWidth, outHeight);
          ctx.restore();
        }
        for (const layer of layers) {
          if (!layer.visible || layer.width <= 0 || layer.height <= 0) continue;
          const angle = (Number(layer.rotation) || 0) * Math.PI / 180;
          const alpha = Math.max(0, Math.min(1, (Number(layer.opacity) || 100) / 100));
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
          ctx.rotate(angle);
          if (layer.kind === "image") {
            const bitmap = imageBitmaps.get(layer.id);
            if (bitmap) {
              if (layer.flipHorizontal) ctx.scale(-1, 1);
              ctx.filter = `brightness(${clampPct(layer.brightness)}%) contrast(${clampPct(layer.contrast)}%) saturate(${clampPct(layer.saturation)}%)`;
              ctx.drawImage(bitmap, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
            }
          } else if (layer.kind === "rectangle") {
            ctx.fillStyle = layer.fill;
            ctx.fillRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);
            if (layer.strokeWidth > 0) {
              ctx.strokeStyle = layer.strokeColor;
              ctx.lineWidth = layer.strokeWidth;
              ctx.strokeRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);
            }
          } else if (layer.kind === "ellipse") {
            ctx.fillStyle = layer.fill;
            ctx.beginPath();
            ctx.ellipse(0, 0, layer.width / 2, layer.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            if (layer.strokeWidth > 0) {
              ctx.strokeStyle = layer.strokeColor;
              ctx.lineWidth = layer.strokeWidth;
              ctx.stroke();
            }
          } else if (layer.kind === "text") {
            ctx.fillStyle = layer.fill;
            ctx.font = `${layer.italic ? "italic " : ""}${layer.bold ? "700" : "500"} ${layer.fontSize}px ${layer.fontFamily || "system-ui, sans-serif"}`;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            const maxW = Math.max(16, layer.width);
            const lineHeight = layer.fontSize * 1.25;
            const lines: string[] = [];
            for (const paragraph of layer.text.split("\n")) {
              const words = paragraph.split(" ");
              let current = "";
              for (const word of words) {
                const candidate = current ? `${current} ${word}` : word;
                if (ctx.measureText(candidate).width <= maxW || !current) {
                  current = candidate;
                } else {
                  lines.push(current);
                  current = word;
                }
              }
              lines.push(current);
            }
            lines.forEach((line, lineIdx) => {
              ctx.fillText(line, -layer.width / 2, -layer.height / 2 + lineIdx * lineHeight);
            });
          }
          ctx.restore();
        }
        setError("");
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not render the canvas.");
      }
    })();
    return () => { cancelled = true; };
  }, [outWidth, outHeight, canvasValid, background, baseImage, baseBrightness, baseContrast, baseSaturation, baseRotation, baseFlipHorizontal, layers]);

  async function insertBaseImage(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) {
      if (file) setError("Choose an image file.");
      return;
    }
    const bitmap = await createImageBitmap(file);
    const id = crypto.randomUUID();
    bitmapCache.current.set(id, { file, bitmap });
    setBaseImage({ id, file, width: bitmap.width, height: bitmap.height });
    setWidth(String(bitmap.width));
    setHeight(String(bitmap.height));
    setBaseBrightness("100");
    setBaseContrast("100");
    setBaseSaturation("100");
    setBaseRotation("0");
    setBaseFlipHorizontal(false);
    setError("");
  }

  async function addImageLayers(files: FileList | File[] | null) {
    if (!files?.length) return;
    const valid = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!valid.length) {
      setError("Choose one or more image files.");
      return;
    }
    const cw = canvasValid ? outWidth : 1200;
    const ch = canvasValid ? outHeight : 900;
    const created: EditorLayer[] = [];
    for (const file of valid) {
      const bitmap = await createImageBitmap(file);
      const id = crypto.randomUUID();
      bitmapCache.current.set(id, { file, bitmap });
      const scale = Math.min((cw * 0.45) / Math.max(1, bitmap.width), (ch * 0.45) / Math.max(1, bitmap.height));
      const w = Math.max(24, Math.round(bitmap.width * scale));
      const h = Math.max(24, Math.round(bitmap.height * scale));
      created.push({
        id,
        kind: "image",
        name: file.name,
        file,
        x: Math.round((cw - w) / 2),
        y: Math.round((ch - h) / 2),
        width: w,
        height: h,
        rotation: "0",
        opacity: "100",
        flipHorizontal: false,
        brightness: "100",
        contrast: "100",
        saturation: "100",
        visible: true,
      });
    }
    setLayers((prev) => [...prev, ...created]);
    if (created.length) {
      setSelectedLayerId(created[created.length - 1].id);
      setPanel("layers");
    }
    setError(valid.length < files.length ? "Some non-image files were skipped." : "");
  }

  function addShapeOrTextLayer(kind: "text" | "rectangle" | "ellipse") {
    const cw = canvasValid ? outWidth : 1200;
    const ch = canvasValid ? outHeight : 900;
    const id = crypto.randomUUID();
    const fontSize = Math.max(24, Math.round(ch * 0.06));
    const textDefaults = {
      text: "Your text",
      fontFamily: "system-ui, sans-serif",
      fontSize,
      bold: true,
      italic: false,
    };
    const measuredText = kind === "text" ? measureTextLayerSize(textDefaults) : null;
    const w = measuredText ? measuredText.width : Math.max(60, Math.round(cw * 0.24));
    const h = measuredText ? measuredText.height : Math.max(40, Math.round(ch * 0.24));
    const x = Math.round((cw - w) / 2);
    const y = Math.round((ch - h) / 2);
    const layer: EditorLayer =
      kind === "text"
        ? {
            id,
            kind: "text",
            name: "Text",
            ...textDefaults,
            fill: background === "#000000" || background === "#111827" ? "#ffffff" : "#111827",
            x,
            y,
            width: w,
            height: h,
            rotation: "0",
            opacity: "100",
            visible: true,
          }
        : {
            id,
            kind,
            name: kind === "rectangle" ? "Rectangle" : "Ellipse",
            fill: "#4f7cff",
            strokeColor: "#1d3573",
            strokeWidth: 0,
            x,
            y,
            width: w,
            height: h,
            rotation: "0",
            opacity: "100",
            visible: true,
          };
    setLayers((prev) => [...prev, layer]);
    setSelectedLayerId(id);
    setPanel("layers");
  }

  function updateLayer(id: string, patch: Partial<EditorLayer>) {
    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id !== id) return layer;
        const merged = { ...layer, ...patch } as EditorLayer;
        if (merged.kind === "text") {
          const textPatch = patch as Partial<Extract<EditorLayer, { kind: "text" }>>;
          const contentChanged =
            textPatch.text !== undefined ||
            textPatch.fontFamily !== undefined ||
            textPatch.fontSize !== undefined ||
            textPatch.bold !== undefined ||
            textPatch.italic !== undefined;
          if (contentChanged && textPatch.width === undefined && textPatch.height === undefined) {
            const fitted = measureTextLayerSize(merged);
            return { ...merged, width: fitted.width, height: fitted.height };
          }
          if ((textPatch.width !== undefined || textPatch.fontSize !== undefined) && textPatch.height === undefined) {
            const fitted = measureTextLayerSize(merged, merged.width);
            return { ...merged, height: fitted.height };
          }
        }
        return merged;
      }),
    );
  }

  function reorderLayer(id: string, delta: -1 | 1) {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function removeLayer(id: string) {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId("");
  }

  function beginLayerDrag(layer: EditorLayer, mode: "move" | "nw" | "ne" | "sw" | "se" | "e" | "w" | "rotate", event: React.PointerEvent<HTMLElement>) {
    event.stopPropagation();
    event.preventDefault();
    setSelectedLayerId(layer.id);
    setPanel("layers");
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
      startFontSize: layer.kind === "text" ? layer.fontSize : undefined,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveLayerDrag(event: React.PointerEvent<HTMLElement>) {
    const g = layerGesture.current;
    if (!g || g.pointerId !== event.pointerId || !stageRef.current || !canvasValid) return;
    const bounds = stageRef.current.getBoundingClientRect();
    const scaleX = outWidth / Math.max(1, bounds.width);
    const scaleY = outHeight / Math.max(1, bounds.height);
    const dx = (event.clientX - g.startClientX) * scaleX;
    const dy = (event.clientY - g.startClientY) * scaleY;
    const others = layers
      .filter((l) => l.id !== g.id && l.visible)
      .map((l) => ({ x: l.x, y: l.y, width: l.width, height: l.height }));
    if (g.mode === "move") {
      const snapped = snapLayerMove(
        { x: Math.round(g.startX + dx), y: Math.round(g.startY + dy), width: g.startW, height: g.startH },
        outWidth,
        outHeight,
        others,
      );
      setSnapGuides({ x: snapped.guideX, y: snapped.guideY });
      updateLayer(g.id, { x: snapped.x, y: snapped.y });
      return;
    }
    if (g.mode === "rotate") {
      setSnapGuides({ x: null, y: null });
      const cx = bounds.left + ((g.startX + g.startW / 2) / outWidth) * bounds.width;
      const cy = bounds.top + ((g.startY + g.startH / 2) / outHeight) * bounds.height;
      const angle = Math.round((Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI + 90);
      const norm = (((angle + 180) % 360) + 360) % 360 - 180;
      updateLayer(g.id, { rotation: String(norm) });
      return;
    }
    const target = layers.find((l) => l.id === g.id);
    const lockAspect = (target?.kind === "image" || target?.kind === "text") && !event.shiftKey;
    const aspect = g.startW / Math.max(1, g.startH);
    const minSize = 16;
    const otherXEdges = others.flatMap((o) => [o.x, o.x + o.width]);
    const otherYEdges = others.flatMap((o) => [o.y, o.y + o.height]);
    let nextX = g.startX, nextY = g.startY, nextW = g.startW, nextH = g.startH;
    let guideX: number | null = null;
    let guideY: number | null = null;
    if (g.mode === "e") {
      const snapRight = snapAxisCoordinate(g.startX + Math.max(minSize, g.startW + dx), outWidth, otherXEdges);
      nextW = Math.max(minSize, snapRight.value - g.startX);
      guideX = snapRight.guide;
      setSnapGuides({ x: guideX, y: null });
      updateLayer(g.id, { width: Math.round(nextW) });
      return;
    }
    if (g.mode === "w") {
      const snapLeft = snapAxisCoordinate(Math.min(g.startX + g.startW - minSize, g.startX + dx), outWidth, otherXEdges);
      nextX = snapLeft.value;
      nextW = Math.max(minSize, g.startX + g.startW - nextX);
      guideX = snapLeft.guide;
      setSnapGuides({ x: guideX, y: null });
      updateLayer(g.id, { x: Math.round(nextX), width: Math.round(nextW) });
      return;
    }
    if (g.mode === "se") {
      const snapRight = snapAxisCoordinate(g.startX + Math.max(minSize, g.startW + dx), outWidth, otherXEdges);
      nextW = Math.max(minSize, snapRight.value - g.startX);
      guideX = snapRight.guide;
      if (lockAspect) {
        nextH = Math.max(minSize, nextW / aspect);
      } else {
        const snapBottom = snapAxisCoordinate(g.startY + Math.max(minSize, g.startH + dy), outHeight, otherYEdges);
        nextH = Math.max(minSize, snapBottom.value - g.startY);
        guideY = snapBottom.guide;
      }
    } else if (g.mode === "sw") {
      const snapLeft = snapAxisCoordinate(Math.min(g.startX + g.startW - minSize, g.startX + dx), outWidth, otherXEdges);
      nextX = snapLeft.value;
      nextW = Math.max(minSize, g.startX + g.startW - nextX);
      guideX = snapLeft.guide;
      if (lockAspect) {
        nextH = Math.max(minSize, nextW / aspect);
      } else {
        const snapBottom = snapAxisCoordinate(g.startY + Math.max(minSize, g.startH + dy), outHeight, otherYEdges);
        nextH = Math.max(minSize, snapBottom.value - g.startY);
        guideY = snapBottom.guide;
      }
    } else if (g.mode === "ne") {
      const snapRight = snapAxisCoordinate(g.startX + Math.max(minSize, g.startW + dx), outWidth, otherXEdges);
      nextW = Math.max(minSize, snapRight.value - g.startX);
      guideX = snapRight.guide;
      if (lockAspect) {
        nextH = Math.max(minSize, nextW / aspect);
        nextY = g.startY + (g.startH - nextH);
      } else {
        const snapTop = snapAxisCoordinate(Math.min(g.startY + g.startH - minSize, g.startY + dy), outHeight, otherYEdges);
        nextY = snapTop.value;
        nextH = Math.max(minSize, g.startY + g.startH - nextY);
        guideY = snapTop.guide;
      }
    } else if (g.mode === "nw") {
      const snapLeft = snapAxisCoordinate(Math.min(g.startX + g.startW - minSize, g.startX + dx), outWidth, otherXEdges);
      nextX = snapLeft.value;
      nextW = Math.max(minSize, g.startX + g.startW - nextX);
      guideX = snapLeft.guide;
      if (lockAspect) {
        nextH = Math.max(minSize, nextW / aspect);
        nextY = g.startY + (g.startH - nextH);
      } else {
        const snapTop = snapAxisCoordinate(Math.min(g.startY + g.startH - minSize, g.startY + dy), outHeight, otherYEdges);
        nextY = snapTop.value;
        nextH = Math.max(minSize, g.startY + g.startH - nextY);
        guideY = snapTop.guide;
      }
    }
    setSnapGuides({ x: guideX, y: guideY });
    const nextPatch: Partial<EditorLayer> = { x: Math.round(nextX), y: Math.round(nextY), width: Math.round(nextW), height: Math.round(nextH) };
    if (target?.kind === "text" && g.startFontSize) {
      (nextPatch as Partial<Extract<EditorLayer, { kind: "text" }>>).fontSize = Math.max(
        8,
        Math.round(g.startFontSize * (nextW / Math.max(1, g.startW))),
      );
    }
    updateLayer(g.id, nextPatch);
  }

  function endLayerDrag(event: React.PointerEvent<HTMLElement>) {
    if (layerGesture.current?.pointerId !== event.pointerId) return;
    layerGesture.current = null;
    setSnapGuides({ x: null, y: null });
    setDragCommitTick((t) => t + 1);
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas || !canvasValid) return;
    const quality = Number(jpegQuality);
    if (exportFormat === "jpeg" && (!Number.isFinite(quality) || quality < 0 || quality > 1)) {
      setError("JPEG quality must be a number from 0 through 1.");
      return;
    }
    let outputCanvas = canvas;
    if (exportFormat === "jpeg") {
      outputCanvas = document.createElement("canvas");
      outputCanvas.width = canvas.width;
      outputCanvas.height = canvas.height;
      const ctx = outputCanvas.getContext("2d");
      if (!ctx) { setError("This browser could not prepare the JPEG export."); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
      ctx.drawImage(canvas, 0, 0);
    }
    const mime = exportFormat === "jpeg" ? "image/jpeg" : "image/png";
    outputCanvas.toBlob((blob) => {
      if (!blob) { setError(`The ${exportFormat.toUpperCase()} image could not be exported.`); return; }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${baseImage ? baseImage.file.name.replace(/\.[^.]+$/, "") : "local-studio-canvas"}-${outWidth}x${outHeight}.${exportFormat === "jpeg" ? "jpg" : "png"}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, mime, exportFormat === "jpeg" ? quality : undefined);
  }

  return (
    <main className="resize-page image-collage-page has-media">
      <ToolPageHeader />
      <section className="resize-intro"><p className="eyebrow">IMAGE · LOCAL PROCESSING</p><h1>Image editor</h1><p>Start from a blank, colored, or transparent canvas or insert an image, then add image, text, and shape layers.</p></section>
      <section className="resize-workspace image-tool-workspace" aria-label="Image editor workspace">
        <aside className="resize-controls collage-studio-sidebar" aria-label="Image editor tools">
          <nav className="collage-studio-rail" aria-label="Editor panels">
            <button type="button" className={panel === "canvas" ? "active" : ""} aria-pressed={panel === "canvas"} onClick={() => setPanel("canvas")}><span aria-hidden="true">⬜</span><small>Canvas</small></button>
            <button type="button" className={panel === "layers" ? "active" : ""} aria-pressed={panel === "layers"} onClick={() => setPanel("layers")}><span aria-hidden="true">⧉</span><small>Layers</small></button>
            <button type="button" className={selectedLayer?.kind === "text" ? "active" : ""} onClick={() => {
              const existingText = selectedLayer?.kind === "text" ? selectedLayer : layers.find((l) => l.kind === "text");
              if (existingText) { setSelectedLayerId(existingText.id); setPanel("layers"); }
              else addShapeOrTextLayer("text");
            }}><span aria-hidden="true">T</span><small>Text</small></button>
            <button type="button" className={panel === "export" ? "active" : ""} aria-pressed={panel === "export"} onClick={() => setPanel("export")}><span aria-hidden="true">⚙</span><small>Adjust</small></button>
          </nav>
          <div className="collage-studio-panel">
            <header>
              <strong>{panel === "canvas" ? "Blank & Base Canvas" : panel === "layers" ? "Layers & Overlays" : "Adjust & Export"}</strong>
              <span>{canvasValid ? `${outWidth} × ${outHeight} px` : "Invalid size"} · {layers.length} layer(s)</span>
            </header>

            {panel === "canvas" && <section className="collage-sidebar-section">
              <div className="dimension-fields">
                <label>Width <span>px</span><input type="number" min="1" max="32768" step="1" value={width} onChange={(event) => setWidth(event.currentTarget.value)} /></label>
                <label>Height <span>px</span><input type="number" min="1" max="32768" step="1" value={height} onChange={(event) => setHeight(event.currentTarget.value)} /></label>
              </div>
              <div className="speed-presets" aria-label="Blank canvas presets">
                {CANVAS_PRESETS.map((preset) => (
                  <button type="button" key={preset.label} onClick={() => { setWidth(preset.w); setHeight(preset.h); }}>{preset.label}</button>
                ))}
              </div>
              <div className="collage-background-picker">
                <strong>Background</strong>
                <div className="collage-background-swatches" aria-label="Background presets">
                  {BACKGROUND_SWATCHES.map((swatch) => (
                    <button
                      type="button"
                      key={swatch.color}
                      data-transparent={swatch.color === "transparent" ? "true" : undefined}
                      className={background.toLowerCase() === swatch.color ? "active" : ""}
                      style={swatch.color === "transparent" ? undefined : ({ "--swatch-color": swatch.color } as React.CSSProperties)}
                      aria-label={`${swatch.name} background`}
                      aria-pressed={background.toLowerCase() === swatch.color}
                      title={swatch.name}
                      onClick={() => setBackground(swatch.color)}
                    />
                  ))}
                </div>
                <label className="collage-custom-color">Custom color<input type="color" aria-label="Custom background color" value={background === "transparent" ? "#ffffff" : background} onChange={(event) => setBackground(event.currentTarget.value)} /></label>
              </div>
              <label className="file-picker collage-add-images">
                <span>{baseImage ? "Replace base image" : "Insert image to edit"}</span>
                <input type="file" accept="image/*" onChange={(event) => { void insertBaseImage(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
              </label>
              {baseImage && <button type="button" className="secondary-button" onClick={() => setBaseImage(null)}>Clear base image (blank canvas)</button>}
              <label className="file-picker collage-add-layer">
                <span>Drop / add image as layer</span>
                <input type="file" accept="image/*" multiple onChange={(event) => { void addImageLayers(event.currentTarget.files); event.currentTarget.value = ""; }} />
              </label>
            </section>}

            {panel === "layers" && <section className="collage-sidebar-section">
              <div className="image-layer-actions">
                <label className="file-picker collage-add-layer" style={{ gridColumn: "1 / -1" }}>
                  <span>+ Image layer</span>
                  <input type="file" accept="image/*" multiple onChange={(event) => { void addImageLayers(event.currentTarget.files); event.currentTarget.value = ""; }} />
                </label>
                <button type="button" className="secondary-button" onClick={() => addShapeOrTextLayer("text")}>+ Text</button>
                <button type="button" className="secondary-button" onClick={() => addShapeOrTextLayer("rectangle")}>+ Rect</button>
                <button type="button" className="secondary-button" onClick={() => addShapeOrTextLayer("ellipse")}>+ Ellipse</button>
              </div>
              <ol className="collage-image-list">
                {layers.map((layer, index) => (
                  <li key={layer.id}>
                    <button type="button" className={selectedLayerId === layer.id ? "selected" : ""} onClick={() => setSelectedLayerId(layer.id)}>
                      <span className="collage-image-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="collage-image-name"><strong>{layer.kind === "text" ? layer.text || "Text" : layer.name}</strong><small>{layer.kind} · {layer.width}×{layer.height}</small></span>
                    </button>
                    <button type="button" aria-label={`Move layer ${index + 1} down`} disabled={index === 0} onClick={() => reorderLayer(layer.id, -1)}>↓</button>
                    <button type="button" aria-label={`Move layer ${index + 1} up`} disabled={index === layers.length - 1} onClick={() => reorderLayer(layer.id, 1)}>↑</button>
                    <button type="button" aria-label={`Remove layer ${index + 1}`} onClick={() => removeLayer(layer.id)}>×</button>
                  </li>
                ))}
              </ol>
              {selectedLayer ? <div className="collage-selected-controls">
                <strong>Edit {selectedLayer.kind} layer</strong>
                <div className="dimension-fields">
                  <label>X <span>px</span><input type="number" step="1" value={selectedLayer.x} onChange={(event) => updateLayer(selectedLayer.id, { x: Number(event.currentTarget.value) || 0 })} /></label>
                  <label>Y <span>px</span><input type="number" step="1" value={selectedLayer.y} onChange={(event) => updateLayer(selectedLayer.id, { y: Number(event.currentTarget.value) || 0 })} /></label>
                </div>
                <div className="dimension-fields">
                  <label>Width <span>px</span><input type="number" min="1" step="1" value={selectedLayer.width} onChange={(event) => updateLayer(selectedLayer.id, { width: Math.max(1, Number(event.currentTarget.value) || 1) })} /></label>
                  <label>Height <span>px</span><input type="number" min="1" step="1" value={selectedLayer.height} onChange={(event) => updateLayer(selectedLayer.id, { height: Math.max(1, Number(event.currentTarget.value) || 1) })} /></label>
                </div>
                <div className="dimension-fields">
                  <label>Rotate <span>−180–180°</span><input type="number" min="-180" max="180" step="any" value={selectedLayer.rotation} onChange={(event) => updateLayer(selectedLayer.id, { rotation: event.currentTarget.value })} /></label>
                  <label>Opacity <span>0–100%</span><input type="number" min="0" max="100" step="1" value={selectedLayer.opacity} onChange={(event) => updateLayer(selectedLayer.id, { opacity: event.currentTarget.value })} /></label>
                </div>
                {selectedLayer.kind === "image" && <>
                  <label className="collage-check-control"><input type="checkbox" checked={selectedLayer.flipHorizontal} onChange={(event) => updateLayer(selectedLayer.id, { flipHorizontal: event.currentTarget.checked })} />Flip horizontally</label>
                  <div className="dimension-fields">
                    <label>Brightness <span>%</span><input type="number" min="0" max="300" step="any" value={selectedLayer.brightness} onChange={(event) => updateLayer(selectedLayer.id, { brightness: event.currentTarget.value })} /></label>
                    <label>Contrast <span>%</span><input type="number" min="0" max="300" step="any" value={selectedLayer.contrast} onChange={(event) => updateLayer(selectedLayer.id, { contrast: event.currentTarget.value })} /></label>
                  </div>
                  <label>Saturation <span>0–300%</span><input type="number" min="0" max="300" step="any" value={selectedLayer.saturation} onChange={(event) => updateLayer(selectedLayer.id, { saturation: event.currentTarget.value })} /></label>
                </>}
                {selectedLayer.kind === "text" && <>
                  <label>Text<textarea rows={2} maxLength={500} value={selectedLayer.text} onChange={(event) => updateLayer(selectedLayer.id, { text: event.currentTarget.value })} /></label>
                  <label className="ratio-field">Font<select value={selectedLayer.fontFamily} onChange={(event) => updateLayer(selectedLayer.id, { fontFamily: event.currentTarget.value })}>{FONT_FAMILIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>
                  <div className="dimension-fields">
                    <label>Font size <span>px</span><input type="number" min="8" max="512" step="1" value={selectedLayer.fontSize} onChange={(event) => updateLayer(selectedLayer.id, { fontSize: Math.max(8, Number(event.currentTarget.value) || 16) })} /></label>
                    <label>Color<input type="color" value={selectedLayer.fill} onChange={(event) => updateLayer(selectedLayer.id, { fill: event.currentTarget.value })} /></label>
                  </div>
                  <div className="dimension-fields">
                    <label className="collage-check-control"><input type="checkbox" checked={selectedLayer.bold} onChange={(event) => updateLayer(selectedLayer.id, { bold: event.currentTarget.checked })} />Bold</label>
                    <label className="collage-check-control"><input type="checkbox" checked={selectedLayer.italic} onChange={(event) => updateLayer(selectedLayer.id, { italic: event.currentTarget.checked })} />Italic</label>
                  </div>
                </>}
                {(selectedLayer.kind === "rectangle" || selectedLayer.kind === "ellipse") && (
                  <label>Fill color<input type="color" value={selectedLayer.fill} onChange={(event) => updateLayer(selectedLayer.id, { fill: event.currentTarget.value })} /></label>
                )}
                <label className="collage-check-control"><input type="checkbox" checked={selectedLayer.visible} onChange={(event) => updateLayer(selectedLayer.id, { visible: event.currentTarget.checked })} />Visible</label>
              </div> : <p className="resize-note">Add an image, text, or shape layer, or drop an image straight onto the canvas.</p>}
            </section>}

            {panel === "export" && <section className="collage-sidebar-section">
              {baseImage ? <div className="collage-selected-controls">
                <strong>Base image adjustments</strong>
                <label>Brightness <span>0–300%</span><input type="number" min="0" max="300" step="any" value={baseBrightness} onChange={(event) => setBaseBrightness(event.currentTarget.value)} /></label>
                <label>Contrast <span>0–300%</span><input type="number" min="0" max="300" step="any" value={baseContrast} onChange={(event) => setBaseContrast(event.currentTarget.value)} /></label>
                <label>Saturation <span>0–300%</span><input type="number" min="0" max="300" step="any" value={baseSaturation} onChange={(event) => setBaseSaturation(event.currentTarget.value)} /></label>
                <label>Rotation <span>−180–180°</span><input type="number" min="-180" max="180" step="any" value={baseRotation} onChange={(event) => setBaseRotation(event.currentTarget.value)} /></label>
                <label className="collage-check-control"><input type="checkbox" checked={baseFlipHorizontal} onChange={(event) => setBaseFlipHorizontal(event.currentTarget.checked)} />Flip horizontally</label>
              </div> : <p className="resize-note">Insert a base image in Canvas if you want to adjust its brightness, contrast, or rotation.</p>}
              <label className="ratio-field">Export format<select value={exportFormat} onChange={(event) => setExportFormat(event.currentTarget.value as "png" | "jpeg")}><option value="png">PNG (lossless, transparency)</option><option value="jpeg">JPEG (white background)</option></select></label>
              {exportFormat === "jpeg" && <label>JPEG quality <span>0–1</span><input type="number" min="0" max="1" step="any" value={jpegQuality} onChange={(event) => setJpegQuality(event.currentTarget.value)} /></label>}
            </section>}

            <footer className="collage-sidebar-footer">
              <p className="resize-note">{canvasValid ? `${outWidth} × ${outHeight} px (${(outWidth * outHeight / 1_000_000).toFixed(1)} MP)` : "Enter valid dimensions (max 32,768 px / 100 MP)."}</p>
              {error && <p className="resize-error" role="alert">{error}</p>}
              <button type="button" className="export-button" disabled={!canvasValid} onClick={download}>Download {exportFormat.toUpperCase()}</button>
            </footer>
          </div>
        </aside>

        <div className="resize-preview collage-main-preview">
          <div className="preview-heading">
            <strong>Image Editor</strong>
            <div className="collage-history-actions">
              <button type="button" className="collage-history-btn" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)" aria-label="Undo">↶ Undo</button>
              <button type="button" className="collage-history-btn" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Y)" aria-label="Redo">↷ Redo</button>
              <button type="button" className="collage-history-btn" onClick={() => setViewTransform((t) => ({ ...t, zoom: Math.max(0.2, Math.round((t.zoom / 1.2) * 100) / 100) }))} title="Zoom out" aria-label="Zoom out">−</button>
              <button type="button" className="collage-history-btn" onClick={() => setViewTransform({ zoom: 1, panX: 0, panY: 0 })} title="Reset zoom (Ctrl + scroll to zoom)" aria-label="Reset zoom">{Math.round(viewTransform.zoom * 100)}%</button>
              <button type="button" className="collage-history-btn" onClick={() => setViewTransform((t) => ({ ...t, zoom: Math.min(5, Math.round((t.zoom * 1.2) * 100) / 100) }))} title="Zoom in" aria-label="Zoom in">+</button>
              <span>{canvasValid ? `${outWidth} × ${outHeight} px · ${layers.length} layer(s)` : "Check dimensions"}</span>
            </div>
          </div>
          <div
            ref={viewportRef}
            className="image-editor-viewport"
            onPointerDown={(event) => {
              if (event.button === 1 || event.target === event.currentTarget) {
                panGesture.current = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startPanX: viewTransform.panX, startPanY: viewTransform.panY };
                event.currentTarget.setPointerCapture(event.pointerId);
              }
            }}
            onPointerMove={(event) => {
              const p = panGesture.current;
              if (!p || p.pointerId !== event.pointerId) return;
              setViewTransform((t) => ({ ...t, panX: p.startPanX + (event.clientX - p.startClientX), panY: p.startPanY + (event.clientY - p.startClientY) }));
            }}
            onPointerUp={(event) => {
              if (panGesture.current?.pointerId === event.pointerId) panGesture.current = null;
            }}
            onPointerCancel={(event) => {
              if (panGesture.current?.pointerId === event.pointerId) panGesture.current = null;
            }}
          >
          <div className="collage-stage-frame" style={{ transform: `translate(${viewTransform.panX}px, ${viewTransform.panY}px) scale(${viewTransform.zoom})` }}>
            <div
              ref={stageRef}
              className={`collage-canvas-stage${background === "transparent" ? " is-transparent" : ""}${resizingCanvas ? " is-dragging-divider" : ""}`}
              style={{
                width: canvasValid ? `min(100%, ${(outWidth / outHeight) * 56}dvh, ${(outWidth / outHeight) * 720}px)` : "min(100%, 640px)",
                aspectRatio: canvasValid ? `${outWidth} / ${outHeight}` : "4 / 3",
                ...(background === "transparent" ? {} : { backgroundColor: background }),
              }}
              onClick={() => setSelectedLayerId("")}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void addImageLayers(event.dataTransfer.files);
              }}
            >
              <canvas ref={canvasRef} className="preview-canvas" aria-label="Image editor canvas. Drop images here to add layers." />
              {canvasValid && snapGuides.x !== null && <div className="collage-snap-v" style={{ left: `${(snapGuides.x / outWidth) * 100}%` }} aria-hidden="true" />}
              {canvasValid && snapGuides.y !== null && <div className="collage-snap-h" style={{ top: `${(snapGuides.y / outHeight) * 100}%` }} aria-hidden="true" />}
              {canvasValid && layers.map((layer, idx) => {
                if (!layer.visible) return null;
                const isSelected = selectedLayerId === layer.id;
                return (
                  <div
                    key={layer.id}
                    className={`collage-layer-box${isSelected ? " is-selected" : ""}`}
                    style={{
                      zIndex: 10 + idx,
                      left: `${(layer.x / outWidth) * 100}%`,
                      top: `${(layer.y / outHeight) * 100}%`,
                      width: `${(layer.width / outWidth) * 100}%`,
                      height: `${(layer.height / outHeight) * 100}%`,
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
                      {layer.kind === "text" && <>
                        <button type="button" className="collage-layer-handle w" aria-label="Resize text width left" onPointerDown={(event) => beginLayerDrag(layer, "w", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                        <button type="button" className="collage-layer-handle e" aria-label="Resize text width right" onPointerDown={(event) => beginLayerDrag(layer, "e", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                      </>}
                      <button type="button" className="collage-layer-handle rotate" aria-label="Rotate layer" onPointerDown={(event) => beginLayerDrag(layer, "rotate", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                    </>}
                  </div>
                );
              })}
            </div>
            {canvasValid && (
              <CanvasResizeHandles
                width={outWidth}
                height={outHeight}
                stageRef={stageRef}
                onResize={(nextW, nextH, shiftX, shiftY) => {
                  setWidth(String(nextW));
                  setHeight(String(nextH));
                  if (shiftX !== 0 || shiftY !== 0) {
                    setLayers((prev) => prev.map((l) => ({ ...l, x: l.x + shiftX, y: l.y + shiftY })));
                  }
                }}
                onDragStateChange={setResizingCanvas}
              />
            )}
          </div>
          </div>
        </div>
      </section>
    </main>
  );
}
