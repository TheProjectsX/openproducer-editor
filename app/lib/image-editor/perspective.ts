import type { CornerOffsets } from "./types";

export type Point2D = { x: number; y: number };

/** Return true if any corner has a non-negligible perspective offset. */
export function hasNonZeroPerspective(p?: CornerOffsets): boolean {
  if (!p) return false;
  return (
    Math.abs(p.tl.x) > 0.5 ||
    Math.abs(p.tl.y) > 0.5 ||
    Math.abs(p.tr.x) > 0.5 ||
    Math.abs(p.tr.y) > 0.5 ||
    Math.abs(p.br.x) > 0.5 ||
    Math.abs(p.br.y) > 0.5 ||
    Math.abs(p.bl.x) > 0.5 ||
    Math.abs(p.bl.y) > 0.5
  );
}

/**
 * Solve the 3x3 projective homography matrix H mapping source points -> destination points
 * using Gaussian elimination (8x8 linear system with h33 = 1).
 */
export function solveHomographyMatrix(
  src: [Point2D, Point2D, Point2D, Point2D],
  dst: [Point2D, Point2D, Point2D, Point2D],
): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const sx = src[i].x;
    const sy = src[i].y;
    const dx = dst[i].x;
    const dy = dst[i].y;
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
    }
    if (Math.abs(A[pivot][col]) < 1e-9) return null;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];

    const div = A[col][col];
    for (let j = col; j < n; j++) A[col][j] /= div;
    b[col] /= div;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = A[row][col];
      for (let j = col; j < n; j++) A[row][j] -= factor * A[col][j];
      b[row] -= factor * b[col];
    }
  }
  return [...b, 1];
}

/** Apply a 3x3 homography matrix to a 2D point. */
export function applyHomography(H: number[], x: number, y: number): Point2D {
  const w = H[6] * x + H[7] * y + H[8];
  if (Math.abs(w) < 1e-9) return { x, y };
  return {
    x: (H[0] * x + H[1] * y + H[2]) / w,
    y: (H[3] * x + H[4] * y + H[5]) / w,
  };
}

/** Compute the destination quad bounding box and shifted corner coordinates. */
export function getPerspectiveBounds(
  width: number,
  height: number,
  p: CornerOffsets,
): {
  minX: number;
  minY: number;
  outW: number;
  outH: number;
  dst: [Point2D, Point2D, Point2D, Point2D];
} {
  const rawDst: [Point2D, Point2D, Point2D, Point2D] = [
    { x: p.tl.x, y: p.tl.y },
    { x: width + p.tr.x, y: p.tr.y },
    { x: width + p.br.x, y: height + p.br.y },
    { x: p.bl.x, y: height + p.bl.y },
  ];
  const xs = rawDst.map((pt) => pt.x);
  const ys = rawDst.map((pt) => pt.y);
  const minX = Math.floor(Math.min(0, ...xs));
  const minY = Math.floor(Math.min(0, ...ys));
  const maxX = Math.ceil(Math.max(width, ...xs));
  const maxY = Math.ceil(Math.max(height, ...ys));
  return {
    minX,
    minY,
    outW: Math.max(1, maxX - minX),
    outH: Math.max(1, maxY - minY),
    dst: [
      { x: rawDst[0].x - minX, y: rawDst[0].y - minY },
      { x: rawDst[1].x - minX, y: rawDst[1].y - minY },
      { x: rawDst[2].x - minX, y: rawDst[2].y - minY },
      { x: rawDst[3].x - minX, y: rawDst[3].y - minY },
    ],
  };
}

/**
 * Warp a source canvas using CPU inverse homography with bilinear interpolation.
 * Used as a universal fallback when WebGL2 is unavailable.
 */
export function warpCanvasPerspectiveCPU(
  srcCanvas: HTMLCanvasElement,
  p: CornerOffsets,
): { canvas: HTMLCanvasElement; offsetX: number; offsetY: number } {
  const sw = srcCanvas.width;
  const sh = srcCanvas.height;
  const { minX, minY, outW, outH, dst } = getPerspectiveBounds(sw, sh, p);
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;

  const srcCtx = srcCanvas.getContext("2d");
  const outCtx = out.getContext("2d");
  if (!srcCtx || !outCtx) return { canvas: srcCanvas, offsetX: 0, offsetY: 0 };

  const srcQuad: [Point2D, Point2D, Point2D, Point2D] = [
    { x: 0, y: 0 },
    { x: sw, y: 0 },
    { x: sw, y: sh },
    { x: 0, y: sh },
  ];
  const invH = solveHomographyMatrix(dst, srcQuad);
  if (!invH) return { canvas: srcCanvas, offsetX: 0, offsetY: 0 };

  const srcData = srcCtx.getImageData(0, 0, sw, sh).data;
  const dstImg = outCtx.createImageData(outW, outH);
  const dstData = dstImg.data;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const pt = applyHomography(invH, x + 0.5, y + 0.5);
      const sx = pt.x - 0.5;
      const sy = pt.y - 0.5;
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) continue;

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      const outIdx = (y * outW + x) * 4;

      for (let c = 0; c < 4; c++) {
        const top = srcData[i00 + c] * (1 - fx) + srcData[i10 + c] * fx;
        const bot = srcData[i01 + c] * (1 - fx) + srcData[i11 + c] * fx;
        dstData[outIdx + c] = Math.round(top * (1 - fy) + bot * fy);
      }
    }
  }

  outCtx.putImageData(dstImg, 0, 0);
  return { canvas: out, offsetX: minX, offsetY: minY };
}
