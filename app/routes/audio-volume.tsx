import { useEffect, useState } from "react";
import type { Route } from "./+types/audio-volume";

const MAX_BYTES = 512 * 1024 * 1024;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Audio volume and fades | Local Studio" },
    { name: "description", content: "Set audio gain and custom fade-in and fade-out durations locally." },
  ];
}

function applyVolume(source: AudioBuffer, gainDb: number, fadeIn: number, fadeOut: number) {
  const result = new AudioBuffer({ length: source.length, numberOfChannels: source.numberOfChannels, sampleRate: source.sampleRate });
  const gain = 10 ** (gainDb / 20), fadeInFrames = Math.round(fadeIn * source.sampleRate), fadeOutFrames = Math.round(fadeOut * source.sampleRate);
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel), output = result.getChannelData(channel);
    for (let frame = 0; frame < source.length; frame++) {
      const inGain = fadeInFrames ? Math.min(1, frame / fadeInFrames) : 1;
      const outGain = fadeOutFrames ? Math.min(1, (source.length - 1 - frame) / fadeOutFrames) : 1;
      output[frame] = input[frame] * gain * Math.max(0, Math.min(inGain, outGain));
    }
  }
  return result;
}

function encodeWav(audio: AudioBuffer) {
  const channels = audio.numberOfChannels, buffer = new ArrayBuffer(44 + audio.length * channels * 2), view = new DataView(buffer);
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

export default function AudioVolume() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<AudioBuffer | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [gain, setGain] = useState("0");
  const [fadeIn, setFadeIn] = useState("0");
  const [fadeOut, setFadeOut] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  async function chooseFile(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("audio/")) { setError("Choose an audio file."); return; }
    if (next.size > MAX_BYTES) { setError("Choose an audio file up to 512 MiB."); return; }
    setBusy(true); setError(""); setSource(null); setResultUrl("");
    const nextUrl = URL.createObjectURL(next), context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(await next.arrayBuffer());
      if (decoded.length * decoded.numberOfChannels * 4 > MAX_BYTES) throw new Error("Decoded audio exceeds the 512 MiB memory limit.");
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setFile(next); setSource(decoded); setSourceUrl(nextUrl); setFadeIn("0"); setFadeOut("0");
    } catch (cause) { URL.revokeObjectURL(nextUrl); setError(cause instanceof Error ? cause.message : "This audio could not be decoded."); }
    finally { await context.close(); setBusy(false); }
  }

  const numericGain = Number(gain), numericIn = Number(fadeIn), numericOut = Number(fadeOut);
  const valid = Boolean(source) && [numericGain, numericIn, numericOut].every(Number.isFinite)
    && numericGain >= -60 && numericGain <= 24 && numericIn >= 0 && numericIn <= (source?.duration ?? 0)
    && numericOut >= 0 && numericOut <= (source?.duration ?? 0) && numericIn + numericOut <= (source?.duration ?? 0);

  function update(setter: (value: string) => void, value: string) {
    setter(value); if (resultUrl) URL.revokeObjectURL(resultUrl); setResultUrl("");
  }

  function render() {
    if (!source || !valid) return;
    setBusy(true); setError("");
    window.setTimeout(() => {
      try {
        const result = applyVolume(source, numericGain, numericIn, numericOut), blob = encodeWav(result);
        if (blob.size > MAX_BYTES) throw new Error("The WAV export exceeds the 512 MiB output limit.");
        setResultUrl(URL.createObjectURL(blob));
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not process this audio."); }
      finally { setBusy(false); }
    }, 20);
  }

  return <main className="resize-page">
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/">All tools</a></nav></header>
    <section className="resize-intro"><p className="eyebrow">AUDIO · LOCAL PROCESSING</p><h1>Adjust volume and fades</h1><p>Set custom gain and fade durations, then compare the result and download a WAV.</p></section>
    <section className="resize-workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>{busy ? "Processing…" : file ? "Choose another audio file" : "Choose audio file"}<input type="file" accept="audio/*" disabled={busy} onChange={(event) => void chooseFile(event.currentTarget.files?.[0])} /></span></label>
        {source && <p className="source-info">{file?.name} · {source.duration.toFixed(2)} s · {source.sampleRate} Hz · {source.numberOfChannels} channel(s)</p>}
        <div className="filter-fields two-column">
          <label>Gain <span>−60 to +24 dB</span><input type="number" min="-60" max="24" step="any" value={gain} onChange={(event) => update(setGain, event.currentTarget.value)} /></label>
          <label>Fade in <span>custom seconds</span><input type="number" min="0" max={source?.duration ?? 0} step="any" value={fadeIn} onChange={(event) => update(setFadeIn, event.currentTarget.value)} /></label>
          <label>Fade out <span>custom seconds</span><input type="number" min="0" max={source?.duration ?? 0} step="any" value={fadeOut} onChange={(event) => update(setFadeOut, event.currentTarget.value)} /></label>
        </div>
        <p className="resize-note">The two fades must fit within the audio duration. Gain above 0 dB can clip; export clamps samples to WAV’s supported range.</p>
        {!valid && source && <p className="resize-error" role="alert">Enter valid gain and fade values within the source duration.</p>}{error && <p className="resize-error" role="alert">{error}</p>}
        <button className="export-button" disabled={!valid || busy} onClick={render}>{busy ? "Processing…" : "Preview volume and fades"}</button>
        {resultUrl && <a className="export-button download-link" href={resultUrl} download={`${file?.name.replace(/\.[^.]+$/, "")}-volume-fades.wav`}>Download WAV</a>}
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>Audio comparison</strong><span>{resultUrl ? "Original and processed" : "Original"}</span></div>{source ? <div className="audio-preview"><strong>{file?.name}</strong><audio className="audio-player" controls src={sourceUrl} /><span>Original audio</span>{resultUrl && <><audio className="audio-player" controls src={resultUrl} /><span>Gain and fades</span></>}</div> : <div className="empty-preview">Choose audio to begin.</div>}</div>
    </section>
  </main>;
}
