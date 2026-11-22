import type {
  KeyframeEasing,
  VideoAnimatedEffectKind,
  VideoAspectRatioMode,
  VideoClipKeyframe,
  VideoTimelineAsset,
  VideoTimelineClip,
  VideoTimelineProject,
  VideoTransitionType,
} from "./project-store";

export type MotionPresetId =
  | "none"
  | "ken-burns-in"
  | "ken-burns-out"
  | "pan-left"
  | "pan-right"
  | "pan-up"
  | "pan-down"
  | "rotate-cw"
  | "fade-in-out";

export const MOTION_PRESETS: Array<{ id: MotionPresetId; label: string; description: string }> = [
  { id: "none", label: "Static", description: "No motion; hold image still" },
  { id: "ken-burns-in", label: "Zoom in", description: "Slowly zoom in from 1.0× to 1.18×" },
  { id: "ken-burns-out", label: "Zoom out", description: "Slowly zoom out from 1.18× to 1.0×" },
  { id: "pan-left", label: "Pan left", description: "Zoom slightly and pan across to the left" },
  { id: "pan-right", label: "Pan right", description: "Zoom slightly and pan across to the right" },
  { id: "pan-up", label: "Pan up", description: "Zoom slightly and pan upward" },
  { id: "pan-down", label: "Pan down", description: "Zoom slightly and pan downward" },
  { id: "rotate-cw", label: "Gentle tilt", description: "Subtle zoom with a 4° clockwise tilt" },
  { id: "fade-in-out", label: "Pulse fade", description: "Fade in smoothly and zoom gently" },
];

export const ANIMATED_EFFECTS: Array<{ id: VideoAnimatedEffectKind; label: string }> = [
  { id: "none", label: "None" },
  { id: "float", label: "Gentle float" },
  { id: "pulse", label: "Breathing pulse" },
  { id: "shake", label: "Handheld shake" },
  { id: "blur-in", label: "Focus blur in" },
  { id: "flash", label: "Light flash" },
  { id: "color-cycle", label: "Color cycle" },
  { id: "vignette", label: "Cinema vignette" },
  { id: "film-grain", label: "Retro film grain" },
];

export type ImageSlideItem = {
  id: string;
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  duration: number;
  preset: MotionPresetId;
  effectAnimation?: VideoAnimatedEffectKind;
  effectIntensity?: number;
  transitionType: VideoTransitionType | "none";
  transitionDuration: number;
  keyframes: VideoClipKeyframe[];
};

export type ImageToVideoAudioConfig = {
  id: string;
  name: string;
  type: string;
  size: number;
  duration: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  loop: boolean;
};

export type DurationMode = "total" | "per-slide";

const DEFAULT_TRANSFORM = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };

export function buildPresetKeyframes(
  preset: MotionPresetId,
  duration: number,
  canvasWidth: number,
  canvasHeight: number,
  easing: KeyframeEasing = "ease-in-out",
): VideoClipKeyframe[] {
  const safeDuration = Math.max(0.1, Number.isFinite(duration) ? duration : 3);
  const shiftX = Math.round(Math.max(24, canvasWidth * 0.06));
  const shiftY = Math.round(Math.max(24, canvasHeight * 0.06));

  const frame = (time: number, overrides: Partial<typeof DEFAULT_TRANSFORM>, frameEasing: KeyframeEasing = easing): VideoClipKeyframe => ({
    time,
    transform: { ...DEFAULT_TRANSFORM, ...overrides },
    volume: 1,
    easing: frameEasing,
  });

  switch (preset) {
    case "ken-burns-in":
      return [frame(0, { scale: 1 }, "linear"), frame(safeDuration, { scale: 1.18 })];
    case "ken-burns-out":
      return [frame(0, { scale: 1.18 }, "linear"), frame(safeDuration, { scale: 1 })];
    case "pan-left":
      return [frame(0, { x: shiftX, scale: 1.14 }, "linear"), frame(safeDuration, { x: -shiftX, scale: 1.14 })];
    case "pan-right":
      return [frame(0, { x: -shiftX, scale: 1.14 }, "linear"), frame(safeDuration, { x: shiftX, scale: 1.14 })];
    case "pan-up":
      return [frame(0, { y: shiftY, scale: 1.14 }, "linear"), frame(safeDuration, { y: -shiftY, scale: 1.14 })];
    case "pan-down":
      return [frame(0, { y: -shiftY, scale: 1.14 }, "linear"), frame(safeDuration, { y: shiftY, scale: 1.14 })];
    case "rotate-cw":
      return [frame(0, { scale: 1.04, rotation: -2 }, "linear"), frame(safeDuration, { scale: 1.14, rotation: 2 })];
    case "fade-in-out":
      return [
        frame(0, { scale: 1, opacity: 0 }, "linear"),
        frame(Math.min(0.6, safeDuration * 0.25), { scale: 1.04, opacity: 1 }, "ease-out"),
        frame(safeDuration, { scale: 1.1, opacity: 1 }, "linear"),
      ];
    case "none":
    default:
      return [frame(0, {}, "linear"), frame(safeDuration, {}, "linear")];
  }
}

