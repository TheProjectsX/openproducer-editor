import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useState } from "react";
import type { Route } from "./+types/audio-vocal-reducer";
import { MediaImportScreen } from "../components/media-import-screen";
import { CustomMediaPreview } from "../components/custom-media-preview";

const MAX_FILE_BYTES = 512 * 1024 * 1024;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Reduce centered vocals | OpenProducer Editor" },
    { name: "description", content: "Reduce centered vocals in stereo audio with an adjustable karaoke-style filter." },
  ];
}

function reduceCenter(source: AudioBuffer, amount: number) {
  const result = new AudioBuffer({ length: source.length, numberOfChannels: source.numberOfChannels, sampleRate: source.sampleRate });
  const mix = amount / 100;
  const left = source.getChannelData(0), right = source.getChannelData(1);
  const outLeft = result.getChannelData(0), outRight = result.getChannelData(1);
  for (let frame = 0; frame < source.length; frame++) {
    const center = (left[frame] + right[frame]) / 2;
    outLeft[frame] = left[frame] - center * mix;
    outRight[frame] = right[frame] - center * mix;
  }
  for (let channel = 2; channel < source.numberOfChannels; channel++) result.getChannelData(channel).set(source.getChannelData(channel));
  return result;
}

function encodeWav(audio: AudioBuffer) {
  const channels = audio.numberOfChannels; const buffer = new ArrayBuffer(44 + audio.length * channels * 2); const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, audio.sampleRate, true); view.setUint32(28, audio.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, buffer.byteLength - 44, true);
  let offset = 44;
  for (let frame = 0; frame < audio.length; frame++) for (let channel = 0; channel < channels; channel++) {
    const sample = Math.max(-1, Math.min(1, audio.getChannelData(channel)[frame]));
    view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export default function VocalReducer() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<AudioBuffer | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [amount, setAmount] = useState("80");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  async function chooseFile(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("audio/")) { setError("Choose an audio file."); return; }
    if (next.size > MAX_FILE_BYTES) { setError("Choose an audio file up to 512 MiB."); return; }
    setBusy(true); setError(""); setSource(null); setResultUrl("");
    const nextUrl = URL.createObjectURL(next); const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(await next.arrayBuffer());
      if (decoded.numberOfChannels < 2) throw new Error("Center-channel vocal reduction requires a stereo source. Mono audio has no left/right center information to cancel.");
      if (decoded.length * decoded.numberOfChannels * 4 > MAX_FILE_BYTES) throw new Error("Decoded audio exceeds the 512 MiB memory limit.");
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setSource(decoded); setFile(next); setSourceUrl(nextUrl);
    } catch (cause) { URL.revokeObjectURL(nextUrl); setError(cause instanceof Error ? cause.message : "This audio could not be decoded."); }
    finally { await context.close(); setBusy(false); }
  }

  function exportReduced() {
    if (!source || !file || !Number.isFinite(Number(amount)) || Number(amount) < 0 || Number(amount) > 100) return;
    setBusy(true); setError("");
    window.setTimeout(() => {
      try {
        const blob = encodeWav(reduceCenter(source, Number(amount)));
        if (blob.size > MAX_FILE_BYTES) throw new Error("The resulting WAV exceeds the 512 MiB output limit.");
        if (resultUrl) URL.revokeObjectURL(resultUrl);
        setResultUrl(URL.createObjectURL(blob));
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not process the selected audio."); }
      finally { setBusy(false); }
    }, 20);
  }

  const validAmount = Number.isFinite(Number(amount)) && Number(amount) >= 0 && Number(amount) <= 100;
  return <main className={`resize-page audio-tool-page${source ? " has-media" : ""}`}>
    <ToolPageHeader status={source ? `${amount}% center cancel` : undefined} />
    <section className="resize-intro">
      <p className="eyebrow">AUDIO · LOCAL PROCESSING</p>
      <h1>Reduce centered vocals</h1>
      <p>Try a custom-strength stereo center cancel on a local audio file. Processing never uploads your source.</p>
    </section>
    {!source ? <MediaImportScreen kind="audio" accept="audio/*" onFile={(next) => void chooseFile(next)} error={error} /> : <section className="resize-workspace audio-tool-workspace">
      <div className="resize-controls">
        <div className="audio-file-bar">
          <div className="audio-file-meta">
            <strong>{file?.name}</strong>
            <span>Stereo · {source.duration.toFixed(3)} s · {source.sampleRate} Hz</span>
          </div>
          <label className="audio-file-change">
            <span>Change file</span>
            <input type="file" accept="audio/*" disabled={busy} onChange={(event) => void chooseFile(event.currentTarget.files?.[0])} />
          </label>
        </div>

        <div className="audio-control-group">
          <p className="audio-control-group-title">Stereo center cancel</p>
          <label className="speed-field">Center reduction <span>0–100%</span><input type="number" min="0" max="100" step="any" value={amount} onChange={(event) => { setAmount(event.currentTarget.value); if (resultUrl) URL.revokeObjectURL(resultUrl); setResultUrl(""); }} /></label>
        </div>

        <div className="audio-output-summary">
          <div>
            <span>Reduction</span>
            <strong>{validAmount ? `${amount}%` : "—"}</strong>
          </div>
          <div>
            <span>Format</span>
            <strong>Stereo WAV</strong>
          </div>
        </div>

        <p className="resize-note">Subtracts shared center signal from left and right. Affects centered vocals, bass, and drums; not AI stem separation.</p>
        {!validAmount && <p className="resize-error" role="alert">Enter a custom amount from 0% to 100%.</p>}
        {error && <p className="resize-error" role="alert">{error}</p>}
        <button className="export-button" disabled={!source || !validAmount || busy} onClick={exportReduced}>{busy ? "Processing…" : "Create vocal-reduced preview"}</button>
        {resultUrl && <a className="export-button secondary-button download-link" href={resultUrl} download={`${file?.name.replace(/\.[^.]+$/, "")}-center-reduced.wav`}>Download WAV</a>}
      </div>

      <div className="resize-preview audio-stage">
        <div className="preview-heading">
          <strong>Audio comparison</strong>
          <span>{resultUrl ? "Original and processed" : "Original"}</span>
        </div>
        <div className="audio-preview">
          <CustomMediaPreview kind="audio" src={sourceUrl} label="Original stereo audio" />
          {resultUrl && <CustomMediaPreview kind="audio" src={resultUrl} label="Center-reduced audio" />}
        </div>
      </div>
    </section>}
  </main>;
}
