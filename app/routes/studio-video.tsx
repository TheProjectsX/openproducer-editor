import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/studio-video";
import { CustomMediaPreview } from "../components/custom-media-preview";
import { createProject, getProject, readVideoAsset, saveVideoTimeline, type VideoAspectRatioMode, type VideoClipTransform, type VideoTimelineAsset, type VideoTimelineClip, type VideoTimelineProject } from "../lib/project-store";
import { drawVideoComposition, getClipLength } from "../lib/video-composition";
import { evaluateClipKeyframes, evaluateClipTransition, upsertClipKeyframe } from "../lib/video-keyframes";
import { renderTimelineAudio } from "../lib/audio-timeline-render";
import { canPlaceAssetOnTrack, canvasDimensionsForAspect, resolveTimelinePlacement, timelineContentWidth, timelineDropStart, timelineRulerOffset, timelineTimeAtPointer, timelineZoomScrollLeft, visibleTimelineTracks, zoomPixelsPerSecond } from "../lib/video-timeline";
import { inspectMediaFile } from "../lib/media-inspection";
import wasmUrl from "bungee-web/bungee.wasm?url";

const EMPTY: VideoTimelineProject = { version: 1, width: 1920, height: 1080, aspectRatioMode: "original", fps: 30, duration: 0, playhead: 0, assets: [], clips: [] };
const ASPECT_RATIOS: { label: string; value: VideoAspectRatioMode; ratio?: number }[] = [
  { label: "Original", value: "original" }, { label: "Custom", value: "custom" },
  { label: "16:9", value: "16:9", ratio: 16 / 9 }, { label: "4:3", value: "4:3", ratio: 4 / 3 },
  { label: "2.35:1", value: "2.35:1", ratio: 2.35 }, { label: "2:1", value: "2:1", ratio: 2 },
  { label: "1.85:1", value: "1.85:1", ratio: 1.85 }, { label: "9:16", value: "9:16", ratio: 9 / 16 },
  { label: "3:4", value: "3:4", ratio: 3 / 4 }, { label: "1:1", value: "1:1", ratio: 1 },
];
const MAX_ASSET_BYTES = 256 * 1024 * 1024;
const IDENTITY_TRANSFORM: VideoClipTransform = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };

export function meta({}: Route.MetaArgs) { return [{ title: "Video Studio | Local Studio" }, { name: "robots", content: "noindex,nofollow" }]; }

const clipLength = getClipLength;

function formatTimecode(seconds: number, fps: number) {
  const frameRate = Math.max(1, Math.round(fps));
  const totalFrames = Math.max(0, Math.floor(seconds * frameRate));
  const hours = Math.floor(totalFrames / (frameRate * 3600));
  const minutes = Math.floor(totalFrames / (frameRate * 60)) % 60;
  const wholeSeconds = Math.floor(totalFrames / frameRate) % 60;
  const frames = totalFrames % frameRate;
  return [hours, minutes, wholeSeconds, frames].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatAssetDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const remainingSeconds = totalSeconds % 60;
  return (hours ? [hours, minutes, remainingSeconds] : [minutes, remainingSeconds]).map((value) => String(value).padStart(2, "0")).join(":");
}

function EditorRange({ label, value, min, max, step = 0.001, unit = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  return <label className="editor-range-control"><span>{label}<output>{value.toFixed(3)}{unit}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} /></label>;
}

function updateClipTimeline(current: VideoTimelineProject, id: string, patch: Partial<VideoTimelineClip>, playhead: number, ripplePrimaryTrack: boolean) {
  const clips = current.clips.map((clip) => {
    if (clip.id !== id) return clip;
    const updated = { ...clip, ...patch };
    if (clip.keyframes?.length && (patch.transform || patch.volume !== undefined)) {
      const time = Math.max(0, Math.min(clipLength(clip), playhead - clip.start));
      const values = evaluateClipKeyframes(clip, time);
      updated.keyframes = upsertClipKeyframe(clip, { time, transform: patch.transform ?? values.transform, volume: patch.volume ?? values.volume });
    }
    return updated;
  });
  const previous = current.clips.find((clip) => clip.id === id);
  const changed = clips.find((clip) => clip.id === id);
  const timingEdit = patch.sourceStart !== undefined || patch.sourceEnd !== undefined || patch.speed !== undefined;
  const endDelta = previous && changed ? changed.start + clipLength(changed) - (previous.start + clipLength(previous)) : 0;
  const rippled = timingEdit && ripplePrimaryTrack && previous?.track === 0 && Math.abs(endDelta) > 0.0001
    ? clips.map((clip) => clip.id !== id && clip.track === 0 && clip.start > previous.start + 0.001 ? { ...clip, start: Math.max(0, clip.start + endDelta) } : clip)
    : clips;
  return { ...current, clips: rippled, duration: Math.max(0, ...rippled.map((clip) => clip.start + clipLength(clip))) };
}

