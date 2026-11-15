import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/studio-audio";
import { getProject, readAudioAsset, saveAudioProject, type AudioProjectDocument } from "../lib/project-store";
import { inspectMediaFile } from "../lib/media-inspection";
import { PITCH_PRESERVE_RENDER_CHUNK_FRAMES } from "../lib/audio-speed";

const MAX_SOURCE_BYTES = 256 * 1024 * 1024;
const MAX_BUFFER_BYTES = 512 * 1024 * 1024;
const EMPTY: AudioProjectDocument = { version: 1, sourceAssetId: null, sourceName: "", sourceType: "", sourceDuration: 0, sourceStart: 0, sourceEnd: 0, speed: 1, pitchMode: "preserve", gainDb: 0, fadeIn: 0, fadeOut: 0 };

export function meta({}: Route.MetaArgs) {
  return [{ title: "Audio Studio | Local Studio" }, { name: "robots", content: "noindex,nofollow" }];
}

function wavBlob(left: Float32Array, right: Float32Array, sampleRate: number) {
  const frames = Math.min(left.length, right.length), bytes = new ArrayBuffer(44 + frames * 4), view = new DataView(bytes);
  const text = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true); text(8, "WAVE"); text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, frames * 4, true);
  let offset = 44;
  for (let index = 0; index < frames; index++) for (const channel of [left, right]) {
    const sample = Math.max(-1, Math.min(1, channel[index])); view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2;
  }
  return new Blob([bytes], { type: "audio/wav" });
}

