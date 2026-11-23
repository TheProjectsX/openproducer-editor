import type { BezierAnchor, FillStyle, ShapeLayer } from "./types";

/** Resolve a FillStyle or fallback hex color into a CanvasStyle for the given bounding box. */
export function resolveCanvasFill(
  ctx: CanvasRenderingContext2D,
  fillStyle: FillStyle | undefined,
  fallbackColor: string,
  x: number,
  y: number,
  width: number,
  height: number,
): string | CanvasGradient {
  if (!fillStyle || fillStyle.kind === "solid") {
    return fillStyle?.color ?? fallbackColor;
  }
  if (fillStyle.kind === "linear") {
    const rad = ((fillStyle.angle || 0) * Math.PI) / 180;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const halfDiag = Math.hypot(width, height) / 2;
    const dx = Math.cos(rad) * halfDiag;
    const dy = Math.sin(rad) * halfDiag;
    const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    grad.addColorStop(0, fillStyle.from);
    grad.addColorStop(1, fillStyle.to);
    return grad;
  }
  const cx = x + width / 2;
  const cy = y + height / 2;
  const r = Math.max(1, Math.max(width, height) / 2);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, fillStyle.inner);
  grad.addColorStop(1, fillStyle.outer);
  return grad;
}

/** Trace a vector shape path centered at (0, 0) for the given ShapeLayer. */
export function traceShapePath(ctx: CanvasRenderingContext2D, layer: ShapeLayer): void {
  const hw = layer.width / 2;
  const hh = layer.height / 2;
  ctx.beginPath();

  if (layer.kind === "rectangle") {
    ctx.rect(-hw, -hh, layer.width, layer.height);
    return;
  }
  if (layer.kind === "rounded-rect") {
    const r = Math.max(0, Math.min(Math.min(hw, hh), layer.cornerRadius ?? 20));
    ctx.roundRect(-hw, -hh, layer.width, layer.height, r);
    return;
  }
  if (layer.kind === "ellipse") {
    ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
    return;
  }
  if (layer.kind === "polygon") {
    const sides = Math.max(3, Math.min(24, Math.round(layer.sides ?? 6)));
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * hw;
      const py = Math.sin(a) * hh;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    return;
  }
  if (layer.kind === "star") {
    const points = Math.max(3, Math.min(24, Math.round(layer.sides ?? 5)));
    const innerRatio = Math.max(0.15, Math.min(0.9, layer.innerRadiusRatio ?? 0.45));
    const total = points * 2;
    for (let i = 0; i < total; i++) {
      const a = (i / total) * Math.PI * 2 - Math.PI / 2;
      const rScale = i % 2 === 0 ? 1 : innerRatio;
      const px = Math.cos(a) * hw * rScale;
      const py = Math.sin(a) * hh * rScale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    return;
  }
  if (layer.kind === "arrow") {
    const headW = Math.min(layer.width * 0.65, Math.max(16, layer.width * 0.35));
    const shaftHalfH = hh * 0.36;
    const bodyRight = hw - headW;
    ctx.moveTo(-hw, -shaftHalfH);
    ctx.lineTo(bodyRight, -shaftHalfH);
    ctx.lineTo(bodyRight, -hh);
    ctx.lineTo(hw, 0);
    ctx.lineTo(bodyRight, hh);
    ctx.lineTo(bodyRight, shaftHalfH);
    ctx.lineTo(-hw, shaftHalfH);
    ctx.closePath();
    return;
  }
  // speech-bubble
  const tailH = Math.min(hh * 0.45, Math.max(12, layer.height * 0.22));
  const boxH = layer.height - tailH;
  const r = Math.max(0, Math.min(Math.min(hw, boxH / 2), layer.cornerRadius ?? 18));
  const top = -hh;
  const bottom = -hh + boxH;
  ctx.moveTo(-hw + r, top);
  ctx.lineTo(hw - r, top);
  ctx.quadraticCurveTo(hw, top, hw, top + r);
  ctx.lineTo(hw, bottom - r);
  ctx.quadraticCurveTo(hw, bottom, hw - r, bottom);
  ctx.lineTo(-hw * 0.25, bottom);
  ctx.lineTo(-hw * 0.48, hh);
  ctx.lineTo(-hw * 0.45, bottom);
  ctx.lineTo(-hw + r, bottom);
  ctx.quadraticCurveTo(-hw, bottom, -hw, bottom - r);
  ctx.lineTo(-hw, top + r);
  ctx.quadraticCurveTo(-hw, top, -hw + r, top);
  ctx.closePath();
}

/** Trace a cubic Bezier path from normalized (0..1) anchors centered at (0, 0). */
export function traceBezierPath(
  ctx: CanvasRenderingContext2D,
  anchors: BezierAnchor[],
  width: number,
  height: number,
  closed: boolean,
): void {
  if (!anchors.length) return;
  const toX = (nx: number) => (nx - 0.5) * width;
  const toY = (ny: number) => (ny - 0.5) * height;
  ctx.beginPath();
  ctx.moveTo(toX(anchors[0].x), toY(anchors[0].y));
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1];
    const curr = anchors[i];
    ctx.bezierCurveTo(
      toX(prev.cp2x),
      toY(prev.cp2y),
      toX(curr.cp1x),
      toY(curr.cp1y),
      toX(curr.x),
      toY(curr.y),
    );
  }
  if (closed && anchors.length > 2) {
    const last = anchors[anchors.length - 1];
    const first = anchors[0];
    ctx.bezierCurveTo(
      toX(last.cp2x),
      toY(last.cp2y),
      toX(first.cp1x),
      toY(first.cp1y),
      toX(first.x),
      toY(first.y),
    );
    ctx.closePath();
  }
}
