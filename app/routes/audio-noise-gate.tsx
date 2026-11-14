import { useEffect, useMemo, useState } from "react";
import type { Route } from "./+types/audio-noise-gate";

const MAX_FILE_BYTES = 512 * 1024 * 1024;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Audio noise gate | Local Studio" },
    { name: "description", content: "Reduce quiet background noise with custom local audio gate controls." },
  ];
}

function cleanAudio(source: AudioBuffer, thresholdDb: number, reductionPercent: number, attackMs: number, releaseMs: number) {
  const threshold = 10 ** (thresholdDb / 20);
  const floorGain = 1 - reductionPercent / 100;
  const kneeLowDb = thresholdDb - 6, kneeHighDb = thresholdDb + 6;
  const attack = Math.exp(-1 / (source.sampleRate * attackMs / 1000));
  const release = Math.exp(-1 / (source.sampleRate * releaseMs / 1000));
  const rendered = new AudioBuffer({ length: source.length, numberOfChannels: source.numberOfChannels, sampleRate: source.sampleRate });
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel);
    const output = rendered.getChannelData(channel);
    let envelope = 0;
    for (let frame = 0; frame < source.length; frame++) {
      const sample = input[frame];
      const magnitude = Math.abs(sample);
      const coefficient = magnitude > envelope ? attack : release;
      envelope = coefficient * envelope + (1 - coefficient) * magnitude;
      const envelopeDb = 20 * Math.log10(Math.max(envelope, 1e-8));
      const amount = Math.min(1, Math.max(0, (envelopeDb - kneeLowDb) / (kneeHighDb - kneeLowDb)));
      const gain = floorGain + (1 - floorGain) * amount;
      output[frame] = sample * gain;
    }
  }
  return rendered;
}

function audioToWav(audio: AudioBuffer) {
  const channels = audio.numberOfChannels;
  const buffer = new ArrayBuffer(44 + audio.length * channels * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, buffer.byteLength - 44, true);
  let offset = 44;
  for (let frame = 0; frame < audio.length; frame++) for (let channel = 0; channel < channels; channel++) {
    const sample = Math.max(-1, Math.min(1, audio.getChannelData(channel)[frame]));
    view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export default function AudioNoiseGate() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<AudioBuffer | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [cleaned, setCleaned] = useState<AudioBuffer | null>(null);
  const [cleanedUrl, setCleanedUrl] = useState("");
  const [threshold, setThreshold] = useState("-42");
  const [reduction, setReduction] = useState("90");
  const [attack, setAttack] = useState("8");
  const [release, setRelease] = useState("180");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (cleanedUrl) URL.revokeObjectURL(cleanedUrl); }, [cleanedUrl]);
  const settings = useMemo(() => [Number(threshold), Number(reduction), Number(attack), Number(release)], [threshold, reduction, attack, release]);
  const valid = settings.every(Number.isFinite) && settings[0] >= -90 && settings[0] <= 0 && settings[1] >= 0 && settings[1] <= 100 && settings[2] >= 1 && settings[2] <= 500 && settings[3] >= 5 && settings[3] <= 2000;

  function updateControl(setter: (value: string) => void, value: string) {
    setter(value); setCleaned(null);
    if (cleanedUrl) URL.revokeObjectURL(cleanedUrl);
    setCleanedUrl("");
  }

  async function chooseFile(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("audio/")) { setError("Choose an audio file."); return; }
    if (next.size > MAX_FILE_BYTES) { setError("Choose an audio file up to 512 MiB."); return; }
    setBusy(true); setError(""); setSource(null); setCleaned(null); setCleanedUrl("");
    const nextUrl = URL.createObjectURL(next); const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(await next.arrayBuffer());
      if (decoded.length * decoded.numberOfChannels * 4 > MAX_FILE_BYTES) throw new Error("Decoded audio exceeds the 512 MiB memory limit.");
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setFile(next); setSource(decoded); setSourceUrl(nextUrl);
    } catch (cause) { URL.revokeObjectURL(nextUrl); setError(cause instanceof Error ? cause.message : "This audio format could not be decoded."); }
    finally { await context.close(); setBusy(false); }
  }

  function renderCleanup() {
    if (!source || !valid) return;
    setBusy(true); setError("");
    window.setTimeout(() => {
      try {
        const result = cleanAudio(source, settings[0], settings[1], settings[2], settings[3]);
        if (cleanedUrl) URL.revokeObjectURL(cleanedUrl);
        setCleaned(result); setCleanedUrl(URL.createObjectURL(audioToWav(result)));
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not process this audio."); }
      finally { setBusy(false); }
    }, 20);
  }

  return <main className="resize-page">
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/">All tools</a></nav></header>
    <section className="resize-intro"><p className="eyebrow">AUDIO · LOCAL PROCESSING</p><h1>Reduce quiet background noise</h1><p>Adjust a broadband noise gate with custom values, then preview and download the result. Audio never leaves this browser.</p></section>
    <section className="resize-workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>{busy ? "Processing…" : file ? "Choose another audio file" : "Choose audio file"}<input type="file" accept="audio/*" disabled={busy} onChange={(event) => void chooseFile(event.currentTarget.files?.[0])} /></span></label>
        {source && <p className="source-info">{file?.name} · {source.duration.toFixed(2)} s · {source.sampleRate} Hz · {source.numberOfChannels} channel(s)</p>}
        <div className="filter-fields two-column">
          <label>Gate threshold <span>−90 to 0 dB</span><input type="number" min="-90" max="0" step="any" value={threshold} onChange={(event) => updateControl(setThreshold, event.currentTarget.value)} /></label>
          <label>Noise reduction <span>0–100%</span><input type="number" min="0" max="100" step="any" value={reduction} onChange={(event) => updateControl(setReduction, event.currentTarget.value)} /></label>
          <label>Attack <span>1–500 ms</span><input type="number" min="1" max="500" step="any" value={attack} onChange={(event) => updateControl(setAttack, event.currentTarget.value)} /></label>
          <label>Release <span>5–2,000 ms</span><input type="number" min="5" max="2000" step="any" value={release} onChange={(event) => updateControl(setRelease, event.currentTarget.value)} /></label>
        </div>
        <p className="resize-note">A broadband gate attenuates quieter sounds under your threshold. It is not neural denoising and may affect quiet speech. Processing uses a full in-memory audio buffer.</p>
        {!valid && <p className="resize-error" role="alert">Enter values within each control’s listed range.</p>}
        {error && <p className="resize-error" role="alert">{error}</p>}
        <button className="export-button" disabled={!source || !valid || busy} onClick={renderCleanup}>{busy ? "Processing…" : "Preview cleanup"}</button>
        {cleaned && <a className="export-button download-link" href={cleanedUrl} download={`${file?.name.replace(/\.[^.]+$/, "")}-noise-gated.wav`}>Download cleaned WAV</a>}
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>Audio preview</strong><span>{cleaned ? "Compare original and processed" : "Original"}</span></div>{source ? <div className="audio-preview"><strong>{file?.name}</strong><audio className="audio-player" controls src={sourceUrl} /><span>Original audio</span>{cleanedUrl && <><audio className="audio-player" controls src={cleanedUrl} /><span>Noise-gated preview</span></>}</div> : <div className="empty-preview">Choose an audio file to begin.</div>}</div>
    </section>
  </main>;
}
