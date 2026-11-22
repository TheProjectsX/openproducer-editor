import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/video-image-to-video";
import { ToolPageHeader } from "../components/tool-page-header";
import { MediaImportScreen } from "../components/media-import-screen";
import { CustomMediaPreview } from "../components/custom-media-preview";
import { ProcessingProgress } from "../components/processing-progress";
import type { KeyframeEasing, VideoAnimatedEffectKind, VideoAspectRatioMode, VideoClipKeyframe, VideoTransitionType } from "../lib/project-store";
import { drawVideoComposition } from "../lib/video-composition";
import { renderTimelineAudio } from "../lib/audio-timeline-render";
import { evaluateClipKeyframes, upsertClipKeyframe } from "../lib/video-keyframes";
import { imageClipGeometry } from "../lib/video-image-layout";
import {
  ANIMATED_EFFECTS,
  buildImageToVideoTimeline,
  buildPresetKeyframes,
  MOTION_PRESETS,
  resolveCanvasDimensions,
  scaleSlideKeyframes,
  snapImageOffsetToCanvas,
  syncSlideDurations,
  type DurationMode,
  type ImageSlideItem,
  type ImageToVideoAudioConfig,
  type MotionPresetId,
  type SnapGuideX,
  type SnapGuideY,
} from "../lib/image-to-video";

const MAX_IMAGE_BYTES = 64 * 1024 * 1024;
const MAX_AUDIO_BYTES = 128 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 120;
const MAX_OUTPUT_BYTES = 512 * 1024 * 1024;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Image to keyframe video | Local Studio" },
    { name: "description", content: "Turn one or more images into an animated MP4 or WebM video with interactive start/end keyframes, motion presets, transitions, and optional audio locally in your browser." },
  ];
}

function loadImageMeta(file: File): Promise<{ url: string; image: HTMLImageElement; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ url, image, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not decode “${file.name}” as an image.`));
    };
    image.src = url;
  });
}

function loadAudioDuration(file: File): Promise<{ url: string; duration: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
        URL.revokeObjectURL(url);
        reject(new Error(`Could not read audio duration from “${file.name}”.`));
        return;
      }
      resolve({ url, duration: audio.duration });
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not decode “${file.name}” as audio.`));
    };
    audio.src = url;
  });
}

const TRANSITION_OPTIONS: Array<{ value: VideoTransitionType | "none"; label: string }> = [
  { value: "none", label: "None (cut)" },
  { value: "fade", label: "Dissolve" },
  { value: "zoom-in", label: "Zoom in" },
  { value: "wipe-left", label: "Wipe left" },
  { value: "wipe-right", label: "Wipe right" },
  { value: "wipe-up", label: "Wipe up" },
  { value: "wipe-down", label: "Wipe down" },
  { value: "slide-left", label: "Slide left" },
  { value: "slide-right", label: "Slide right" },
];

type OverlayDragState = {
  mode: "move" | "scale" | "rotate";
  pointerId: number;
  startX: number;
  startY: number;
  initialTransform: VideoClipKeyframe["transform"];
  centerClientX: number;
  centerClientY: number;
  startDist: number;
  displayScale: number;
  targetTime: number;
};

