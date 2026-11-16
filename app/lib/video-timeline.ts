const TIMELINE_TRACK_LABEL_WIDTH = 104;

export function timelineTimeAtPointer(
  clientX: number,
  contentLeft: number,
  scrollLeft: number,
  pixelsPerSecond: number,
  leadingOffset = 0,
) {
  if (!Number.isFinite(pixelsPerSecond) || pixelsPerSecond <= 0) return 0;
  const contentX = clientX - contentLeft + scrollLeft - leadingOffset;
  return Math.max(0, contentX / pixelsPerSecond);
}

export function timelineRulerOffset() {
  return TIMELINE_TRACK_LABEL_WIDTH;
}

export function timelineDropStart(pointerTime: number, grabOffsetPx: number, pixelsPerSecond: number) {
  if (!Number.isFinite(pixelsPerSecond) || pixelsPerSecond <= 0) return Math.max(0, pointerTime);
  const offset = Number.isFinite(grabOffsetPx) ? Math.max(0, grabOffsetPx) / pixelsPerSecond : 0;
  return Math.max(0, pointerTime - offset);
}
