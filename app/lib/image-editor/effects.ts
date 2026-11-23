/** Parse a hex color string (#rrggbb) into RGB bytes. */
export function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0,
    };
  }
  const full = clean.padEnd(6, "0");
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

/**
 * Remove pixels matching `targetHex` within Euclidean RGB distance `tolerance`
 * with smooth `feather` falloff. Mutates `data` in place.
 */
export function applyEraseColorToPixels(
  data: Uint8ClampedArray,
  targetHex: string,
  tolerance: number,
  feather: number,
): void {
  const { r: tr, g: tg, b: tb } = parseHexRgb(targetHex);
  const tol = Math.max(0, tolerance);
  const smooth = Math.max(1, feather);
  const maxDist = tol + smooth;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const dr = data[i] - tr;
    const dg = data[i + 1] - tg;
    const db = data[i + 2] - tb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist <= tol) {
      data[i + 3] = 0;
    } else if (dist < maxDist) {
      const factor = (dist - tol) / smooth;
      data[i + 3] = Math.round(data[i + 3] * factor);
    }
  }
}

/** Apply a directional relief emboss filter to an offscreen canvas. */
export function applyEmbossToCanvas(
  srcCanvas: HTMLCanvasElement,
  angleDeg: number,
  intensity: number,
): HTMLCanvasElement {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const sCtx = srcCanvas.getContext("2d");
  const oCtx = out.getContext("2d");
  if (!sCtx || !oCtx) return srcCanvas;

  const srcImg = sCtx.getImageData(0, 0, w, h);
  const outImg = oCtx.createImageData(w, h);
  const s = srcImg.data;
  const d = outImg.data;
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.round(Math.cos(rad));
  const dy = Math.round(Math.sin(rad));
  const strength = Math.max(0, Math.min(3, intensity / 50));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const alpha = s[i + 3];
      if (alpha === 0) continue;
      const nx = Math.max(0, Math.min(w - 1, x - dx));
      const ny = Math.max(0, Math.min(h - 1, y - dy));
      const ni = (ny * w + nx) * 4;
      const diff = ((s[i] - s[ni]) * 0.299 + (s[i + 1] - s[ni + 1]) * 0.587 + (s[i + 2] - s[ni + 2]) * 0.114) * strength;
      d[i] = Math.max(0, Math.min(255, Math.round(s[i] + diff)));
      d[i + 1] = Math.max(0, Math.min(255, Math.round(s[i + 1] + diff)));
      d[i + 2] = Math.max(0, Math.min(255, Math.round(s[i + 2] + diff)));
      d[i + 3] = alpha;
    }
  }
  oCtx.putImageData(outImg, 0, 0);
  return out;
}

/** Tint an offscreen canvas with a solid color while preserving alpha. */
export function applyColorizeToCanvas(
  srcCanvas: HTMLCanvasElement,
  color: string,
  strength: number,
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = srcCanvas.width;
  out.height = srcCanvas.height;
  const ctx = out.getContext("2d");
  if (!ctx) return srcCanvas;
  ctx.drawImage(srcCanvas, 0, 0);
  const alpha = Math.max(0, Math.min(1, strength / 100));
  if (alpha <= 0) return out;
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.restore();
  return out;
}

let cachedNoiseTile: { amount: number; canvas: HTMLCanvasElement } | null = null;

/** Generate a repeatable 256x256 film-grain noise tile. */
export function getNoiseTileCanvas(amount: number): HTMLCanvasElement {
  const clamped = Math.max(1, Math.min(100, Math.round(amount)));
  if (cachedNoiseTile && cachedNoiseTile.amount === clamped) {
    return cachedNoiseTile.canvas;
  }
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    const alpha = Math.round((clamped / 100) * 140);
    // Deterministic LCG so preview and export match.
    let seed = 1337;
    for (let i = 0; i < data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const v = seed & 0xff;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = alpha;
    }
    ctx.putImageData(img, 0, 0);
  }
  cachedNoiseTile = { amount: clamped, canvas };
  return canvas;
}
