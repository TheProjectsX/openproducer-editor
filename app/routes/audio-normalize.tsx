import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/audio-normalize";
import { normalizationGain } from "../lib/audio-normalization";
import { MediaImportScreen } from "../components/media-import-screen";
import { CustomMediaPreview } from "../components/custom-media-preview";

const MAX_BYTES = 512 * 1024 * 1024;
const CHUNK_FRAMES = 65_536;
type WorkerReply = { type: "analyzed"; id: number; peak: number } | { type: "ready"; id: number; header: ArrayBuffer } | { type: "encoded"; id: number; pcm: ArrayBuffer } | { type: "failed"; id: number; message: string };
let workerRequestId = 0;
const pendingWorkerReject = new WeakMap<Worker, (cause: Error) => void>();

function requestWorker(worker: Worker, message: Record<string, unknown>, transfer: Transferable[] = []): Promise<WorkerReply> {
  const id = ++workerRequestId;
  return new Promise((resolve, reject) => {
    const finish = () => { pendingWorkerReject.delete(worker); worker.onmessage = null; worker.onerror = null; };
    pendingWorkerReject.set(worker, (cause) => { finish(); reject(cause); });
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      if (event.data.id !== id) return;
      finish();
      if (event.data.type === "failed") reject(new Error(event.data.message));
      else resolve(event.data);
    };
    worker.onerror = (event) => { finish(); reject(new Error(event.message || "The audio worker stopped unexpectedly.")); };
    worker.postMessage({ ...message, id }, transfer);
  });
}

function terminateWorker(worker: Worker) {
  pendingWorkerReject.get(worker)?.(new Error("The audio worker was stopped."));
  worker.terminate();
}

export function meta({}: Route.MetaArgs) { return [{ title: "Normalize audio | Local Studio" }, { name: "description", content: "Normalize a local audio file to a custom peak level and export WAV." }]; }

