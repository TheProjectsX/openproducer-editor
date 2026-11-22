import type { VideoTimelineClip, VideoTimelineProject } from "../../lib/project-store";
import { getClipLength } from "../../lib/video-composition";
import { evaluateClipKeyframes, upsertClipKeyframe } from "../../lib/video-keyframes";

export const clipLength = getClipLength;

export function formatTimecode(seconds: number, fps: number) {
  const frameRate = Math.max(1, Math.round(fps));
  const totalFrames = Math.max(0, Math.floor(seconds * frameRate));
  const hours = Math.floor(totalFrames / (frameRate * 3600));
  const minutes = Math.floor(totalFrames / (frameRate * 60)) % 60;
  const wholeSeconds = Math.floor(totalFrames / frameRate) % 60;
  const frames = totalFrames % frameRate;
  return [hours, minutes, wholeSeconds, frames].map((value) => String(value).padStart(2, "0")).join(":");
}

export function formatAssetDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const remainingSeconds = totalSeconds % 60;
  return (hours ? [hours, minutes, remainingSeconds] : [minutes, remainingSeconds]).map((value) => String(value).padStart(2, "0")).join(":");
}

export function updateClipTimeline(
  current: VideoTimelineProject,
  id: string,
  patch: Partial<VideoTimelineClip>,
  playhead: number,
  ripplePrimaryTrack: boolean
) {
  const clips = current.clips.map((clip) => {
    if (clip.id !== id) return clip;
    const updated = { ...clip, ...patch };
    if (clip.keyframes?.length && (patch.transform || patch.volume !== undefined)) {
      const time = Math.max(0, Math.min(clipLength(clip), playhead - clip.start));
      const values = evaluateClipKeyframes(clip, time);
      updated.keyframes = upsertClipKeyframe(clip, {
        time,
        transform: patch.transform ?? values.transform,
        volume: patch.volume ?? values.volume,
      });
    }
    return updated;
  });
  const previous = current.clips.find((clip) => clip.id === id);
  const changed = clips.find((clip) => clip.id === id);
  const timingEdit = patch.sourceStart !== undefined || patch.sourceEnd !== undefined || patch.speed !== undefined;
  const endDelta = previous && changed ? changed.start + clipLength(changed) - (previous.start + clipLength(previous)) : 0;
  const rippled =
    timingEdit && ripplePrimaryTrack && previous?.track === 0 && Math.abs(endDelta) > 0.0001
      ? clips.map((clip) =>
          clip.id !== id && clip.track === 0 && clip.start > previous.start + 0.001
            ? { ...clip, start: Math.max(0, clip.start + endDelta) }
            : clip
        )
      : clips;
  return { ...current, clips: rippled, duration: Math.max(0, ...rippled.map((clip) => clip.start + clipLength(clip))) };
}
