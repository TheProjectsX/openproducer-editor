import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useMemo, useState } from "react";
import { zipSync } from "fflate";
import type { Route } from "./+types/audio-split";
import { MediaImportScreen } from "../components/media-import-screen";
import { CustomMediaPreview } from "../components/custom-media-preview";
import { AudioSplitTimeline } from "../components/audio-split-timeline";

const MAX_INPUT_BYTES = 512 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;
const MAX_DECODED_BYTES = 512 * 1024 * 1024;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Split audio | OpenProducer Editor" },
    { name: "description", content: "Split audio at custom timestamps and download the segments as a ZIP." },
  ];
}

function encodeWav(audio: AudioBuffer, first: number, last: number) {
  const frames = last - first;
  const channels = audio.numberOfChannels;
  const buffer = new ArrayBuffer(44 + frames * channels * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, frames * channels * 2, true);
  let offset = 44;
  for (let frame = first; frame < last; frame++) for (let channel = 0; channel < channels; channel++) {
    const sample = Math.max(-1, Math.min(1, audio.getChannelData(channel)[frame]));
    view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2;
  }
  return new Uint8Array(buffer);
}

export default function AudioSplit() {
  const [file, setFile] = useState<File | null>(null);
  const [audio, setAudio] = useState<AudioBuffer | null>(null);
  const [splitPoints, setSplitPoints] = useState("");
  const [url, setUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const parsed = useMemo(() => {
    if (!audio) return { valid: false, points: [] as number[], message: "Choose an audio file to begin." };
    if (!splitPoints.trim()) return { valid: true, points: [] as number[], message: "No split points means one full-length WAV in the ZIP." };
    const raw = splitPoints.split(",").map((value) => value.trim());
    const values = raw.map(Number);
    if (raw.some((value) => !value) || values.some((value) => !Number.isFinite(value))) return { valid: false, points: [] as number[], message: "Enter comma-separated numeric timestamps in seconds." };
    const points = [...values].sort((a, b) => a - b);
    if (points.length > 49) return { valid: false, points, message: "Use no more than 49 split points (50 output clips)." };
    if (points.some((point, index) => point <= 0 || point >= audio.duration || (index > 0 && point === points[index - 1]))) return { valid: false, points, message: "Split points must be unique and strictly inside the audio duration." };
    return { valid: true, points, message: `${points.length + 1} output segment(s) · ${audio.duration.toFixed(3)} seconds total.` };
  }, [audio, splitPoints]);

  async function chooseFile(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("audio/")) { setError("Choose an audio file."); return; }
    if (next.size > MAX_INPUT_BYTES) { setError("Choose a file up to 512 MiB for this in-memory prototype."); return; }
    setBusy(true); setError(""); setAudio(null); setFile(null); setResultUrl(""); setSplitPoints("");
    if (url) URL.revokeObjectURL(url);
    setUrl("");
    const nextUrl = URL.createObjectURL(next);
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(await next.arrayBuffer());
      const decodedBytes = decoded.length * decoded.numberOfChannels * 4;
      if (decodedBytes > MAX_DECODED_BYTES) throw new Error("Decoded audio exceeds the 512 MiB memory limit.");
      if (url) URL.revokeObjectURL(url);
      setFile(next); setAudio(decoded); setUrl(nextUrl);
    } catch (cause) {
      URL.revokeObjectURL(nextUrl);
      setError(cause instanceof Error ? cause.message : "This browser could not decode the selected audio file.");
    } finally { await context.close(); setBusy(false); }
  }

  function exportSegments() {
    if (!audio || !file || !parsed.valid) return;
    const boundaries = [0, ...parsed.points, audio.duration];
    const totalOutputBytes = boundaries.slice(0, -1).reduce((sum, start, index) => {
      const first = Math.floor(start * audio.sampleRate);
      const last = Math.min(audio.length, Math.floor(boundaries[index + 1] * audio.sampleRate));
      return sum + 44 + (last - first) * audio.numberOfChannels * 2;
    }, 0);
    if (totalOutputBytes > MAX_OUTPUT_BYTES) { setError("The ZIP output would exceed the 256 MiB limit. Use fewer or shorter segments."); return; }
    setBusy(true); setError("");
    try {
      const stem = file.name.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "_");
      const files: Record<string, Uint8Array> = {};
      for (let index = 0; index < boundaries.length - 1; index++) {
        const startFrame = Math.floor(boundaries[index] * audio.sampleRate);
        const endFrame = Math.min(audio.length, Math.floor(boundaries[index + 1] * audio.sampleRate));
        files[`${stem}-part-${String(index + 1).padStart(2, "0")}.wav`] = encodeWav(audio, startFrame, endFrame);
      }
      const zip = zipSync(files, { level: 0 });
      setResultUrl(URL.createObjectURL(new Blob([zip], { type: "application/zip" })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the audio segments."); }
    finally { setBusy(false); }
  }

  return <main className={`resize-page audio-tool-page${audio ? " has-media" : ""}`}>
    <ToolPageHeader status={audio ? `${parsed.points.length + 1} part(s)` : undefined} />
    <section className="resize-intro">
      <p className="eyebrow">AUDIO · LOCAL PROCESSING</p>
      <h1>Split audio at exact times</h1>
      <p>Enter any number of custom cut points in seconds. The segments download together as a ZIP of WAV files.</p>
    </section>
    {!audio ? <MediaImportScreen kind="audio" accept="audio/*" onFile={(next) => void chooseFile(next)} error={error} /> : <section className="resize-workspace audio-tool-workspace">
      <div className="resize-controls">
        <div className="audio-file-bar">
          <div className="audio-file-meta">
            <strong>{file?.name}</strong>
            <span>{audio.duration.toFixed(3)} s · {audio.sampleRate} Hz · {audio.numberOfChannels} ch</span>
          </div>
          <label className="audio-file-change">
            <span>Change file</span>
            <input type="file" accept="audio/*" disabled={busy} onChange={(event) => void chooseFile(event.currentTarget.files?.[0])} />
          </label>
        </div>

        <div className="audio-control-group">
          <p className="audio-control-group-title">Cut markers</p>
          <label className="ratio-field">Split points <span>seconds, comma-separated</span><input type="text" inputMode="decimal" value={splitPoints} onChange={(event) => setSplitPoints(event.currentTarget.value)} placeholder="30, 62.5, 120" /></label>
        </div>

        <div className="audio-output-summary">
          <div>
            <span>Cut points</span>
            <strong>{parsed.points.length}</strong>
          </div>
          <div>
            <span>Segments</span>
            <strong>{parsed.points.length + 1} WAVs</strong>
          </div>
        </div>

        <p className={parsed.valid ? "resize-note" : "resize-error"} role={parsed.valid ? "status" : "alert"}>{error || parsed.message}</p>
        <p className="resize-note">16-bit PCM WAV parts bundled in a ZIP.</p>
        <button className="export-button" disabled={!audio || !file || !parsed.valid || busy} onClick={exportSegments}>{busy ? "Preparing…" : "Split and download ZIP"}</button>
        {resultUrl && <a className="export-button secondary-button download-link" href={resultUrl} download={`${file?.name.replace(/\.[^.]+$/, "")}-segments.zip`}>Download segment ZIP</a>}
      </div>

      <div className="resize-preview audio-stage">
        <div className="preview-heading">
          <strong>Split timeline &amp; segments</strong>
          <span>{parsed.points.length + 1} clip(s) · {audio.duration.toFixed(3)} s</span>
        </div>
        <AudioSplitTimeline duration={audio.duration} points={parsed.points} onChange={(points) => setSplitPoints(points.join(", "))} />
        <ol className="clip-list">
          {[0, ...parsed.points, audio.duration].slice(0, -1).map((start, index) => {
            const end = [...parsed.points, audio.duration][index];
            return (
              <li key={`${start}-${end}`}>
                <span><strong>Part {String(index + 1).padStart(2, "0")}</strong><small>{start.toFixed(3)} s – {end.toFixed(3)} s · {(end - start).toFixed(3)} s</small></span>
              </li>
            );
          })}
        </ol>
        {url && <CustomMediaPreview kind="audio" src={url} label="Source audio preview" />}
      </div>
    </section>}
  </main>;
}
