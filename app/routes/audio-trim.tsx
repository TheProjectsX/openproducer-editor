import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/audio-trim";
import { MediaImportScreen } from "../components/media-import-screen";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Audio Trimmer | Local Studio" },
    { name: "description", content: "Trim audio by exact start and end times in your browser." },
    { name: "robots", content: "index,follow" },
  ];
}

function toWav(audio: AudioBuffer, ranges: Array<[number, number]>) {
  const frameRanges = ranges.map(([start, end]) => [Math.max(0, Math.floor(start * audio.sampleRate)), Math.min(audio.length, Math.floor(end * audio.sampleRate))] as const).filter(([start, end]) => end > start);
  const frames = frameRanges.reduce((total, [start, end]) => total + end - start, 0);
  const channels = audio.numberOfChannels;
  const bytes = new ArrayBuffer(44 + frames * channels * 2);
  const view = new DataView(bytes);
  const text = (at: number, value: string) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, frames * channels * 2, true);
  let offset = 44;
  for (const [first, last] of frameRanges) for (let frame = first; frame < last; frame++) for (let channel = 0; channel < channels; channel++) {
    const sample = Math.max(-1, Math.min(1, audio.getChannelData(channel)[frame]));
    view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2;
  }
  return new Blob([bytes], { type: "audio/wav" });
}

