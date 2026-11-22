import type { KeyframeEasing, VideoAnimatedEffect, VideoClipKeyframe, VideoClipTransform, VideoTimelineClip } from "./project-store";

const IDENTITY: VideoClipTransform = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };

export function applyKeyframeEasing(t: number, easing: KeyframeEasing = "linear") {
  const clamped = Math.max(0, Math.min(1, t));
  if (easing === "ease-in") return clamped * clamped;
  if (easing === "ease-out") return 1 - (1 - clamped) * (1 - clamped);
  if (easing === "ease-in-out") return clamped < 0.5 ? 2 * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
  return clamped;
}

export function evaluateClipKeyframes(clip: VideoTimelineClip, time: number) {
  const frames = [...(clip.keyframes ?? [])].sort((a, b) => a.time - b.time);
  if (!frames.length) return { transform: clip.transform ?? IDENTITY, volume: clip.volume };
  const rightIndex = frames.findIndex((frame) => frame.time >= time);
  if (rightIndex < 0) return { transform: frames[frames.length - 1].transform, volume: frames[frames.length - 1].volume };
  if (rightIndex === 0 || frames[rightIndex].time === time) return { transform: frames[rightIndex].transform, volume: frames[rightIndex].volume };
  const left = frames[rightIndex - 1]; const right = frames[rightIndex];
  const linearRatio = Math.max(0, Math.min(1, (time - left.time) / (right.time - left.time)));
  const ratio = applyKeyframeEasing(linearRatio, right.easing ?? "linear");
  const interpolate = (a: number, b: number) => a + (b - a) * ratio;
  return {
    transform: {
      x: interpolate(left.transform.x, right.transform.x), y: interpolate(left.transform.y, right.transform.y),
      scale: interpolate(left.transform.scale, right.transform.scale), rotation: interpolate(left.transform.rotation, right.transform.rotation),
      opacity: interpolate(left.transform.opacity, right.transform.opacity),
      ...(left.transform.mirrorX !== undefined || right.transform.mirrorX !== undefined ? { mirrorX: ratio < 0.5 ? Boolean(left.transform.mirrorX) : Boolean(right.transform.mirrorX) } : {}),
      ...(left.transform.mirrorY !== undefined || right.transform.mirrorY !== undefined ? { mirrorY: ratio < 0.5 ? Boolean(left.transform.mirrorY) : Boolean(right.transform.mirrorY) } : {}),
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

export function evaluateClipTransition(clip: VideoTimelineClip, time: number) {
  const duration = Math.max(0, (clip.sourceEnd - clip.sourceStart) / clip.speed);
  const fadeIn = Math.max(0, Math.min(duration, clip.transitions?.fadeIn ?? 0));
  const fadeOut = Math.max(0, Math.min(duration, clip.transitions?.fadeOut ?? 0));
  const fadeInAlpha = fadeIn > 0 ? Math.min(1, Math.max(0, time) / fadeIn) : 1;
  const fadeOutAlpha = fadeOut > 0 ? Math.min(1, (duration - time) / fadeOut) : 1;
  return Math.max(0, Math.min(1, Math.min(fadeInAlpha, fadeOutAlpha)));
}

export function evaluateAnimatedEffect(effect: VideoAnimatedEffect | undefined, time: number, duration: number) {
  const base = {
    offsetX: 0,
    offsetY: 0,
    scaleMultiplier: 1,
    rotationDelta: 0,
    extraBlurPx: 0,
    extraBrightnessPct: 0,
    extraContrastPct: 0,
    extraSepiaPct: 0,
    extraHueDeg: 0,
    vignetteStrength: 0,
    grainStrength: 0,
  };
  if (!effect || effect.kind === "none") return base;
  const intensity = Math.max(0, Math.min(2, Number.isFinite(effect.intensity) ? effect.intensity! : 1));
  const t = Math.max(0, time);
  switch (effect.kind) {
    case "float":
      return {
        ...base,
        offsetX: Math.sin(t * 1.4) * 10 * intensity,
        offsetY: Math.cos(t * 2.1) * 14 * intensity,
        rotationDelta: Math.sin(t * 1.1) * 1.2 * intensity,
      };
    case "pulse":
      return {
        ...base,
        scaleMultiplier: 1 + (0.5 - 0.5 * Math.cos(t * Math.PI * 1.5)) * 0.08 * intensity,
      };
    case "shake":
      return {
        ...base,
        offsetX: (Math.sin(t * 37) + Math.cos(t * 53) * 0.5) * 6 * intensity,
        offsetY: (Math.cos(t * 41) + Math.sin(t * 61) * 0.5) * 6 * intensity,
        rotationDelta: Math.sin(t * 29) * 1.2 * intensity,
      };
    case "blur-in": {
      const span = Math.max(0.25, Math.min(1.2, duration * 0.35));
      const progress = Math.min(1, t / span);
      return { ...base, extraBlurPx: (1 - progress) * 16 * intensity };
    }
    case "flash": {
      const span = Math.max(0.2, Math.min(0.6, duration * 0.25));
      const progress = Math.min(1, t / span);
      return { ...base, extraBrightnessPct: (1 - progress) * 95 * intensity };
    }
    case "color-cycle":
      return { ...base, extraHueDeg: (t * 60 * intensity) % 360 };
    case "vignette":
      return { ...base, vignetteStrength: 0.65 * Math.min(1.4, intensity) };
    case "film-grain":
      return {
        ...base,
        extraContrastPct: 12 * intensity,
        extraSepiaPct: 22 * intensity,
        vignetteStrength: 0.35 * Math.min(1.4, intensity),
        grainStrength: 0.16 * Math.min(1.5, intensity),
      };
    default:
      return base;
  }
}