export function scaleSlideKeyframes(keyframes: VideoClipKeyframe[], oldDuration: number, newDuration: number): VideoClipKeyframe[] {
  const safeNew = Math.max(0.1, Number.isFinite(newDuration) ? newDuration : 3);
  if (!keyframes.length) return buildPresetKeyframes("none", safeNew, 1280, 720);
  const safeOld = Math.max(0.1, Number.isFinite(oldDuration) ? oldDuration : safeNew);
  const factor = safeNew / safeOld;
  return keyframes
    .map((kf) => ({ ...kf, time: Number(Math.max(0, Math.min(safeNew, kf.time * factor)).toFixed(3)) }))
    .sort((a, b) => a.time - b.time);
}

export function syncSlideDurations(slides: ImageSlideItem[], mode: DurationMode, totalDuration: number): ImageSlideItem[] {
  if (!slides.length) return slides;
  if (mode === "per-slide") return slides;
  const clampedTotal = Math.max(0.5, Math.min(120, Number.isFinite(totalDuration) ? totalDuration : 10));
  const currentTotal = slides.reduce((sum, slide) => sum + Math.max(0.1, slide.duration), 0);
  if (currentTotal <= 0) {
    const each = Number((clampedTotal / slides.length).toFixed(3));
    return slides.map((slide) => ({
      ...slide,
      duration: each,
      keyframes: scaleSlideKeyframes(slide.keyframes, slide.duration, each),
    }));
  }
  const factor = clampedTotal / currentTotal;
  let running = 0;
  return slides.map((slide, index) => {
    const nextDuration = index === slides.length - 1
      ? Number(Math.max(0.1, clampedTotal - running).toFixed(3))
      : Number(Math.max(0.1, slide.duration * factor).toFixed(3));
    running += nextDuration;
    return {
      ...slide,
      duration: nextDuration,
      keyframes: scaleSlideKeyframes(slide.keyframes, slide.duration, nextDuration),
    };
  });
}

const ASPECT_RATIO_PRESETS: Record<Exclude<VideoAspectRatioMode, "original" | "custom">, [number, number]> = {
  "16:9": [1280, 720],
  "9:16": [720, 1280],
  "1:1": [1080, 1080],
  "4:3": [1200, 900],
  "3:4": [900, 1200],
  "2.35:1": [1410, 600],
  "2:1": [1280, 640],
  "1.85:1": [1332, 720],
};

export function resolveCanvasDimensions(
  mode: VideoAspectRatioMode,
  customWidth: number,
  customHeight: number,
  firstImageWidth = 1280,
  firstImageHeight = 720,
) {
  if (mode === "custom") {
    return {
      width: Math.max(16, Math.min(7680, Math.round(Number.isFinite(customWidth) ? customWidth : 1280))),
      height: Math.max(16, Math.min(4320, Math.round(Number.isFinite(customHeight) ? customHeight : 720))),
    };
  }
  if (mode === "original") {
    const w = Math.max(16, Math.round(firstImageWidth || 1280));
    const h = Math.max(16, Math.round(firstImageHeight || 720));
    const scale = w * h > 4_000_000 ? Math.sqrt(4_000_000 / (w * h)) : 1;
    // Keep even pixel dimensions for H.264/AVC compatibility
    const even = (v: number) => Math.max(16, Math.floor((v * scale) / 2) * 2);
    return { width: even(w), height: even(h) };
  }
  const [presetW, presetH] = ASPECT_RATIO_PRESETS[mode] ?? [1280, 720];
  return { width: presetW, height: presetH };
}