export default function VideoStudio() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") ?? "";
  const [timeline, setTimeline] = useState<VideoTimelineProject>(EMPTY);
  const [projectTitle, setProjectTitle] = useState("");
  const [files, setFiles] = useState<Record<string, File>>({});
  const [selected, setSelected] = useState("");
  const [hoveredClipId, setHoveredClipId] = useState("");
  const [activeBinTab, setActiveBinTab] = useState<"media" | "library" | "text" | "transitions">("media");
  const [libraryTab, setLibraryTab] = useState<"image" | "video" | "sound">("image");
  const [libraryBackgroundColor, setLibraryBackgroundColor] = useState("#000000");
  const [inspectorTab, setInspectorTab] = useState<"basic" | "speed" | "adjust">("basic");
  const [exportOpen, setExportOpen] = useState(false);
  const [status, setStatus] = useState("Create a video project from Projects, or import files to begin.");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [mediaRevision, setMediaRevision] = useState(0);
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({});
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState("60");
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapThreshold, setSnapThreshold] = useState("0.2");
  const [dropPreview, setDropPreview] = useState<{ track: number; start: number; duration: number } | null>(null);
  const [binDragPreview, setBinDragPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const [activeTrackDragKind, setActiveTrackDragKind] = useState<"visual" | "audio" | null>(null);
  const draggingRef = useRef<{ kind: "asset" | "clip"; id: string; grabOffset: number } | null>(null);
  const binPointerRef = useRef<{ pointerId: number; id: string; initialX: number; initialY: number; dragging: boolean } | null>(null);
  const suppressBinClickRef = useRef(false);
  const [ripplePrimaryTrack, setRipplePrimaryTrack] = useState(true);
  const [transitionDuration, setTransitionDuration] = useState("0.5");
  const [replacementAudioAssetId, setReplacementAudioAssetId] = useState("");
  const [replacementAudioOffset, setReplacementAudioOffset] = useState("0");
  const [exporting, setExporting] = useState(false);
  const [extractingAudio, setExtractingAudio] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [exportProgress, setExportProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState("");
  const [resultType, setResultType] = useState("");
  const [videoBitrate, setVideoBitrate] = useState("4");
  const [audioBitrate, setAudioBitrate] = useState("160");
  const [frameRateDraft, setFrameRateDraft] = useState("30");
  const [widthDraft, setWidthDraft] = useState("1920");
  const [heightDraft, setHeightDraft] = useState("1080");
  const cancelExportRef = useRef(false);
  const cancelOutputRef = useRef<(() => void) | null>(null);
  const audioConversionRef = useRef<import("mediabunny").Conversion | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const textGestureRef = useRef<{ id: string; pointerId: number; mode: "move" | "scale" | "rotate"; x: number; y: number; transform: VideoClipTransform; original: VideoTimelineProject; fit: number; centerX: number; centerY: number } | null>(null);
  const previewRef = useRef<HTMLElement>(null);
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const previewAudioContextRef = useRef<AudioContext | null>(null);
  const previewMediaSourcesRef = useRef<Record<string, MediaElementAudioSourceNode>>({});
  const previewGainNodesRef = useRef<Record<string, GainNode>>({});
  const imageRefs = useRef<Record<string, HTMLImageElement>>({});
  const timelineRef = useRef(timeline);
  const drawFrameRef = useRef<(time?: number) => void>(() => undefined);
  const historyRef = useRef({ past: [] as VideoTimelineProject[], future: [] as VideoTimelineProject[] });
  const trimDragRef = useRef<{ clip: VideoTimelineClip; timeline: VideoTimelineProject; edge: "left" | "right"; pointerId: number; initialX: number } | null>(null);
  const playheadDragRef = useRef<{ pointerId: number; initialX: number; initialTime: number } | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const pendingZoomAnchorRef = useRef<{ time: number; pointerX: number } | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  timelineRef.current = timeline;
  const selectedClip = timeline.clips.find((clip) => clip.id === selected);
  const mainClipAtPlayhead = timeline.clips.find((clip) => clip.track === 0 && timeline.playhead > clip.start && timeline.playhead < clip.start + clipLength(clip));
  const hoveredClip = timeline.clips.find((clip) => clip.id === hoveredClipId);
  // The side-trim buttons act on the clip the pointer last touched. This matters
  // because their toolbar sits outside the timeline and selected may be stale.
  const timelineEditTarget = hoveredClip ?? selectedClip ?? mainClipAtPlayhead ?? timeline.clips[0];
  const selectedAsset = selectedClip && timeline.assets.find((asset) => asset.id === selectedClip.assetId);
  const availableAudioAssets = timeline.assets.filter((asset) => asset.kind === "audio");
  const selectedReplacementAudioAssetId = availableAudioAssets.some((asset) => asset.id === replacementAudioAssetId) ? replacementAudioAssetId : availableAudioAssets[0]?.id ?? "";
  const selectedValues = selectedClip ? evaluateClipKeyframes(selectedClip, Math.max(0, timeline.playhead - selectedClip.start)) : null;
  const selectedTransform = selectedValues?.transform ?? IDENTITY_TRANSFORM;
  const sourceFile = selectedClip ? files[selectedClip.assetId] : undefined;
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => setStageSize({ width: stage.clientWidth, height: stage.clientHeight }));
    observer.observe(stage);
    setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    return () => observer.disconnect();
  }, []);
  const activeTitleClip = timeline.clips.filter((clip) => clip.track >= 0 && timeline.playhead >= clip.start && timeline.playhead < clip.start + clipLength(clip) && timeline.assets.some((asset) => asset.id === clip.assetId && asset.kind === "text")).sort((a, b) => b.track - a.track)[0];
  const editableTitleClip = selectedAsset?.kind === "text" && selectedClip?.id === activeTitleClip?.id ? selectedClip : activeTitleClip;
  const editableTitleAsset = editableTitleClip && timeline.assets.find((asset) => asset.id === editableTitleClip.assetId);
  const editableTitleTransform = editableTitleClip ? evaluateClipKeyframes(editableTitleClip, timeline.playhead - editableTitleClip.start).transform : IDENTITY_TRANSFORM;
  const titleOverlay = editableTitleAsset?.textSettings && stageSize.width && stageSize.height && typeof document !== "undefined" ? (() => {
    const settings = editableTitleAsset.textSettings;
    const font = Math.max(8, Math.min(512, settings.fontSize * editableTitleTransform.scale));
    const measure = document.createElement("canvas").getContext("2d");
    if (measure) measure.font = `700 ${font}px system-ui, sans-serif`;
    const lines = settings.text.split("\n");
    const width = Math.max(font, ...lines.map((line) => measure?.measureText(line).width ?? line.length * font * 0.6)) + font * 0.7;
    const height = lines.length * font * 1.2 + font * 0.4;
    const fit = Math.min(stageSize.width / timeline.width, stageSize.height / timeline.height);
    return { width: Math.max(36, width * fit), height: Math.max(24, height * fit), left: stageSize.width / 2 + editableTitleTransform.x * fit, top: stageSize.height / 2 + editableTitleTransform.y * fit, fit };
  })() : null;

  function setPreviewGain(element: HTMLMediaElement, clipId: string, gain: number) {
    const context = previewAudioContextRef.current ?? (previewAudioContextRef.current = new AudioContext());
    if (!previewMediaSourcesRef.current[clipId]) {
      const source = context.createMediaElementSource(element);
      const gainNode = context.createGain();
      source.connect(gainNode); gainNode.connect(context.destination);
      previewMediaSourcesRef.current[clipId] = source;
      previewGainNodesRef.current[clipId] = gainNode;
    }
    previewGainNodesRef.current[clipId].gain.value = Math.max(0, Math.min(4, gain));
  }

  async function createVideoProject() {
    try {
      const project = await createProject("Untitled video", "video");
      setProjectTitle(project.title);
      setError("");
      setParams({ project: project.id });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create a local video project."); }
  }

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (!projectId) { setProjectTitle(""); setError(""); return; }
    void (async () => {
      try {
        const project = await getProject(projectId);
        if (!project || project.kind !== "video") throw new Error("This video workspace is missing or has the wrong project type.");
        setProjectTitle(project.title);
        const saved = project.videoTimeline ?? EMPTY;
        const loaded = await Promise.all(saved.assets.map(async (asset) => [asset.id, await readVideoAsset(asset.id)] as const));
        if (cancelled) return;
        const restored = Object.fromEntries(loaded.filter((item): item is readonly [string, File] => Boolean(item[1])));
        setFiles(restored); setTimeline(saved); setSelected(saved.clips[0]?.id ?? "");
        setFrameRateDraft(String(saved.fps));
        setWidthDraft(String(saved.width)); setHeightDraft(String(saved.height));
        setReady(true);
        setStatus(`Project “${project.title}” loaded. ${saved.assets.length} media item(s) restored.`);
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not open this video project."); }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !ready || playing) return;
    const timeout = window.setTimeout(() => {
      void saveVideoTimeline(projectId, timeline).then(() => setStatus("Timeline saved on this device.")).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not save the video timeline."));
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [projectId, ready, timeline, playing]);

  const previewClip = timeline.clips.filter((clip) => clip.track >= 0 && timeline.playhead >= clip.start && timeline.playhead < clip.start + clipLength(clip)).sort((a, b) => b.track - a.track)[0];
  const previewAsset = previewClip && timeline.assets.find((asset) => asset.id === previewClip.assetId);
  const assetUrls = useMemo(() => Object.fromEntries(Object.entries(files).map(([id, file]) => [id, URL.createObjectURL(file)])), [files]);
  useEffect(() => () => { for (const url of Object.values(assetUrls)) URL.revokeObjectURL(url); }, [assetUrls]);
  useEffect(() => {
    let cancelled = false;
    const waveformAssets = timeline.assets.filter((asset) => files[asset.id] && (asset.kind === "audio" || (asset.kind === "video" && asset.hasAudio !== false)));
    if (!waveformAssets.length) { setWaveforms({}); return; }
    void (async () => {
      const results: Record<string, number[]> = {};
      const { ALL_FORMATS, AudioBufferSink, BlobSource, Input } = await import("mediabunny");
      for (const asset of waveformAssets) {
        const file = files[asset.id];
        if (!file) continue;
        const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
        try {
          const track = (await input.getAudioTracks())[0];
          if (!track) continue;
          const sink = new AudioBufferSink(track);
          const duration = Math.max(0.001, asset.duration);
          const bucketCount = Math.min(8192, Math.max(180, Math.ceil(duration * 16)));
          const peaks = new Float32Array(bucketCount);
          for await (const chunk of sink.buffers(0, duration)) {
            const buffer = chunk.buffer;
            const stride = Math.max(1, Math.floor(buffer.sampleRate * duration / (peaks.length * 80)));
            for (let frame = 0; frame < buffer.length; frame += stride) {
              const time = chunk.timestamp + frame / buffer.sampleRate;
              const bucket = Math.floor(time / duration * peaks.length);
              if (bucket < 0 || bucket >= peaks.length) continue;
              let peak = peaks[bucket];
              for (let channel = 0; channel < buffer.numberOfChannels; channel++) peak = Math.max(peak, Math.abs(buffer.getChannelData(channel)[frame] ?? 0));
              peaks[bucket] = peak;
            }
          }
          const sourcePeak = Math.max(...peaks, 0.000001);
          results[asset.id] = Array.from(peaks, (peak) => Math.min(1, peak / sourcePeak));
        } catch { /* Leave unsupported audio streams without a fabricated waveform. */ }
        finally { input.dispose(); }
      }
      if (!cancelled) setWaveforms(results);
    })();
    return () => { cancelled = true; };
  }, [timeline.assets, files]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);
  drawFrameRef.current = (time) => {
    const current = timelineRef.current;
    const canvas = canvasRef.current;
    const position = time ?? current.playhead;
    if (!canvas) return;
    const active = current.clips.filter((clip) => clip.track >= 0 && position >= clip.start && position < clip.start + clipLength(clip));
    for (const clip of current.clips.filter((item) => current.assets.find((asset) => asset.id === item.assetId)?.kind === "video")) {
      const video = videoRefs.current[clip.id];
      if (!video) continue;
      if (!active.some((item) => item.id === clip.id)) { video.pause(); continue; }
      const expected = clip.sourceStart + (position - clip.start) * clip.speed;
      video.playbackRate = clip.speed;
      video.preservesPitch = (clip.pitchMode ?? "preserve") === "preserve";
      const localTime = Math.max(0, position - clip.start);
      setPreviewGain(video, clip.id, clip.muted ? 0 : evaluateClipKeyframes(clip, localTime).volume * evaluateClipTransition(clip, localTime));
      video.volume = 1;
      video.muted = clip.muted;
      if (Math.abs(video.currentTime - expected) > (playing ? 0.35 : 0.02)) video.currentTime = expected;
      if (playing) void video.play().catch(() => undefined); else video.pause();
    }
    drawVideoComposition(canvas, current, position, { videos: videoRefs.current, images: imageRefs.current }, current.assets);
    for (const clip of current.clips.filter((item) => item.track < 0)) {
      const audio = audioRefs.current[clip.id];
      if (!audio) continue;
      const isActive = current.playhead >= clip.start && current.playhead < clip.start + clipLength(clip);
      if (!isActive) { audio.pause(); continue; }
      const expected = clip.sourceStart + (current.playhead - clip.start) * clip.speed;
      if (Math.abs(audio.currentTime - expected) > 0.35) audio.currentTime = expected;
      audio.playbackRate = clip.speed; audio.preservesPitch = (clip.pitchMode ?? "preserve") === "preserve";
      const localTime = Math.max(0, current.playhead - clip.start);
      setPreviewGain(audio, clip.id, clip.muted ? 0 : evaluateClipKeyframes(clip, localTime).volume * evaluateClipTransition(clip, localTime));
      audio.volume = 1; audio.muted = clip.muted;
      if (playing && audio.paused) void audio.play().catch(() => setError("Audio preview was blocked by this browser. Press Play again to allow local audio preview."));
      if (!playing && !audio.paused) audio.pause();
    }
  };
  useEffect(() => {
    if (exporting) return;
    let frame = 0;
    const render = () => { drawFrameRef.current(); if (playing) frame = requestAnimationFrame(render); };
    render();
    return () => cancelAnimationFrame(frame);
  }, [playing, exporting, timeline.width, timeline.height, timeline.assets, timeline.clips, timeline.playhead, files, mediaRevision]);
  useEffect(() => { if (!playing) drawFrameRef.current(); }, [timeline.playhead, playing]);
  useEffect(() => { if (!timeline.clips.length || timeline.duration <= 0) setPlaying(false); }, [timeline.clips.length, timeline.duration]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const timer = window.setInterval(() => { const now = performance.now(); const delta = Math.min((now - last) / 1000, 0.25); last = now; setTimeline((current) => ({ ...current, playhead: current.duration > 0 && current.playhead >= current.duration ? 0 : current.playhead + delta })); }, 100);
    return () => window.clearInterval(timer);
  }, [playing]);

  async function importFiles(list: FileList | File[] | null) {
    if (!list?.length) return;
    setError("");
    const baseTimeline = projectId ? timeline : EMPTY;
    const assets: VideoTimelineAsset[] = [];
    const nextFiles: Record<string, File> = {};
    const inspectedMedia: string[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_ASSET_BYTES) { setError(`${file.name} is over the 256 MiB per-file limit.`); continue; }
      const id = crypto.randomUUID(); let duration = 0; let kind: VideoTimelineAsset["kind"] | null = null;
      let mediaWidth: number | undefined; let mediaHeight: number | undefined; let hasAudio: boolean | undefined;
      if (file.type.startsWith("image/")) {
        try {
          const bitmap = await createImageBitmap(file);
          const oversized = bitmap.width * bitmap.height > 100_000_000 || Math.max(bitmap.width, bitmap.height) > 32_768;
          mediaWidth = bitmap.width; mediaHeight = bitmap.height;
          bitmap.close();
          if (oversized) { setError(`${file.name} exceeds the 100-megapixel or 32,768-pixel side limit.`); continue; }
          kind = "image"; duration = 3600;
        } catch { /* The declared MIME may be wrong; inspect it as container media below. */ }
      }
      if (!kind) {
        try {
          const inspection = await inspectMediaFile(file);
          kind = inspection.tracks.some((track) => track.kind === "video") ? "video" : "audio";
          duration = inspection.duration ?? 0;
          const visualTrack = inspection.tracks.find((track) => track.kind === "video");
          mediaWidth = visualTrack?.width; mediaHeight = visualTrack?.height;
          hasAudio = inspection.tracks.some((track) => track.kind === "audio");
          const trackSummary = inspection.tracks.map((track) => `${track.kind} ${track.codec}`).join(" + ");
          inspectedMedia.push(`${file.name}: ${inspection.container}, ${trackSummary}`);
        } catch (cause) {
          setError(cause instanceof Error ? `${file.name}: ${cause.message}` : `Could not inspect ${file.name}.`);
          continue;
        }
      }
      if (!kind) { setError(`${file.name} is not a supported video, audio, or image file.`); continue; }
      if (!duration) { setError(`Could not read a usable duration for ${file.name}.`); continue; }
      const asset = { id, name: file.name, type: file.type, size: file.size, duration, kind, width: mediaWidth, height: mediaHeight, hasAudio } satisfies VideoTimelineAsset;
      if ([...baseTimeline.assets, ...assets].reduce((total, item) => total + item.size, file.size) > 512 * 1024 * 1024) { setError("The total local media limit for this prototype is 512 MiB per project."); continue; }
      assets.push(asset); nextFiles[id] = file;
    }
    if (!assets.length) return;
    const updated = { ...baseTimeline, assets: [...baseTimeline.assets, ...assets] };
    try {
      const targetProject = projectId || (await createProject("Untitled video", "video")).id;
      await saveVideoTimeline(targetProject, updated, assets.map((asset) => ({ id: asset.id, file: nextFiles[asset.id] })));
      if (projectId) { setFiles((current) => ({ ...current, ...nextFiles })); applyTimelineEdit(() => updated); }
      else setParams({ project: targetProject });
      setStatus(`${assets.length} media item(s) imported into the bin. Drag one onto a track or click it to add it to the timeline.${inspectedMedia.length ? ` Decoder support confirmed: ${inspectedMedia.join("; ")}.` : ""}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save imported media in this browser."); }
  }

  async function addLibraryColorBackground() {
    const color = /^#[0-9a-f]{6}$/i.test(libraryBackgroundColor) ? libraryBackgroundColor : "#808080";
    const file = new File([`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="${color}"/></svg>`], `Color background ${color}.svg`, { type: "image/svg+xml" });
    const current = projectId ? timelineRef.current : EMPTY;
    const asset: VideoTimelineAsset = { id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, duration: 3600, kind: "image", width: 1920, height: 1080 };
    const track = 0;
    const start = Math.max(current.playhead, ...current.clips.filter((clip) => clip.track === track).map((clip) => clip.start + clipLength(clip)), 0);
    const clip: VideoTimelineClip = { id: crypto.randomUUID(), assetId: asset.id, track, start, sourceStart: 0, sourceEnd: 5, speed: 1, volume: 1, muted: false };
    const updated = { ...current, assets: [...current.assets, asset], clips: [...current.clips, clip], duration: Math.max(current.duration, start + clipLength(clip)) };
    try {
      const targetProject = projectId || (await createProject("Untitled video", "video")).id;
      await saveVideoTimeline(targetProject, updated, [{ id: asset.id, file }]);
      if (projectId) {
        setFiles((previous) => ({ ...previous, [asset.id]: file }));
        applyTimelineEdit(() => updated);
      } else {
        timelineRef.current = updated; setTimeline(updated); setFiles({ [asset.id]: file }); setParams({ project: targetProject });
      }
      setSelected(clip.id); setHoveredClipId(clip.id); setStatus(`Added ${file.name} to Video 1. The SVG and project stay on this device.`); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this library background locally."); }
  }

  function placementForDrop(track: number, pointerTime: number, drag: { kind: "asset" | "clip"; id: string; grabOffset: number }) {
    const current = timelineRef.current;
    const draggedClip = drag.kind === "clip" ? current.clips.find((clip) => clip.id === drag.id) : null;
    const asset = current.assets.find((item) => item.id === (draggedClip?.assetId ?? drag.id));
    if (!asset || !canPlaceAssetOnTrack(asset.kind, track)) return null;
    const duration = draggedClip ? clipLength(draggedClip) : asset.kind === "image" ? 5 : asset.duration;
    const desiredStart = drag.kind === "clip" ? timelineDropStart(pointerTime, drag.grabOffset, pxPerSecond) : pointerTime;
    const neighbors = current.clips.filter((clip) => clip.track === track && clip.id !== draggedClip?.id)
      .map((clip) => ({ id: clip.id, start: clip.start, end: clip.start + clipLength(clip) }));
    return { duration, ...resolveTimelinePlacement(desiredStart, duration, neighbors, Number(snapThreshold), snapEnabled) };
  }
  function addAssetToTimeline(assetId: string, targetTrack?: number, targetStart?: number) {
    const current = timelineRef.current;
    const asset = current.assets.find((item) => item.id === assetId);
    if (!asset || asset.kind === "text") return;
    let track = targetTrack ?? (asset.kind === "audio" ? -1 : 0);
    if ((asset.kind === "audio") !== (track < 0)) { setError("Drop audio on an audio track and video or images on a video track."); return; }
    if (asset.kind === "audio" && targetStart !== undefined && current.clips.some((item) => item.track === track && targetStart < item.start + clipLength(item) && targetStart + asset.duration > item.start)) {
      track = Math.min(0, ...current.clips.map((item) => item.track)) - 1;
    }
    const sameTrackEnd = Math.max(0, ...current.clips.filter((item) => item.track === track).map((item) => item.start + clipLength(item)));
    const placement = placementForDrop(track, targetStart ?? (asset.kind === "audio" ? sameTrackEnd : Math.max(current.playhead, sameTrackEnd)), { kind: "asset", id: assetId, grabOffset: 0 });
    if (!placement) return;
    const { start, shiftedStarts } = placement;
    const clip: VideoTimelineClip = { id: crypto.randomUUID(), assetId, track, start, sourceStart: 0, sourceEnd: asset.kind === "image" ? 5 : asset.duration, speed: 1, volume: 1, muted: false, ...(asset.kind === "audio" ? { pitchMode: "preserve" as const } : {}) };
    const firstVisual = track >= 0 && !current.clips.some((item) => item.track >= 0 && current.assets.some((entry) => entry.id === item.assetId && (entry.kind === "video" || entry.kind === "image")));
    const dimensions = firstVisual && (current.aspectRatioMode ?? "custom") === "original" && asset.width && asset.height
      ? canvasDimensionsForAspect(asset.width / asset.height) : null;
    applyTimelineEdit((previous) => {
      const clips = [...previous.clips.map((item) => shiftedStarts[item.id] === undefined ? item : { ...item, start: shiftedStarts[item.id] }), clip];
      return { ...previous, ...dimensions, clips, duration: Math.max(0, ...clips.map((item) => item.start + clipLength(item))) };
    });
    if (dimensions) { setWidthDraft(String(dimensions.width)); setHeightDraft(String(dimensions.height)); }
    setSelected(clip.id); setError("");
  }
  function moveClipToTrack(id: string, track: number, pointerTime: number, grabOffset: number) {
    const placement = placementForDrop(track, pointerTime, { kind: "clip", id, grabOffset });
    if (!placement) { setError("Drop text on an overlay lane, audio on an audio lane, and video or images on a visual lane."); return; }
    applyTimelineEdit((current) => {
      const clips = current.clips.map((clip) => clip.id === id ? { ...clip, track, start: placement.start }
        : placement.shiftedStarts[clip.id] === undefined ? clip : { ...clip, start: placement.shiftedStarts[clip.id] });
      return { ...current, clips, duration: Math.max(0, ...clips.map((clip) => clip.start + clipLength(clip))) };
    });
    setSelected(id); setError("");
  }
  function binTrackAtPointer(clientX: number, clientY: number) {
    const lane = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(".track-lane");
    const track = Number(lane?.dataset.track);
    return lane && Number.isInteger(track) ? { lane, track } : null;
  }
  function moveBinPointer(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = binPointerRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.dragging && Math.hypot(event.clientX - drag.initialX, event.clientY - drag.initialY) < 6) return;
    drag.dragging = true;
    setBinDragPreview({ id: drag.id, x: event.clientX, y: event.clientY });
    const target = binTrackAtPointer(event.clientX, event.clientY);
    const asset = timelineRef.current.assets.find((item) => item.id === drag.id);
    const placement = target && asset?.kind !== "audio" && placementForDrop(target.track, timelinePointerTime(event, target.lane), { kind: "asset", id: drag.id, grabOffset: 0 });
    setDropPreview(placement && target ? { track: target.track, start: placement.start, duration: placement.duration } : null);
  }
  function finishBinPointer(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = binPointerRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    binPointerRef.current = null;
    setBinDragPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.dragging) {
      event.preventDefault();
      suppressBinClickRef.current = true;
      window.setTimeout(() => { suppressBinClickRef.current = false; }, 0);
      const target = binTrackAtPointer(event.clientX, event.clientY);
      const asset = timelineRef.current.assets.find((item) => item.id === drag.id);
      const overTimeline = document.elementFromPoint(event.clientX, event.clientY)?.closest(".timeline-scroll");
      if (asset?.kind === "audio" && overTimeline) {
        if (target && target.track < 0) addAssetToTimeline(drag.id, target.track, timelinePointerTime(event, target.lane));
        else addAssetToTimeline(drag.id);
      } else if (target) addAssetToTimeline(drag.id, target.track, timelinePointerTime(event, target.lane));
    }
    setDropPreview(null);
  }
  function cancelBinPointer() { binPointerRef.current = null; setBinDragPreview(null); setDropPreview(null); }

  function selectAspectRatio(mode: VideoAspectRatioMode) {
    const firstClip = [...timeline.clips].filter((clip) => clip.track >= 0 && timeline.assets.some((asset) => asset.id === clip.assetId && (asset.kind === "video" || asset.kind === "image"))).sort((a, b) => a.start - b.start)[0];
    const firstAsset = firstClip && timeline.assets.find((asset) => asset.id === firstClip.assetId);
    const video = firstClip && videoRefs.current[firstClip.id];
    const image = firstAsset && imageRefs.current[firstAsset.id];
    const originalWidth = firstAsset?.width ?? video?.videoWidth ?? image?.naturalWidth;
    const originalHeight = firstAsset?.height ?? video?.videoHeight ?? image?.naturalHeight;
    const ratio = mode === "original" ? originalWidth && originalHeight ? originalWidth / originalHeight : null : ASPECT_RATIOS.find((item) => item.value === mode)?.ratio;
    const dimensions = ratio ? canvasDimensionsForAspect(ratio) : null;
    applyTimelineEdit((current) => ({ ...current, aspectRatioMode: mode, ...dimensions }));
    if (dimensions) { setWidthDraft(String(dimensions.width)); setHeightDraft(String(dimensions.height)); }
  }

  function commitCustomCanvas() {
    const width = Number(widthDraft); const height = Number(heightDraft);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 16 || height < 16 || width > 7680 || height > 4320 || width * height > 4_000_000) {
      setError("Enter whole-number canvas dimensions from 16 px to 4 megapixels."); return;
    }
    applyTimelineEdit((current) => ({ ...current, aspectRatioMode: "custom", width, height }));
    setError("");
  }

  function editClip(id: string, patch: Partial<VideoTimelineClip>) {
    applyTimelineEdit((current) => updateClipTimeline(current, id, patch, timeline.playhead, ripplePrimaryTrack));
  }
  function beginTextGesture(event: React.PointerEvent<HTMLDivElement>) {
    if (!editableTitleClip || !titleOverlay) return;
    event.preventDefault(); event.stopPropagation(); setPlaying(false);
    const mode = ((event.target as HTMLElement).closest("[data-title-handle]")?.getAttribute("data-title-handle") ?? "move") as "move" | "scale" | "rotate";
    const bounds = event.currentTarget.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2; const centerY = bounds.top + bounds.height / 2;
    setSelected(editableTitleClip.id);
    textGestureRef.current = { id: editableTitleClip.id, pointerId: event.pointerId, mode, x: event.clientX, y: event.clientY, transform: { ...editableTitleTransform }, original: timelineRef.current, fit: titleOverlay.fit, centerX, centerY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveTextGesture(event: React.PointerEvent<HTMLDivElement>) {
    const drag = textGestureRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x; const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) < 1) return;
    const transform = { ...drag.transform };
    if (drag.mode === "move") { transform.x += dx / drag.fit; transform.y += dy / drag.fit; }
    if (drag.mode === "scale") {
      const before = Math.hypot(drag.x - drag.centerX, drag.y - drag.centerY);
      const after = Math.hypot(event.clientX - drag.centerX, event.clientY - drag.centerY);
      transform.scale = Math.max(0.1, Math.min(8, drag.transform.scale * after / Math.max(1, before)));
    }
    if (drag.mode === "rotate") {
      const before = Math.atan2(drag.y - drag.centerY, drag.x - drag.centerX);
      const after = Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX);
      transform.rotation = drag.transform.rotation + (after - before) * 180 / Math.PI;
    }
    const updated = updateClipTimeline(drag.original, drag.id, { transform }, drag.original.playhead, ripplePrimaryTrack);
    timelineRef.current = updated; setTimeline(updated);
  }
  function finishTextGesture(event: React.PointerEvent<HTMLDivElement>) {
    const drag = textGestureRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    textGestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (timelineRef.current !== drag.original) {
      historyRef.current.past.push(drag.original);
      if (historyRef.current.past.length > 50) historyRef.current.past.shift();
      historyRef.current.future = [];
      setHistoryVersion((value) => value + 1);
    }
  }
  function alignSelectedVideo(horizontal: "left" | "center" | "right", vertical: "top" | "middle" | "bottom") {
    if (!selectedClip || !selectedAsset) return;
    const sourceWidth = selectedAsset.width ?? timeline.width;
    const sourceHeight = selectedAsset.height ?? timeline.height;
    const fit = Math.min(timeline.width / sourceWidth, timeline.height / sourceHeight) * selectedTransform.scale;
    const spareX = Math.max(0, (timeline.width - sourceWidth * fit) / 2);
    const spareY = Math.max(0, (timeline.height - sourceHeight * fit) / 2);
    editClip(selectedClip.id, { transform: { ...selectedTransform,
      x: horizontal === "left" ? -spareX : horizontal === "right" ? spareX : 0,
      y: vertical === "top" ? -spareY : vertical === "bottom" ? spareY : 0,
    } });
  }
  function beginTrim(event: React.PointerEvent<HTMLSpanElement>, clip: VideoTimelineClip, edge: "left" | "right") {
    event.preventDefault(); event.stopPropagation();
    const button = event.currentTarget.closest("button");
    if (!button) return;
    button.setPointerCapture(event.pointerId);
    const current = timelineRef.current;
    historyRef.current.past.push(current);
    if (historyRef.current.past.length > 50) historyRef.current.past.shift();
    historyRef.current.future = [];
    setHistoryVersion((value) => value + 1);
    trimDragRef.current = { clip, timeline: current, edge, pointerId: event.pointerId, initialX: event.clientX };
    setSelected(clip.id);
  }
  function moveTrim(event: React.PointerEvent<HTMLButtonElement>, clipId: string) {
    const drag = trimDragRef.current;
    if (!drag || drag.clip.id !== clipId || drag.pointerId !== event.pointerId) return;
    const delta = (event.clientX - drag.initialX) / pxPerSecond;
    const original = drag.clip;
    const asset = drag.timeline.assets.find((item) => item.id === original.assetId);
    let patch: Partial<VideoTimelineClip>;
    if (drag.edge === "left") {
      const desiredStart = Math.max(0, original.start + delta);
      const start = snapClipStart(desiredStart, original.id, original.track);
      const sourceStart = Math.max(0, Math.min(original.sourceEnd - 0.01, original.sourceStart + (start - original.start) * original.speed));
      patch = { start: original.start + (sourceStart - original.sourceStart) / original.speed, sourceStart };
    } else {
      const sourceEnd = Math.max(original.sourceStart + 0.01, Math.min(asset?.duration ?? original.sourceEnd, original.sourceEnd + delta * original.speed));
      patch = { sourceEnd };
    }
    const updated = updateClipTimeline(drag.timeline, clipId, patch, drag.timeline.playhead, ripplePrimaryTrack);
    timelineRef.current = updated; setTimeline(updated);
  }
  function finishTrim(event: React.PointerEvent<HTMLButtonElement>) {
    if (trimDragRef.current?.pointerId !== event.pointerId) return;
    trimDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function snapClipStart(value: number, clipId: string, track: number) {
    const target = Math.max(0, value);
    if (!snapEnabled) return target;
    const threshold = Math.max(0, Number(snapThreshold) || 0);
    const anchors = [timeline.playhead, Math.round(target), ...timeline.clips.filter((clip) => clip.id !== clipId && clip.track === track).flatMap((clip) => [clip.start, clip.start + clipLength(clip)])];
    const nearest = anchors.reduce((best, time) => Math.abs(time - target) < Math.abs(best - target) ? time : best, anchors[0]);
    return Math.abs(nearest - target) <= threshold ? Math.max(0, nearest) : target;
  }
  function addOrUpdateKeyframe() {
    if (!selectedClip) return;
    const time = Math.max(0, Math.min(clipLength(selectedClip), timeline.playhead - selectedClip.start));
    const values = evaluateClipKeyframes(selectedClip, time);
    editClip(selectedClip.id, { keyframes: upsertClipKeyframe(selectedClip, { time, ...values }) });
    setStatus(`Keyframe set at ${time.toFixed(2)} seconds in the selected clip.`);
  }
  async function detachVideoAudio() {
    if (!projectId || !selectedClip || selectedAsset?.kind !== "video") return;
    const videoFile = files[selectedAsset.id];
    if (!videoFile) { setError("The video source is missing. Re-import it before detaching audio."); return; }
    if (timeline.assets.some((asset) => asset.kind === "audio" && asset.derivedFromAssetId === selectedAsset.id)) { setError("Audio has already been detached from this source. Remove its audio asset before detaching again."); return; }
    setExtractingAudio(true); setExtractProgress(0); setError("");
    let input: import("mediabunny").Input | undefined;
    try {
      const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output, WavOutputFormat } = await import("mediabunny");
      input = new Input({ source: new BlobSource(videoFile), formats: ALL_FORMATS });
      const target = new BufferTarget();
      const output = new Output({ format: new WavOutputFormat(), target });
      const conversion = await Conversion.init({ input, output, tracks: "primary", video: { discard: true }, audio: { numberOfChannels: 2, sampleRate: 48_000, sampleFormat: "s16" } });
      audioConversionRef.current = conversion;
      if (!conversion.isValid || !conversion.utilizedTracks.length) throw new Error("This video has no primary audio track that the browser can detach.");
      conversion.onProgress = (value) => setExtractProgress(Math.round(value * 100));
      await conversion.execute();
      if (!target.buffer || target.buffer.byteLength > 512 * 1024 * 1024) throw new Error("The detached audio exceeds the 512 MiB project limit.");
      const audioFile = new File([target.buffer], `Audio - ${selectedAsset.name.replace(/\.[^.]+$/, "")}.wav`, { type: "audio/wav" });
      if (timelineRef.current.assets.reduce((total, asset) => total + asset.size, audioFile.size) > 512 * 1024 * 1024) throw new Error("Detaching this audio would exceed the 512 MiB total project media limit.");
      const audioId = crypto.randomUUID();
      const audioDuration = Math.max(0.01, (target.buffer.byteLength - 44) / (48_000 * 2 * 2));
      const audioAsset: VideoTimelineAsset = { id: audioId, name: audioFile.name, type: audioFile.type, size: audioFile.size, duration: audioDuration, kind: "audio", derivedFromAssetId: selectedAsset.id };
      const sourceEnd = Math.min(selectedClip.sourceEnd, audioDuration);
      if (sourceEnd <= selectedClip.sourceStart) throw new Error("The extracted audio track does not cover this video clip's selected source range.");
      const audioClip: VideoTimelineClip = { id: crypto.randomUUID(), assetId: audioId, track: -1, start: selectedClip.start, sourceStart: selectedClip.sourceStart, sourceEnd, speed: selectedClip.speed, volume: selectedClip.volume, muted: false, pitchMode: "preserve" };
      const current = timelineRef.current;
      const updated = { ...current, assets: [...current.assets, audioAsset], clips: [...current.clips.map((clip) => clip.id === selectedClip.id ? { ...clip, muted: true } : clip), audioClip], duration: Math.max(current.duration, audioClip.start + clipLength(audioClip)) };
      await saveVideoTimeline(projectId, updated, [{ id: audioId, file: audioFile }]);
      setFiles((previous) => ({ ...previous, [audioId]: audioFile }));
      applyTimelineEdit(() => updated); setSelected(audioClip.id); setStatus("Source audio detached into Audio 1 as a local editable WAV clip.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not detach the video's audio track."); }
    finally { audioConversionRef.current = null; setExtractingAudio(false); setExtractProgress(0); }
  }
  async function cancelAudioExtraction() {
    if (audioConversionRef.current) await audioConversionRef.current.cancel().catch(() => undefined);
  }
  function replaceVideoAudio() {
    if (!selectedClip || selectedAsset?.kind !== "video") return;
    const assetId = selectedReplacementAudioAssetId;
    const audioAsset = timeline.assets.find((asset) => asset.id === assetId && asset.kind === "audio");
    const offset = Number(replacementAudioOffset);
    if (!audioAsset) { setError("Import an audio source and select it before replacing clip audio."); return; }
    if (!Number.isFinite(offset) || offset < 0 || offset >= clipLength(selectedClip)) { setError("Audio offset must be a valid time inside the selected video clip."); return; }
    const sourceEnd = Math.min(audioAsset.duration, (clipLength(selectedClip) - offset) * selectedClip.speed);
    if (sourceEnd <= 0.01) { setError("The selected video clip is too short for this audio offset."); return; }
    const audioClip: VideoTimelineClip = { id: crypto.randomUUID(), assetId: audioAsset.id, track: -1, start: selectedClip.start + offset, sourceStart: 0, sourceEnd, speed: selectedClip.speed, volume: 1, muted: false, pitchMode: "preserve" };
    const detachedAssetId = timeline.assets.find((asset) => asset.kind === "audio" && asset.derivedFromAssetId === selectedAsset.id)?.id;
    applyTimelineEdit((current) => {
      const clips = current.clips.map((clip) => clip.id === selectedClip.id || (clip.assetId === detachedAssetId && Math.abs(clip.start - selectedClip.start) < 0.01) ? { ...clip, muted: true } : clip);
      const next = [...clips, audioClip];
      return { ...current, clips: next, duration: Math.max(0, ...next.map((clip) => clip.start + clipLength(clip))) };
    });
    setSelected(audioClip.id); setError(""); setStatus(`Replacement audio placed on Audio 1 at ${offset.toFixed(2)} seconds into the selected video clip.`);
  }
  function removeKeyframeAtPlayhead() {
    if (!selectedClip?.keyframes?.length) return;
    const time = Math.max(0, Math.min(clipLength(selectedClip), timeline.playhead - selectedClip.start));
    editClip(selectedClip.id, { keyframes: selectedClip.keyframes.filter((frame) => Math.abs(frame.time - time) >= 0.05) });
  }
  function createTransitionToNext(kind: "dissolve" | "crossfade") {
    if (!selectedClip || !selectedAsset) return;
    const candidates = timeline.clips.filter((clip) => clip.id !== selectedClip.id && clip.track === selectedClip.track && clip.start > selectedClip.start + 0.001)
      .sort((a, b) => a.start - b.start);
    const next = candidates[0];
    const nextAsset = next && timeline.assets.find((asset) => asset.id === next.assetId);
    const allowedKinds = kind === "dissolve" ? ["video", "image", "text"] : ["audio"];
    const duration = Number(transitionDuration);
    if (!next || !nextAsset || !allowedKinds.includes(selectedAsset.kind) || !allowedKinds.includes(nextAsset.kind)) {
      setError(`Select a ${kind === "dissolve" ? "visual" : "audio"} clip with a following clip on the same track.`); return;
    }
    const overlap = Math.max(0, Math.min(clipLength(selectedClip), clipLength(next), duration));
    if (!Number.isFinite(duration) || overlap <= 0 || overlap !== duration) {
      setError("Enter a transition duration greater than 0 and no longer than either clip."); return;
    }
    const nextStart = selectedClip.start + clipLength(selectedClip) - overlap;
    const changes = new Map<string, Partial<VideoTimelineClip>>();
    changes.set(selectedClip.id, { transitions: { fadeIn: selectedClip.transitions?.fadeIn ?? 0, fadeOut: kind === "crossfade" ? overlap : selectedClip.transitions?.fadeOut ?? 0 } });
    changes.set(next.id, { start: nextStart, transitions: { fadeIn: overlap, fadeOut: next.transitions?.fadeOut ?? 0 } });
    applyTimelineEdit((current) => ({
      ...current,
      clips: current.clips.map((clip) => changes.has(clip.id) ? { ...clip, ...changes.get(clip.id) } : clip),
      duration: Math.max(current.duration, ...current.clips.map((clip) => clip.id === next.id ? nextStart + clipLength(clip) : clip.start + clipLength(clip))),
    }));
    setError(""); setStatus(kind === "dissolve" ? "Dissolve added between adjacent visual clips." : "Audio crossfade added between adjacent clips.");
  }
  function addTitle() {
    const asset: VideoTimelineAsset = { id: crypto.randomUUID(), name: "Text title", type: "text/plain", size: 0, duration: 3600, kind: "text", textSettings: { text: "Your title", fontSize: 72, color: "#ffffff", backgroundColor: "#172033", showBackground: false } };
    const track = Math.max(0, ...timeline.clips.map((item) => item.track)) + 1;
    const clip: VideoTimelineClip = { id: crypto.randomUUID(), assetId: asset.id, track, start: timeline.playhead, sourceStart: 0, sourceEnd: 5, speed: 1, volume: 1, muted: false };
    applyTimelineEdit((current) => ({ ...current, assets: [...current.assets, asset], clips: [...current.clips, clip], duration: Math.max(current.duration, clip.start + clipLength(clip)) }));
    setSelected(clip.id);
  }
  function editTitleAsset(assetId: string, textSettings: NonNullable<VideoTimelineAsset["textSettings"]>) {
    applyTimelineEdit((current) => ({ ...current, assets: current.assets.map((asset) => asset.id === assetId ? { ...asset, textSettings } : asset) }));
  }
  function removeClip(id: string) {
    applyTimelineEdit((current) => {
      const clips = current.clips.filter((clip) => clip.id !== id);
      return { ...current, clips, duration: Math.max(0, ...clips.map((clip) => clip.start + clipLength(clip))) };
    });
    setSelected("");
  }
  function splitSelected() {
    const target = selectedClip ?? timeline.clips.find((clip) => clip.track === 0 && timeline.playhead > clip.start && timeline.playhead < clip.start + clipLength(clip));
    if (!target) return;
    const cut = timeline.playhead;
    if (cut <= target.start || cut >= target.start + clipLength(target)) { setError("Move the playhead inside the selected clip to split it."); return; }
    const sourceCut = target.sourceStart + (cut - target.start) * target.speed;
    const right = { ...target, id: crypto.randomUUID(), start: cut, sourceStart: sourceCut };
    applyTimelineEdit((current) => ({ ...current, clips: [...current.clips.map((clip) => clip.id === target.id ? { ...clip, sourceEnd: sourceCut } : clip), right] })); setSelected(right.id); setHoveredClipId(right.id); setError("");
  }
  function deleteHoveredSide(side: "left" | "right") {
    const current = timelineRef.current;
    const target = current.clips.find((clip) => clip.id === hoveredClipId)
      ?? current.clips.find((clip) => clip.id === selected)
      ?? current.clips.find((clip) => clip.track === 0 && current.playhead > clip.start && current.playhead < clip.start + clipLength(clip))
      ?? current.clips[0];
    if (!target) { setError("Add a clip to the timeline first."); return; }
    const targetName = current.assets.find((asset) => asset.id === target.assetId)?.name ?? "clip";
    const cut = current.playhead;
    const end = target.start + clipLength(target);
    if (cut <= target.start) {
      if (side === "left") { setError("The playhead is before this clip, so it has no left portion to delete."); return; }
      removeClip(target.id); setStatus(`Deleted ${targetName} to the right of the playhead.`); setError(""); return;
    }
    if (cut >= end) {
      if (side === "right") { setError("The playhead is after this clip, so it has no right portion to delete."); return; }
      removeClip(target.id); setStatus(`Deleted ${targetName} to the left of the playhead.`); setError(""); return;
    }
    const sourceCut = target.sourceStart + (cut - target.start) * target.speed;
    const patch = side === "left"
      ? { start: target.start, sourceStart: sourceCut }
      : { sourceEnd: sourceCut };
    applyTimelineEdit((latest) => updateClipTimeline(latest, target.id, patch, cut, ripplePrimaryTrack));
    setSelected(target.id); setStatus(`Deleted the ${side} part of ${targetName}.`); setError("");
  }
  const pxPerSecond = Math.max(12, Math.min(160, Number(zoom) || 60));
  const timelineWidth = timelineContentWidth(timeline.duration, pxPerSecond, timelineViewportWidth);
  useEffect(() => {
    const viewport = timelineScrollRef.current;
    if (!viewport) return;
    const updateWidth = () => setTimelineViewportWidth(viewport.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const anchor = pendingZoomAnchorRef.current;
    const viewport = timelineScrollRef.current;
    if (!anchor || !viewport) return;
    viewport.scrollLeft = timelineZoomScrollLeft(anchor.time, anchor.pointerX, pxPerSecond);
    pendingZoomAnchorRef.current = null;
  }, [pxPerSecond, timelineViewportWidth]);
  useEffect(() => {
    const viewport = timelineScrollRef.current;
    if (!viewport) return;
    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey || !viewport) return;
      event.preventDefault();
      const pointerX = event.clientX - viewport.getBoundingClientRect().left;
      const timeAtPointer = Math.max(0, (viewport.scrollLeft + pointerX - timelineRulerOffset()) / pxPerSecond);
      const next = zoomPixelsPerSecond(pxPerSecond, event.deltaY);
      if (next === pxPerSecond) return;
      pendingZoomAnchorRef.current = { time: timeAtPointer, pointerX };
      setZoom(String(next));
    }
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [pxPerSecond]);
  function timelinePointerTime(event: { clientX: number }, element: HTMLElement, leadingOffset = 0) {
    const viewport = element.closest(".timeline-scroll");
    const viewportLeft = (viewport ?? element).getBoundingClientRect().left;
    const scrollLeft = viewport?.scrollLeft ?? 0;
    const trackOffset = element.classList.contains("track-lane") ? timelineRulerOffset() : leadingOffset;
    return timelineTimeAtPointer(event.clientX, viewportLeft, scrollLeft, pxPerSecond, trackOffset);
  }
  function previewTrackDrop(event: React.DragEvent<HTMLDivElement>, track: number) {
    event.preventDefault();
    const drag = draggingRef.current;
    if (!drag) return;
    const placement = placementForDrop(track, timelinePointerTime(event, event.currentTarget), drag);
    if (!placement) { setDropPreview(null); event.dataTransfer.dropEffect = "none"; return; }
    event.dataTransfer.dropEffect = drag.kind === "asset" ? "copy" : "move";
    setDropPreview((previous) => previous?.track === track && Math.abs(previous.start - placement.start) < 0.001 && previous.duration === placement.duration
      ? previous : { track, start: placement.start, duration: placement.duration });
  }
  function finishTrackDrop(event: React.DragEvent<HTMLDivElement>, track: number) {
    event.preventDefault(); event.stopPropagation();
    const assetId = event.dataTransfer.getData("text/asset");
    const clipId = event.dataTransfer.getData("text/clip");
    const drag = draggingRef.current ?? (assetId ? { kind: "asset" as const, id: assetId, grabOffset: 0 }
      : clipId ? { kind: "clip" as const, id: clipId, grabOffset: Number(event.dataTransfer.getData("text/clip-grab-offset")) || 0 } : null);
    draggingRef.current = null; setActiveTrackDragKind(null); setDropPreview(null);
    if (!drag) return;
    const pointerTime = timelinePointerTime(event, event.currentTarget);
    if (drag.kind === "asset") addAssetToTimeline(drag.id, track, pointerTime);
    else moveClipToTrack(drag.id, track, pointerTime, drag.grabOffset);
  }
  function seekTimeline(clientX: number, ruler: HTMLElement) {
    if (!timelineRef.current.clips.length || timelineRef.current.duration <= 0) return;
    const time = timelinePointerTime({ clientX }, ruler, timelineRulerOffset());
    setTimeline((current) => ({ ...current, playhead: Math.min(current.duration, time) }));
  }
  function stepFrame(direction: -1 | 1) {
    if (!timeline.clips.length) return;
    setPlaying(false);
    setTimeline((current) => ({ ...current, playhead: Math.max(0, Math.min(current.duration, current.playhead + direction / Math.max(1, current.fps))) }));
  }
  function movePlayhead(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = playheadDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = drag.initialTime + (event.clientX - drag.initialX) / pxPerSecond;
    setTimeline((current) => ({ ...current, playhead: Math.max(0, Math.min(current.duration, next)) }));
  }
  function finishPlayheadDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (playheadDragRef.current?.pointerId !== event.pointerId) return;
    playheadDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  async function toggleFullscreen() {
    if (playerExpanded) { setPlayerExpanded(false); return; }
    try {
      if (document.fullscreenElement === previewRef.current) await document.exitFullscreen();
      else await previewRef.current?.requestFullscreen();
    } catch { setPlayerExpanded(true); }
  }
  useEffect(() => {
    if (!playerExpanded) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setPlayerExpanded(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [playerExpanded]);
  const outputSettingsValid = Number.isInteger(Number(widthDraft)) && Number(widthDraft) >= 16 && Number(widthDraft) <= 7680
    && Number.isInteger(Number(heightDraft)) && Number(heightDraft) >= 16 && Number(heightDraft) <= 4320
    && Number(widthDraft) * Number(heightDraft) <= 4_000_000
    && Number(frameRateDraft) >= 12 && Number(frameRateDraft) <= 60
    && Number(videoBitrate) >= 0.5 && Number(videoBitrate) <= 40
    && (!timeline.clips.some((clip) => !clip.muted && clip.volume > 0 && (clip.track < 0 || timeline.assets.some((asset) => asset.id === clip.assetId && asset.kind === "video"))) || (Number(audioBitrate) >= 64 && Number(audioBitrate) <= 320));

  function applyTimelineEdit(update: (current: VideoTimelineProject) => VideoTimelineProject) {
    const current = timelineRef.current;
    const next = update(current);
    historyRef.current.past.push(current);
    if (historyRef.current.past.length > 50) historyRef.current.past.shift();
    historyRef.current.future = [];
    timelineRef.current = next;
    setTimeline(next); setHistoryVersion((value) => value + 1);
  }
  function undo() {
    const previous = historyRef.current.past.pop();
    if (!previous) return;
    historyRef.current.future.push(timelineRef.current);
    timelineRef.current = previous; setTimeline(previous); setHistoryVersion((value) => value + 1);
  }
  function redo() {
    const next = historyRef.current.future.pop();
    if (!next) return;
    historyRef.current.past.push(timelineRef.current);
    timelineRef.current = next; setTimeline(next); setHistoryVersion((value) => value + 1);
  }
  function duplicateClip(id: string) {
    const clip = timelineRef.current.clips.find((item) => item.id === id);
    if (!clip) return;
    const copy = { ...clip, id: crypto.randomUUID(), start: clip.start + clipLength(clip) };
    applyTimelineEdit((current) => ({ ...current, clips: [...current.clips, copy], duration: Math.max(current.duration, copy.start + clipLength(copy)) }));
    setSelected(copy.id);
  }
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      const actionControl = target instanceof HTMLElement && target.closest("button, a, [role=button]");
      if (actionControl && !event.ctrlKey && !event.metaKey && event.key !== "Delete" && event.key !== "Backspace") return;
      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
        else if (event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
        return;
      }
      if (event.code === "Space") { event.preventDefault(); togglePlayback(); }
      else if (event.key === "Delete" || event.key === "Backspace") { if (selected) { event.preventDefault(); removeClip(selected); } }
      else if (event.key.toLowerCase() === "s") { event.preventDefault(); splitSelected(); }
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const step = event.shiftKey ? 1 : 1 / Math.max(1, timelineRef.current.fps);
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        setTimeline((current) => ({ ...current, playhead: Math.max(0, Math.min(current.duration, current.playhead + step * direction)) }));
      } else if (event.key === "Home") { event.preventDefault(); setTimeline((current) => ({ ...current, playhead: 0 })); }
    }
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  });

  function togglePlayback() {
    if (playing) { setPlaying(false); return; }
    if (!timeline.clips.length || timeline.duration <= 0) return;
    setError("");
    if (previewAudioContextRef.current?.state === "suspended") void previewAudioContextRef.current.resume();
    for (const clip of timeline.clips.filter((item) => item.track >= 0 && timeline.assets.some((asset) => asset.id === item.assetId && asset.kind === "video") && timeline.playhead >= item.start && timeline.playhead < item.start + clipLength(item))) {
      const video = videoRefs.current[clip.id];
      if (!video) continue;
      video.currentTime = clip.sourceStart + (timeline.playhead - clip.start) * clip.speed;
      video.playbackRate = clip.speed;
      video.preservesPitch = (clip.pitchMode ?? "preserve") === "preserve";
      const localTime = Math.max(0, timeline.playhead - clip.start);
      setPreviewGain(video, clip.id, clip.muted ? 0 : evaluateClipKeyframes(clip, localTime).volume * evaluateClipTransition(clip, localTime));
      void previewAudioContextRef.current?.resume();
      video.volume = 1;
      video.muted = clip.muted;
      void video.play().catch(() => setError("Video audio preview was blocked by this browser. Press Play again to allow local audio preview."));
    }
    for (const clip of timeline.clips.filter((item) => item.track < 0 && timeline.playhead >= item.start && timeline.playhead < item.start + clipLength(item))) {
      const audio = audioRefs.current[clip.id];
      if (!audio) continue;
      audio.currentTime = clip.sourceStart + (timeline.playhead - clip.start) * clip.speed;
      const localTime = Math.max(0, timeline.playhead - clip.start);
      audio.playbackRate = clip.speed; audio.preservesPitch = (clip.pitchMode ?? "preserve") === "preserve"; setPreviewGain(audio, clip.id, clip.muted ? 0 : evaluateClipKeyframes(clip, localTime).volume * evaluateClipTransition(clip, localTime)); void previewAudioContextRef.current?.resume(); audio.volume = 1; audio.muted = clip.muted;
      void audio.play().catch(() => setError("Audio preview was blocked by this browser. Press Play again to allow local audio preview."));
    }
    setPlaying(true);
  }

  async function exportTimeline() {
    if (!timeline.clips.length || !timeline.duration || timeline.duration > 120) return;
    const frameRate = Number(frameRateDraft);
    const videoRate = Number(videoBitrate); const audioRate = Number(audioBitrate);
    if (!Number.isFinite(frameRate) || frameRate < 12 || frameRate > 60) { setError("Enter a frame rate from 12 to 60 fps."); return; }
    if (!Number.isFinite(videoRate) || videoRate < 0.5 || videoRate > 40 || !Number.isFinite(audioRate) || audioRate < 64 || audioRate > 320) { setError("Video bitrate must be 0.5–40 Mbps and audio bitrate must be 64–320 kbps."); return; }
    setPlaying(false); setExporting(true); setExportProgress(0); setError(""); setResultUrl(""); cancelExportRef.current = false;
    let output: import("mediabunny").Output | undefined;
    let outputOverLimit = false;
    try {
      const { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, WebMOutputFormat, canEncodeAudio, canEncodeVideo } = await import("mediabunny");
      const width = Number(widthDraft); const height = Number(heightDraft); const { duration } = timeline;
      const fps = frameRate;
      if (!Number.isInteger(width) || width < 16 || width > 7680 || !Number.isInteger(height) || height < 16 || height > 4320) throw new Error("Enter whole-number canvas dimensions from 16×16 up to 7680×4320 pixels.");
      if (width * height > 4_000_000) throw new Error("Timeline export is limited to 4 megapixels in this first browser renderer.");
      const renderTimeline = { ...timeline, width, height, fps };
      const hasAudio = timeline.clips.some((clip) => !clip.muted && clip.volume > 0 && (clip.track < 0 || timeline.assets.some((asset) => asset.id === clip.assetId && asset.kind === "video")));
      const mp4Video = await canEncodeVideo("avc", { width, height, frameRate: fps, bitrate: videoRate * 1_000_000 });
      const mp4Audio = !hasAudio || await canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: 48_000, bitrate: audioRate * 1_000 });
      const webmCodec = mp4Video && mp4Audio ? null : await canEncodeVideo("vp9", { width, height, frameRate: fps, bitrate: videoRate * 1_000_000 }) ? "vp9" : await canEncodeVideo("vp8", { width, height, frameRate: fps, bitrate: videoRate * 1_000_000 }) ? "vp8" : null;
      const webmAudio = !hasAudio || await canEncodeAudio("opus", { numberOfChannels: 2, sampleRate: 48_000, bitrate: audioRate * 1_000 });
      const useMp4 = mp4Video && mp4Audio;
      if (!useMp4 && (!webmCodec || !webmAudio)) throw new Error("This browser has no supported complete video/audio encoder combination for the current timeline.");
      const codec = useMp4 ? "avc" : webmCodec!;
      const audioCodec = useMp4 ? "aac" : "opus";
      const audioBuffer = hasAudio ? await renderTimelineAudio(timeline.clips, timeline.assets, files, duration, (percent) => setExportProgress(10 + Math.round(percent * 0.3)), () => cancelExportRef.current) : null;
      if (hasAudio && !audioBuffer) throw new Error("Could not render timeline audio.");
      if (cancelExportRef.current) throw new Error("Export cancelled or exceeded the 512 MiB memory limit.");
      const target = new BufferTarget();
      let written = 0;
      target.on("write", ({ end }) => { written = Math.max(written, end); if (written > 512 * 1024 * 1024) { outputOverLimit = true; cancelExportRef.current = true; } });
      output = new Output({ format: useMp4 ? new Mp4OutputFormat() : new WebMOutputFormat(), target });
      cancelOutputRef.current = () => { if (output && output.state !== "canceled" && output.state !== "finalized") void output.cancel().catch(() => undefined); };
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("The timeline canvas is not ready.");
      const videoSource = new CanvasSource(canvas, { codec, quality: new Quality({ bitrate: videoRate * 1_000_000 }) });
      output.addVideoTrack(videoSource, { frameRate: fps });
      let audioSource: InstanceType<typeof AudioBufferSource> | null = null;
      if (hasAudio) {
        audioSource = new AudioBufferSource({ codec: audioCodec, quality: new Quality({ bitrate: audioRate * 1_000 }) });
        output.addAudioTrack(audioSource);
      }
      await output.start();
      if (audioBuffer && audioSource) await audioSource.add(audioBuffer);
      const frameCount = Math.ceil(duration * fps);
      const seekVideo = async (video: HTMLVideoElement, time: number) => {
        if (video.readyState < 2) await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => { cleanup(); reject(new Error("A video source did not decode a frame in time.")); }, 15_000);
          const loaded = () => { cleanup(); resolve(); }; const failed = () => { cleanup(); reject(new Error("A video source could not be decoded for export.")); };
          const cleanup = () => { clearTimeout(timeout); video.removeEventListener("loadeddata", loaded); video.removeEventListener("error", failed); };
          video.addEventListener("loadeddata", loaded, { once: true }); video.addEventListener("error", failed, { once: true });
        });
        if (Math.abs(video.currentTime - time) < 0.005 && !video.seeking) return;
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => { cleanup(); reject(new Error("Seeking a video frame timed out. Try a different source format.")); }, 15_000);
          const seeked = () => { cleanup(); resolve(); }; const failed = () => { cleanup(); reject(new Error("A video source failed while seeking.")); };
          const cleanup = () => { clearTimeout(timeout); video.removeEventListener("seeked", seeked); video.removeEventListener("error", failed); };
          video.addEventListener("seeked", seeked, { once: true }); video.addEventListener("error", failed, { once: true }); video.currentTime = time;
        });
      };
      for (let frame = 0; frame < frameCount; frame++) {
        if (cancelExportRef.current) throw new Error(written > 512 * 1024 * 1024 ? "Export exceeded the 512 MiB in-memory output limit." : "Export cancelled.");
        const timestamp = frame / fps;
        const activeVideos = timeline.clips.filter((clip) => clip.track >= 0 && timeline.assets.some((asset) => asset.id === clip.assetId && asset.kind === "video") && timestamp >= clip.start && timestamp < clip.start + clipLength(clip));
        await Promise.all(activeVideos.map((clip) => {
          const video = videoRefs.current[clip.id];
          if (!video) throw new Error("A timeline video source is missing from the media preview.");
          return seekVideo(video, clip.sourceStart + (timestamp - clip.start) * clip.speed);
        }));
        drawVideoComposition(canvas, renderTimeline, timestamp, { videos: videoRefs.current, images: imageRefs.current }, renderTimeline.assets);
        await videoSource.add(timestamp, 1 / fps);
        if (frame % Math.max(1, Math.floor(fps / 2)) === 0) {
          setExportProgress(40 + Math.round((frame / frameCount) * 58));
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      await output.finalize();
      if (!target.buffer) throw new Error("The browser encoder finished without an output file.");
      if (target.buffer.byteLength > 512 * 1024 * 1024) throw new Error("Output exceeds the 512 MiB in-memory download limit.");
      const type = useMp4 ? "video/mp4" : "video/webm";
      setResultUrl(URL.createObjectURL(new Blob([target.buffer], { type })));
      setResultType(type);
      setExportProgress(100);
    } catch (cause) {
      if (output && output.state !== "canceled" && output.state !== "finalized") await output.cancel().catch(() => undefined);
      if (outputOverLimit) setError("Export exceeded the 512 MiB in-memory output limit.");
      else if (cancelExportRef.current || (cause instanceof Error && cause.message.toLowerCase().includes("cancel"))) setStatus("Export cancelled. The project was left unchanged.");
      else setError(cause instanceof Error ? cause.message : "Timeline export failed.");
    } finally {
      cancelOutputRef.current = null; setExporting(false);
    }
  }

  const draggedBinAsset = binDragPreview && timeline.assets.find((asset) => asset.id === binDragPreview.id);
  const dragKind = draggedBinAsset ? (draggedBinAsset.kind === "audio" ? "audio" : "visual") : activeTrackDragKind;
  const visibleTracks = visibleTimelineTracks(timeline.clips, draggedBinAsset ? dragKind : null);
  const nextOverlayTrack = Math.max(0, ...timeline.clips.map((clip) => clip.track)) + 1;
  const overlayLaneCount = visibleTracks.filter((track) => track > 0).length;
  const audioLaneCount = visibleTracks.filter((track) => track < 0).length;
  return <main className="video-studio-page" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files.length) void importFiles(event.dataTransfer.files); }}>
    <div className="video-studio-top">
      <div className="studio-project-identity"><a href="/projects" className="studio-back-link" aria-label="Back to projects">‹</a><span className="studio-app-mark">L</span><div><h1>{projectTitle || "Video Studio"}</h1><span className="studio-save-status" role="status">{status}</span></div></div>
      <div className="editor-top-actions">
        {!projectId && <button className="studio-new-project" onClick={() => void createVideoProject()}>New project</button>}
        <span className="studio-local-badge">● Local project</span>
        <button className="studio-export-trigger" onClick={() => setExportOpen(true)}>Export video</button>
      </div>
    </div>
    {error && <p className="resize-error" role="alert">{error}</p>}
    {extractingAudio && <p className="source-info" role="status">Detaching source audio: {extractProgress}% <button className="editor-action danger" onClick={() => void cancelAudioExtraction()}>Cancel</button></p>}
    <section className="video-editor-layout" inert={exporting || extractingAudio}>
      <aside className="video-bin"><div className="studio-bin-tabs" role="tablist" aria-label="Editor tools">{(["media", "library", "text", "transitions"] as const).map((tab) => <button key={tab} role="tab" aria-selected={activeBinTab === tab} className={activeBinTab === tab ? "active" : ""} onClick={() => setActiveBinTab(tab)}>{tab === "media" ? "▣" : tab === "library" ? "▤" : tab === "text" ? "T" : "◇"}<span>{tab[0].toUpperCase() + tab.slice(1)}</span></button>)}</div>
        <div className="studio-bin-body">{activeBinTab === "media" ? <><div className="studio-bin-heading"><strong>Your media</strong><span>{timeline.assets.length} items</span></div><label className="studio-import-button">＋ Import media<input type="file" multiple accept="video/*,audio/*,image/*" disabled={Boolean(projectId && !ready) || exporting} onChange={(event) => { const chosen = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void importFiles(chosen); }} /></label><div className="studio-bin-grid">{timeline.assets.map((asset) => <button key={asset.id} className="bin-item" onPointerDown={(event) => { if (event.button !== 0) return; binPointerRef.current = { pointerId: event.pointerId, id: asset.id, initialX: event.clientX, initialY: event.clientY, dragging: false }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={moveBinPointer} onPointerUp={finishBinPointer} onPointerCancel={cancelBinPointer} onClick={(event) => { if (suppressBinClickRef.current) { event.preventDefault(); return; } if (asset.kind === "audio") addAssetToTimeline(asset.id); else if (event.detail === 0) addAssetToTimeline(asset.id, 0, timeline.playhead); else setStatus(`Drag ${asset.name} to a visual lane to place it.`); }} title={asset.kind === "audio" ? `Add ${asset.name} to the timeline` : `Drag ${asset.name} to a visual lane`}><span className={`studio-asset-thumb ${asset.kind}`}>{asset.kind === "image" && assetUrls[asset.id] ? <img src={assetUrls[asset.id]} alt="" /> : asset.kind === "video" && assetUrls[asset.id] ? <video src={assetUrls[asset.id]} muted preload="metadata" onLoadedMetadata={(event) => { event.currentTarget.currentTime = Math.min(0.1, asset.duration / 2); }} aria-hidden="true" /> : asset.kind === "audio" ? "♫" : "T"}{asset.kind !== "image" && <span className="studio-asset-duration">{formatAssetDuration(asset.duration)}</span>}</span><strong title={asset.name}>{asset.name}</strong></button>)}</div>{!timeline.assets.length && <div className="studio-bin-empty"><span>▣</span><strong>Start with your media</strong><p>Import video, audio, or images. Your files stay on this device.</p></div>}</> : activeBinTab === "library" ? <><div className="studio-bin-heading"><strong>Library</strong><span>On this device</span></div><div className="studio-library-tabs" role="tablist" aria-label="Library categories">{(["image", "video", "sound"] as const).map((tab) => <button type="button" key={tab} role="tab" aria-selected={libraryTab === tab} className={libraryTab === tab ? "active" : ""} onClick={() => setLibraryTab(tab)}>{tab === "sound" ? "Sound effects" : `${tab[0].toUpperCase()}${tab.slice(1)}s`}</button>)}</div>{libraryTab === "image" ? <div className="studio-library-grid"><div className="studio-library-color-tile"><button type="button" className="studio-library-color-preview" aria-label="Add color background to timeline" title="Add color background to timeline" style={{ backgroundColor: libraryBackgroundColor }} disabled={Boolean(projectId && !ready) || exporting} onClick={() => void addLibraryColorBackground()} /><label className="studio-library-color-picker" title="Choose background color"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5a7.5 7.5 0 1 0 0 15h1a2 2 0 0 0 1.5-3.3c-.7-.8-.2-2.2.9-2.2H15a2.5 2.5 0 0 0 2.5-2.5C17.5 5.6 14.1 2.5 10 2.5Z"/><circle cx="6.5" cy="9" r=".7"/><circle cx="9.5" cy="6.5" r=".7"/><circle cx="13" cy="7" r=".7"/></svg><input aria-label="Choose background color" type="color" value={libraryBackgroundColor} onChange={(event) => setLibraryBackgroundColor(event.currentTarget.value)} /></label></div></div> : libraryTab === "video" ? <p className="studio-bin-hint">Library videos are not available yet.</p> : <p className="studio-bin-hint">Sound effects are not available yet.</p>}</> : activeBinTab === "text" ? <><div className="studio-bin-heading"><strong>Text</strong></div><button className="studio-template-card" disabled={!projectId || !ready || exporting} onClick={addTitle}><span>Text</span><strong>Default title</strong><small>Add at the playhead</small></button></> : <><div className="studio-bin-heading"><strong>Transitions</strong></div><p className="studio-bin-hint">Select a clip on the timeline, then apply a transition to the next clip on the same track.</p><button className="studio-template-card" disabled={!selectedClip || selectedClip.track < 0} onClick={() => createTransitionToNext("dissolve")}><span>◇</span><strong>Dissolve</strong><small>Blend adjacent visuals</small></button><button className="studio-template-card" disabled={!selectedClip || selectedClip.track >= 0} onClick={() => createTransitionToNext("crossfade")}><span>♫</span><strong>Crossfade</strong><small>Blend adjacent audio</small></button></>}</div></aside>
      <section className={`editor-preview${playerExpanded ? " expanded" : ""}`} ref={previewRef}><div className="preview-heading"><strong>Composite preview</strong><span>{previewAsset?.name ?? "Nothing at playhead"} · {timeline.playhead.toFixed(2)} s · {timeline.width}×{timeline.height}</span></div><div className="editor-stage" ref={stageRef}><canvas ref={canvasRef} aria-label="Composited video timeline preview" />{titleOverlay && <div className={`studio-title-overlay ${selected === editableTitleClip?.id ? "selected" : ""}`} role="group" aria-label="Selected title: drag to move, use corner to resize, top handle to rotate" style={{ left: titleOverlay.left, top: titleOverlay.top, width: titleOverlay.width, height: titleOverlay.height, transform: `translate(-50%, -50%) rotate(${editableTitleTransform.rotation}deg)` }} onPointerDown={beginTextGesture} onPointerMove={moveTextGesture} onPointerUp={finishTextGesture} onPointerCancel={finishTextGesture}><span className="studio-title-rotate" data-title-handle="rotate" title="Rotate text" /><span className="studio-title-resize" data-title-handle="scale" title="Resize text" /></div>}<div className="media-sources" aria-hidden="true">{timeline.assets.filter((asset) => asset.kind === "image").map((asset) => <img key={asset.id} ref={(el) => { if (el) imageRefs.current[asset.id] = el; else delete imageRefs.current[asset.id]; }} src={assetUrls[asset.id]} alt="" onLoad={() => setMediaRevision((n) => n + 1)} />)}{timeline.clips.filter((clip) => timeline.assets.find((asset) => asset.id === clip.assetId)?.kind === "video").map((clip) => <video key={clip.id} ref={(el) => { if (el) videoRefs.current[clip.id] = el; else delete videoRefs.current[clip.id]; }} src={assetUrls[clip.assetId]} playsInline preload="auto" onLoadedData={() => setMediaRevision((n) => n + 1)} onSeeked={() => setMediaRevision((n) => n + 1)} />)}{timeline.clips.filter((clip) => clip.track < 0).map((clip) => <audio key={clip.id} ref={(el) => { if (el) audioRefs.current[clip.id] = el; else delete audioRefs.current[clip.id]; }} src={assetUrls[clip.assetId]} preload="auto" />)}</div></div><div className="editor-transport">
        <span className="studio-timecode" aria-label="Current time and timeline duration">{formatTimecode(timeline.playhead, timeline.fps)} <span>/</span> {formatTimecode(timeline.duration, timeline.fps)}</span>
        <div className="studio-playback-controls">
          <button type="button" aria-label="Previous frame" title="Previous frame" disabled={!timeline.clips.length} onClick={() => stepFrame(-1)}>⏮</button>
          <button type="button" className="studio-play-button" aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause" : "Play"} disabled={!timeline.clips.length} onClick={togglePlayback}>{playing ? "❚❚" : "▶"}</button>
          <button type="button" aria-label="Next frame" title="Next frame" disabled={!timeline.clips.length} onClick={() => stepFrame(1)}>⏭</button>
        </div>
        <div className="studio-player-tools"><span>{timeline.width} × {timeline.height}</span><details className="studio-ratio-menu"><summary aria-label="Canvas aspect ratio">Ratio</summary><div className="studio-ratio-options">{ASPECT_RATIOS.map((option) => <button type="button" key={option.value} className={(timeline.aspectRatioMode ?? "custom") === option.value ? "active" : ""} onClick={() => selectAspectRatio(option.value)}>{option.label}</button>)}{(timeline.aspectRatioMode ?? "custom") === "custom" && <div className="studio-custom-ratio"><label>Width <input type="number" min="16" max="7680" step="1" value={widthDraft} onChange={(event) => setWidthDraft(event.currentTarget.value)} onBlur={commitCustomCanvas} /></label><label>Height <input type="number" min="16" max="4320" step="1" value={heightDraft} onChange={(event) => setHeightDraft(event.currentTarget.value)} onBlur={commitCustomCanvas} /></label></div>}</div></details><button type="button" aria-label={playerExpanded ? "Exit fullscreen player" : "Fullscreen player"} title={playerExpanded ? "Exit fullscreen player" : "Fullscreen player"} onClick={() => void toggleFullscreen()}>⛶</button></div>
      </div></section>
      <aside className="video-inspector">
        <div className="preview-heading"><strong>{selectedClip ? selectedAsset?.kind === "audio" ? "Audio" : selectedAsset?.kind === "text" ? "Text" : "Video" : "Details"}</strong><span>{selectedClip ? "Clip settings" : "Project settings"}</span></div>
        {!selectedClip && <div className="studio-project-details"><h2>Project</h2><dl><div><dt>Media</dt><dd>{timeline.assets.length} files</dd></div><div><dt>Tracks</dt><dd>3 video · 3 audio</dd></div><div><dt>Resolution</dt><dd>{timeline.width} × {timeline.height}</dd></div><div><dt>Frame rate</dt><dd>{timeline.fps} fps</dd></div><div><dt>Duration</dt><dd>{timeline.duration.toFixed(2)} s</dd></div><div><dt>Storage</dt><dd>On this device</dd></div></dl><button className="editor-action" onClick={() => setExportOpen(true)}>Export settings</button></div>}
        {selectedClip && <>
          <div className="studio-inspector-tabs" role="tablist" aria-label="Clip settings">{(["basic", "speed", "adjust"] as const).map((tab) => <button key={tab} role="tab" aria-selected={inspectorTab === tab} className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}</div>
          {inspectorTab === "basic" && <>
          {selectedClip.track >= 0 && selectedAsset?.kind === "video" && <>
            <div className="clip-control-group"><strong>Transform</strong>
              <div className="clip-range-pair"><EditorRange label="Scale" min={0.1} max={8} step={0.01} value={selectedTransform.scale} unit="×" onChange={(scale) => editClip(selectedClip.id, { transform: { ...selectedTransform, scale } })} />
              <EditorRange label="Rotate" min={-180} max={180} step={0.1} value={selectedTransform.rotation} unit="°" onChange={(rotation) => editClip(selectedClip.id, { transform: { ...selectedTransform, rotation } })} /></div>
              <div className="clip-align-controls" aria-label="Align video overlay"><span>Align</span>{(["left", "center", "right"] as const).map((horizontal) => <button type="button" key={horizontal} onClick={() => alignSelectedVideo(horizontal, "middle")} aria-label={`Align ${horizontal}`} title={`Align ${horizontal}`}>{horizontal === "left" ? "⇤" : horizontal === "right" ? "⇥" : "↔"}</button>)}{(["top", "middle", "bottom"] as const).map((vertical) => <button type="button" key={vertical} onClick={() => alignSelectedVideo("center", vertical)} aria-label={`Align ${vertical}`} title={`Align ${vertical}`}>{vertical === "top" ? "⇡" : vertical === "bottom" ? "⇣" : "↕"}</button>)}</div>
              <div className="clip-align-controls"><span>Mirror</span><button type="button" aria-pressed={Boolean(selectedTransform.mirrorX)} onClick={() => editClip(selectedClip.id, { transform: { ...selectedTransform, mirrorX: !selectedTransform.mirrorX } })}>X</button><button type="button" aria-pressed={Boolean(selectedTransform.mirrorY)} onClick={() => editClip(selectedClip.id, { transform: { ...selectedTransform, mirrorY: !selectedTransform.mirrorY } })}>Y</button></div>
            </div>
            <EditorRange label="Audio volume" min={0} max={4} step={0.01} value={selectedValues?.volume ?? selectedClip.volume} unit="×" onChange={(volume) => editClip(selectedClip.id, { volume })} />
            <label className="ratio-toggle"><input type="checkbox" checked={selectedClip.muted} onChange={(event) => editClip(selectedClip.id, { muted: event.currentTarget.checked })} />Silence audio</label>
            <div className="clip-action-row"><button className="editor-action" disabled={extractingAudio} onClick={() => void detachVideoAudio()}>{extractingAudio ? `Extracting ${extractProgress}%` : "Extract audio"}</button><button className="editor-action" onClick={splitSelected}>Split</button><button className="editor-action" onClick={() => duplicateClip(selectedClip.id)}>Duplicate</button></div>
          </>}
          {selectedClip.track < 0 && selectedAsset?.kind === "audio" && <EditorRange label="Audio volume" min={0} max={4} step={0.01} value={selectedValues?.volume ?? selectedClip.volume} unit="×" onChange={(volume) => editClip(selectedClip.id, { volume })} />}
          <div className="clip-placement-pair">
            <label className="speed-field">Track<input type="number" step="1" value={selectedClip.track} onChange={(event) => { const value = Number(event.currentTarget.value); if (Number.isInteger(value)) editClip(selectedClip.id, { track: selectedClip.track < 0 ? Math.min(-1, value) : Math.max(0, value) }); }} /></label>
            <label className="speed-field">Timeline start <span>seconds</span><input type="number" min="0" step="0.001" value={Number(selectedClip.start.toFixed(3))} onChange={(event) => editClip(selectedClip.id, { start: Math.max(0, Number(event.currentTarget.value) || 0) })} /></label>
            <label className="speed-field">Source in <span>seconds</span><input type="number" min="0" max={selectedAsset?.duration} step="0.001" value={Number(selectedClip.sourceStart.toFixed(3))} onChange={(event) => editClip(selectedClip.id, { sourceStart: Math.max(0, Math.min(selectedClip.sourceEnd - 0.01, Number(event.currentTarget.value) || 0)) })} /></label>
            <label className="speed-field">Source out <span>seconds</span><input type="number" min="0.01" max={selectedAsset?.duration} step="0.001" value={Number(selectedClip.sourceEnd.toFixed(3))} onChange={(event) => editClip(selectedClip.id, { sourceEnd: Math.min(selectedAsset?.duration ?? selectedClip.sourceEnd, Math.max(selectedClip.sourceStart + 0.01, Number(event.currentTarget.value) || 0)) })} /></label>
          </div>
          </>}
          {inspectorTab === "speed" && <>
          <EditorRange label="Speed" min={0.1} max={16} step={0.01} value={selectedClip.speed} unit="×" onChange={(speed) => editClip(selectedClip.id, { speed })} />
          <label className="speed-field">Speed value <span>0.1–16×</span><input type="number" min="0.1" max="16" step="0.001" value={Number(selectedClip.speed.toFixed(3))} onChange={(event) => editClip(selectedClip.id, { speed: Math.max(0.1, Math.min(16, Number(event.currentTarget.value) || 1)) })} /></label>
          {selectedAsset?.kind === "audio" && selectedAsset.derivedFromAssetId && <p className="resize-note" role="note">Detached from {timeline.assets.find((asset) => asset.id === selectedAsset.derivedFromAssetId)?.name ?? "a video source"}. This audio clip is independent; later video speed edits do not change it.</p>}
          {selectedClip.track < 0 && <label className="ratio-field">Audio pitch mode<select value={selectedClip.pitchMode ?? "preserve"} onChange={(event) => editClip(selectedClip.id, { pitchMode: event.currentTarget.value as "preserve" | "natural" })}><option value="preserve">Preserve pitch (default)</option><option value="natural">Natural pitch change</option></select></label>}
          </>}
          {inspectorTab === "basic" && <>
          {selectedAsset?.kind === "video" && <div className="title-inspector">
            <label className="ratio-field">Replacement audio<select value={selectedReplacementAudioAssetId} onChange={(event) => setReplacementAudioAssetId(event.currentTarget.value)}><option value="">Select imported audio</option>{availableAudioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
            <label className="speed-field">Audio offset <span>custom seconds</span><input type="number" min="0" max={Math.max(0, clipLength(selectedClip) - 0.01)} step="0.001" value={Number((Number(replacementAudioOffset) || 0).toFixed(3))} onChange={(event) => setReplacementAudioOffset(event.currentTarget.value)} /></label>
            <button className="secondary-button editor-action" disabled={!availableAudioAssets.length} onClick={replaceVideoAudio}>Replace clip audio</button>
            <button className="editor-action" disabled={extractingAudio} onClick={() => void detachVideoAudio()}>Detach source audio to Audio 1</button>
          </div>}
          </>}
          {inspectorTab === "adjust" && <>
          <button className="secondary-button editor-action" onClick={addOrUpdateKeyframe}>Add/update keyframe at playhead</button>
          {selectedClip.keyframes?.some((frame) => Math.abs(frame.time - Math.max(0, Math.min(clipLength(selectedClip), timeline.playhead - selectedClip.start))) < 0.05) && <button className="editor-action" onClick={removeKeyframeAtPlayhead}>Remove keyframe at playhead</button>}
          <p className="resize-note">{selectedClip.keyframes?.length ?? 0} keyframe(s). Values interpolate linearly between keys in clip-relative seconds.</p>
          </>}
          {inspectorTab === "basic" && <>
          {selectedAsset?.kind === "text" && selectedAsset.textSettings && <div className="title-inspector">
            <label className="ratio-field">Title text<textarea rows={3} maxLength={500} value={selectedAsset.textSettings.text} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, text: event.currentTarget.value })} /></label>
            <label className="speed-field">Font size <span>custom 8-512 px</span><input type="number" min="8" max="512" step="any" value={selectedAsset.textSettings.fontSize} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, fontSize: Math.max(8, Math.min(512, Number(event.currentTarget.value) || 72)) })} /></label>
            <div className="filter-fields two-column"><label>Text color <input type="color" value={selectedAsset.textSettings.color} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, color: event.currentTarget.value })} /></label><label>Background <input type="color" value={selectedAsset.textSettings.backgroundColor} disabled={!selectedAsset.textSettings.showBackground} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, backgroundColor: event.currentTarget.value })} /></label></div>
            <label className="ratio-toggle"><input type="checkbox" checked={selectedAsset.textSettings.showBackground} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, showBackground: event.currentTarget.checked })} />Show title background</label>
          </div>}
          </>}
          {inspectorTab === "speed" && <>
          <div className="filter-fields two-column transform-fields">
            <label>Fade in <span>custom seconds</span><input type="number" min="0" max={clipLength(selectedClip)} step="any" value={selectedClip.transitions?.fadeIn ?? 0} onChange={(event) => editClip(selectedClip.id, { transitions: { fadeIn: Math.max(0, Math.min(clipLength(selectedClip), Number(event.currentTarget.value) || 0)), fadeOut: selectedClip.transitions?.fadeOut ?? 0 } })} /></label>
            <label>Fade out <span>custom seconds</span><input type="number" min="0" max={clipLength(selectedClip)} step="any" value={selectedClip.transitions?.fadeOut ?? 0} onChange={(event) => editClip(selectedClip.id, { transitions: { fadeIn: selectedClip.transitions?.fadeIn ?? 0, fadeOut: Math.max(0, Math.min(clipLength(selectedClip), Number(event.currentTarget.value) || 0)) } })} /></label>
          </div>
          </>}
          {inspectorTab === "basic" && <>
          {selectedClip.track >= 0 && selectedAsset && ["video", "image", "text"].includes(selectedAsset.kind) && <div className="transition-controls">
            <label>Transition duration <span>custom seconds</span><input type="number" min="0.01" max={clipLength(selectedClip)} step="any" value={transitionDuration} onChange={(event) => setTransitionDuration(event.currentTarget.value)} /></label>
            <button className="secondary-button editor-action" onClick={() => createTransitionToNext("dissolve")}>Dissolve into next clip</button>
          </div>}
          {selectedClip.track < 0 && <div className="transition-controls">
            <label>Crossfade duration <span>custom seconds</span><input type="number" min="0.01" max={clipLength(selectedClip)} step="any" value={transitionDuration} onChange={(event) => setTransitionDuration(event.currentTarget.value)} /></label>
            <button className="secondary-button editor-action" onClick={() => createTransitionToNext("crossfade")}>Crossfade into next clip</button>
          </div>}
          </>}
          {inspectorTab === "adjust" && <>
          {selectedClip.track >= 0 && selectedAsset?.kind !== "text" && <div className="filter-fields two-column transform-fields">
            <label>Brightness <span>custom percent</span><input type="number" min="0" max="300" step="any" value={selectedClip.effects?.brightness ?? 100} onChange={(event) => editClip(selectedClip.id, { effects: { brightness: Math.max(0, Math.min(300, Number(event.currentTarget.value) || 0)), contrast: selectedClip.effects?.contrast ?? 100, saturation: selectedClip.effects?.saturation ?? 100, grayscale: selectedClip.effects?.grayscale ?? 0 } })} /></label>
            <label>Contrast <span>custom percent</span><input type="number" min="0" max="300" step="any" value={selectedClip.effects?.contrast ?? 100} onChange={(event) => editClip(selectedClip.id, { effects: { brightness: selectedClip.effects?.brightness ?? 100, contrast: Math.max(0, Math.min(300, Number(event.currentTarget.value) || 0)), saturation: selectedClip.effects?.saturation ?? 100, grayscale: selectedClip.effects?.grayscale ?? 0 } })} /></label>
            <label>Saturation <span>custom percent</span><input type="number" min="0" max="300" step="any" value={selectedClip.effects?.saturation ?? 100} onChange={(event) => editClip(selectedClip.id, { effects: { brightness: selectedClip.effects?.brightness ?? 100, contrast: selectedClip.effects?.contrast ?? 100, saturation: Math.max(0, Math.min(300, Number(event.currentTarget.value) || 0)), grayscale: selectedClip.effects?.grayscale ?? 0 } })} /></label>
            <label>Grayscale <span>custom percent</span><input type="number" min="0" max="100" step="any" value={selectedClip.effects?.grayscale ?? 0} onChange={(event) => editClip(selectedClip.id, { effects: { brightness: selectedClip.effects?.brightness ?? 100, contrast: selectedClip.effects?.contrast ?? 100, saturation: selectedClip.effects?.saturation ?? 100, grayscale: Math.max(0, Math.min(100, Number(event.currentTarget.value) || 0)) } })} /></label>
          </div>}
          {selectedClip.track >= 0 && <div className="filter-fields two-column transform-fields">
            <label>Position X <span>custom px</span><input type="number" step="0.001" value={Number(selectedTransform.x.toFixed(3))} onChange={(event) => editClip(selectedClip.id, { transform: { ...selectedTransform, x: Number(event.currentTarget.value) || 0 } })} /></label>
            <label>Position Y <span>custom px</span><input type="number" step="0.001" value={Number(selectedTransform.y.toFixed(3))} onChange={(event) => editClip(selectedClip.id, { transform: { ...selectedTransform, y: Number(event.currentTarget.value) || 0 } })} /></label>
            <label>Opacity <span>custom percent</span><input type="number" min="0" max="100" step="0.001" value={Number((selectedTransform.opacity * 100).toFixed(3))} onChange={(event) => editClip(selectedClip.id, { transform: { ...selectedTransform, opacity: Math.max(0, Math.min(1, (Number(event.currentTarget.value) || 0) / 100)) } })} /></label>
          </div>}
          </>}
          {inspectorTab === "basic" && <>
          {selectedAsset?.kind !== "video" && <label className="ratio-toggle"><input type="checkbox" checked={selectedClip.muted} onChange={(event) => editClip(selectedClip.id, { muted: event.currentTarget.checked })} />Mute clip</label>}
          {selectedAsset?.kind !== "video" && <><button className="secondary-button editor-action" onClick={splitSelected}>Split at playhead</button><button className="editor-action" onClick={() => duplicateClip(selectedClip.id)}>Duplicate clip</button></>}
          <button className="editor-action danger" onClick={() => removeClip(selectedClip.id)}>Delete clip</button>
          </>}
        </>}
      </aside>
    </section>
    {exportOpen && <div className="studio-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !exporting) setExportOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape" && !exporting) setExportOpen(false); }}><section className="video-export-panel" role="dialog" aria-modal="true" aria-label="Export video settings">
      <div className="resize-controls">
        <div className="studio-export-heading"><div><span>LOCAL EXPORT</span><h2>Export video</h2></div><button type="button" autoFocus aria-label="Close export settings" disabled={exporting} onClick={() => setExportOpen(false)}>×</button></div>
        <div className="filter-fields"><label>Canvas width <span>custom px</span><input type="number" min="16" max="7680" value={widthDraft} disabled={exporting} onChange={(event) => setWidthDraft(event.currentTarget.value)} onBlur={commitCustomCanvas} /></label><label>Canvas height <span>custom px</span><input type="number" min="16" max="4320" value={heightDraft} disabled={exporting} onChange={(event) => setHeightDraft(event.currentTarget.value)} onBlur={commitCustomCanvas} /></label></div>
        <div className="filter-fields"><label>Frame rate <span>custom · 12–60 fps</span><input type="number" min="12" max="60" step="any" value={frameRateDraft} disabled={exporting} onChange={(event) => setFrameRateDraft(event.currentTarget.value)} onBlur={() => { const value = Number(frameRateDraft); if (Number.isFinite(value) && value >= 12 && value <= 60) applyTimelineEdit((current) => ({ ...current, fps: value })); }} /></label><label>Video bitrate <span>custom · Mbps</span><input type="number" min="0.5" max="40" step="any" value={videoBitrate} disabled={exporting} onChange={(event) => setVideoBitrate(event.currentTarget.value)} /></label></div>
        {timeline.clips.some((clip) => clip.track < 0) && <label className="speed-field">Audio bitrate <span>custom · 64–320 kbps</span><input type="number" min="64" max="320" step="any" value={audioBitrate} disabled={exporting} onChange={(event) => setAudioBitrate(event.currentTarget.value)} /></label>}
        <p className="resize-note">The renderer chooses MP4 or WebM after checking this browser’s video and audio encoders. First renderer limits: 120 seconds, 4 megapixels per frame, 180 seconds of source audio, and 512 MiB output. Export is local and may run slower than playback. Audio in video clips is included in preview and export; detaching or replacing it mutes the original clip audio.</p>
        {timeline.width * timeline.height > 4_000_000 && <p className="resize-error" role="alert">Choose canvas dimensions under 4 megapixels for this first export renderer.</p>}
        {exporting && <><p className="source-info" role="status">Rendering local timeline: {exportProgress}%</p><progress max="100" value={exportProgress} aria-label="Timeline export progress" /><button className="editor-action danger" onClick={() => { cancelExportRef.current = true; cancelOutputRef.current?.(); }}>Cancel export</button></>}
        {!outputSettingsValid && <p className="resize-error" role="alert">Enter valid dimensions, frame rate, and bitrates within the displayed ranges.</p>}
        <button className="export-button" disabled={!timeline.clips.length || !timeline.duration || timeline.duration > 120 || !outputSettingsValid || exporting} onClick={() => void exportTimeline()}>{exporting ? "Rendering…" : "Render and export video"}</button>
        {timeline.duration > 120 && <p className="resize-error" role="alert">Trim the timeline to 120 seconds or less for this export prototype.</p>}
        {resultUrl && <a className="export-button download-link" href={resultUrl} download={`local-studio-edit.${resultType === "video/mp4" ? "mp4" : "webm"}`}>Download {resultType === "video/mp4" ? "MP4" : "WebM"}</a>}
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>Export preview</strong><span>{resultUrl ? "Rendered file" : "Export keeps your editable project"}</span></div>{resultUrl ? <CustomMediaPreview kind="video" src={resultUrl} label="Rendered video preview" /> : <div className="empty-preview">Render a project to get a playable file.</div>}</div>
    </section></div>}    <section className="video-timeline" inert={exporting}><div className="timeline-toolbar"><strong>Timeline · {timeline.duration.toFixed(2)} seconds</strong><span className="timeline-toolbar-separator" aria-hidden="true" /><div className="timeline-edit-tools"><button type="button" title="Delete Left" aria-label="Delete Left" onClick={() => deleteHoveredSide("left")}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v14M12 5h6v10h-6zM2 7l6 6M8 7l-6 6" /></svg></button><button type="button" title="Delete Right" aria-label="Delete Right" onClick={() => deleteHoveredSide("right")}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v14M2 5h6v10H2zM12 7l6 6m0-6-6 6" /></svg></button></div><span className="timeline-toolbar-separator" aria-hidden="true" /><div className="timeline-actions" data-history-version={historyVersion}><button disabled={!historyRef.current.past.length} onClick={undo}>Undo</button><button disabled={!historyRef.current.future.length} onClick={redo}>Redo</button><span className="timeline-toolbar-separator" aria-hidden="true" /><button disabled={!selectedClip && !mainClipAtPlayhead} onClick={splitSelected}>Split</button><button disabled={!selectedClip} onClick={() => selectedClip && removeClip(selectedClip.id)}>Delete</button><span className="timeline-toolbar-separator" aria-hidden="true" /><label><input type="checkbox" checked={ripplePrimaryTrack} onChange={(event) => setRipplePrimaryTrack(event.currentTarget.checked)} />Ripple</label><label><input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.currentTarget.checked)} />Snap</label><span className="timeline-toolbar-separator" aria-hidden="true" /><label>Snap tolerance<input type="number" min="0" max="5" step="any" value={snapThreshold} disabled={!snapEnabled} onChange={(event) => setSnapThreshold(event.currentTarget.value)} />s</label><span className="timeline-toolbar-separator" aria-hidden="true" /><label>Zoom<input type="number" min="12" max="160" value={zoom} onChange={(event) => setZoom(event.currentTarget.value)} />px/s</label></div></div><div className="timeline-scroll" ref={timelineScrollRef} title="Hold Ctrl and scroll to zoom the timeline"><div className="timeline-ruler" role="slider" tabIndex={timeline.clips.length ? 0 : -1} aria-label="Timeline seek" onClick={() => setSelected("")} aria-valuemin={0} aria-valuemax={timeline.duration} aria-valuenow={timeline.playhead} aria-valuetext={formatTimecode(timeline.playhead, timeline.fps)} style={{ width: timelineWidth }} onPointerDown={(event) => { if (!timeline.clips.length) return; setPlaying(false); event.currentTarget.setPointerCapture(event.pointerId); seekTimeline(event.clientX, event.currentTarget); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) seekTimeline(event.clientX, event.currentTarget); }} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onKeyDown={(event) => { if (!timeline.clips.length) return; if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); setPlaying(false); setTimeline((current) => ({ ...current, playhead: event.key === "Home" ? 0 : event.key === "End" ? current.duration : Math.max(0, Math.min(current.duration, current.playhead + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 1 : 1 / Math.max(1, current.fps)))) })); } }}>{Array.from({ length: Math.ceil(timeline.duration) + 1 }, (_, second) => <span key={second} style={{ left: timelineRulerOffset() + second * pxPerSecond }}>{second}s</span>)}</div>{activeTrackDragKind === "visual" && <div className="track-lane timeline-new-overlay-target" data-track={nextOverlayTrack} onDragOver={(event) => previewTrackDrop(event, nextOverlayTrack)} onDrop={(event) => finishTrackDrop(event, nextOverlayTrack)}>Move to new Overlay {nextOverlayTrack}</div>}<div className="timeline-center-spacer" style={{ paddingTop: Math.max(0, audioLaneCount - overlayLaneCount) * 52 }} aria-hidden="true" />{visibleTracks.map((track) => <Fragment key={track}><div className={`timeline-track ${!timeline.clips.length && !dragKind && track === 0 ? "empty-main" : ""}`} key={track}><strong>{track === 0 ? (timeline.clips.some((clip) => clip.track === 0) ? "Video 1" : "") : track > 0 ? `Overlay ${track}` : `Audio ${-track}`}</strong><div className="track-lane" data-track={track} style={{ width: timelineWidth - timelineRulerOffset() }} onDragOver={(event) => previewTrackDrop(event, track)} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropPreview(null); }} onDrop={(event) => finishTrackDrop(event, track)} onClick={(event) => { const playhead = timelinePointerTime(event, event.currentTarget); setTimeline((current) => ({ ...current, playhead: Math.min(current.duration, playhead) })); setSelected(""); }}>{!timeline.clips.length && track === 0 && <span className="timeline-empty-prompt">Drag media here to start creating</span>}{dropPreview?.track === track && <div className="timeline-drop-preview" aria-hidden="true" style={{ left: dropPreview.start * pxPerSecond, width: Math.max(22, dropPreview.duration * pxPerSecond) }}><span>{dropPreview.start.toFixed(2)}s</span></div>}{timeline.clips.filter((clip) => clip.track === track).map((clip) => { const asset = timeline.assets.find((item) => item.id === clip.assetId); const waveformAsset = asset?.kind === "audio" ? asset : asset?.kind === "video" ? timeline.assets.find((item) => item.kind === "audio" && item.derivedFromAssetId === asset.id) ?? (asset.hasAudio !== false ? asset : undefined) : undefined; const waveform = waveformAsset ? waveforms[waveformAsset.id] : undefined; const waveformStart = waveformAsset ? Math.floor(clip.sourceStart / waveformAsset.duration * (waveform?.length ?? 0)) : 0; const waveformEnd = waveformAsset ? Math.ceil(clip.sourceEnd / waveformAsset.duration * (waveform?.length ?? 0)) : 0; const clipWaveformSlice = waveform?.slice(waveformStart, Math.max(waveformStart + 1, waveformEnd)); const waveformBarCount = Math.max(1, Math.floor(clipLength(clip) * pxPerSecond / 2.5)); const clipWaveform = clipWaveformSlice?.length ? Array.from({ length: Math.min(waveformBarCount, clipWaveformSlice.length) }, (_, index) => { const barCount = Math.min(waveformBarCount, clipWaveformSlice.length); const start = Math.floor(index * clipWaveformSlice.length / barCount); const end = Math.max(start + 1, Math.floor((index + 1) * clipWaveformSlice.length / barCount)); return Math.max(...clipWaveformSlice.slice(start, end)); }) : undefined; return <button draggable key={clip.id} className={`timeline-clip ${selected === clip.id ? "selected" : ""} ${asset?.kind ?? ""}`} style={{ left: clip.start * pxPerSecond, width: Math.max(22, clipLength(clip) * pxPerSecond) }} onPointerMove={(event) => moveTrim(event, clip.id)} onPointerUp={finishTrim} onPointerCancel={finishTrim} onDragStart={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); const grabOffset = event.clientX - bounds.left; draggingRef.current = { kind: "clip", id: clip.id, grabOffset }; setActiveTrackDragKind(asset?.kind === "audio" ? "audio" : "visual"); event.dataTransfer.setData("text/clip", clip.id); event.dataTransfer.setData("text/clip-grab-offset", String(grabOffset)); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { draggingRef.current = null; setActiveTrackDragKind(null); setDropPreview(null); }} onPointerEnter={() => setHoveredClipId(clip.id)} onFocus={() => setHoveredClipId(clip.id)} onClick={(event) => { event.stopPropagation(); setSelected(clip.id); setHoveredClipId(clip.id); }}>{asset?.kind === "image" && assetUrls[asset.id] && <img className="studio-clip-visual" src={assetUrls[asset.id]} alt="" aria-hidden="true" />}{asset?.kind === "video" && assetUrls[asset.id] && <video className="studio-clip-visual" src={assetUrls[clip.assetId]} muted playsInline preload="metadata" onLoadedMetadata={(event) => { event.currentTarget.currentTime = Math.min(0.1, asset.duration / 2); }} aria-hidden="true" />}{clipWaveform && <span className={asset?.kind === "video" ? "studio-clip-wave video-audio-wave" : "studio-clip-wave"} aria-hidden="true">{clipWaveform.map((peak, index) => <i key={index} style={{ height: String(Math.max(12, peak * 100)) + "%" }} />)}</span>}<span className="timeline-trim-handle left" aria-hidden="true" onPointerDown={(event) => beginTrim(event, clip, "left")} /><span className="timeline-trim-handle right" aria-hidden="true" onPointerDown={(event) => beginTrim(event, clip, "right")} /><strong>{asset?.name}</strong><small>{clipLength(clip).toFixed(2)}s · {clip.speed.toFixed(3)}×</small>{clip.keyframes?.map((frame, index) => <span key={`${clip.id}-key-${index}`} className="timeline-keyframe" aria-hidden="true" style={{ left: `${Math.max(0, Math.min(100, frame.time / Math.max(clipLength(clip), 0.001) * 100))}%` }} />)}</button>; })}</div></div></Fragment>)}<div className="timeline-center-spacer" style={{ paddingBottom: Math.max(0, overlayLaneCount - audioLaneCount) * 52 }} aria-hidden="true" /><button type="button" tabIndex={-1} aria-label="Drag playhead to seek" disabled={!timeline.clips.length} className="timeline-playhead" style={{ left: timelineRulerOffset() + timeline.playhead * pxPerSecond }} onPointerDown={(event) => { if (!timeline.clips.length) return; event.preventDefault(); event.stopPropagation(); setPlaying(false); event.currentTarget.setPointerCapture(event.pointerId); playheadDragRef.current = { pointerId: event.pointerId, initialX: event.clientX, initialTime: timeline.playhead }; }} onPointerMove={movePlayhead} onPointerUp={finishPlayheadDrag} onPointerCancel={finishPlayheadDrag} /> </div></section>
    <p className="resize-note editor-disclaimer">Timeline preview composites active visual clips from bottom to top, including per-clip transforms, text titles, and custom linear fade transitions. Audio lanes play in sync with the project clock. Timeline render/export is available in supported browsers; verify output playback for your media and device.</p>
    {binDragPreview && draggedBinAsset && typeof document !== "undefined" && createPortal(<div className="studio-bin-drag-ghost" style={{ left: binDragPreview.x + 12, top: binDragPreview.y + 12 }} aria-hidden="true">{draggedBinAsset.kind === "image" && assetUrls[draggedBinAsset.id] ? <img src={assetUrls[draggedBinAsset.id]} alt="" /> : draggedBinAsset.kind === "video" && assetUrls[draggedBinAsset.id] ? <video src={assetUrls[draggedBinAsset.id]} muted preload="metadata" onLoadedMetadata={(event) => { event.currentTarget.currentTime = Math.min(0.1, draggedBinAsset.duration / 2); }} /> : <span>{draggedBinAsset.kind === "audio" ? "♫" : "T"}</span>}</div>, document.body)}
  </main>;
}