export default function AudioStudio() {
  const [params] = useSearchParams();
  const projectId = params.get("project") ?? "";
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<HTMLAudioElement>(null);
  const previewContextRef = useRef<AudioContext | null>(null);
  const previewGainRef = useRef<GainNode | null>(null);
  const previewSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const cancelRef = useRef(false);
  const [document, setDocument] = useState<AudioProjectDocument>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) { setError("Open an audio workspace from Projects to save edits."); setLoaded(true); return; }
    let cancelled = false;
    void (async () => {
      try {
        const project = await getProject(projectId);
        if (!project || project.kind !== "audio") throw new Error("This audio project is missing or unavailable.");
        const saved = project.audioDocument ?? EMPTY;
        let restoredFile: File | null = null;
        if (saved.sourceAssetId) restoredFile = await readAudioAsset(saved.sourceAssetId);
        if (restoredFile) {
          const context = new AudioContext();
          try { const decoded = await context.decodeAudioData(await restoredFile.arrayBuffer()); if (cancelled) return; setBuffer(decoded); setFile(restoredFile); setSourceUrl(URL.createObjectURL(restoredFile)); }
          finally { await context.close(); }
        } else if (saved.sourceAssetId) setStatus("The saved source audio is missing. Re-import the original file to continue.");
        if (!cancelled) { setDocument(saved); setLoaded(true); setStatus(restoredFile ? "Audio project reopened from this device." : "Audio project ready on this device."); }
      } catch (cause) { if (!cancelled) { setError(cause instanceof Error ? cause.message : "Could not open the audio project."); setLoaded(true); } }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!loaded || !projectId) return;
    const timeout = window.setTimeout(() => void saveAudioProject(projectId, document)
      .then(() => setStatus("Audio edits saved on this device."))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not save the audio project.")), 350);
    return () => window.clearTimeout(timeout);
  }, [document, loaded, projectId]);

  useEffect(() => {
    const canvas = waveformRef.current;
    if (!canvas || !buffer) return;
    const context = canvas.getContext("2d"); if (!context) return;
    const width = Math.max(300, canvas.clientWidth * devicePixelRatio), height = 150;
    canvas.width = width; canvas.height = height; context.fillStyle = "#111827"; context.fillRect(0, 0, width, height);
    context.strokeStyle = "#7de3c5"; context.lineWidth = 1;
    const samples = buffer.getChannelData(0), step = Math.max(1, Math.floor(samples.length / width));
    context.beginPath();
    for (let x = 0; x < width; x++) {
      let peak = 0; const start = x * step;
      for (let index = start; index < Math.min(samples.length, start + step); index++) peak = Math.max(peak, Math.abs(samples[index]));
      const y = height / 2, amplitude = peak * height * 0.46; context.moveTo(x, y - amplitude); context.lineTo(x, y + amplitude);
    }
    context.stroke();
    const start = buffer.duration ? document.sourceStart / buffer.duration * width : 0;
    const end = buffer.duration ? document.sourceEnd / buffer.duration * width : width;
    context.fillStyle = "rgba(245, 158, 11, 0.2)"; context.fillRect(0, 0, start, height); context.fillRect(end, 0, width - end, height);
  }, [buffer, document.sourceStart, document.sourceEnd]);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);
  useEffect(() => () => {
    previewSourceRef.current?.disconnect();
    previewGainRef.current?.disconnect();
    void previewContextRef.current?.close();
  }, []);

  const sourceLength = document.sourceEnd - document.sourceStart;
  const outputDuration = sourceLength > 0 && document.speed > 0 ? sourceLength / document.speed : 0;
  const valid = Boolean(buffer && file) && Number.isFinite(document.sourceStart) && Number.isFinite(document.sourceEnd)
    && document.sourceStart >= 0 && document.sourceEnd > document.sourceStart && document.sourceEnd <= document.sourceDuration
    && Number.isFinite(document.speed) && document.speed >= 0.1 && document.speed <= 16
    && Number.isFinite(document.gainDb) && document.gainDb >= -60 && document.gainDb <= 24
    && document.fadeIn >= 0 && document.fadeOut >= 0 && document.fadeIn + document.fadeOut <= outputDuration
    && outputDuration * (buffer?.sampleRate ?? 48_000) * 8 <= MAX_BUFFER_BYTES;
  const selectionLabel = useMemo(() => buffer ? `${document.sourceStart.toFixed(2)}–${document.sourceEnd.toFixed(2)} s` : "Import audio to begin", [buffer, document.sourceStart, document.sourceEnd]);

  async function importAudio(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("audio/")) { setError("Choose an audio file."); return; }
    if (next.size > MAX_SOURCE_BYTES) { setError("Choose an audio source up to 256 MiB."); return; }
    setBusy(true); setError(""); setResultUrl("");
    const context = new AudioContext();
    try {
      const inspection = await inspectMediaFile(next);
      if (!inspection.tracks.some((track) => track.kind === "audio")) throw new Error("This file has no audio track.");
      const decoded = await context.decodeAudioData(await next.arrayBuffer());
      if (decoded.length * decoded.numberOfChannels * 4 > MAX_BUFFER_BYTES) throw new Error("Decoded audio exceeds the 512 MiB working-memory limit.");
      const nextDocument: AudioProjectDocument = { ...EMPTY, sourceAssetId: projectId, sourceName: next.name, sourceType: next.type, sourceDuration: decoded.duration, sourceEnd: decoded.duration };
      await saveAudioProject(projectId, nextDocument, next);
      setFile(next); setBuffer(decoded); setSourceUrl(URL.createObjectURL(next)); setDocument(nextDocument); setLoaded(true);
      setStatus(`Audio imported and saved locally. ${inspection.container}, ${inspection.tracks.filter((track) => track.kind === "audio").map((track) => track.codec).join(", ")} decoder support confirmed.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "This browser could not decode the audio file."); }
    finally { await context.close(); setBusy(false); }
  }

  function update<K extends keyof AudioProjectDocument>(key: K, value: AudioProjectDocument[K]) {
    setDocument((current) => ({ ...current, [key]: value })); setResultUrl("");
  }

  function ensurePreviewGraph(player: HTMLAudioElement) {
    let context = previewContextRef.current;
    if (!context) {
      context = new AudioContext();
      const gain = context.createGain();
      const source = context.createMediaElementSource(player);
      source.connect(gain).connect(context.destination);
      previewContextRef.current = context;
      previewGainRef.current = gain;
      previewSourceRef.current = source;
    }
    return context;
  }

  function preview() {
    const player = playerRef.current; if (!player || !valid) return;
    const context = ensurePreviewGraph(player);
    player.currentTime = document.sourceStart; player.playbackRate = document.speed;
    player.preservesPitch = document.pitchMode === "preserve";
    void context.resume().then(() => player.play()).catch(() => setError("Audio preview was blocked. Press Play again to allow local audio playback."));
  }

  function schedulePreviewEnvelope() {
    const player = playerRef.current;
    if (!player || !valid || !document.speed) return;
    const context = ensurePreviewGraph(player), gain = previewGainRef.current;
    void context.resume().catch(() => setError("Audio preview was blocked. Press Play again to allow local audio playback."));
    if (!gain) return;
    const now = context.currentTime;
    const target = 10 ** (document.gainDb / 20);
    const elapsed = Math.max(0, (player.currentTime - document.sourceStart) / document.speed);
    const remaining = Math.max(0, (document.sourceEnd - player.currentTime) / document.speed);
    const fadeInRemaining = Math.max(0, document.fadeIn - elapsed);
    const fadeOut = Math.min(document.fadeOut, remaining);
    const fadeOutStart = Math.max(0, remaining - fadeOut);
    const param = gain.gain;
    param.cancelScheduledValues(now);
    if (fadeInRemaining > 0) {
      param.setValueAtTime(target * (elapsed / document.fadeIn), now);
      param.linearRampToValueAtTime(target, now + fadeInRemaining);
    } else param.setValueAtTime(target, now);
    if (fadeOut > 0 && fadeOutStart >= fadeInRemaining) {
      param.setValueAtTime(target, now + fadeOutStart);
      param.linearRampToValueAtTime(0, now + remaining);
    }
  }

  async function exportWav() {
    if (!buffer || !valid) return;
    setBusy(true); setExporting(true); setProgress(0); setError(""); cancelRef.current = false;
    const first = Math.max(0, Math.floor(document.sourceStart * buffer.sampleRate));
    const last = Math.min(buffer.length, Math.ceil(document.sourceEnd * buffer.sampleRate));
    const inputFrames = last - first, outputFrames = Math.ceil(inputFrames / document.speed);
    let left: Float32Array, right: Float32Array;
    try {
      if (document.pitchMode === "preserve") {
        const { BungeeStretcher, compileBungee, instantiateBungee, Transport } = await import("bungee-web");
        const wasmUrl = (await import("bungee-web/bungee.wasm?url")).default;
        const wasm = await instantiateBungee(await compileBungee(fetch(wasmUrl)));
        const stretcher = new BungeeStretcher(wasm, { sampleRate: buffer.sampleRate, channels: 2 });
        try {
          const leftSource = buffer.getChannelData(0).slice(first, last);
          const rightSource = (buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)).slice(first, last);
          const transport = new Transport(stretcher, inputFrames); transport.setSource("source", { left: leftSource, right: rightSource }); transport.speed = document.speed; transport.play();
          left = new Float32Array(outputFrames); right = new Float32Array(outputFrames);
          for (let offset = 0; offset < outputFrames; offset += PITCH_PRESERVE_RENDER_CHUNK_FRAMES) {
            if (cancelRef.current) throw new Error("Export cancelled.");
            const length = Math.min(PITCH_PRESERVE_RENDER_CHUNK_FRAMES, outputFrames - offset), blockLeft = new Float32Array(length), blockRight = new Float32Array(length);
            transport.render(blockLeft, blockRight, length); left.set(blockLeft, offset); right.set(blockRight, offset);
            setProgress(Math.round((offset / outputFrames) * 85)); await new Promise((resolve) => setTimeout(resolve, 0));
          }
        } finally { stretcher.destroy(); }
      } else {
        left = new Float32Array(outputFrames); right = new Float32Array(outputFrames);
        const l = buffer.getChannelData(0), r = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : l;
        for (let offset = 0; offset < outputFrames; offset += 8192) {
          if (cancelRef.current) throw new Error("Export cancelled.");
          for (let index = offset; index < Math.min(outputFrames, offset + 8192); index++) {
            const position = first + index * document.speed, a = Math.floor(position), b = Math.min(last - 1, a + 1), mix = position - a;
            left[index] = l[a] + (l[b] - l[a]) * mix; right[index] = r[a] + (r[b] - r[a]) * mix;
          }
          setProgress(Math.round((offset / outputFrames) * 85)); await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      const gain = 10 ** (document.gainDb / 20), fadeInFrames = Math.round(document.fadeIn * buffer.sampleRate), fadeOutFrames = Math.round(document.fadeOut * buffer.sampleRate);
      for (let offset = 0; offset < outputFrames; offset += 4096) {
        if (cancelRef.current) throw new Error("Export cancelled.");
        for (let index = offset; index < Math.min(outputFrames, offset + 4096); index++) {
          const inGain = fadeInFrames ? Math.min(1, index / fadeInFrames) : 1;
          const outGain = fadeOutFrames ? Math.min(1, (outputFrames - 1 - index) / fadeOutFrames) : 1;
          const amount = gain * Math.max(0, Math.min(inGain, outGain)); left[index] *= amount; right[index] *= amount;
        }
        setProgress(85 + Math.round((Math.min(outputFrames, offset + 4096) / outputFrames) * 15)); await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const blob = wavBlob(left, right, buffer.sampleRate);
      if (blob.size > MAX_BUFFER_BYTES) throw new Error("The WAV export exceeds the 512 MiB output limit.");
      setResultUrl(URL.createObjectURL(blob)); setProgress(100); setStatus("WAV export is ready to download.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not render the audio project."); }
    finally { setBusy(false); setExporting(false); }
  }

  return <main className="resize-page">
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/projects">Projects</a></nav><span role="status">{status}</span></header>
    <section className="resize-intro"><p className="eyebrow">LOCAL AUDIO STUDIO</p><h1>Audio Studio</h1><p>Trim and shape a local audio source. Edits and source audio are saved in this browser.</p></section>
    <section className="resize-workspace" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void importAudio(event.dataTransfer.files?.[0]); }}>
      <div className="resize-controls">
        <label className="file-picker"><span>{busy ? "Processing…" : file ? "Choose another audio file" : "Import audio"}<input type="file" accept="audio/*" disabled={busy} onChange={(event) => void importAudio(event.currentTarget.files?.[0])} /></span></label>
        {file && <p className="source-info">{file.name} · {document.sourceDuration.toFixed(2)} s · {buffer?.sampleRate} Hz · {buffer?.numberOfChannels} channel(s)</p>}
        <div className="filter-fields two-column">
          <label>Start <span>source seconds</span><input type="number" min="0" max={document.sourceDuration} step="any" value={document.sourceStart} disabled={!buffer || busy} onChange={(event) => update("sourceStart", event.currentTarget.valueAsNumber)} /></label>
          <label>End <span>source seconds</span><input type="number" min="0" max={document.sourceDuration} step="any" value={document.sourceEnd} disabled={!buffer || busy} onChange={(event) => update("sourceEnd", event.currentTarget.valueAsNumber)} /></label>
          <label>Speed <span>0.1×–16×</span><input type="number" min="0.1" max="16" step="any" value={document.speed} disabled={!buffer || busy} onChange={(event) => update("speed", event.currentTarget.valueAsNumber)} /></label>
          <label>Gain <span>−60 to +24 dB</span><input type="number" min="-60" max="24" step="any" value={document.gainDb} disabled={!buffer || busy} onChange={(event) => update("gainDb", event.currentTarget.valueAsNumber)} /></label>
          <label>Fade in <span>output seconds</span><input type="number" min="0" max={outputDuration} step="any" value={document.fadeIn} disabled={!buffer || busy} onChange={(event) => update("fadeIn", event.currentTarget.valueAsNumber)} /></label>
          <label>Fade out <span>output seconds</span><input type="number" min="0" max={outputDuration} step="any" value={document.fadeOut} disabled={!buffer || busy} onChange={(event) => update("fadeOut", event.currentTarget.valueAsNumber)} /></label>
        </div>
        <label className="ratio-field">Pitch mode<select value={document.pitchMode} disabled={!buffer || busy} onChange={(event) => update("pitchMode", event.currentTarget.value as AudioProjectDocument["pitchMode"])}><option value="preserve">Preserve pitch</option><option value="natural">Natural pitch shift</option></select></label>
        <p className="resize-note">Selection: {selectionLabel} · estimated output {outputDuration.toFixed(2)} s. Pitch is preserved by default. Audio renders locally in memory with a 512 MiB output cap.</p>
        {buffer && !valid && <p className="resize-error" role="alert">Enter a valid source range, speed, gain, and fades within the displayed limits.</p>}{error && <p className="resize-error" role="alert">{error}</p>}
        <button className="secondary-button export-button" disabled={!valid || busy} onClick={preview}>Preview selection</button>
        {exporting && <><p role="status" className="source-info">Rendering audio: {progress}%</p><progress max="100" value={progress} aria-label="Audio export progress" /><button className="editor-action danger" onClick={() => { cancelRef.current = true; }}>Cancel export</button></>}
        <button className="export-button" disabled={!valid || busy} onClick={() => void exportWav()}>Render WAV</button>
        {resultUrl && <a className="export-button download-link" href={resultUrl} download={`${file?.name.replace(/\.[^.]+$/, "")}-edited.wav`}>Download WAV</a>}
        {sourceUrl && <audio ref={playerRef} className="audio-player" controls src={sourceUrl} onPlay={schedulePreviewEnvelope} onTimeUpdate={() => { if (playerRef.current && playerRef.current.currentTime >= document.sourceEnd) playerRef.current.pause(); }} />}
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>Audio waveform</strong><span>{buffer ? `${buffer.duration.toFixed(2)} s` : "Import audio to begin"}</span></div>{buffer ? <canvas ref={waveformRef} className="audio-waveform" aria-label="Audio waveform and selected range" /> : <div className="empty-preview">The waveform and selected range will appear here.</div>}{resultUrl && <audio className="audio-player" controls src={resultUrl} aria-label="Rendered audio preview" />}</div>
    </section>
  </main>;
}
