import { applyColorizeToCanvas, applyEmbossToCanvas, getNoiseTileCanvas } from "./effects";
import { hasNonZeroPerspective, warpCanvasPerspectiveCPU } from "./perspective";
import { resolveCanvasFill, traceBezierPath, traceShapePath } from "./shapes";
import { applyTextCase, buildCanvasFont, measureTrackedTextWidth, wrapTextLines } from "./text-layout";
import type {
  CanvasOverlayEffects,
  DrawLayer,
  EditorLayer,
  FillStyle,
  ImageLayer,
  ShadowEffect,
  ShapeLayer,
  StickerLayer,
  TextLayer,
} from "./types";

export type CompositionRenderState = {
  width: number;
  height: number;
  background: string;
  backgroundFill?: FillStyle | null;
  baseBitmap: ImageBitmap | null;
  baseBrightness: string;
  baseContrast: string;
  baseSaturation: string;
  baseRotation: string;
  baseFlipHorizontal: boolean;
  overlays?: CanvasOverlayEffects;
  layers: EditorLayer[];
  hiddenLayerId?: string;
  imageBitmaps: Map<string, ImageBitmap>;
  erasedBitmaps?: Map<string, ImageBitmap>;
  eraserMasks?: Map<string, ImageBitmap>;
};

function clampPercentage(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(300, Math.max(0, n)) : 100;
}

function applyShadow(ctx: CanvasRenderingContext2D, shadow?: ShadowEffect): void {
  if (!shadow?.enabled) return;
  ctx.shadowColor = shadow.color;
  ctx.shadowBlur = Math.max(0, shadow.blur);
  ctx.shadowOffsetX = shadow.offsetX;
  ctx.shadowOffsetY = shadow.offsetY;
}

function clearShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function drawTrackedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
  mode: "fill" | "stroke",
): void {
  if (!letterSpacing) {
    if (mode === "stroke") ctx.strokeText(text, x, y);
    else ctx.fillText(text, x, y);
    return;
  }
  let cursorX = x;
  for (const ch of Array.from(text)) {
    if (mode === "stroke") ctx.strokeText(ch, cursorX, y);
    else ctx.fillText(ch, cursorX, y);
    cursorX += ctx.measureText(ch).width + letterSpacing;
  }
}

function renderTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer): void {
  const cased = applyTextCase(layer.text, layer.textCase);
  const font = buildCanvasFont(layer);
  const lineRatio = Math.max(0.8, Math.min(3, layer.lineHeight ?? 1.25));
  const spacing = layer.letterSpacing ?? 0;
  const align = layer.align ?? "left";
  const lineHeight = layer.fontSize * lineRatio;

  ctx.font = font;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  // Background highlight box
  if (layer.background?.enabled) {
    const pad = Math.max(0, layer.background.padding);
    const rad = Math.max(0, layer.background.radius);
    ctx.save();
    ctx.globalAlpha *= Math.max(0, Math.min(1, layer.background.opacity / 100));
    ctx.fillStyle = layer.background.color;
    ctx.beginPath();
    ctx.roundRect(-layer.width / 2 - pad, -layer.height / 2 - pad, layer.width + pad * 2, layer.height + pad * 2, rad);
    ctx.fill();
    ctx.restore();
  }

  // Curved text path
  if (layer.curveRadius && Math.abs(layer.curveRadius) >= 20) {
    const radius = layer.curveRadius;
    const chars = Array.from(cased.replace(/\n/g, " "));
    const widths = chars.map((ch) => ctx.measureText(ch).width + spacing);
    const totalArcLen = widths.reduce((a, b) => a + b, 0);
    const absR = Math.abs(radius);
    const totalAngle = totalArcLen / absR;
    let angle = -totalAngle / 2;

    ctx.save();
    applyShadow(ctx, layer.shadow);
    ctx.fillStyle = resolveCanvasFill(
      ctx,
      layer.fillStyle,
      layer.fill,
      -layer.width / 2,
      -layer.height / 2,
      layer.width,
      layer.height,
    );
    const sign = radius > 0 ? 1 : -1;
    for (let i = 0; i < chars.length; i++) {
      const charAngle = widths[i] / absR;
      const mid = angle + charAngle / 2;
      ctx.save();
      ctx.translate(0, sign * absR);
      ctx.rotate(sign * mid);
      ctx.translate(0, -sign * absR);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (layer.strokeWidth && layer.strokeWidth > 0 && layer.strokeColor) {
        ctx.strokeStyle = layer.strokeColor;
        ctx.lineWidth = layer.strokeWidth * 2;
        ctx.lineJoin = "round";
        ctx.strokeText(chars[i], 0, 0);
      }
      ctx.fillText(chars[i], 0, 0);
      ctx.restore();
      angle += charAngle;
    }
    ctx.restore();
    return;
  }

  const measure = (s: string) => measureTrackedTextWidth((c) => ctx.measureText(c).width, s, spacing);
  const lines = wrapTextLines(measure, cased, layer.width);

  const drawAllLines = (targetCtx: CanvasRenderingContext2D, dx: number, dy: number, mode: "fill" | "stroke") => {
    lines.forEach((line, idx) => {
      const lw = measure(line);
      let startX = -layer.width / 2;
      if (align === "center") startX = -lw / 2;
      else if (align === "right") startX = layer.width / 2 - lw;
      drawTrackedLine(targetCtx, line, startX + dx, -layer.height / 2 + idx * lineHeight + dy, spacing, mode);
    });
  };

  // 3D stacked extrusion
  if (layer.text3d?.enabled && layer.text3d.depth > 0) {
    const depth = Math.min(48, Math.max(1, Math.round(layer.text3d.depth)));
    const rad = ((layer.text3d.angle ?? 45) * Math.PI) / 180;
    const stepX = Math.cos(rad);
    const stepY = Math.sin(rad);
    const shade = Math.max(10, Math.min(90, layer.text3d.darken ?? 55));
    const gray = Math.round(255 * (1 - shade / 100));
    ctx.save();
    ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
    for (let d = depth; d >= 1; d--) {
      drawAllLines(ctx, stepX * d, stepY * d, "fill");
    }
    ctx.restore();
  }

  // Main text + drop shadow + stroke
  ctx.save();
  applyShadow(ctx, layer.shadow);
  if (layer.strokeWidth && layer.strokeWidth > 0 && layer.strokeColor) {
    ctx.strokeStyle = layer.strokeColor;
    ctx.lineWidth = layer.strokeWidth * 2;
    ctx.lineJoin = "round";
    drawAllLines(ctx, 0, 0, "stroke");
    clearShadow(ctx);
  }
  ctx.fillStyle = resolveCanvasFill(
    ctx,
    layer.fillStyle,
    layer.fill,
    -layer.width / 2,
    -layer.height / 2,
    layer.width,
    layer.height,
  );
  drawAllLines(ctx, 0, 0, "fill");
  ctx.restore();

  // Inner shadow (composited in offscreen pad)
  if (layer.innerShadow?.enabled) {
    const pad = Math.ceil(layer.innerShadow.blur + Math.abs(layer.innerShadow.offsetX) + Math.abs(layer.innerShadow.offsetY) + 12);
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.ceil(layer.width + pad * 2));
    off.height = Math.max(1, Math.ceil(layer.height + pad * 2));
    const oCtx = off.getContext("2d");
    if (oCtx) {
      oCtx.font = font;
      oCtx.textBaseline = "top";
      oCtx.textAlign = "left";
      oCtx.translate(off.width / 2, off.height / 2);
      oCtx.fillStyle = "#000000";
      drawAllLines(oCtx, 0, 0, "fill");
      oCtx.globalCompositeOperation = "source-atop";
      oCtx.shadowColor = layer.innerShadow.color;
      oCtx.shadowBlur = layer.innerShadow.blur;
      oCtx.shadowOffsetX = layer.innerShadow.offsetX;
      oCtx.shadowOffsetY = layer.innerShadow.offsetY;
      oCtx.strokeStyle = layer.innerShadow.color;
      oCtx.lineWidth = 4;
      drawAllLines(oCtx, 0, 0, "stroke");
      ctx.drawImage(off, -off.width / 2, -off.height / 2);
    }
  }

  // Vertical reflection
  if (layer.reflection?.enabled) {
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.ceil(layer.width));
    off.height = Math.max(1, Math.ceil(layer.height));
    const oCtx = off.getContext("2d");
    if (oCtx) {
      oCtx.font = font;
      oCtx.textBaseline = "top";
      oCtx.textAlign = "left";
      oCtx.translate(off.width / 2, off.height / 2);
      oCtx.fillStyle = resolveCanvasFill(oCtx, layer.fillStyle, layer.fill, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
      drawAllLines(oCtx, 0, 0, "fill");
      oCtx.globalCompositeOperation = "destination-in";
      const grad = oCtx.createLinearGradient(0, -off.height / 2, 0, off.height / 2);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(0,0,0,${Math.max(0, Math.min(1, layer.reflection.opacity / 100))})`);
      oCtx.fillStyle = grad;
      oCtx.fillRect(-off.width / 2, -off.height / 2, off.width, off.height);

      ctx.save();
      ctx.translate(0, layer.height + (layer.reflection.offset ?? 4));
      ctx.scale(1, -1);
      ctx.drawImage(off, -layer.width / 2, -layer.height / 2);
      ctx.restore();
    }
  }
}

function renderImageLayer(
  ctx: CanvasRenderingContext2D,
  layer: ImageLayer,
  state: CompositionRenderState,
): void {
  const sourceBitmap = (layer.eraseColor?.enabled ? state.erasedBitmaps?.get(layer.id) : undefined) ?? state.imageBitmaps.get(layer.id);
  if (!sourceBitmap) return;

  const w = Math.max(1, Math.round(layer.width));
  const h = Math.max(1, Math.round(layer.height));
  const crop = layer.crop ?? { left: 0, top: 0, right: 0, bottom: 0 };
  const sx = Math.max(0, Math.min(sourceBitmap.width - 1, crop.left * sourceBitmap.width));
  const sy = Math.max(0, Math.min(sourceBitmap.height - 1, crop.top * sourceBitmap.height));
  const sw = Math.max(1, sourceBitmap.width * (1 - crop.left - crop.right));
  const sh = Math.max(1, sourceBitmap.height * (1 - crop.top - crop.bottom));

  // Build offscreen layer surface when pixel/mask/perspective effects are active
  const eraserMask = state.eraserMasks?.get(layer.id);
  const needsOffscreen =
    Boolean(eraserMask) ||
    Boolean(layer.colorize?.enabled) ||
    Boolean(layer.emboss?.enabled) ||
    hasNonZeroPerspective(layer.perspective) ||
    Boolean(layer.reflection?.enabled);

  if (!needsOffscreen) {
    ctx.save();
    applyShadow(ctx, layer.shadow);
    if (layer.clipShape === "circle") {
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.clip();
    } else if (layer.clipShape === "rounded-rect") {
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, Math.max(0, layer.clipRadius ?? 20));
      ctx.clip();
    }
    if (layer.flipHorizontal) ctx.scale(-1, 1);
    ctx.filter = `brightness(${clampPercentage(layer.brightness)}%) contrast(${clampPercentage(layer.contrast)}%) saturate(${clampPercentage(layer.saturation)}%)`;
    ctx.drawImage(sourceBitmap, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
    ctx.restore();

    if (layer.strokeWidth && layer.strokeWidth > 0 && layer.strokeColor) {
      ctx.save();
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineWidth = layer.strokeWidth;
      if (layer.clipShape === "circle") {
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(-w / 2, -h / 2, w, h);
      }
      ctx.restore();
    }
    return;
  }

  let workCanvas = document.createElement("canvas");
  workCanvas.width = w;
  workCanvas.height = h;
  const wCtx = workCanvas.getContext("2d");
  if (!wCtx) return;

  wCtx.save();
  if (layer.clipShape === "circle") {
    wCtx.beginPath();
    wCtx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    wCtx.clip();
  } else if (layer.clipShape === "rounded-rect") {
    wCtx.beginPath();
    wCtx.roundRect(0, 0, w, h, Math.max(0, layer.clipRadius ?? 20));
    wCtx.clip();
  }
  wCtx.translate(w / 2, h / 2);
  if (layer.flipHorizontal) wCtx.scale(-1, 1);
  wCtx.filter = `brightness(${clampPercentage(layer.brightness)}%) contrast(${clampPercentage(layer.contrast)}%) saturate(${clampPercentage(layer.saturation)}%)`;
  wCtx.drawImage(sourceBitmap, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  wCtx.restore();

  if (eraserMask) {
    wCtx.save();
    wCtx.globalCompositeOperation = "destination-in";
    wCtx.drawImage(eraserMask, 0, 0, w, h);
    wCtx.restore();
  }

  if (layer.colorize?.enabled) {
    workCanvas = applyColorizeToCanvas(workCanvas, layer.colorize.color, layer.colorize.strength);
  }
  if (layer.emboss?.enabled) {
    workCanvas = applyEmbossToCanvas(workCanvas, layer.emboss.angle, layer.emboss.intensity);
  }

  let drawX = -w / 2;
  let drawY = -h / 2;
  if (hasNonZeroPerspective(layer.perspective) && layer.perspective) {
    const warped = warpCanvasPerspectiveCPU(workCanvas, layer.perspective);
    workCanvas = warped.canvas;
    drawX += warped.offsetX;
    drawY += warped.offsetY;
  }

  ctx.save();
  applyShadow(ctx, layer.shadow);
  ctx.drawImage(workCanvas, drawX, drawY);
  ctx.restore();

  if (layer.reflection?.enabled) {
    ctx.save();
    ctx.globalAlpha *= Math.max(0, Math.min(1, layer.reflection.opacity / 100));
    ctx.translate(0, workCanvas.height + (layer.reflection.offset ?? 6));
    ctx.scale(1, -1);
    ctx.drawImage(workCanvas, drawX, drawY);
    ctx.restore();
  }
}

function renderShapeLayer(ctx: CanvasRenderingContext2D, layer: ShapeLayer): void {
  ctx.save();
  applyShadow(ctx, layer.shadow);
  traceShapePath(ctx, layer);
  ctx.fillStyle = resolveCanvasFill(
    ctx,
    layer.fillStyle,
    layer.fill,
    -layer.width / 2,
    -layer.height / 2,
    layer.width,
    layer.height,
  );
  ctx.fill();
  clearShadow(ctx);
  if (layer.strokeWidth > 0) {
    ctx.strokeStyle = layer.strokeColor;
    ctx.lineWidth = layer.strokeWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function renderStickerLayer(ctx: CanvasRenderingContext2D, layer: StickerLayer): void {
  ctx.save();
  applyShadow(ctx, layer.shadow);
  const size = Math.max(12, Math.min(layer.width, layer.height) * 0.88);
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(layer.emoji, 0, size * 0.04);
  ctx.restore();
}

function renderDrawLayer(ctx: CanvasRenderingContext2D, layer: DrawLayer): void {
  if (layer.points.length < 2) return;
  ctx.save();
  if (layer.glowBlur && layer.glowBlur > 0) {
    ctx.shadowColor = layer.glowColor || layer.strokeColor;
    ctx.shadowBlur = layer.glowBlur;
  }
  if (layer.dashed) {
    ctx.setLineDash([Math.max(4, layer.strokeWidth * 2), Math.max(4, layer.strokeWidth * 1.5)]);
  }
  ctx.strokeStyle = layer.strokeColor;
  ctx.lineWidth = Math.max(1, layer.strokeWidth);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const toX = (nx: number) => (nx - 0.5) * layer.width;
  const toY = (ny: number) => (ny - 0.5) * layer.height;
  ctx.moveTo(toX(layer.points[0].x), toY(layer.points[0].y));
  for (let i = 1; i < layer.points.length - 1; i++) {
    const mx = (toX(layer.points[i].x) + toX(layer.points[i + 1].x)) / 2;
    const my = (toY(layer.points[i].y) + toY(layer.points[i + 1].y)) / 2;
    ctx.quadraticCurveTo(toX(layer.points[i].x), toY(layer.points[i].y), mx, my);
  }
  const last = layer.points[layer.points.length - 1];
  ctx.lineTo(toX(last.x), toY(last.y));
  ctx.stroke();
  ctx.restore();
}

function renderCanvasOverlays(ctx: CanvasRenderingContext2D, width: number, height: number, overlays?: CanvasOverlayEffects): void {
  if (!overlays) return;

  if (overlays.stripes.enabled && overlays.stripes.opacity > 0) {
    const spacing = Math.max(4, overlays.stripes.spacing);
    const thickness = Math.max(1, Math.min(spacing, overlays.stripes.thickness));
    const diag = Math.hypot(width, height);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, overlays.stripes.opacity / 100));
    ctx.translate(width / 2, height / 2);
    ctx.rotate(((overlays.stripes.angle || 0) * Math.PI) / 180);
    ctx.fillStyle = overlays.stripes.color;
    for (let x = -diag; x < diag; x += spacing) {
      ctx.fillRect(x, -diag, thickness, diag * 2);
    }
    ctx.restore();
  }

  if (overlays.noise.enabled && overlays.noise.amount > 0) {
    const tile = getNoiseTileCanvas(overlays.noise.amount);
    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  if (overlays.vignette.enabled && overlays.vignette.intensity > 0) {
    const cx = width / 2;
    const cy = height / 2;
    const outerR = Math.hypot(cx, cy);
    const innerR = outerR * Math.max(0.05, Math.min(0.95, overlays.vignette.radius / 100));
    const alpha = Math.max(0, Math.min(1, overlays.vignette.intensity / 100));
    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${alpha})`);
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

/**
 * Render the complete image editor composition onto a 2D canvas context.
 * Shared by both live preview and final export so output matches preview.
 */
export function renderImageComposition(
  ctx: CanvasRenderingContext2D,
  state: CompositionRenderState,
): void {
  const { width: outWidth, height: outHeight, background, backgroundFill, baseBitmap, layers } = state;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (background === "transparent" && !backgroundFill) {
    ctx.clearRect(0, 0, outWidth, outHeight);
  } else {
    ctx.fillStyle = resolveCanvasFill(
      ctx,
      backgroundFill ?? undefined,
      background === "transparent" ? "#ffffff" : background,
      0,
      0,
      outWidth,
      outHeight,
    );
    ctx.fillRect(0, 0, outWidth, outHeight);
  }

  if (baseBitmap) {
    const angle = ((Number(state.baseRotation) || 0) * Math.PI) / 180;
    ctx.save();
    ctx.translate(outWidth / 2, outHeight / 2);
    ctx.rotate(angle);
    if (state.baseFlipHorizontal) ctx.scale(-1, 1);
    ctx.filter = `brightness(${clampPercentage(state.baseBrightness)}%) contrast(${clampPercentage(state.baseContrast)}%) saturate(${clampPercentage(state.baseSaturation)}%)`;
    ctx.drawImage(baseBitmap, -outWidth / 2, -outHeight / 2, outWidth, outHeight);
    ctx.restore();
  }

  for (const layer of layers) {
    if (!layer.visible || layer.id === state.hiddenLayerId || layer.width <= 0 || layer.height <= 0) continue;
    const angle = ((Number(layer.rotation) || 0) * Math.PI) / 180;
    const rawOpacity = Number(layer.opacity);
    const alpha = Number.isFinite(rawOpacity) ? Math.max(0, Math.min(1, rawOpacity / 100)) : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
    ctx.rotate(angle);

    if (layer.kind === "image") {
      renderImageLayer(ctx, layer, state);
    } else if (layer.kind === "text") {
      renderTextLayer(ctx, layer);
    } else if (layer.kind === "sticker") {
      renderStickerLayer(ctx, layer);
    } else if (layer.kind === "draw") {
      renderDrawLayer(ctx, layer);
    } else if (layer.kind === "bezier") {
      ctx.save();
      applyShadow(ctx, layer.shadow);
      traceBezierPath(ctx, layer.anchors, layer.width, layer.height, layer.closed);
      if (layer.closed) {
        ctx.fillStyle = resolveCanvasFill(ctx, layer.fillStyle, layer.fill, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
        ctx.fill();
      }
      clearShadow(ctx);
      if (layer.strokeWidth > 0) {
        ctx.strokeStyle = layer.strokeColor;
        ctx.lineWidth = layer.strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      }
      ctx.restore();
    } else {
      renderShapeLayer(ctx, layer);
    }
    ctx.restore();
  }

  renderCanvasOverlays(ctx, outWidth, outHeight, state.overlays);
}

/** Merge multiple layers into a single rasterized PNG File for non-destructive layer flattening. */
export async function rasterizeLayersToPngFile(
  layers: EditorLayer[],
  width: number,
  height: number,
  imageBitmaps: Map<string, ImageBitmap>,
  erasedBitmaps?: Map<string, ImageBitmap>,
  eraserMasks?: Map<string, ImageBitmap>,
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas to merge layers.");
  renderImageComposition(ctx, {
    width,
    height,
    background: "transparent",
    baseBitmap: null,
    baseBrightness: "100",
    baseContrast: "100",
    baseSaturation: "100",
    baseRotation: "0",
    baseFlipHorizontal: false,
    layers,
    imageBitmaps,
    erasedBitmaps,
    eraserMasks,
  });
  const blob = await exportCompositionToBlob(canvas, "png", 1);
  return new File([blob], "merged-layer.png", { type: "image/png" });
}

/** Encode a rendered composition canvas to PNG, JPEG, or WebP Blob. */
export async function exportCompositionToBlob(
  canvas: HTMLCanvasElement,
  format: "png" | "jpeg" | "webp",
  quality: number,
): Promise<Blob> {
  let outputCanvas = canvas;
  if (format === "jpeg") {
    outputCanvas = document.createElement("canvas");
    outputCanvas.width = canvas.width;
    outputCanvas.height = canvas.height;
    const ctx = outputCanvas.getContext("2d");
    if (!ctx) throw new Error("This browser could not prepare the JPEG export.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
    ctx.drawImage(canvas, 0, 0);
  }
  const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
  return new Promise<Blob>((resolve, reject) => {
    outputCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`The ${format.toUpperCase()} image could not be exported.`));
          return;
        }
        resolve(blob);
      },
      mime,
      format === "png" ? undefined : quality,
    );
  });
}