export default function AudioNormalize() {
  const workerRef = useRef<Worker | null>(null);
  const cancelRef = useRef(false);
  const [file, setFile] = useState<File | null>(null), [audio, setAudio] = useState<AudioBuffer | null>(null);
  const [sourceUrl, setSourceUrl] = useState(""), [resultUrl, setResultUrl] = useState(""), [target, setTarget] = useState("-1");
  const [busy, setBusy] = useState(false), [rendering, setRendering] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState("");
  const [measuredPeak, setMeasuredPeak] = useState<number | null>(null);
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);
  useEffect(() => () => { if (workerRef.current) terminateWorker(workerRef.current); }, []);
  const valid = Boolean(audio && file) && Number.isFinite(Number(target)) && Number(target) >= -24 && Number(target) <= 0 && Boolean(audio && 44 + audio.length * audio.numberOfChannels * 2 <= MAX_BYTES);
  async function importAudio(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("audio/")) { setError("Choose an audio file."); return; }
    if (next.size > MAX_BYTES) { setError("Choose a source file up to 512 MiB."); return; }
    const context = new AudioContext(); setBusy(true); setError("");
    try {
      const decoded = await context.decodeAudioData(await next.arrayBuffer());
      if (decoded.length * decoded.numberOfChannels * 4 > MAX_BYTES) throw new Error("Decoded audio exceeds the 512 MiB memory limit.");
      setFile(next); setAudio(decoded); setSourceUrl(URL.createObjectURL(next)); setResultUrl(""); setMeasuredPeak(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not decode this audio file."); }
    finally { await context.close(); setBusy(false); }
  }
  async function render() {
    if (!audio || !valid) return;
    let worker: Worker;
    try {
      if (typeof Worker === "undefined") throw new Error("This browser does not support the audio worker required for normalization.");
      worker = new Worker(new URL("../workers/audio-normalize.worker.ts", import.meta.url), { type: "module" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start the local audio worker."); return; }
    workerRef.current = worker; cancelRef.current = false; setBusy(true); setRendering(true); setProgress(0); setError("");
    const chunks = Math.ceil(audio.length / CHUNK_FRAMES), channels = Array.from({ length: audio.numberOfChannels }, (_, channel) => audio.getChannelData(channel));
    const copyChunk = (offset: number, end: number) => channels.map((channel) => channel.subarray(offset, end).slice());
    const transferables = (data: Float32Array[]) => data.map((channel) => channel.buffer as ArrayBuffer);
    try {
      let peak = 0;
      for (let index = 0; index < chunks; index++) {
        if (cancelRef.current) throw new Error("Normalization cancelled.");
        const offset = index * CHUNK_FRAMES, end = Math.min(audio.length, offset + CHUNK_FRAMES), data = copyChunk(offset, end), transfer = transferables(data);
        const response = await requestWorker(worker, { type: "analyze", channels: transfer }, transfer);
        if (cancelRef.current) throw new Error("Normalization cancelled.");
        if (response.type !== "analyzed") throw new Error("The audio worker returned an invalid peak measurement.");
        peak = Math.max(peak, response.peak); setProgress(Math.round(((index + 1) / chunks) * 45));
      }
      setMeasuredPeak(peak);
      const gain = normalizationGain(peak, Number(target));
      const initialized = await requestWorker(worker, { type: "initialize", frames: audio.length, channels: audio.numberOfChannels, sampleRate: audio.sampleRate, gain });
      if (cancelRef.current) throw new Error("Normalization cancelled.");
      if (initialized.type !== "ready") throw new Error("The audio worker could not prepare a WAV export.");
      const parts: BlobPart[] = [initialized.header];
      for (let index = 0; index < chunks; index++) {
        if (cancelRef.current) throw new Error("Normalization cancelled.");
        const offset = index * CHUNK_FRAMES, end = Math.min(audio.length, offset + CHUNK_FRAMES), data = copyChunk(offset, end), transfer = transferables(data);
        const response = await requestWorker(worker, { type: "encode", channels: transfer }, transfer);
        if (cancelRef.current) throw new Error("Normalization cancelled.");
        if (response.type !== "encoded") throw new Error("The audio worker returned an invalid WAV block.");
        parts.push(response.pcm); setProgress(45 + Math.round(((index + 1) / chunks) * 55));
      }
      if (cancelRef.current) throw new Error("Normalization cancelled.");
      const result = new Blob(parts, { type: "audio/wav" });
      if (result.size > MAX_BYTES) throw new Error("The WAV export exceeds 512 MiB.");
      setResultUrl(URL.createObjectURL(result));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not normalize this audio."); }
    finally { terminateWorker(worker); workerRef.current = null; setBusy(false); setRendering(false); }
  }
  return <main className={`resize-page${audio ? " has-media" : ""}`}><header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/">All tools</a></nav></header>
    <section className="resize-intro"><p className="eyebrow">AUDIO · LOCAL PROCESSING</p><h1>Normalize audio peak level.</h1><p>Set a custom peak target and download a normalized WAV. The original remains unchanged.</p></section>
    {!audio ? <MediaImportScreen kind="audio" accept="audio/*" onFile={(next) => void importAudio(next)} error={error} /> : <section className="resize-workspace audio-tool-workspace"><div className="resize-controls">
      <label className="file-picker"><span>{busy ? "Processing…" : file ? "Choose another audio file" : "Choose audio file"}<input type="file" accept="audio/*" disabled={busy} onChange={(event) => void importAudio(event.currentTarget.files?.[0])} /></span></label>
      {audio && <p className="source-info">{file?.name} · {audio.duration.toFixed(2)} s · {audio.sampleRate} Hz · {audio.numberOfChannels} channel(s)</p>}
      <label className="speed-field">Target peak <span>−24 to 0 dBFS</span><input type="number" min="-24" max="0" step="any" value={target} disabled={!audio || busy} onChange={(event) => { setTarget(event.currentTarget.value); setResultUrl(""); }} /></label>
      {audio && <p className="resize-note">{measuredPeak === null ? "Peak measurement runs in a local worker during normalization." : `Measured source peak: ${measuredPeak ? `${(20 * Math.log10(measuredPeak)).toFixed(2)} dBFS` : "silent"}.`} The same linear gain is applied to every channel; samples are clamped to WAV range.</p>}
      {!valid && audio && <p className="resize-error" role="alert">Enter a target peak from −24 to 0 dBFS.</p>}{error && <p className="resize-error" role="alert">{error}</p>}
      {rendering && <><p className="source-info" role="status">Worker normalization: {progress}%</p><progress max="100" value={progress} aria-label="Audio normalization progress" /><button type="button" className="editor-action danger" onClick={() => { cancelRef.current = true; }}>Cancel normalization</button></>}
      <button className="secondary-button export-button" disabled={!valid || busy} onClick={() => void render()}>{rendering ? "Normalizing…" : "Normalize and preview"}</button>
      {resultUrl && <a className="export-button download-link" href={resultUrl} download={`${file?.name.replace(/\.[^.]+$/, "")}-normalized.wav`}>Download normalized WAV</a>}
    </div><div className="resize-preview"><div className="preview-heading"><strong>Audio comparison</strong><span>{resultUrl ? "Original and normalized" : "Original"}</span></div>{audio ? <div className="audio-preview"><strong>{file?.name}</strong><span>Original</span><CustomMediaPreview kind="audio" src={sourceUrl} label="Original audio" />{resultUrl && <><span>Normalized peak</span><CustomMediaPreview kind="audio" src={resultUrl} label="Normalized audio" /></>}</div> : <div className="empty-preview">Choose an audio file to begin.</div>}</div></section>}
  </main>;
}
