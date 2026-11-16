import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/video-trim";
import { MediaImportScreen } from "../components/media-import-screen";
import { ProcessingProgress } from "../components/processing-progress";
import { CustomMediaPreview } from "../components/custom-media-preview";

const MAX_INPUT_BYTES = 512 * 1024 * 1024;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Trim video | Local Studio" },
    { name: "description", content: "Trim a local video and export an MP4 in your browser." },
  ];
}

export default function VideoTrim() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trimTimelineRef = useRef<HTMLDivElement>(null);
  const stopAtRef = useRef<number | null>(null);
  const playbackRaf = useRef<number | null>(null);
  const playheadGesture = useRef<number | null>(null);
  const timelineGesture = useRef<{ pointerId: number; mode: "start" | "end" | "move" | "create"; anchor: number; start: number; end: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState("0.000");
  const [end, setEnd] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [resultName, setResultName] = useState("");
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);
  useEffect(() => { setResultUrl(""); setResultName(""); }, [start, end]);
  useEffect(() => () => { if (playbackRaf.current !== null) cancelAnimationFrame(playbackRaf.current); }, []);

  function selectFile(next: File | undefined) {
    setError(""); setProgress(null); setDuration(0); setEnd(""); setPlayhead(0); setPlaying(false);
    setFile(next ?? null);
    setSourceUrl(next ? URL.createObjectURL(next) : "");
    setResultUrl(""); setResultName("");
    if (next && next.size > MAX_INPUT_BYTES) setError("This prototype accepts files up to 512 MiB to limit browser memory use.");
  }

  const from = Number(start), to = Number(end || duration);
  const precise = (value: number) => (Math.round(value * 1000) / 1000).toFixed(3);
  function timeFromTimeline(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(duration, (event.clientX - bounds.left) / bounds.width * duration));
  }
  function timeAtClientX(clientX: number) {
    const bounds = trimTimelineRef.current?.getBoundingClientRect();
    return bounds && duration ? Math.max(0, Math.min(duration, (clientX - bounds.left) / bounds.width * duration)) : 0;
  }
  function beginTimeline(event: React.PointerEvent<HTMLDivElement>) {
    if (!duration || progress !== null) return;
    const value = timeFromTimeline(event), tolerance = duration * 14 / Math.max(1, event.currentTarget.clientWidth);
    const mode = Math.abs(value - from) <= tolerance ? "start" : Math.abs(value - to) <= tolerance ? "end" : value > from && value < to ? "move" : "create";
    timelineGesture.current = { pointerId: event.pointerId, mode, anchor: value, start: from, end: to };
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function moveTimeline(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = timelineGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !duration) return;
    const value = timeFromTimeline(event), minLength = Math.min(.01, duration);
    if (gesture.mode === "start") setStart(precise(Math.max(0, Math.min(to - minLength, value))));
    else if (gesture.mode === "end") setEnd(precise(Math.max(from + minLength, Math.min(duration, value))));
    else if (gesture.mode === "create") { setStart(precise(Math.min(gesture.anchor, value))); setEnd(precise(Math.max(gesture.anchor + minLength, value))); }
    else {
      const length = gesture.end - gesture.start, nextStart = Math.max(0, Math.min(duration - length, gesture.start + value - gesture.anchor));
      setStart(precise(nextStart)); setEnd(precise(nextStart + length));
    }
  }
  function togglePlayback() {
    const video = videoRef.current;
    if (!video || !duration || to <= from) return;
    if (!video.paused) { video.pause(); setPlaying(false); return; }
    if (video.currentTime < from || video.currentTime >= to) video.currentTime = from;
    stopAtRef.current = to;
    void video.play().then(() => setPlaying(true)).catch(() => setError("Video playback was blocked. Press Play again to preview."));
  }
  function syncPlayheadContinuously() {
    const video = videoRef.current;
    if (!video) { playbackRaf.current = null; return; }
    const time = video.currentTime;
    setPlayhead(time);
    if (stopAtRef.current !== null && time >= stopAtRef.current) {
      video.pause(); stopAtRef.current = null; setPlaying(false); playbackRaf.current = null; return;
    }
    if (!video.paused && !video.ended) playbackRaf.current = requestAnimationFrame(syncPlayheadContinuously);
    else playbackRaf.current = null;
  }
  function startPlayheadSync() {
    if (playbackRaf.current !== null) cancelAnimationFrame(playbackRaf.current);
    playbackRaf.current = requestAnimationFrame(syncPlayheadContinuously);
  }
  function stopPlayheadSync() {
    if (playbackRaf.current !== null) cancelAnimationFrame(playbackRaf.current);
    playbackRaf.current = null;
    if (videoRef.current) setPlayhead(videoRef.current.currentTime);
  }
  function beginPlayheadDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (!duration || progress !== null) return;
    event.preventDefault(); event.stopPropagation(); playheadGesture.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId); seekTo(timeAtClientX(event.clientX));
  }
  function movePlayheadDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (playheadGesture.current !== event.pointerId) return;
    event.stopPropagation(); seekTo(timeAtClientX(event.clientX));
  }
  function finishPlayheadDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (playheadGesture.current === event.pointerId) playheadGesture.current = null;
    event.stopPropagation();
  }
  function seekTo(value: number) {
    const time = Math.max(0, Math.min(duration, value));
    setPlayhead(time); if (videoRef.current) videoRef.current.currentTime = time;
  }

  async function exportTrim() {
    if (!file || !duration || file.size > MAX_INPUT_BYTES) return;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to > duration || to <= from) {
      setError("Enter a valid range: start must be below end, and end must not exceed the video duration."); return;
    }
    setError(""); setProgress(0); setResultUrl("");
    try {
      const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } = await import("mediabunny");
      const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const target = new BufferTarget();
      const output = new Output({ format: new Mp4OutputFormat(), target });
      const conversion = await Conversion.init({ input, output, tracks: "primary", trim: { start: from, end: to } });
      if (!conversion.isValid) throw new Error("The browser could not prepare a compatible audio/video export for this file.");
      conversion.onProgress = (value) => setProgress(Math.round(value * 100));
      await conversion.execute();
      input.dispose();
      if (!target.buffer) throw new Error("Export completed without producing an MP4 file.");
      const blob = new Blob([target.buffer], { type: "video/mp4" });
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${file.name.replace(/\.[^.]+$/, "")}-trimmed.mp4`);
      setProgress(null);
    } catch (cause) {
      setProgress(null);
      setError(cause instanceof Error ? cause.message : "Video export failed. Try another file or a shorter range.");
    }
  }

  return <main className={`resize-page video-trim-page${file ? " has-media" : ""}`}>
    <ToolPageHeader />
    <section className="resize-intro"><p className="eyebrow">VIDEO · LOCAL PROCESSING</p><h1>Trim a video</h1><p>Choose a range on the timeline or enter exact times. Processing and export happen in this browser.</p></section>
    {!file ? <MediaImportScreen kind="video" accept="video/*,.mkv,.webm" onFile={selectFile} error={error} /> : <section className="resize-workspace video-trim-workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>Choose a different video</span><input type="file" accept="video/*,.mkv,.webm" onChange={(event) => selectFile(event.currentTarget.files?.[0])} /></label>
        <p className="source-info">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB{duration ? ` · ${duration.toFixed(3)} seconds` : " · Reading duration…"}</p>
        <div className="dimension-fields"><label>Start time <span>seconds</span><input type="number" min="0" max={duration || undefined} step="0.001" value={start} onBlur={() => { const value = Number(start); if (Number.isFinite(value)) setStart(precise(value)); }} onChange={(event) => setStart(event.currentTarget.value)} /></label><label>End time <span>seconds</span><input type="number" min="0" max={duration || undefined} step="0.001" value={end} placeholder={duration ? duration.toFixed(3) : "Video duration"} onBlur={() => { const value = Number(end); if (Number.isFinite(value)) setEnd(precise(value)); }} onChange={(event) => setEnd(event.currentTarget.value)} /></label></div>
        <p className="resize-note">MP4 output. The timeline handles and exact time fields edit the same selection. Long renders use in-memory output in this prototype.</p>
        {error && <p className="resize-error" role="alert">{error}</p>}
        {progress !== null && <ProcessingProgress label="Exporting trimmed video" value={progress} />}
        <button className="export-button" disabled={!duration || progress !== null || file.size > MAX_INPUT_BYTES || !Number.isFinite(from) || !Number.isFinite(to) || to <= from || to > duration} onClick={exportTrim}>{progress !== null ? "Exporting…" : "Export trimmed MP4"}</button>
        {resultUrl && <a className="export-button download-link" href={resultUrl} download={resultName}>Download {resultName}</a>}
      </div>
      <div className="resize-preview video-trim-preview">
        <div className="preview-heading"><strong>{resultUrl ? "Trimmed video result" : "Video preview"}</strong><span>{resultUrl ? `${(to - from).toFixed(3)} s · updated selection` : duration ? `${playhead.toFixed(3)} / ${duration.toFixed(3)} s` : "Loading video metadata…"}</span></div>
        {resultUrl ? <><CustomMediaPreview kind="video" src={resultUrl} label="Trimmed video result" /><button type="button" className="editor-action" onClick={() => { setResultUrl(""); setResultName(""); }}>Edit selection</button></> : <><div className="trim-video-stage">{sourceUrl && <video ref={videoRef} className="trim-video-surface" src={sourceUrl} playsInline preload="metadata" onLoadedMetadata={(event) => { const length = event.currentTarget.duration; if (Number.isFinite(length)) { setDuration(length); setEnd(precise(length)); } }} onTimeUpdate={(event) => { const time = event.currentTarget.currentTime; setPlayhead(time); if (stopAtRef.current !== null && time >= stopAtRef.current) { event.currentTarget.pause(); stopAtRef.current = null; setPlaying(false); } }} onPlay={() => { setPlaying(true); startPlayheadSync(); }} onPause={() => { setPlaying(false); stopPlayheadSync(); }} onEnded={() => { setPlaying(false); stopPlayheadSync(); }} />}</div>
        {duration > 0 && <><div className="video-trim-ruler"><span>0.000 s</span><span>{duration.toFixed(3)} s</span></div><div className="video-trim-timeline" ref={trimTimelineRef} role="group" aria-label="Video trim timeline. Drag the range edges to trim, drag inside the range to move it, or drag outside to create a new selection." onPointerDown={beginTimeline} onPointerMove={moveTimeline} onPointerUp={(event) => { if (timelineGesture.current?.pointerId === event.pointerId) timelineGesture.current = null; }} onPointerCancel={(event) => { if (timelineGesture.current?.pointerId === event.pointerId) timelineGesture.current = null; }}>
          <div className="video-trim-track" /><div className="video-trim-selected" style={{ left: `${Math.max(0, from / duration * 100)}%`, width: `${Math.max(0, (to - from) / duration * 100)}%` }} /><span className="video-range-handle start" style={{ left: `${Math.max(0, Math.min(100, from / duration * 100))}%` }} /><span className="video-range-handle end" style={{ left: `${Math.max(0, Math.min(100, to / duration * 100))}%` }} /><button type="button" className="video-trim-playhead" style={{ left: `${Math.max(0, Math.min(100, playhead / duration * 100))}%` }} aria-label="Drag to seek video trim playhead" onPointerDown={beginPlayheadDrag} onPointerMove={movePlayheadDrag} onPointerUp={finishPlayheadDrag} onPointerCancel={finishPlayheadDrag}><span /></button>
        </div><div className="video-custom-transport"><button type="button" className="transport-play" onClick={togglePlayback} aria-label={playing ? "Pause video preview" : "Play video preview"}>{playing ? "Ⅱ" : "▶"}</button><button type="button" className="transport-step" onClick={() => seekTo(playhead - 1 / 30)} aria-label="Step back one frame">−1f</button><button type="button" className="transport-step" onClick={() => seekTo(playhead + 1 / 30)} aria-label="Step forward one frame">+1f</button><input className="transport-scrub" type="range" min="0" max={duration} step="0.001" value={playhead} aria-label="Video preview playhead" onChange={(event) => seekTo(event.currentTarget.valueAsNumber)} /></div></>}
        </>}
      </div>
    </section>}
  </main>;
}
