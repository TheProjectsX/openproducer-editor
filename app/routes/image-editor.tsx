import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { CanvasResizeHandles } from "../components/canvas-resize-handles";
import { CanvasEffectsPanel } from "../components/image-editor/canvas-effects-panel";
import { LayerInspector } from "../components/image-editor/layer-inspector";
import { ToolPageHeader } from "../components/tool-page-header";
import { snapAxisCoordinate, snapLayerMove } from "../lib/canvas-snap";
import {
  exportCompositionToBlob,
  rasterizeLayersToPngFile,
  renderImageComposition,
} from "../lib/image-editor/renderer";
import { measureTextLayerSize } from "../lib/image-editor/text-layout";
import {
  BACKGROUND_SWATCHES,
  CANVAS_PRESETS,
  DEFAULT_CANVAS_OVERLAYS,
  serializeEditorDocument,
  snapshotKey,
  STICKER_PRESETS,
  validateCanvasDimensions,
  type BaseImage,
  type BezierAnchor,
  type CanvasOverlayEffects,
  type CustomFontEntry,
  type EditorLayer,
  type EditorSnapshot,
  type FillStyle,
  type ShapeKind,
} from "../lib/image-editor/types";
import { createProject, getProject, readVideoAsset, saveImageEditorProject } from "../lib/project-store";
import type { ImageEffectJobResponse } from "../workers/image-effects.worker";
import type { Route } from "./+types/image-editor";

type StageToolMode = "select" | "draw" | "bezier" | "erase" | "perspective";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Image Editor | OpenProducer Editor" },
    {
      name: "description",
      content:
        "Design layered graphics locally with 3D/curved text, custom fonts, gradients, shapes, stickers, freehand draw, Bezier paths, cutouts, and perspective warp.",
    },
    { name: "robots", content: "index,follow" },
  ];
}

