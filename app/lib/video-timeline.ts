const TIMELINE_TRACK_LABEL_WIDTH = 104;
const CANVAS_LONG_SIDE = 1920;

export function canPlaceAssetOnTrack(kind: "audio" | "video" | "image" | "text", track: number) {
  return Number.isInteger(track) && (kind === "audio" ? track < 0 : kind === "text" ? track > 0 : track >= 0);
}

export function visibleTimelineTracks(clips: readonly { track: number }[], dragKind: "visual" | "audio" | null = null) {
  const highestOverlay = Math.max(0, ...clips.map((clip) => clip.track));
  const lowestAudio = Math.max(0, ...clips.map((clip) => -clip.track));
  const overlayCount = highestOverlay + (dragKind === "visual" ? 1 : 0);
  const audioCount = lowestAudio;
  return [
    ...Array.from({ length: overlayCount }, (_, index) => overlayCount - index),
    0,
    ...Array.from({ length: audioCount }, (_, index) => -(index + 1)),
  ];
}

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

export function timelineContentWidth(duration: number, pixelsPerSecond: number, viewportWidth: number) {
  return TIMELINE_TRACK_LABEL_WIDTH + Math.max(800, Math.max(0, duration) * pixelsPerSecond + Math.max(0, viewportWidth));
}

export function timelineZoomScrollLeft(timeAtPointer: number, pointerX: number, pixelsPerSecond: number) {
  return Math.max(0, TIMELINE_TRACK_LABEL_WIDTH + timeAtPointer * pixelsPerSecond - pointerX);
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

export type BatchAsset = { id: string; kind: "audio" | "video" | "image" | "text"; duration: number };

/** Keep visible order within each lane while audio and visuals begin together. */
export function planMediaBatchPlacement(
  assets: readonly BatchAsset[], targetTrack: number, desiredStart: number,
  existing: readonly (TimelinePlacementClip & { track: number })[], tolerance: number, magnetic: boolean,
) {
  if (!assets.length || assets.some((asset) => asset.kind === "text" || !Number.isFinite(asset.duration) || asset.duration <= 0)) return null;
  if (!canPlaceAssetOnTrack(assets[0].kind, targetTrack)) return null;
  const visualTrack = targetTrack >= 0 ? targetTrack : 0;
  const audioTrack = targetTrack < 0 ? targetTrack : -1;
  const visualDuration = assets.filter((asset) => asset.kind !== "audio").reduce((total, asset) => total + (asset.kind === "image" ? 5 : asset.duration), 0);
  const audioDuration = assets.filter((asset) => asset.kind === "audio").reduce((total, asset) => total + asset.duration, 0);
  const duration = Math.max(visualDuration, audioDuration);
  const targetDuration = targetTrack < 0 ? audioDuration : visualDuration;
  const primary = resolveTimelinePlacement(desiredStart, targetDuration, existing.filter((clip) => clip.track === targetTrack), tolerance, magnetic);
  const shiftedStarts = { ...primary.shiftedStarts };
  const usedTracks = new Set(assets.map((asset) => asset.kind === "audio" ? audioTrack : visualTrack));
  for (const track of usedTracks) {
    if (track === targetTrack) continue;
    let cursor = primary.start + (track < 0 ? audioDuration : visualDuration);
    for (const clip of existing.filter((item) => item.track === track).sort((a, b) => a.start - b.start)) {
      if (clip.end <= primary.start) continue;
      if (clip.start < cursor) { shiftedStarts[clip.id] = cursor; cursor += clip.end - clip.start; }
      else cursor = clip.end;
    }
  }
  let nextVisualStart = primary.start;
  let nextAudioStart = primary.start;
  const placements = assets.map((asset) => {
    const clipDuration = asset.kind === "image" ? 5 : asset.duration;
    const isAudio = asset.kind === "audio";
    const placement = { assetId: asset.id, track: isAudio ? audioTrack : visualTrack, start: isAudio ? nextAudioStart : nextVisualStart, duration: clipDuration };
    if (isAudio) nextAudioStart += clipDuration;
    else nextVisualStart += clipDuration;
    return placement;
  });
  return { start: primary.start, duration, placements, shiftedStarts };
}

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

export function resolveMarqueeSelection(selectedAtStart: string[], hitIds: string[], additive: boolean): string[] {
  return additive ? [...new Set([...selectedAtStart, ...hitIds])] : hitIds;
}