export default function VideoImageToVideo() {
  const [slides, setSlides] = useState<ImageSlideItem[]>([]);
  const [selectedSlideId, setSelectedSlideId] = useState<string>("");

  const [durationMode, setDurationMode] = useState<DurationMode>("total");
  const [totalDurationInput, setTotalDurationInput] = useState("10");

  const [aspectMode, setAspectMode] = useState<VideoAspectRatioMode>("16:9");
  const [customWidthInput, setCustomWidthInput] = useState("1280");
  const [customHeightInput, setCustomHeightInput] = useState("720");
  const [backgroundColor, setBackgroundColor] = useState("#11131a");
  const [fpsInput, setFpsInput] = useState("30");
  const [videoBitrateInput, setVideoBitrateInput] = useState("6");
  const [audioBitrateInput, setAudioBitrateInput] = useState("192");

  const [audioConfig, setAudioConfig] = useState<ImageToVideoAudioConfig | null>(null);
  const [audioUrl, setAudioUrl] = useState("");

  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [canvasDisplaySize, setCanvasDisplaySize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [snapGuides, setSnapGuides] = useState<{ x: SnapGuideX; y: SnapGuideY }>({ x: null, y: null });

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [resultUrl, setResultUrl] = useState("");
  const [resultType, setResultType] = useState<"video/mp4" | "video/webm">("video/mp4");
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [error, setError] = useState("");

  const imageMapRef = useRef<Record<string, HTMLImageElement>>({});
  const imageUrlMapRef = useRef<Record<string, string>>({});
  const audioFileRef = useRef<File | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<OverlayDragState | null>(null);
  const cancelExportRef = useRef(false);
  const cancelOutputRef = useRef<(() => void) | null>(null);
  const playStartRef = useRef<{ wall: number; time: number }>({ wall: 0, time: 0 });

  useEffect(() => () => {
    Object.values(imageUrlMapRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const firstSlide = slides[0];
  const { width: canvasWidth, height: canvasHeight } = useMemo(
    () => resolveCanvasDimensions(
      aspectMode,
      Number(customWidthInput),
      Number(customHeightInput),
      firstSlide?.width ?? 1280,
      firstSlide?.height ?? 720,
    ),
    [aspectMode, customWidthInput, customHeightInput, firstSlide?.width, firstSlide?.height],
  );

  const parsedFps = Math.max(12, Math.min(60, Math.round(Number(fpsInput) || 30)));

  const { timeline, assets } = useMemo(() => buildImageToVideoTimeline({
    slides,
    width: canvasWidth,
    height: canvasHeight,
    aspectRatioMode: aspectMode,
    backgroundColor,
    fps: parsedFps,
    playhead,
    audio: audioConfig,
  }), [slides, canvasWidth, canvasHeight, aspectMode, backgroundColor, parsedFps, playhead, audioConfig]);

  const totalDuration = timeline.duration;

  const slideBounds = useMemo(() => {
    let cursor = 0;
    return slides.map((slide) => {
      const start = cursor;
      cursor += slide.duration;
      return { id: slide.id, start, end: cursor };
    });
  }, [slides]);

  // Determine which slide is visible at the playhead, or fall back to selectedSlideId
  const activeSlideIndex = useMemo(() => {
    if (!slides.length) return -1;
    const bySelected = slides.findIndex((item) => item.id === selectedSlideId);
    return bySelected >= 0 ? bySelected : 0;
  }, [slides, selectedSlideId]);

  const activeSlide = activeSlideIndex >= 0 ? slides[activeSlideIndex] : null;
  const activeSlideBounds = activeSlide
    ? slideBounds.find((b) => b.id === activeSlide.id) ?? { start: 0, end: activeSlide.duration }
    : { start: 0, end: 0 };

  const localSlideTime = activeSlide
    ? Math.max(0, Math.min(activeSlide.duration, playhead - activeSlideBounds.start))
    : 0;

  // Find keyframe matching current localSlideTime (within 30ms)
  const matchingKeyframeIndex = activeSlide
    ? activeSlide.keyframes.findIndex((kf) => Math.abs(kf.time - localSlideTime) < 0.03)
    : -1;
  const activeKeyframe: VideoClipKeyframe | null = activeSlide && matchingKeyframeIndex >= 0
    ? activeSlide.keyframes[matchingKeyframeIndex]
    : null;

  // Current evaluated transform for the active slide at localSlideTime
  const evaluatedTransform = useMemo(() => {
    if (!activeSlide) return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
    const clip = timeline.clips.find((c) => c.assetId === activeSlide.id);
    if (!clip) return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
    return evaluateClipKeyframes(clip, localSlideTime).transform;
  }, [activeSlide, timeline.clips, localSlideTime]);

  // Measure rendered canvas CSS size for interactive overlay alignment
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || showExportPreview) return;
    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasDisplaySize({ width: rect.width, height: rect.height });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasWidth, canvasHeight, slides.length, showExportPreview]);

  // Redraw preview canvas whenever timeline or playhead updates
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !slides.length || showExportPreview) return;
    drawVideoComposition(
      canvas,
      timeline,
      Math.max(0, Math.min(Math.max(0, totalDuration - 0.0001), playhead)),
      { videos: {}, images: imageMapRef.current },
      assets,
    );
  }, [timeline, assets, playhead, slides.length, totalDuration, showExportPreview]);

  // Keep selectedSlideId synced when scrubbing/playing across slides
  useEffect(() => {
    if (!slides.length) return;
    const clamped = Math.max(0, Math.min(Math.max(0, totalDuration - 0.0001), playhead));
    const current = slideBounds.find((b) => clamped >= b.start && clamped < b.end);
    if (current && current.id !== selectedSlideId && playing) {
      setSelectedSlideId(current.id);
    }
  }, [playhead, totalDuration, slideBounds, slides.length, selectedSlideId, playing]);

  // Playback loop
  useEffect(() => {
    if (!playing || !totalDuration) return;
    playStartRef.current = { wall: performance.now(), time: playhead >= totalDuration ? 0 : playhead };
    if (audioElementRef.current && audioConfig) {
      const audioEl = audioElementRef.current;
      const targetTime = audioConfig.loop && audioConfig.duration > 0
        ? playStartRef.current.time % audioConfig.duration
        : playStartRef.current.time;
      if (targetTime < audioConfig.duration) {
        audioEl.currentTime = targetTime;
        audioEl.volume = Math.min(1, Math.max(0, audioConfig.volume));
        audioEl.loop = audioConfig.loop;
        void audioEl.play().catch(() => undefined);
      }
    }
    let rafId = 0;
    const tick = (now: number) => {
      const elapsed = (now - playStartRef.current.wall) / 1000;
      const nextTime = playStartRef.current.time + elapsed;
      if (nextTime >= totalDuration) {
        setPlayhead(totalDuration);
        setPlaying(false);
        audioElementRef.current?.pause();
        return;
      }
      setPlayhead(nextTime);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      audioElementRef.current?.pause();
    };
  }, [playing, totalDuration, audioConfig]);

  // Spacebar play/pause when focus is not in inputs
  useEffect(() => {
    if (!slides.length || showExportPreview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      event.preventDefault();
      setPlaying((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slides.length, showExportPreview]);

  async function importImages(fileList: File[]) {
    if (!fileList.length) return;
    setError("");
    const added: ImageSlideItem[] = [];
    for (const file of fileList) {
      if (!file.type.startsWith("image/") && !/\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name)) {
        setError(`“${file.name}” is not a supported image file.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError(`“${file.name}” exceeds the 64 MiB per-image limit.`);
        continue;
      }
      try {
        const meta = await loadImageMeta(file);
        const id = `img-${crypto.randomUUID()}`;
        imageMapRef.current[id] = meta.image;
        imageUrlMapRef.current[id] = meta.url;
        const defaultDur = 3;
        added.push({
          id,
          name: file.name,
          type: file.type || "image/png",
          size: file.size,
          width: meta.width,
          height: meta.height,
          duration: defaultDur,
          preset: "ken-burns-in",
          transitionType: slides.length + added.length > 0 ? "fade" : "none",
          transitionDuration: 0.5,
          keyframes: buildPresetKeyframes("ken-burns-in", defaultDur, canvasWidth, canvasHeight),
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : `Could not load “${file.name}”.`);
      }
    }
    if (!added.length) return;
    setResultUrl("");
    setShowExportPreview(false);
    setSlides((prev) => {
      const combined = [...prev, ...added];
      if (durationMode === "total") {
        const targetTotal = Math.max(0.5, Math.min(MAX_VIDEO_SECONDS, Number(totalDurationInput) || combined.length * 3));
        return syncSlideDurations(combined, "total", targetTotal);
      }
      return combined;
    });
    if (!selectedSlideId) setSelectedSlideId(added[0].id);
  }

  async function chooseAudioFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)$/i.test(file.name)) {
      setError("Choose a valid audio file.");
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setError("Choose an audio file up to 128 MiB.");
      return;
    }
    setError("");
    try {
      const { url, duration } = await loadAudioDuration(file);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioFileRef.current = file;
      setAudioUrl(url);
      setAudioConfig({
        id: `aud-${crypto.randomUUID()}`,
        name: file.name,
        type: file.type || "audio/mpeg",
        size: file.size,
        duration,
        volume: 1,
        fadeIn: 0.4,
        fadeOut: 0.6,
        loop: true,
      });
      setResultUrl("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load audio file.");
    }
  }

  function removeAudio() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioFileRef.current = null;
    setAudioUrl("");
    setAudioConfig(null);
    setResultUrl("");
  }

  function updateSlide(slideId: string, updater: (slide: ImageSlideItem) => ImageSlideItem) {
    setSlides((prev) => prev.map((slide) => (slide.id === slideId ? updater(slide) : slide)));
    setResultUrl("");
  }

  function applyTotalDuration(rawValue: string) {
    setTotalDurationInput(rawValue);
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0.5 || parsed > MAX_VIDEO_SECONDS) return;
    setSlides((prev) => syncSlideDurations(prev, "total", parsed));
    setResultUrl("");
  }

  function switchDurationMode(mode: DurationMode) {
    setDurationMode(mode);
    if (mode === "total") {
      const currentTotal = slides.reduce((sum, s) => sum + s.duration, 0);
      const safe = Math.max(0.5, Math.min(MAX_VIDEO_SECONDS, Number(currentTotal.toFixed(2)) || 10));
      setTotalDurationInput(String(safe));
      setSlides((prev) => syncSlideDurations(prev, "total", safe));
    }
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
    setResultUrl("");
  }

  function removeSlide(slideId: string) {
    const url = imageUrlMapRef.current[slideId];
    if (url) URL.revokeObjectURL(url);
    delete imageUrlMapRef.current[slideId];
    delete imageMapRef.current[slideId];
    setSlides((prev) => {
      const remaining = prev.filter((item) => item.id !== slideId);
      if (selectedSlideId === slideId) setSelectedSlideId(remaining[0]?.id ?? "");
      if (durationMode === "total" && remaining.length) {
        return syncSlideDurations(remaining, "total", Number(totalDurationInput) || remaining.length * 3);
      }
      return remaining;
    });
    setResultUrl("");
  }

  function selectPresetForSlide(slideId: string, preset: MotionPresetId) {
    updateSlide(slideId, (slide) => ({
      ...slide,
      preset,
      keyframes: buildPresetKeyframes(preset, slide.duration, canvasWidth, canvasHeight),
    }));
  }

  function applyPresetToAll(preset: MotionPresetId) {
    setSlides((prev) => prev.map((slide) => ({
      ...slide,
      preset,
      keyframes: buildPresetKeyframes(preset, slide.duration, canvasWidth, canvasHeight),
    })));
    setResultUrl("");
  }

  // Commit or update a keyframe on the active slide at targetTime
  function commitTransformAtTime(targetTime: number, nextTransform: VideoClipKeyframe["transform"], easing?: KeyframeEasing) {
    if (!activeSlide) return;
    const clampedTime = Number(Math.max(0, Math.min(activeSlide.duration, targetTime)).toFixed(3));
    const existing = activeSlide.keyframes.find((kf) => Math.abs(kf.time - clampedTime) < 0.03);
    const keyTime = existing ? existing.time : clampedTime;
    const nextFrames = upsertClipKeyframe(
      { id: activeSlide.id, assetId: activeSlide.id, track: 0, start: 0, sourceStart: 0, sourceEnd: activeSlide.duration, speed: 1, volume: 1, muted: false, keyframes: activeSlide.keyframes },
      { time: keyTime, transform: nextTransform, volume: 1, easing: easing ?? existing?.easing ?? "ease-in-out" },
    );
    updateSlide(activeSlide.id, (slide) => ({ ...slide, keyframes: nextFrames }));
  }

  function updateKeyframeField(patch: Omit<Partial<VideoClipKeyframe>, "transform"> & { transform?: Partial<VideoClipKeyframe["transform"]> }) {
    if (!activeSlide) return;
    const targetTime = activeKeyframe ? activeKeyframe.time : Number(localSlideTime.toFixed(3));
    const nextTransform = { ...evaluatedTransform, ...patch.transform };
    if (patch.time !== undefined && activeKeyframe) {
      const clamped = Number(Math.max(0, Math.min(activeSlide.duration, patch.time)).toFixed(3));
      const nextFrames = activeSlide.keyframes
        .map((kf, idx) => (idx === matchingKeyframeIndex ? { ...kf, time: clamped, transform: nextTransform, easing: patch.easing ?? kf.easing } : kf))
        .sort((a, b) => a.time - b.time);
      updateSlide(activeSlide.id, (slide) => ({ ...slide, keyframes: nextFrames }));
      setPlayhead(activeSlideBounds.start + clamped);
      return;
    }
    commitTransformAtTime(targetTime, nextTransform, patch.easing);
  }

  function deleteKeyframeAt(index: number) {
    if (!activeSlide || activeSlide.keyframes.length <= 1) return;
    const nextFrames = activeSlide.keyframes.filter((_, idx) => idx !== index);
    updateSlide(activeSlide.id, (slide) => ({ ...slide, keyframes: nextFrames }));
  }

  function jumpToSlideTime(localTime: number) {
    if (!activeSlide) return;
    setPlaying(false);
    const clamped = Math.max(0, Math.min(activeSlide.duration, localTime));
    setPlayhead(activeSlideBounds.start + clamped);
  }

  // Interactive on-canvas drag / resize / rotate handlers
  const displayScale = canvasDisplaySize.width > 0 ? canvasDisplaySize.width / canvasWidth : 1;
  const activeGeometry = activeSlide
    ? imageClipGeometry(activeSlide.width, activeSlide.height, canvasWidth, canvasHeight, undefined, undefined, evaluatedTransform.scale)
    : null;

  const overlayBox = activeGeometry && canvasDisplaySize.width > 0
    ? {
        cx: (canvasWidth / 2 + evaluatedTransform.x) * displayScale,
        cy: (canvasHeight / 2 + evaluatedTransform.y) * displayScale,
        width: activeGeometry.width * displayScale,
        height: activeGeometry.height * displayScale,
      }
    : null;

  function beginOverlayGesture(mode: OverlayDragState["mode"], event: React.PointerEvent<HTMLElement>) {
    if (!activeSlide || !previewCanvasRef.current || !overlayBox) return;
    event.preventDefault();
    event.stopPropagation();
    setPlaying(false);
    const canvasRect = previewCanvasRef.current.getBoundingClientRect();
    const centerClientX = canvasRect.left + overlayBox.cx;
    const centerClientY = canvasRect.top + overlayBox.cy;
    const startDist = Math.max(12, Math.hypot(event.clientX - centerClientX, event.clientY - centerClientY));
    const targetTime = activeKeyframe ? activeKeyframe.time : Number(localSlideTime.toFixed(3));
    dragRef.current = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialTransform: { ...evaluatedTransform },
      centerClientX,
      centerClientY,
      startDist,
      displayScale,
      targetTime,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveOverlayGesture(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.mode === "move") {
      let nextX = drag.initialTransform.x + (event.clientX - drag.startX) / drag.displayScale;
      let nextY = drag.initialTransform.y + (event.clientY - drag.startY) / drag.displayScale;
      let guideX: SnapGuideX = null;
      let guideY: SnapGuideY = null;
      if (!event.altKey && activeGeometry) {
        const snapped = snapImageOffsetToCanvas({
          x: nextX,
          y: nextY,
          imageWidth: activeGeometry.width,
          imageHeight: activeGeometry.height,
          rotationDeg: drag.initialTransform.rotation,
          canvasWidth,
          canvasHeight,
          threshold: 10 / drag.displayScale,
        });
        nextX = snapped.x;
        nextY = snapped.y;
        guideX = snapped.guideX;
        guideY = snapped.guideY;
      }
      setSnapGuides({ x: guideX, y: guideY });
      commitTransformAtTime(drag.targetTime, {
        ...drag.initialTransform,
        x: Math.round(nextX),
        y: Math.round(nextY),
      });
    } else if (drag.mode === "scale") {
      const dist = Math.max(8, Math.hypot(event.clientX - drag.centerClientX, event.clientY - drag.centerClientY));
      const nextScale = Number(Math.max(0.05, Math.min(10, drag.initialTransform.scale * (dist / drag.startDist))).toFixed(3));
      commitTransformAtTime(drag.targetTime, { ...drag.initialTransform, scale: nextScale });
    } else if (drag.mode === "rotate") {
      const angle = Math.atan2(event.clientY - drag.centerClientY, event.clientX - drag.centerClientX) * (180 / Math.PI) + 90;
      const snappedAngle = !event.altKey && Math.abs(angle % 45) < 3 ? Math.round(angle / 45) * 45 : Math.round(angle);
      commitTransformAtTime(drag.targetTime, { ...drag.initialTransform, rotation: snappedAngle });
    }
  }

  function endOverlayGesture(event: React.PointerEvent<HTMLElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setSnapGuides({ x: null, y: null });
    }
  }

  function handleCanvasWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!activeSlide || showExportPreview) return;
    event.preventDefault();
    setPlaying(false);
    const factor = event.deltaY < 0 ? 1.07 : 0.93;
    const nextScale = Number(Math.max(0.05, Math.min(10, evaluatedTransform.scale * factor)).toFixed(3));
    const targetTime = activeKeyframe ? activeKeyframe.time : Number(localSlideTime.toFixed(3));
    commitTransformAtTime(targetTime, { ...evaluatedTransform, scale: nextScale });
  }

  async function exportVideo() {
    if (!slides.length || totalDuration <= 0) return;
    if (totalDuration > MAX_VIDEO_SECONDS) {
      setError(`Total video duration must be ${MAX_VIDEO_SECONDS} seconds or less.`);
      return;
    }
    const fps = Number(fpsInput);
    const videoRate = Number(videoBitrateInput);
    const audioRate = Number(audioBitrateInput);
    if (!Number.isFinite(fps) || fps < 12 || fps > 60) { setError("Enter a frame rate from 12 to 60 fps."); return; }
    if (!Number.isFinite(videoRate) || videoRate < 0.5 || videoRate > 40 || !Number.isFinite(audioRate) || audioRate < 64 || audioRate > 320) {
      setError("Video bitrate must be 0.5–40 Mbps and audio bitrate must be 64–320 kbps.");
      return;
    }
    if (canvasWidth * canvasHeight > 4_000_000) {
      setError("Canvas export is limited to 4 megapixels (e.g. 2560×1440 or 1920×1080).");
      return;
    }

    setPlaying(false);
    setExporting(true);
    setExportProgress(0);
    setError("");
    setResultUrl("");
    setShowExportPreview(false);
    cancelExportRef.current = false;

    let output: import("mediabunny").Output | undefined;
    let outputOverLimit = false;
    try {
      const { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, WebMOutputFormat, canEncodeAudio, canEncodeVideo } = await import("mediabunny");
      const hasAudio = Boolean(audioConfig && audioFileRef.current);
      const mp4Video = await canEncodeVideo("avc", { width: canvasWidth, height: canvasHeight, frameRate: fps, bitrate: videoRate * 1_000_000 });
      const mp4Audio = !hasAudio || await canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: 48_000, bitrate: audioRate * 1_000 });
      const webmCodec = mp4Video && mp4Audio ? null
        : await canEncodeVideo("vp9", { width: canvasWidth, height: canvasHeight, frameRate: fps, bitrate: videoRate * 1_000_000 }) ? "vp9"
        : await canEncodeVideo("vp8", { width: canvasWidth, height: canvasHeight, frameRate: fps, bitrate: videoRate * 1_000_000 }) ? "vp8"
        : null;
      const webmAudio = !hasAudio || await canEncodeAudio("opus", { numberOfChannels: 2, sampleRate: 48_000, bitrate: audioRate * 1_000 });
      const useMp4 = mp4Video && mp4Audio;
      if (!useMp4 && (!webmCodec || !webmAudio)) {
        throw new Error("This browser has no supported video/audio encoder combination for these dimensions and frame rate.");
      }

      const audioFiles = hasAudio && audioConfig && audioFileRef.current ? { [audioConfig.id]: audioFileRef.current } : {};
      const audioBuffer = hasAudio
        ? await renderTimelineAudio(timeline.clips, assets, audioFiles, totalDuration, (pct) => setExportProgress(Math.round(pct * 0.25)), () => cancelExportRef.current)
        : null;
      if (cancelExportRef.current) throw new Error("Export cancelled.");

      const renderCanvas = document.createElement("canvas");
      renderCanvas.width = canvasWidth;
      renderCanvas.height = canvasHeight;

      const target = new BufferTarget();
      let written = 0;
      target.on("write", ({ end }) => {
        written = Math.max(written, end);
        if (written > MAX_OUTPUT_BYTES) {
          outputOverLimit = true;
          cancelExportRef.current = true;
        }
      });

      output = new Output({ format: useMp4 ? new Mp4OutputFormat() : new WebMOutputFormat(), target });
      cancelOutputRef.current = () => {
        if (output && output.state !== "canceled" && output.state !== "finalized") {
          void output.cancel().catch(() => undefined);
        }
      };

      const videoSource = new CanvasSource(renderCanvas, {
        codec: useMp4 ? "avc" : webmCodec!,
        quality: new Quality({ bitrate: videoRate * 1_000_000 }),
      });
      output.addVideoTrack(videoSource, { frameRate: fps });

      let audioSource: InstanceType<typeof AudioBufferSource> | null = null;
      if (hasAudio && audioBuffer) {
        audioSource = new AudioBufferSource({
          codec: useMp4 ? "aac" : "opus",
          quality: new Quality({ bitrate: audioRate * 1_000 }),
        });
        output.addAudioTrack(audioSource);
      }

      await output.start();
      if (audioBuffer && audioSource) await audioSource.add(audioBuffer);

      const frameCount = Math.ceil(totalDuration * fps);
      for (let frame = 0; frame < frameCount; frame++) {
        if (cancelExportRef.current) {
          throw new Error(outputOverLimit ? "Export exceeded the 512 MiB in-memory output limit." : "Export cancelled.");
        }
        const timestamp = frame / fps;
        drawVideoComposition(renderCanvas, timeline, timestamp, { videos: {}, images: imageMapRef.current }, assets);
        await videoSource.add(timestamp, 1 / fps);
        if (frame % Math.max(1, Math.floor(fps / 2)) === 0 || frame === frameCount - 1) {
          setExportProgress((hasAudio ? 25 : 5) + Math.round(((frame + 1) / frameCount) * (hasAudio ? 73 : 93)));
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      await output.finalize();
      if (!target.buffer) throw new Error("The browser encoder finished without producing an output file.");
      if (target.buffer.byteLength > MAX_OUTPUT_BYTES) throw new Error("Output exceeds the 512 MiB in-memory download limit.");
      const mimeType: "video/mp4" | "video/webm" = useMp4 ? "video/mp4" : "video/webm";
      setResultUrl(URL.createObjectURL(new Blob([target.buffer], { type: mimeType })));
      setResultType(mimeType);
      setShowExportPreview(true);
      setExportProgress(null);
    } catch (cause) {
      if (output && output.state !== "canceled" && output.state !== "finalized") {
        await output.cancel().catch(() => undefined);
      }
      setExportProgress(null);
      if (outputOverLimit) setError("Export exceeded the 512 MiB in-memory output limit.");
      else if (cancelExportRef.current || (cause instanceof Error && cause.message.toLowerCase().includes("cancel"))) {
        setError("Export cancelled.");
      } else {
        setError(cause instanceof Error ? cause.message : "Could not export video.");
      }
    } finally {
      cancelOutputRef.current = null;
      setExporting(false);
    }
  }

  const isAtStart = localSlideTime < 0.03;
  const isAtEnd = activeSlide ? Math.abs(localSlideTime - activeSlide.duration) < 0.03 : false;

  return (
    <main className={`resize-page i2v-page${slides.length ? " has-media" : ""}`}>
      <ToolPageHeader />
      <section className="resize-intro">
        <p className="eyebrow">VIDEO &amp; IMAGE · LOCAL KEYFRAME ANIMATION</p>
        <h1>Image to keyframe video</h1>
        <p>Upload one or more images, set your video length, drag and zoom your Start and End frames directly on the preview, add optional audio, and export MP4 or WebM locally.</p>
      </section>

      {!slides.length ? (
        <MediaImportScreen kind="image" accept="image/*" multiple onFiles={(files) => void importImages(files)} error={error} />
      ) : (
        <section className="resize-workspace i2v-workspace">
          <div className="resize-controls i2v-controls">
            {/* 1. Images & Video Length */}
            <div className="i2v-section">
              <div className="i2v-section-head">
                <strong>1. Images ({slides.length})</strong>
                <label className="i2v-add-btn">
                  + Add images
                  <input type="file" accept="image/*" multiple onChange={(event) => { void importImages(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }} />
                </label>
              </div>
              <div className="i2v-segmented" role="radiogroup" aria-label="Duration mode">
                <button type="button" role="radio" aria-checked={durationMode === "total"} className={durationMode === "total" ? "is-active" : ""} onClick={() => switchDurationMode("total")}>Total video length</button>
                <button type="button" role="radio" aria-checked={durationMode === "per-slide"} className={durationMode === "per-slide" ? "is-active" : ""} onClick={() => switchDurationMode("per-slide")}>Per-image length</button>
              </div>
              {durationMode === "total" ? (
                <label className="i2v-field">
                  <span>Total video length <small>0.5–120 s</small></span>
                  <input type="number" min="0.5" max="120" step="0.1" value={totalDurationInput} onChange={(event) => applyTotalDuration(event.currentTarget.value)} />
                </label>
              ) : (
                <p className="source-info">Total video length: {totalDuration.toFixed(2)} s</p>
              )}

              <ul className="i2v-slide-list">
                {slides.map((slide, index) => {
                  const isActive = slide.id === activeSlide?.id;
                  return (
                    <li key={slide.id} className={`i2v-slide-card${isActive ? " is-active" : ""}`}>
                      <button type="button" className="i2v-slide-select" onClick={() => { setPlaying(false); setSelectedSlideId(slide.id); setPlayhead(slideBounds[index]?.start ?? 0); }}>
                        <img src={imageUrlMapRef.current[slide.id]} alt="" />
                        <span>
                          <strong>{index + 1}. {slide.name}</strong>
                          <small>{slide.duration.toFixed(2)} s · {MOTION_PRESETS.find((p) => p.id === slide.preset)?.label ?? "Custom"}</small>
                        </span>
                      </button>
                      <div className="i2v-slide-actions">
                        <button type="button" aria-label={`Move ${slide.name} up`} disabled={index === 0} onClick={() => moveSlide(index, -1)}>↑</button>
                        <button type="button" aria-label={`Move ${slide.name} down`} disabled={index === slides.length - 1} onClick={() => moveSlide(index, 1)}>↓</button>
                        <button type="button" aria-label={`Remove ${slide.name}`} onClick={() => removeSlide(slide.id)}>×</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* 2. Motion Preset & Transitions */}
            {activeSlide && (
              <div className="i2v-section">
                <div className="i2v-section-head">
                  <strong>2. Motion &amp; Transitions</strong>
                  <span>Slide {activeSlideIndex + 1}</span>
                </div>

                {durationMode === "per-slide" && (
                  <label className="i2v-field">
                    <span>Slide duration <small>seconds</small></span>
                    <input
                      type="number"
                      min="0.1"
                      max="120"
                      step="0.1"
                      value={activeSlide.duration}
                      onChange={(event) => {
                        const val = Number(event.currentTarget.value);
                        if (!Number.isFinite(val) || val < 0.1 || val > 120) return;
                        updateSlide(activeSlide.id, (slide) => ({
                          ...slide,
                          duration: val,
                          keyframes: scaleSlideKeyframes(slide.keyframes, slide.duration, val),
                        }));
                      }}
                    />
                  </label>
                )}

                <label className="i2v-field">
                  <span>Quick motion preset</span>
                  <select value={activeSlide.preset} onChange={(event) => selectPresetForSlide(activeSlide.id, event.currentTarget.value as MotionPresetId)}>
                    {MOTION_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id} title={preset.description}>{preset.label}</option>
                    ))}
                  </select>
                </label>
                {slides.length > 1 && (
                  <button type="button" className="secondary-button i2v-inline-btn" onClick={() => applyPresetToAll(activeSlide.preset)}>
                    Apply “{MOTION_PRESETS.find((p) => p.id === activeSlide.preset)?.label}” to all slides
                  </button>
                )}

                <div className="i2v-two-col">
                  <label className="i2v-field">
                    <span>Effect animation</span>
                    <select
                      value={activeSlide.effectAnimation ?? "none"}
                      onChange={(event) => {
                        const effectAnimation = event.currentTarget.value as VideoAnimatedEffectKind;
                        updateSlide(activeSlide.id, (s) => ({
                          ...s,
                          effectAnimation,
                          effectIntensity: s.effectIntensity ?? 1,
                        }));
                      }}
                    >
                      {ANIMATED_EFFECTS.map((fx) => <option key={fx.id} value={fx.id}>{fx.label}</option>)}
                    </select>
                  </label>
                  <label className="i2v-field">
                    <span>Intensity <small>{Math.round((activeSlide.effectIntensity ?? 1) * 100)}%</small></span>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      step="10"
                      disabled={!activeSlide.effectAnimation || activeSlide.effectAnimation === "none"}
                      value={Math.round((activeSlide.effectIntensity ?? 1) * 100)}
                      onChange={(event) => {
                        const val = Number(event.currentTarget.value);
                        if (Number.isFinite(val) && val >= 0) {
                          updateSlide(activeSlide.id, (s) => ({ ...s, effectIntensity: Math.max(0, Math.min(2, val / 100)) }));
                        }
                      }}
                    />
                  </label>
                </div>
                {slides.length > 1 && activeSlide.effectAnimation && activeSlide.effectAnimation !== "none" && (
                  <button
                    type="button"
                    className="secondary-button i2v-inline-btn"
                    onClick={() => {
                      const kind = activeSlide.effectAnimation;
                      const intensity = activeSlide.effectIntensity ?? 1;
                      setSlides((prev) => prev.map((s) => ({ ...s, effectAnimation: kind, effectIntensity: intensity })));
                      setResultUrl("");
                    }}
                  >
                    Apply “{ANIMATED_EFFECTS.find((fx) => fx.id === activeSlide.effectAnimation)?.label}” effect to all slides
                  </button>
                )}

                <div className="i2v-two-col">
                  <label className="i2v-field">
                    <span>Transition in</span>
                    <select value={activeSlide.transitionType} onChange={(event) => {
                      const transitionType = event.currentTarget.value as VideoTransitionType | "none";
                      updateSlide(activeSlide.id, (s) => ({ ...s, transitionType }));
                    }}>
                      {TRANSITION_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </label>
                  <label className="i2v-field">
                    <span>Duration <small>s</small></span>
                    <input
                      type="number"
                      min="0"
                      max={Math.max(0.1, activeSlide.duration / 2)}
                      step="0.05"
                      disabled={activeSlide.transitionType === "none"}
                      value={activeSlide.transitionDuration}
                      onChange={(event) => {
                        const val = Number(event.currentTarget.value);
                        if (Number.isFinite(val) && val >= 0) updateSlide(activeSlide.id, (s) => ({ ...s, transitionDuration: val }));
                      }}
                    />
                  </label>
                </div>

                <details className="editor-control-group">
                  <summary>Fine-tune keyframe numbers <span>{localSlideTime.toFixed(2)}s</span></summary>
                  <div className="editor-control-content">
                    <div className="filter-fields two-column">
                      <label>Time <span>s</span><input type="number" min="0" max={activeSlide.duration} step="0.05" value={activeKeyframe?.time ?? Number(localSlideTime.toFixed(2))} onChange={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) updateKeyframeField({ time: v }); }} /></label>
                      <label>Scale <span>×</span><input type="number" min="0.05" max="10" step="0.02" value={Number(evaluatedTransform.scale.toFixed(3))} onChange={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) updateKeyframeField({ transform: { scale: v } }); }} /></label>
                      <label>Pos X <span>px</span><input type="number" step="1" value={Math.round(evaluatedTransform.x)} onChange={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) updateKeyframeField({ transform: { x: v } }); }} /></label>
                      <label>Pos Y <span>px</span><input type="number" step="1" value={Math.round(evaluatedTransform.y)} onChange={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) updateKeyframeField({ transform: { y: v } }); }} /></label>
                      <label>Rotate <span>°</span><input type="number" step="1" value={Math.round(evaluatedTransform.rotation)} onChange={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) updateKeyframeField({ transform: { rotation: v } }); }} /></label>
                      <label>Opacity <span>0–1</span><input type="number" min="0" max="1" step="0.05" value={Number(evaluatedTransform.opacity.toFixed(2))} onChange={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) updateKeyframeField({ transform: { opacity: Math.max(0, Math.min(1, v)) } }); }} /></label>
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* 3. Optional Background Audio */}
            <div className="i2v-section">
              <div className="i2v-section-head">
                <strong>3. Background audio (optional)</strong>
                {audioConfig && <button type="button" className="i2v-text-btn" onClick={removeAudio}>Remove</button>}
              </div>
              {!audioConfig ? (
                <label className="file-picker">
                  <span>Add audio track (MP3, WAV, AAC, OGG)
                    <input type="file" accept="audio/*" onChange={(event) => { void chooseAudioFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
                  </span>
                </label>
              ) : (
                <>
                  <p className="source-info">{audioConfig.name} · {audioConfig.duration.toFixed(2)} s</p>
                  <div className="filter-fields two-column">
                    <label>Volume <span>0–4×</span><input type="number" min="0" max="4" step="0.1" value={audioConfig.volume} onChange={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) setAudioConfig((a) => a ? { ...a, volume: Math.max(0, Math.min(4, v)) } : a); }} /></label>
                    <label>Fade in <span>s</span><input type="number" min="0" max="30" step="0.1" value={audioConfig.fadeIn} onChange={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) setAudioConfig((a) => a ? { ...a, fadeIn: Math.max(0, v) } : a); }} /></label>
                    <label>Fade out <span>s</span><input type="number" min="0" max="30" step="0.1" value={audioConfig.fadeOut} onChange={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) setAudioConfig((a) => a ? { ...a, fadeOut: Math.max(0, v) } : a); }} /></label>
                    <label className="ratio-toggle i2v-loop-toggle">
                      <input type="checkbox" checked={audioConfig.loop} onChange={(e) => {
                        const loop = e.currentTarget.checked;
                        setAudioConfig((a) => a ? { ...a, loop } : a);
                      }} />
                      Loop audio
                    </label>
                  </div>
                </>
              )}
              {audioUrl && <audio ref={audioElementRef} src={audioUrl} preload="auto" className="visually-hidden" />}
            </div>

            {/* 4. Output & Export */}
            <div className="i2v-section">
              <div className="i2v-section-head">
                <strong>4. Canvas &amp; Export</strong>
                <span>{canvasWidth}×{canvasHeight}</span>
              </div>
              <label className="i2v-field">
                <span>Aspect ratio</span>
                <select value={aspectMode} onChange={(e) => setAspectMode(e.currentTarget.value as VideoAspectRatioMode)}>
                  <option value="16:9">16:9 Landscape (1280×720)</option>
                  <option value="9:16">9:16 Portrait (720×1280)</option>
                  <option value="1:1">1:1 Square (1080×1080)</option>
                  <option value="4:3">4:3 (1200×900)</option>
                  <option value="3:4">3:4 (900×1200)</option>
                  <option value="original">Original ({firstSlide?.width ?? 1280}×{firstSlide?.height ?? 720})</option>
                  <option value="custom">Custom pixels</option>
                </select>
              </label>
              {aspectMode === "custom" && (
                <div className="i2v-two-col">
                  <label className="i2v-field"><span>Width <small>px</small></span><input type="number" min="16" max="7680" value={customWidthInput} onChange={(e) => setCustomWidthInput(e.currentTarget.value)} /></label>
                  <label className="i2v-field"><span>Height <small>px</small></span><input type="number" min="16" max="4320" value={customHeightInput} onChange={(e) => setCustomHeightInput(e.currentTarget.value)} /></label>
                </div>
              )}
              <details className="editor-control-group">
                <summary>Advanced export settings <span>{parsedFps} fps</span></summary>
                <div className="editor-control-content">
                  <div className="filter-fields two-column">
                    <label>FPS <span>12–60</span><input type="number" min="12" max="60" value={fpsInput} onChange={(e) => setFpsInput(e.currentTarget.value)} /></label>
                    <label>Background<input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.currentTarget.value)} /></label>
                    <label>Video <span>Mbps</span><input type="number" min="0.5" max="40" step="0.5" value={videoBitrateInput} onChange={(e) => setVideoBitrateInput(e.currentTarget.value)} /></label>
                    <label>Audio <span>kbps</span><input type="number" min="64" max="320" step="16" value={audioBitrateInput} onChange={(e) => setAudioBitrateInput(e.currentTarget.value)} /></label>
                  </div>
                </div>
              </details>
              {error && <p className="resize-error" role="alert">{error}</p>}
              {exportProgress !== null && (
                <div className="i2v-progress-row">
                  <ProcessingProgress label="Rendering keyframe video" value={exportProgress} />
                  <button type="button" className="secondary-button i2v-inline-btn" onClick={() => { cancelExportRef.current = true; cancelOutputRef.current?.(); }}>
                    Cancel
                  </button>
                </div>
              )}
              <button type="button" className="export-button" disabled={exporting || !slides.length} onClick={() => void exportVideo()}>
                {exporting ? "Exporting video…" : "Export video"}
              </button>
              {resultUrl && (
                <a className="export-button download-link" href={resultUrl} download={`image-animation.${resultType === "video/mp4" ? "mp4" : "webm"}`}>
                  Download {resultType === "video/mp4" ? "MP4" : "WebM"}
                </a>
              )}
            </div>
          </div>

          <div className="resize-preview i2v-preview">
            <div className="preview-heading">
              <strong>{showExportPreview && resultUrl ? "Exported video" : "Interactive keyframe preview"}</strong>
              <div className="i2v-preview-tabs">
                <span>{canvasWidth}×{canvasHeight} · {parsedFps} fps · {totalDuration.toFixed(2)} s</span>
                {resultUrl && (
                  <button type="button" className="secondary-button i2v-inline-btn" onClick={() => { setPlaying(false); setShowExportPreview((v) => !v); }}>
                    {showExportPreview ? "Back to editor preview" : "Show exported video"}
                  </button>
                )}
              </div>
            </div>

            {showExportPreview && resultUrl ? (
              <CustomMediaPreview kind="video" src={resultUrl} label="Exported keyframe video" />
            ) : (
              <div className="i2v-editor-stage-wrap">
                {/* Interactive Pose Selector Bar: Start Frame / Keyframes / End Frame */}
                {activeSlide && (
                  <div className="i2v-pose-bar" role="toolbar" aria-label="Slide keyframe poses">
                    <button
                      type="button"
                      className={`i2v-pose-btn${isAtStart ? " is-active" : ""}`}
                      onClick={() => jumpToSlideTime(0)}
                    >
                      Start Frame (0.00s)
                    </button>
                    {activeSlide.keyframes.map((kf, idx) => {
                      if (kf.time < 0.03 || Math.abs(kf.time - activeSlide.duration) < 0.03) return null;
                      const active = Math.abs(localSlideTime - kf.time) < 0.03;
                      return (
                        <button
                          key={`${kf.time}-${idx}`}
                          type="button"
                          className={`i2v-pose-btn${active ? " is-active" : ""}`}
                          onClick={() => jumpToSlideTime(kf.time)}
                        >
                          ◆ {kf.time.toFixed(2)}s
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className={`i2v-pose-btn${isAtEnd ? " is-active" : ""}`}
                      onClick={() => jumpToSlideTime(activeSlide.duration)}
                    >
                      End Frame ({activeSlide.duration.toFixed(2)}s)
                    </button>
                    <button
                      type="button"
                      className="i2v-pose-add"
                      onClick={() => commitTransformAtTime(localSlideTime, { ...evaluatedTransform })}
                      title="Save current pose as a keyframe at the playhead"
                    >
                      + Pin pose here
                    </button>
                  </div>
                )}

                {/* Direct On-Canvas Interactive Stage */}
                <div className="i2v-canvas-stage" ref={canvasStageRef} onWheel={handleCanvasWheel}>
                  <div className="i2v-canvas-frame">
                    <canvas ref={previewCanvasRef} width={canvasWidth} height={canvasHeight} aria-label="Image keyframe animation preview" />
                    {snapGuides.x && <div className={`i2v-snap-v is-${snapGuides.x}`} aria-hidden="true" />}
                    {snapGuides.y && <div className={`i2v-snap-h is-${snapGuides.y}`} aria-hidden="true" />}
                    {!playing && overlayBox && (
                      <div
                        className="i2v-canvas-overlay"
                        style={{
                          left: `${overlayBox.cx}px`,
                          top: `${overlayBox.cy}px`,
                          width: `${overlayBox.width}px`,
                          height: `${overlayBox.height}px`,
                          transform: `translate(-50%, -50%) rotate(${evaluatedTransform.rotation}deg)`,
                        }}
                        onPointerDown={(e) => beginOverlayGesture("move", e)}
                        onPointerMove={moveOverlayGesture}
                        onPointerUp={endOverlayGesture}
                        onPointerCancel={endOverlayGesture}
                        title="Drag to position, drag corners to zoom, or scroll wheel to zoom"
                      >
                        <button
                          type="button"
                          className="i2v-handle rotate"
                          aria-label="Rotate image"
                          onPointerDown={(e) => beginOverlayGesture("rotate", e)}
                          onPointerMove={moveOverlayGesture}
                          onPointerUp={endOverlayGesture}
                          onPointerCancel={endOverlayGesture}
                        />
                        {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                          <button
                            key={corner}
                            type="button"
                            className={`i2v-handle ${corner}`}
                            aria-label={`Resize ${corner}`}
                            onPointerDown={(e) => beginOverlayGesture("scale", e)}
                            onPointerMove={moveOverlayGesture}
                            onPointerUp={endOverlayGesture}
                            onPointerCancel={endOverlayGesture}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Visual Pose Strip (Zoom slider, Easing, Reset, Delete) */}
                {activeSlide && (
                  <div className="i2v-quick-pose-bar">
                    <label className="i2v-zoom-control">
                      <span>Zoom {evaluatedTransform.scale.toFixed(2)}×</span>
                      <input
                        type="range"
                        min="0.1"
                        max="4"
                        step="0.02"
                        value={Math.min(4, Math.max(0.1, evaluatedTransform.scale))}
                        onChange={(e) => commitTransformAtTime(localSlideTime, { ...evaluatedTransform, scale: e.currentTarget.valueAsNumber })}
                      />
                    </label>
                    <label className="i2v-easing-control">
                      <span>Easing</span>
                      <select
                        value={activeKeyframe?.easing ?? "ease-in-out"}
                        onChange={(e) => updateKeyframeField({ easing: e.currentTarget.value as KeyframeEasing })}
                      >
                        <option value="ease-in-out">Smooth (Ease in-out)</option>
                        <option value="linear">Linear</option>
                        <option value="ease-in">Ease in</option>
                        <option value="ease-out">Ease out</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="secondary-button i2v-inline-btn"
                      onClick={() => commitTransformAtTime(localSlideTime, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 })}
                    >
                      Reset pose
                    </button>
                    {matchingKeyframeIndex >= 0 && activeSlide.keyframes.length > 1 && (
                      <button
                        type="button"
                        className="secondary-button i2v-inline-btn"
                        onClick={() => deleteKeyframeAt(matchingKeyframeIndex)}
                      >
                        Delete keyframe
                      </button>
                    )}
                  </div>
                )}

                {/* Playback Transport & Timeline Scrubber */}
                <div className="custom-media-transport">
                  <button type="button" className="transport-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause preview" : "Play preview"}>
                    {playing ? "Ⅱ" : "▶"}
                  </button>
                  <span className="transport-time">{playhead.toFixed(2)} s <i>/</i> {totalDuration.toFixed(2)} s</span>
                  <div className="i2v-scrub-wrap">
                    <input
                      className="transport-scrub"
                      type="range"
                      min="0"
                      max={totalDuration || 0}
                      step="0.01"
                      value={Math.min(playhead, totalDuration)}
                      aria-label="Animation timeline scrubber"
                      onChange={(event) => {
                        setPlaying(false);
                        setPlayhead(event.currentTarget.valueAsNumber);
                      }}
                    />
                    {totalDuration > 0 && (
                      <div className="i2v-timeline-markers" aria-hidden="true">
                        {slideBounds.slice(1).map((bound) => (
                          <span key={bound.id} className="i2v-slide-marker" style={{ left: `${(bound.start / totalDuration) * 100}%` }} />
                        ))}
                        {activeSlide && activeSlide.keyframes.map((kf, idx) => (
                          <span
                            key={`mk-${idx}`}
                            className={`i2v-kf-marker${Math.abs(localSlideTime - kf.time) < 0.03 ? " is-selected" : ""}`}
                            style={{ left: `${((activeSlideBounds.start + kf.time) / totalDuration) * 100}%` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
