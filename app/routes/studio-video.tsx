import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/studio-video";
import { getProject, readVideoAsset, saveVideoTimeline, type VideoTimelineAsset, type VideoTimelineClip, type VideoTimelineProject } from "../lib/project-store";
import { drawVideoComposition, getClipLength } from "../lib/video-composition";
import { evaluateClipKeyframes, evaluateClipTransition, upsertClipKeyframe } from "../lib/video-keyframes";
import { renderTimelineAudio } from "../lib/audio-timeline-render";
import wasmUrl from "bungee-web/bungee.wasm?url";

const EMPTY: VideoTimelineProject = { version: 1, width: 1920, height: 1080, fps: 30, duration: 0, playhead: 0, assets: [], clips: [] };
const MAX_ASSET_BYTES = 256 * 1024 * 1024;
const IDENTITY_TRANSFORM = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };

export function meta({}: Route.MetaArgs) { return [{ title: "Video Studio | Local Studio" }, { name: "robots", content: "noindex,nofollow" }]; }

const clipLength = getClipLength;

export default function VideoStudio() {
  const [params] = useSearchParams();
  const projectId = params.get("project") ?? "";
  const [timeline, setTimeline] = useState<VideoTimelineProject>(EMPTY);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("Create a video project from Projects, or import files to begin.");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [mediaRevision, setMediaRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState("60");
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
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const imageRefs = useRef<Record<string, HTMLImageElement>>({});
  const timelineRef = useRef(timeline);
  const drawFrameRef = useRef<(time?: number) => void>(() => undefined);
  const historyRef = useRef({ past: [] as VideoTimelineProject[], future: [] as VideoTimelineProject[] });
  const [historyVersion, setHistoryVersion] = useState(0);
  timelineRef.current = timeline;
  const selectedClip = timeline.clips.find((clip) => clip.id === selected);
  const selectedAsset = selectedClip && timeline.assets.find((asset) => asset.id === selectedClip.assetId);
  const selectedValues = selectedClip ? evaluateClipKeyframes(selectedClip, Math.max(0, timeline.playhead - selectedClip.start)) : null;
  const selectedTransform = selectedValues?.transform ?? IDENTITY_TRANSFORM;
  const sourceFile = selectedClip ? files[selectedClip.assetId] : undefined;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (!projectId) { setError("Open a video workspace from Projects to save the timeline."); return; }
    void (async () => {
      try {
        const project = await getProject(projectId);
        if (!project || project.kind !== "video") throw new Error("This video workspace is missing or has the wrong project type.");
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
      if (Math.abs(video.currentTime - expected) > 0.35) video.currentTime = expected;
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
      audio.playbackRate = clip.speed; audio.preservesPitch = true;
      const localTime = Math.max(0, current.playhead - clip.start);
      audio.volume = Math.max(0, Math.min(1, evaluateClipKeyframes(clip, localTime).volume * evaluateClipTransition(clip, localTime))); audio.muted = clip.muted;
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
  }, [playing, exporting, timeline.width, timeline.height, timeline.assets, files, mediaRevision]);
  useEffect(() => { if (!playing) drawFrameRef.current(); }, [timeline.playhead, playing]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const timer = window.setInterval(() => { const now = performance.now(); const delta = Math.min((now - last) / 1000, 0.25); last = now; setTimeline((current) => ({ ...current, playhead: current.duration > 0 && current.playhead >= current.duration ? 0 : current.playhead + delta })); }, 100);
    return () => window.clearInterval(timer);
  }, [playing]);

  async function importFiles(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    const assets: VideoTimelineAsset[] = [];
    const nextFiles: Record<string, File> = {};
    const addedClips: VideoTimelineClip[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_ASSET_BYTES) { setError(`${file.name} is over the 256 MiB per-file limit.`); continue; }
      const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("image/") ? "image" : null;
      if (!kind) { setError(`${file.name} is not a supported video, audio, or image file.`); continue; }
      const id = crypto.randomUUID(); let duration = 0;
      if (kind === "image") duration = 3600;
      else duration = await new Promise<number>((resolve) => {
        const element = document.createElement(kind);
        const url = URL.createObjectURL(file);
        element.onloadedmetadata = () => { const value = Number.isFinite(element.duration) ? element.duration : 0; URL.revokeObjectURL(url); resolve(value); };
        element.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
        element.src = url;
      });
      if (!duration) { setError(`Could not read a usable duration for ${file.name}.`); continue; }
      const asset = { id, name: file.name, type: file.type, size: file.size, duration, kind } satisfies VideoTimelineAsset;
      if ([...timeline.assets, ...assets].reduce((total, item) => total + item.size, file.size) > 512 * 1024 * 1024) { setError("The total local media limit for this prototype is 512 MiB per project."); continue; }
      assets.push(asset); nextFiles[id] = file;
      const track = kind === "audio" ? -1 : 0;
      const clipDuration = kind === "image" ? 5 : duration;
      const start = Math.max(timeline.duration, ...addedClips.filter((clip) => clip.track === track).map((clip) => clip.start + clipLength(clip)), 0);
      addedClips.push({ id: crypto.randomUUID(), assetId: id, track, start, sourceStart: 0, sourceEnd: clipDuration, speed: 1, volume: 1, muted: false });
    }
    const updated = { ...timeline, assets: [...timeline.assets, ...assets], clips: [...timeline.clips, ...addedClips], duration: Math.max(timeline.duration, ...addedClips.map((clip) => clip.start + clipLength(clip)), 0) };
    try {
      await saveVideoTimeline(projectId, updated, assets.map((asset) => ({ id: asset.id, file: nextFiles[asset.id] })));
      setFiles((current) => ({ ...current, ...nextFiles })); applyTimelineEdit(() => updated); setSelected(addedClips[0]?.id ?? selected);
      setStatus(`${assets.length} media item(s) added and saved locally.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save imported media in this browser."); }
  }

  function editClip(id: string, patch: Partial<VideoTimelineClip>) {
    applyTimelineEdit((current) => {
      const clips = current.clips.map((clip) => {
        if (clip.id !== id) return clip;
        const updated = { ...clip, ...patch };
        if (clip.keyframes?.length && (patch.transform || patch.volume !== undefined)) {
          const time = Math.max(0, Math.min(clipLength(clip), timeline.playhead - clip.start));
          const values = evaluateClipKeyframes(clip, time);
          updated.keyframes = upsertClipKeyframe(clip, { time, transform: patch.transform ?? values.transform, volume: patch.volume ?? values.volume });
        }
        return updated;
      });
      return { ...current, clips, duration: Math.max(0, ...clips.map((clip) => clip.start + clipLength(clip))) };
    });
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
      const audioClip: VideoTimelineClip = { id: crypto.randomUUID(), assetId: audioId, track: -1, start: selectedClip.start, sourceStart: selectedClip.sourceStart, sourceEnd, speed: selectedClip.speed, volume: selectedClip.volume, muted: false };
      const current = timelineRef.current;
      const updated = { ...current, assets: [...current.assets, audioAsset], clips: [...current.clips, audioClip], duration: Math.max(current.duration, audioClip.start + clipLength(audioClip)) };
      await saveVideoTimeline(projectId, updated, [{ id: audioId, file: audioFile }]);
      setFiles((previous) => ({ ...previous, [audioId]: audioFile }));
      applyTimelineEdit(() => updated); setSelected(audioClip.id); setStatus("Source audio detached into Audio 1 as a local editable WAV clip.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not detach the video's audio track."); }
    finally { audioConversionRef.current = null; setExtractingAudio(false); setExtractProgress(0); }
  }
  async function cancelAudioExtraction() {
    if (audioConversionRef.current) await audioConversionRef.current.cancel().catch(() => undefined);
  }
  function removeKeyframeAtPlayhead() {
    if (!selectedClip?.keyframes?.length) return;
    const time = Math.max(0, Math.min(clipLength(selectedClip), timeline.playhead - selectedClip.start));
    editClip(selectedClip.id, { keyframes: selectedClip.keyframes.filter((frame) => Math.abs(frame.time - time) >= 0.05) });
  }
  function addTitle() {
    const asset: VideoTimelineAsset = { id: crypto.randomUUID(), name: "Text title", type: "text/plain", size: 0, duration: 3600, kind: "text", textSettings: { text: "Your title", fontSize: 72, color: "#ffffff", backgroundColor: "#172033", showBackground: false } };
    const clip: VideoTimelineClip = { id: crypto.randomUUID(), assetId: asset.id, track: 2, start: timeline.playhead, sourceStart: 0, sourceEnd: 5, speed: 1, volume: 1, muted: false };
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
    if (!selectedClip) return;
    const cut = timeline.playhead;
    if (cut <= selectedClip.start || cut >= selectedClip.start + clipLength(selectedClip)) { setError("Move the playhead inside the selected clip to split it."); return; }
    const sourceCut = selectedClip.sourceStart + (cut - selectedClip.start) * selectedClip.speed;
    const right = { ...selectedClip, id: crypto.randomUUID(), start: cut, sourceStart: sourceCut };
    applyTimelineEdit((current) => ({ ...current, clips: [...current.clips.map((clip) => clip.id === selectedClip.id ? { ...clip, sourceEnd: sourceCut } : clip), right] })); setSelected(right.id); setError("");
  }
  const pxPerSecond = Math.max(12, Math.min(160, Number(zoom) || 60));
  const outputSettingsValid = Number.isInteger(Number(widthDraft)) && Number(widthDraft) >= 16 && Number(widthDraft) <= 7680
    && Number.isInteger(Number(heightDraft)) && Number(heightDraft) >= 16 && Number(heightDraft) <= 4320
    && Number(widthDraft) * Number(heightDraft) <= 4_000_000
    && Number(frameRateDraft) >= 12 && Number(frameRateDraft) <= 60
    && Number(videoBitrate) >= 0.5 && Number(videoBitrate) <= 40
    && (!timeline.clips.some((clip) => clip.track < 0 && !clip.muted && clip.volume > 0) || (Number(audioBitrate) >= 64 && Number(audioBitrate) <= 320));

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
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      event.preventDefault(); if (event.shiftKey) redo(); else undo();
    }
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  });

  function togglePlayback() {
    if (playing) { setPlaying(false); return; }
    setError("");
    for (const clip of timeline.clips.filter((item) => item.track < 0 && timeline.playhead >= item.start && timeline.playhead < item.start + clipLength(item))) {
      const audio = audioRefs.current[clip.id];
      if (!audio) continue;
      audio.currentTime = clip.sourceStart + (timeline.playhead - clip.start) * clip.speed;
      const localTime = Math.max(0, timeline.playhead - clip.start);
      audio.playbackRate = clip.speed; audio.preservesPitch = true; audio.volume = Math.max(0, Math.min(1, evaluateClipKeyframes(clip, localTime).volume * evaluateClipTransition(clip, localTime))); audio.muted = clip.muted;
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
      const hasAudio = timeline.clips.some((clip) => clip.track < 0 && !clip.muted && clip.volume > 0);
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

  return <main className="video-studio-page">
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav><a href="/projects">Projects</a></nav><span role="status">{status}</span></header>
    <div className="video-studio-top"><section><p className="eyebrow">LOCAL VIDEO STUDIO · TIMELINE FOUNDATION</p><h1>Video Studio</h1><p>Arrange local video, image, and audio clips on independent tracks. Project edits and imported assets stay in this browser.</p></section><label className="file-picker"><span>{projectId ? "Import video, audio, or images" : "Open a project to import media"}<input type="file" multiple accept="video/*,audio/*,image/*" disabled={!projectId || exporting} onChange={(event) => void importFiles(event.currentTarget.files)} /></span></label></div>
    {error && <p className="resize-error" role="alert">{error}</p>}
    {extractingAudio && <p className="source-info" role="status">Detaching source audio: {extractProgress}% <button className="editor-action danger" onClick={() => void cancelAudioExtraction()}>Cancel</button></p>}
    <section className="video-editor-layout" inert={exporting || extractingAudio}>
      <aside className="video-bin"><div className="preview-heading"><strong>Media bin</strong><span>{timeline.assets.length} items</span></div>{timeline.assets.map((asset) => <button key={asset.id} className="bin-item" onClick={() => setSelected(timeline.clips.find((clip) => clip.assetId === asset.id)?.id ?? "")}><strong>{asset.name}</strong><small>{asset.kind} · {asset.duration.toFixed(2)} s · {(asset.size / 1048576).toFixed(1)} MiB</small></button>)}{!timeline.assets.length && <p className="resize-note">Import media to build your timeline.</p>}</aside>
      <section className="editor-preview"><div className="preview-heading"><strong>Composite preview</strong><span>{previewAsset?.name ?? "Nothing at playhead"} · {timeline.playhead.toFixed(2)} s · {timeline.width}×{timeline.height}</span></div><div className="editor-stage"><canvas ref={canvasRef} aria-label="Composited video timeline preview" /><div className="media-sources" aria-hidden="true">{timeline.assets.filter((asset) => asset.kind === "image").map((asset) => <img key={asset.id} ref={(el) => { if (el) imageRefs.current[asset.id] = el; else delete imageRefs.current[asset.id]; }} src={assetUrls[asset.id]} alt="" onLoad={() => setMediaRevision((n) => n + 1)} />)}{timeline.clips.filter((clip) => timeline.assets.find((asset) => asset.id === clip.assetId)?.kind === "video").map((clip) => <video key={clip.id} ref={(el) => { if (el) videoRefs.current[clip.id] = el; else delete videoRefs.current[clip.id]; }} src={assetUrls[clip.assetId]} muted playsInline preload="auto" onLoadedData={() => setMediaRevision((n) => n + 1)} />)}{timeline.clips.filter((clip) => clip.track < 0).map((clip) => <audio key={clip.id} ref={(el) => { if (el) audioRefs.current[clip.id] = el; else delete audioRefs.current[clip.id]; }} src={assetUrls[clip.assetId]} preload="auto" />)}</div></div><div className="editor-transport"><button onClick={togglePlayback}>{playing ? "Pause" : "Play"}</button><button onClick={() => setTimeline((current) => ({ ...current, playhead: 0 }))}>Start</button><label>Playhead (s)<input type="number" min="0" max={timeline.duration} step="any" value={timeline.playhead.toFixed(2)} onChange={(event) => setTimeline((current) => ({ ...current, playhead: Math.max(0, Math.min(current.duration, Number(event.currentTarget.value) || 0)) }))} /></label></div></section>
      <aside className="video-inspector">
        <div className="preview-heading"><strong>Inspector</strong><span>{selectedClip ? "Selected clip" : "No selection"}</span></div>
        {selectedClip && <>
          <label className="speed-field">Track <span>video 0-2; audio -1 to -3</span><input type="number" min="-3" max="2" step="1" value={selectedClip.track} onChange={(event) => editClip(selectedClip.id, { track: Math.max(-3, Math.min(2, Math.round(Number(event.currentTarget.value)))) })} /></label>
          <label className="speed-field">Timeline start <span>seconds</span><input type="number" min="0" step="any" value={selectedClip.start} onChange={(event) => editClip(selectedClip.id, { start: Math.max(0, Number(event.currentTarget.value) || 0) })} /></label>
          <label className="speed-field">Source in <span>seconds</span><input type="number" min="0" max={selectedAsset?.duration} step="any" value={selectedClip.sourceStart} onChange={(event) => editClip(selectedClip.id, { sourceStart: Math.max(0, Math.min(selectedClip.sourceEnd - 0.01, Number(event.currentTarget.value) || 0)) })} /></label>
          <label className="speed-field">Source out <span>seconds</span><input type="number" min="0.01" max={selectedAsset?.duration} step="any" value={selectedClip.sourceEnd} onChange={(event) => editClip(selectedClip.id, { sourceEnd: Math.min(selectedAsset?.duration ?? selectedClip.sourceEnd, Math.max(selectedClip.sourceStart + 0.01, Number(event.currentTarget.value) || 0)) })} /></label>
          <label className="speed-field">Speed <span>custom 0.1-16x</span><input type="number" min="0.1" max="16" step="any" value={selectedClip.speed} onChange={(event) => editClip(selectedClip.id, { speed: Math.max(0.1, Math.min(16, Number(event.currentTarget.value) || 1)) })} /></label>
          <label className="speed-field">Volume <span>custom 0-1x</span><input type="number" min="0" max="1" step="any" value={selectedValues?.volume ?? selectedClip.volume} onChange={(event) => editClip(selectedClip.id, { volume: Math.max(0, Math.min(1, Number(event.currentTarget.value) || 0)) })} /></label>
          {selectedAsset?.kind === "video" && <button className="secondary-button editor-action" disabled={extractingAudio} onClick={() => void detachVideoAudio()}>Detach source audio to Audio 1</button>}
          <button className="secondary-button editor-action" onClick={addOrUpdateKeyframe}>Add/update keyframe at playhead</button>
          {selectedClip.keyframes?.some((frame) => Math.abs(frame.time - Math.max(0, Math.min(clipLength(selectedClip), timeline.playhead - selectedClip.start))) < 0.05) && <button className="editor-action" onClick={removeKeyframeAtPlayhead}>Remove keyframe at playhead</button>}
          <p className="resize-note">{selectedClip.keyframes?.length ?? 0} keyframe(s). Values interpolate linearly between keys in clip-relative seconds.</p>
          {selectedAsset?.kind === "text" && selectedAsset.textSettings && <div className="title-inspector">
            <label className="ratio-field">Title text<textarea rows={3} maxLength={500} value={selectedAsset.textSettings.text} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, text: event.currentTarget.value })} /></label>
            <label className="speed-field">Font size <span>custom 8-512 px</span><input type="number" min="8" max="512" step="any" value={selectedAsset.textSettings.fontSize} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, fontSize: Math.max(8, Math.min(512, Number(event.currentTarget.value) || 72)) })} /></label>
            <div className="filter-fields two-column"><label>Text color <input type="color" value={selectedAsset.textSettings.color} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, color: event.currentTarget.value })} /></label><label>Background <input type="color" value={selectedAsset.textSettings.backgroundColor} disabled={!selectedAsset.textSettings.showBackground} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, backgroundColor: event.currentTarget.value })} /></label></div>
            <label className="ratio-toggle"><input type="checkbox" checked={selectedAsset.textSettings.showBackground} onChange={(event) => editTitleAsset(selectedAsset.id, { ...selectedAsset.textSettings!, showBackground: event.currentTarget.checked })} />Show title background</label>
          </div>}
          <div className="filter-fields two-column transform-fields">
            <label>Fade in <span>custom seconds</span><input type="number" min="0" max={clipLength(selectedClip)} step="any" value={selectedClip.transitions?.fadeIn ?? 0} onChange={(event) => editClip(selectedClip.id, { transitions: { fadeIn: Math.max(0, Math.min(clipLength(selectedClip), Number(event.currentTarget.value) || 0)), fadeOut: selectedClip.transitions?.fadeOut ?? 0 } })} /></label>
            <label>Fade out <span>custom seconds</span><input type="number" min="0" max={clipLength(selectedClip)} step="any" value={selectedClip.transitions?.fadeOut ?? 0} onChange={(event) => editClip(selectedClip.id, { transitions: { fadeIn: selectedClip.transitions?.fadeIn ?? 0, fadeOut: Math.max(0, Math.min(clipLength(selectedClip), Number(event.currentTarget.value) || 0)) } })} /></label>
          </div>
          {selectedClip.track >= 0 && selectedAsset?.kind !== "text" && <div className="filter-fields two-column transform-fields">
            <label>Brightness <span>custom percent</span><input type="number" min="0" max="300" step="any" value={selectedClip.effects?.brightness ?? 100} onChange={(event) => editClip(selectedClip.id, { effects: { brightness: Math.max(0, Math.min(300, Number(event.currentTarget.value) || 0)), contrast: selectedClip.effects?.contrast ?? 100, saturation: selectedClip.effects?.saturation ?? 100, grayscale: selectedClip.effects?.grayscale ?? 0 } })} /></label>
            <label>Contrast <span>custom percent</span><input type="number" min="0" max="300" step="any" value={selectedClip.effects?.contrast ?? 100} onChange={(event) => editClip(selectedClip.id, { effects: { brightness: selectedClip.effects?.brightness ?? 100, contrast: Math.max(0, Math.min(300, Number(event.currentTarget.value) || 0)), saturation: selectedClip.effects?.saturation ?? 100, grayscale: selectedClip.effects?.grayscale ?? 0 } })} /></label>
            <label>Saturation <span>custom percent</span><input type="number" min="0" max="300" step="any" value={selectedClip.effects?.saturation ?? 100} onChange={(event) => editClip(selectedClip.id, { effects: { brightness: selectedClip.effects?.brightness ?? 100, contrast: selectedClip.effects?.contrast ?? 100, saturation: Math.max(0, Math.min(300, Number(event.currentTarget.value) || 0)), grayscale: selectedClip.effects?.grayscale ?? 0 } })} /></label>
            <label>Grayscale <span>custom percent</span><input type="number" min="0" max="100" step="any" value={selectedClip.effects?.grayscale ?? 0} onChange={(event) => editClip(selectedClip.id, { effects: { brightness: selectedClip.effects?.brightness ?? 100, contrast: selectedClip.effects?.contrast ?? 100, saturation: selectedClip.effects?.saturation ?? 100, grayscale: Math.max(0, Math.min(100, Number(event.currentTarget.value) || 0)) } })} /></label>
          </div>}
          {selectedClip.track >= 0 && <div className="filter-fields two-column transform-fields">
            <label>Position X <span>custom px</span><input type="number" step="any" value={selectedTransform.x} onChange={(event) => editClip(selectedClip.id, { transform: { ...selectedTransform, x: Number(event.currentTarget.value) || 0 } })} /></label>
            <label>Position Y <span>custom px</span><input type="number" step="any" value={selectedTransform.y} onChange={(event) => editClip(selectedClip.id, { transform: { ...selectedTransform, y: Number(event.currentTarget.value) || 0 } })} /></label>
            <label>Scale <span>custom 0.1-8x</span><input type="number" min="0.1" max="8" step="any" value={selectedTransform.scale} onChange={(event) => editClip(selectedClip.id, { transform: { ...selectedTransform, scale: Math.max(0.1, Math.min(8, Number(event.currentTarget.value) || 1)) } })} /></label>
            <label>Rotation <span>custom degrees</span><input type="number" min="-180" max="180" step="any" value={selectedTransform.rotation} onChange={(event) => editClip(selectedClip.id, { transform: { ...selectedTransform, rotation: Math.max(-180, Math.min(180, Number(event.currentTarget.value) || 0)) } })} /></label>
            <label>Opacity <span>custom percent</span><input type="number" min="0" max="100" step="any" value={selectedTransform.opacity * 100} onChange={(event) => editClip(selectedClip.id, { transform: { ...selectedTransform, opacity: Math.max(0, Math.min(1, (Number(event.currentTarget.value) || 0) / 100)) } })} /></label>
          </div>}
          <label className="ratio-toggle"><input type="checkbox" checked={selectedClip.muted} onChange={(event) => editClip(selectedClip.id, { muted: event.currentTarget.checked })} />Mute clip</label>
          <button className="secondary-button editor-action" onClick={splitSelected}>Split at playhead</button><button className="editor-action" onClick={() => duplicateClip(selectedClip.id)}>Duplicate clip</button><button className="editor-action danger" onClick={() => removeClip(selectedClip.id)}>Delete clip</button>
        </>}
      </aside>
    </section>
    <section className="video-export-panel">
      <div className="resize-controls">
        <h2>Render your timeline</h2>
        <div className="filter-fields"><label>Canvas width <span>custom px</span><input type="number" min="16" max="7680" value={widthDraft} disabled={exporting} onChange={(event) => setWidthDraft(event.currentTarget.value)} onBlur={() => { const value = Number(widthDraft); if (Number.isInteger(value) && value >= 16 && value <= 7680) applyTimelineEdit((current) => ({ ...current, width: value })); }} /></label><label>Canvas height <span>custom px</span><input type="number" min="16" max="4320" value={heightDraft} disabled={exporting} onChange={(event) => setHeightDraft(event.currentTarget.value)} onBlur={() => { const value = Number(heightDraft); if (Number.isInteger(value) && value >= 16 && value <= 4320) applyTimelineEdit((current) => ({ ...current, height: value })); }} /></label></div>
        <div className="filter-fields"><label>Frame rate <span>custom · 12–60 fps</span><input type="number" min="12" max="60" step="any" value={frameRateDraft} disabled={exporting} onChange={(event) => setFrameRateDraft(event.currentTarget.value)} onBlur={() => { const value = Number(frameRateDraft); if (Number.isFinite(value) && value >= 12 && value <= 60) applyTimelineEdit((current) => ({ ...current, fps: value })); }} /></label><label>Video bitrate <span>custom · Mbps</span><input type="number" min="0.5" max="40" step="any" value={videoBitrate} disabled={exporting} onChange={(event) => setVideoBitrate(event.currentTarget.value)} /></label></div>
        {timeline.clips.some((clip) => clip.track < 0) && <label className="speed-field">Audio bitrate <span>custom · 64–320 kbps</span><input type="number" min="64" max="320" step="any" value={audioBitrate} disabled={exporting} onChange={(event) => setAudioBitrate(event.currentTarget.value)} /></label>}
        <p className="resize-note">The renderer chooses MP4 or WebM after checking this browser’s video and audio encoders. First renderer limits: 120 seconds, 4 megapixels per frame, 180 seconds of source audio, and 512 MiB output. Export is local and may run slower than playback. Video files’ embedded audio is omitted; add soundtrack clips on an audio lane.</p>
        {timeline.width * timeline.height > 4_000_000 && <p className="resize-error" role="alert">Choose canvas dimensions under 4 megapixels for this first export renderer.</p>}
        {exporting && <><p className="source-info" role="status">Rendering local timeline: {exportProgress}%</p><progress max="100" value={exportProgress} aria-label="Timeline export progress" /><button className="editor-action danger" onClick={() => { cancelExportRef.current = true; cancelOutputRef.current?.(); }}>Cancel export</button></>}
        {!outputSettingsValid && <p className="resize-error" role="alert">Enter valid dimensions, frame rate, and bitrates within the displayed ranges.</p>}
        <button className="export-button" disabled={!timeline.clips.length || !timeline.duration || timeline.duration > 120 || !outputSettingsValid || exporting} onClick={() => void exportTimeline()}>{exporting ? "Rendering…" : "Render and export video"}</button>
        {timeline.duration > 120 && <p className="resize-error" role="alert">Trim the timeline to 120 seconds or less for this export prototype.</p>}
        {resultUrl && <a className="export-button download-link" href={resultUrl} download={`local-studio-edit.${resultType === "video/mp4" ? "mp4" : "webm"}`}>Download {resultType === "video/mp4" ? "MP4" : "WebM"}</a>}
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>Export preview</strong><span>{resultUrl ? "Rendered file" : "Export keeps your editable project"}</span></div>{resultUrl ? <video className="video-preview" controls src={resultUrl} /> : <div className="empty-preview">Render a project to get a playable file.</div>}</div>
    </section>    <section className="video-timeline" inert={exporting}><div className="timeline-toolbar"><strong>Timeline · {timeline.duration.toFixed(2)} seconds</strong><div className="timeline-actions" data-history-version={historyVersion}><button disabled={!historyRef.current.past.length} onClick={undo}>Undo</button><button disabled={!historyRef.current.future.length} onClick={redo}>Redo</button><label>Zoom<input type="number" min="12" max="160" value={zoom} onChange={(event) => setZoom(event.currentTarget.value)} />px/s</label></div></div><div className="timeline-scroll"><div className="timeline-ruler" style={{ width: Math.max(800, timeline.duration * pxPerSecond) }} onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); setTimeline((current) => ({ ...current, playhead: Math.max(0, Math.min(current.duration, (event.clientX - bounds.left + event.currentTarget.scrollLeft) / pxPerSecond)) })); }}>{Array.from({ length: Math.ceil(timeline.duration) + 1 }, (_, second) => <span key={second} style={{ left: second * pxPerSecond }}>{second}s</span>)}</div>{[2, 1, 0, -1, -2, -3].map((track) => <div className="timeline-track" key={track}><strong>{track >= 0 ? `Video ${track + 1}` : `Audio ${-track}`}</strong><div className="track-lane" style={{ width: Math.max(800, timeline.duration * pxPerSecond) }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/clip"); const rect = event.currentTarget.getBoundingClientRect(); editClip(id, { track, start: Math.max(0, (event.clientX - rect.left + event.currentTarget.scrollLeft) / pxPerSecond) }); }} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setTimeline((current) => ({ ...current, playhead: Math.max(0, Math.min(current.duration, (event.clientX - rect.left + event.currentTarget.scrollLeft) / pxPerSecond)) })); }}>{timeline.clips.filter((clip) => clip.track === track).map((clip) => { const asset = timeline.assets.find((item) => item.id === clip.assetId); return <button draggable key={clip.id} className={`timeline-clip ${selected === clip.id ? "selected" : ""} ${asset?.kind ?? ""}`} style={{ left: clip.start * pxPerSecond, width: Math.max(22, clipLength(clip) * pxPerSecond) }} onDragStart={(event) => event.dataTransfer.setData("text/clip", clip.id)} onClick={(event) => { event.stopPropagation(); setSelected(clip.id); }}><strong>{asset?.name}</strong><small>{clipLength(clip).toFixed(2)}s · {clip.speed}×</small>{clip.keyframes?.map((frame, index) => <span key={`${clip.id}-key-${index}`} className="timeline-keyframe" aria-hidden="true" style={{ left: `${Math.max(0, Math.min(100, frame.time / Math.max(clipLength(clip), 0.001) * 100))}%` }} />)}</button>; })}</div></div>)}<div className="timeline-playhead" style={{ left: 104 + timeline.playhead * pxPerSecond }} /> </div></section>
    <p className="resize-note editor-disclaimer">Timeline preview composites active visual clips from bottom to top, including per-clip transforms, text titles, and custom linear fade transitions. Audio lanes play in sync with the project clock. Timeline render/export is available in supported browsers; verify output playback for your media and device.</p>
  </main>;
}
