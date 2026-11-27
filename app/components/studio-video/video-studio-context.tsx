import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router";
import {
  createProject,
  getProject,
  readVideoAsset,
  saveVideoTimeline,
  type VideoAspectRatioMode,
  type VideoClipEffects,
  type VideoClipTransform,
  type VideoClipTransitions,
  type VideoImageCrop,
  type VideoTimelineAsset,
  type VideoTimelineClip,
  type VideoTimelineProject,
  type VideoTextSettings,
  type VideoTransitionType,
} from "../../lib/project-store";
import { drawVideoComposition, getClipLength } from "../../lib/video-composition";
import { applyTextCase, wrapTextLines } from "../../lib/video-text-layout";
import { evaluateClipKeyframes, evaluateClipTransition, upsertClipKeyframe } from "../../lib/video-keyframes";
import { renderTimelineAudio } from "../../lib/audio-timeline-render";
import {
  canPlaceAssetOnTrack,
  canvasDimensionsForAspect,
  planMediaBatchPlacement,
  resolveAnchorClip,
  resolveMarqueeSelection,
  resolveTimelinePlacement,
  timelineDropStart,
  timelineRulerOffset,
  timelineTimeAtPointer,
  timelineZoomScrollLeft,
  visibleTimelineTracks,
  zoomPixelsPerSecond,
} from "../../lib/video-timeline";
import { inspectMediaFile } from "../../lib/media-inspection";
import {
  isMediaAsset,
  sortMediaAssets,
  updateMediaSelection,
  type MediaFilter,
  type MediaSort,
  type SortDirection,
} from "../../lib/video-media-bin";
import { EMPTY_IMAGE_CROP, imageClipGeometry } from "../../lib/video-image-layout";
import { createCaptionClips, isSubtitleFile, matchingSidecar, parseSubtitleText, type SubtitleCue } from "../../lib/video-captions";
import {
  ASPECT_RATIOS,
  EMPTY,
  IDENTITY_TRANSFORM,
  MAX_ASSET_BYTES,
  SVG_SHAPES,
  TEXT_PRESETS,
  type PreviewOverlayBox,
  type PreviewOverlayItem,
} from "./types";
import { clipLength, updateClipTimeline } from "./utils";

export type VideoStudioContextType = ReturnType<typeof useVideoStudioState>;

const VideoStudioContext = createContext<VideoStudioContextType | null>(null);