export default function ImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const bitmapCache = useRef(new Map<string, { file: File; bitmap: ImageBitmap }>());
  const erasedCache = useRef(new Map<string, { sig: string; bitmap: ImageBitmap }>());
  const eraserMaskCache = useRef(new Map<string, { file: File; bitmap: ImageBitmap }>());
  const effectsWorkerRef = useRef<Worker | null>(null);
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

  const perspectiveGesture = useRef<{
    id: string;
    corner: "tl" | "tr" | "br" | "bl";
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const drawSession = useRef<{ pointerId: number; points: { x: number; y: number }[] } | null>(null);
  const [liveDrawPoints, setLiveDrawPoints] = useState<{ x: number; y: number }[]>([]);
  const [bezierDraft, setBezierDraft] = useState<{ x: number; y: number }[]>([]);
  const eraseSession = useRef<{ pointerId: number; layerId: string; canvas: HTMLCanvasElement; lastX: number; lastY: number } | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const [projectStatus, setProjectStatus] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  const [panel, setPanel] = useState<"canvas" | "layers" | "export">("canvas");
  const [stageMode, setStageMode] = useState<StageToolMode>("select");
  const [drawBrushColor, setDrawBrushColor] = useState("#4f7cff");
  const [drawBrushWidth, setDrawBrushWidth] = useState(8);
  const [eraserBrushSize, setEraserBrushSize] = useState(28);
  const [showGrid, setShowGrid] = useState(false);

  const [width, setWidth] = useState("1200");
  const [height, setHeight] = useState("900");
  const [background, setBackground] = useState("#ffffff");
  const [backgroundFill, setBackgroundFill] = useState<FillStyle | null>(null);
  const [baseImage, setBaseImage] = useState<BaseImage | null>(null);
  const [baseBrightness, setBaseBrightness] = useState("100");
  const [baseContrast, setBaseContrast] = useState("100");
  const [baseSaturation, setBaseSaturation] = useState("100");
  const [baseRotation, setBaseRotation] = useState("0");
  const [baseFlipHorizontal, setBaseFlipHorizontal] = useState(false);
  const [overlays, setOverlays] = useState<CanvasOverlayEffects>(DEFAULT_CANVAS_OVERLAYS);
  const [customFonts, setCustomFonts] = useState<CustomFontEntry[]>([]);
  const [layers, setLayers] = useState<EditorLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const [editingTextId, setEditingTextId] = useState("");
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [jpegQuality, setJpegQuality] = useState("0.92");
  const [error, setError] = useState("");
  const [dragCommitTick, setDragCommitTick] = useState(0);
  const [renderTick, setRenderTick] = useState(0);
  const [snapGuides, setSnapGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [resizingCanvas, setResizingCanvas] = useState(false);
  const restoringHistoryRef = useRef(false);
  const loadedProjectIdRef = useRef<string | null>(null);

  const { valid: canvasValid, width: outWidth, height: outHeight } = validateCanvasDimensions(width, height);
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) ?? null;

  const currentSnapshot = useMemo<EditorSnapshot>(
    () => ({
      width,
      height,
      background,
      backgroundFill,
      baseImage,
      baseBrightness,
      baseContrast,
      baseSaturation,
      baseRotation,
      baseFlipHorizontal,
      overlays,
      layers,
    }),
    [width, height, background, backgroundFill, baseImage, baseBrightness, baseContrast, baseSaturation, baseRotation, baseFlipHorizontal, overlays, layers],
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
    if (layerGesture.current || perspectiveGesture.current || resizingCanvas) return;
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
    setBackgroundFill(snap.backgroundFill ?? null);
    setBaseImage(snap.baseImage);
    setBaseBrightness(snap.baseBrightness);
    setBaseContrast(snap.baseContrast);
    setBaseSaturation(snap.baseSaturation);
    setBaseRotation(snap.baseRotation);
    setBaseFlipHorizontal(snap.baseFlipHorizontal);
    setOverlays(snap.overlays ?? DEFAULT_CANVAS_OVERLAYS);
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
    erasedCache.current.forEach(({ bitmap }) => bitmap.close());
    erasedCache.current.clear();
    eraserMaskCache.current.forEach(({ bitmap }) => bitmap.close());
    eraserMaskCache.current.clear();
    effectsWorkerRef.current?.terminate();
    effectsWorkerRef.current = null;
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
    for (const [id, entry] of erasedCache.current) {
      if (!liveIds.has(id)) {
        entry.bitmap.close();
        erasedCache.current.delete(id);
      }
    }
    for (const [id, entry] of eraserMaskCache.current) {
      if (!liveIds.has(id)) {
        entry.bitmap.close();
        eraserMaskCache.current.delete(id);
      }
    }
  }, [baseImage, layers]);

  // Offload Erase Color pixel jobs to the Web Worker when enabled on an image layer
  useEffect(() => {
    let cancelled = false;
    const activeJobIds: string[] = [];

    for (const layer of layers) {
      if (layer.kind !== "image" || !layer.eraseColor?.enabled) continue;
      const sig = `${layer.file.name}:${layer.file.size}:${layer.eraseColor.targetColor}:${layer.eraseColor.tolerance}:${layer.eraseColor.feather}`;
      if (erasedCache.current.get(layer.id)?.sig === sig) continue;

      void (async () => {
        try {
          const cached = bitmapCache.current.get(layer.id);
          const bmp = cached?.file === layer.file ? cached.bitmap : await createImageBitmap(layer.file);
          if (cancelled) return;
          const off = document.createElement("canvas");
          off.width = bmp.width;
          off.height = bmp.height;
          const oCtx = off.getContext("2d");
          if (!oCtx) return;
          oCtx.drawImage(bmp, 0, 0);
          const imgData = oCtx.getImageData(0, 0, bmp.width, bmp.height);

          if (!effectsWorkerRef.current) {
            effectsWorkerRef.current = new Worker(new URL("../workers/image-effects.worker.ts", import.meta.url), {
              type: "module",
            });
          }
          const worker = effectsWorkerRef.current;
          const jobId = crypto.randomUUID();
          activeJobIds.push(jobId);

          const result = await new Promise<ImageData>((resolve, reject) => {
            const onMessage = (event: MessageEvent<ImageEffectJobResponse>) => {
              if (event.data.id !== jobId) return;
              worker.removeEventListener("message", onMessage);
              if (!event.data.ok) {
                reject(new Error(event.data.error));
                return;
              }
              resolve(new ImageData(new Uint8ClampedArray(event.data.pixels), event.data.width, event.data.height));
            };
            worker.addEventListener("message", onMessage);
            worker.postMessage(
              {
                id: jobId,
                kind: "erase-color",
                width: imgData.width,
                height: imgData.height,
                pixels: imgData.data.buffer,
                targetColor: layer.eraseColor!.targetColor,
                tolerance: layer.eraseColor!.tolerance,
                feather: layer.eraseColor!.feather,
              },
              [imgData.data.buffer],
            );
          });
          if (cancelled) return;
          const nextBitmap = await createImageBitmap(result);
          if (cancelled) {
            nextBitmap.close();
            return;
          }
          erasedCache.current.get(layer.id)?.bitmap.close();
          erasedCache.current.set(layer.id, { sig, bitmap: nextBitmap });
          setRenderTick((t) => t + 1);
        } catch (cause) {
          if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not process background removal.");
        }
      })();
    }

    return () => {
      cancelled = true;
      for (const jobId of activeJobIds) {
        effectsWorkerRef.current?.postMessage({ kind: "cancel", id: jobId });
      }
    };
  }, [layers]);

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
        const erasedBitmaps = new Map<string, ImageBitmap>();
        const eraserMasks = new Map<string, ImageBitmap>();

        for (const layer of layers) {
          if (layer.kind === "image" && layer.visible) {
            imageBitmaps.set(layer.id, await getBitmap(layer.id, layer.file));
            const erased = erasedCache.current.get(layer.id);
            if (erased && layer.eraseColor?.enabled) {
              erasedBitmaps.set(layer.id, erased.bitmap);
            }
            if (layer.eraserMaskFile) {
              const existingMask = eraserMaskCache.current.get(layer.id);
              if (existingMask?.file === layer.eraserMaskFile) {
                eraserMasks.set(layer.id, existingMask.bitmap);
              } else {
                existingMask?.bitmap.close();
                const maskBmp = await createImageBitmap(layer.eraserMaskFile);
                eraserMaskCache.current.set(layer.id, { file: layer.eraserMaskFile, bitmap: maskBmp });
                eraserMasks.set(layer.id, maskBmp);
              }
            }
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
        renderImageComposition(ctx, {
          width: outWidth,
          height: outHeight,
          background,
          backgroundFill,
          baseBitmap,
          baseBrightness,
          baseContrast,
          baseSaturation,
          baseRotation,
          baseFlipHorizontal,
          overlays,
          layers,
          hiddenLayerId: editingTextId || undefined,
          imageBitmaps,
          erasedBitmaps,
          eraserMasks,
        });
        setError("");
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not render the canvas.");
      }
    })();
    return () => { cancelled = true; };
  }, [outWidth, outHeight, canvasValid, background, backgroundFill, baseImage, baseBrightness, baseContrast, baseSaturation, baseRotation, baseFlipHorizontal, overlays, layers, editingTextId, customFonts, renderTick]);

  async function registerCustomFont(file: File | undefined, existingId?: string, existingFamily?: string) {
    if (!file) return;
    try {
      const family = existingFamily ?? (file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9 _-]/g, "") || `CustomFont-${Date.now()}`);
      const buffer = await file.arrayBuffer();
      const face = new FontFace(family, buffer);
      await face.load();
      document.fonts.add(face);
      const id = existingId ?? crypto.randomUUID();
      setCustomFonts((prev) => (prev.some((f) => f.id === id) ? prev : [...prev, { id, family, fileName: file.name, file }]));
      if (!existingId && selectedLayer?.kind === "text") {
        updateLayer(selectedLayer.id, { fontFamily: `"${family}"` });
      }
      setRenderTick((t) => t + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the font file.");
    }
  }

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

  function addShapeOrTextLayer(kind: "text" | "sticker" | ShapeKind) {
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
        : kind === "sticker"
          ? {
              id,
              kind: "sticker",
              name: "Sticker",
              emoji: STICKER_PRESETS[0],
              x: Math.round((cw - 140) / 2),
              y: Math.round((ch - 140) / 2),
              width: 140,
              height: 140,
              rotation: "0",
              opacity: "100",
              visible: true,
            }
          : {
              id,
              kind,
              name: kind.charAt(0).toUpperCase() + kind.slice(1),
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
    setStageMode("select");
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
            textPatch.italic !== undefined ||
            textPatch.letterSpacing !== undefined ||
            textPatch.lineHeight !== undefined ||
            textPatch.textCase !== undefined;
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

  function duplicateLayer(id: string) {
    const source = layers.find((l) => l.id === id);
    if (!source) return;
    const copy: EditorLayer = {
      ...structuredClone(source),
      id: crypto.randomUUID(),
      name: `${source.name} copy`,
      x: source.x + 24,
      y: source.y + 24,
      locked: false,
    };
    setLayers((prev) => [...prev, copy]);
    setSelectedLayerId(copy.id);
  }

  async function mergeVisibleLayers() {
    const visibleLayers = layers.filter((l) => l.visible);
    if (visibleLayers.length < 2 || !canvasValid) return;
    try {
      const imageBitmaps = new Map<string, ImageBitmap>();
      const erasedBitmaps = new Map<string, ImageBitmap>();
      const eraserMasks = new Map<string, ImageBitmap>();
      for (const l of visibleLayers) {
        if (l.kind === "image") {
          const bmp = bitmapCache.current.get(l.id)?.bitmap ?? (await createImageBitmap(l.file));
          imageBitmaps.set(l.id, bmp);
          const erased = erasedCache.current.get(l.id);
          if (erased && l.eraseColor?.enabled) erasedBitmaps.set(l.id, erased.bitmap);
          if (l.eraserMaskFile) {
            const mask = eraserMaskCache.current.get(l.id)?.bitmap ?? (await createImageBitmap(l.eraserMaskFile));
            eraserMasks.set(l.id, mask);
          }
        }
      }
      const mergedFile = await rasterizeLayersToPngFile(visibleLayers, outWidth, outHeight, imageBitmaps, erasedBitmaps, eraserMasks);
      const id = crypto.randomUUID();
      const bmp = await createImageBitmap(mergedFile);
      bitmapCache.current.set(id, { file: mergedFile, bitmap: bmp });
      const mergedLayer: EditorLayer = {
        id,
        kind: "image",
        name: "Merged Layer",
        file: mergedFile,
        x: 0,
        y: 0,
        width: outWidth,
        height: outHeight,
        rotation: "0",
        opacity: "100",
        flipHorizontal: false,
        brightness: "100",
        contrast: "100",
        saturation: "100",
        visible: true,
      };
      setLayers((prev) => [...prev.filter((l) => !l.visible), mergedLayer]);
      setSelectedLayerId(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not merge visible layers.");
    }
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

  function clientToCanvasPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!stageRef.current || !canvasValid) return null;
    const bounds = stageRef.current.getBoundingClientRect();
    return {
      x: ((clientX - bounds.left) / Math.max(1, bounds.width)) * outWidth,
      y: ((clientY - bounds.top) / Math.max(1, bounds.height)) * outHeight,
    };
  }

  function commitBezierDraft(closed: boolean) {
    if (bezierDraft.length < 2) {
      setBezierDraft([]);
      setStageMode("select");
      return;
    }
    const xs = bezierDraft.map((p) => p.x);
    const ys = bezierDraft.map((p) => p.y);
    const minX = Math.floor(Math.min(...xs));
    const minY = Math.floor(Math.min(...ys));
    const w = Math.max(24, Math.ceil(Math.max(...xs) - minX));
    const h = Math.max(24, Math.ceil(Math.max(...ys) - minY));
    const anchors: BezierAnchor[] = bezierDraft.map((p) => {
      const nx = (p.x - minX) / w;
      const ny = (p.y - minY) / h;
      return { x: nx, y: ny, cp1x: nx, cp1y: ny, cp2x: nx, cp2y: ny };
    });
    const id = crypto.randomUUID();
    setLayers((prev) => [
      ...prev,
      {
        id,
        kind: "bezier",
        name: "Bezier Path",
        anchors,
        closed,
        fill: "#4f7cff",
        strokeColor: drawBrushColor,
        strokeWidth: drawBrushWidth,
        x: minX,
        y: minY,
        width: w,
        height: h,
        rotation: "0",
        opacity: "100",
        visible: true,
      },
    ]);
    setSelectedLayerId(id);
    setBezierDraft([]);
    setStageMode("select");
  }

  function beginLayerDrag(layer: EditorLayer, mode: "move" | "nw" | "ne" | "sw" | "se" | "e" | "w" | "rotate", event: React.PointerEvent<HTMLElement>) {
    if (stageMode !== "select" || layer.locked) return;
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
      if (lockAspect) nextH = Math.max(minSize, nextW / aspect);
      else {
        const snapBottom = snapAxisCoordinate(g.startY + Math.max(minSize, g.startH + dy), outHeight, otherYEdges);
        nextH = Math.max(minSize, snapBottom.value - g.startY);
        guideY = snapBottom.guide;
      }
    } else if (g.mode === "sw") {
      const snapLeft = snapAxisCoordinate(Math.min(g.startX + g.startW - minSize, g.startX + dx), outWidth, otherXEdges);
      nextX = snapLeft.value;
      nextW = Math.max(minSize, g.startX + g.startW - nextX);
      guideX = snapLeft.guide;
      if (lockAspect) nextH = Math.max(minSize, nextW / aspect);
      else {
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

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas || !canvasValid) return;
    const quality = Number(jpegQuality);
    if ((exportFormat === "jpeg" || exportFormat === "webp") && (!Number.isFinite(quality) || quality < 0 || quality > 1)) {
      setError("Export quality must be a number from 0 through 1.");
      return;
    }
    try {
      const blob = await exportCompositionToBlob(canvas, exportFormat, quality);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${baseImage ? baseImage.file.name.replace(/\.[^.]+$/, "") : "local-studio-canvas"}-${outWidth}x${outHeight}.${exportFormat === "jpeg" ? "jpg" : exportFormat}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `The ${exportFormat.toUpperCase()} image could not be exported.`);
    }
  }

  useEffect(() => {
    if (!projectId || loadedProjectIdRef.current === projectId) return;
    let cancelled = false;
    void (async () => {
      try {
        const project = await getProject(projectId);
        if (!project || project.kind !== "image" || !project.imageEditorDocument) {
          throw new Error("This saved image editor project is missing or unavailable.");
        }
        const doc = project.imageEditorDocument;
        for (const fontMeta of doc.customFonts ?? []) {
          const fontFile = await readVideoAsset(fontMeta.id);
          if (fontFile) await registerCustomFont(fontFile, fontMeta.id, fontMeta.family);
        }
        let restoredBase: BaseImage | null = null;
        if (doc.baseImage) {
          const file = await readVideoAsset(doc.baseImage.id);
          if (!file) throw new Error(`The base image “${doc.baseImage.name}” is missing.`);
          restoredBase = { id: doc.baseImage.id, file, width: doc.baseImage.width, height: doc.baseImage.height };
        }
        const restoredLayers: EditorLayer[] = await Promise.all(
          doc.layers.map(async (layer) => {
            if (layer.kind !== "image") return layer;
            const file = await readVideoAsset(layer.id);
            if (!file) throw new Error(`The image layer “${layer.assetName}” is missing.`);
            const maskFile = layer.eraserMaskId ? (await readVideoAsset(layer.eraserMaskId)) ?? undefined : undefined;
            const { assetName: _name, assetType: _type, ...rest } = layer;
            return { ...rest, file, eraserMaskFile: maskFile };
          }),
        );
        if (cancelled) return;
        loadedProjectIdRef.current = projectId;
        restoringHistoryRef.current = true;
        setWidth(doc.width);
        setHeight(doc.height);
        setBackground(doc.background);
        setBackgroundFill(doc.backgroundFill ?? null);
        setBaseImage(restoredBase);
        setBaseBrightness(doc.baseBrightness);
        setBaseContrast(doc.baseContrast);
        setBaseSaturation(doc.baseSaturation);
        setBaseRotation(doc.baseRotation);
        setBaseFlipHorizontal(doc.baseFlipHorizontal);
        if (doc.overlays) setOverlays(doc.overlays);
        setLayers(restoredLayers);
        if (doc.exportFormat) setExportFormat(doc.exportFormat);
        if (doc.jpegQuality) setJpegQuality(doc.jpegQuality);
        setProjectStatus(`Loaded “${project.title}”`);
        setError("");
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load the saved image project.");
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  async function saveProjectNow() {
    setSavingProject(true);
    try {
      let targetId = projectId;
      if (!targetId) {
        const created = await createProject(
          baseImage ? baseImage.file.name.replace(/\.[^.]+$/, "") : "Image Editor Project",
          "image",
        );
        targetId = created.id;
        loadedProjectIdRef.current = targetId;
        setSearchParams({ project: targetId }, { replace: true });
      }
      const { document, files } = serializeEditorDocument(currentSnapshot, exportFormat, jpegQuality, customFonts);
      await saveImageEditorProject(targetId, document, files);
      setProjectStatus("Saved locally");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the image editor project.");
    } finally {
      setSavingProject(false);
    }
  }

  return (
    <main className="resize-page image-collage-page has-media">
      <ToolPageHeader />
      <section className="resize-intro">
        <p className="eyebrow">IMAGE · LOCAL PROCESSING</p>
        <h1>Image editor</h1>
        <p>Design locally with layers, 3D/curved text, custom fonts, gradients, shapes, freehand draw, Bezier paths, cutouts, and perspective warp.</p>
      </section>
      <section className="resize-workspace image-tool-workspace" aria-label="Image editor workspace">
        <aside className="resize-controls collage-studio-sidebar" aria-label="Image editor tools">
          <nav className="collage-studio-rail" aria-label="Editor panels">
            <button type="button" className={stageMode !== "draw" && stageMode !== "bezier" && panel === "canvas" ? "active" : ""} aria-pressed={stageMode !== "draw" && stageMode !== "bezier" && panel === "canvas"} onClick={() => { setStageMode("select"); setBezierDraft([]); setPanel("canvas"); }}><span aria-hidden="true">⬜</span><small>Canvas</small></button>
            <button type="button" className={stageMode !== "draw" && stageMode !== "bezier" && panel === "layers" ? "active" : ""} aria-pressed={stageMode !== "draw" && stageMode !== "bezier" && panel === "layers"} onClick={() => { setStageMode("select"); setBezierDraft([]); setPanel("layers"); }}><span aria-hidden="true">⧉</span><small>Layers</small></button>
            <button type="button" onClick={() => {
              setStageMode("select");
              setBezierDraft([]);
              const existingText = selectedLayer?.kind === "text" ? selectedLayer : layers.find((l) => l.kind === "text");
              if (existingText) { setSelectedLayerId(existingText.id); setPanel("layers"); }
              else addShapeOrTextLayer("text");
            }}><span aria-hidden="true">T</span><small>Text</small></button>
            <button type="button" className={stageMode === "draw" ? "active" : ""} aria-pressed={stageMode === "draw"} onClick={() => { setBezierDraft([]); setStageMode(stageMode === "draw" ? "select" : "draw"); }}><span aria-hidden="true">✎</span><small>Draw</small></button>
            <button type="button" className={stageMode === "bezier" ? "active" : ""} aria-pressed={stageMode === "bezier"} onClick={() => { setBezierDraft([]); setStageMode(stageMode === "bezier" ? "select" : "bezier"); }}><span aria-hidden="true">✒</span><small>Bezier</small></button>
            <button type="button" className={stageMode !== "draw" && stageMode !== "bezier" && panel === "export" ? "active" : ""} aria-pressed={stageMode !== "draw" && stageMode !== "bezier" && panel === "export"} onClick={() => { setStageMode("select"); setBezierDraft([]); setPanel("export"); }}><span aria-hidden="true">⚙</span><small>Adjust</small></button>
          </nav>

          <div className="collage-studio-panel" style={{ overflow: "hidden" }}>
            <header>
              <strong>{panel === "canvas" ? "Blank & Base Canvas" : panel === "layers" ? "Layers & Overlays" : "Effects & Export"}</strong>
              <span>{canvasValid ? `${outWidth} × ${outHeight} px` : "Invalid size"} · {layers.length} layer(s)</span>
            </header>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gap: 10, alignContent: "start" }}>

            {stageMode === "draw" && (
              <section className="collage-sidebar-section">
                <strong>Freehand Draw Mode</strong>
                <div className="dimension-fields">
                  <label>Color<input type="color" value={drawBrushColor} onChange={(e) => setDrawBrushColor(e.currentTarget.value)} /></label>
                  <label>Width <span>px</span><input type="number" min="1" max="120" step="1" value={drawBrushWidth} onChange={(e) => setDrawBrushWidth(Math.max(1, Number(e.currentTarget.value) || 4))} /></label>
                </div>
                <button type="button" className="secondary-button" onClick={() => setStageMode("select")}>Exit Draw Mode</button>
              </section>
            )}

            {stageMode === "bezier" && (
              <section className="collage-sidebar-section">
                <strong>Bezier Path Tool ({bezierDraft.length} pts)</strong>
                <p className="resize-note">Click on the canvas to place path vertices.</p>
                <div className="dimension-fields">
                  <button type="button" className="export-button" disabled={bezierDraft.length < 2} onClick={() => commitBezierDraft(true)}>Finish Closed</button>
                  <button type="button" className="secondary-button" disabled={bezierDraft.length < 2} onClick={() => commitBezierDraft(false)}>Finish Open</button>
                </div>
                <button type="button" className="secondary-button" onClick={() => { setBezierDraft([]); setStageMode("select"); }}>Cancel</button>
              </section>
            )}

            {panel === "canvas" && (
              <section className="collage-sidebar-section">
                <div className="dimension-fields">
                  <label>Width <span>px</span><input type="number" min="1" max="32768" step="1" value={width} onChange={(event) => setWidth(event.currentTarget.value)} /></label>
                  <label>Height <span>px</span><input type="number" min="1" max="32768" step="1" value={height} onChange={(event) => setHeight(event.currentTarget.value)} /></label>
                </div>
                <label className="ratio-field">
                  Canvas presets
                  <select
                    aria-label="Blank canvas presets"
                    value={CANVAS_PRESETS.find((p) => p.w === width && p.h === height)?.label ?? ""}
                    onChange={(event) => {
                      const preset = CANVAS_PRESETS.find((p) => p.label === event.currentTarget.value);
                      if (preset) {
                        setWidth(preset.w);
                        setHeight(preset.h);
                      }
                    }}
                  >
                    <option value="">Custom ({width || 0} × {height || 0})</option>
                    {CANVAS_PRESETS.map((preset) => (
                      <option key={preset.label} value={preset.label}>{preset.label}</option>
                    ))}
                  </select>
                </label>
                <div className="collage-background-picker">
                  <strong>Background</strong>
                  <div className="collage-background-swatches" aria-label="Background presets">
                    {BACKGROUND_SWATCHES.map((swatch) => (
                      <button
                        type="button"
                        key={swatch.color}
                        data-transparent={swatch.color === "transparent" ? "true" : undefined}
                        className={background.toLowerCase() === swatch.color && !backgroundFill ? "active" : ""}
                        style={swatch.color === "transparent" ? undefined : ({ "--swatch-color": swatch.color } as React.CSSProperties)}
                        aria-label={`${swatch.name} background`}
                        aria-pressed={background.toLowerCase() === swatch.color && !backgroundFill}
                        title={swatch.name}
                        onClick={() => { setBackground(swatch.color); setBackgroundFill(null); }}
                      />
                    ))}
                  </div>
                  <label className="collage-custom-color">Custom color<input type="color" aria-label="Custom background color" value={background === "transparent" ? "#ffffff" : background} onChange={(event) => { setBackground(event.currentTarget.value); setBackgroundFill(null); }} /></label>
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
              </section>
            )}

            {panel === "layers" && (
              <section className="collage-sidebar-section">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <label className="file-picker collage-add-layer" style={{ margin: 0, textAlign: "center" }}>
                    <span>+ Image</span>
                    <input type="file" accept="image/*" multiple onChange={(event) => { void addImageLayers(event.currentTarget.files); event.currentTarget.value = ""; }} />
                  </label>
                  <button type="button" className="secondary-button" onClick={() => addShapeOrTextLayer("text")}>+ Text</button>
                  <button type="button" className="secondary-button" onClick={() => addShapeOrTextLayer("sticker")}>+ Sticker</button>
                  <select
                    aria-label="Add shape layer"
                    value=""
                    style={{ minHeight: 34, padding: "6px 8px", border: "1px solid #33455f", borderRadius: 6, background: "#142236", color: "#dceaff", font: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                    onChange={(event) => {
                      const val = event.currentTarget.value as ShapeKind | "";
                      if (val) addShapeOrTextLayer(val);
                    }}
                  >
                    <option value="">+ Shape…</option>
                    <option value="rectangle">Rectangle</option>
                    <option value="rounded-rect">Rounded Rect</option>
                    <option value="ellipse">Ellipse / Circle</option>
                    <option value="polygon">Polygon</option>
                    <option value="star">Star</option>
                    <option value="arrow">Arrow</option>
                    <option value="speech-bubble">Speech Bubble</option>
                  </select>
                </div>

                {layers.filter((l) => l.visible).length >= 2 && (
                  <button type="button" className="secondary-button" onClick={() => void mergeVisibleLayers()}>
                    Merge visible layers
                  </button>
                )}

                <ol className="collage-image-list">
                  {layers.map((layer, index) => (
                    <li key={layer.id}>
                      <button type="button" className={selectedLayerId === layer.id ? "selected" : ""} onClick={() => setSelectedLayerId(layer.id)}>
                        <span className="collage-image-index">{String(index + 1).padStart(2, "0")}</span>
                        <span className="collage-image-name">
                          <strong>{layer.locked ? "🔒 " : ""}{layer.kind === "text" ? layer.text || "Text" : layer.kind === "sticker" ? `${layer.emoji} Sticker` : layer.name}</strong>
                          <small>{layer.kind} · {layer.width}×{layer.height}</small>
                        </span>
                      </button>
                      <button type="button" aria-label={`Move layer ${index + 1} down`} disabled={index === 0} onClick={() => reorderLayer(layer.id, -1)}>↓</button>
                      <button type="button" aria-label={`Move layer ${index + 1} up`} disabled={index === layers.length - 1} onClick={() => reorderLayer(layer.id, 1)}>↑</button>
                      <button type="button" aria-label={`Remove layer ${index + 1}`} onClick={() => removeLayer(layer.id)}>×</button>
                    </li>
                  ))}
                </ol>

                {selectedLayer ? (
                  <LayerInspector
                    layer={selectedLayer}
                    customFonts={customFonts}
                    stageMode={stageMode}
                    eraserBrushSize={eraserBrushSize}
                    onEraserBrushSizeChange={setEraserBrushSize}
                    onStageModeChange={setStageMode}
                    onUpdate={updateLayer}
                    onDuplicate={duplicateLayer}
                    onUploadCustomFont={(file) => void registerCustomFont(file)}
                    onClearEraserMask={(id) => updateLayer(id, { eraserMaskId: undefined, eraserMaskFile: undefined })}
                  />
                ) : (
                  <p className="resize-note">Add an image, text, shape, sticker, or draw layer, or drop an image onto the canvas.</p>
                )}
              </section>
            )}

            {panel === "export" && (
              <CanvasEffectsPanel
                hasBaseImage={Boolean(baseImage)}
                baseBrightness={baseBrightness}
                baseContrast={baseContrast}
                baseSaturation={baseSaturation}
                baseRotation={baseRotation}
                baseFlipHorizontal={baseFlipHorizontal}
                onBaseChange={(patch) => {
                  if (patch.baseBrightness !== undefined) setBaseBrightness(patch.baseBrightness);
                  if (patch.baseContrast !== undefined) setBaseContrast(patch.baseContrast);
                  if (patch.baseSaturation !== undefined) setBaseSaturation(patch.baseSaturation);
                  if (patch.baseRotation !== undefined) setBaseRotation(patch.baseRotation);
                  if (patch.baseFlipHorizontal !== undefined) setBaseFlipHorizontal(patch.baseFlipHorizontal);
                }}
                background={background}
                backgroundFill={backgroundFill}
                onBackgroundFillChange={(solid, fill) => { setBackground(solid); setBackgroundFill(fill); }}
                overlays={overlays}
                onOverlaysChange={setOverlays}
                showGrid={showGrid}
                onShowGridChange={setShowGrid}
                exportFormat={exportFormat}
                onExportFormatChange={setExportFormat}
                jpegQuality={jpegQuality}
                onJpegQualityChange={setJpegQuality}
              />
            )}
            </div>

            <footer className="collage-sidebar-footer">
              <p className="resize-note">{canvasValid ? `${outWidth} × ${outHeight} px (${((outWidth * outHeight) / 1_000_000).toFixed(1)} MP)` : "Enter valid dimensions (max 32,768 px / 100 MP)."}{projectStatus ? ` · ${projectStatus}` : ""}</p>
              {error && <p className="resize-error" role="alert">{error}</p>}
              <button type="button" className="secondary-button" disabled={savingProject} onClick={() => void saveProjectNow()}>{savingProject ? "Saving…" : projectId ? "Save project" : "Save as project"}</button>
              <button type="button" className="export-button" disabled={!canvasValid} onClick={() => void download()}>Download {exportFormat.toUpperCase()}</button>
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
              if (event.button === 1 || (event.target === event.currentTarget && stageMode === "select")) {
                panGesture.current = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startPanX: viewTransform.panX, startPanY: viewTransform.panY };
                event.currentTarget.setPointerCapture(event.pointerId);
              }
            }}
            onPointerMove={(event) => {
              const p = panGesture.current;
              if (!p || p.pointerId !== event.pointerId) return;
              setViewTransform((t) => ({ ...t, panX: p.startPanX + (event.clientX - p.startClientX), panY: p.startPanY + (event.clientY - p.startClientY) }));
            }}
            onPointerUp={(event) => { if (panGesture.current?.pointerId === event.pointerId) panGesture.current = null; }}
            onPointerCancel={(event) => { if (panGesture.current?.pointerId === event.pointerId) panGesture.current = null; }}
          >
            <div
              className="collage-stage-frame"
              style={{
                display: "inline-block",
                width: "fit-content",
                maxHeight: "none",
                transform: `translate(${viewTransform.panX}px, ${viewTransform.panY}px) scale(${viewTransform.zoom})`,
              }}
            >
              <div
                ref={stageRef}
                className={`collage-canvas-stage${background === "transparent" && !backgroundFill ? " is-transparent" : ""}${resizingCanvas ? " is-dragging-divider" : ""}`}
                style={{
                  display: "block",
                  width: canvasValid ? `min(62vw, ${(outWidth / outHeight) * 52}dvh, ${(outWidth / outHeight) * 720}px)` : "min(62vw, 640px)",
                  aspectRatio: canvasValid ? `${outWidth} / ${outHeight}` : "4 / 3",
                  maxHeight: "none",
                  cursor: stageMode === "draw" || stageMode === "bezier" || stageMode === "erase" ? "crosshair" : undefined,
                  ...(background === "transparent" || backgroundFill ? {} : { backgroundColor: background }),
                }}
                onClick={() => { if (stageMode === "select") setSelectedLayerId(""); }}
                onPointerDown={(event) => {
                  if (stageMode === "draw") {
                    const pt = clientToCanvasPoint(event.clientX, event.clientY);
                    if (!pt) return;
                    event.stopPropagation();
                    drawSession.current = { pointerId: event.pointerId, points: [pt] };
                    setLiveDrawPoints([pt]);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  } else if (stageMode === "bezier") {
                    const pt = clientToCanvasPoint(event.clientX, event.clientY);
                    if (!pt) return;
                    event.stopPropagation();
                    setBezierDraft((prev) => [...prev, pt]);
                  } else if (stageMode === "erase" && selectedLayer?.kind === "image") {
                    const pt = clientToCanvasPoint(event.clientX, event.clientY);
                    if (!pt) return;
                    event.stopPropagation();
                    const maskCanvas = document.createElement("canvas");
                    maskCanvas.width = Math.max(1, Math.round(selectedLayer.width));
                    maskCanvas.height = Math.max(1, Math.round(selectedLayer.height));
                    const mCtx = maskCanvas.getContext("2d");
                    if (!mCtx) return;
                    const existingMask = eraserMaskCache.current.get(selectedLayer.id)?.bitmap;
                    if (existingMask) mCtx.drawImage(existingMask, 0, 0, maskCanvas.width, maskCanvas.height);
                    else {
                      mCtx.fillStyle = "#ffffff";
                      mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
                    }
                    const lx = pt.x - selectedLayer.x;
                    const ly = pt.y - selectedLayer.y;
                    mCtx.globalCompositeOperation = "destination-out";
                    mCtx.beginPath();
                    mCtx.arc(lx, ly, eraserBrushSize / 2, 0, Math.PI * 2);
                    mCtx.fill();
                    eraseSession.current = { pointerId: event.pointerId, layerId: selectedLayer.id, canvas: maskCanvas, lastX: lx, lastY: ly };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }
                }}
                onPointerMove={(event) => {
                  if (drawSession.current?.pointerId === event.pointerId) {
                    const pt = clientToCanvasPoint(event.clientX, event.clientY);
                    if (!pt) return;
                    drawSession.current.points.push(pt);
                    setLiveDrawPoints([...drawSession.current.points]);
                  } else if (eraseSession.current?.pointerId === event.pointerId && selectedLayer?.kind === "image") {
                    const pt = clientToCanvasPoint(event.clientX, event.clientY);
                    if (!pt) return;
                    const sess = eraseSession.current;
                    const mCtx = sess.canvas.getContext("2d");
                    if (!mCtx) return;
                    const lx = pt.x - selectedLayer.x;
                    const ly = pt.y - selectedLayer.y;
                    mCtx.globalCompositeOperation = "destination-out";
                    mCtx.strokeStyle = "#000000";
                    mCtx.lineWidth = eraserBrushSize;
                    mCtx.lineCap = "round";
                    mCtx.beginPath();
                    mCtx.moveTo(sess.lastX, sess.lastY);
                    mCtx.lineTo(lx, ly);
                    mCtx.stroke();
                    sess.lastX = lx;
                    sess.lastY = ly;
                  }
                }}
                onPointerUp={(event) => {
                  if (drawSession.current?.pointerId === event.pointerId) {
                    const pts = drawSession.current.points;
                    drawSession.current = null;
                    setLiveDrawPoints([]);
                    if (pts.length >= 2) {
                      const pad = drawBrushWidth;
                      const minX = Math.floor(Math.min(...pts.map((p) => p.x)) - pad);
                      const minY = Math.floor(Math.min(...pts.map((p) => p.y)) - pad);
                      const maxX = Math.ceil(Math.max(...pts.map((p) => p.x)) + pad);
                      const maxY = Math.ceil(Math.max(...pts.map((p) => p.y)) + pad);
                      const w = Math.max(16, maxX - minX);
                      const h = Math.max(16, maxY - minY);
                      const id = crypto.randomUUID();
                      setLayers((prev) => [
                        ...prev,
                        {
                          id,
                          kind: "draw",
                          name: "Drawing",
                          points: pts.map((p) => ({ x: (p.x - minX) / w, y: (p.y - minY) / h })),
                          strokeColor: drawBrushColor,
                          strokeWidth: drawBrushWidth,
                          x: minX,
                          y: minY,
                          width: w,
                          height: h,
                          rotation: "0",
                          opacity: "100",
                          visible: true,
                        },
                      ]);
                      setSelectedLayerId(id);
                      setPanel("layers");
                    }
                  } else if (eraseSession.current?.pointerId === event.pointerId) {
                    const sess = eraseSession.current;
                    eraseSession.current = null;
                    sess.canvas.toBlob((blob) => {
                      if (!blob) return;
                      const maskFile = new File([blob], "eraser-mask.png", { type: "image/png" });
                      updateLayer(sess.layerId, { eraserMaskId: crypto.randomUUID(), eraserMaskFile: maskFile });
                    }, "image/png");
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void addImageLayers(event.dataTransfer.files);
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="preview-canvas"
                  style={{ width: "100%", height: "100%", display: "block", maxHeight: "none", objectFit: "fill" }}
                  aria-label="Image editor canvas. Drop images here to add layers."
                />

                {showGrid && canvasValid && (
                  <svg viewBox={`0 0 ${outWidth} ${outHeight}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }} aria-hidden="true">
                    {Array.from({ length: 7 }, (_, i) => {
                      const pos = ((i + 1) / 8) * outWidth;
                      return <line key={`vx-${i}`} x1={pos} y1={0} x2={pos} y2={outHeight} stroke="rgba(148,163,184,0.35)" strokeWidth={Math.max(1, outWidth / 800)} strokeDasharray="6 6" />;
                    })}
                    {Array.from({ length: 7 }, (_, i) => {
                      const pos = ((i + 1) / 8) * outHeight;
                      return <line key={`hy-${i}`} x1={0} y1={pos} x2={outWidth} y2={pos} stroke="rgba(148,163,184,0.35)" strokeWidth={Math.max(1, outHeight / 800)} strokeDasharray="6 6" />;
                    })}
                  </svg>
                )}

                {liveDrawPoints.length > 1 && canvasValid && (
                  <svg viewBox={`0 0 ${outWidth} ${outHeight}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 40 }} aria-hidden="true">
                    <polyline
                      fill="none"
                      stroke={drawBrushColor}
                      strokeWidth={drawBrushWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={liveDrawPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                    />
                  </svg>
                )}

                {bezierDraft.length > 0 && canvasValid && (
                  <svg viewBox={`0 0 ${outWidth} ${outHeight}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 40 }} aria-hidden="true">
                    <polyline fill="none" stroke={drawBrushColor} strokeWidth={Math.max(2, outWidth / 400)} points={bezierDraft.map((p) => `${p.x},${p.y}`).join(" ")} />
                    {bezierDraft.map((p, idx) => (
                      <circle key={idx} cx={p.x} cy={p.y} r={Math.max(5, outWidth / 160)} fill="#ffffff" stroke={drawBrushColor} strokeWidth={2} />
                    ))}
                  </svg>
                )}

                {canvasValid && snapGuides.x !== null && <div className="collage-snap-v" style={{ left: `${(snapGuides.x / outWidth) * 100}%` }} aria-hidden="true" />}
                {canvasValid && snapGuides.y !== null && <div className="collage-snap-h" style={{ top: `${(snapGuides.y / outHeight) * 100}%` }} aria-hidden="true" />}

                {canvasValid && layers.map((layer, idx) => {
                  if (!layer.visible) return null;
                  const isSelected = selectedLayerId === layer.id;
                  const pOffsets = layer.kind === "image" ? layer.perspective : undefined;
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
                        pointerEvents: stageMode === "select" ? "auto" : "none",
                      }}
                      onPointerDown={(event) => {
                        if (editingTextId === layer.id) return;
                        beginLayerDrag(layer, "move", event);
                      }}
                      onPointerMove={moveLayerDrag}
                      onPointerUp={endLayerDrag}
                      onPointerCancel={endLayerDrag}
                      onDoubleClick={(event) => {
                        if (layer.kind !== "text" || layer.locked || stageMode !== "select") return;
                        event.stopPropagation();
                        setSelectedLayerId(layer.id);
                        setPanel("layers");
                        setEditingTextId(layer.id);
                      }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {editingTextId === layer.id && layer.kind === "text" && (() => {
                        const stageScale = stageRef.current
                          ? stageRef.current.getBoundingClientRect().width / Math.max(1, outWidth * viewTransform.zoom)
                          : 0.5;
                        return (
                          <textarea
                            autoFocus
                            value={layer.text}
                            maxLength={500}
                            onChange={(event) => updateLayer(layer.id, { text: event.currentTarget.value })}
                            onBlur={() => setEditingTextId("")}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                event.stopPropagation();
                                setEditingTextId("");
                              }
                            }}
                            style={{
                              position: "absolute",
                              inset: 0,
                              width: "100%",
                              height: "100%",
                              resize: "none",
                              overflow: "hidden",
                              border: "none",
                              outline: "none",
                              background: "transparent",
                              color: layer.fill,
                              padding: 0,
                              margin: 0,
                              fontFamily: layer.fontFamily || "system-ui, sans-serif",
                              fontSize: `${layer.fontSize * stageScale}px`,
                              fontWeight: layer.bold ? 700 : 500,
                              fontStyle: layer.italic ? "italic" : "normal",
                              textAlign: layer.align ?? "left",
                              lineHeight: String(layer.lineHeight ?? 1.25),
                              letterSpacing: layer.letterSpacing ? `${layer.letterSpacing * stageScale}px` : undefined,
                              zIndex: 50,
                            }}
                          />
                        );
                      })()}
                      {isSelected && stageMode === "select" && !layer.locked && editingTextId !== layer.id && (
                        <>
                          <button type="button" className="collage-layer-handle nw" aria-label="Resize top-left" onPointerDown={(event) => beginLayerDrag(layer, "nw", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                          <button type="button" className="collage-layer-handle ne" aria-label="Resize top-right" onPointerDown={(event) => beginLayerDrag(layer, "ne", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                          <button type="button" className="collage-layer-handle sw" aria-label="Resize bottom-left" onPointerDown={(event) => beginLayerDrag(layer, "sw", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                          <button type="button" className="collage-layer-handle se" aria-label="Resize bottom-right" onPointerDown={(event) => beginLayerDrag(layer, "se", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                          {layer.kind === "text" && (
                            <>
                              <button type="button" className="collage-layer-handle w" aria-label="Resize text width left" onPointerDown={(event) => beginLayerDrag(layer, "w", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                              <button type="button" className="collage-layer-handle e" aria-label="Resize text width right" onPointerDown={(event) => beginLayerDrag(layer, "e", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                            </>
                          )}
                          <button type="button" className="collage-layer-handle rotate" aria-label="Rotate layer" onPointerDown={(event) => beginLayerDrag(layer, "rotate", event)} onPointerMove={moveLayerDrag} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} />
                        </>
                      )}

                      {isSelected && stageMode === "perspective" && layer.kind === "image" && (
                        (["tl", "tr", "br", "bl"] as const).map((corner) => {
                          const offset = pOffsets?.[corner] ?? { x: 0, y: 0 };
                          const baseLeft = corner === "tl" || corner === "bl" ? 0 : 100;
                          const baseTop = corner === "tl" || corner === "tr" ? 0 : 100;
                          return (
                            <button
                              key={corner}
                              type="button"
                              className="collage-layer-handle"
                              aria-label={`Perspective corner ${corner}`}
                              style={{
                                pointerEvents: "auto",
                                left: `calc(${baseLeft}% + ${(offset.x / Math.max(1, layer.width)) * 100}%)`,
                                top: `calc(${baseTop}% + ${(offset.y / Math.max(1, layer.height)) * 100}%)`,
                                transform: "translate(-50%, -50%)",
                                background: "#f59e0b",
                              }}
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                perspectiveGesture.current = {
                                  id: layer.id,
                                  corner,
                                  pointerId: event.pointerId,
                                  startClientX: event.clientX,
                                  startClientY: event.clientY,
                                  startX: offset.x,
                                  startY: offset.y,
                                };
                                event.currentTarget.setPointerCapture(event.pointerId);
                              }}
                              onPointerMove={(event) => {
                                const pg = perspectiveGesture.current;
                                if (!pg || pg.pointerId !== event.pointerId || !stageRef.current) return;
                                const bounds = stageRef.current.getBoundingClientRect();
                                const dx = ((event.clientX - pg.startClientX) / Math.max(1, bounds.width)) * outWidth;
                                const dy = ((event.clientY - pg.startClientY) / Math.max(1, bounds.height)) * outHeight;
                                const current = pOffsets ?? { tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } };
                                updateLayer(layer.id, {
                                  perspective: {
                                    ...current,
                                    [pg.corner]: { x: Math.round(pg.startX + dx), y: Math.round(pg.startY + dy) },
                                  },
                                });
                              }}
                              onPointerUp={(event) => {
                                if (perspectiveGesture.current?.pointerId === event.pointerId) {
                                  perspectiveGesture.current = null;
                                  setDragCommitTick((t) => t + 1);
                                }
                              }}
                            />
                          );
                        })
                      )}
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
