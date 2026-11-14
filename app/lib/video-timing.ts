import type { VideoTimelineClip } from "./project-store";

export function getClipLength(clip: VideoTimelineClip) {
  const sourceLength = clip.sourceEnd - clip.sourceStart;
  if (!Number.isFinite(sourceLength) || sourceLength <= 0 || !Number.isFinite(clip.speed) || clip.speed <= 0) return 0;
  return sourceLength / clip.speed;
}
