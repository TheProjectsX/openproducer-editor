import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/studio-video";
import { CustomMediaPreview } from "../components/custom-media-preview";
import { createProject, getProject, readVideoAsset, renameProject, saveVideoTimeline, type VideoAspectRatioMode, type VideoClipTransform, type VideoImageCrop, type VideoTextSettings, type VideoTimelineAsset, type VideoTimelineClip, type VideoTimelineProject, type VideoTransitionType } from "../lib/project-store";
import { drawVideoComposition, getClipLength } from "../lib/video-composition";
import { evaluateClipKeyframes, evaluateClipTransition, upsertClipKeyframe } from "../lib/video-keyframes";
import { renderTimelineAudio } from "../lib/audio-timeline-render";
import { canPlaceAssetOnTrack, canvasDimensionsForAspect, planMediaBatchPlacement, resolveTimelinePlacement, timelineContentWidth, timelineDropStart, timelineRulerOffset, timelineTimeAtPointer, timelineZoomScrollLeft, visibleTimelineTracks, zoomPixelsPerSecond } from "../lib/video-timeline";
import { inspectMediaFile } from "../lib/media-inspection";
import { isMediaAsset, sortMediaAssets, updateMediaSelection, type MediaFilter, type MediaSort, type SortDirection } from "../lib/video-media-bin";
import { EMPTY_IMAGE_CROP, imageClipGeometry } from "../lib/video-image-layout";
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

function MediaBinControls({ filter, onFilter, sort, onSort, direction, onDirection }: {
  filter: MediaFilter;
  onFilter: (value: MediaFilter) => void;
  sort: MediaSort;
  onSort: (value: MediaSort) => void;
  direction: SortDirection;
  onDirection: (value: SortDirection) => void;
}) {
  const closeMenu = (event: MouseEvent<HTMLButtonElement>) => event.currentTarget.closest("details")?.removeAttribute("open");
  const sortOptions: { value: MediaSort; label: string }[] = [
    { value: "imported", label: "Time imported" }, { value: "fileDate", label: "File date" },
    { value: "name", label: "Name" }, { value: "type", label: "Type" }, { value: "duration", label: "Duration" },
  ];
  const filterOptions: { value: MediaFilter; label: string }[] = [
    { value: "all", label: "All" }, { value: "video", label: "Video" },
    { value: "audio", label: "Audio" }, { value: "image", label: "Image" },
  ];
  const textOrder = sort === "name" || sort === "type";
  const durationOrder = sort === "duration";
  return <div className="studio-media-menu-buttons">
    <details className="studio-media-menu">
      <summary aria-label="Sort media" title="Sort media"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4h9M3 8h7M3 12h5M15 4v12m-3-3 3 3 3-3" /></svg><span className="studio-menu-chevron" aria-hidden="true">⌄</span></summary>
      <div className="studio-media-menu-panel" role="group" aria-label="Sort media by">
        {sortOptions.map((option) => <button type="button" key={option.value} aria-label={`Sort by ${option.label}`} aria-pressed={sort === option.value} onClick={(event) => { onSort(option.value); closeMenu(event); }}><span className="studio-menu-check">{sort === option.value ? "✓" : ""}</span>{option.label}</button>)}
        <div className="studio-menu-divider" />
        {(["desc", "asc"] as const).map((value) => <button type="button" key={value} aria-label={textOrder ? (value === "asc" ? "A to Z" : "Z to A") : durationOrder ? (value === "asc" ? "Shortest first" : "Longest first") : (value === "asc" ? "Oldest first" : "Newest first")} aria-pressed={direction === value} onClick={(event) => { onDirection(value); closeMenu(event); }}><span className="studio-menu-check">{direction === value ? "✓" : ""}</span>{textOrder ? (value === "asc" ? "A to Z" : "Z to A") : durationOrder ? (value === "asc" ? "Shortest first" : "Longest first") : (value === "asc" ? "Oldest first" : "Newest first")}</button>)}
      </div>
    </details>
    <details className="studio-media-menu">
      <summary aria-label="Filter media" title="Filter media" className={filter !== "all" ? "active" : ""}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 4h15l-6 6.5V16l-3-1.5v-4L2.5 4Z" /></svg><span className="studio-menu-chevron" aria-hidden="true">⌄</span></summary>
      <div className="studio-media-menu-panel studio-filter-menu-panel" role="group" aria-label="Filter media by type">
        {filterOptions.map((option) => <button type="button" key={option.value} aria-label={`Show ${option.label.toLowerCase()} media`} aria-pressed={filter === option.value} onClick={(event) => { onFilter(option.value); closeMenu(event); }}><span className="studio-menu-check">{filter === option.value ? "✓" : ""}</span>{option.label}</button>)}
      </div>
    </details>
  </div>;
}

function EditorRange({ label, value, min, max, step = 0.001, unit = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  return <label className="editor-range-control"><span>{label}<output>{value.toFixed(3)}{unit}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} /></label>;
}

