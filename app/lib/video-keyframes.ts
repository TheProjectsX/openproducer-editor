import type { VideoClipKeyframe, VideoClipTransform, VideoTimelineClip } from "./project-store";

const IDENTITY: VideoClipTransform = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };

export function evaluateClipKeyframes(clip: VideoTimelineClip, time: number) {
  const frames = [...(clip.keyframes ?? [])].sort((a, b) => a.time - b.time);
  if (!frames.length) return { transform: clip.transform ?? IDENTITY, volume: clip.volume };
  const rightIndex = frames.findIndex((frame) => frame.time >= time);
  if (rightIndex < 0) return { transform: frames[frames.length - 1].transform, volume: frames[frames.length - 1].volume };
  if (rightIndex === 0 || frames[rightIndex].time === time) return { transform: frames[rightIndex].transform, volume: frames[rightIndex].volume };
  const left = frames[rightIndex - 1]; const right = frames[rightIndex];
  const ratio = Math.max(0, Math.min(1, (time - left.time) / (right.time - left.time)));
  const interpolate = (a: number, b: number) => a + (b - a) * ratio;
  return {
    transform: {
      x: interpolate(left.transform.x, right.transform.x), y: interpolate(left.transform.y, right.transform.y),
      scale: interpolate(left.transform.scale, right.transform.scale), rotation: interpolate(left.transform.rotation, right.transform.rotation),
      opacity: interpolate(left.transform.opacity, right.transform.opacity),
    },
    volume: interpolate(left.volume, right.volume),
  };
}

export function upsertClipKeyframe(clip: VideoTimelineClip, frame: VideoClipKeyframe) {
  const frames = clip.keyframes ?? [];
  const exact = frames.findIndex((item) => Math.abs(item.time - frame.time) < 0.001);
  const next = exact < 0 ? [...frames, frame] : frames.map((item, index) => index === exact ? frame : item);
  return next.sort((a, b) => a.time - b.time);
}