export default function AudioTrim() {
  const player = useRef<HTMLAudioElement>(null);
  const timeline = useRef<HTMLCanvasElement>(null);
  const stopAt = useRef<number | null>(null);
  const selectionGesture = useRef<{ pointerId: number; mode: "start" | "end" | "move" | "create"; anchor: number; start: number; end: number; originX: number; moved: boolean } | null>(null);
  const playheadGesture = useRef<number | null>(null);
  const playbackRaf = useRef<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [trimMode, setTrimMode] = useState<"keep" | "remove">("keep");
  const [audio, setAudio] = useState<AudioBuffer | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [previewTime, setPreviewTime] = useState(0);
  const previewTimer = useRef<number | null>(null);
  const previewUrlRef = useRef("");
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const waveformPeaks = useMemo(() => {
    if (!audio) return null;
    const samples = audio.getChannelData(0), bucketCount = 4096;
    const peaks = new Float32Array(bucketCount), bucketSize = Math.max(1, Math.ceil(samples.length / bucketCount));
    for (let bucket = 0; bucket < bucketCount; bucket++) {
      let peak = 0;
      const from = bucket * bucketSize;
      for (let index = from; index < Math.min(samples.length, from + bucketSize); index++) peak = Math.max(peak, Math.abs(samples[index]));
      peaks[bucket] = peak;
    }
    return peaks;
  }, [audio]);

  async function importFile(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("audio/")) { setError("Choose an audio file."); return; }
    const nextUrl = URL.createObjectURL(next);
    setLoading(true); setError("");
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(await next.arrayBuffer());
      setFile(next); setUrl(nextUrl); setAudio(decoded); setStart(0); setEnd(decoded.duration);
    } catch {
      URL.revokeObjectURL(nextUrl);
      setError("This browser could not decode this file. Try a WAV, MP3, or supported M4A file.");
    } finally { await context.close(); setLoading(false); }
  }

  const selectedDuration = end - start;
  const outputDuration = trimMode === "keep" ? selectedDuration : (audio?.duration ?? 0) - selectedDuration;
  const valid = Boolean(audio && Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= audio.duration && outputDuration > 0);
  const ranges: Array<[number, number]> = trimMode === "keep" ? [[start, end]] : [[0, start], [end, audio?.duration ?? end]];

  useEffect(() => {
    if (!audio || !valid) {
      setPreviewUrl((previous) => { if (previous) URL.revokeObjectURL(previous); previewUrlRef.current = ""; return ""; });
      return;
    }
    if (player.current && !player.current.paused) player.current.pause();
    stopAt.current = null; setPlaying(false);
    if (playbackRaf.current !== null) cancelAnimationFrame(playbackRaf.current);
    playbackRaf.current = null;
    // Pointer movement can produce dozens of range updates per second. Building a
    // complete WAV synchronously for every update blocks the pointer event loop.
    const timer = window.setTimeout(() => {
      const nextUrl = URL.createObjectURL(toWav(audio, ranges));
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        previewUrlRef.current = nextUrl;
        return nextUrl;
      });
      setPreviewTime(0);
      setPlayhead(trimMode === "keep" ? start : 0);
      if (player.current) player.current.currentTime = 0;
    }, selectionGesture.current ? 180 : 0);
    previewTimer.current = timer;
    return () => window.clearTimeout(timer);
  }, [audio, start, end, trimMode, valid]);

  useEffect(() => () => {
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    if (playbackRaf.current !== null) cancelAnimationFrame(playbackRaf.current);
  }, []);

  useEffect(() => {
    const canvas = timeline.current, context = canvas?.getContext("2d");
    if (!audio || !canvas || !context) return;
    const width = Math.max(600, Math.round(canvas.clientWidth * window.devicePixelRatio));
    const height = 150; canvas.width = width; canvas.height = height;
    context.fillStyle = "#0b1320"; context.fillRect(0, 0, width, height);
    const left = Math.max(0, Math.min(width, start / audio.duration * width));
    const right = Math.max(left, Math.min(width, end / audio.duration * width));
    context.fillStyle = trimMode === "keep" ? "#183042" : "#432533"; context.fillRect(left, 0, Math.max(0, right - left), height);
    for (let x = 0; x < width; x++) {
      const peak = waveformPeaks?.[Math.min((waveformPeaks.length - 1), Math.floor(x / width * (waveformPeaks?.length ?? 1)))] ?? 0;
      context.fillStyle = x >= left && x <= right ? trimMode === "keep" ? "#65d3b1" : "#ff8794" : "#425571";
      const amplitude = Math.max(1, peak * height * .43), center = height / 2;
      context.fillRect(x, center - amplitude, 1, amplitude * 2);
    }
    context.fillStyle = "#f1f6ff"; context.fillRect(left - 1, 0, 2, height); context.fillRect(right - 1, 0, 2, height);
  }, [audio, start, end, trimMode, waveformPeaks]);

  function timeFromPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(audio?.duration ?? 0, (event.clientX - bounds.left) / bounds.width * (audio?.duration ?? 0)));
  }
  function sourceTimeAt(clientX: number) {
    const bounds = timeline.current?.getBoundingClientRect();
    return bounds && audio ? Math.max(0, Math.min(audio.duration, (clientX - bounds.left) / bounds.width * audio.duration)) : 0;
  }
  function updateSelectionCursor(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!audio || selectionGesture.current?.pointerId === event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const startX = start / audio.duration * bounds.width;
    const endX = end / audio.duration * bounds.width;
    const nearHandle = Math.min(Math.abs(x - startX), Math.abs(x - endX)) <= 7;
    event.currentTarget.style.cursor = nearHandle ? "ew-resize"
      : x > startX && x < endX ? "grab" : "crosshair";
  }
  function beginSelection(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!audio) return;
    const value = timeFromPointer(event), bounds = event.currentTarget.getBoundingClientRect();
    const handleTolerance = audio.duration * 7 / Math.max(1, bounds.width);
    const mode = Math.abs(value - start) <= handleTolerance ? "start"
      : Math.abs(value - end) <= handleTolerance ? "end"
        : value > start && value < end ? "move" : "create";
    selectionGesture.current = { pointerId: event.pointerId, mode, anchor: value, start, end, originX: event.clientX, moved: false };
    event.currentTarget.style.cursor = mode === "start" || mode === "end" ? "ew-resize" : mode === "move" ? "grabbing" : "crosshair";
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function moveSelection(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = selectionGesture.current, duration = audio?.duration ?? 0;
    if (!gesture || gesture.pointerId !== event.pointerId || !duration) return;
    if (!gesture.moved && Math.abs(event.clientX - gesture.originX) < 3) return;
    gesture.moved = true;
    const value = timeFromPointer(event), minimum = Math.min(.01, duration);
    if (gesture.mode === "start") setStart(Math.max(0, Math.min(gesture.end - minimum, value)));
    else if (gesture.mode === "end") setEnd(Math.max(gesture.start + minimum, Math.min(duration, value)));
    else if (gesture.mode === "create") { setStart(Math.min(gesture.anchor, value)); setEnd(Math.max(gesture.anchor + minimum, value)); }
    else {
      const length = gesture.end - gesture.start, nextStart = Math.max(0, Math.min(duration - length, gesture.start + value - gesture.anchor));
      setStart(nextStart); setEnd(nextStart + length);
    }
  }
  function seekSourceToTime(value: number) {
    if (!audio) return;
    const sourceTime = Math.max(0, Math.min(audio.duration, value));
    let outputTime: number, mappedSourceTime: number;
    if (trimMode === "keep") {
      mappedSourceTime = Math.max(start, Math.min(end, sourceTime));
      outputTime = mappedSourceTime - start;
    } else if (sourceTime <= start) {
      mappedSourceTime = sourceTime; outputTime = sourceTime;
    } else if (sourceTime >= end) {
      mappedSourceTime = sourceTime; outputTime = sourceTime - selectedDuration;
    } else if (sourceTime - start <= end - sourceTime) {
      mappedSourceTime = start; outputTime = start;
    } else {
      mappedSourceTime = end; outputTime = start;
    }
    const clampedOutputTime = Math.max(0, Math.min(outputDuration, outputTime));
    setPlayhead(mappedSourceTime); setPreviewTime(clampedOutputTime);
    if (player.current) player.current.currentTime = clampedOutputTime;
  }
  function beginWaveformSeek(event: React.PointerEvent<HTMLButtonElement>) {
    if (!audio) return;
    playheadGesture.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); event.stopPropagation();
    seekSourceToTime(sourceTimeAt(event.clientX));
  }
  function moveWaveformSeek(event: React.PointerEvent<HTMLButtonElement>) {
    if (playheadGesture.current !== event.pointerId) return;
    event.stopPropagation(); seekSourceToTime(sourceTimeAt(event.clientX));
  }
  function finishWaveformSeek(event: React.PointerEvent<HTMLButtonElement>) {
    if (playheadGesture.current === event.pointerId) playheadGesture.current = null;
    event.stopPropagation();
  }
  function finishSelection(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = selectionGesture.current;
    if (gesture?.pointerId === event.pointerId && !gesture.moved) seekSourceToTime(timeFromPointer(event));
    if (gesture?.pointerId === event.pointerId) selectionGesture.current = null;
    updateSelectionCursor(event);
  }
  function updatePlaybackPosition() {
    const element = player.current;
    if (!element) return;
    const time = Math.min(outputDuration, element.currentTime);
    setPreviewTime(time);
    setPlayhead(trimMode === "keep" ? start + time : time < start ? time : time + selectedDuration);
    if (stopAt.current !== null && time >= stopAt.current) {
      element.pause(); stopAt.current = null; setPlaying(false); playbackRaf.current = null; return;
    }
    if (!element.paused) {
      if (playbackRaf.current !== null) cancelAnimationFrame(playbackRaf.current);
      playbackRaf.current = requestAnimationFrame(updatePlaybackPosition);
    }
    else playbackRaf.current = null;
  }
  function togglePlayback() {
    if (!player.current || !valid) return;
    if (!player.current.paused) { player.current.pause(); setPlaying(false); if (playbackRaf.current !== null) cancelAnimationFrame(playbackRaf.current); playbackRaf.current = null; return; }
    if (player.current.currentTime >= outputDuration) seekSourceToTime(trimMode === "keep" ? start : 0);
    stopAt.current = outputDuration;
    void player.current.play().then(() => { setPlaying(true); playbackRaf.current = requestAnimationFrame(updatePlaybackPosition); }).catch(() => setError("Audio playback was blocked. Press Play again to start the preview."));
  }
  function exportSelection() {
    if (!audio || !file || !valid) return;
    const result = URL.createObjectURL(toWav(audio, ranges));
    const link = document.createElement("a"); link.href = result;
    link.download = `${file.name.replace(/\.[^.]+$/, "")}-${trimMode === "keep" ? "selection" : "selection-removed"}.wav`; link.click(); window.setTimeout(() => URL.revokeObjectURL(result), 1000);
  }

  return <main className={`resize-page audio-trim-page${audio ? " has-media" : ""}`}>
    <ToolPageHeader />
    <section className="resize-intro"><p className="eyebrow">AUDIO TOOL · PRIVATE BY DESIGN</p><h1>Trim audio with exact times.</h1><p>Choose a start and end point, preview the selection, then download a WAV. Audio stays in your browser.</p></section>
    {!audio ? <MediaImportScreen kind="audio" accept="audio/*" onFile={(next) => void importFile(next)} error={error} /> : <section className="resize-workspace audio-tool-workspace" aria-label="Audio trimming workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>{file ? "Choose another audio file" : "Choose an audio file"}<input type="file" accept="audio/*" onChange={(event) => void importFile(event.currentTarget.files?.[0])} /></span></label>
        {audio && <p className="source-info">{file?.name} · {audio.duration.toFixed(3)} s · {audio.sampleRate} Hz · {audio.numberOfChannels} channel(s)</p>}
        <fieldset className="trim-mode-toggle"><legend>Trim action</legend><label><input type="radio" name="trim-mode" checked={trimMode === "keep"} onChange={() => setTrimMode("keep")} />Keep only selection</label><label><input type="radio" name="trim-mode" checked={trimMode === "remove"} onChange={() => setTrimMode("remove")} />Remove only selection</label></fieldset>
        <div className="dimension-fields"><label>Start <span>seconds</span><input type="number" min="0" max={audio?.duration} step="0.001" value={start.toFixed(3)} onChange={(event) => setStart(event.currentTarget.valueAsNumber)} /></label><label>End <span>seconds</span><input type="number" min="0" max={audio?.duration} step="0.001" value={end.toFixed(3)} onChange={(event) => setEnd(event.currentTarget.valueAsNumber)} /></label></div>
        <p className="resize-note">{valid ? `Selected: ${selectedDuration.toFixed(3)} s · Output: ${outputDuration.toFixed(3)} s` : "Select a valid range that leaves audio to export."}</p>
        <button className="export-button secondary-button" type="button" disabled={!valid || loading} onClick={exportSelection}>Download {trimMode === "keep" ? "selection" : "edited audio"} WAV</button>
        {loading && <p role="status" className="resize-note">Loading and decoding audio…</p>}{error && <p role="alert" className="resize-error">{error}</p>}
        {previewUrl && <audio ref={player} className="media-source-hidden" src={previewUrl} onTimeUpdate={updatePlaybackPosition} onPause={() => { stopAt.current = null; setPlaying(false); if (playbackRaf.current !== null) cancelAnimationFrame(playbackRaf.current); playbackRaf.current = null; }} onEnded={() => { setPlaying(false); playbackRaf.current = null; }} />}
      </div>
      <div className="resize-preview audio-trim-preview"><div className="preview-heading"><strong>Source waveform</strong><span>{valid ? `${start.toFixed(3)} — ${end.toFixed(3)} s · ${trimMode === "keep" ? "kept" : "removed"}` : "Adjust selection"}</span></div>
        <div className="timeline-time-labels"><span>0.000 s</span><span>{audio.duration.toFixed(3)} s</span></div>
        <div className="audio-waveform-stage"><canvas ref={timeline} className="audio-trim-waveform" role="img" aria-label="Full-source waveform timeline. Click to seek. Drag near either selection edge to trim, drag inside the selection to move it, or drag outside the selection to create a new range." onPointerDown={beginSelection} onPointerMove={(event) => { updateSelectionCursor(event); moveSelection(event); }} onPointerLeave={(event) => { if (!selectionGesture.current) event.currentTarget.style.cursor = "crosshair"; }} onPointerUp={finishSelection} onPointerCancel={(event) => { if (selectionGesture.current?.pointerId === event.pointerId) selectionGesture.current = null; }} /><button type="button" className="waveform-playhead" style={{ left: `${playhead / audio.duration * 100}%` }} aria-label="Drag to seek source waveform playhead" onPointerDown={beginWaveformSeek} onPointerMove={moveWaveformSeek} onPointerUp={finishWaveformSeek} onPointerCancel={finishWaveformSeek}><span /></button></div>
        <div className="trim-result-preview"><div className="preview-heading"><strong>Edited audio preview</strong><span>{previewUrl ? `${outputDuration.toFixed(3)} s output · full ${audio.duration.toFixed(3)} s source timeline` : "Preparing preview…"}</span></div><div className="custom-transport"><button type="button" className="transport-play" onClick={togglePlayback} aria-label={playing ? "Pause preview" : "Play preview"}>{playing ? "Ⅱ" : "▶"}</button><span className="transport-time">{playhead.toFixed(3)} / {audio.duration.toFixed(3)} s</span><input className="transport-scrub" type="range" min="0" max={audio.duration} step="0.001" value={Math.min(playhead, audio.duration)} aria-label="Full-source timeline playhead" onChange={(event) => seekSourceToTime(event.currentTarget.valueAsNumber)} /></div></div>
      </div>
    </section>}
  </main>;
}
