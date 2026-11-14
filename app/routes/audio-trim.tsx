import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/audio-trim";

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
  const stopAt = useRef<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [audio, setAudio] = useState<AudioBuffer | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
  function preview() {
    if (!player.current || !valid) return;
    player.current.currentTime = start; stopAt.current = end; void player.current.play();
  }
  function exportSelection() {
    if (!audio || !file || !valid) return;
    const result = URL.createObjectURL(toWav(audio, start, end));
    const link = document.createElement("a"); link.href = result;
    link.download = `${file.name.replace(/\.[^.]+$/, "")}-trimmed.wav`; link.click(); URL.revokeObjectURL(result);
  }

  return <main className="resize-page">
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/tools/audio/trim">Audio Trim</a></nav></header>
    <section className="resize-intro"><p className="eyebrow">AUDIO TOOL · PRIVATE BY DESIGN</p><h1>Trim audio with exact times.</h1><p>Choose a start and end point, preview the selection, then download a WAV. Audio stays in your browser.</p></section>
    <section className="resize-workspace" aria-label="Audio trimming workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>{file ? "Choose another audio file" : "Choose an audio file"}<input type="file" accept="audio/*" onChange={(event) => void importFile(event.currentTarget.files?.[0])} /></span></label>
        {audio && <p className="source-info">{file?.name} · {audio.duration.toFixed(2)} s · {audio.sampleRate} Hz · {audio.numberOfChannels} channel(s)</p>}
        <div className="dimension-fields"><label>Start <span>seconds</span><input type="number" min="0" max={audio?.duration} step="0.01" value={start} onChange={(event) => setStart(event.currentTarget.valueAsNumber)} /></label><label>End <span>seconds</span><input type="number" min="0" max={audio?.duration} step="0.01" value={end} onChange={(event) => setEnd(event.currentTarget.valueAsNumber)} /></label></div>
        <p className="resize-note">{valid ? `Selection length: ${(end - start).toFixed(2)} s` : "Enter a valid start and end time."}</p>
        <button className="export-button" type="button" disabled={!valid || loading} onClick={preview}>Preview selection</button>
        <button className="export-button secondary-button" type="button" disabled={!valid || loading} onClick={exportSelection}>Download trimmed WAV</button>
        {loading && <p role="status" className="resize-note">Loading and decoding audio…</p>}{error && <p role="alert" className="resize-error">{error}</p>}
        {url && <audio ref={player} className="audio-player" controls src={url} onTimeUpdate={() => { if (player.current && stopAt.current !== null && player.current.currentTime >= stopAt.current) { player.current.pause(); stopAt.current = null; } }} onPause={() => { stopAt.current = null; }} />}
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>Trim selection</strong><span>{valid ? `${start.toFixed(2)} — ${end.toFixed(2)} s` : "Choose audio to begin"}</span></div><div className="empty-preview audio-preview">{audio ? <><strong>{file?.name}</strong><span>Type exact start and end times above.</span></> : "Your audio selection will appear here."}</div></div>
    </section>
  </main>;
}
