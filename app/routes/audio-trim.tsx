import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/audio-trim";
import { MediaImportScreen } from "../components/media-import-screen";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Audio Trimmer | Local Studio" },
    { name: "description", content: "Trim audio by exact start and end times in your browser." },
    { name: "robots", content: "index,follow" },
  ];
}

function toWav(audio: AudioBuffer, startSeconds: number, endSeconds: number) {
  const first = Math.max(0, Math.floor(startSeconds * audio.sampleRate));
  const last = Math.min(audio.length, Math.floor(endSeconds * audio.sampleRate));
  const frames = last - first;
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
  for (let frame = first; frame < last; frame++) for (let channel = 0; channel < channels; channel++) {
    const sample = Math.max(-1, Math.min(1, audio.getChannelData(channel)[frame]));
    view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2;
  }
  return new Blob([bytes], { type: "audio/wav" });
}

export default function AudioTrim() {
  const player = useRef<HTMLAudioElement>(null);
  const timeline = useRef<HTMLCanvasElement>(null);
  const stopAt = useRef<number | null>(null);
  const selectionGesture = useRef<{ pointerId: number; mode: "start" | "end" | "move" | "create"; anchor: number; start: number; end: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [audio, setAudio] = useState<AudioBuffer | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

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

  const valid = Boolean(audio && Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= audio.duration);

  useEffect(() => {
    const canvas = timeline.current, context = canvas?.getContext("2d");
    if (!audio || !canvas || !context) return;
    const width = Math.max(600, Math.round(canvas.clientWidth * window.devicePixelRatio));
    const height = 150; canvas.width = width; canvas.height = height;
    context.fillStyle = "#0b1320"; context.fillRect(0, 0, width, height);
    const left = Math.max(0, Math.min(width, start / audio.duration * width));
    const right = Math.max(left, Math.min(width, end / audio.duration * width));
    context.fillStyle = "#183042"; context.fillRect(left, 0, Math.max(0, right - left), height);
    const samples = audio.getChannelData(0), step = Math.max(1, Math.floor(samples.length / width));
    for (let x = 0; x < width; x++) {
      let peak = 0;
      const from = x * step;
      for (let i = from; i < Math.min(samples.length, from + step); i++) peak = Math.max(peak, Math.abs(samples[i]));
      context.fillStyle = x >= left && x <= right ? "#65d3b1" : "#425571";
      const amplitude = Math.max(1, peak * height * .43), center = height / 2;
      context.fillRect(x, center - amplitude, 1, amplitude * 2);
    }
    context.fillStyle = "#f1f6ff"; context.fillRect(left - 1, 0, 2, height); context.fillRect(right - 1, 0, 2, height);
  }, [audio, start, end]);

  function timeFromPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(audio?.duration ?? 0, (event.clientX - bounds.left) / bounds.width * (audio?.duration ?? 0)));
  }
  function beginSelection(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!audio) return;
    const value = timeFromPointer(event), bounds = event.currentTarget.getBoundingClientRect();
    const handleTolerance = audio.duration * 14 / Math.max(1, bounds.width);
    const mode = Math.abs(value - start) <= handleTolerance ? "start"
      : Math.abs(value - end) <= handleTolerance ? "end"
        : value > start && value < end ? "move" : "create";
    selectionGesture.current = { pointerId: event.pointerId, mode, anchor: value, start, end };
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function moveSelection(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = selectionGesture.current, duration = audio?.duration ?? 0;
    if (!gesture || gesture.pointerId !== event.pointerId || !duration) return;
    const value = timeFromPointer(event), minimum = Math.min(.01, duration);
    if (gesture.mode === "start") setStart(Math.max(0, Math.min(end - minimum, value)));
    else if (gesture.mode === "end") setEnd(Math.max(start + minimum, Math.min(duration, value)));
    else if (gesture.mode === "create") { setStart(Math.min(gesture.anchor, value)); setEnd(Math.max(gesture.anchor + minimum, value)); }
    else {
      const length = gesture.end - gesture.start, nextStart = Math.max(0, Math.min(duration - length, gesture.start + value - gesture.anchor));
      setStart(nextStart); setEnd(nextStart + length);
    }
  }
  function preview() {
    if (!player.current || !valid) return;
    player.current.currentTime = start; setPlayhead(start); stopAt.current = end; void player.current.play().then(() => setPlaying(true)).catch(() => setError("Audio playback was blocked. Press Play again to start the preview."));
  }
  function togglePlayback() {
    if (!player.current || !valid) return;
    if (!player.current.paused) { player.current.pause(); setPlaying(false); return; }
    if (player.current.currentTime < start || player.current.currentTime >= end) player.current.currentTime = start;
    stopAt.current = end;
    void player.current.play().then(() => setPlaying(true)).catch(() => setError("Audio playback was blocked. Press Play again to start the preview."));
  }
  function exportSelection() {
    if (!audio || !file || !valid) return;
    const result = URL.createObjectURL(toWav(audio, start, end));
    const link = document.createElement("a"); link.href = result;
    link.download = `${file.name.replace(/\.[^.]+$/, "")}-trimmed.wav`; link.click(); URL.revokeObjectURL(result);
  }

  return <main className={`resize-page audio-trim-page${audio ? " has-media" : ""}`}>
    <ToolPageHeader />
    <section className="resize-intro"><p className="eyebrow">AUDIO TOOL · PRIVATE BY DESIGN</p><h1>Trim audio with exact times.</h1><p>Choose a start and end point, preview the selection, then download a WAV. Audio stays in your browser.</p></section>
    {!audio ? <MediaImportScreen kind="audio" accept="audio/*" onFile={(next) => void importFile(next)} error={error} /> : <section className="resize-workspace" aria-label="Audio trimming workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>{file ? "Choose another audio file" : "Choose an audio file"}<input type="file" accept="audio/*" onChange={(event) => void importFile(event.currentTarget.files?.[0])} /></span></label>
        {audio && <p className="source-info">{file?.name} · {audio.duration.toFixed(2)} s · {audio.sampleRate} Hz · {audio.numberOfChannels} channel(s)</p>}
        <div className="dimension-fields"><label>Start <span>seconds</span><input type="number" min="0" max={audio?.duration} step="0.01" value={start} onChange={(event) => setStart(event.currentTarget.valueAsNumber)} /></label><label>End <span>seconds</span><input type="number" min="0" max={audio?.duration} step="0.01" value={end} onChange={(event) => setEnd(event.currentTarget.valueAsNumber)} /></label></div>
        <p className="resize-note">{valid ? `Selection length: ${(end - start).toFixed(2)} s` : "Enter a valid start and end time."}</p>
        <button className="export-button" type="button" disabled={!valid || loading} onClick={preview}>Preview selection</button>
        <button className="export-button secondary-button" type="button" disabled={!valid || loading} onClick={exportSelection}>Download trimmed WAV</button>
        {loading && <p role="status" className="resize-note">Loading and decoding audio…</p>}{error && <p role="alert" className="resize-error">{error}</p>}
        {url && <audio ref={player} className="media-source-hidden" src={url} onTimeUpdate={(event) => { const time = event.currentTarget.currentTime; setPlayhead(time); if (stopAt.current !== null && time >= stopAt.current) { event.currentTarget.pause(); stopAt.current = null; setPlaying(false); } }} onPause={() => { stopAt.current = null; setPlaying(false); }} onEnded={() => setPlaying(false)} />}
      </div>
      <div className="resize-preview audio-trim-preview"><div className="preview-heading"><strong>Waveform timeline</strong><span>{valid ? `${start.toFixed(2)} — ${end.toFixed(2)} s · ${(end - start).toFixed(2)} s selected` : "Adjust selection"}</span></div>
        <div className="timeline-time-labels"><span>00:00</span><span>{audio.duration.toFixed(2)} s</span></div>
        <div className="audio-waveform-stage"><canvas ref={timeline} className="audio-trim-waveform" role="img" aria-label="Waveform timeline. Drag near either edge to trim, drag inside the selected range to move it, or drag outside to choose a new range." onPointerDown={beginSelection} onPointerMove={moveSelection} onPointerUp={(event) => { if (selectionGesture.current?.pointerId === event.pointerId) selectionGesture.current = null; }} onPointerCancel={(event) => { if (selectionGesture.current?.pointerId === event.pointerId) selectionGesture.current = null; }} />{audio.duration > 0 && <span className="waveform-playhead" style={{ left: `${playhead / audio.duration * 100}%` }} aria-hidden="true" />}</div>
        <div className="custom-transport"><button type="button" className="transport-play" onClick={togglePlayback} aria-label={playing ? "Pause preview" : "Play preview"}>{playing ? "Ⅱ" : "▶"}</button><span className="transport-time">{playhead.toFixed(2)} / {audio.duration.toFixed(2)} s</span><input className="transport-scrub" type="range" min="0" max={audio.duration} step="0.01" value={playhead} aria-label="Preview playhead" onChange={(event) => { const time = event.currentTarget.valueAsNumber; setPlayhead(time); if (player.current) player.current.currentTime = time; }} /></div>
      </div>
    </section>}
  </main>;
}
