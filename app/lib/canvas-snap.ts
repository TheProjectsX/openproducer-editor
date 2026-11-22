export type SnapRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SnapResult = {
  x: number;
  y: number;
  guideX: number | null;
  guideY: number | null;
};

/**
 * Snaps a moving rectangle to canvas edges, canvas center, and other layer edges/centers.
 */
export function snapLayerMove(
  rect: SnapRect,
  canvasWidth: number,
  canvasHeight: number,
  otherRects: SnapRect[] = [],
): SnapResult {
  const threshold = Math.max(8, Math.round(Math.min(canvasWidth, canvasHeight) * 0.015));

  const xTargets = [0, canvasWidth / 2, canvasWidth];
  const yTargets = [0, canvasHeight / 2, canvasHeight];
  for (const other of otherRects) {
    xTargets.push(other.x, other.x + other.width / 2, other.x + other.width);
    yTargets.push(other.y, other.y + other.height / 2, other.y + other.height);
  }

  let nextX = rect.x;
  let guideX: number | null = null;
  let bestDx = threshold + 1;
  const xAnchors = [
    { pos: rect.x, apply: (t: number) => t },
    { pos: rect.x + rect.width / 2, apply: (t: number) => t - rect.width / 2 },
    { pos: rect.x + rect.width, apply: (t: number) => t - rect.width },
  ];
  for (const anchor of xAnchors) {
    for (const target of xTargets) {
      const dist = Math.abs(anchor.pos - target);
      if (dist < bestDx) {
        bestDx = dist;
        nextX = Math.round(anchor.apply(target));
        guideX = target;
      }
    }
  }

  let nextY = rect.y;
  let guideY: number | null = null;
  let bestDy = threshold + 1;
  const yAnchors = [
    { pos: rect.y, apply: (t: number) => t },
    { pos: rect.y + rect.height / 2, apply: (t: number) => t - rect.height / 2 },
    { pos: rect.y + rect.height, apply: (t: number) => t - rect.height },
  ];
  for (const anchor of yAnchors) {
    for (const target of yTargets) {
      const dist = Math.abs(anchor.pos - target);
      if (dist < bestDy) {
        bestDy = dist;
        nextY = Math.round(anchor.apply(target));
        guideY = target;
      }
    }
  }

  return { x: nextX, y: nextY, guideX, guideY };
}

/**
 * Snaps a single edge coordinate (e.g., while corner-resizing a layer) to canvas or sibling edges.
 */
export function snapAxisCoordinate(
  value: number,
  canvasSize: number,
  otherEdges: number[] = [],
): { value: number; guide: number | null } {
  const threshold = Math.max(8, Math.round(canvasSize * 0.015));
  const targets = [0, canvasSize / 2, canvasSize, ...otherEdges];
  let best = threshold + 1;
  let snapped = value;
  let guide: number | null = null;
  for (const target of targets) {
    const dist = Math.abs(value - target);
    if (dist < best) {
      best = dist;
      snapped = Math.round(target);
      guide = target;
    }
  }
  return { value: snapped, guide };
}