function useVideoStudioState() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") ?? "";
  const [timeline, setTimeline] = useState<VideoTimelineProject>(EMPTY);
  const [projectTitle, setProjectTitle] = useState("");
  const [files, setFiles] = useState<Record<string, File>>({});
  const [selected, setSelected] = useState("");
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [timelineMarquee, setTimelineMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const timelineMarqueeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    selectedAtStart: string[];
    primaryAtStart: string;
    additive: boolean;
    dragging: boolean;
  } | null>(null);
  const suppressTimelineClickRef = useRef(false);
  const [clipContextMenu, setClipContextMenu] = useState<{ clipId: string; x: number; y: number } | null>(null);
  const copiedClipRef = useRef<VideoTimelineClip | null>(null);
  const [hoveredClipId, setHoveredClipId] = useState("");
  const [activeBinTab, setActiveBinTab] = useState<"media" | "library" | "text" | "caption" | "shapes" | "transitions">("media");
  const [shapeColor, setShapeColor] = useState("#38d2e0");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [mediaSort, setMediaSort] = useState<MediaSort>("imported");
  const [mediaSortDirection, setMediaSortDirection] = useState<SortDirection>("desc");
  const [selectedBinIds, setSelectedBinIds] = useState<string[]>([]);
  const [selectedCaptionIds, setSelectedCaptionIds] = useState<string[]>([]);
  const captionSelectionAnchorRef = useRef<string | null>(null);
  const [binMarquee, setBinMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const binSelectionAnchorRef = useRef<string | null>(null);
  const binMarqueeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    selectedAtStart: string[];
    additive: boolean;
    dragging: boolean;
  } | null>(null);
  const [libraryTab, setLibraryTab] = useState<"image" | "video" | "sound">("image");
  const [libraryBackgroundColor, setLibraryBackgroundColor] = useState("#000000");
  const [inspectorTab, setInspectorTab] = useState<"basic" | "audio" | "speed" | "duration" | "text" | "adjust">("basic");
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
  const binPointerRef = useRef<{
    pointerId: number;
    id: string;
    ids: string[];
    initialX: number;
    initialY: number;
    dragging: boolean;
  } | null>(null);
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
  const [exportWidthDraft, setExportWidthDraft] = useState("1920");
  const [exportHeightDraft, setExportHeightDraft] = useState("1080");
  const [exportFrameRateDraft, setExportFrameRateDraft] = useState("30");
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
  const textGestureRef = useRef<{
    id: string;
    assetId: string;
    targetIds: string[];
    pointerId: number;
    mode: "move" | "scale" | "rotate" | "width";
    x: number;
    y: number;
    width: number;
    height: number;
    startMaxWidth: number;
    transform: VideoClipTransform;
    original: VideoTimelineProject;
    boxFit: number;
    pointerFit: number;
    centerX: number;
    centerY: number;
  } | null>(null);
  const imageGestureRef = useRef<{
    id: string;
    targetIds: string[];
    pointerId: number;
    mode: "move" | "resize" | "rotate";
    x: number;
    y: number;
    width: number;
    height: number;
    boxWidth: number;
    boxHeight: number;
    transform: VideoClipTransform;
    original: VideoTimelineProject;
    boxFit: number;
    pointerFit: number;
    matchAspect: boolean;
    sourceAspect: number;
    centerX: number;
    centerY: number;
  } | null>(null);
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

  const anchorResolution =
    selectedClips.length > 1
      ? resolveAnchorClip(timeline.clips, selectedClips, timeline.playhead, selected)
      : { clip: timeline.clips.find((clip) => clip.id === selected), reason: "none" as const };
  const selectedClip = anchorResolution.clip ?? timeline.clips.find((clip) => clip.id === selected);
  const anchorReason = anchorResolution.reason;
  const mainClipAtPlayhead = timeline.clips.find(
    (clip) => clip.track === 0 && timeline.playhead > clip.start && timeline.playhead < clip.start + clipLength(clip)
  );
  const hoveredClip = timeline.clips.find((clip) => clip.id === hoveredClipId);
  const selectedAsset = selectedClip && timeline.assets.find((asset) => asset.id === selectedClip.assetId);
  const availableAudioAssets = timeline.assets.filter((asset) => asset.kind === "audio");
  const mediaAssetCount = timeline.assets.filter(isMediaAsset).length;
  const visibleMediaAssets = useMemo(
    () => sortMediaAssets(timeline.assets, mediaFilter, mediaSort, mediaSortDirection),
    [timeline.assets, mediaFilter, mediaSort, mediaSortDirection]
  );
  const captionSourceAssets = timeline.assets.filter((asset) => asset.kind === "text" && asset.captionSourceName);
  const selectedReplacementAudioAssetId = availableAudioAssets.some((asset) => asset.id === replacementAudioAssetId)
    ? replacementAudioAssetId
    : availableAudioAssets[0]?.id ?? "";
  const selectedValues = selectedClip
    ? evaluateClipKeyframes(selectedClip, Math.max(0, timeline.playhead - selectedClip.start))
    : null;
  const selectedTransform = selectedValues?.transform ?? IDENTITY_TRANSFORM;
  const hasTransformEdits =
    selectedTransform.x !== 0 ||
    selectedTransform.y !== 0 ||
    selectedTransform.scale !== 1 ||
    selectedTransform.rotation !== 0 ||
    selectedTransform.opacity !== 1 ||
    Boolean(selectedTransform.mirrorX) ||
    Boolean(selectedTransform.mirrorY);

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
    return () => {
      observer.disconnect();
      stage.removeEventListener("wheel", onWheel);
    };
  }, []);

  useEffect(() => {
    const closeOutsideDropdowns = (event: PointerEvent) => {
      const target = event.target as Node | null;
      document
        .querySelectorAll<HTMLDetailsElement>("details.studio-media-menu[open], details.studio-ratio-menu[open]")
        .forEach((menu) => {
          if (!target || !menu.contains(target)) menu.open = false;
        });
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setClipContextMenu(null);
      document
        .querySelectorAll<HTMLDetailsElement>("details.studio-media-menu[open], details.studio-ratio-menu[open]")
        .forEach((menu) => {
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

  const previewOverlays: PreviewOverlayItem[] =
    stageSize.width && stageSize.height
      ? (() => {
          const fit = Math.min(stageSize.width / timeline.width, stageSize.height / timeline.height);
          const measure = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
          return timeline.clips
            .filter(
              (clip) =>
                clip.track >= 0 &&
                !timeline.trackStates?.[clip.track]?.hidden &&
                timeline.playhead >= clip.start &&
                timeline.playhead < clip.start + clipLength(clip)
            )
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
                if (measure) {
                  measure.font = `${fontStyle}${fontWeight} ${font}px ${fontFamily}`;
                  if ("letterSpacing" in measure) {
                    (measure as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(settings.letterSpacing ?? 0) * transform.scale}px`;
                  }
                }
                const transformedText = applyTextCase(settings.text, settings.textCase, settings.uppercase);
                const effectiveMaxWidth = settings.maxWidth && settings.maxWidth > 0 ? settings.maxWidth * transform.scale : undefined;
                const lines = wrapTextLines(
                  transformedText,
                  effectiveMaxWidth,
                  (segment) => measure?.measureText(segment).width ?? segment.length * font * 0.6
                );
                const widestLine = Math.max(
                  font,
                  ...lines.map((line) => measure?.measureText(line).width ?? line.length * font * 0.6)
                );
                const width = Math.max(widestLine, effectiveMaxWidth ?? 0) + font * 0.7;
                const height = lines.length * font * (settings.lineHeight ?? 1.2) + font * 0.4;
                return [
                  {
                    kind: "text",
                    clip,
                    asset,
                    transform,
                    box: { width: Math.max(36, width * fit), height: Math.max(24, height * fit), left, top, fit },
                  },
                ];
              }
              if (asset.kind === "image") {
                const geometry = imageClipGeometry(
                  asset.width ?? imageRefs.current[asset.id]?.naturalWidth ?? timeline.width,
                  asset.height ?? imageRefs.current[asset.id]?.naturalHeight ?? timeline.height,
                  timeline.width,
                  timeline.height,
                  clip.imageCrop,
                  clip.imageSize,
                  transform.scale
                );
                return [
                  {
                    kind: "image",
                    clip,
                    asset,
                    transform,
                    imageGeometry: geometry,
                    box: { width: geometry.width * fit, height: geometry.height * fit, left, top, fit },
                  },
                ];
              }
              if (asset.kind === "video") {
                const sourceWidth = asset.width ?? videoRefs.current[clip.id]?.videoWidth ?? timeline.width;
                const sourceHeight = asset.height ?? videoRefs.current[clip.id]?.videoHeight ?? timeline.height;
                const fitScale = Math.min(timeline.width / sourceWidth, timeline.height / sourceHeight);
                return [
                  {
                    kind: "video",
                    clip,
                    asset,
                    transform,
                    box: {
                      width: sourceWidth * fitScale * transform.scale * fit,
                      height: sourceHeight * fitScale * transform.scale * fit,
                      left,
                      top,
                      fit,
                    },
                  },
                ];
              }
              return [];
            });
        })()
      : [];

  const imageCrop = selectedClip?.imageCrop ?? EMPTY_IMAGE_CROP;
  const selectedImageGeometry =
    selectedAsset?.kind === "image" && selectedClip
      ? imageClipGeometry(
          selectedAsset.width ?? imageRefs.current[selectedAsset.id]?.naturalWidth ?? timeline.width,
          selectedAsset.height ?? imageRefs.current[selectedAsset.id]?.naturalHeight ?? timeline.height,
          timeline.width,
          timeline.height,
          selectedClip.imageCrop,
          selectedClip.imageSize,
          selectedTransform.scale
        )
      : null;

  function setPreviewGain(element: HTMLMediaElement, clipId: string, gain: number) {
    const context = previewAudioContextRef.current ?? (previewAudioContextRef.current = new AudioContext());
    if (!previewMediaSourcesRef.current[clipId]) {
      const source = context.createMediaElementSource(element);
      const gainNode = context.createGain();
      source.connect(gainNode);
      gainNode.connect(context.destination);
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a local video project.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (!projectId) {
      setProjectTitle("");
      setError("");
      return;
    }
    void (async () => {
      try {
        const project = await getProject(projectId);
        if (!project || project.kind !== "video") throw new Error("This video workspace is missing or has the wrong project type.");
        setProjectTitle(project.title);
        const saved = project.videoTimeline ?? EMPTY;
        const loaded = await Promise.all(
          saved.assets
            .filter((asset) => asset.kind !== "text" || asset.size > 0)
            .map(async (asset) => [asset.id, await readVideoAsset(asset.id)] as const)
        );
        if (cancelled) return;
        const restored = Object.fromEntries(loaded.filter((item): item is readonly [string, File] => Boolean(item[1])));
        const assets = await Promise.all(
          saved.assets.map(async (asset) => {
            if (!asset.captionSourceName || asset.captionCues?.length || !restored[asset.id]) return asset;
            try {
              const cues = parseSubtitleText(await restored[asset.id].text(), asset.name);
              const matchingVideo = saved.assets.find(
                (item) => item.kind === "video" && matchingSidecar(item.name, asset.name)
              );
              return {
                ...asset,
                captionCues: cues,
                duration: Math.max(...cues.map((cue) => cue.end)),
                derivedFromAssetId: matchingVideo?.id,
              };
            } catch {
              return asset;
            }
          })
        );
        if (cancelled) return;
        setFiles(restored);
        setTimeline({ ...saved, assets });
        setSelected(saved.clips[0]?.id ?? "");
        setSelectedBinIds([]);
        binSelectionAnchorRef.current = null;
        setSelectedCaptionIds([]);
        captionSelectionAnchorRef.current = null;
        setFrameRateDraft(String(saved.fps));
        setWidthDraft(String(saved.width));
        setHeightDraft(String(saved.height));
        setReady(true);
        setStatus(`Project “${project.title}” loaded. ${saved.assets.filter(isMediaAsset).length} media item(s) restored.`);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not open this video project.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !ready || playing) return;
    const timeout = window.setTimeout(() => {
      void saveVideoTimeline(projectId, timeline)
        .then(() => setStatus("Timeline saved on this device."))
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not save the video timeline."));
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [projectId, ready, timeline, playing]);

  const previewClip = timeline.clips
    .filter((clip) => clip.track >= 0 && timeline.playhead >= clip.start && timeline.playhead < clip.start + clipLength(clip))
    .sort((a, b) => b.track - a.track)[0];
  const previewAsset = previewClip && timeline.assets.find((asset) => asset.id === previewClip.assetId);
  const assetUrls = useMemo(
    () => Object.fromEntries(Object.entries(files).map(([id, file]) => [id, URL.createObjectURL(file)])),
    [files]
  );
  useEffect(
    () => () => {
      for (const url of Object.values(assetUrls)) URL.revokeObjectURL(url);
    },
    [assetUrls]
  );

  useEffect(() => {
    let cancelled = false;
    const waveformAssets = timeline.assets.filter(
      (asset) => files[asset.id] && (asset.kind === "audio" || (asset.kind === "video" && asset.hasAudio !== false))
    );
    if (!waveformAssets.length) {
      setWaveforms({});
      return;
    }
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
            const stride = Math.max(1, Math.floor((buffer.sampleRate * duration) / (peaks.length * 80)));
            for (let frame = 0; frame < buffer.length; frame += stride) {
              const time = chunk.timestamp + frame / buffer.sampleRate;
              const bucket = Math.floor((time / duration) * peaks.length);
              if (bucket < 0 || bucket >= peaks.length) continue;
              let peak = peaks[bucket];
              for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                peak = Math.max(peak, Math.abs(buffer.getChannelData(channel)[frame] ?? 0));
              }
              peaks[bucket] = peak;
            }
          }
          const sourcePeak = Math.max(...peaks, 0.000001);
          results[asset.id] = Array.from(peaks, (peak) => Math.min(1, peak / sourcePeak));
        } catch {
          /* Leave unsupported audio streams without a fabricated waveform. */
        } finally {
          input.dispose();
        }
      }
      if (!cancelled) setWaveforms(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [timeline.assets, files]);

  useEffect(
    () => () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    },
    [resultUrl]
  );

  drawFrameRef.current = (time) => {
    const current = timelineRef.current;
    const canvas = canvasRef.current;
    const position = time ?? current.playhead;
    if (!canvas) return;
    const active = current.clips.filter(
      (clip) => clip.track >= 0 && position >= clip.start && position < clip.start + clipLength(clip)
    );
    for (const clip of current.clips.filter((item) => current.assets.find((asset) => asset.id === item.assetId)?.kind === "video")) {
      const video = videoRefs.current[clip.id];
      if (!video) continue;
      if (!active.some((item) => item.id === clip.id)) {
        if (!video.paused) video.pause();
        if (
          clip.start > position &&
          clip.start - position <= 1.5 &&
          video.readyState >= 1 &&
          !video.seeking &&
          Math.abs(video.currentTime - clip.sourceStart) > 0.04
        ) {
          video.currentTime = clip.sourceStart;
        }
        continue;
      }
      const expected = clip.sourceStart + (position - clip.start) * clip.speed;
      video.playbackRate = clip.speed;
      video.preservesPitch = (clip.pitchMode ?? "preserve") === "preserve";
      const localTime = Math.max(0, position - clip.start);
      const clipMuted = clip.muted || Boolean(current.trackStates?.[clip.track]?.muted);
      setPreviewGain(
        video,
        clip.id,
        clipMuted ? 0 : evaluateClipKeyframes(clip, localTime).volume * evaluateClipTransition(clip, localTime)
      );
      video.volume = 1;
      video.muted = clipMuted;
      if (!video.seeking && Math.abs(video.currentTime - expected) > (playing ? 0.35 : 0.02)) {
        video.currentTime = expected;
      }
      if (playing) {
        if (video.paused) void video.play().catch(() => undefined);
      } else if (!video.paused) {
        video.pause();
      }
    }
    drawVideoComposition(canvas, current, position, { videos: videoRefs.current, images: imageRefs.current }, current.assets);
    for (const clip of current.clips.filter((item) => item.track < 0)) {
      const audio = audioRefs.current[clip.id];
      if (!audio) continue;
      const isActive = position >= clip.start && position < clip.start + clipLength(clip);
      if (!isActive) {
        if (!audio.paused) audio.pause();
        continue;
      }
      const expected = clip.sourceStart + (position - clip.start) * clip.speed;
      if (!audio.seeking && Math.abs(audio.currentTime - expected) > 0.35) audio.currentTime = expected;
      audio.playbackRate = clip.speed;
      audio.preservesPitch = (clip.pitchMode ?? "preserve") === "preserve";
      const localTime = Math.max(0, position - clip.start);
      const clipMuted = clip.muted || Boolean(current.trackStates?.[clip.track]?.muted);
      setPreviewGain(
        audio,
        clip.id,
        clipMuted ? 0 : evaluateClipKeyframes(clip, localTime).volume * evaluateClipTransition(clip, localTime)
      );
      audio.volume = 1;
      audio.muted = clipMuted;
      if (playing && audio.paused) {
        void audio.play().catch(() => setError("Audio preview was blocked by this browser. Press Play again to allow local audio preview."));
      }
      if (!playing && !audio.paused) audio.pause();
    }
  };

  useEffect(() => {
    if (exporting) return;
    let frame = 0;
    const render = () => {
      drawFrameRef.current();
      if (playing) frame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, [
    playing,
    exporting,
    timeline.width,
    timeline.height,
    timeline.assets,
    timeline.clips,
    timeline.trackStates,
    files,
    mediaRevision,
  ]);

  useEffect(() => {
    if (!playing) drawFrameRef.current();
  }, [timeline.playhead, playing]);

  useEffect(() => {
    if (!timeline.clips.length || timeline.duration <= 0) setPlaying(false);
  }, [timeline.clips.length, timeline.duration]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min((now - last) / 1000, 0.25);
      last = now;
      setTimeline((current) => ({
        ...current,
        playhead: current.duration > 0 && current.playhead >= current.duration ? 0 : current.playhead + delta,
      }));
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing]);

  async function importCaptionFiles(list: FileList | File[] | null) {
    if (!list?.length) return;
    setError("");
    try {
      let updated = projectId ? timelineRef.current : EMPTY;
      const sourceFiles: { id: string; file: File }[] = [];
      for (const file of Array.from(list)) {
        if (!isSubtitleFile(file.name)) throw new Error(`${file.name}: Choose an .srt or .vtt subtitle file.`);
        if (file.size > 1024 * 1024) throw new Error(`${file.name}: Subtitle files must be 1 MiB or smaller.`);
        const cues = parseSubtitleText(await file.text(), file.name);
        const sourceId = crypto.randomUUID();
        const matchingVideo = updated.assets.find(
          (asset) => asset.kind === "video" && matchingSidecar(asset.name, file.name)
        );
        const sourceAsset: VideoTimelineAsset = {
          id: sourceId,
          name: file.name,
          type: file.type || (file.name.toLowerCase().endsWith(".vtt") ? "text/vtt" : "application/x-subrip"),
          size: file.size,
          duration: Math.max(...cues.map((cue) => cue.end)),
          kind: "text",
          importedAt: Date.now(),
          captionSourceName: file.name,
          captionCues: cues,
          derivedFromAssetId: matchingVideo?.id,
        };
        updated = { ...updated, assets: [...updated.assets, sourceAsset] };
        sourceFiles.push({ id: sourceId, file });
      }
      const targetProject = projectId || (await createProject("Untitled video", "video")).id;
      await saveVideoTimeline(targetProject, updated, sourceFiles);
      if (projectId) applyTimelineEdit(() => updated);
      else setParams({ project: targetProject });
      setStatus(`Imported ${sourceFiles.length} subtitle file(s) into Caption. Place a file on an overlay lane to add its cues.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import subtitles.");
    }
  }

  async function importFiles(list: FileList | File[] | null) {
    if (!list?.length) return;
    setError("");
    const incoming = Array.from(list);
    const subtitleFiles = incoming.filter((file) => isSubtitleFile(file.name));
    const mediaFiles = incoming.filter((file) => !isSubtitleFile(file.name));
    if (!mediaFiles.length) {
      await importCaptionFiles(subtitleFiles);
      return;
    }
    const sidecars: { file: File; cues: SubtitleCue[] }[] = [];
    for (const file of subtitleFiles) {
      try {
        if (file.size > 1024 * 1024) throw new Error(`${file.name}: Subtitle files must be 1 MiB or smaller.`);
        sidecars.push({ file, cues: parseSubtitleText(await file.text(), file.name) });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : `Could not read ${file.name}.`);
      }
    }
    const baseTimeline = projectId ? timeline : EMPTY;
    const assets: VideoTimelineAsset[] = [];
    const nextFiles: Record<string, File> = {};
    const inspectedMedia: string[] = [];
    for (const file of mediaFiles) {
      if (file.size > MAX_ASSET_BYTES) {
        setError(`${file.name} is over the 256 MiB per-file limit.`);
        continue;
      }
      const id = crypto.randomUUID();
      let duration = 0;
      let kind: VideoTimelineAsset["kind"] | null = null;
      let mediaWidth: number | undefined;
      let mediaHeight: number | undefined;
      let hasAudio: boolean | undefined;
      if (file.type.startsWith("image/")) {
        try {
          const bitmap = await createImageBitmap(file);
          const oversized =
            bitmap.width * bitmap.height > 100_000_000 || Math.max(bitmap.width, bitmap.height) > 32_768;
          mediaWidth = bitmap.width;
          mediaHeight = bitmap.height;
          bitmap.close();
          if (oversized) {
            setError(`${file.name} exceeds the 100-megapixel or 32,768-pixel side limit.`);
            continue;
          }
          kind = "image";
          duration = 3600;
        } catch {
          /* Inspect as container media below */
        }
      }
      if (!kind) {
        try {
          const inspection = await inspectMediaFile(file);
          kind = inspection.tracks.some((track) => track.kind === "video") ? "video" : "audio";
          duration = inspection.duration ?? 0;
          const visualTrack = inspection.tracks.find((track) => track.kind === "video");
          mediaWidth = visualTrack?.width;
          mediaHeight = visualTrack?.height;
          hasAudio = inspection.tracks.some((track) => track.kind === "audio");
          const trackSummary = inspection.tracks.map((track) => `${track.kind} ${track.codec}`).join(" + ");
          inspectedMedia.push(`${file.name}: ${inspection.container}, ${trackSummary}`);
        } catch (cause) {
          setError(cause instanceof Error ? `${file.name}: ${cause.message}` : `Could not inspect ${file.name}.`);
          continue;
        }
      }
      if (!kind) {
        setError(`${file.name} is not a supported video, audio, or image file.`);
        continue;
      }
      if (!duration) {
        setError(`Could not read a usable duration for ${file.name}.`);
        continue;
      }
      const asset = {
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        duration,
        kind,
        importedAt: Date.now() + assets.length,
        fileModifiedAt: file.lastModified || undefined,
        width: mediaWidth,
        height: mediaHeight,
        hasAudio,
      } satisfies VideoTimelineAsset;
      if ([...baseTimeline.assets, ...assets].reduce((total, item) => total + item.size, file.size) > 512 * 1024 * 1024) {
        setError("The total local media limit for this prototype is 512 MiB per project.");
        continue;
      }
      assets.push(asset);
      nextFiles[id] = file;
    }
    if (!assets.length) {
      if (sidecars.length) await importCaptionFiles(sidecars.map((item) => item.file));
      return;
    }
    const sourceAssets: VideoTimelineAsset[] = sidecars.map(({ file, cues }) => {
      const matchingVideo = [...assets, ...baseTimeline.assets].find(
        (asset) => asset.kind === "video" && matchingSidecar(asset.name, file.name)
      );
      return {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || (file.name.toLowerCase().endsWith(".vtt") ? "text/vtt" : "application/x-subrip"),
        size: file.size,
        duration: Math.max(...cues.map((cue) => cue.end)),
        kind: "text",
        importedAt: Date.now(),
        captionSourceName: file.name,
        captionCues: cues,
        derivedFromAssetId: matchingVideo?.id,
      };
    });
    const updated = { ...baseTimeline, assets: [...baseTimeline.assets, ...assets, ...sourceAssets] };
    try {
      const targetProject = projectId || (await createProject("Untitled video", "video")).id;
      await saveVideoTimeline(targetProject, updated, [
        ...assets.map((asset) => ({ id: asset.id, file: nextFiles[asset.id] })),
        ...sourceAssets.map((asset, index) => ({ id: asset.id, file: sidecars[index].file })),
      ]);
      if (projectId) {
        setFiles((current) => ({ ...current, ...nextFiles }));
        applyTimelineEdit(() => updated);
      } else {
        setParams({ project: targetProject });
      }
      setStatus(
        `${assets.length} media item(s) imported into the bin.${
          sourceAssets.length ? ` ${sourceAssets.length} subtitle file(s) are in Caption, ready for manual placement.` : ""
        } Drag media onto a track or press Enter to add it.${
          inspectedMedia.length ? ` Decoder support confirmed: ${inspectedMedia.join("; ")}.` : ""
        }`
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save imported media in this browser.");
    }
  }

  async function addLibraryColorBackground() {
    const color = /^#[0-9a-f]{6}$/i.test(libraryBackgroundColor) ? libraryBackgroundColor : "#808080";
    const file = new File(
      [`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="${color}"/></svg>`],
      `Color background ${color}.svg`,
      { type: "image/svg+xml" }
    );
    const current = projectId ? timelineRef.current : EMPTY;
    const asset: VideoTimelineAsset = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      duration: 3600,
      kind: "image",
      importedAt: Date.now(),
      width: 1920,
      height: 1080,
    };
    const track = 0;
    const start = Math.max(
      current.playhead,
      ...current.clips.filter((clip) => clip.track === track).map((clip) => clip.start + clipLength(clip)),
      0
    );
    const clip: VideoTimelineClip = {
      id: crypto.randomUUID(),
      assetId: asset.id,
      track,
      start,
      sourceStart: 0,
      sourceEnd: 5,
      speed: 1,
      volume: 1,
      muted: false,
    };
    const updated = {
      ...current,
      assets: [...current.assets, asset],
      clips: [...current.clips, clip],
      duration: Math.max(current.duration, start + clipLength(clip)),
    };
    try {
      const targetProject = projectId || (await createProject("Untitled video", "video")).id;
      await saveVideoTimeline(targetProject, updated, [{ id: asset.id, file }]);
      if (projectId) {
        setFiles((previous) => ({ ...previous, [asset.id]: file }));
        applyTimelineEdit(() => updated);
      } else {
        timelineRef.current = updated;
        setTimeline(updated);
        setFiles({ [asset.id]: file });
        setParams({ project: targetProject });
      }
      setSelected(clip.id);
      setHoveredClipId(clip.id);
      setStatus(`Added ${file.name} to Video 1. The SVG and project stay on this device.`);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this library background locally.");
    }
  }

  function placementForDrop(
    track: number,
    pointerTime: number,
    drag: { kind: "asset" | "clip"; id: string; grabOffset: number }
  ) {
    const current = timelineRef.current;
    const draggedClip = drag.kind === "clip" ? current.clips.find((clip) => clip.id === drag.id) : null;
    const asset = current.assets.find((item) => item.id === (draggedClip?.assetId ?? drag.id));
    if (!asset || !canPlaceAssetOnTrack(asset.kind, track)) return null;
    const duration = draggedClip ? clipLength(draggedClip) : asset.kind === "image" ? 5 : asset.duration;
    const desiredStart = drag.kind === "clip" ? timelineDropStart(pointerTime, drag.grabOffset, pxPerSecond) : pointerTime;
    const neighbors = current.clips
      .filter((clip) => clip.track === track && clip.id !== draggedClip?.id)
      .map((clip) => ({ id: clip.id, start: clip.start, end: clip.start + clipLength(clip) }));
    return { duration, ...resolveTimelinePlacement(desiredStart, duration, neighbors, Number(snapThreshold), snapEnabled) };
  }

  function addAssetToTimeline(assetId: string, targetTrack?: number, targetStart?: number) {
    const current = timelineRef.current;
    const asset = current.assets.find((item) => item.id === assetId);
    if (!asset) return;
    if (asset.kind === "text") {
      placeCaptionBatch([assetId]);
      return;
    }
    let track = targetTrack ?? (asset.kind === "audio" ? -1 : 0);
    if ((asset.kind === "audio") !== (track < 0)) {
      setError("Drop audio on an audio track and video or images on a video track.");
      return;
    }
    if (
      asset.kind === "audio" &&
      targetStart !== undefined &&
      current.clips.some((item) => item.track === track && targetStart < item.start + clipLength(item) && targetStart + asset.duration > item.start)
    ) {
      track = Math.min(0, ...current.clips.map((item) => item.track)) - 1;
    }
    const sameTrackEnd = Math.max(
      0,
      ...current.clips.filter((item) => item.track === track).map((item) => item.start + clipLength(item))
    );
    const placement = placementForDrop(
      track,
      targetStart ?? (asset.kind === "audio" ? sameTrackEnd : Math.max(current.playhead, sameTrackEnd)),
      { kind: "asset", id: assetId, grabOffset: 0 }
    );
    if (!placement) return;
    const { start, shiftedStarts } = placement;
    const clip: VideoTimelineClip = {
      id: crypto.randomUUID(),
      assetId,
      track,
      start,
      sourceStart: 0,
      sourceEnd: asset.kind === "image" ? 5 : asset.duration,
      speed: 1,
      volume: 1,
      muted: false,
      ...(asset.kind === "audio" ? { pitchMode: "preserve" as const } : {}),
    };
    const firstVisual =
      track >= 0 &&
      !current.clips.some(
        (item) =>
          item.track >= 0 &&
          current.assets.some((entry) => entry.id === item.assetId && (entry.kind === "video" || entry.kind === "image"))
      );
    const dimensions =
      firstVisual && (current.aspectRatioMode ?? "custom") === "original" && asset.width && asset.height
        ? canvasDimensionsForAspect(asset.width / asset.height)
        : null;
    applyTimelineEdit((previous) => {
      const clips = [
        ...previous.clips.map((item) => (shiftedStarts[item.id] === undefined ? item : { ...item, start: shiftedStarts[item.id] })),
        clip,
      ];
      return {
        ...previous,
        ...dimensions,
        clips,
        duration: Math.max(0, ...clips.map((item) => item.start + clipLength(item))),
      };
    });
    if (dimensions) {
      setWidthDraft(String(dimensions.width));
      setHeightDraft(String(dimensions.height));
    }
    setSelected(clip.id);
    setError("");
  }

  function selectBinAsset(id: string, shift: boolean, toggle: boolean) {
    const visibleIds = visibleMediaAssets.map((asset) => asset.id);
    if (!visibleIds.includes(id)) return;
    setSelectedBinIds((current) => updateMediaSelection(visibleIds, current, binSelectionAnchorRef.current, id, shift, toggle));
    if (!shift) binSelectionAnchorRef.current = id;
  }

  function selectCaptionAsset(id: string, shift: boolean, toggle: boolean) {
    const visibleIds = captionSourceAssets.map((asset) => asset.id);
    if (!visibleIds.includes(id)) return;
    setSelectedCaptionIds((current) => updateMediaSelection(visibleIds, current, captionSelectionAnchorRef.current, id, shift, toggle));
    if (!shift) captionSelectionAnchorRef.current = id;
  }

  function placeCaptionBatch(ids: readonly string[]) {
    const current = timelineRef.current;
    const sources = current.assets.filter((asset) => ids.includes(asset.id) && asset.captionSourceName && asset.captionCues?.length);
    if (!sources.length) return;
    const firstTrack = Math.max(0, ...current.clips.map((clip) => clip.track)) + 1;
    const additions = sources.map((asset, index) =>
      createCaptionClips(asset.captionCues!, asset.name, 0, firstTrack + index, current.height, () => crypto.randomUUID())
    );
    applyTimelineEdit((previous) => {
      const clips = [...previous.clips, ...additions.flatMap((item) => item.clips)];
      return {
        ...previous,
        assets: [...previous.assets, ...additions.flatMap((item) => item.assets)],
        clips,
        duration: Math.max(0, ...clips.map((clip) => clip.start + clipLength(clip))),
      };
    });
    setSelected(additions[0]?.clips[0]?.id ?? "");
    setError("");
    setStatus(`Placed ${additions.reduce((total, item) => total + item.clips.length, 0)} cue(s) from ${sources.length} subtitle file(s) at their original timestamps.`);
  }

  function removeMediaAssets(ids: readonly string[]) {
    const removable = new Set(
      timelineRef.current.assets.filter((asset) => isMediaAsset(asset) && ids.includes(asset.id)).map((asset) => asset.id)
    );
    if (!removable.size) return;
    const removedClipIds = new Set(
      timelineRef.current.clips.filter((clip) => removable.has(clip.assetId)).map((clip) => clip.id)
    );
    const withoutAssets = (project: VideoTimelineProject): VideoTimelineProject => {
      const clips = project.clips.filter((clip) => !removable.has(clip.assetId));
      return {
        ...project,
        assets: project.assets.filter((asset) => !removable.has(asset.id)),
        clips,
        duration: Math.max(0, ...clips.map((clip) => clip.start + clipLength(clip))),
      };
    };
    historyRef.current.past = historyRef.current.past.map(withoutAssets);
    historyRef.current.future = historyRef.current.future.map(withoutAssets);
    const next = withoutAssets(timelineRef.current);
    timelineRef.current = next;
    setTimeline(next);
    setHistoryVersion((value) => value + 1);
    setFiles((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !removable.has(id))));
    setSelectedBinIds((current) => current.filter((id) => !removable.has(id)));
    binSelectionAnchorRef.current = null;
    if (removedClipIds.size) {
      setSelectedClips((current) => current.filter((id) => !removedClipIds.has(id)));
      setSelected((current) => (removedClipIds.has(current) ? "" : current));
    }
    setStatus(
      removedClipIds.size
        ? `Deleted ${removable.size} media item(s) and ${removedClipIds.size} timeline clip(s) using them.`
        : `Deleted ${removable.size} media item(s).`
    );
  }

  function removeCaptionFiles(ids: readonly string[]) {
    const removable = new Set(captionSourceAssets.filter((asset) => ids.includes(asset.id)).map((asset) => asset.id));
    if (!removable.size) return;
    const withoutSources = (project: VideoTimelineProject) => ({
      ...project,
      assets: project.assets.filter((asset) => !removable.has(asset.id)),
    });
    historyRef.current.past = historyRef.current.past.map(withoutSources);
    historyRef.current.future = historyRef.current.future.map(withoutSources);
    const next = withoutSources(timelineRef.current);
    timelineRef.current = next;
    setTimeline(next);
    setHistoryVersion((value) => value + 1);
    setFiles((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !removable.has(id))));
    setSelectedCaptionIds((current) => current.filter((id) => !removable.has(id)));
    captionSelectionAnchorRef.current = null;
    setStatus(`Removed ${removable.size} subtitle file(s) from Caption. Existing timeline captions remain editable.`);
  }

  function placeMediaBatch(ids: readonly string[], targetTrack: number, pointerTime: number) {
    const assets = visibleMediaAssets.filter((asset) => ids.includes(asset.id));
    if (!assets.length) return;
    if (assets.length === 1) {
      addAssetToTimeline(assets[0].id, targetTrack, pointerTime);
      return;
    }
    const current = timelineRef.current;
    const existing = current.clips.map((clip) => ({
      id: clip.id,
      track: clip.track,
      start: clip.start,
      end: clip.start + clipLength(clip),
    }));
    const placement = planMediaBatchPlacement(assets, targetTrack, pointerTime, existing, Number(snapThreshold), snapEnabled);
    if (!placement) {
      setError("Drop video or images on a visual lane, audio on an audio lane, or a mixed selection on either lane. Text titles cannot be placed from the media bin.");
      return;
    }
    const firstVisual = !current.clips.some(
      (clip) =>
        clip.track >= 0 &&
        current.assets.some((asset) => asset.id === clip.assetId && (asset.kind === "video" || asset.kind === "image"))
    );
    const visualAsset = firstVisual && assets.find((asset) => asset.kind === "video" || asset.kind === "image");
    const dimensions =
      visualAsset && (current.aspectRatioMode ?? "custom") === "original" && visualAsset.width && visualAsset.height
        ? canvasDimensionsForAspect(visualAsset.width / visualAsset.height)
        : null;
    const addedClips: VideoTimelineClip[] = placement.placements.map((item) => ({
      id: crypto.randomUUID(),
      assetId: item.assetId,
      track: item.track,
      start: item.start,
      sourceStart: 0,
      sourceEnd: item.duration,
      speed: 1,
      volume: 1,
      muted: false,
      ...(item.track < 0 ? { pitchMode: "preserve" as const } : {}),
    }));
    applyTimelineEdit((previous) => {
      const clips = [
        ...previous.clips.map((clip) => (placement.shiftedStarts[clip.id] === undefined ? clip : { ...clip, start: placement.shiftedStarts[clip.id] })),
        ...addedClips,
      ];
      return {
        ...previous,
        ...dimensions,
        clips,
        duration: Math.max(0, ...clips.map((clip) => clip.start + clipLength(clip))),
      };
    });
    if (dimensions) {
      setWidthDraft(String(dimensions.width));
      setHeightDraft(String(dimensions.height));
    }
    setSelected(addedClips[0].id);
    setError("");
    setStatus(`Added ${assets.length} selected media items in the current bin order.`);
  }

  function moveClipToTrack(id: string, track: number, pointerTime: number, grabOffset: number) {
    const movingClip = timelineRef.current.clips.find((clip) => clip.id === id);
    if (movingClip && timelineRef.current.trackStates?.[movingClip.track]?.locked) {
      setError("Unlock the source track before moving its clips.");
      return;
    }
    if (timelineRef.current.trackStates?.[track]?.locked) {
      setError("Target track is locked.");
      return;
    }
    const placement = placementForDrop(track, pointerTime, { kind: "clip", id, grabOffset });
    if (!placement) {
      setError("Drop text on an overlay lane, audio on an audio lane, and video or images on a visual lane.");
      return;
    }
    applyTimelineEdit((current) => {
      const clips = current.clips.map((clip) =>
        clip.id === id
          ? { ...clip, track, start: placement.start }
          : placement.shiftedStarts[clip.id] === undefined
            ? clip
            : { ...clip, start: placement.shiftedStarts[clip.id] }
      );
      return { ...current, clips, duration: Math.max(0, ...clips.map((clip) => clip.start + clipLength(clip))) };
    });
    setSelected(id);
    setError("");
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
    const captionDrag = timelineRef.current.assets.some((asset) => asset.id === drag.id && asset.captionSourceName);
    if (!drag.dragging) {
      if (captionDrag) {
        setSelectedCaptionIds(drag.ids);
        captionSelectionAnchorRef.current = drag.id;
      } else {
        setSelectedBinIds(drag.ids);
        binSelectionAnchorRef.current = drag.id;
      }
    }
    drag.dragging = true;
    setBinDragPreview({ id: drag.id, count: drag.ids.length, x: event.clientX, y: event.clientY });
    const target = binTrackAtPointer(event.clientX, event.clientY);
    if (captionDrag) {
      const overTimeline = document.elementFromPoint(event.clientX, event.clientY)?.closest(".timeline-scroll");
      const sources = timelineRef.current.assets.filter((asset) => drag.ids.includes(asset.id) && asset.captionSourceName);
      const duration = Math.max(0, ...sources.map((asset) => asset.duration));
      setDropPreview(
        overTimeline
          ? { track: Math.max(0, ...timelineRef.current.clips.map((clip) => clip.track)) + 1, start: 0, duration }
          : null
      );
      return;
    }
    const assets = visibleMediaAssets.filter((asset) => drag.ids.includes(asset.id));
    const existing = timelineRef.current.clips.map((clip) => ({
      id: clip.id,
      track: clip.track,
      start: clip.start,
      end: clip.start + clipLength(clip),
    }));
    const placement =
      target &&
      planMediaBatchPlacement(
        assets,
        target.track,
        timelinePointerTime(event, target.lane),
        existing,
        Number(snapThreshold),
        snapEnabled
      );
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
      window.setTimeout(() => {
        suppressBinClickRef.current = false;
      }, 0);
      const target = binTrackAtPointer(event.clientX, event.clientY);
      const asset = timelineRef.current.assets.find((item) => item.id === drag.id);
      const overTimeline = document.elementFromPoint(event.clientX, event.clientY)?.closest(".timeline-scroll");
      if (asset?.captionSourceName) {
        if (overTimeline) placeCaptionBatch(drag.ids);
      } else if (asset?.kind === "audio" && overTimeline) {
        if (target && target.track < 0) placeMediaBatch(drag.ids, target.track, timelinePointerTime(event, target.lane));
        else if (!target) {
          const audioEnd = Math.max(
            0,
            ...timelineRef.current.clips.filter((clip) => clip.track === -1).map((clip) => clip.start + clipLength(clip))
          );
          placeMediaBatch(drag.ids, -1, audioEnd);
        } else placeMediaBatch(drag.ids, target.track, timelinePointerTime(event, target.lane));
      } else if (target) placeMediaBatch(drag.ids, target.track, timelinePointerTime(event, target.lane));
      else if (overTimeline) setError("Drop video or images on a visual lane.");
    }
    setDropPreview(null);
  }

  function cancelBinPointer() {
    binPointerRef.current = null;
    setBinDragPreview(null);
    setDropPreview(null);
  }

  function beginBinMarquee(event: React.PointerEvent<HTMLDivElement>) {
    if (activeBinTab !== "media" || event.button !== 0 || (event.target as Element).closest("button, label, input, select, summary")) return;
    binMarqueeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      selectedAtStart: selectedBinIds,
      additive: event.ctrlKey || event.metaKey,
      dragging: false,
    };
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
    if (drag.dragging) {
      suppressBinClickRef.current = true;
      window.setTimeout(() => {
        suppressBinClickRef.current = false;
      }, 0);
    } else if (!drag.additive) {
      setSelectedBinIds([]);
      binSelectionAnchorRef.current = null;
    }
  }

  function cancelBinMarquee(event: React.PointerEvent<HTMLDivElement>) {
    const drag = binMarqueeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    binMarqueeRef.current = null;
    setBinMarquee(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setSelectedBinIds(drag.selectedAtStart);
  }

  function selectAspectRatio(mode: VideoAspectRatioMode) {
    const option = ASPECT_RATIOS.find((item) => item.value === mode);
    const firstVisual = timeline.clips
      .filter((clip) => clip.track >= 0)
      .map((clip) => timeline.assets.find((asset) => asset.id === clip.assetId))
      .find((asset) => asset && (asset.kind === "video" || asset.kind === "image") && asset.width && asset.height);
    const ratio = mode === "original" ? (firstVisual ? (firstVisual.width ?? 16) / (firstVisual.height ?? 9) : 16 / 9) : option?.ratio;
    if (ratio) {
      const dimensions = canvasDimensionsForAspect(ratio);
      if (dimensions) {
        applyTimelineEdit((current) => ({ ...current, aspectRatioMode: mode, ...dimensions }));
        setWidthDraft(String(dimensions.width));
        setHeightDraft(String(dimensions.height));
      } else {
        applyTimelineEdit((current) => ({ ...current, aspectRatioMode: mode }));
      }
    } else {
      applyTimelineEdit((current) => ({ ...current, aspectRatioMode: mode }));
    }
  }

  function commitCustomCanvas() {
    const width = Number(widthDraft);
    const height = Number(heightDraft);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 16 || height < 16 || width > 7680 || height > 4320) {
      setWidthDraft(String(timeline.width));
      setHeightDraft(String(timeline.height));
      return;
    }
    applyTimelineEdit((current) => ({ ...current, width: Math.round(width), height: Math.round(height) }));
  }

  function editClip(id: string, patch: Partial<VideoTimelineClip>) {
    const targetIds = selectedClips.length > 1 && selectedClips.includes(id) ? selectedClips : [id];
    applyTimelineEdit((current) => {
      const ordered = [...targetIds]
        .filter((targetId) => {
          const clip = current.clips.find((item) => item.id === targetId);
          if (!clip || current.trackStates?.[clip.track]?.locked) return false;
          if (patch.track !== undefined) {
            const asset = current.assets.find((item) => item.id === clip.assetId);
            if (asset && !canPlaceAssetOnTrack(asset.kind, patch.track)) return false;
          }
          return true;
        })
        .sort((a, b) => {
          const startA = current.clips.find((item) => item.id === a)?.start ?? 0;
          const startB = current.clips.find((item) => item.id === b)?.start ?? 0;
          return startA - startB;
        });
      return ordered.reduce((acc, targetId) => updateClipTimeline(acc, targetId, patch, timeline.playhead, ripplePrimaryTrack), current);
    });
  }

  function snapPreviewMove(
    x: number,
    y: number,
    boxWidth: number,
    boxHeight: number,
    rotation: number,
    fit: number,
    disableSnap: boolean
  ) {
    if (disableSnap || !stageSize.width || !stageSize.height || fit <= 0) return { x, y, guideX: null as number | null, guideY: null as number | null };
    const threshold = 6 / fit;
    const halfW = boxWidth / fit / 2;
    const halfH = boxHeight / fit / 2;
    const axisAligned = Math.abs(rotation % 90) < 0.01;
    const xCandidates = [
      { target: 0, guide: stageSize.width / 2 },
      ...(axisAligned
        ? [
            { target: -timeline.width / 2 + halfW, guide: stageSize.width / 2 - (timeline.width / 2) * fit },
            { target: timeline.width / 2 - halfW, guide: stageSize.width / 2 + (timeline.width / 2) * fit },
          ]
        : []),
    ];
    const yCandidates = [
      { target: 0, guide: stageSize.height / 2 },
      ...(axisAligned
        ? [
            { target: -timeline.height / 2 + halfH, guide: stageSize.height / 2 - (timeline.height / 2) * fit },
            { target: timeline.height / 2 - halfH, guide: stageSize.height / 2 + (timeline.height / 2) * fit },
          ]
        : []),
    ];
    const bestX = xCandidates.reduce<{ target: number; guide: number; dist: number } | null>((best, cand) => {
      const dist = Math.abs(x - cand.target);
      return dist <= threshold && (!best || dist < best.dist) ? { ...cand, dist } : best;
    }, null);
    const bestY = yCandidates.reduce<{ target: number; guide: number; dist: number } | null>((best, cand) => {
      const dist = Math.abs(y - cand.target);
      return dist <= threshold && (!best || dist < best.dist) ? { ...cand, dist } : best;
    }, null);
    return {
      x: bestX ? bestX.target : x,
      y: bestY ? bestY.target : y,
      guideX: bestX ? bestX.guide : null,
      guideY: bestY ? bestY.guide : null,
    };
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
    stagePanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: previewPan.x,
      panY: previewPan.y,
      moved: false,
    };
  }

  function moveStagePan(event: React.PointerEvent<HTMLDivElement>) {
    const pan = stagePanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const dx = event.clientX - pan.startX;
    const dy = event.clientY - pan.startY;
    if (!pan.moved && Math.hypot(dx, dy) < 3) return;
    pan.moved = true;
    setPreviewPan({ x: pan.panX + dx, y: pan.panY + dy });
  }

  function finishStagePan(event: React.PointerEvent<HTMLDivElement>) {
    const pan = stagePanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    stagePanRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!pan.moved) selectTimelineClip("");
  }

  function beginTextGesture(
    event: React.PointerEvent<HTMLDivElement>,
    clip: VideoTimelineClip,
    transform: VideoClipTransform,
    overlay: PreviewOverlayBox
  ) {
    event.preventDefault();
    event.stopPropagation();
    setPlaying(false);
    const mode = ((event.target as HTMLElement).closest("[data-title-handle]")?.getAttribute("data-title-handle") ??
      "move") as "move" | "scale" | "rotate" | "width";
    const bounds = event.currentTarget.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const hasModifier = event.ctrlKey || event.metaKey || event.shiftKey;
    const keepSelection = !hasModifier && selectedClips.includes(clip.id);
    if (!keepSelection) {
      selectTimelineClip(clip.id, event.ctrlKey || event.metaKey, event.shiftKey);
    } else {
      setSelected(clip.id);
    }
    setHoveredClipId(clip.id);
    const targetIds = keepSelection && selectedClips.length > 1 ? selectedClips : [clip.id];
    const asset = timelineRef.current.assets.find((item) => item.id === clip.assetId);
    const font = Math.max(8, Math.min(512, (asset?.textSettings?.fontSize ?? 48) * transform.scale));
    const currentTextWidth = Math.max(
      20,
      (overlay.width / Math.max(0.01, overlay.fit) - font * 0.7) / Math.max(0.01, transform.scale)
    );
    const startMaxWidth =
      asset?.textSettings?.maxWidth && asset.textSettings.maxWidth > 0 ? asset.textSettings.maxWidth : currentTextWidth;
    textGestureRef.current = {
      id: clip.id,
      assetId: clip.assetId,
      targetIds,
      pointerId: event.pointerId,
      mode,
      x: event.clientX,
      y: event.clientY,
      width: overlay.width,
      height: overlay.height,
      startMaxWidth,
      transform: { ...transform },
      original: timelineRef.current,
      boxFit: overlay.fit,
      pointerFit: overlay.fit * previewZoom,
      centerX,
      centerY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveTextGesture(event: React.PointerEvent<HTMLDivElement>) {
    const drag = textGestureRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) < 1) return;
    if (drag.mode === "width") {
      const radians = (drag.transform.rotation * Math.PI) / 180;
      const localDx = dx * Math.cos(radians) + dy * Math.sin(radians);
      const deltaMaxWidth = (2 * localDx) / (drag.pointerFit * Math.max(0.01, drag.transform.scale));
      const nextMaxWidth = Math.max(40, Math.round(drag.startMaxWidth + deltaMaxWidth));
      const actualDelta = nextMaxWidth - drag.startMaxWidth;
      const targetAssetIds = new Set(
        drag.original.clips
          .filter((clip) => drag.targetIds.includes(clip.id) && !drag.original.trackStates?.[clip.track]?.locked)
          .map((clip) => clip.assetId)
      );
      if (!targetAssetIds.size) targetAssetIds.add(drag.assetId);
      const updated: VideoTimelineProject = {
        ...drag.original,
        assets: drag.original.assets.map((asset) => {
          if (!targetAssetIds.has(asset.id) || asset.kind !== "text" || !asset.textSettings) return asset;
          if (asset.id === drag.assetId) {
            return { ...asset, textSettings: { ...asset.textSettings, maxWidth: nextMaxWidth } };
          }
          const baseWidth =
            asset.textSettings.maxWidth && asset.textSettings.maxWidth > 0
              ? asset.textSettings.maxWidth
              : drag.startMaxWidth;
          return {
            ...asset,
            textSettings: { ...asset.textSettings, maxWidth: Math.max(40, Math.round(baseWidth + actualDelta)) },
          };
        }),
      };
      timelineRef.current = updated;
      setTimeline(updated);
      return;
    }
    let deltaX = 0;
    let deltaY = 0;
    let scaleRatio = 1;
    let deltaRotation = 0;
    if (drag.mode === "move") {
      const snapped = snapPreviewMove(
        drag.transform.x + dx / drag.pointerFit,
        drag.transform.y + dy / drag.pointerFit,
        drag.width,
        drag.height,
        drag.transform.rotation,
        drag.boxFit,
        event.altKey
      );
      deltaX = snapped.x - drag.transform.x;
      deltaY = snapped.y - drag.transform.y;
      setPreviewSnapGuides({ x: snapped.guideX, y: snapped.guideY });
    }
    if (drag.mode === "scale") {
      const before = Math.hypot(drag.x - drag.centerX, drag.y - drag.centerY);
      const after = Math.hypot(event.clientX - drag.centerX, event.clientY - drag.centerY);
      scaleRatio = after / Math.max(1, before);
    }
    if (drag.mode === "rotate") {
      const before = Math.atan2(drag.y - drag.centerY, drag.x - drag.centerX);
      const after = Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX);
      deltaRotation = ((after - before) * 180) / Math.PI;
    }
    let updated = drag.original;
    for (const targetId of drag.targetIds) {
      const targetClip = drag.original.clips.find((item) => item.id === targetId);
      if (!targetClip || targetClip.track < 0 || drag.original.trackStates?.[targetClip.track]?.locked) continue;
      const base = targetClip.transform ?? IDENTITY_TRANSFORM;
      const nextTransform: VideoClipTransform = {
        ...base,
        x: drag.mode === "move" ? base.x + deltaX : base.x,
        y: drag.mode === "move" ? base.y + deltaY : base.y,
        scale: drag.mode === "scale" ? Math.max(0.1, Math.min(8, base.scale * scaleRatio)) : base.scale,
        rotation: drag.mode === "rotate" ? base.rotation + deltaRotation : base.rotation,
      };
      updated = updateClipTimeline(updated, targetId, { transform: nextTransform }, drag.original.playhead, ripplePrimaryTrack);
    }
    timelineRef.current = updated;
    setTimeline(updated);
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
    } else if (drag.targetIds.length > 1 && !(event.ctrlKey || event.metaKey || event.shiftKey)) {
      selectTimelineClip(drag.id);
    }
  }

  function setSelectedImageSize(axis: "width" | "height", value: number) {
    if (!selectedClip || !selectedImageGeometry) return;
    const width = axis === "width" ? value : selectedImageGeometry.width;
    const height = axis === "height" ? value : selectedImageGeometry.height;
    const aspect = selectedImageGeometry.source.width / selectedImageGeometry.source.height;
    const matched =
      selectedClip.imageMatchAspect !== false
        ? axis === "width"
          ? { width, height: width / aspect }
          : { width: height * aspect, height }
        : { width, height };
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
    editClip(selectedClip.id, {
      imageCrop: nextCrop,
      ...(selectedClip.imageMatchAspect !== false
        ? { imageSize: { width: selectedImageGeometry.width / scale, height: selectedImageGeometry.width / (nextSource.width / nextSource.height) / scale } }
        : {}),
    });
  }

  function resetSelectedImageCrop() {
    if (!selectedClip || selectedAsset?.kind !== "image" || !selectedImageGeometry) return;
    const aspect = (selectedAsset.width ?? 1) / (selectedAsset.height ?? 1);
    const scale = Math.max(0.001, selectedTransform.scale);
    editClip(selectedClip.id, {
      imageCrop: undefined,
      ...(selectedClip.imageMatchAspect !== false
        ? { imageSize: { width: selectedImageGeometry.width / scale, height: selectedImageGeometry.width / aspect / scale } }
        : {}),
    });
  }

  function beginImageGesture(
    event: React.PointerEvent<HTMLDivElement>,
    clip: VideoTimelineClip,
    transform: VideoClipTransform,
    geometry: ReturnType<typeof imageClipGeometry>,
    overlay: PreviewOverlayBox
  ) {
    event.preventDefault();
    event.stopPropagation();
    setPlaying(false);
    const hasModifier = event.ctrlKey || event.metaKey || event.shiftKey;
    const keepSelection = !hasModifier && selectedClips.includes(clip.id);
    if (!keepSelection) {
      selectTimelineClip(clip.id, event.ctrlKey || event.metaKey, event.shiftKey);
    } else {
      setSelected(clip.id);
    }
    setHoveredClipId(clip.id);
    const mode = ((event.target as HTMLElement).closest("[data-image-handle]")?.getAttribute("data-image-handle") ??
      "move") as "move" | "resize" | "rotate";
    const bounds = event.currentTarget.getBoundingClientRect();
    const targetIds = keepSelection && selectedClips.length > 1 ? selectedClips : [clip.id];
    imageGestureRef.current = {
      id: clip.id,
      targetIds,
      pointerId: event.pointerId,
      mode,
      x: event.clientX,
      y: event.clientY,
      width: geometry.width,
      height: geometry.height,
      boxWidth: overlay.width,
      boxHeight: overlay.height,
      transform: { ...transform },
      original: timelineRef.current,
      boxFit: overlay.fit,
      pointerFit: overlay.fit * previewZoom,
      matchAspect: clip.imageMatchAspect !== false,
      sourceAspect: geometry.source.width / geometry.source.height,
      centerX: bounds.left + bounds.width / 2,
      centerY: bounds.top + bounds.height / 2,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveImageGesture(event: React.PointerEvent<HTMLDivElement>) {
    const drag = imageGestureRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.x) / drag.pointerFit;
    const dy = (event.clientY - drag.y) / drag.pointerFit;
    if (drag.targetIds.length === 1) {
      const transform = { ...drag.transform };
      let imageSize: VideoTimelineClip["imageSize"];
      if (drag.mode === "move") {
        const snapped = snapPreviewMove(
          transform.x + dx,
          transform.y + dy,
          drag.boxWidth,
          drag.boxHeight,
          transform.rotation,
          drag.boxFit,
          event.altKey
        );
        transform.x = snapped.x;
        transform.y = snapped.y;
        setPreviewSnapGuides({ x: snapped.guideX, y: snapped.guideY });
      } else if (drag.mode === "rotate") {
        const before = Math.atan2(drag.y - drag.centerY, drag.x - drag.centerX);
        const after = Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX);
        transform.rotation = drag.transform.rotation + ((after - before) * 180) / Math.PI;
      } else {
        const radians = (transform.rotation * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
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
      const updated = updateClipTimeline(
        drag.original,
        drag.id,
        { transform, ...(imageSize ? { imageSize } : {}) },
        drag.original.playhead,
        ripplePrimaryTrack
      );
      timelineRef.current = updated;
      setTimeline(updated);
      return;
    }

    let deltaX = 0;
    let deltaY = 0;
    let deltaRotation = 0;
    let scaleRatio = 1;
    if (drag.mode === "move") {
      const snapped = snapPreviewMove(
        drag.transform.x + dx,
        drag.transform.y + dy,
        drag.boxWidth,
        drag.boxHeight,
        drag.transform.rotation,
        drag.boxFit,
        event.altKey
      );
      deltaX = snapped.x - drag.transform.x;
      deltaY = snapped.y - drag.transform.y;
      setPreviewSnapGuides({ x: snapped.guideX, y: snapped.guideY });
    } else if (drag.mode === "rotate") {
      const before = Math.atan2(drag.y - drag.centerY, drag.x - drag.centerX);
      const after = Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX);
      deltaRotation = ((after - before) * 180) / Math.PI;
    } else {
      const before = Math.hypot(drag.x - drag.centerX, drag.y - drag.centerY);
      const after = Math.hypot(event.clientX - drag.centerX, event.clientY - drag.centerY);
      scaleRatio = after / Math.max(1, before);
    }
    let updated = drag.original;
    for (const targetId of drag.targetIds) {
      const targetClip = drag.original.clips.find((item) => item.id === targetId);
      if (!targetClip || targetClip.track < 0 || drag.original.trackStates?.[targetClip.track]?.locked) continue;
      const base = targetClip.transform ?? IDENTITY_TRANSFORM;
      const nextTransform: VideoClipTransform = {
        ...base,
        x: drag.mode === "move" ? base.x + deltaX : base.x,
        y: drag.mode === "move" ? base.y + deltaY : base.y,
        scale: drag.mode === "resize" ? Math.max(0.1, Math.min(8, base.scale * scaleRatio)) : base.scale,
        rotation: drag.mode === "rotate" ? base.rotation + deltaRotation : base.rotation,
      };
      updated = updateClipTimeline(updated, targetId, { transform: nextTransform }, drag.original.playhead, ripplePrimaryTrack);
    }
    timelineRef.current = updated;
    setTimeline(updated);
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
    } else if (drag.targetIds.length > 1 && !(event.ctrlKey || event.metaKey || event.shiftKey)) {
      selectTimelineClip(drag.id);
    }
  }

  function getTargetClipIds(primaryId?: string) {
    if (selectedClips.length > 1 && (!primaryId || selectedClips.includes(primaryId))) return selectedClips;
    return primaryId ? [primaryId] : [];
  }

  function patchSelectedTransform(
    patch: Partial<VideoClipTransform>,
    options: { relative?: boolean; reset?: boolean } = { relative: true }
  ) {
    if (!selectedClip) return;
    const targetIds = getTargetClipIds(selectedClip.id);
    const anchorBase = selectedTransform;
    const isMulti = targetIds.length > 1 && options.relative !== false;
    applyTimelineEdit((current) => {
      let next = current;
      for (const targetId of targetIds) {
        const clip = next.clips.find((item) => item.id === targetId);
        if (!clip || clip.track < 0 || next.trackStates?.[clip.track]?.locked) continue;
        if (options.reset) {
          next = updateClipTimeline(next, targetId, { transform: IDENTITY_TRANSFORM }, next.playhead, ripplePrimaryTrack);
          continue;
        }
        const base = clip.transform ?? IDENTITY_TRANSFORM;
        const nextTransform: VideoClipTransform = {
          x: patch.x !== undefined ? (isMulti ? base.x + (patch.x - anchorBase.x) : patch.x) : base.x,
          y: patch.y !== undefined ? (isMulti ? base.y + (patch.y - anchorBase.y) : patch.y) : base.y,
          scale:
            patch.scale !== undefined
              ? Math.max(0.1, Math.min(8, isMulti ? base.scale + (patch.scale - anchorBase.scale) : patch.scale))
              : base.scale,
          rotation:
            patch.rotation !== undefined
              ? Math.max(-180, Math.min(180, isMulti ? base.rotation + (patch.rotation - anchorBase.rotation) : patch.rotation))
              : base.rotation,
          opacity:
            patch.opacity !== undefined
              ? Math.max(0, Math.min(1, isMulti ? base.opacity + (patch.opacity - anchorBase.opacity) : patch.opacity))
              : base.opacity,
          mirrorX: patch.mirrorX !== undefined ? patch.mirrorX : base.mirrorX,
          mirrorY: patch.mirrorY !== undefined ? patch.mirrorY : base.mirrorY,
        };
        next = updateClipTimeline(next, targetId, { transform: nextTransform }, next.playhead, ripplePrimaryTrack);
      }
      return next;
    });
  }

  function patchSelectedTransitions(patch: Partial<VideoClipTransitions>) {
    if (!selectedClip) return;
    const targetIds = getTargetClipIds(selectedClip.id);
    const anchorFadeIn = selectedClip.transitions?.fadeIn ?? 0;
    const anchorFadeOut = selectedClip.transitions?.fadeOut ?? 0;
    const isMulti = targetIds.length > 1;
    applyTimelineEdit((current) => {
      let next = current;
      for (const targetId of targetIds) {
        const clip = next.clips.find((item) => item.id === targetId);
        if (!clip || next.trackStates?.[clip.track]?.locked) continue;
        const maxLen = clipLength(clip);
        const curFadeIn = clip.transitions?.fadeIn ?? 0;
        const curFadeOut = clip.transitions?.fadeOut ?? 0;
        const nextTransitions: VideoClipTransitions = {
          ...clip.transitions,
          ...(patch.inType !== undefined ? { inType: patch.inType } : {}),
          ...(patch.outType !== undefined ? { outType: patch.outType } : {}),
          fadeIn:
            patch.fadeIn !== undefined
              ? Math.max(0, Math.min(maxLen, isMulti ? curFadeIn + (patch.fadeIn - anchorFadeIn) : patch.fadeIn))
              : curFadeIn,
          fadeOut:
            patch.fadeOut !== undefined
              ? Math.max(0, Math.min(maxLen, isMulti ? curFadeOut + (patch.fadeOut - anchorFadeOut) : patch.fadeOut))
              : curFadeOut,
        };
        next = updateClipTimeline(next, targetId, { transitions: nextTransitions }, next.playhead, ripplePrimaryTrack);
      }
      return next;
    });
  }

  function patchSelectedStart(nextStart: number) {
    if (!selectedClip) return;
    const targetIds = getTargetClipIds(selectedClip.id);
    const delta = nextStart - selectedClip.start;
    applyTimelineEdit((current) => {
      const ordered = [...targetIds]
        .filter((id) => {
          const clip = current.clips.find((item) => item.id === id);
          return Boolean(clip && !current.trackStates?.[clip.track]?.locked);
        })
        .sort((a, b) => {
          const startA = current.clips.find((item) => item.id === a)?.start ?? 0;
          const startB = current.clips.find((item) => item.id === b)?.start ?? 0;
          return delta > 0 ? startB - startA : startA - startB;
        });
      return ordered.reduce((acc, id) => {
        const clip = acc.clips.find((item) => item.id === id);
        if (!clip) return acc;
        return updateClipTimeline(acc, id, { start: Math.max(0, clip.start + delta) }, acc.playhead, ripplePrimaryTrack);
      }, current);
    });
  }

  function patchSelectedSpeed(nextSpeed: number) {
    if (!selectedClip) return;
    const targetIds = getTargetClipIds(selectedClip.id);
    const delta = nextSpeed - selectedClip.speed;
    const isMulti = targetIds.length > 1;
    applyTimelineEdit((current) => {
      let next = current;
      for (const targetId of targetIds) {
        const clip = next.clips.find((item) => item.id === targetId);
        if (!clip || next.trackStates?.[clip.track]?.locked) continue;
        const speed = Math.max(0.1, Math.min(16, isMulti ? clip.speed + delta : nextSpeed));
        next = updateClipTimeline(next, targetId, { speed }, next.playhead, ripplePrimaryTrack);
      }
      return next;
    });
  }

  function patchSelectedVolume(nextVolume: number) {
    if (!selectedClip) return;
    const targetIds = getTargetClipIds(selectedClip.id);
    const delta = nextVolume - selectedClip.volume;
    const isMulti = targetIds.length > 1;
    applyTimelineEdit((current) => {
      let next = current;
      for (const targetId of targetIds) {
        const clip = next.clips.find((item) => item.id === targetId);
        if (!clip || next.trackStates?.[clip.track]?.locked) continue;
        const volume = Math.max(0, Math.min(2, isMulti ? clip.volume + delta : nextVolume));
        next = updateClipTimeline(next, targetId, { volume }, next.playhead, ripplePrimaryTrack);
      }
      return next;
    });
  }

  function patchSelectedDuration(nextDuration: number) {
    if (!selectedClip) return;
    const targetIds = getTargetClipIds(selectedClip.id);
    const delta = nextDuration - clipLength(selectedClip);
    const isMulti = targetIds.length > 1;
    applyTimelineEdit((current) => {
      let next = current;
      for (const targetId of targetIds) {
        const clip = next.clips.find((item) => item.id === targetId);
        if (!clip || next.trackStates?.[clip.track]?.locked) continue;
        const duration = Math.max(0.1, isMulti ? clipLength(clip) + delta : nextDuration);
        next = updateClipTimeline(
          next,
          targetId,
          { sourceEnd: clip.sourceStart + duration * clip.speed },
          next.playhead,
          ripplePrimaryTrack
        );
      }
      return next;
    });
  }

  function alignSelectedVisual(horizontal: "left" | "center" | "right", vertical: "top" | "middle" | "bottom") {
    if (!selectedClip || !selectedAsset) return;
    const sourceWidth = selectedAsset.width ?? timeline.width;
    const sourceHeight = selectedAsset.height ?? timeline.height;
    const fit = Math.min(timeline.width / sourceWidth, timeline.height / sourceHeight) * selectedTransform.scale;
    const spareX = (timeline.width - (selectedImageGeometry?.width ?? sourceWidth * fit)) / 2;
    const spareY = (timeline.height - (selectedImageGeometry?.height ?? sourceHeight * fit)) / 2;
    patchSelectedTransform({
      x: horizontal === "left" ? -spareX : horizontal === "right" ? spareX : 0,
      y: vertical === "top" ? -spareY : vertical === "bottom" ? spareY : 0,
    });
  }

  function beginTrim(event: React.PointerEvent<HTMLSpanElement>, clip: VideoTimelineClip, edge: "left" | "right") {
    event.preventDefault();
    event.stopPropagation();
    if (timelineRef.current.trackStates?.[clip.track]?.locked) {
      setError("Unlock this track before trimming its clips.");
      return;
    }
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
      const sourceStart = Math.max(
        0,
        Math.min(original.sourceEnd - 0.01, original.sourceStart + (start - original.start) * original.speed)
      );
      patch = { start: original.start + (sourceStart - original.sourceStart) / original.speed, sourceStart };
    } else {
      const sourceEnd = Math.max(
        original.sourceStart + 0.01,
        Math.min(asset?.duration ?? original.sourceEnd, original.sourceEnd + delta * original.speed)
      );
      patch = { sourceEnd };
    }
    const updated = updateClipTimeline(drag.timeline, clipId, patch, drag.timeline.playhead, ripplePrimaryTrack);
    timelineRef.current = updated;
    setTimeline(updated);
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
    const anchors = [
      timeline.playhead,
      Math.round(target),
      ...timeline.clips.filter((clip) => clip.id !== clipId && clip.track === track).flatMap((clip) => [clip.start, clip.start + clipLength(clip)]),
    ];
    const nearest = anchors.reduce((best, time) => (Math.abs(time - target) < Math.abs(best - target) ? time : best), anchors[0]);
    return Math.abs(nearest - target) <= threshold ? Math.max(0, nearest) : target;
  }

  const hasKeyframeAtPlayhead = Boolean(
    selectedClip?.keyframes?.some(
      (frame) => Math.abs(frame.time - Math.max(0, Math.min(clipLength(selectedClip), timeline.playhead - selectedClip.start))) < 0.05
    )
  );

  function toggleKeyframeAtPlayhead() {
    if (hasKeyframeAtPlayhead) removeKeyframeAtPlayhead();
    else addOrUpdateKeyframe();
  }

  function patchSelectedEffects(
    patch: Partial<NonNullable<VideoTimelineClip["effects"]>>,
    options: { relative?: boolean; reset?: boolean } = { relative: true }
  ) {
    if (!selectedClip) return;
    const targetIds = getTargetClipIds(selectedClip.id);
    const defaults: VideoClipEffects = { brightness: 100, contrast: 100, saturation: 100, grayscale: 0, hue: 0, sepia: 0, blur: 0 };
    const anchorEffects = { ...defaults, ...selectedClip.effects };
    const isMulti = targetIds.length > 1 && options.relative !== false && !options.reset;
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    applyTimelineEdit((current) => ({
      ...current,
      clips: current.clips.map((clip) => {
        if (!targetIds.includes(clip.id) || current.trackStates?.[clip.track]?.locked) return clip;
        if (options.reset) return { ...clip, effects: { ...defaults } };
        const base = { ...defaults, ...clip.effects };
        const next: VideoClipEffects = {
          brightness: patch.brightness !== undefined ? clamp(isMulti ? base.brightness + (patch.brightness - anchorEffects.brightness) : patch.brightness, 0, 200) : base.brightness,
          contrast: patch.contrast !== undefined ? clamp(isMulti ? base.contrast + (patch.contrast - anchorEffects.contrast) : patch.contrast, 0, 200) : base.contrast,
          saturation: patch.saturation !== undefined ? clamp(isMulti ? base.saturation + (patch.saturation - anchorEffects.saturation) : patch.saturation, 0, 200) : base.saturation,
          grayscale: patch.grayscale !== undefined ? clamp(isMulti ? base.grayscale + (patch.grayscale - anchorEffects.grayscale) : patch.grayscale, 0, 100) : base.grayscale,
          hue: patch.hue !== undefined ? clamp(isMulti ? (base.hue ?? 0) + (patch.hue - (anchorEffects.hue ?? 0)) : patch.hue, -180, 180) : base.hue,
          sepia: patch.sepia !== undefined ? clamp(isMulti ? (base.sepia ?? 0) + (patch.sepia - (anchorEffects.sepia ?? 0)) : patch.sepia, 0, 100) : base.sepia,
          blur: patch.blur !== undefined ? clamp(isMulti ? (base.blur ?? 0) + (patch.blur - (anchorEffects.blur ?? 0)) : patch.blur, 0, 20) : base.blur,
        };
        return { ...clip, effects: next };
      }),
    }));
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
    if (!videoFile) {
      setError("The video source is missing. Re-import it before detaching audio.");
      return;
    }
    if (timeline.assets.some((asset) => asset.kind === "audio" && asset.derivedFromAssetId === selectedAsset.id)) {
      setError("Audio has already been detached from this source. Remove its audio asset before detaching again.");
      return;
    }
    setExtractingAudio(true);
    setExtractProgress(0);
    setError("");
    let input: import("mediabunny").Input | undefined;
    try {
      const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output, WavOutputFormat } = await import("mediabunny");
      input = new Input({ source: new BlobSource(videoFile), formats: ALL_FORMATS });
      const target = new BufferTarget();
      const output = new Output({ format: new WavOutputFormat(), target });
      const conversion = await Conversion.init({
        input,
        output,
        tracks: "primary",
        video: { discard: true },
        audio: { numberOfChannels: 2, sampleRate: 48_000, sampleFormat: "s16" },
      });
      audioConversionRef.current = conversion;
      if (!conversion.isValid || !conversion.utilizedTracks.length) throw new Error("This video has no primary audio track that the browser can detach.");
      conversion.onProgress = (value) => setExtractProgress(Math.round(value * 100));
      await conversion.execute();
      if (!target.buffer || target.buffer.byteLength > 512 * 1024 * 1024) throw new Error("The detached audio exceeds the 512 MiB project limit.");
      const audioFile = new File([target.buffer], `Audio - ${selectedAsset.name.replace(/\.[^.]+$/, "")}.wav`, { type: "audio/wav" });
      if (timelineRef.current.assets.reduce((total, asset) => total + asset.size, audioFile.size) > 512 * 1024 * 1024) {
        throw new Error("Detaching this audio would exceed the 512 MiB total project media limit.");
      }
      const audioId = crypto.randomUUID();
      const audioDuration = Math.max(0.01, (target.buffer.byteLength - 44) / (48_000 * 2 * 2));
      const audioAsset: VideoTimelineAsset = {
        id: audioId,
        name: audioFile.name,
        type: audioFile.type,
        size: audioFile.size,
        duration: audioDuration,
        kind: "audio",
        importedAt: Date.now(),
        derivedFromAssetId: selectedAsset.id,
      };
      const sourceEnd = Math.min(selectedClip.sourceEnd, audioDuration);
      if (sourceEnd <= selectedClip.sourceStart) throw new Error("The extracted audio track does not cover this video clip's selected source range.");
      const current = timelineRef.current;
      const detachedLength = Math.max(0.01, (sourceEnd - selectedClip.sourceStart) / selectedClip.speed);
      const detachedStart = selectedClip.start;
      const detachedEnd = detachedStart + detachedLength;
      let audioTrack = -1;
      while (
        current.clips.some(
          (clip) => clip.track === audioTrack && detachedStart < clip.start + clipLength(clip) - 0.0001 && detachedEnd > clip.start + 0.0001
        )
      ) {
        audioTrack -= 1;
      }
      const audioClip: VideoTimelineClip = {
        id: crypto.randomUUID(),
        assetId: audioId,
        track: audioTrack,
        start: detachedStart,
        sourceStart: selectedClip.sourceStart,
        sourceEnd,
        speed: selectedClip.speed,
        volume: selectedClip.volume,
        muted: false,
        pitchMode: "preserve",
      };
      const updated = {
        ...current,
        assets: [...current.assets, audioAsset],
        clips: [...current.clips.map((clip) => (clip.id === selectedClip.id ? { ...clip, muted: true } : clip)), audioClip],
        duration: Math.max(current.duration, audioClip.start + clipLength(audioClip)),
      };
      await saveVideoTimeline(projectId, updated, [{ id: audioId, file: audioFile }]);
      setFiles((previous) => ({ ...previous, [audioId]: audioFile }));
      applyTimelineEdit(() => updated);
      selectTimelineClip(audioClip.id);
      setStatus(`Source audio detached into Audio ${-audioTrack} as a local editable WAV clip.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not detach the video's audio track.");
    } finally {
      audioConversionRef.current = null;
      setExtractingAudio(false);
      setExtractProgress(0);
    }
  }

  async function cancelAudioExtraction() {
    if (audioConversionRef.current) await audioConversionRef.current.cancel().catch(() => undefined);
  }

  function replaceVideoAudio() {
    if (!selectedClip || selectedAsset?.kind !== "video") return;
    const assetId = selectedReplacementAudioAssetId;
    const audioAsset = timeline.assets.find((asset) => asset.id === assetId && asset.kind === "audio");
    const offset = Number(replacementAudioOffset);
    if (!audioAsset) {
      setError("Import an audio source and select it before replacing clip audio.");
      return;
    }
    if (!Number.isFinite(offset) || offset < 0 || offset >= clipLength(selectedClip)) {
      setError("Audio offset must be a valid time inside the selected video clip.");
      return;
    }
    const sourceEnd = Math.min(audioAsset.duration, (clipLength(selectedClip) - offset) * selectedClip.speed);
    if (sourceEnd <= 0.01) {
      setError("The selected video clip is too short for this audio offset.");
      return;
    }
    const audioClip: VideoTimelineClip = {
      id: crypto.randomUUID(),
      assetId: audioAsset.id,
      track: -1,
      start: selectedClip.start + offset,
      sourceStart: 0,
      sourceEnd,
      speed: selectedClip.speed,
      volume: 1,
      muted: false,
      pitchMode: "preserve",
    };
    const detachedAssetId = timeline.assets.find((asset) => asset.kind === "audio" && asset.derivedFromAssetId === selectedAsset.id)?.id;
    applyTimelineEdit((current) => {
      const clips = current.clips.map((clip) =>
        clip.id === selectedClip.id || (clip.assetId === detachedAssetId && Math.abs(clip.start - selectedClip.start) < 0.01)
          ? { ...clip, muted: true }
          : clip
      );
      const next = [...clips, audioClip];
      return { ...current, clips: next, duration: Math.max(0, ...next.map((clip) => clip.start + clipLength(clip))) };
    });
    setSelected(audioClip.id);
    setError("");
    setStatus(`Replacement audio placed on Audio 1 at ${offset.toFixed(2)} seconds into the selected video clip.`);
  }

  function removeKeyframeAtPlayhead() {
    if (!selectedClip?.keyframes?.length) return;
    const time = Math.max(0, Math.min(clipLength(selectedClip), timeline.playhead - selectedClip.start));
    editClip(selectedClip.id, { keyframes: selectedClip.keyframes.filter((frame) => Math.abs(frame.time - time) >= 0.05) });
  }

  function createTransitionToNext(kind: "dissolve" | "crossfade" | "fade-black" | VideoTransitionType) {
    if (!selectedClip || !selectedAsset) return;
    const candidates = timeline.clips
      .filter((clip) => clip.id !== selectedClip.id && clip.track === selectedClip.track && clip.start > selectedClip.start + 0.001)
      .sort((a, b) => a.start - b.start);
    const next = candidates[0];
    const nextAsset = next && timeline.assets.find((asset) => asset.id === next.assetId);
    const allowedKinds = kind === "crossfade" ? ["audio"] : ["video", "image", "text"];
    const duration = Number(transitionDuration);
    if (!next || !nextAsset || !allowedKinds.includes(selectedAsset.kind) || !allowedKinds.includes(nextAsset.kind)) {
      setError(`Select a ${kind === "crossfade" ? "audio" : "visual"} clip with a following clip on the same track.`);
      return;
    }
    const overlap = Math.max(0, Math.min(clipLength(selectedClip), clipLength(next), duration));
    if (!Number.isFinite(duration) || overlap <= 0 || overlap !== duration) {
      setError("Enter a transition duration greater than 0 and no longer than either clip.");
      return;
    }
    const isFadeBlack = kind === "fade-black";
    const inType: VideoTransitionType =
      kind === "dissolve" || kind === "crossfade" || kind === "fade-black" ? "fade" : kind;
    const changes = new Map<string, Partial<VideoTimelineClip>>();
    changes.set(selectedClip.id, {
      transitions: {
        ...selectedClip.transitions,
        fadeIn: selectedClip.transitions?.fadeIn ?? 0,
        fadeOut: kind === "crossfade" || isFadeBlack ? overlap : selectedClip.transitions?.fadeOut ?? 0,
      },
    });
    changes.set(next.id, {
      transitions: {
        ...next.transitions,
        fadeIn: overlap,
        fadeOut: next.transitions?.fadeOut ?? 0,
        inType,
      },
    });
    applyTimelineEdit((current) => ({
      ...current,
      clips: current.clips.map((clip) => (changes.has(clip.id) ? { ...clip, ...changes.get(clip.id) } : clip)),
    }));
    setError("");
    setStatus(kind === "crossfade" ? "Audio crossfade added between adjacent clips." : `Applied ${kind.replace("-", " ")} transition.`);
  }

  function addTitlePreset(preset = TEXT_PRESETS[0]) {
    const asset: VideoTimelineAsset = {
      id: crypto.randomUUID(),
      name: preset.label,
      type: "text/plain",
      size: 0,
      duration: 3600,
      kind: "text",
      importedAt: Date.now(),
      textSettings: { ...preset.settings },
    };
    const track = Math.max(0, ...timeline.clips.map((item) => item.track)) + 1;
    const clip: VideoTimelineClip = {
      id: crypto.randomUUID(),
      assetId: asset.id,
      track,
      start: timeline.playhead,
      sourceStart: 0,
      sourceEnd: 5,
      speed: 1,
      volume: 1,
      muted: false,
      ...(preset.transform ? { transform: { ...IDENTITY_TRANSFORM, ...preset.transform } } : {}),
    };
    applyTimelineEdit((current) => ({
      ...current,
      assets: [...current.assets, asset],
      clips: [...current.clips, clip],
      duration: Math.max(current.duration, clip.start + clipLength(clip)),
    }));
    selectTimelineClip(clip.id);
  }

  async function addShapeOverlay(shapeId: string) {
    const shape = SVG_SHAPES.find((item) => item.id === shapeId);
    if (!shape) return;
    const color = /^#[0-9a-f]{6}$/i.test(shapeColor) ? shapeColor : "#38d2e0";
    const file = new File([shape.svg(color)], `${shape.label}.svg`, { type: "image/svg+xml" });
    const current = projectId ? timelineRef.current : EMPTY;
    const asset: VideoTimelineAsset = {
      id: crypto.randomUUID(),
      name: shape.label,
      type: file.type,
      size: file.size,
      duration: 3600,
      kind: "image",
      importedAt: Date.now(),
      width: 512,
      height: 320,
    };
    const track = Math.max(0, ...current.clips.map((clip) => clip.track)) + 1;
    const clip: VideoTimelineClip = {
      id: crypto.randomUUID(),
      assetId: asset.id,
      track,
      start: current.playhead,
      sourceStart: 0,
      sourceEnd: 5,
      speed: 1,
      volume: 1,
      muted: false,
      transform: { ...IDENTITY_TRANSFORM, scale: 0.45 },
    };
    const updated = {
      ...current,
      assets: [...current.assets, asset],
      clips: [...current.clips, clip],
      duration: Math.max(current.duration, clip.start + clipLength(clip)),
    };
    try {
      const targetProject = projectId || (await createProject("Untitled video", "video")).id;
      await saveVideoTimeline(targetProject, updated, [{ id: asset.id, file }]);
      setFiles((prev) => ({ ...prev, [asset.id]: file }));
      if (projectId) applyTimelineEdit(() => updated);
      else setParams({ project: targetProject });
      selectTimelineClip(clip.id);
      setError("");
      setStatus(`Added ${shape.label} shape on Overlay ${track}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the shape overlay.");
    }
  }

  function editTitleAsset(assetId: string, textSettings: NonNullable<VideoTimelineAsset["textSettings"]>) {
    applyTimelineEdit((current) => {
      if (selectedClips.length <= 1) {
        return {
          ...current,
          assets: current.assets.map((asset) => (asset.id === assetId ? { ...asset, textSettings } : asset)),
        };
      }
      const anchorAsset = current.assets.find((item) => item.id === assetId);
      const anchorSettings = anchorAsset?.textSettings;
      const targetAssetIds = new Set(
        current.clips
          .filter((clip) => selectedClips.includes(clip.id) && !current.trackStates?.[clip.track]?.locked)
          .map((clip) => clip.assetId)
      );
      if (!targetAssetIds.size || !anchorSettings) {
        return {
          ...current,
          assets: current.assets.map((asset) => (asset.id === assetId ? { ...asset, textSettings } : asset)),
        };
      }
      const numericKeys = [
        "fontSize",
        "letterSpacing",
        "lineHeight",
        "maxWidth",
        "strokeWidth",
        "shadowBlur",
        "shadowOffsetX",
        "shadowOffsetY",
        "backgroundRadius",
        "backgroundOpacity",
        "backgroundPadding",
      ] as const;
      return {
        ...current,
        assets: current.assets.map((asset) => {
          if (!targetAssetIds.has(asset.id) || asset.kind !== "text" || !asset.textSettings) return asset;
          if (asset.id === assetId) return { ...asset, textSettings };
          const next: VideoTextSettings = { ...asset.textSettings };
          const nextRecord = next as Record<string, unknown>;
          const anchorRecord = anchorSettings as Record<string, unknown>;
          const incomingRecord = textSettings as Record<string, unknown>;
          for (const key of Object.keys(textSettings)) {
            if (incomingRecord[key] === anchorRecord[key]) continue;
            if ((numericKeys as readonly string[]).includes(key)) {
              const delta = Number(incomingRecord[key] ?? 0) - Number(anchorRecord[key] ?? 0);
              nextRecord[key] = Number(nextRecord[key] ?? 0) + delta;
            } else {
              nextRecord[key] = incomingRecord[key];
            }
          }
          return { ...asset, textSettings: next };
        }),
      };
    });
  }

  function selectTimelineClip(id: string, additive = false, range = false) {
    if (!id) {
      setSelected("");
      setSelectedClips([]);
      return;
    }
    if (range && selected) {
      const anchor = timelineRef.current.clips.find((clip) => clip.id === selected);
      const target = timelineRef.current.clips.find((clip) => clip.id === id);
      if (anchor && target && anchor.track === target.track) {
        const minStart = Math.min(anchor.start, target.start);
        const maxStart = Math.max(anchor.start, target.start);
        const ids = timelineRef.current.clips
          .filter((clip) => clip.track === anchor.track && clip.start >= minStart && clip.start <= maxStart)
          .map((clip) => clip.id);
        setSelectedClips(ids);
        setSelected(id);
        return;
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

  function beginTimelineMarquee(event: React.PointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      (event.target as Element).closest(
        "button, input, select, label, .timeline-ruler, .timeline-playhead, .timeline-track > strong, .timeline-trim-handle"
      )
    )
      return;
    timelineMarqueeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      selectedAtStart: selectedClips.length ? selectedClips : selected ? [selected] : [],
      primaryAtStart: selected,
      additive: event.ctrlKey || event.metaKey,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveTimelineMarquee(event: React.PointerEvent<HTMLDivElement>) {
    const drag = timelineMarqueeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.dragging && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    drag.dragging = true;
    const left = Math.min(drag.startX, event.clientX);
    const top = Math.min(drag.startY, event.clientY);
    const right = Math.max(drag.startX, event.clientX);
    const bottom = Math.max(drag.startY, event.clientY);
    setTimelineMarquee({ left, top, width: right - left, height: bottom - top });
    const hitIds = Array.from(timelineScrollRef.current?.querySelectorAll<HTMLElement>(".timeline-clip[data-clip-id]") ?? [])
      .filter((clipEl) => {
        const bounds = clipEl.getBoundingClientRect();
        return bounds.left < right && bounds.right > left && bounds.top < bottom && bounds.bottom > top;
      })
      .map((clipEl) => clipEl.dataset.clipId ?? "")
      .filter(Boolean);
    const nextIds = resolveMarqueeSelection(drag.selectedAtStart, hitIds, drag.additive);
    setSelectedClips(nextIds);
    setSelected((current) => (nextIds.includes(current) ? current : nextIds[0] ?? ""));
  }

  function finishTimelineMarquee(event: React.PointerEvent<HTMLDivElement>) {
    const drag = timelineMarqueeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    timelineMarqueeRef.current = null;
    setTimelineMarquee(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.dragging) {
      suppressTimelineClickRef.current = true;
      window.setTimeout(() => {
        suppressTimelineClickRef.current = false;
      }, 0);
    } else if (!drag.additive) {
      selectTimelineClip("");
    }
  }

  function cancelTimelineMarquee(event: React.PointerEvent<HTMLDivElement>) {
    const drag = timelineMarqueeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    timelineMarqueeRef.current = null;
    setTimelineMarquee(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setSelectedClips(drag.selectedAtStart);
    setSelected(drag.primaryAtStart);
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
    if (!unlockedIds.length) {
      setError("Unlock the track before deleting its clips.");
      return;
    }
    applyTimelineEdit((current) => {
      const clips = current.clips.filter((clip) => !unlockedIds.includes(clip.id));
      return { ...current, clips, duration: Math.max(0, ...clips.map((clip) => clip.start + clipLength(clip))) };
    });
    setSelected("");
    setSelectedClips([]);
    setError("");
  }

  function splitSelected() {
    const target =
      selectedClip ??
      timeline.clips.find(
        (clip) => clip.track === 0 && timeline.playhead > clip.start && timeline.playhead < clip.start + clipLength(clip)
      );
    if (!target) return;
    if (timeline.trackStates?.[target.track]?.locked) {
      setError("Unlock this track before splitting its clips.");
      return;
    }
    const cut = timeline.playhead;
    if (cut <= target.start || cut >= target.start + clipLength(target)) {
      setError("Move the playhead inside the selected clip to split it.");
      return;
    }
    const sourceCut = target.sourceStart + (cut - target.start) * target.speed;
    const right = { ...target, id: crypto.randomUUID(), start: cut, sourceStart: sourceCut };
    applyTimelineEdit((current) => ({
      ...current,
      clips: [...current.clips.map((clip) => (clip.id === target.id ? { ...clip, sourceEnd: sourceCut } : clip)), right],
    }));
    selectTimelineClip(right.id);
    setHoveredClipId(right.id);
    setError("");
  }

  function deleteHoveredSide(side: "left" | "right") {
    const current = timelineRef.current;
    const target =
      current.clips.find((clip) => clip.id === hoveredClipId) ??
      current.clips.find((clip) => clip.id === selected) ??
      current.clips.find((clip) => clip.track === 0 && current.playhead > clip.start && current.playhead < clip.start + clipLength(clip)) ??
      current.clips[0];
    if (!target) {
      setError("Add a clip to the timeline first.");
      return;
    }
    const targetName = current.assets.find((asset) => asset.id === target.assetId)?.name ?? "clip";
    const cut = current.playhead;
    const end = target.start + clipLength(target);
    if (cut <= target.start) {
      if (side === "left") {
        setError("The playhead is before this clip, so it has no left portion to delete.");
        return;
      }
      removeClip(target.id);
      setStatus(`Deleted ${targetName} to the right of the playhead.`);
      setError("");
      return;
    }
    if (cut >= end) {
      if (side === "right") {
        setError("The playhead is after this clip, so it has no right portion to delete.");
        return;
      }
      removeClip(target.id);
      setStatus(`Deleted ${targetName} to the left of the playhead.`);
      setError("");
      return;
    }
    const sourceCut = target.sourceStart + (cut - target.start) * target.speed;
    const patch = side === "left" ? { start: target.start, sourceStart: sourceCut } : { sourceEnd: sourceCut };
    applyTimelineEdit((latest) => updateClipTimeline(latest, target.id, patch, cut, ripplePrimaryTrack));
    setSelected(target.id);
    setStatus(`Deleted the ${side} part of ${targetName}.`);
    setError("");
  }

  const pxPerSecond = Math.max(12, Math.min(160, Number(zoom) || 60));

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
    if (playheadDragRef.current) return;
    const viewport = timelineScrollRef.current;
    if (!viewport) return;
    const rulerOffset = timelineRulerOffset();
    const laneViewportWidth = Math.max(120, viewport.clientWidth - rulerOffset);
    const playheadPx = timeline.playhead * pxPerSecond;
    const viewLeft = viewport.scrollLeft;
    const viewRight = viewLeft + laneViewportWidth;
    if (playheadPx > viewRight - 20) {
      viewport.scrollLeft = Math.max(0, playheadPx - laneViewportWidth * 0.25);
    } else if (playheadPx < viewLeft) {
      viewport.scrollLeft = Math.max(0, playheadPx - 24);
    }
  }, [timeline.playhead, pxPerSecond]);

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
    if (timelineRef.current.trackStates?.[track]?.locked) {
      setDropPreview(null);
      event.dataTransfer.dropEffect = "none";
      return;
    }
    const placement = placementForDrop(track, timelinePointerTime(event, event.currentTarget), drag);
    if (!placement) {
      setDropPreview(null);
      event.dataTransfer.dropEffect = "none";
      return;
    }
    event.dataTransfer.dropEffect = drag.kind === "asset" ? "copy" : "move";
    setDropPreview((previous) =>
      previous?.track === track && Math.abs(previous.start - placement.start) < 0.001 && previous.duration === placement.duration
        ? previous
        : { track, start: placement.start, duration: placement.duration }
    );
  }

  function finishTrackDrop(event: React.DragEvent<HTMLDivElement>, track: number) {
    event.preventDefault();
    event.stopPropagation();
    const assetId = event.dataTransfer.getData("text/asset");
    const clipId = event.dataTransfer.getData("text/clip");
    const drag =
      draggingRef.current ??
      (assetId
        ? { kind: "asset" as const, id: assetId, grabOffset: 0 }
        : clipId
          ? { kind: "clip" as const, id: clipId, grabOffset: Number(event.dataTransfer.getData("text/clip-grab-offset")) || 0 }
          : null);
    draggingRef.current = null;
    setActiveTrackDragKind(null);
    setDropPreview(null);
    if (!drag) return;
    const pointerTime = timelinePointerTime(event, event.currentTarget);
    if (drag.kind === "asset" && timelineRef.current.assets.some((asset) => asset.id === drag.id && asset.captionSourceName)) {
      placeCaptionBatch(selectedCaptionIds.includes(drag.id) ? selectedCaptionIds : [drag.id]);
    } else if (drag.kind === "asset") {
      addAssetToTimeline(drag.id, track, pointerTime);
    } else {
      moveClipToTrack(drag.id, track, pointerTime, drag.grabOffset);
    }
  }

  function snapTimelinePlayhead(rawTime: number, disableSnap = false) {
    const current = timelineRef.current;
    const clamped = Math.max(0, Math.min(current.duration, rawTime));
    if (!snapEnabled || disableSnap || current.duration <= 0) return clamped;
    const threshold = Math.max(0, Math.min(Number(snapThreshold) || 0.25, 10 / Math.max(12, pxPerSecond)));
    const anchors = [
      0,
      current.duration,
      ...current.clips.flatMap((clip) => [clip.start, clip.start + clipLength(clip), ...(clip.keyframes ?? []).map((frame) => clip.start + frame.time)]),
    ];
    let best = clamped;
    let bestDist = threshold;
    for (const anchor of anchors) {
      const dist = Math.abs(clamped - anchor);
      if (dist <= bestDist) {
        best = anchor;
        bestDist = dist;
      }
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
    setTimeline((current) => ({
      ...current,
      playhead: Math.max(0, Math.min(current.duration, current.playhead + direction / Math.max(1, current.fps))),
    }));
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
    window.setTimeout(() => {
      justSeekedRef.current = false;
    }, 0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  async function toggleFullscreen() {
    if (playerExpanded) {
      setPlayerExpanded(false);
      return;
    }
    try {
      if (document.fullscreenElement === previewRef.current) await document.exitFullscreen();
      else await previewRef.current?.requestFullscreen();
    } catch {
      setPlayerExpanded(true);
    }
  }

  useEffect(() => {
    if (!playerExpanded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlayerExpanded(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [playerExpanded]);

  const outputSettingsValid =
    Number.isInteger(Number(exportWidthDraft)) &&
    Number(exportWidthDraft) >= 16 &&
    Number(exportWidthDraft) <= 7680 &&
    Number.isInteger(Number(exportHeightDraft)) &&
    Number(exportHeightDraft) >= 16 &&
    Number(exportHeightDraft) <= 4320 &&
    Number(exportWidthDraft) * Number(exportHeightDraft) <= 4_000_000 &&
    Number(exportFrameRateDraft) >= 12 &&
    Number(exportFrameRateDraft) <= 60 &&
    Number(videoBitrate) >= 0.5 &&
    Number(videoBitrate) <= 40 &&
    (!timeline.clips.some(
      (clip) =>
        !clip.muted &&
        clip.volume > 0 &&
        (clip.track < 0 || timeline.assets.some((asset) => asset.id === clip.assetId && asset.kind === "video"))
    ) ||
      (Number(audioBitrate) >= 64 && Number(audioBitrate) <= 320));

  function applyTimelineEdit(update: (current: VideoTimelineProject) => VideoTimelineProject) {
    const current = timelineRef.current;
    const next = update(current);
    historyRef.current.past.push(current);
    if (historyRef.current.past.length > 50) historyRef.current.past.shift();
    historyRef.current.future = [];
    timelineRef.current = next;
    setTimeline(next);
    setHistoryVersion((value) => value + 1);
  }

  function undo() {
    const previous = historyRef.current.past.pop();
    if (!previous) return;
    historyRef.current.future.push(timelineRef.current);
    timelineRef.current = previous;
    setTimeline(previous);
    setHistoryVersion((value) => value + 1);
  }

  function redo() {
    const next = historyRef.current.future.pop();
    if (!next) return;
    historyRef.current.past.push(timelineRef.current);
    timelineRef.current = next;
    setTimeline(next);
    setHistoryVersion((value) => value + 1);
  }

  function duplicateClip(id: string) {
    const clip = timelineRef.current.clips.find((item) => item.id === id);
    if (!clip) return;
    if (timelineRef.current.trackStates?.[clip.track]?.locked) {
      setError("Unlock this track before duplicating its clips.");
      return;
    }
    const copy = { ...clip, id: crypto.randomUUID(), start: clip.start + clipLength(clip) };
    applyTimelineEdit((current) => ({
      ...current,
      clips: [...current.clips, copy],
      duration: Math.max(current.duration, copy.start + clipLength(copy)),
    }));
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
    if (timelineRef.current.trackStates?.[copied.track]?.locked) {
      setError("Unlock the target track before pasting.");
      return;
    }
    const pasted: VideoTimelineClip = {
      ...structuredClone(copied),
      id: crypto.randomUUID(),
      start: Math.max(0, timelineRef.current.playhead),
    };
    applyTimelineEdit((current) => ({
      ...current,
      clips: [...current.clips, pasted],
      duration: Math.max(current.duration, pasted.start + clipLength(pasted)),
    }));
    selectTimelineClip(pasted.id);
    setHoveredClipId(pasted.id);
    setError("");
  }

  async function freezeFrameClip(id: string) {
    const current = timelineRef.current;
    const clip = current.clips.find((item) => item.id === id);
    const asset = clip && current.assets.find((item) => item.id === clip.assetId);
    const video = videoRefs.current[id];
    if (!clip || !asset || asset.kind !== "video" || !video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      setError("Seek the playhead onto a loaded video frame to create a freeze frame.");
      return;
    }
    const offscreen = document.createElement("canvas");
    offscreen.width = video.videoWidth;
    offscreen.height = video.videoHeight;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
    const blob = await new Promise<Blob | null>((resolve) => offscreen.toBlob(resolve, "image/png"));
    if (!blob) {
      setError("Could not capture the current video frame.");
      return;
    }
    const file = new File([blob], `${asset.name.replace(/\.[^.]+$/, "")}-freeze.png`, {
      type: "image/png",
      lastModified: Date.now(),
    });
    const assetId = crypto.randomUUID();
    const newAsset: VideoTimelineAsset = {
      id: assetId,
      name: file.name,
      type: file.type,
      size: file.size,
      duration: 3,
      kind: "image",
      importedAt: Date.now(),
      fileModifiedAt: file.lastModified,
      width: offscreen.width,
      height: offscreen.height,
    };
    const targetTrack = current.trackStates?.[clip.track + 1]?.locked
      ? current.clips.reduce((max, item) => Math.max(max, item.track), 0) + 1
      : clip.track + 1;
    const newClip: VideoTimelineClip = {
      id: crypto.randomUUID(),
      assetId,
      track: targetTrack,
      start: Math.max(0, current.playhead),
      sourceStart: 0,
      sourceEnd: 3,
      speed: 1,
      volume: 1,
      muted: false,
      transform: clip.transform ? { ...clip.transform } : undefined,
    };
    setFiles((prev) => ({ ...prev, [assetId]: file }));
    applyTimelineEdit((latest) => {
      const next = {
        ...latest,
        assets: [...latest.assets, newAsset],
        clips: [...latest.clips, newClip],
        duration: Math.max(latest.duration, newClip.start + 3),
      };
      if (projectId) void saveVideoTimeline(projectId, next, [{ id: assetId, file }]);
      return next;
    });
    selectTimelineClip(newClip.id);
    setHoveredClipId(newClip.id);
    setError("");
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
      return (
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLInputElement && ["text", "search", "email", "url", "tel", "password"].includes(target.type)) ||
        (target instanceof HTMLElement && target.isContentEditable)
      );
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
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return;
      const actionControl = target instanceof HTMLElement && target.closest("button, a, [role=button]");
      if (actionControl && !event.ctrlKey && !event.metaKey && event.key !== "Delete" && event.key !== "Backspace") return;
      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        } else if (key === "y") {
          event.preventDefault();
          redo();
        } else if (key === "b") {
          event.preventDefault();
          splitSelected();
        } else if (key === "d" && selected) {
          event.preventDefault();
          duplicateClip(selected);
        } else if (key === "c" && selected) {
          event.preventDefault();
          copyClip(selected);
        } else if (key === "v") {
          event.preventDefault();
          pasteClip();
        }
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selected) {
          event.preventDefault();
          removeClip(selected);
        }
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        splitSelected();
      } else if (event.key.toLowerCase() === "q") {
        event.preventDefault();
        deleteHoveredSide("left");
      } else if (event.key.toLowerCase() === "w") {
        event.preventDefault();
        deleteHoveredSide("right");
      } else if (event.key.toLowerCase() === "j") {
        event.preventDefault();
        setPlaying(false);
        setTimeline((current) => ({ ...current, playhead: Math.max(0, current.playhead - 1) }));
      } else if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPlaying(false);
      } else if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        if (!playing) togglePlayback();
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoom(String(Math.max(12, Math.round(pxPerSecond / 1.2))));
      } else if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        setZoom(String(Math.min(160, Math.round(pxPerSecond * 1.2))));
      } else if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen((open) => !open);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const step = event.shiftKey ? 1 : 1 / Math.max(1, timelineRef.current.fps);
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        setTimeline((current) => ({
          ...current,
          playhead: Math.max(0, Math.min(current.duration, current.playhead + step * direction)),
        }));
      } else if (event.key === "Home") {
        event.preventDefault();
        setTimeline((current) => ({ ...current, playhead: 0 }));
      }
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
    if (playing) {
      setPlaying(false);
      return;
    }
    if (!timeline.clips.length || timeline.duration <= 0) return;
    setError("");
    if (previewAudioContextRef.current?.state === "suspended") void previewAudioContextRef.current.resume();
    for (const clip of timeline.clips.filter(
      (item) =>
        item.track >= 0 &&
        timeline.assets.some((asset) => asset.id === item.assetId && asset.kind === "video") &&
        timeline.playhead >= item.start &&
        timeline.playhead < item.start + clipLength(item)
    )) {
      const video = videoRefs.current[clip.id];
      if (!video) continue;
      video.currentTime = clip.sourceStart + (timeline.playhead - clip.start) * clip.speed;
      video.playbackRate = clip.speed;
      video.preservesPitch = (clip.pitchMode ?? "preserve") === "preserve";
      const localTime = Math.max(0, timeline.playhead - clip.start);
      setPreviewGain(
        video,
        clip.id,
        clip.muted ? 0 : evaluateClipKeyframes(clip, localTime).volume * evaluateClipTransition(clip, localTime)
      );
      void previewAudioContextRef.current?.resume();
      video.volume = 1;
      video.muted = clip.muted;
      void video.play().catch(() => setError("Video audio preview was blocked by this browser. Press Play again to allow local audio preview."));
    }
    for (const clip of timeline.clips.filter(
      (item) => item.track < 0 && timeline.playhead >= item.start && timeline.playhead < item.start + clipLength(item)
    )) {
      const audio = audioRefs.current[clip.id];
      if (!audio) continue;
      audio.currentTime = clip.sourceStart + (timeline.playhead - clip.start) * clip.speed;
      const localTime = Math.max(0, timeline.playhead - clip.start);
      audio.playbackRate = clip.speed;
      audio.preservesPitch = (clip.pitchMode ?? "preserve") === "preserve";
      setPreviewGain(
        audio,
        clip.id,
        clip.muted ? 0 : evaluateClipKeyframes(clip, localTime).volume * evaluateClipTransition(clip, localTime)
      );
      void previewAudioContextRef.current?.resume();
      audio.volume = 1;
      audio.muted = clip.muted;
      void audio.play().catch(() => setError("Audio preview was blocked by this browser. Press Play again to allow local audio preview."));
    }
    setPlaying(true);
  }

  function openExportSettings() {
    setExportWidthDraft(String(timelineRef.current.width));
    setExportHeightDraft(String(timelineRef.current.height));
    setExportFrameRateDraft(String(timelineRef.current.fps));
    setExportOpen(true);
  }

  async function exportTimeline() {
    if (!timeline.clips.length || !timeline.duration || timeline.duration > 120) return;
    const frameRate = Number(exportFrameRateDraft);
    const videoRate = Number(videoBitrate);
    const audioRate = Number(audioBitrate);
    if (!Number.isFinite(frameRate) || frameRate < 12 || frameRate > 60) {
      setError("Enter a frame rate from 12 to 60 fps.");
      return;
    }
    if (!Number.isFinite(videoRate) || videoRate < 0.5 || videoRate > 40 || !Number.isFinite(audioRate) || audioRate < 64 || audioRate > 320) {
      setError("Video bitrate must be 0.5–40 Mbps and audio bitrate must be 64–320 kbps.");
      return;
    }
    setPlaying(false);
    setExporting(true);
    setExportProgress(0);
    setError("");
    setResultUrl("");
    cancelExportRef.current = false;
    let output: import("mediabunny").Output | undefined;
    let outputOverLimit = false;
    try {
      const {
        AudioBufferSource,
        BufferTarget,
        CanvasSource,
        Mp4OutputFormat,
        Output,
        Quality,
        WebMOutputFormat,
        canEncodeAudio,
        canEncodeVideo,
      } = await import("mediabunny");
      const width = Number(exportWidthDraft);
      const height = Number(exportHeightDraft);
      const { duration } = timeline;
      const fps = frameRate;
      if (!Number.isInteger(width) || width < 16 || width > 7680 || !Number.isInteger(height) || height < 16 || height > 4320) {
        throw new Error("Enter whole-number canvas dimensions from 16×16 up to 7680×4320 pixels.");
      }
      if (width * height > 4_000_000) {
        throw new Error("Timeline export is limited to 4 megapixels in this first browser renderer.");
      }
      if (timeline.width * timeline.height > 4_000_000) {
        throw new Error("The project canvas exceeds the 4-megapixel timeline renderer limit.");
      }
      const renderTimeline = {
        ...timeline,
        fps,
        clips: timeline.clips.map((clip) => (timeline.trackStates?.[clip.track]?.muted ? { ...clip, muted: true } : clip)),
      };
      const hasAudio = renderTimeline.clips.some(
        (clip) =>
          !clip.muted &&
          clip.volume > 0 &&
          (clip.track < 0 || timeline.assets.some((asset) => asset.id === clip.assetId && asset.kind === "video"))
      );
      const mp4Video = await canEncodeVideo("avc", { width, height, frameRate: fps, bitrate: videoRate * 1_000_000 });
      const mp4Audio = !hasAudio || (await canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: 48_000, bitrate: audioRate * 1_000 }));
      const webmCodec =
        mp4Video && mp4Audio
          ? null
          : (await canEncodeVideo("vp9", { width, height, frameRate: fps, bitrate: videoRate * 1_000_000 }))
            ? "vp9"
            : (await canEncodeVideo("vp8", { width, height, frameRate: fps, bitrate: videoRate * 1_000_000 }))
              ? "vp8"
              : null;
      const webmAudio = !hasAudio || (await canEncodeAudio("opus", { numberOfChannels: 2, sampleRate: 48_000, bitrate: audioRate * 1_000 }));
      const useMp4 = mp4Video && mp4Audio;
      if (!useMp4 && (!webmCodec || !webmAudio)) {
        throw new Error("This browser has no supported complete video/audio encoder combination for the current timeline.");
      }
      const codec = useMp4 ? "avc" : webmCodec!;
      const audioCodec = useMp4 ? "aac" : "opus";
      const audioBuffer = hasAudio
        ? await renderTimelineAudio(
            timeline.clips,
            timeline.assets,
            files,
            duration,
            (percent) => setExportProgress(10 + Math.round(percent * 0.3)),
            () => cancelExportRef.current
          )
        : null;
      if (hasAudio && !audioBuffer) throw new Error("Could not render timeline audio.");
      if (cancelExportRef.current) throw new Error("Export cancelled or exceeded the 512 MiB memory limit.");
      const target = new BufferTarget();
      let written = 0;
      target.on("write", ({ end }) => {
        written = Math.max(written, end);
        if (written > 512 * 1024 * 1024) {
          outputOverLimit = true;
          cancelExportRef.current = true;
        }
      });
      output = new Output({ format: useMp4 ? new Mp4OutputFormat() : new WebMOutputFormat(), target });
      cancelOutputRef.current = () => {
        if (output && output.state !== "canceled" && output.state !== "finalized") void output.cancel().catch(() => undefined);
      };
      const compositionCanvas = document.createElement("canvas");
      compositionCanvas.width = timeline.width;
      compositionCanvas.height = timeline.height;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const outputContext = canvas.getContext("2d");
      if (!outputContext) throw new Error("This browser cannot create an export canvas.");
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
        if (video.readyState < 2)
          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => {
              cleanup();
              reject(new Error("A video source did not decode a frame in time."));
            }, 15_000);
            const loaded = () => {
              cleanup();
              resolve();
            };
            const failed = () => {
              cleanup();
              reject(new Error("A video source could not be decoded for export."));
            };
            const cleanup = () => {
              clearTimeout(timeout);
              video.removeEventListener("loadeddata", loaded);
              video.removeEventListener("error", failed);
            };
            video.addEventListener("loadeddata", loaded, { once: true });
            video.addEventListener("error", failed, { once: true });
          });
        if (Math.abs(video.currentTime - time) < 0.005 && !video.seeking) return;
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error("Seeking a video frame timed out. Try a different source format."));
          }, 15_000);
          const seeked = () => {
            cleanup();
            resolve();
          };
          const failed = () => {
            cleanup();
            reject(new Error("A video source failed while seeking."));
          };
          const cleanup = () => {
            clearTimeout(timeout);
            video.removeEventListener("seeked", seeked);
            video.removeEventListener("error", failed);
          };
          video.addEventListener("seeked", seeked, { once: true });
          video.addEventListener("error", failed, { once: true });
          video.currentTime = time;
        });
      };
      for (let frame = 0; frame < frameCount; frame++) {
        if (cancelExportRef.current) {
          throw new Error(written > 512 * 1024 * 1024 ? "Export exceeded the 512 MiB in-memory output limit." : "Export cancelled.");
        }
        const timestamp = frame / fps;
        const activeVideos = timeline.clips.filter(
          (clip) =>
            clip.track >= 0 &&
            timeline.assets.some((asset) => asset.id === clip.assetId && asset.kind === "video") &&
            timestamp >= clip.start &&
            timestamp < clip.start + clipLength(clip)
        );
        await Promise.all(
          activeVideos.map((clip) => {
            const video = videoRefs.current[clip.id];
            if (!video) throw new Error("A timeline video source is missing from the media preview.");
            return seekVideo(video, clip.sourceStart + (timestamp - clip.start) * clip.speed);
          })
        );
        drawVideoComposition(
          compositionCanvas,
          renderTimeline,
          timestamp,
          { videos: videoRefs.current, images: imageRefs.current },
          renderTimeline.assets
        );
        outputContext.drawImage(compositionCanvas, 0, 0, width, height);
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
      else if (cancelExportRef.current || (cause instanceof Error && cause.message.toLowerCase().includes("cancel")))
        setStatus("Export cancelled. The project was left unchanged.");
      else setError(cause instanceof Error ? cause.message : "Timeline export failed.");
    } finally {
      cancelOutputRef.current = null;
      setExporting(false);
    }
  }

  const draggedBinAsset = binDragPreview && timeline.assets.find((asset) => asset.id === binDragPreview.id);
  const dragKind = draggedBinAsset ? (draggedBinAsset.kind === "audio" ? "audio" : "visual") : activeTrackDragKind;
  const visibleTracks = visibleTimelineTracks(timeline.clips, draggedBinAsset ? dragKind : null);
  const nextOverlayTrack = Math.max(0, ...timeline.clips.map((clip) => clip.track)) + 1;
  const nextAudioTrack = Math.min(0, ...timeline.clips.map((clip) => clip.track)) - 1;
  const overlayLaneCount = visibleTracks.filter((track) => track > 0).length;
  const audioLaneCount = visibleTracks.filter((track) => track < 0).length;

  return {
    projectId,
    projectTitle,
    setProjectTitle,
    timeline,
    setTimeline,
    files,
    setFiles,
    selected,
    setSelected,
    selectedClips,
    setSelectedClips,
    selectedClip,
    selectedAsset,
    selectedTransform,
    selectedValues,
    selectedImageGeometry,
    imageCrop,
    timelineMarquee,
    clipContextMenu,
    setClipContextMenu,
    copiedClipRef,
    hoveredClipId,
    setHoveredClipId,
    mainClipAtPlayhead,
    activeBinTab,
    setActiveBinTab,
    mediaFilter,
    setMediaFilter,
    mediaSort,
    setMediaSort,
    mediaSortDirection,
    setMediaSortDirection,
    visibleMediaAssets,
    mediaAssetCount,
    selectedBinIds,
    setSelectedBinIds,
    binSelectionAnchorRef,
    binPointerRef,
    binBodyRef,
    suppressBinClickRef,
    binMarquee,
    binDragPreview,
    draggedBinAsset,
    dragKind,
    visibleTracks,
    nextOverlayTrack,
    nextAudioTrack,
    overlayLaneCount,
    audioLaneCount,
    libraryTab,
    setLibraryTab,
    libraryBackgroundColor,
    setLibraryBackgroundColor,
    addLibraryColorBackground,
    addTitlePreset,
    editTitleAsset,
    captionSourceAssets,
    selectedCaptionIds,
    setSelectedCaptionIds,
    captionSelectionAnchorRef,
    importCaptionFiles,
    removeMediaAssets,
    removeCaptionFiles,
    placeCaptionBatch,
    selectCaptionAsset,
    shapeColor,
    setShapeColor,
    addShapeOverlay,
    transitionDuration,
    setTransitionDuration,
    createTransitionToNext,
    inspectorTab,
    setInspectorTab,
    hasTransformEdits,
    hasKeyframeAtPlayhead,
    exportOpen,
    setExportOpen,
    openExportSettings,
    exporting,
    exportProgress,
    exportTimeline,
    cancelExport: () => {
      cancelExportRef.current = true;
      cancelOutputRef.current?.();
    },
    exportWidthDraft,
    setExportWidthDraft,
    exportHeightDraft,
    setExportHeightDraft,
    exportFrameRateDraft,
    setExportFrameRateDraft,
    videoBitrate,
    setVideoBitrate,
    audioBitrate,
    setAudioBitrate,
    outputSettingsValid,
    resultUrl,
    resultType,
    shortcutsOpen,
    setShortcutsOpen,
    status,
    error,
    playing,
    setPlaying,
    togglePlayback,
    stepFrame,
    mediaRevision,
    setMediaRevision,
    waveforms,
    ready,
    zoom,
    setZoom,
    pxPerSecond,
    timelineViewportWidth,
    timelineScrollRef,
    rulerHoverGuide,
    setRulerHoverGuide,
    showRulerHoverGuide,
    seekTimeline,
    snapEnabled,
    setSnapEnabled,
    snapThreshold,
    setSnapThreshold,
    dropPreview,
    setDropPreview,
    activeTrackDragKind,
    setActiveTrackDragKind,
    draggingRef,
    ripplePrimaryTrack,
    setRipplePrimaryTrack,
    replacementAudioAssetId,
    setReplacementAudioAssetId,
    availableAudioAssets,
    selectedReplacementAudioAssetId,
    replacementAudioOffset,
    setReplacementAudioOffset,
    replaceVideoAudio,
    extractingAudio,
    extractProgress,
    detachVideoAudio,
    cancelAudioExtraction,
    widthDraft,
    setWidthDraft,
    heightDraft,
    setHeightDraft,
    frameRateDraft,
    setFrameRateDraft,
    commitCustomCanvas,
    selectAspectRatio,
    canvasRef,
    stageRef,
    viewportRef,
    previewRef,
    previewPan,
    previewZoom,
    previewZoomDraft,
    setPreviewZoomDraft,
    setPreviewZoomValue,
    previewSnapGuides,
    previewOverlays,
    previewAsset,
    playerExpanded,
    toggleFullscreen,
    videoRefs,
    audioRefs,
    imageRefs,
    historyRef,
    historyVersion,
    applyTimelineEdit,
    undo,
    redo,
    duplicateClip,
    copyClip,
    pasteClip,
    freezeFrameClip,
    fitTimelineZoom,
    removeClip,
    splitSelected,
    deleteHoveredSide,
    editClip,
    anchorReason,
    patchSelectedTransform,
    patchSelectedTransitions,
    patchSelectedStart,
    patchSelectedSpeed,
    patchSelectedVolume,
    patchSelectedDuration,
    toggleKeyframeAtPlayhead,
    alignSelectedVisual,
    setSelectedImageSize,
    setSelectedImageCrop,
    resetSelectedImageCrop,
    patchSelectedEffects,
    addOrUpdateKeyframe,
    removeKeyframeAtPlayhead,
    beginStagePan,
    moveStagePan,
    finishStagePan,
    beginTextGesture,
    moveTextGesture,
    finishTextGesture,
    beginImageGesture,
    moveImageGesture,
    finishImageGesture,
    beginTrim,
    moveTrim,
    finishTrim,
    selectTimelineClip,
    beginTimelineMarquee,
    moveTimelineMarquee,
    finishTimelineMarquee,
    cancelTimelineMarquee,
    justSeekedRef,
    suppressTimelineClickRef,
    playheadDragRef,
    movePlayhead,
    finishPlayheadDrag,
    previewTrackDrop,
    finishTrackDrop,
    toggleTrackState,
    createVideoProject,
    importFiles,
    selectBinAsset,
    placeMediaBatch,
    moveBinPointer,
    finishBinPointer,
    cancelBinPointer,
    beginBinMarquee,
    moveBinMarquee,
    finishBinMarquee,
    cancelBinMarquee,
    assetUrls,
  };
}

export function VideoStudioProvider({ children }: { children: ReactNode }) {
  const value = useVideoStudioState();
  return <VideoStudioContext.Provider value={value}>{children}</VideoStudioContext.Provider>;
}

export function useVideoStudio() {
  const context = useContext(VideoStudioContext);
  if (!context) throw new Error("useVideoStudio must be used within a VideoStudioProvider");
  return context;
}
