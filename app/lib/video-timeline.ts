const TIMELINE_TRACK_LABEL_WIDTH = 104;
const CANVAS_LONG_SIDE = 1920;

export function canvasDimensionsForAspect(ratio: number) {
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  const even = (value: number) => Math.max(16, Math.round(value / 2) * 2);
  return ratio >= 1
    ? { width: CANVAS_LONG_SIDE, height: even(CANVAS_LONG_SIDE / ratio) }
    : { width: even(CANVAS_LONG_SIDE * ratio), height: CANVAS_LONG_SIDE };
}

export function zoomPixelsPerSecond(current: number, wheelDelta: number) {
  const scale = wheelDelta < 0 ? 1.12 : 1 / 1.12;
  return Math.max(12, Math.min(160, Math.round(current * scale)));
}

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

export type TimelinePlacementClip = { id: string; start: number; end: number };

/** Magnetically place a clip in a lane, opening only the space needed at the insertion point. */
export function resolveTimelinePlacement(
  desiredStart: number,
  duration: number,
  existing: TimelinePlacementClip[],
  tolerance: number,
  magnetic: boolean,
) {
  const rawStart = Math.max(0, Number.isFinite(desiredStart) ? desiredStart : 0);
  if (!Number.isFinite(duration) || duration <= 0) return { start: rawStart, shiftedStarts: {} as Record<string, number> };
  const clips = [...existing].sort((a, b) => a.start - b.start || a.end - b.end);
  const threshold = Math.max(0, Number.isFinite(tolerance) ? tolerance : 0);
  const anchors = [0, ...clips.flatMap((clip) => [clip.end, Math.max(0, clip.start - duration)])];
  const closest = anchors.reduce((best, anchor) => Math.abs(anchor - rawStart) < Math.abs(best - rawStart) ? anchor : best, anchors[0]);
  let start = magnetic && Math.abs(closest - rawStart) <= threshold ? closest : rawStart;
  const collision = clips.find((clip) => start < clip.end - 0.0001 && start + duration > clip.start + 0.0001);
  if (collision) {
    // Hovering over the first half inserts before; over the second half inserts after.
    start = start < (collision.start + collision.end) / 2 ? collision.start : collision.end;
  }
  const shiftedStarts: Record<string, number> = {};
  let cursor = start + duration;
  for (const clip of clips) {
    if (clip.start < start - 0.0001) continue;
    if (clip.start < cursor - 0.0001) {
      shiftedStarts[clip.id] = cursor;
      cursor += clip.end - clip.start;
    } else cursor = clip.end;
  }
  return { start, shiftedStarts };
}