function ImageNumberInput({ label, value, min, max, step = "any", unit, onCommit }: { label: string; value: number; min: number; max: number; step?: string; unit: string; onCommit: (value: number) => void }) {
  const formatted = Number(value.toFixed(3));
  const [draft, setDraft] = useState(String(formatted));
  useEffect(() => setDraft(String(formatted)), [formatted]);
  function commit() {
    const number = Number(draft);
    if (draft.trim() && Number.isFinite(number)) onCommit(Math.max(min, Math.min(max, number)));
    else setDraft(String(formatted));
  }
  return <label className="speed-field">{label} <span>{unit}</span><input type="number" min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(event.currentTarget.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>;
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
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [clipContextMenu, setClipContextMenu] = useState<{ clipId: string; x: number; y: number } | null>(null);
  const copiedClipRef = useRef<VideoTimelineClip | null>(null);
  const [hoveredClipId, setHoveredClipId] = useState("");
  const [activeBinTab, setActiveBinTab] = useState<"media" | "library" | "text" | "shapes" | "transitions">("media");
  const [shapeColor, setShapeColor] = useState("#38d2e0");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [mediaSort, setMediaSort] = useState<MediaSort>("imported");
  const [mediaSortDirection, setMediaSortDirection] = useState<SortDirection>("desc");
  const [selectedBinIds, setSelectedBinIds] = useState<string[]>([]);
  const [binMarquee, setBinMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const binSelectionAnchorRef = useRef<string | null>(null);
  const binMarqueeRef = useRef<{ pointerId: number; startX: number; startY: number; selectedAtStart: string[]; additive: boolean; dragging: boolean } | null>(null);
  const [libraryTab, setLibraryTab] = useState<"image" | "video" | "sound">("image");
  const [libraryBackgroundColor, setLibraryBackgroundColor] = useState("#000000");
  const [inspectorTab, setInspectorTab] = useState<"basic" | "speed" | "adjust">("basic");
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [status, setStatus] = useState("Create a video project from Projects, or import files to begin.");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [mediaRevision, setMediaRevision] = useState(0);
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({});
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState("60");
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  const [rulerHoverGuide, setRulerHoverGuide] = useState<{ left: number; top: number; height: number } | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapThreshold, setSnapThreshold] = useState("0.2");
  const [dropPreview, setDropPreview] = useState<{ track: number; start: number; duration: number } | null>(null);
  const [binDragPreview, setBinDragPreview] = useState<{ id: string; count: number; x: number; y: number } | null>(null);
  const [activeTrackDragKind, setActiveTrackDragKind] = useState<"visual" | "audio" | null>(null);
  const draggingRef = useRef<{ kind: "asset" | "clip"; id: string; grabOffset: number } | null>(null);
  const binPointerRef = useRef<{ pointerId: number; id: string; ids: string[]; initialX: number; initialY: number; dragging: boolean } | null>(null);
  const binBodyRef = useRef<HTMLDivElement>(null);
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewZoomDraft, setPreviewZoomDraft] = useState("100");
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const stagePanRef = useRef<{ pointerId: number; startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);
  const [previewSnapGuides, setPreviewSnapGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const textGestureRef = useRef<{ id: string; pointerId: number; mode: "move" | "scale" | "rotate"; x: number; y: number; width: number; height: number; transform: VideoClipTransform; original: VideoTimelineProject; boxFit: number; pointerFit: number; centerX: number; centerY: number } | null>(null);
  const imageGestureRef = useRef<{ id: string; pointerId: number; mode: "move" | "resize" | "rotate"; x: number; y: number; width: number; height: number; boxWidth: number; boxHeight: number; transform: VideoClipTransform; original: VideoTimelineProject; boxFit: number; pointerFit: number; matchAspect: boolean; sourceAspect: number; centerX: number; centerY: number } | null>(null);
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
  const justSeekedRef = useRef(false);
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
  const mediaAssetCount = timeline.assets.filter(isMediaAsset).length;
  const visibleMediaAssets = useMemo(() => sortMediaAssets(timeline.assets, mediaFilter, mediaSort, mediaSortDirection), [timeline.assets, mediaFilter, mediaSort, mediaSortDirection]);
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
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setPreviewZoom((current) => {
        const next = Math.max(0.25, Math.min(4, Number((current * Math.exp(-event.deltaY * 0.002)).toFixed(3))));
        setPreviewZoomDraft(String(Math.round(next * 100)));
        return next;
      });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => { observer.disconnect(); stage.removeEventListener("wheel", onWheel); };
  }, []);
  useEffect(() => {
    const closeOutsideDropdowns = (event: PointerEvent) => {
      const target = event.target as Node | null;
      document.querySelectorAll<HTMLDetailsElement>("details.studio-media-menu[open], details.studio-ratio-menu[open]").forEach((menu) => {
        if (!target || !menu.contains(target)) menu.open = false;
      });
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setClipContextMenu(null);
      document.querySelectorAll<HTMLDetailsElement>("details.studio-media-menu[open], details.studio-ratio-menu[open]").forEach((menu) => {
        menu.open = false;
      });
    };
    const closeContextOnPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".studio-clip-context-menu")) setClipContextMenu(null);
    };
    document.addEventListener("pointerdown", closeOutsideDropdowns, true);
    document.addEventListener("pointerdown", closeContextOnPointerDown, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutsideDropdowns, true);
      document.removeEventListener("pointerdown", closeContextOnPointerDown, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  type PreviewOverlayBox = { width: number; height: number; left: number; top: number; fit: number };
  type PreviewOverlayItem =
    | { kind: "text"; clip: VideoTimelineClip; asset: VideoTimelineAsset; transform: VideoClipTransform; box: PreviewOverlayBox }
    | { kind: "image"; clip: VideoTimelineClip; asset: VideoTimelineAsset; transform: VideoClipTransform; box: PreviewOverlayBox; imageGeometry: ReturnType<typeof imageClipGeometry> }
    | { kind: "video"; clip: VideoTimelineClip; asset: VideoTimelineAsset; transform: VideoClipTransform; box: PreviewOverlayBox };

  const previewOverlays: PreviewOverlayItem[] = stageSize.width && stageSize.height ? (() => {
    const fit = Math.min(stageSize.width / timeline.width, stageSize.height / timeline.height);
    const measure = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
    return timeline.clips
      .filter((clip) => clip.track >= 0 && !timeline.trackStates?.[clip.track]?.hidden && timeline.playhead >= clip.start && timeline.playhead < clip.start + clipLength(clip))
      .sort((a, b) => a.track - b.track || a.start - b.start)
      .flatMap((clip): PreviewOverlayItem[] => {
        const asset = timeline.assets.find((item) => item.id === clip.assetId);
        if (!asset) return [];
        const transform = evaluateClipKeyframes(clip, timeline.playhead - clip.start).transform;
        const left = stageSize.width / 2 + transform.x * fit;
        const top = stageSize.height / 2 + transform.y * fit;
        if (asset.kind === "text" && asset.textSettings && typeof document !== "undefined") {
          const settings = asset.textSettings;
          const font = Math.max(8, Math.min(512, settings.fontSize * transform.scale));
          const fontStyle = settings.italic ? "italic " : "";
          const fontWeight = settings.bold === false ? "400" : "700";
          const fontFamily = settings.fontFamily || "system-ui, sans-serif";
          if (measure) measure.font = `${fontStyle}${fontWeight} ${font}px ${fontFamily}`;
          const lines = settings.text.split("\n");
          const width = Math.max(font, ...lines.map((line) => measure?.measureText(line).width ?? line.length * font * 0.6)) + font * 0.7;
          const height = lines.length * font * (settings.lineHeight ?? 1.2) + font * 0.4;
          return [{ kind: "text", clip, asset, transform, box: { width: Math.max(36, width * fit), height: Math.max(24, height * fit), left, top, fit } }];
        }
        if (asset.kind === "image") {
          const geometry = imageClipGeometry(asset.width ?? imageRefs.current[asset.id]?.naturalWidth ?? timeline.width, asset.height ?? imageRefs.current[asset.id]?.naturalHeight ?? timeline.height, timeline.width, timeline.height, clip.imageCrop, clip.imageSize, transform.scale);
          return [{ kind: "image", clip, asset, transform, imageGeometry: geometry, box: { width: geometry.width * fit, height: geometry.height * fit, left, top, fit } }];
        }
        if (asset.kind === "video") {
          const sourceWidth = asset.width ?? videoRefs.current[clip.id]?.videoWidth ?? timeline.width;
          const sourceHeight = asset.height ?? videoRefs.current[clip.id]?.videoHeight ?? timeline.height;
          const fitScale = Math.min(timeline.width / sourceWidth, timeline.height / sourceHeight);
          return [{ kind: "video", clip, asset, transform, box: { width: sourceWidth * fitScale * transform.scale * fit, height: sourceHeight * fitScale * transform.scale * fit, left, top, fit } }];
        }
        return [];
      });
  })() : [];
  const imageCrop = selectedClip?.imageCrop ?? EMPTY_IMAGE_CROP;
  const selectedImageGeometry = selectedAsset?.kind === "image" && selectedClip
    ? imageClipGeometry(selectedAsset.width ?? imageRefs.current[selectedAsset.id]?.naturalWidth ?? timeline.width, selectedAsset.height ?? imageRefs.current[selectedAsset.id]?.naturalHeight ?? timeline.height, timeline.width, timeline.height, selectedClip.imageCrop, selectedClip.imageSize, selectedTransform.scale)
    : null;

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
        setFiles(restored); setTimeline(saved); setSelected(saved.clips[0]?.id ?? ""); setSelectedBinIds([]); binSelectionAnchorRef.current = null;
        setFrameRateDraft(String(saved.fps));
        setWidthDraft(String(saved.width)); setHeightDraft(String(saved.height));
        setReady(true);
        setStatus(`Project “${project.title}” loaded. ${saved.assets.filter(isMediaAsset).length} media item(s) restored.`);
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
      const clipMuted = clip.muted || Boolean(current.trackStates?.[clip.track]?.muted);
      setPreviewGain(video, clip.id, clipMuted ? 0 : evaluateClipKeyframes(clip, localTime).volume * evaluateClipTransition(clip, localTime));
      video.volume = 1;
      video.muted = clipMuted;
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
      const clipMuted = clip.muted || Boolean(current.trackStates?.[clip.track]?.muted);
      setPreviewGain(audio, clip.id, clipMuted ? 0 : evaluateClipKeyframes(clip, localTime).volume * evaluateClipTransition(clip, localTime));
      audio.volume = 1; audio.muted = clipMuted;
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
  }, [playing, exporting, timeline.width, timeline.height, timeline.assets, timeline.clips, timeline.playhead, timeline.trackStates, files, mediaRevision]);
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
      const asset = { id, name: file.name, type: file.type, size: file.size, duration, kind, importedAt: Date.now() + assets.length, fileModifiedAt: file.lastModified || undefined, width: mediaWidth, height: mediaHeight, hasAudio } satisfies VideoTimelineAsset;
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
    const asset: VideoTimelineAsset = { id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, duration: 3600, kind: "image", importedAt: Date.now(), width: 1920, height: 1080 };
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
  function selectBinAsset(id: string, shift: boolean, toggle: boolean) {
    const visibleIds = visibleMediaAssets.map((asset) => asset.id);
    if (!visibleIds.includes(id)) return;
    setSelectedBinIds((current) => updateMediaSelection(visibleIds, current, binSelectionAnchorRef.current, id, shift, toggle));
    if (!shift) binSelectionAnchorRef.current = id;
  }
  function placeMediaBatch(ids: readonly string[], targetTrack: number, pointerTime: number) {
    const assets = visibleMediaAssets.filter((asset) => ids.includes(asset.id));
    if (!assets.length) return;
    if (assets.length === 1) { addAssetToTimeline(assets[0].id, targetTrack, pointerTime); return; }
    const current = timelineRef.current;
    const existing = current.clips.map((clip) => ({ id: clip.id, track: clip.track, start: clip.start, end: clip.start + clipLength(clip) }));
    const placement = planMediaBatchPlacement(assets, targetTrack, pointerTime, existing, Number(snapThreshold), snapEnabled);
    if (!placement) { setError("Drop the first item in the sorted selection on a compatible lane: visuals on a visual lane, audio on an audio lane. Text titles cannot be placed from the media bin."); return; }
    const firstVisual = !current.clips.some((clip) => clip.track >= 0 && current.assets.some((asset) => asset.id === clip.assetId && (asset.kind === "video" || asset.kind === "image")));
    const visualAsset = firstVisual && assets.find((asset) => asset.kind === "video" || asset.kind === "image");
    const dimensions = visualAsset && (current.aspectRatioMode ?? "custom") === "original" && visualAsset.width && visualAsset.height
      ? canvasDimensionsForAspect(visualAsset.width / visualAsset.height) : null;
    const addedClips: VideoTimelineClip[] = placement.placements.map((item) => ({
      id: crypto.randomUUID(), assetId: item.assetId, track: item.track, start: item.start,
      sourceStart: 0, sourceEnd: item.duration, speed: 1, volume: 1, muted: false,
      ...(item.track < 0 ? { pitchMode: "preserve" as const } : {}),
    }));
    applyTimelineEdit((previous) => {
      const clips = [...previous.clips.map((clip) => placement.shiftedStarts[clip.id] === undefined ? clip : { ...clip, start: placement.shiftedStarts[clip.id] }), ...addedClips];
      return { ...previous, ...dimensions, clips, duration: Math.max(0, ...clips.map((clip) => clip.start + clipLength(clip))) };
    });
    if (dimensions) { setWidthDraft(String(dimensions.width)); setHeightDraft(String(dimensions.height)); }
    setSelected(addedClips[0].id); setError("");
    setStatus(`Added ${assets.length} selected media items in the current bin order.`);
  }
  function moveClipToTrack(id: string, track: number, pointerTime: number, grabOffset: number) {
    const movingClip = timelineRef.current.clips.find((clip) => clip.id === id);
    if (movingClip && timelineRef.current.trackStates?.[movingClip.track]?.locked) { setError("Unlock the source track before moving its clips."); return; }
    if (timelineRef.current.trackStates?.[track]?.locked) { setError("Target track is locked."); return; }
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
    if (!drag.dragging) { setSelectedBinIds(drag.ids); binSelectionAnchorRef.current = drag.id; }
    drag.dragging = true;
    setBinDragPreview({ id: drag.id, count: drag.ids.length, x: event.clientX, y: event.clientY });
    const target = binTrackAtPointer(event.clientX, event.clientY);
    const assets = visibleMediaAssets.filter((asset) => drag.ids.includes(asset.id));
    const existing = timelineRef.current.clips.map((clip) => ({ id: clip.id, track: clip.track, start: clip.start, end: clip.start + clipLength(clip) }));
    const placement = target && planMediaBatchPlacement(assets, target.track, timelinePointerTime(event, target.lane), existing, Number(snapThreshold), snapEnabled);
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
        if (target && target.track < 0) placeMediaBatch(drag.ids, target.track, timelinePointerTime(event, target.lane));
        else if (!target) {
          const audioEnd = Math.max(0, ...timelineRef.current.clips.filter((clip) => clip.track === -1).map((clip) => clip.start + clipLength(clip)));
          placeMediaBatch(drag.ids, -1, audioEnd);
        } else placeMediaBatch(drag.ids, target.track, timelinePointerTime(event, target.lane));
      } else if (target) placeMediaBatch(drag.ids, target.track, timelinePointerTime(event, target.lane));
      else if (overTimeline) setError("Drop video or images on a visual lane.");
    }
    setDropPreview(null);
  }
  function cancelBinPointer() { binPointerRef.current = null; setBinDragPreview(null); setDropPreview(null); }
  function beginBinMarquee(event: React.PointerEvent<HTMLDivElement>) {
    if (activeBinTab !== "media" || event.button !== 0 || (event.target as Element).closest("button, label, input, select, summary")) return;
    binMarqueeRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, selectedAtStart: selectedBinIds, additive: event.ctrlKey || event.metaKey, dragging: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveBinMarquee(event: React.PointerEvent<HTMLDivElement>) {
    const drag = binMarqueeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.dragging && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    drag.dragging = true;
    const left = Math.min(drag.startX, event.clientX);
    const top = Math.min(drag.startY, event.clientY);
    const right = Math.max(drag.startX, event.clientX);
    const bottom = Math.max(drag.startY, event.clientY);
    setBinMarquee({ left, top, width: right - left, height: bottom - top });
    const hitIds = Array.from(binBodyRef.current?.querySelectorAll<HTMLElement>(".studio-bin-grid .bin-item[data-asset-id]") ?? [])
      .filter((tile) => {
        const bounds = tile.getBoundingClientRect();
        return bounds.left < right && bounds.right > left && bounds.top < bottom && bounds.bottom > top;
      })
      .map((tile) => tile.dataset.assetId ?? "")
      .filter((id) => visibleMediaAssets.some((asset) => asset.id === id && asset.kind !== "text"));
    setSelectedBinIds(drag.additive ? [...new Set([...drag.selectedAtStart, ...hitIds])] : hitIds);
  }
  function finishBinMarquee(event: React.PointerEvent<HTMLDivElement>) {
    const drag = binMarqueeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    binMarqueeRef.current = null;
    setBinMarquee(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.dragging) { setSelectedBinIds([]); binSelectionAnchorRef.current = null; }
    else binSelectionAnchorRef.current = null;
  }
  function cancelBinMarquee(event: React.PointerEvent<HTMLDivElement>) {
    const drag = binMarqueeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    binMarqueeRef.current = null; setBinMarquee(null); setSelectedBinIds(drag.selectedAtStart);
  }

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
  function snapPreviewMove(x: number, y: number, boxWidth: number, boxHeight: number, rotation: number, fit: number, disableSnap: boolean) {
    if (disableSnap || !stageSize.width || !stageSize.height || fit <= 0) return { x, y, guideX: null as number | null, guideY: null as number | null };
    const threshold = 6 / fit;
    const halfW = boxWidth / fit / 2;
    const halfH = boxHeight / fit / 2;
    const axisAligned = Math.abs(rotation % 90) < 0.01;
    const xCandidates = [{ target: 0, guide: stageSize.width / 2 }, ...(axisAligned ? [{ target: -timeline.width / 2 + halfW, guide: stageSize.width / 2 - timeline.width / 2 * fit }, { target: timeline.width / 2 - halfW, guide: stageSize.width / 2 + timeline.width / 2 * fit }] : [])];
    const yCandidates = [{ target: 0, guide: stageSize.height / 2 }, ...(axisAligned ? [{ target: -timeline.height / 2 + halfH, guide: stageSize.height / 2 - timeline.height / 2 * fit }, { target: timeline.height / 2 - halfH, guide: stageSize.height / 2 + timeline.height / 2 * fit }] : [])];
    const bestX = xCandidates.reduce<{ target: number; guide: number; dist: number } | null>((best, cand) => {
      const dist = Math.abs(x - cand.target);
      return dist <= threshold && (!best || dist < best.dist) ? { ...cand, dist } : best;
    }, null);
    const bestY = yCandidates.reduce<{ target: number; guide: number; dist: number } | null>((best, cand) => {
      const dist = Math.abs(y - cand.target);
      return dist <= threshold && (!best || dist < best.dist) ? { ...cand, dist } : best;
    }, null);
    return { x: bestX ? bestX.target : x, y: bestY ? bestY.target : y, guideX: bestX ? bestX.guide : null, guideY: bestY ? bestY.guide : null };
  }
  function setPreviewZoomValue(next: number, resetPan = false) {
    const clamped = Math.max(0.25, Math.min(4, next));
    setPreviewZoom(clamped);
    setPreviewZoomDraft(String(Math.round(clamped * 100)));
    if (resetPan) setPreviewPan({ x: 0, y: 0 });
  }
  function beginStagePan(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget && event.target !== canvasRef.current && event.target !== viewportRef.current) return;
    if (event.button !== 0 && event.button !== 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    stagePanRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX: previewPan.x, panY: previewPan.y, moved: false };
  }
  function moveStagePan(event: React.PointerEvent<HTMLDivElement>) {
    const pan = stagePanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const dx = event.clientX - pan.startX; const dy = event.clientY - pan.startY;
    if (!pan.moved && Math.hypot(dx, dy) < 3) return;
    pan.moved = true;
    setPreviewPan({ x: pan.panX + dx, y: pan.panY + dy });
  }
  function finishStagePan(event: React.PointerEvent<HTMLDivElement>) {
    const pan = stagePanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    stagePanRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!pan.moved) setSelected("");
  }
  function beginTextGesture(event: React.PointerEvent<HTMLDivElement>, clip: VideoTimelineClip, transform: VideoClipTransform, overlay: PreviewOverlayBox) {
    event.preventDefault(); event.stopPropagation(); setPlaying(false);
    const mode = ((event.target as HTMLElement).closest("[data-title-handle]")?.getAttribute("data-title-handle") ?? "move") as "move" | "scale" | "rotate";
    const bounds = event.currentTarget.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2; const centerY = bounds.top + bounds.height / 2;
    setSelected(clip.id); setHoveredClipId(clip.id);
    textGestureRef.current = { id: clip.id, pointerId: event.pointerId, mode, x: event.clientX, y: event.clientY, width: overlay.width, height: overlay.height, transform: { ...transform }, original: timelineRef.current, boxFit: overlay.fit, pointerFit: overlay.fit * previewZoom, centerX, centerY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveTextGesture(event: React.PointerEvent<HTMLDivElement>) {
    const drag = textGestureRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x; const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) < 1) return;
    const transform = { ...drag.transform };
    if (drag.mode === "move") {
      const snapped = snapPreviewMove(transform.x + dx / drag.pointerFit, transform.y + dy / drag.pointerFit, drag.width, drag.height, transform.rotation, drag.boxFit, event.altKey);
      transform.x = snapped.x; transform.y = snapped.y;
      setPreviewSnapGuides({ x: snapped.guideX, y: snapped.guideY });
    }
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
    setPreviewSnapGuides({ x: null, y: null });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (timelineRef.current !== drag.original) {
      historyRef.current.past.push(drag.original);
      if (historyRef.current.past.length > 50) historyRef.current.past.shift();
      historyRef.current.future = [];
      setHistoryVersion((value) => value + 1);
    }
  }
  function setSelectedImageSize(axis: "width" | "height", value: number) {
    if (!selectedClip || !selectedImageGeometry) return;
    const width = axis === "width" ? value : selectedImageGeometry.width;
    const height = axis === "height" ? value : selectedImageGeometry.height;
    const aspect = selectedImageGeometry.source.width / selectedImageGeometry.source.height;
    const matched = selectedClip.imageMatchAspect !== false ? axis === "width" ? { width, height: width / aspect } : { width: height * aspect, height } : { width, height };
    const scale = Math.max(0.001, selectedTransform.scale);
    editClip(selectedClip.id, { imageSize: { width: matched.width / scale, height: matched.height / scale } });
  }
  function setSelectedImageCrop(edge: keyof VideoImageCrop, percent: number) {
    if (!selectedClip || selectedAsset?.kind !== "image" || !selectedImageGeometry) return;
    const opposite = edge === "left" ? "right" : edge === "right" ? "left" : edge === "top" ? "bottom" : "top";
    const sourceSize = edge === "left" || edge === "right" ? selectedAsset.width ?? 1 : selectedAsset.height ?? 1;
    const maximum = Math.max(0, 1 - imageCrop[opposite] - 1 / Math.max(1, sourceSize));
    const nextCrop = { ...imageCrop, [edge]: Math.max(0, Math.min(maximum, percent / 100)) };
    const nextSource = imageClipGeometry(selectedAsset.width ?? 1, selectedAsset.height ?? 1, timeline.width, timeline.height, nextCrop).source;
    const scale = Math.max(0.001, selectedTransform.scale);
    editClip(selectedClip.id, { imageCrop: nextCrop, ...(selectedClip.imageMatchAspect !== false ? { imageSize: { width: selectedImageGeometry.width / scale, height: selectedImageGeometry.width / (nextSource.width / nextSource.height) / scale } } : {}) });
  }
  function resetSelectedImageCrop() {
    if (!selectedClip || selectedAsset?.kind !== "image" || !selectedImageGeometry) return;
    const aspect = (selectedAsset.width ?? 1) / (selectedAsset.height ?? 1);
    const scale = Math.max(0.001, selectedTransform.scale);
    editClip(selectedClip.id, { imageCrop: undefined, ...(selectedClip.imageMatchAspect !== false ? { imageSize: { width: selectedImageGeometry.width / scale, height: selectedImageGeometry.width / aspect / scale } } : {}) });
  }
  function beginImageGesture(event: React.PointerEvent<HTMLDivElement>, clip: VideoTimelineClip, transform: VideoClipTransform, geometry: ReturnType<typeof imageClipGeometry>, overlay: PreviewOverlayBox) {
    event.preventDefault(); event.stopPropagation(); setPlaying(false);
    setSelected(clip.id); setHoveredClipId(clip.id);
    const mode = ((event.target as HTMLElement).closest("[data-image-handle]")?.getAttribute("data-image-handle") ?? "move") as "move" | "resize" | "rotate";
    const bounds = event.currentTarget.getBoundingClientRect();
    imageGestureRef.current = {
      id: clip.id, pointerId: event.pointerId, mode,
      x: event.clientX, y: event.clientY, width: geometry.width, height: geometry.height,
      boxWidth: overlay.width, boxHeight: overlay.height,
      transform: { ...transform }, original: timelineRef.current, boxFit: overlay.fit, pointerFit: overlay.fit * previewZoom,
      matchAspect: clip.imageMatchAspect !== false, sourceAspect: geometry.source.width / geometry.source.height,
      centerX: bounds.left + bounds.width / 2, centerY: bounds.top + bounds.height / 2,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveImageGesture(event: React.PointerEvent<HTMLDivElement>) {
    const drag = imageGestureRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.x) / drag.pointerFit;
    const dy = (event.clientY - drag.y) / drag.pointerFit;
    const transform = { ...drag.transform };
    let imageSize: VideoTimelineClip["imageSize"];
    if (drag.mode === "move") {
      const snapped = snapPreviewMove(transform.x + dx, transform.y + dy, drag.boxWidth, drag.boxHeight, transform.rotation, drag.boxFit, event.altKey);
      transform.x = snapped.x; transform.y = snapped.y;
      setPreviewSnapGuides({ x: snapped.guideX, y: snapped.guideY });
    }
    else if (drag.mode === "rotate") {
      const before = Math.atan2(drag.y - drag.centerY, drag.x - drag.centerX);
      const after = Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX);
      transform.rotation = drag.transform.rotation + (after - before) * 180 / Math.PI;
    }
    else {
      const radians = transform.rotation * Math.PI / 180;
      const cos = Math.cos(radians); const sin = Math.sin(radians);
      const localX = dx * cos + dy * sin;
      const localY = -dx * sin + dy * cos;
      let width = Math.max(1, drag.width + localX);
      let height = Math.max(1, drag.height + localY);
      if (drag.matchAspect) {
        if (Math.abs(localX) >= Math.abs(localY)) height = width / drag.sourceAspect;
        else width = height * drag.sourceAspect;
      }
      const halfWidthChange = (width - drag.width) / 2;
      const halfHeightChange = (height - drag.height) / 2;
      transform.x += halfWidthChange * cos - halfHeightChange * sin;
      transform.y += halfWidthChange * sin + halfHeightChange * cos;
      const scale = Math.max(0.001, transform.scale);
      imageSize = { width: width / scale, height: height / scale };
    }
    const updated = updateClipTimeline(drag.original, drag.id, { transform, ...(imageSize ? { imageSize } : {}) }, drag.original.playhead, ripplePrimaryTrack);
    timelineRef.current = updated; setTimeline(updated);
  }
  function finishImageGesture(event: React.PointerEvent<HTMLDivElement>) {
    const drag = imageGestureRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    imageGestureRef.current = null;
    setPreviewSnapGuides({ x: null, y: null });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (timelineRef.current !== drag.original) {
      historyRef.current.past.push(drag.original);
      if (historyRef.current.past.length > 50) historyRef.current.past.shift();
      historyRef.current.future = [];
      setHistoryVersion((value) => value + 1);
    }
  }
  function alignSelectedVisual(horizontal: "left" | "center" | "right", vertical: "top" | "middle" | "bottom") {
    if (!selectedClip || !selectedAsset) return;
    const sourceWidth = selectedAsset.width ?? timeline.width;
    const sourceHeight = selectedAsset.height ?? timeline.height;
    const fit = Math.min(timeline.width / sourceWidth, timeline.height / sourceHeight) * selectedTransform.scale;
    const spareX = (timeline.width - (selectedImageGeometry?.width ?? sourceWidth * fit)) / 2;
    const spareY = (timeline.height - (selectedImageGeometry?.height ?? sourceHeight * fit)) / 2;
    editClip(selectedClip.id, { transform: { ...selectedTransform,
      x: horizontal === "left" ? -spareX : horizontal === "right" ? spareX : 0,
      y: vertical === "top" ? -spareY : vertical === "bottom" ? spareY : 0,
    } });
  }
  function beginTrim(event: React.PointerEvent<HTMLSpanElement>, clip: VideoTimelineClip, edge: "left" | "right") {
    event.preventDefault(); event.stopPropagation();
    if (timelineRef.current.trackStates?.[clip.track]?.locked) { setError("Unlock this track before trimming its clips."); return; }
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
  const hasKeyframeAtPlayhead = Boolean(selectedClip?.keyframes?.some((frame) => Math.abs(frame.time - Math.max(0, Math.min(clipLength(selectedClip), timeline.playhead - selectedClip.start))) < 0.05));
  function toggleKeyframeAtPlayhead() {
    if (hasKeyframeAtPlayhead) removeKeyframeAtPlayhead();
    else addOrUpdateKeyframe();
  }
  function patchSelectedEffects(patch: Partial<NonNullable<VideoTimelineClip["effects"]>>) {
    if (!selectedClip) return;
    const base = { brightness: 100, contrast: 100, saturation: 100, grayscale: 0, hue: 0, sepia: 0, blur: 0, ...selectedClip.effects };
    editClip(selectedClip.id, { effects: { ...base, ...patch } });
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
      const audioAsset: VideoTimelineAsset = { id: audioId, name: audioFile.name, type: audioFile.type, size: audioFile.size, duration: audioDuration, kind: "audio", importedAt: Date.now(), derivedFromAssetId: selectedAsset.id };
      const sourceEnd = Math.min(selectedClip.sourceEnd, audioDuration);
      if (sourceEnd <= selectedClip.sourceStart) throw new Error("The extracted audio track does not cover this video clip's selected source range.");
      const current = timelineRef.current;
      const detachedLength = Math.max(0.01, (sourceEnd - selectedClip.sourceStart) / selectedClip.speed);
      const detachedStart = selectedClip.start;
      const detachedEnd = detachedStart + detachedLength;
      let audioTrack = -1;
      while (current.clips.some((clip) => clip.track === audioTrack && detachedStart < clip.start + clipLength(clip) - 0.0001 && detachedEnd > clip.start + 0.0001)) {
        audioTrack -= 1;
      }
      const audioClip: VideoTimelineClip = { id: crypto.randomUUID(), assetId: audioId, track: audioTrack, start: detachedStart, sourceStart: selectedClip.sourceStart, sourceEnd, speed: selectedClip.speed, volume: selectedClip.volume, muted: false, pitchMode: "preserve" };
      const updated = { ...current, assets: [...current.assets, audioAsset], clips: [...current.clips.map((clip) => clip.id === selectedClip.id ? { ...clip, muted: true } : clip), audioClip], duration: Math.max(current.duration, audioClip.start + clipLength(audioClip)) };
      await saveVideoTimeline(projectId, updated, [{ id: audioId, file: audioFile }]);
      setFiles((previous) => ({ ...previous, [audioId]: audioFile }));
      applyTimelineEdit(() => updated); selectTimelineClip(audioClip.id); setStatus(`Source audio detached into Audio ${-audioTrack} as a local editable WAV clip.`);
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
  function createTransitionToNext(kind: "dissolve" | "crossfade" | "fade-black" | VideoTransitionType) {
    if (!selectedClip || !selectedAsset) return;
    const candidates = timeline.clips.filter((clip) => clip.id !== selectedClip.id && clip.track === selectedClip.track && clip.start > selectedClip.start + 0.001)
      .sort((a, b) => a.start - b.start);
    const next = candidates[0];
    const nextAsset = next && timeline.assets.find((asset) => asset.id === next.assetId);
    const allowedKinds = kind === "crossfade" ? ["audio"] : ["video", "image", "text"];
    const duration = Number(transitionDuration);
    if (!next || !nextAsset || !allowedKinds.includes(selectedAsset.kind) || !allowedKinds.includes(nextAsset.kind)) {
      setError(`Select a ${kind === "crossfade" ? "audio" : "visual"} clip with a following clip on the same track.`); return;
    }
    const overlap = Math.max(0, Math.min(clipLength(selectedClip), clipLength(next), duration));
    if (!Number.isFinite(duration) || overlap <= 0 || overlap !== duration) {
      setError("Enter a transition duration greater than 0 and no longer than either clip."); return;
    }
    const isFadeBlack = kind === "fade-black";
    const nextStart = isFadeBlack ? next.start : selectedClip.start + clipLength(selectedClip) - overlap;
    const inType: VideoTransitionType = kind === "dissolve" || kind === "crossfade" || kind === "fade-black" ? "fade" : kind;
    const changes = new Map<string, Partial<VideoTimelineClip>>();
    changes.set(selectedClip.id, { transitions: { ...selectedClip.transitions, fadeIn: selectedClip.transitions?.fadeIn ?? 0, fadeOut: kind === "crossfade" || isFadeBlack ? overlap : selectedClip.transitions?.fadeOut ?? 0 } });
    changes.set(next.id, { start: nextStart, transitions: { ...next.transitions, fadeIn: overlap, fadeOut: next.transitions?.fadeOut ?? 0, inType } });
    applyTimelineEdit((current) => ({
      ...current,
      clips: current.clips.map((clip) => changes.has(clip.id) ? { ...clip, ...changes.get(clip.id) } : clip),
      duration: Math.max(current.duration, ...current.clips.map((clip) => clip.id === next.id ? nextStart + clipLength(clip) : clip.start + clipLength(clip))),
    }));
    setError(""); setStatus(kind === "crossfade" ? "Audio crossfade added between adjacent clips." : `Applied ${kind.replace("-", " ")} transition.`);
  }
  const TEXT_PRESETS: { id: string; label: string; preview: string; settings: VideoTextSettings; transform?: Partial<VideoClipTransform> }[] = [
    { id: "default", label: "Default title", preview: "Your title", settings: { text: "Your title", fontSize: 72, color: "#ffffff", backgroundColor: "#172033", showBackground: false } },
    { id: "lower-third", label: "Lower third", preview: "Name · Role", settings: { text: "Speaker Name\nRole or Title", fontSize: 42, color: "#f3f7fc", backgroundColor: "#0e1b2e", showBackground: true, align: "left", backgroundRadius: 12, backgroundOpacity: 0.86 }, transform: { x: -340, y: 310 } },
    { id: "bold-caption", label: "Bold caption", preview: "BOLD CAPTION", settings: { text: "BOLD CAPTION", fontSize: 64, color: "#ffe14d", backgroundColor: "#000000", showBackground: false, fontFamily: "Impact, sans-serif", strokeColor: "#000000", strokeWidth: 4, shadow: true, shadowColor: "#000000", shadowBlur: 10 }, transform: { y: 260 } },
    { id: "subtitle-bar", label: "Subtitle bar", preview: "Subtitle bar", settings: { text: "Subtitle text here", fontSize: 38, color: "#ffffff", backgroundColor: "#000000", showBackground: true, backgroundRadius: 6, backgroundOpacity: 0.72 }, transform: { y: 360 } },
    { id: "neon", label: "Neon glow", preview: "NEON GLOW", settings: { text: "NEON GLOW", fontSize: 78, color: "#6ef7ff", backgroundColor: "#000000", showBackground: false, fontFamily: "Impact, sans-serif", shadow: true, shadowColor: "#00b7ff", shadowBlur: 22 } },
    { id: "minimal-tag", label: "Minimal corner tag", preview: "TAG", settings: { text: "LOCAL STUDIO", fontSize: 28, color: "#dce8f5", backgroundColor: "#142033", showBackground: true, fontFamily: "'Courier New', monospace", backgroundRadius: 6, backgroundOpacity: 0.65 }, transform: { x: -460, y: -360 } },
  ];
  function addTitlePreset(preset = TEXT_PRESETS[0]) {
    const asset: VideoTimelineAsset = { id: crypto.randomUUID(), name: preset.label, type: "text/plain", size: 0, duration: 3600, kind: "text", importedAt: Date.now(), textSettings: { ...preset.settings } };
    const track = Math.max(0, ...timeline.clips.map((item) => item.track)) + 1;
    const clip: VideoTimelineClip = {
      id: crypto.randomUUID(), assetId: asset.id, track, start: timeline.playhead, sourceStart: 0, sourceEnd: 5, speed: 1, volume: 1, muted: false,
      ...(preset.transform ? { transform: { ...IDENTITY_TRANSFORM, ...preset.transform } } : {}),
    };
    applyTimelineEdit((current) => ({ ...current, assets: [...current.assets, asset], clips: [...current.clips, clip], duration: Math.max(current.duration, clip.start + clipLength(clip)) }));
    selectTimelineClip(clip.id);
  }
  const SVG_SHAPES: { id: string; label: string; svg: (color: string) => string }[] = [
    { id: "rect", label: "Rectangle", svg: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320" viewBox="0 0 512 320"><rect x="16" y="16" width="480" height="288" fill="${c}"/></svg>` },
    { id: "pill", label: "Rounded pill", svg: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="220" viewBox="0 0 512 220"><rect x="16" y="16" width="480" height="188" rx="94" fill="${c}"/></svg>` },
    { id: "circle", label: "Circle", svg: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360"><circle cx="180" cy="180" r="164" fill="${c}"/></svg>` },
    { id: "arrow", label: "Arrow right", svg: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="260" viewBox="0 0 512 260"><path d="M24 96h310V32l154 98-154 98v-64H24z" fill="${c}"/></svg>` },
    { id: "badge", label: "Callout badge", svg: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="280" viewBox="0 0 420 280"><path d="M36 20h348a20 20 0 0 1 20 20v160a20 20 0 0 1-20 20H150l-58 46 14-46H36a20 20 0 0 1-20-20V40a20 20 0 0 1 20-20z" fill="${c}"/></svg>` },
    { id: "frame", label: "Outline frame", svg: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320" viewBox="0 0 512 320"><rect x="18" y="18" width="476" height="284" rx="20" fill="none" stroke="${c}" stroke-width="20"/></svg>` },
  ];
  async function addShapeOverlay(shapeId: string) {
    const shape = SVG_SHAPES.find((item) => item.id === shapeId);
    if (!shape) return;
    const color = /^#[0-9a-f]{6}$/i.test(shapeColor) ? shapeColor : "#38d2e0";
    const file = new File([shape.svg(color)], `${shape.label}.svg`, { type: "image/svg+xml" });
    const current = projectId ? timelineRef.current : EMPTY;
    const asset: VideoTimelineAsset = { id: crypto.randomUUID(), name: shape.label, type: file.type, size: file.size, duration: 3600, kind: "image", importedAt: Date.now(), width: 512, height: 320 };
    const track = Math.max(0, ...current.clips.map((clip) => clip.track)) + 1;
    const clip: VideoTimelineClip = { id: crypto.randomUUID(), assetId: asset.id, track, start: current.playhead, sourceStart: 0, sourceEnd: 5, speed: 1, volume: 1, muted: false, transform: { ...IDENTITY_TRANSFORM, scale: 0.45 } };
    const updated = { ...current, assets: [...current.assets, asset], clips: [...current.clips, clip], duration: Math.max(current.duration, clip.start + clipLength(clip)) };
    try {
      const targetProject = projectId || (await createProject("Untitled video", "video")).id;
      await saveVideoTimeline(targetProject, updated, [{ id: asset.id, file }]);
      setFiles((prev) => ({ ...prev, [asset.id]: file }));
      if (projectId) applyTimelineEdit(() => updated);
      else setParams({ project: targetProject });
      selectTimelineClip(clip.id); setError(""); setStatus(`Added ${shape.label} shape on Overlay ${track}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the shape overlay."); }
  }
  function editTitleAsset(assetId: string, textSettings: NonNullable<VideoTimelineAsset["textSettings"]>) {
    applyTimelineEdit((current) => ({ ...current, assets: current.assets.map((asset) => asset.id === assetId ? { ...asset, textSettings } : asset) }));
  }
  function selectTimelineClip(id: string, additive = false, range = false) {
    if (!id) { setSelected(""); setSelectedClips([]); return; }
    if (range && selected) {
      const anchor = timelineRef.current.clips.find((clip) => clip.id === selected);
      const target = timelineRef.current.clips.find((clip) => clip.id === id);
      if (anchor && target && anchor.track === target.track) {
        const minStart = Math.min(anchor.start, target.start);
        const maxStart = Math.max(anchor.start, target.start);
        const ids = timelineRef.current.clips.filter((clip) => clip.track === anchor.track && clip.start >= minStart && clip.start <= maxStart).map((clip) => clip.id);
        setSelectedClips(ids); setSelected(id); return;
      }
    }
    if (additive) {
      setSelectedClips((current) => {
        const exists = current.includes(id);
        const next = exists ? current.filter((item) => item !== id) : [...(current.length ? current : selected ? [selected] : []), id];
        setSelected(exists ? next[next.length - 1] ?? "" : id);
        return next;
      });
      return;
    }
    setSelected(id);
    setSelectedClips([id]);
  }
  function toggleTrackState(track: number, key: "hidden" | "muted" | "locked") {
    applyTimelineEdit((current) => {
      const prev = current.trackStates?.[track] ?? {};
      return { ...current, trackStates: { ...current.trackStates, [track]: { ...prev, [key]: !prev[key] } } };
    });
  }
  function removeClip(id: string) {
    const ids = selectedClips.length > 1 && selectedClips.includes(id) ? selectedClips : [id];
    const unlockedIds = ids.filter((clipId) => {
      const target = timelineRef.current.clips.find((clip) => clip.id === clipId);
      return target && !timelineRef.current.trackStates?.[target.track]?.locked;
    });
    if (!unlockedIds.length) { setError("Unlock the track before deleting its clips."); return; }
    applyTimelineEdit((current) => {
      const clips = current.clips.filter((clip) => !unlockedIds.includes(clip.id));
      return { ...current, clips, duration: Math.max(0, ...clips.map((clip) => clip.start + clipLength(clip))) };
    });
    setSelected(""); setSelectedClips([]); setError("");
  }
  function splitSelected() {
    const target = selectedClip ?? timeline.clips.find((clip) => clip.track === 0 && timeline.playhead > clip.start && timeline.playhead < clip.start + clipLength(clip));
    if (!target) return;
    if (timeline.trackStates?.[target.track]?.locked) { setError("Unlock this track before splitting its clips."); return; }
    const cut = timeline.playhead;
    if (cut <= target.start || cut >= target.start + clipLength(target)) { setError("Move the playhead inside the selected clip to split it."); return; }
    const sourceCut = target.sourceStart + (cut - target.start) * target.speed;
    const right = { ...target, id: crypto.randomUUID(), start: cut, sourceStart: sourceCut };
    applyTimelineEdit((current) => ({ ...current, clips: [...current.clips.map((clip) => clip.id === target.id ? { ...clip, sourceEnd: sourceCut } : clip), right] }));
    selectTimelineClip(right.id); setHoveredClipId(right.id); setError("");
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
    if (timelineRef.current.trackStates?.[track]?.locked) { setDropPreview(null); event.dataTransfer.dropEffect = "none"; return; }
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
  function snapTimelinePlayhead(rawTime: number, disableSnap = false) {
    const current = timelineRef.current;
    const clamped = Math.max(0, Math.min(current.duration, rawTime));
    if (!snapEnabled || disableSnap || current.duration <= 0) return clamped;
    const threshold = Math.max(0, Math.min(Number(snapThreshold) || 0.25, 10 / Math.max(12, pxPerSecond)));
    const anchors = [0, current.duration, ...current.clips.flatMap((clip) => [clip.start, clip.start + clipLength(clip), ...(clip.keyframes ?? []).map((frame) => clip.start + frame.time)])];
    let best = clamped;
    let bestDist = threshold;
    for (const anchor of anchors) {
      const dist = Math.abs(clamped - anchor);
      if (dist <= bestDist) { best = anchor; bestDist = dist; }
    }
    return Math.max(0, Math.min(current.duration, best));
  }
  function seekTimeline(clientX: number, ruler: HTMLElement, disableSnap = false) {
    if (!timelineRef.current.clips.length || timelineRef.current.duration <= 0) return;
    const time = timelinePointerTime({ clientX }, ruler, timelineRulerOffset());
    setTimeline((current) => ({ ...current, playhead: snapTimelinePlayhead(time, disableSnap) }));
  }
  function showRulerHoverGuide(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = timelineScrollRef.current;
    if (!viewport || !timeline.clips.length || event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = viewport.getBoundingClientRect();
    const left = event.clientX - bounds.left + viewport.scrollLeft;
    if (left < timelineRulerOffset() || left > timelineRulerOffset() + timeline.duration * pxPerSecond) {
      setRulerHoverGuide(null);
      return;
    }
    const top = event.clientY - bounds.top + viewport.scrollTop;
    setRulerHoverGuide({ left, top, height: Math.max(0, viewport.scrollTop + viewport.clientHeight - top) });
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
    setTimeline((current) => ({ ...current, playhead: snapTimelinePlayhead(next, event.altKey) }));
  }
  function finishPlayheadDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (playheadDragRef.current?.pointerId !== event.pointerId) return;
    playheadDragRef.current = null;
    justSeekedRef.current = true;
    window.setTimeout(() => { justSeekedRef.current = false; }, 0);
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
    if (timelineRef.current.trackStates?.[clip.track]?.locked) { setError("Unlock this track before duplicating its clips."); return; }
    const copy = { ...clip, id: crypto.randomUUID(), start: clip.start + clipLength(clip) };
    applyTimelineEdit((current) => ({ ...current, clips: [...current.clips, copy], duration: Math.max(current.duration, copy.start + clipLength(copy)) }));
    selectTimelineClip(copy.id);
  }
  function copyClip(id: string) {
    const clip = timelineRef.current.clips.find((item) => item.id === id);
    if (!clip) return;
    copiedClipRef.current = structuredClone(clip);
    const name = timelineRef.current.assets.find((asset) => asset.id === clip.assetId)?.name ?? "clip";
    setStatus(`Copied ${name}. Press Ctrl+V to paste at the playhead.`);
  }
  function pasteClip() {
    const copied = copiedClipRef.current;
    if (!copied) return;
    if (timelineRef.current.trackStates?.[copied.track]?.locked) { setError("Unlock the target track before pasting."); return; }
    const pasted: VideoTimelineClip = { ...structuredClone(copied), id: crypto.randomUUID(), start: Math.max(0, timelineRef.current.playhead) };
    applyTimelineEdit((current) => ({ ...current, clips: [...current.clips, pasted], duration: Math.max(current.duration, pasted.start + clipLength(pasted)) }));
    selectTimelineClip(pasted.id); setHoveredClipId(pasted.id); setError("");
  }
  async function freezeFrameClip(id: string) {
    const current = timelineRef.current;
    const clip = current.clips.find((item) => item.id === id);
    const asset = clip && current.assets.find((item) => item.id === clip.assetId);
    const video = videoRefs.current[id];
    if (!clip || !asset || asset.kind !== "video" || !video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      setError("Seek the playhead onto a loaded video frame to create a freeze frame."); return;
    }
    const offscreen = document.createElement("canvas");
    offscreen.width = video.videoWidth; offscreen.height = video.videoHeight;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
    const blob = await new Promise<Blob | null>((resolve) => offscreen.toBlob(resolve, "image/png"));
    if (!blob) { setError("Could not capture the current video frame."); return; }
    const file = new File([blob], `${asset.name.replace(/\.[^.]+$/, "")}-freeze.png`, { type: "image/png", lastModified: Date.now() });
    const assetId = crypto.randomUUID();
    const newAsset: VideoTimelineAsset = { id: assetId, name: file.name, type: file.type, size: file.size, duration: 3, kind: "image", importedAt: Date.now(), fileModifiedAt: file.lastModified, width: offscreen.width, height: offscreen.height };
    const targetTrack = current.trackStates?.[clip.track + 1]?.locked ? (current.clips.reduce((max, item) => Math.max(max, item.track), 0) + 1) : clip.track + 1;
    const newClip: VideoTimelineClip = { id: crypto.randomUUID(), assetId, track: targetTrack, start: Math.max(0, current.playhead), sourceStart: 0, sourceEnd: 3, speed: 1, volume: 1, muted: false, transform: clip.transform ? { ...clip.transform } : undefined };
    setFiles((prev) => ({ ...prev, [assetId]: file }));
    applyTimelineEdit((latest) => {
      const next = { ...latest, assets: [...latest.assets, newAsset], clips: [...latest.clips, newClip], duration: Math.max(latest.duration, newClip.start + 3) };
      if (projectId) void saveVideoTimeline(projectId, next, [{ id: assetId, file }]);
      return next;
    });
    selectTimelineClip(newClip.id); setHoveredClipId(newClip.id); setError("");
    setStatus(`Added 3.00s freeze frame from ${asset.name}.`);
  }
  function fitTimelineZoom() {
    const viewportWidth = timelineScrollRef.current?.clientWidth || timelineViewportWidth;
    const available = Math.max(120, viewportWidth - timelineRulerOffset() - 28);
    const next = Math.max(12, Math.min(160, Math.round(available / Math.max(1, timelineRef.current.duration))));
    setZoom(String(next));
  }
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      return target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && ["text", "search", "email", "url", "tel", "password"].includes(target.type)) || (target instanceof HTMLElement && target.isContentEditable);
    }
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (event.code === "Space" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (isTypingTarget(target)) return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) togglePlayback();
        return;
      }
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      const actionControl = target instanceof HTMLElement && target.closest("button, a, [role=button]");
      if (actionControl && !event.ctrlKey && !event.metaKey && event.key !== "Delete" && event.key !== "Backspace") return;
      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
        else if (key === "y") { event.preventDefault(); redo(); }
        else if (key === "b") { event.preventDefault(); splitSelected(); }
        else if (key === "d" && selected) { event.preventDefault(); duplicateClip(selected); }
        else if (key === "c" && selected) { event.preventDefault(); copyClip(selected); }
        else if (key === "v") { event.preventDefault(); pasteClip(); }
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") { if (selected) { event.preventDefault(); removeClip(selected); } }
      else if (event.key.toLowerCase() === "s") { event.preventDefault(); splitSelected(); }
      else if (event.key.toLowerCase() === "q") { event.preventDefault(); deleteHoveredSide("left"); }
      else if (event.key.toLowerCase() === "w") { event.preventDefault(); deleteHoveredSide("right"); }
      else if (event.key.toLowerCase() === "j") { event.preventDefault(); setPlaying(false); setTimeline((current) => ({ ...current, playhead: Math.max(0, current.playhead - 1) })); }
      else if (event.key.toLowerCase() === "k") { event.preventDefault(); setPlaying(false); }
      else if (event.key.toLowerCase() === "l") { event.preventDefault(); if (!playing) togglePlayback(); }
      else if (event.key === "-" || event.key === "_") { event.preventDefault(); setZoom(String(Math.max(12, Math.round(pxPerSecond / 1.2)))); }
      else if (event.key === "=" || event.key === "+") { event.preventDefault(); setZoom(String(Math.min(160, Math.round(pxPerSecond * 1.2)))); }
      else if (event.key === "?") { event.preventDefault(); setShortcutsOpen((open) => !open); }
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const step = event.shiftKey ? 1 : 1 / Math.max(1, timelineRef.current.fps);
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        setTimeline((current) => ({ ...current, playhead: Math.max(0, Math.min(current.duration, current.playhead + step * direction)) }));
      } else if (event.key === "Home") { event.preventDefault(); setTimeline((current) => ({ ...current, playhead: 0 })); }
    }
    function onKeyUp(event: KeyboardEvent) {
      const target = event.target;
      if (event.code !== "Space" || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(target)) return;
      event.preventDefault();
      event.stopPropagation();
    }
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
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
      const renderTimeline = { ...timeline, width, height, fps, clips: timeline.clips.map((clip) => (timeline.trackStates?.[clip.track]?.muted ? { ...clip, muted: true } : clip)) };
      const hasAudio = renderTimeline.clips.some((clip) => !clip.muted && clip.volume > 0 && (clip.track < 0 || timeline.assets.some((asset) => asset.id === clip.assetId && asset.kind === "video")));
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
  const nextAudioTrack = Math.min(0, ...timeline.clips.map((clip) => clip.track)) - 1;
  const overlayLaneCount = visibleTracks.filter((track) => track > 0).length;
  const audioLaneCount = visibleTracks.filter((track) => track < 0).length;
  return <main className="video-studio-page" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files.length) void importFiles(event.dataTransfer.files); }}>
    <div className="video-studio-top">
      <div className="studio-project-identity"><a href="/projects" className="studio-back-link" aria-label="Back to projects">‹</a><span className="studio-app-mark">L</span><div>{projectId ? <input className="studio-project-title-input" value={projectTitle} aria-label="Project title" maxLength={80} placeholder="Untitled video" onChange={(event) => setProjectTitle(event.currentTarget.value)} onBlur={() => { const trimmed = projectTitle.trim() || "Untitled video"; setProjectTitle(trimmed); void renameProject(projectId, trimmed); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /> : <h1>Video Studio</h1>}<span className="studio-save-status" role="status">{status}</span></div></div>
      <div className="editor-top-actions">
        {!projectId && <button className="studio-new-project" onClick={() => void createVideoProject()}>New project</button>}
        <span className="studio-local-badge">● Local project</span>
        <button type="button" className="studio-shortcuts-button" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onClick={() => setShortcutsOpen(true)}>?</button>
        <button className="studio-export-trigger" onClick={() => setExportOpen(true)}>Export video</button>
      </div>
    </div>
    {error && <p className="resize-error" role="alert">{error}</p>}
    {extractingAudio && <p className="source-info" role="status">Detaching source audio: {extractProgress}% <button className="editor-action danger" onClick={() => void cancelAudioExtraction()}>Cancel</button></p>}
    <section className="video-editor-layout" inert={exporting || extractingAudio}>
      <aside className="video-bin"><div className="studio-bin-tabs" role="tablist" aria-label="Editor tools">{(["media", "library", "text", "shapes", "transitions"] as const).map((tab) => <button key={tab} role="tab" aria-selected={activeBinTab === tab} className={activeBinTab === tab ? "active" : ""} onClick={() => setActiveBinTab(tab)}>{tab === "media" ? "▣" : tab === "library" ? "▤" : tab === "text" ? "T" : tab === "shapes" ? "□" : "◇"}<span>{tab[0].toUpperCase() + tab.slice(1)}</span></button>)}</div>
        <div className="studio-bin-body" ref={binBodyRef} onPointerDown={beginBinMarquee} onPointerMove={moveBinMarquee} onPointerUp={finishBinMarquee} onPointerCancel={cancelBinMarquee}>{activeBinTab === "media" ? <><div className="studio-bin-heading"><strong>Your media</strong><div className="studio-bin-heading-actions"><button type="button" disabled={!visibleMediaAssets.length} onClick={() => { setSelectedBinIds(visibleMediaAssets.map((asset) => asset.id)); binSelectionAnchorRef.current = visibleMediaAssets[0]?.id ?? null; }}>Select all</button><button type="button" disabled={!selectedBinIds.length} onClick={() => { setSelectedBinIds([]); binSelectionAnchorRef.current = null; }}>Deselect all</button><span>{mediaAssetCount} items</span></div></div><div className="studio-media-toolbar"><label className="studio-import-button">＋ Import media<input type="file" multiple accept="video/*,audio/*,image/*" disabled={Boolean(projectId && !ready) || exporting} onChange={(event) => { const chosen = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void importFiles(chosen); }} /></label><MediaBinControls filter={mediaFilter} onFilter={(filter) => { setMediaFilter(filter); setSelectedBinIds([]); binSelectionAnchorRef.current = null; }} sort={mediaSort} onSort={(sort) => { setMediaSort(sort); setMediaSortDirection(sort === "name" || sort === "type" ? "asc" : "desc"); }} direction={mediaSortDirection} onDirection={setMediaSortDirection} /></div><div className="studio-bin-grid">{visibleMediaAssets.map((asset) => <button key={asset.id} data-asset-id={asset.id} className={`bin-item ${selectedBinIds.includes(asset.id) ? "bin-selected" : ""}`} aria-pressed={selectedBinIds.includes(asset.id)} onPointerDown={(event) => { if (event.button !== 0 || asset.kind === "text") return; const ids = selectedBinIds.includes(asset.id) && !event.ctrlKey && !event.metaKey && !event.shiftKey ? visibleMediaAssets.filter((item) => selectedBinIds.includes(item.id)).map((item) => item.id) : [asset.id]; binPointerRef.current = { pointerId: event.pointerId, id: asset.id, ids, initialX: event.clientX, initialY: event.clientY, dragging: false }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={moveBinPointer} onPointerUp={finishBinPointer} onPointerCancel={cancelBinPointer} onClick={(event) => { if (suppressBinClickRef.current) { event.preventDefault(); return; } if (event.detail === 0) return; selectBinAsset(asset.id, event.shiftKey, event.ctrlKey || event.metaKey); }} onKeyDown={(event) => { if (asset.kind === "text") return; if (event.key === "Enter" && (event.ctrlKey || event.metaKey || event.shiftKey)) { event.preventDefault(); selectBinAsset(asset.id, event.shiftKey, event.ctrlKey || event.metaKey); } else if (event.key === "Enter") { event.preventDefault(); const ids = selectedBinIds.includes(asset.id) ? selectedBinIds : [asset.id]; placeMediaBatch(ids, asset.kind === "audio" ? -1 : 0, timeline.playhead); } }} title={`Select ${asset.name}. Ctrl-click to toggle, Shift-click to select a range; drag selected media to the timeline.`}><span className={`studio-asset-thumb ${asset.kind}`}>{asset.kind === "image" && assetUrls[asset.id] ? <img src={assetUrls[asset.id]} alt="" /> : asset.kind === "video" && assetUrls[asset.id] ? <video src={assetUrls[asset.id]} muted preload="metadata" onLoadedMetadata={(event) => { event.currentTarget.currentTime = Math.min(0.1, asset.duration / 2); }} aria-hidden="true" /> : asset.kind === "audio" ? "♫" : "T"}{asset.kind !== "image" && <span className="studio-asset-duration">{formatAssetDuration(asset.duration)}</span>}</span><strong title={asset.name}>{asset.name}</strong></button>)}</div>{mediaAssetCount > 0 && !visibleMediaAssets.length && <p className="studio-bin-hint studio-bin-no-results">No {mediaFilter} media in this project.</p>}{!mediaAssetCount && <div className="studio-bin-empty"><span>▣</span><strong>Start with your media</strong><p>Import video, audio, or images. Your files stay on this device.</p></div>}</> : activeBinTab === "library" ? <><div className="studio-bin-heading"><strong>Library</strong><span>On this device</span></div><div className="studio-library-tabs" role="tablist" aria-label="Library categories">{(["image", "video", "sound"] as const).map((tab) => <button type="button" key={tab} role="tab" aria-selected={libraryTab === tab} className={libraryTab === tab ? "active" : ""} onClick={() => setLibraryTab(tab)}>{tab === "sound" ? "Sound effects" : `${tab[0].toUpperCase()}${tab.slice(1)}s`}</button>)}</div>{libraryTab === "image" ? <div className="studio-library-grid"><div className="studio-library-color-tile"><button type="button" className="studio-library-color-preview" aria-label="Add color background to timeline" title="Add color background to timeline" style={{ backgroundColor: libraryBackgroundColor }} disabled={Boolean(projectId && !ready) || exporting} onClick={() => void addLibraryColorBackground()} /><label className="studio-library-color-picker" title="Choose background color"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5a7.5 7.5 0 1 0 0 15h1a2 2 0 0 0 1.5-3.3c-.7-.8-.2-2.2.9-2.2H15a2.5 2.5 0 0 0 2.5-2.5C17.5 5.6 14.1 2.5 10 2.5Z"/><circle cx="6.5" cy="9" r=".7"/><circle cx="9.5" cy="6.5" r=".7"/><circle cx="13" cy="7" r=".7"/></svg><input aria-label="Choose background color" type="color" value={libraryBackgroundColor} onChange={(event) => setLibraryBackgroundColor(event.currentTarget.value)} /></label></div></div> : libraryTab === "video" ? <p className="studio-bin-hint">Library videos are not available yet.</p> : <p className="studio-bin-hint">Sound effects are not available yet.</p>}</> : activeBinTab === "text" ? <><div className="studio-bin-heading"><strong>Text presets</strong><span>Click to add</span></div><div className="studio-bin-grid">{TEXT_PRESETS.map((preset) => <button type="button" key={preset.id} className="bin-item studio-preset-tile" disabled={!projectId || !ready || exporting} onClick={() => addTitlePreset(preset)} title={preset.label}><span className="studio-asset-thumb studio-text-preview-box"><span className="studio-text-preview-sample" style={{ fontFamily: preset.settings.fontFamily ?? "system-ui, sans-serif", fontWeight: preset.settings.bold === false ? 400 : 700, fontStyle: preset.settings.italic ? "italic" : "normal", color: preset.settings.color, backgroundColor: preset.settings.showBackground ? preset.settings.backgroundColor : "transparent", borderRadius: preset.settings.backgroundRadius ? `${Math.min(8, preset.settings.backgroundRadius)}px` : undefined, textShadow: preset.settings.shadow ? `0 1px ${Math.min(10, preset.settings.shadowBlur ?? 8)}px ${preset.settings.shadowColor ?? "#000"}` : preset.settings.strokeWidth ? `0 0 2px ${preset.settings.strokeColor ?? "#000"}` : undefined }}>{preset.preview}</span></span><strong title={preset.label}>{preset.label}</strong></button>)}</div></>
: activeBinTab === "shapes" ? <><div className="studio-bin-heading"><strong>Shapes</strong><span>Vector overlays</span></div><label className="speed-field">Shape color<input type="color" value={shapeColor} onChange={(event) => setShapeColor(event.currentTarget.value)} /></label><div className="studio-bin-grid">{SVG_SHAPES.map((shape) => <button type="button" key={shape.id} className="bin-item studio-preset-tile" disabled={Boolean(projectId && !ready) || exporting} onClick={() => void addShapeOverlay(shape.id)} title={shape.label}><span className="studio-asset-thumb studio-shape-preview-box"><img src={`data:image/svg+xml;utf8,${encodeURIComponent(shape.svg(shapeColor))}`} alt="" aria-hidden="true" /></span><strong title={shape.label}>{shape.label}</strong></button>)}</div></>
: <><div className="studio-bin-heading"><strong>Transitions</strong></div><p className="studio-bin-hint">Select a clip on the timeline, then apply a transition to the next clip on the same track.</p><label className="speed-field">Duration <span>seconds</span><input type="number" min="0.01" max="10" step="0.05" value={transitionDuration} onChange={(event) => setTransitionDuration(event.currentTarget.value)} /></label><div className="studio-bin-grid">{([["dissolve", "Dissolve", "Blend adjacent visuals"], ["fade-black", "Fade black", "Fade out then fade in"], ["wipe-left", "Wipe left", "Reveal next clip from left"], ["wipe-right", "Wipe right", "Reveal next clip from right"], ["wipe-up", "Wipe up", "Reveal next clip from top"], ["wipe-down", "Wipe down", "Reveal next clip from bottom"], ["slide-left", "Slide left", "Slide next clip in from right"], ["slide-right", "Slide right", "Slide next clip in from left"], ["zoom-in", "Zoom in", "Scale next clip up"]] as const).map(([kind, label, desc]) => <button type="button" key={kind} className="bin-item studio-preset-tile" disabled={!selectedClip || selectedClip.track < 0} onClick={() => createTransitionToNext(kind)} title={desc}><span className={`studio-asset-thumb studio-transition-preview-box tr-${kind}`} aria-hidden="true"><i className="tr-a" /><i className="tr-b" /></span><strong title={label}>{label}</strong></button>)}<button type="button" className="bin-item studio-preset-tile" disabled={!selectedClip || selectedClip.track >= 0} onClick={() => createTransitionToNext("crossfade")} title="Blend adjacent audio"><span className="studio-asset-thumb studio-transition-preview-box tr-crossfade" aria-hidden="true"><i className="tr-a" /><i className="tr-b" /></span><strong title="Crossfade">Crossfade</strong></button></div></>}</div></aside>
      <section className={`editor-preview${playerExpanded ? " expanded" : ""}`} ref={previewRef}><div className="preview-heading"><strong>Composite preview</strong><span>{previewAsset?.name ?? "Nothing at playhead"} · {timeline.playhead.toFixed(2)} s · {timeline.width}×{timeline.height}</span></div><div className="editor-stage" ref={stageRef} title="Drag empty area to pan when zoomed, or Ctrl+scroll to zoom" onPointerDown={beginStagePan} onPointerMove={moveStagePan} onPointerUp={finishStagePan} onPointerCancel={finishStagePan}><div className="editor-stage-viewport" ref={viewportRef} style={{ transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})` }}><canvas ref={canvasRef} aria-label="Composited video timeline preview" />{previewSnapGuides.x !== null && <div className="studio-snap-guide vertical" aria-hidden="true" style={{ left: previewSnapGuides.x }} />}{previewSnapGuides.y !== null && <div className="studio-snap-guide horizontal" aria-hidden="true" style={{ top: previewSnapGuides.y }} />}{previewOverlays.map((item, index) => {
  const isSelected = selected === item.clip.id;
  const style = { left: item.box.left, top: item.box.top, width: item.box.width, height: item.box.height, zIndex: 5 + index, transform: `translate(-50%, -50%) rotate(${item.transform.rotation}deg)` };
  if (item.kind === "text") return <div key={item.clip.id} className={`studio-title-overlay ${isSelected ? "selected" : ""}`} role="group" aria-label={isSelected ? "Selected title: drag to move, use corner to resize, top handle to rotate" : `Select title ${item.asset.name}`} style={style} onPointerDown={(event) => beginTextGesture(event, item.clip, item.transform, item.box)} onPointerMove={moveTextGesture} onPointerUp={finishTextGesture} onPointerCancel={finishTextGesture}><span className="studio-title-rotate" data-title-handle="rotate" title="Rotate text" /><span className="studio-title-resize" data-title-handle="scale" title="Resize text" /></div>;
  if (item.kind === "image") return <div key={item.clip.id} className={`studio-image-overlay ${isSelected ? "selected" : ""}`} role="group" aria-label={isSelected ? "Selected image: drag to move, use corner to resize, top handle to rotate" : `Select image ${item.asset.name}`} style={style} onPointerDown={(event) => beginImageGesture(event, item.clip, item.transform, item.imageGeometry, item.box)} onPointerMove={moveImageGesture} onPointerUp={finishImageGesture} onPointerCancel={finishImageGesture}><span className="studio-image-rotate" data-image-handle="rotate" title="Rotate image" /><span className="studio-image-resize" data-image-handle="resize" title="Resize image" /></div>;
  return <div key={item.clip.id} className={`studio-video-overlay ${isSelected ? "selected" : ""}`} role="group" aria-label={isSelected ? "Selected video: drag to move, use corner to resize, top handle to rotate" : `Select video ${item.asset.name}`} style={style} onPointerDown={(event) => beginTextGesture(event, item.clip, item.transform, item.box)} onPointerMove={moveTextGesture} onPointerUp={finishTextGesture} onPointerCancel={finishTextGesture}><span className="studio-title-rotate" data-title-handle="rotate" title="Rotate video" /><span className="studio-title-resize" data-title-handle="scale" title="Resize video" /></div>;
})}</div><div className="media-sources" aria-hidden="true">{timeline.assets.filter((asset) => asset.kind === "image").map((asset) => <img key={asset.id} ref={(el) => { if (el) imageRefs.current[asset.id] = el; else delete imageRefs.current[asset.id]; }} src={assetUrls[asset.id]} alt="" onLoad={() => setMediaRevision((n) => n + 1)} />)}{timeline.clips.filter((clip) => timeline.assets.find((asset) => asset.id === clip.assetId)?.kind === "video").map((clip) => <video key={clip.id} ref={(el) => { if (el) videoRefs.current[clip.id] = el; else delete videoRefs.current[clip.id]; }} src={assetUrls[clip.assetId]} playsInline preload="auto" onLoadedData={() => setMediaRevision((n) => n + 1)} onSeeked={() => setMediaRevision((n) => n + 1)} />)}{timeline.clips.filter((clip) => clip.track < 0).map((clip) => <audio key={clip.id} ref={(el) => { if (el) audioRefs.current[clip.id] = el; else delete audioRefs.current[clip.id]; }} src={assetUrls[clip.assetId]} preload="auto" />)}</div></div><div className="editor-transport">
        <span className="studio-timecode" aria-label="Current time and timeline duration">{formatTimecode(timeline.playhead, timeline.fps)} <span>/</span> {formatTimecode(timeline.duration, timeline.fps)}</span>
        <div className="studio-playback-controls">
          <button type="button" aria-label="Previous frame" title="Previous frame" disabled={!timeline.clips.length} onClick={() => stepFrame(-1)}>⏮</button>
          <button type="button" className="studio-play-button" aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause" : "Play"} disabled={!timeline.clips.length} onClick={togglePlayback}>{playing ? "❚❚" : "▶"}</button>
          <button type="button" aria-label="Next frame" title="Next frame" disabled={!timeline.clips.length} onClick={() => stepFrame(1)}>⏭</button>
        </div>
        <div className="studio-player-tools"><span>{timeline.width} × {timeline.height}</span><details className="studio-ratio-menu"><summary aria-label="Preview zoom">{previewZoom === 1 && previewPan.x === 0 && previewPan.y === 0 ? "Fit" : `${Math.round(previewZoom * 100)}%`}</summary><div className="studio-ratio-options">{([["Fit", 1], ["50%", 0.5], ["100%", 1], ["150%", 1.5], ["200%", 2]] as const).map(([label, value]) => <button type="button" key={label} className={label === "Fit" ? previewZoom === 1 && previewPan.x === 0 && previewPan.y === 0 ? "active" : "" : Math.abs(previewZoom - value) < 0.01 ? "active" : ""} onClick={() => setPreviewZoomValue(value, label === "Fit")}>{label}</button>)}<div className="studio-custom-ratio"><label>Zoom %<input type="number" min="25" max="400" step="1" value={previewZoomDraft} onChange={(event) => setPreviewZoomDraft(event.currentTarget.value)} onBlur={() => { const parsed = Number(previewZoomDraft); if (Number.isFinite(parsed) && parsed >= 25 && parsed <= 400) setPreviewZoomValue(parsed / 100); else setPreviewZoomDraft(String(Math.round(previewZoom * 100))); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>{(previewZoom !== 1 || previewPan.x !== 0 || previewPan.y !== 0) && <button type="button" className="editor-action" onClick={() => setPreviewZoomValue(1, true)}>Reset view</button>}</div></div></details><details className="studio-ratio-menu"><summary aria-label="Canvas aspect ratio">Ratio</summary><div className="studio-ratio-options">{ASPECT_RATIOS.map((option) => <button type="button" key={option.value} className={(timeline.aspectRatioMode ?? "custom") === option.value ? "active" : ""} onClick={() => selectAspectRatio(option.value)}>{option.label}</button>)}{(timeline.aspectRatioMode ?? "custom") === "custom" && <div className="studio-custom-ratio"><label>Width <input type="number" min="16" max="7680" step="1" value={widthDraft} onChange={(event) => setWidthDraft(event.currentTarget.value)} onBlur={commitCustomCanvas} /></label><label>Height <input type="number" min="16" max="4320" step="1" value={heightDraft} onChange={(event) => setHeightDraft(event.currentTarget.value)} onBlur={commitCustomCanvas} /></label></div>}</div></details><button type="button" aria-label={playerExpanded ? "Exit fullscreen player" : "Fullscreen player"} title={playerExpanded ? "Exit fullscreen player" : "Fullscreen player"} onClick={() => void toggleFullscreen()}>⛶</button></div>
      </div></section>
      <aside className="video-inspector">
        <div className="preview-heading"><strong>{selectedClip ? selectedAsset?.kind === "audio" ? "Audio" : selectedAsset?.kind === "text" ? "Text" : selectedAsset?.kind === "image" ? "Image" : "Video" : "Details"}</strong><span>{selectedClip ? "Clip settings" : "Project settings"}</span></div>
        {!selectedClip && <div className="studio-project-details"><h2>Project</h2><dl><div><dt>Media</dt><dd>{mediaAssetCount} files</dd></div><div><dt>Tracks</dt><dd>{visibleTracks.filter((track) => track >= 0).length} video · {visibleTracks.filter((track) => track < 0).length} audio</dd></div><div><dt>Resolution</dt><dd>{timeline.width} × {timeline.height}</dd></div><div><dt>Frame rate</dt><dd>{timeline.fps} fps</dd></div><div><dt>Duration</dt><dd>{timeline.duration.toFixed(2)} s</dd></div><div><dt>Storage</dt><dd>On this device</dd></div></dl><button className="editor-action" onClick={() => setExportOpen(true)}>Export settings</button></div>}
        {selectedClip && <>
          <div className="studio-inspector-tabs" role="tablist" aria-label="Clip settings">{(["basic", "speed", "adjust"] as const).map((tab) => <button key={tab} role="tab" aria-selected={inspectorTab === tab} className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}</div>
          {inspectorTab === "basic" && <>
          {selectedClip.track >= 0 && selectedAsset?.kind === "video" && <>
            <div className="clip-control-group"><div className="clip-control-head"><strong>Transform</strong><button type="button" className={`keyframe-diamond-btn${hasKeyframeAtPlayhead ? " active" : ""}`} aria-pressed={hasKeyframeAtPlayhead} title={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"} aria-label={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"} onClick={toggleKeyframeAtPlayhead}>{hasKeyframeAtPlayhead ? "◆" : "◇"}</button></div>
              <div className="clip-range-pair"><EditorRange label="Scale" min={0.1} max={8} step={0.01} value={selectedTransform.scale} unit="×" onChange={(scale) => editClip(selectedClip.id, { transform: { ...selectedTransform, scale } })} />
              <EditorRange label="Rotate" min={-180} max={180} step={0.1} value={selectedTransform.rotation} unit="°" onChange={(rotation) => editClip(selectedClip.id, { transform: { ...selectedTransform, rotation } })} /></div>
              <div className="clip-align-controls" aria-label="Align video overlay"><span>Align</span>{(["left", "center", "right"] as const).map((horizontal) => <button type="button" key={horizontal} onClick={() => alignSelectedVisual(horizontal, "middle")} aria-label={`Align ${horizontal}`} title={`Align ${horizontal}`}>{horizontal === "left" ? "⇤" : horizontal === "right" ? "⇥" : "↔"}</button>)}{(["top", "middle", "bottom"] as const).map((vertical) => <button type="button" key={vertical} onClick={() => alignSelectedVisual("center", vertical)} aria-label={`Align ${vertical}`} title={`Align ${vertical}`}>{vertical === "top" ? "⇡" : vertical === "bottom" ? "⇣" : "↕"}</button>)}</div>
              <div className="clip-align-controls"><span>Mirror</span><button type="button" aria-pressed={Boolean(selectedTransform.mirrorX)} onClick={() => editClip(selectedClip.id, { transform: { ...selectedTransform, mirrorX: !selectedTransform.mirrorX } })}>X</button><button type="button" aria-pressed={Boolean(selectedTransform.mirrorY)} onClick={() => editClip(selectedClip.id, { transform: { ...selectedTransform, mirrorY: !selectedTransform.mirrorY } })}>Y</button></div>
            </div>
            <div className="clip-control-head"><span>Audio volume</span><button type="button" className={`keyframe-diamond-btn${hasKeyframeAtPlayhead ? " active" : ""}`} aria-pressed={hasKeyframeAtPlayhead} title={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"} aria-label={hasKeyframeAtPlayhead ? "Remove volume keyframe at playhead" : "Add volume keyframe at playhead"} onClick={toggleKeyframeAtPlayhead}>{hasKeyframeAtPlayhead ? "◆" : "◇"}</button></div>
            <EditorRange label="Audio volume" min={0} max={4} step={0.01} value={selectedValues?.volume ?? selectedClip.volume} unit="×" onChange={(volume) => editClip(selectedClip.id, { volume })} />
            <label className="ratio-toggle"><input type="checkbox" checked={selectedClip.muted} onChange={(event) => editClip(selectedClip.id, { muted: event.currentTarget.checked })} />Silence audio</label>
            <div className="clip-action-row"><button className="editor-action" disabled={extractingAudio} onClick={() => void detachVideoAudio()}>{extractingAudio ? `Extracting ${extractProgress}%` : "Extract audio"}</button><button className="editor-action" onClick={splitSelected}>Split</button><button className="editor-action" onClick={() => duplicateClip(selectedClip.id)}>Duplicate</button></div>
          </>}
          {selectedClip.track >= 0 && selectedAsset?.kind === "image" && selectedImageGeometry && <div className="clip-control-group studio-image-controls">
            <div className="clip-control-head"><strong>Image size and position</strong><button type="button" className={`keyframe-diamond-btn${hasKeyframeAtPlayhead ? " active" : ""}`} aria-pressed={hasKeyframeAtPlayhead} title={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"} aria-label={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"} onClick={toggleKeyframeAtPlayhead}>{hasKeyframeAtPlayhead ? "◆" : "◇"}</button></div>
            <div className="filter-fields two-column transform-fields">
              <ImageNumberInput label="Width" unit="canvas px" value={selectedImageGeometry.width} min={1} max={32768} step="1" onCommit={(value) => setSelectedImageSize("width", value)} />
              <ImageNumberInput label="Height" unit="canvas px" value={selectedImageGeometry.height} min={1} max={32768} step="1" onCommit={(value) => setSelectedImageSize("height", value)} />
            </div>
            <label className="ratio-toggle"><input type="checkbox" checked={selectedClip.imageMatchAspect !== false} onChange={(event) => {
              const match = event.currentTarget.checked;
              const scale = Math.max(0.001, selectedTransform.scale);
              editClip(selectedClip.id, { imageMatchAspect: match, ...(match ? { imageSize: { width: selectedImageGeometry.width / scale, height: selectedImageGeometry.width / (selectedImageGeometry.source.width / selectedImageGeometry.source.height) / scale } } : {}) });
            }} />Maintain aspect ratio when resizing</label>
            <div className="filter-fields two-column transform-fields">
              <ImageNumberInput label="Position X" unit="canvas px" value={selectedTransform.x} min={-32768} max={32768} onCommit={(x) => editClip(selectedClip.id, { transform: { ...selectedTransform, x } })} />
              <ImageNumberInput label="Position Y" unit="canvas px" value={selectedTransform.y} min={-32768} max={32768} onCommit={(y) => editClip(selectedClip.id, { transform: { ...selectedTransform, y } })} />
              <ImageNumberInput label="Rotation" unit="degrees" value={selectedTransform.rotation} min={-3600} max={3600} onCommit={(rotation) => editClip(selectedClip.id, { transform: { ...selectedTransform, rotation } })} />
              <ImageNumberInput label="Opacity" unit="percent" value={selectedTransform.opacity * 100} min={0} max={100} onCommit={(opacity) => editClip(selectedClip.id, { transform: { ...selectedTransform, opacity: opacity / 100 } })} />
            </div>
            <div className="clip-align-controls" aria-label="Align image"><span>Align</span>{(["left", "center", "right"] as const).map((horizontal) => <button type="button" key={horizontal} onClick={() => alignSelectedVisual(horizontal, "middle")} aria-label={`Align ${horizontal}`} title={`Align ${horizontal}`}>{horizontal === "left" ? "⇤" : horizontal === "right" ? "⇥" : "↔"}</button>)}{(["top", "middle", "bottom"] as const).map((vertical) => <button type="button" key={vertical} onClick={() => alignSelectedVisual("center", vertical)} aria-label={`Align ${vertical}`} title={`Align ${vertical}`}>{vertical === "top" ? "⇡" : vertical === "bottom" ? "⇣" : "↕"}</button>)}</div>
            <div className="clip-align-controls"><span>Mirror</span><button type="button" aria-pressed={Boolean(selectedTransform.mirrorX)} onClick={() => editClip(selectedClip.id, { transform: { ...selectedTransform, mirrorX: !selectedTransform.mirrorX } })}>X</button><button type="button" aria-pressed={Boolean(selectedTransform.mirrorY)} onClick={() => editClip(selectedClip.id, { transform: { ...selectedTransform, mirrorY: !selectedTransform.mirrorY } })}>Y</button></div>
            <button type="button" className="editor-action" onClick={() => editClip(selectedClip.id, { imageSize: undefined })}>Reset size to fit</button>
            <strong>Crop source</strong>
            <p className="resize-note">Crop percentages remove edges from this clip only. Drag the image in the preview to move it; drag its corner to resize.</p>
            <div className="filter-fields two-column transform-fields">
              {(["left", "top", "right", "bottom"] as const).map((edge) => <ImageNumberInput key={`${selectedClip.id}-crop-${edge}`} label={`Crop ${edge}`} unit="percent" value={imageCrop[edge] * 100} min={0} max={99.9} onCommit={(value) => setSelectedImageCrop(edge, value)} />)}
            </div>
            <button type="button" className="editor-action" onClick={resetSelectedImageCrop}>Reset crop</button>
          </div>}
          {selectedClip.track < 0 && selectedAsset?.kind === "audio" && <>
            <div className="clip-control-head"><span>Audio volume</span><button type="button" className={`keyframe-diamond-btn${hasKeyframeAtPlayhead ? " active" : ""}`} aria-pressed={hasKeyframeAtPlayhead} title={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"} aria-label={hasKeyframeAtPlayhead ? "Remove volume keyframe at playhead" : "Add volume keyframe at playhead"} onClick={toggleKeyframeAtPlayhead}>{hasKeyframeAtPlayhead ? "◆" : "◇"}</button></div>
            <EditorRange label="Audio volume" min={0} max={4} step={0.01} value={selectedValues?.volume ?? selectedClip.volume} unit="×" onChange={(volume) => editClip(selectedClip.id, { volume })} />
          </>}
          {selectedClip.track >= 0 && <label className="ratio-field">Blend mode<select value={selectedClip.blendMode ?? "source-over"} onChange={(event) => editClip(selectedClip.id, { blendMode: event.currentTarget.value as NonNullable<VideoTimelineClip["blendMode"]> })}><option value="source-over">Normal</option><option value="screen">Screen</option><option value="multiply">Multiply</option><option value="overlay">Overlay</option><option value="lighten">Lighten</option><option value="darken">Darken</option></select></label>}
          <div className="clip-placement-pair">
            <label className="speed-field">Track<input type="number" step="1" value={selectedClip.track} onChange={(event) => { const value = Number(event.currentTarget.value); if (Number.isInteger(value)) editClip(selectedClip.id, { track: selectedClip.track < 0 ? Math.min(-1, value) : Math.max(0, value) }); }} /></label>
            <label className="speed-field">Timeline start <span>seconds</span><input type="number" min="0" step="0.001" value={Number(selectedClip.start.toFixed(3))} onChange={(event) => editClip(selectedClip.id, { start: Math.max(0, Number(event.currentTarget.value) || 0) })} /></label>
            <label className="speed-field">Source in <span>seconds</span><input type="number" min="0" max={selectedAsset?.duration} step="0.001" value={Number(selectedClip.sourceStart.toFixed(3))} onChange={(event) => editClip(selectedClip.id, { sourceStart: Math.max(0, Math.min(selectedClip.sourceEnd - 0.01, Number(event.currentTarget.value) || 0)) })} /></label>
            <label className="speed-field">Source out <span>seconds</span><input type="number" min="0.01" max={selectedAsset?.duration} step="0.001" value={Number(selectedClip.sourceEnd.toFixed(3))} onChange={(event) => editClip(selectedClip.id, { sourceEnd: Math.min(selectedAsset?.duration ?? selectedClip.sourceEnd, Math.max(selectedClip.sourceStart + 0.01, Number(event.currentTarget.value) || 0)) })} /></label>
          </div>
          </>}
          {inspectorTab === "speed" && <>
          <EditorRange label="Speed" min={0.1} max={16} step={0.01} value={selectedClip.speed} unit="×" onChange={(speed) => editClip(selectedClip.id, { speed })} />
          <div className="speed-presets" aria-label="Speed presets">{([0.25, 0.5, 1, 2, 4] as const).map((preset) => <button type="button" key={preset} className={Math.abs(selectedClip.speed - preset) < 0.001 ? "active" : ""} onClick={() => editClip(selectedClip.id, { speed: preset })}>{preset}×</button>)}</div>
          <label className="speed-field">Speed value <span>0.1–16×</span><input type="number" min="0.1" max="16" step="0.001" value={Number(selectedClip.speed.toFixed(3))} onChange={(event) => editClip(selectedClip.id, { speed: Math.max(0.1, Math.min(16, Number(event.currentTarget.value) || 1)) })} /></label>
          <ImageNumberInput
            label="Target duration"
            unit="seconds"
            value={clipLength(selectedClip)}
            min={Math.max(0.01, (selectedClip.sourceEnd - selectedClip.sourceStart) / 16)}
            max={(selectedClip.sourceEnd - selectedClip.sourceStart) / 0.1}
            step="0.01"
            onCommit={(targetDuration) => {
              const sourceSpan = Math.max(0.01, selectedClip.sourceEnd - selectedClip.sourceStart);
              const nextSpeed = Math.max(0.1, Math.min(16, sourceSpan / Math.max(0.01, targetDuration)));
              editClip(selectedClip.id, { speed: nextSpeed });
            }}
          />
          <p className="resize-note">Clip duration: {clipLength(selectedClip).toFixed(2)} s (source {(selectedClip.sourceEnd - selectedClip.sourceStart).toFixed(2)} s)</p>
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
            <div className="clip-control-head"><strong>Title style</strong><button type="button" className={`keyframe-diamond-btn${hasKeyframeAtPlayhead ? " active" : ""}`} aria-pressed={hasKeyframeAtPlayhead} title={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"} aria-label={hasKeyframeAtPlayhead ? "Remove title keyframe at playhead" : "Add title keyframe at playhead"} onClick={toggleKeyframeAtPlayhead}>{hasKeyframeAtPlayhead ? "◆" : "◇"}</button></div>
            <label className="ratio-field">Title text<textarea rows={3} maxLength={500} value={selectedAsset.textSettings.text} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, text: event.currentTarget.value })} /></label>
            <div className="filter-fields two-column transform-fields">
              <label className="ratio-field">Font<select value={selectedAsset.textSettings.fontFamily ?? "system-ui, sans-serif"} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, fontFamily: event.currentTarget.value })}><option value="system-ui, sans-serif">System Sans</option><option value="Inter Variable, sans-serif">Inter</option><option value="Ubuntu, sans-serif">Ubuntu</option><option value="Georgia, serif">Georgia</option><option value="'Courier New', monospace">Courier New</option><option value="Impact, sans-serif">Impact</option></select></label>
              <label className="speed-field">Font size <span>8-512 px</span><input type="number" min="8" max="512" step="any" value={selectedAsset.textSettings.fontSize} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, fontSize: Math.max(8, Math.min(512, Number(event.currentTarget.value) || 72)) })} /></label>
            </div>
            <div className="clip-align-controls"><span>Style</span><button type="button" aria-pressed={selectedAsset.textSettings.bold !== false} onClick={() => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, bold: selectedAsset.textSettings!.bold === false })}><strong>B</strong></button><button type="button" aria-pressed={Boolean(selectedAsset.textSettings.italic)} onClick={() => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, italic: !selectedAsset.textSettings!.italic })}><em>I</em></button>{(["left", "center", "right"] as const).map((align) => <button type="button" key={align} aria-pressed={(selectedAsset.textSettings!.align ?? "center") === align} onClick={() => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, align })}>{align[0].toUpperCase()}</button>)}</div>
            <div className="filter-fields two-column transform-fields">
              <label>Text color <input type="color" value={selectedAsset.textSettings.color} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, color: event.currentTarget.value })} /></label>
              <label>Line height <span>0.8–3</span><input type="number" min="0.8" max="3" step="0.05" value={selectedAsset.textSettings.lineHeight ?? 1.2} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, lineHeight: Math.max(0.8, Math.min(3, Number(event.currentTarget.value) || 1.2)) })} /></label>
              <label>Stroke color <input type="color" value={selectedAsset.textSettings.strokeColor ?? "#000000"} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, strokeColor: event.currentTarget.value })} /></label>
              <label>Stroke width <span>px</span><input type="number" min="0" max="24" step="0.5" value={selectedAsset.textSettings.strokeWidth ?? 0} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, strokeWidth: Math.max(0, Math.min(24, Number(event.currentTarget.value) || 0)) })} /></label>
            </div>
            <label className="ratio-toggle"><input type="checkbox" checked={Boolean(selectedAsset.textSettings.shadow)} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, shadow: event.currentTarget.checked })} />Drop shadow</label>
            {selectedAsset.textSettings.shadow && <div className="filter-fields two-column transform-fields"><label>Shadow color <input type="color" value={selectedAsset.textSettings.shadowColor ?? "#000000"} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, shadowColor: event.currentTarget.value })} /></label><label>Shadow blur <span>px</span><input type="number" min="0" max="40" step="1" value={selectedAsset.textSettings.shadowBlur ?? 8} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, shadowBlur: Math.max(0, Math.min(40, Number(event.currentTarget.value) || 0)) })} /></label></div>}
            <label className="ratio-toggle"><input type="checkbox" checked={selectedAsset.textSettings.showBackground} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, showBackground: event.currentTarget.checked })} />Show title background</label>
            {selectedAsset.textSettings.showBackground && <div className="filter-fields two-column transform-fields"><label>Background <input type="color" value={selectedAsset.textSettings.backgroundColor} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, backgroundColor: event.currentTarget.value })} /></label><label>Radius <span>px</span><input type="number" min="0" max="64" step="1" value={selectedAsset.textSettings.backgroundRadius ?? 0} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, backgroundRadius: Math.max(0, Math.min(64, Number(event.currentTarget.value) || 0)) })} /></label><label>BG opacity <span>%</span><input type="number" min="0" max="100" step="1" value={Math.round((selectedAsset.textSettings.backgroundOpacity ?? 1) * 100)} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, backgroundOpacity: Math.max(0, Math.min(1, (Number(event.currentTarget.value) || 0) / 100)) })} /></label></div>}
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
          {selectedClip.track >= 0 && selectedAsset?.kind !== "text" && <>
          <div className="filter-fields two-column transform-fields">
            <label>Brightness <span>percent</span><input type="number" min="0" max="300" step="any" value={selectedClip.effects?.brightness ?? 100} onChange={(event) => patchSelectedEffects({ brightness: Math.max(0, Math.min(300, Number(event.currentTarget.value) || 0)) })} /></label>
            <label>Contrast <span>percent</span><input type="number" min="0" max="300" step="any" value={selectedClip.effects?.contrast ?? 100} onChange={(event) => patchSelectedEffects({ contrast: Math.max(0, Math.min(300, Number(event.currentTarget.value) || 0)) })} /></label>
            <label>Saturation <span>percent</span><input type="number" min="0" max="300" step="any" value={selectedClip.effects?.saturation ?? 100} onChange={(event) => patchSelectedEffects({ saturation: Math.max(0, Math.min(300, Number(event.currentTarget.value) || 0)) })} /></label>
            <label>Grayscale <span>percent</span><input type="number" min="0" max="100" step="any" value={selectedClip.effects?.grayscale ?? 0} onChange={(event) => patchSelectedEffects({ grayscale: Math.max(0, Math.min(100, Number(event.currentTarget.value) || 0)) })} /></label>
            <label>Hue <span>degrees</span><input type="number" min="-180" max="180" step="1" value={selectedClip.effects?.hue ?? 0} onChange={(event) => patchSelectedEffects({ hue: Math.max(-180, Math.min(180, Number(event.currentTarget.value) || 0)) })} /></label>
            <label>Sepia <span>percent</span><input type="number" min="0" max="100" step="any" value={selectedClip.effects?.sepia ?? 0} onChange={(event) => patchSelectedEffects({ sepia: Math.max(0, Math.min(100, Number(event.currentTarget.value) || 0)) })} /></label>
            <label>Blur <span>px</span><input type="number" min="0" max="40" step="0.5" value={selectedClip.effects?.blur ?? 0} onChange={(event) => patchSelectedEffects({ blur: Math.max(0, Math.min(40, Number(event.currentTarget.value) || 0)) })} /></label>
          </div>
          <button type="button" className="editor-action" onClick={() => editClip(selectedClip.id, { effects: undefined })}>Reset adjustments</button>
          </>}
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
    </section></div>}    <section className="video-timeline" inert={exporting}><div className="timeline-toolbar"><strong>Timeline · {timeline.duration.toFixed(2)} seconds</strong><span className="timeline-toolbar-separator" aria-hidden="true" /><div className="timeline-edit-tools"><button type="button" title="Delete Left" aria-label="Delete Left" onClick={() => deleteHoveredSide("left")}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v14M12 5h6v10h-6zM2 7l6 6M8 7l-6 6" /></svg></button><button type="button" title="Delete Right" aria-label="Delete Right" onClick={() => deleteHoveredSide("right")}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v14M2 5h6v10H2zM12 7l6 6m0-6-6 6" /></svg></button></div><span className="timeline-toolbar-separator" aria-hidden="true" /><div className="timeline-actions" data-history-version={historyVersion}><button disabled={!historyRef.current.past.length} onClick={undo}>Undo</button><button disabled={!historyRef.current.future.length} onClick={redo}>Redo</button><span className="timeline-toolbar-separator" aria-hidden="true" /><button disabled={!selectedClip && !mainClipAtPlayhead} onClick={splitSelected}>Split</button><button disabled={!selectedClip} onClick={() => selectedClip && removeClip(selectedClip.id)}>Delete</button><span className="timeline-toolbar-separator" aria-hidden="true" /><label><input type="checkbox" checked={ripplePrimaryTrack} onChange={(event) => setRipplePrimaryTrack(event.currentTarget.checked)} />Ripple</label><label><input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.currentTarget.checked)} />Snap</label><span className="timeline-toolbar-separator" aria-hidden="true" /><label>Snap tolerance<input type="number" min="0" max="5" step="any" value={snapThreshold} disabled={!snapEnabled} onChange={(event) => setSnapThreshold(event.currentTarget.value)} />s</label><span className="timeline-toolbar-separator" aria-hidden="true" /><div className="timeline-zoom-group"><button type="button" title="Zoom out timeline" aria-label="Zoom out timeline" onClick={() => setZoom(String(Math.max(12, Math.round(pxPerSecond / 1.2))))}>−</button><input className="timeline-zoom-slider" type="range" min="12" max="160" step="1" value={pxPerSecond} aria-label="Timeline zoom slider" onChange={(event) => setZoom(event.currentTarget.value)} /><button type="button" title="Zoom in timeline" aria-label="Zoom in timeline" onClick={() => setZoom(String(Math.min(160, Math.round(pxPerSecond * 1.2))))}>+</button><label>Zoom<input type="number" min="12" max="160" value={zoom} onChange={(event) => setZoom(event.currentTarget.value)} />px/s</label><button type="button" title="Fit timeline to view" onClick={fitTimelineZoom}>Fit</button></div></div></div><div className="timeline-scroll" ref={timelineScrollRef} title="Hold Ctrl and scroll to zoom the timeline" onClick={(event) => { if (justSeekedRef.current) return; if (!(event.target instanceof Element) || !event.target.closest(".timeline-clip, .timeline-ruler, .timeline-playhead")) selectTimelineClip(""); }}><div className="timeline-ruler" role="slider" tabIndex={timeline.clips.length ? 0 : -1} onPointerEnter={showRulerHoverGuide} onPointerLeave={() => setRulerHoverGuide(null)} aria-label="Timeline seek" onClick={(event) => { event.stopPropagation(); if (event.detail > 0 && timeline.clips.length) { setPlaying(false); seekTimeline(event.clientX, event.currentTarget, event.altKey); } }} aria-valuemin={0} aria-valuemax={timeline.duration} aria-valuenow={timeline.playhead} aria-valuetext={formatTimecode(timeline.playhead, timeline.fps)} style={{ width: timelineWidth }} onPointerDown={(event) => { if (!timeline.clips.length) return; setRulerHoverGuide(null); setPlaying(false); justSeekedRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); seekTimeline(event.clientX, event.currentTarget, event.altKey); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) seekTimeline(event.clientX, event.currentTarget, event.altKey); else showRulerHoverGuide(event); }} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); window.setTimeout(() => { justSeekedRef.current = false; }, 0); }} onPointerCancel={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); justSeekedRef.current = false; }} onKeyDown={(event) => { if (!timeline.clips.length) return; if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); setPlaying(false); setTimeline((current) => ({ ...current, playhead: event.key === "Home" ? 0 : event.key === "End" ? current.duration : Math.max(0, Math.min(current.duration, current.playhead + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 1 : 1 / Math.max(1, current.fps)))) })); } }}>{Array.from({ length: Math.ceil(timeline.duration) + 1 }, (_, second) => <span key={second} style={{ left: timelineRulerOffset() + second * pxPerSecond }}>{second}s</span>)}</div>{rulerHoverGuide && <div className="timeline-hover-guide" aria-hidden="true" style={rulerHoverGuide} />}{activeTrackDragKind === "visual" && <div className="track-lane timeline-new-overlay-target" data-track={nextOverlayTrack} onDragOver={(event) => previewTrackDrop(event, nextOverlayTrack)} onDrop={(event) => finishTrackDrop(event, nextOverlayTrack)}>Move to new Overlay {nextOverlayTrack}</div>}<div className="timeline-center-spacer" style={{ paddingTop: Math.max(0, audioLaneCount - overlayLaneCount) * 52 }} aria-hidden="true" />{visibleTracks.map((track) => { const trackLabel = track === 0 ? (timeline.clips.some((clip) => clip.track === 0) ? "Video 1" : "") : track > 0 ? `Overlay ${track}` : `Audio ${-track}`; const trackState = timeline.trackStates?.[track]; const showTrackControls = Boolean(trackLabel); return <Fragment key={track}><div className={`timeline-track ${!timeline.clips.length && !dragKind && track === 0 ? "empty-main" : ""}${trackState?.locked ? " is-locked" : ""}${trackState?.hidden ? " is-hidden" : ""}${trackState?.muted ? " is-muted" : ""}`} key={track}><strong><span className="timeline-track-name">{trackLabel}</span>{showTrackControls && <span className="timeline-track-controls">{track >= 0 && <button type="button" className={trackState?.hidden ? "active" : ""} aria-pressed={Boolean(trackState?.hidden)} aria-label={trackState?.hidden ? `Show ${trackLabel}` : `Hide ${trackLabel}`} title={trackState?.hidden ? `Show ${trackLabel}` : `Hide ${trackLabel}`} onClick={(event) => { event.stopPropagation(); toggleTrackState(track, "hidden"); }}>{trackState?.hidden ? "⊘" : "👁"}</button>}<button type="button" className={trackState?.muted ? "active" : ""} aria-pressed={Boolean(trackState?.muted)} aria-label={trackState?.muted ? `Unmute ${trackLabel}` : `Mute ${trackLabel}`} title={trackState?.muted ? `Unmute ${trackLabel}` : `Mute ${trackLabel}`} onClick={(event) => { event.stopPropagation(); toggleTrackState(track, "muted"); }}>{trackState?.muted ? "🔇" : "🔊"}</button><button type="button" className={trackState?.locked ? "active" : ""} aria-pressed={Boolean(trackState?.locked)} aria-label={trackState?.locked ? `Unlock ${trackLabel}` : `Lock ${trackLabel}`} title={trackState?.locked ? `Unlock ${trackLabel}` : `Lock ${trackLabel}`} onClick={(event) => { event.stopPropagation(); toggleTrackState(track, "locked"); }}>{trackState?.locked ? "🔒" : "🔓"}</button></span>}</strong><div className="track-lane" data-track={track} style={{ width: timelineWidth - timelineRulerOffset() }} onDragOver={(event) => previewTrackDrop(event, track)} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropPreview(null); }} onDrop={(event) => finishTrackDrop(event, track)} onClick={() => { if (!justSeekedRef.current) selectTimelineClip(""); }}>{!timeline.clips.length && track === 0 && <span className="timeline-empty-prompt">Drag media here to start creating</span>}{dropPreview?.track === track && <div className="timeline-drop-preview" aria-hidden="true" style={{ left: dropPreview.start * pxPerSecond, width: Math.max(22, dropPreview.duration * pxPerSecond) }}><span>{dropPreview.start.toFixed(2)}s</span></div>}{timeline.clips.filter((clip) => clip.track === track).map((clip) => { const asset = timeline.assets.find((item) => item.id === clip.assetId); const waveformAsset = asset?.kind === "audio" ? asset : asset?.kind === "video" ? timeline.assets.find((item) => item.kind === "audio" && item.derivedFromAssetId === asset.id) ?? (asset.hasAudio !== false ? asset : undefined) : undefined; const waveform = waveformAsset ? waveforms[waveformAsset.id] : undefined; const waveformStart = waveformAsset ? Math.floor(clip.sourceStart / waveformAsset.duration * (waveform?.length ?? 0)) : 0; const waveformEnd = waveformAsset ? Math.ceil(clip.sourceEnd / waveformAsset.duration * (waveform?.length ?? 0)) : 0; const clipWaveformSlice = waveform?.slice(waveformStart, Math.max(waveformStart + 1, waveformEnd)); const waveformBarCount = Math.max(1, Math.floor(clipLength(clip) * pxPerSecond / 2.5)); const clipWaveform = clipWaveformSlice?.length ? Array.from({ length: Math.min(waveformBarCount, clipWaveformSlice.length) }, (_, index) => { const barCount = Math.min(waveformBarCount, clipWaveformSlice.length); const start = Math.floor(index * clipWaveformSlice.length / barCount); const end = Math.max(start + 1, Math.floor((index + 1) * clipWaveformSlice.length / barCount)); return Math.max(...clipWaveformSlice.slice(start, end)); }) : undefined; const isClipSelected = selected === clip.id || selectedClips.includes(clip.id); return <button draggable={!trackState?.locked} key={clip.id} className={`timeline-clip ${isClipSelected ? "selected" : ""} ${asset?.kind ?? ""}`} style={{ left: clip.start * pxPerSecond, width: Math.max(22, clipLength(clip) * pxPerSecond) }} onPointerMove={(event) => moveTrim(event, clip.id)} onPointerUp={finishTrim} onPointerCancel={finishTrim} onDragStart={(event) => { if (trackState?.locked) { event.preventDefault(); return; } const bounds = event.currentTarget.getBoundingClientRect(); const grabOffset = event.clientX - bounds.left; draggingRef.current = { kind: "clip", id: clip.id, grabOffset }; setActiveTrackDragKind(asset?.kind === "audio" ? "audio" : "visual"); event.dataTransfer.setData("text/clip", clip.id); event.dataTransfer.setData("text/clip-grab-offset", String(grabOffset)); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { draggingRef.current = null; setActiveTrackDragKind(null); setDropPreview(null); }} onPointerEnter={() => setHoveredClipId(clip.id)} onFocus={() => setHoveredClipId(clip.id)} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); if (!selectedClips.includes(clip.id)) selectTimelineClip(clip.id); setHoveredClipId(clip.id); setClipContextMenu({ clipId: clip.id, x: Math.min(window.innerWidth - 190, event.clientX), y: Math.min(window.innerHeight - 250, event.clientY) }); }} onClick={(event) => { event.stopPropagation(); selectTimelineClip(clip.id, event.ctrlKey || event.metaKey, event.shiftKey); setHoveredClipId(clip.id); }}>{asset?.kind === "image" && assetUrls[asset.id] && <img className="studio-clip-visual" src={assetUrls[asset.id]} alt="" aria-hidden="true" />}{asset?.kind === "video" && assetUrls[asset.id] && <video className="studio-clip-visual" src={assetUrls[clip.assetId]} muted playsInline preload="metadata" onLoadedMetadata={(event) => { event.currentTarget.currentTime = Math.min(0.1, asset.duration / 2); }} aria-hidden="true" />}{clipWaveform && <span className={asset?.kind === "video" ? "studio-clip-wave video-audio-wave" : "studio-clip-wave"} aria-hidden="true">{clipWaveform.map((peak, index) => <i key={index} style={{ height: String(Math.max(12, peak * 100)) + "%" }} />)}</span>}<span className="timeline-trim-handle left" aria-hidden="true" onPointerDown={(event) => beginTrim(event, clip, "left")} /><span className="timeline-trim-handle right" aria-hidden="true" onPointerDown={(event) => beginTrim(event, clip, "right")} /><strong>{asset?.name}</strong><small>{clipLength(clip).toFixed(2)}s · {clip.speed.toFixed(3)}×</small>{clip.keyframes?.map((frame, index) => <span key={`${clip.id}-key-${index}`} className="timeline-keyframe" aria-hidden="true" style={{ left: `${Math.max(0, Math.min(100, frame.time / Math.max(clipLength(clip), 0.001) * 100))}%` }} />)}</button>; })}</div></div></Fragment>; })}{dragKind === "audio" && <div className="track-lane timeline-new-overlay-target timeline-new-audio-target" data-track={nextAudioTrack} onDragOver={(event) => previewTrackDrop(event, nextAudioTrack)} onDrop={(event) => finishTrackDrop(event, nextAudioTrack)}>Move to new Audio {-nextAudioTrack}</div>}<div className="timeline-center-spacer" style={{ paddingBottom: Math.max(0, overlayLaneCount - audioLaneCount) * 52 }} aria-hidden="true" /><button type="button" tabIndex={-1} aria-label="Drag playhead to seek" disabled={!timeline.clips.length} className="timeline-playhead" style={{ left: timelineRulerOffset() + timeline.playhead * pxPerSecond }} onPointerDown={(event) => { if (!timeline.clips.length) return; event.preventDefault(); event.stopPropagation(); setPlaying(false); event.currentTarget.setPointerCapture(event.pointerId); playheadDragRef.current = { pointerId: event.pointerId, initialX: event.clientX, initialTime: timeline.playhead }; }} onPointerMove={movePlayhead} onPointerUp={finishPlayheadDrag} onPointerCancel={finishPlayheadDrag} /> </div></section>
    <p className="resize-note editor-disclaimer">Timeline preview composites active visual clips from bottom to top, including per-clip transforms, text titles, and custom linear fade transitions. Audio lanes play in sync with the project clock. Timeline render/export is available in supported browsers; verify output playback for your media and device.</p>
    {binMarquee && typeof document !== "undefined" && createPortal(<div className="studio-bin-marquee" style={binMarquee} aria-hidden="true" />, document.body)}
    {binDragPreview && draggedBinAsset && typeof document !== "undefined" && createPortal(<div className="studio-bin-drag-ghost" style={{ left: binDragPreview.x + 12, top: binDragPreview.y + 12 }} aria-hidden="true">{draggedBinAsset.kind === "image" && assetUrls[draggedBinAsset.id] ? <img src={assetUrls[draggedBinAsset.id]} alt="" /> : draggedBinAsset.kind === "video" && assetUrls[draggedBinAsset.id] ? <video src={assetUrls[draggedBinAsset.id]} muted preload="metadata" onLoadedMetadata={(event) => { event.currentTarget.currentTime = Math.min(0.1, draggedBinAsset.duration / 2); }} /> : <span>{draggedBinAsset.kind === "audio" ? "♫" : "T"}</span>}{binDragPreview.count > 1 && <span className="studio-bin-drag-count">{binDragPreview.count}</span>}</div>, document.body)}
    {clipContextMenu && typeof document !== "undefined" && (() => {
      const targetClip = timeline.clips.find((clip) => clip.id === clipContextMenu.clipId);
      const targetAsset = targetClip && timeline.assets.find((asset) => asset.id === targetClip.assetId);
      if (!targetClip) return null;
      return createPortal(<div className="studio-clip-context-menu" role="menu" aria-label="Clip actions" style={{ left: clipContextMenu.x, top: clipContextMenu.y }}>
        <button type="button" role="menuitem" onClick={() => { selectTimelineClip(targetClip.id); splitSelected(); setClipContextMenu(null); }}>Split at playhead</button>
        <button type="button" role="menuitem" onClick={() => { copyClip(targetClip.id); setClipContextMenu(null); }}>Copy clip</button>
        <button type="button" role="menuitem" disabled={!copiedClipRef.current} onClick={() => { pasteClip(); setClipContextMenu(null); }}>Paste at playhead</button>
        <button type="button" role="menuitem" onClick={() => { duplicateClip(targetClip.id); setClipContextMenu(null); }}>Duplicate</button>
        {targetAsset?.kind === "video" && <button type="button" role="menuitem" onClick={() => { void freezeFrameClip(targetClip.id); setClipContextMenu(null); }}>Freeze frame</button>}
        {targetAsset?.kind === "video" && <button type="button" role="menuitem" disabled={extractingAudio} onClick={() => { selectTimelineClip(targetClip.id); void detachVideoAudio(); setClipContextMenu(null); }}>Detach audio</button>}
        <button type="button" role="menuitem" className="danger" onClick={() => { removeClip(targetClip.id); setClipContextMenu(null); }}>Delete</button>
      </div>, document.body);
    })()}
    {shortcutsOpen && <div className="studio-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShortcutsOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setShortcutsOpen(false); }}><section className="studio-shortcuts-modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="studio-export-heading"><div><span>VIDEO STUDIO</span><h2>Keyboard shortcuts</h2></div><button type="button" autoFocus aria-label="Close shortcuts" onClick={() => setShortcutsOpen(false)}>×</button></div>
      <dl className="studio-shortcuts-list">
        <div><dt><kbd>Space</kbd></dt><dd>Play / Pause</dd></div>
        <div><dt><kbd>J</kbd> / <kbd>K</kbd> / <kbd>L</kbd></dt><dd>Step back 1s / Pause / Play</dd></div>
        <div><dt><kbd>←</kbd> / <kbd>→</kbd></dt><dd>Step 1 frame (<kbd>Shift</kbd> for 1s)</dd></div>
        <div><dt><kbd>Home</kbd></dt><dd>Jump to start</dd></div>
        <div><dt><kbd>S</kbd> or <kbd>Ctrl+B</kbd></dt><dd>Split selected clip at playhead</dd></div>
        <div><dt><kbd>Q</kbd> / <kbd>W</kbd></dt><dd>Delete left / right of playhead</dd></div>
        <div><dt><kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd></dt><dd>Copy / Paste clip at playhead</dd></div>
        <div><dt><kbd>Ctrl+D</kbd></dt><dd>Duplicate selected clip</dd></div>
        <div><dt><kbd>Delete</kbd> / <kbd>Backspace</kbd></dt><dd>Delete selected clip(s)</dd></div>
        <div><dt><kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd></dt><dd>Undo / Redo</dd></div>
        <div><dt><kbd>+</kbd> / <kbd>-</kbd> or <kbd>Ctrl+Scroll</kbd></dt><dd>Zoom timeline (or stage)</dd></div>
        <div><dt><kbd>Alt</kbd> + Drag</dt><dd>Temporarily bypass snapping</dd></div>
        <div><dt><kbd>?</kbd></dt><dd>Toggle this shortcut list</dd></div>
      </dl>
    </section></div>}
  </main>;
}
