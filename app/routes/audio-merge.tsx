import { useState } from "react";
import type { Route } from "./+types/audio-merge";
import { MediaImportScreen } from "../components/media-import-screen";

type Clip = { file: File; audio: AudioBuffer };
const MAX_DECODED_BYTES = 512 * 1024 * 1024;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Merge audio | Local Studio" },
    { name: "description", content: "Arrange and merge local audio files into one WAV in your browser." },
  ];
}

function makeWav(clips: Clip[], gapSeconds: number) {
  const sampleRate = Math.max(...clips.map(({ audio }) => audio.sampleRate));
  const channels = Math.max(...clips.map(({ audio }) => audio.numberOfChannels));
  const totalFrames = clips.reduce((sum, { audio }) => sum + Math.ceil(audio.duration * sampleRate), 0)
    + Math.ceil(gapSeconds * sampleRate) * Math.max(0, clips.length - 1);
  const byteLength = 44 + totalFrames * channels * 2;
  if (byteLength > MAX_DECODED_BYTES) throw new Error("Merged WAV would exceed the 512 MiB output limit. Reduce the clips or gap.");
  if (byteLength > 0xffffffff) throw new Error("The WAV format limit would be exceeded. Reduce the files or gap.");
  const output = new ArrayBuffer(byteLength);
  const view = new DataView(output);
  const writeText = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  writeText(0, "RIFF"); view.setUint32(4, byteLength - 8, true); writeText(8, "WAVE");
  writeText(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true); writeText(36, "data"); view.setUint32(40, byteLength - 44, true);
  let frameOffset = 0;
  for (let clipIndex = 0; clipIndex < clips.length; clipIndex++) {
    const { audio } = clips[clipIndex];
    const frames = Math.ceil(audio.duration * sampleRate);
    for (let frame = 0; frame < frames; frame++) {
      const sourcePosition = Math.min(audio.length - 1, frame * audio.sampleRate / sampleRate);
      const sourceFrame = Math.floor(sourcePosition);
      const nextFrame = Math.min(audio.length - 1, sourceFrame + 1);
      const fraction = sourcePosition - sourceFrame;
      for (let channel = 0; channel < channels; channel++) {
        const source = audio.getChannelData(Math.min(channel, audio.numberOfChannels - 1));
        const sample = Math.max(-1, Math.min(1, (source[sourceFrame] ?? 0) * (1 - fraction) + (source[nextFrame] ?? 0) * fraction));
        view.setInt16(44 + (frameOffset + frame) * channels * 2 + channel * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
      }
    }
    frameOffset += frames;
    if (clipIndex < clips.length - 1) frameOffset += Math.ceil(gapSeconds * sampleRate);
  }
  return new Blob([output], { type: "audio/wav" });
}

export default function AudioMerge() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [gap, setGap] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addFiles(files: FileList | File[] | null) {
    if (!files?.length) return;
    setBusy(true); setError("");
    const context = new AudioContext();
    try {
      const next: Clip[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("audio/")) throw new Error(`${file.name} is not recognized as an audio file.`);
        const audio = await context.decodeAudioData(await file.arrayBuffer());
        next.push({ file, audio });
      }
      const merged = [...clips, ...next];
      const decodedBytes = merged.reduce((sum, clip) => sum + clip.audio.length * clip.audio.numberOfChannels * 4, 0);
      if (merged.length > 20) throw new Error("This prototype supports up to 20 files at once.");
      if (decodedBytes > MAX_DECODED_BYTES) throw new Error("Decoded audio exceeds the 512 MiB prototype limit. Add fewer or shorter files.");
      setClips(merged);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "One or more files could not be decoded.");
    } finally {
      await context.close(); setBusy(false);
    }
  }

  function moveClip(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= clips.length) return;
    const reordered = [...clips]; [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    setClips(reordered);
  }

  function exportMerge() {
    const gapValue = Number(gap);
    if (clips.length < 2 || !Number.isFinite(gapValue) || gapValue < 0 || gapValue > 600) return;
    try {
      const result = URL.createObjectURL(makeWav(clips, gapValue));
      const link = document.createElement("a"); link.href = result; link.download = "merged-audio.wav"; link.click();
      window.setTimeout(() => URL.revokeObjectURL(result), 1000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the merged WAV."); }
  }

  return <main className={`resize-page${clips.length ? " has-media" : ""}`}>
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/">All tools</a></nav></header>
    <section className="resize-intro"><p className="eyebrow">AUDIO · LOCAL PROCESSING</p><h1>Merge audio files</h1><p>Add audio, arrange its order, set a custom gap between clips, and export one WAV. Files stay in this browser.</p></section>
    {!clips.length ? <MediaImportScreen kind="audio" accept="audio/*" multiple onFiles={(files) => void addFiles(files)} error={error} /> : <section className="resize-workspace audio-tool-workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>{busy ? "Decoding audio…" : "Add audio files"}<input type="file" accept="audio/*" multiple disabled={busy} onChange={(event) => { void addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></span></label>
        {clips.length > 0 && <p className="source-info">{clips.length} file(s) · {clips.reduce((sum, clip) => sum + clip.audio.duration, 0).toFixed(2)} s total audio</p>}
        <label className="speed-field">Gap between clips <span>seconds · custom</span><input type="number" min="0" max="600" step="0.1" value={gap} onChange={(event) => setGap(event.currentTarget.value)} /></label>
        <p className="resize-note">Output is 16-bit PCM WAV. Different sample rates are resampled to the highest source rate; mono channels are duplicated as needed. Rendering uses browser memory.</p>
        {error && <p className="resize-error" role="alert">{error}</p>}
        <button className="export-button" disabled={clips.length < 2 || busy || !Number.isFinite(Number(gap)) || Number(gap) < 0 || Number(gap) > 600} onClick={exportMerge}>Download merged WAV</button>
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>Merge timeline</strong><span>{clips.length} loaded · {clips.reduce((sum, clip) => sum + clip.audio.duration, 0).toFixed(2)} s audio</span></div>{clips.length ? <><div className="audio-merge-timeline" role="group" aria-label="Audio clips arranged in playback order">{clips.map((clip, index) => <span key={`${clip.file.name}-${index}`} className="merge-timeline-clip" style={{ flexGrow: Math.max(.1, clip.audio.duration) }}><strong>{clip.file.name}</strong><small>{clip.audio.duration.toFixed(2)} s</small></span>)}</div><ol className="clip-list">{clips.map((clip, index) => <li key={`${clip.file.name}-${index}`}><span><strong>{index + 1}. {clip.file.name}</strong><small>{clip.audio.duration.toFixed(2)} s · {clip.audio.sampleRate} Hz</small></span><div><button type="button" aria-label={`Move ${clip.file.name} up`} disabled={index === 0} onClick={() => moveClip(index, -1)}>↑</button><button type="button" aria-label={`Move ${clip.file.name} down`} disabled={index === clips.length - 1} onClick={() => moveClip(index, 1)}>↓</button><button type="button" aria-label={`Remove ${clip.file.name}`} onClick={() => setClips(clips.filter((_, clipIndex) => clipIndex !== index))}>×</button></div></li>)}</ol></> : <div className="empty-preview">Choose two or more audio files to arrange.</div>}</div>
    </section>}
  </main>;
}