export function buildImageToVideoTimeline(params: {
  slides: ImageSlideItem[];
  width: number;
  height: number;
  aspectRatioMode: VideoAspectRatioMode;
  backgroundColor: string;
  fps: number;
  playhead: number;
  audio: ImageToVideoAudioConfig | null;
}): { timeline: VideoTimelineProject; assets: VideoTimelineAsset[] } {
  const assets: VideoTimelineAsset[] = params.slides.map((slide) => ({
    id: slide.id,
    name: slide.name,
    type: slide.type,
    size: slide.size,
    duration: slide.duration,
    kind: "image",
    width: slide.width,
    height: slide.height,
  }));

  let cursor = 0;
  const clips: VideoTimelineClip[] = params.slides.map((slide) => {
    const dur = Math.max(0.1, Number.isFinite(slide.duration) ? slide.duration : 3);
    const transDur = slide.transitionType === "none" ? 0 : Math.max(0, Math.min(dur * 0.5, slide.transitionDuration));
    const clip: VideoTimelineClip = {
      id: `clip-${slide.id}`,
      assetId: slide.id,
      track: 0,
      start: Number(cursor.toFixed(4)),
      sourceStart: 0,
      sourceEnd: dur,
      speed: 1,
      volume: 1,
      muted: false,
      keyframes: slide.keyframes.length ? slide.keyframes : buildPresetKeyframes(slide.preset, dur, params.width, params.height),
      animatedEffect: slide.effectAnimation && slide.effectAnimation !== "none"
        ? { kind: slide.effectAnimation, intensity: slide.effectIntensity ?? 1 }
        : undefined,
      transitions: transDur > 0 && slide.transitionType !== "none"
        ? { fadeIn: transDur, fadeOut: 0, inType: slide.transitionType }
        : undefined,
    };
    cursor += dur;
    return clip;
  });

  const totalDuration = Number(cursor.toFixed(4));

  if (params.audio && params.audio.duration > 0 && totalDuration > 0) {
    assets.push({
      id: params.audio.id,
      name: params.audio.name,
      type: params.audio.type,
      size: params.audio.size,
      duration: params.audio.duration,
      kind: "audio",
      hasAudio: true,
    });
    const audioLen = params.audio.duration;
    const maxLoops = params.audio.loop ? Math.ceil(totalDuration / Math.max(0.1, audioLen)) : 1;
    let audioCursor = 0;
    for (let index = 0; index < maxLoops && audioCursor < totalDuration; index++) {
      const remaining = totalDuration - audioCursor;
      const segDur = Math.min(audioLen, remaining);
      const isFirst = index === 0;
      const isLast = audioCursor + segDur >= totalDuration - 0.001;
      clips.push({
        id: `audio-clip-${index}`,
        assetId: params.audio.id,
        track: -1,
        start: Number(audioCursor.toFixed(4)),
        sourceStart: 0,
        sourceEnd: Number(segDur.toFixed(4)),
        speed: 1,
        volume: Math.max(0, Math.min(4, params.audio.volume)),
        muted: false,
        transitions: {
          fadeIn: isFirst ? Math.max(0, Math.min(segDur, params.audio.fadeIn)) : 0,
          fadeOut: isLast ? Math.max(0, Math.min(segDur, params.audio.fadeOut)) : 0,
        },
      });
      audioCursor += segDur;
    }
  }

  return {
    assets,
    timeline: {
      version: 1,
      width: params.width,
      height: params.height,
      aspectRatioMode: params.aspectRatioMode,
      backgroundColor: params.backgroundColor,
      fps: params.fps,
      duration: totalDuration,
      playhead: Math.max(0, Math.min(totalDuration, params.playhead)),
      assets,
      clips,
    },
  };
}

export type SnapGuideX = "center" | "left" | "right" | null;
export type SnapGuideY = "center" | "top" | "bottom" | null;

export function snapImageOffsetToCanvas(params: {
  x: number;
  y: number;
  imageWidth: number;
  imageHeight: number;
  rotationDeg: number;
  canvasWidth: number;
  canvasHeight: number;
  threshold: number;
}): { x: number; y: number; guideX: SnapGuideX; guideY: SnapGuideY } {
  const rad = (params.rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const halfW = params.imageWidth / 2;
  const halfH = params.imageHeight / 2;
  const effHalfW = cos * halfW + sin * halfH;
  const effHalfH = sin * halfW + cos * halfH;

  const xCandidates: Array<{ target: number; guide: Exclude<SnapGuideX, null> }> = [
    { target: 0, guide: "center" },
    { target: effHalfW - params.canvasWidth / 2, guide: "left" },
    { target: params.canvasWidth / 2 - effHalfW, guide: "right" },
  ];
  const yCandidates: Array<{ target: number; guide: Exclude<SnapGuideY, null> }> = [
    { target: 0, guide: "center" },
    { target: effHalfH - params.canvasHeight / 2, guide: "top" },
    { target: params.canvasHeight / 2 - effHalfH, guide: "bottom" },
  ];

  let bestX = params.x;
  let guideX: SnapGuideX = null;
  let bestDistX = params.threshold;
  for (const candidate of xCandidates) {
    const dist = Math.abs(params.x - candidate.target);
    if (dist < bestDistX) {
      bestDistX = dist;
      bestX = candidate.target;
      guideX = candidate.guide;
    }
  }

  let bestY = params.y;
  let guideY: SnapGuideY = null;
  let bestDistY = params.threshold;
  for (const candidate of yCandidates) {
    const dist = Math.abs(params.y - candidate.target);
    if (dist < bestDistY) {
      bestDistY = dist;
      bestY = candidate.target;
      guideY = candidate.guide;
    }
  }

  return { x: bestX, y: bestY, guideX, guideY };
}
