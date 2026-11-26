import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/audio-noise-gate";
import { MediaImportScreen } from "../components/media-import-screen";
import { CustomMediaPreview } from "../components/custom-media-preview";
import { AudioRangeTimeline } from "../components/audio-range-timeline";

const MAX_FILE_BYTES = 128 * 1024 * 1024;
const MAX_DECODED_BYTES = 64 * 1024 * 1024;

type DenoiseWorkerMessage = { type: "progress"; jobId: number; progress: number }
  | { type: "complete"; jobId: number; wav: ArrayBuffer }
  | { type: "error"; jobId: number; message: string };

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Audio noise reduction | OpenProducer Editor" },
    { name: "description", content: "Reduce steady background noise with a local noise profile and custom strength." },
  ];
}

export default function AudioNoiseGate() {
  const workerRef = useRef<Worker | null>(null);
  const nextJobId = useRef(0);
  const activeJobId = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<AudioBuffer | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [cleanedUrl, setCleanedUrl] = useState("");
  const [noiseStart, setNoiseStart] = useState("0");
  const [noiseEnd, setNoiseEnd] = useState("0.5");
  const [strength, setStrength] = useState("80");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (cleanedUrl) URL.revokeObjectURL(cleanedUrl); }, [cleanedUrl]);
  useEffect(() => () => workerRef.current?.terminate(), []);

  const settings = useMemo(() => [Number(noiseStart), Number(noiseEnd), Number(strength)], [noiseStart, noiseEnd, strength]);
  const profileFrames = source ? (settings[1] - settings[0]) * source.sampleRate : 0;
  const valid = Boolean(source && file) && settings.every(Number.isFinite) && settings[0] >= 0 && settings[1] <= (source?.duration ?? 0)
    && profileFrames >= 2048 && settings[2] >= 0 && settings[2] <= 100;

  function clearResult() {
    if (cleanedUrl) URL.revokeObjectURL(cleanedUrl);
    setCleanedUrl(""); setProgress(0);
  }

  function updateControl(setter: (value: string) => void, value: string) {
    setter(value); clearResult();
  }

  async function chooseFile(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("audio/")) { setError("Choose an audio file."); return; }
    if (next.size > MAX_FILE_BYTES) { setError("Choose an audio file smaller than 128 MiB."); return; }
    setBusy(true); setError(""); setStatus("Decoding audio locally…"); clearResult(); setSource(null); setFile(null);
    const nextUrl = URL.createObjectURL(next); const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(await next.arrayBuffer());
      if (decoded.length * decoded.numberOfChannels * 4 > MAX_DECODED_BYTES) throw new Error("Decoded audio exceeds the 64 MiB working limit for this noise tool.");
      setFile(next); setSource(decoded); setSourceUrl(nextUrl);
      setNoiseStart("0"); setNoiseEnd(String(Math.min(decoded.duration, 0.5)));
      setStatus("Choose a background-only section to build the noise profile.");
    } catch (cause) {
      URL.revokeObjectURL(nextUrl);
      setError(cause instanceof Error ? cause.message : "This audio format could not be decoded."); setStatus("");
    } finally { await context.close(); setBusy(false); }
  }

  async function reduceNoise() {
    if (!source || !file || !valid || busy) return;
    clearResult(); setBusy(true); setError(""); setStatus("Building a local noise profile…");
    const worker = new Worker(new URL("../workers/audio-denoise.worker.ts", import.meta.url), { type: "module" });
    const jobId = ++nextJobId.current; activeJobId.current = jobId; workerRef.current = worker;
    try {
      const channels = Array.from({ length: source.numberOfChannels }, (_, channel) => source.getChannelData(channel).slice());
      const wav = await new Promise<ArrayBuffer>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<DenoiseWorkerMessage>) => {
          const message = event.data;
          if (message.jobId !== jobId) return;
          if (message.type === "progress") { setProgress(message.progress); setStatus(`Reducing steady noise locally · ${message.progress}%`); }
          else if (message.type === "complete") resolve(message.wav);
          else reject(new Error(message.message));
        };
        worker.onerror = () => reject(new Error("The audio worker stopped unexpectedly."));
        worker.postMessage({
          type: "start", jobId, channels: channels.map((channel) => channel.buffer), sampleRate: source.sampleRate,
          noiseStartFrame: Math.floor(settings[0] * source.sampleRate), noiseEndFrame: Math.floor(settings[1] * source.sampleRate), strength: settings[2],
        }, channels.map((channel) => channel.buffer));
      });
      setCleanedUrl(URL.createObjectURL(new Blob([wav], { type: "audio/wav" })));
      setProgress(100); setStatus("Noise-reduced WAV is ready to preview and download.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not reduce the background noise.";
      if (message === "Processing cancelled.") setStatus("Noise reduction cancelled. The original file is unchanged.");
      else { setError(message); setStatus(""); }
    } finally {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      if (activeJobId.current === jobId) setBusy(false);
    }
  }

  function cancelReduction() {
    if (!workerRef.current) return;
    setStatus("Cancelling noise reduction…");
    workerRef.current.postMessage({ type: "cancel", jobId: activeJobId.current });
  }

  return <main className={`resize-page audio-tool-page${source ? " has-media" : ""}`}>
    <ToolPageHeader status={source ? `${settings[2]}% reduction` : undefined} />
    <section className="resize-intro">
      <p className="eyebrow">AUDIO · LOCAL PROCESSING</p>
      <h1>Reduce steady background noise</h1>
      <p>Select a short section that contains only background noise. The app builds a frequency profile and reduces matching noise in the full recording.</p>
    </section>
    {!source ? <MediaImportScreen kind="audio" accept="audio/*" onFile={(next) => void chooseFile(next)} error={error} /> : <section className="resize-workspace audio-tool-workspace">
      <div className="resize-controls">
        <div className="audio-file-bar">
          <div className="audio-file-meta">
            <strong>{file?.name}</strong>
            <span>{source.duration.toFixed(3)} s · {source.sampleRate} Hz · {source.numberOfChannels} ch</span>
          </div>
          <label className="audio-file-change">
            <span>Change file</span>
            <input type="file" accept="audio/*" disabled={busy} onChange={(event) => { const next = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void chooseFile(next); }} />
          </label>
        </div>

        <div className="audio-control-group">
          <p className="audio-control-group-title">Noise profile &amp; strength</p>
          <div className="filter-fields two-column">
            <label>Sample start <span>s</span><input type="number" min="0" max={source?.duration ?? 0} step="any" value={noiseStart} disabled={!source || busy} onChange={(event) => updateControl(setNoiseStart, event.currentTarget.value)} /></label>
            <label>Sample end <span>s</span><input type="number" min="0" max={source?.duration ?? 0} step="any" value={noiseEnd} disabled={!source || busy} onChange={(event) => updateControl(setNoiseEnd, event.currentTarget.value)} /></label>
            <label>Strength <span>0–100%</span><input type="number" min="0" max="100" step="any" value={strength} disabled={!source || busy} onChange={(event) => updateControl(setStrength, event.currentTarget.value)} /></label>
          </div>
        </div>

        <div className="audio-output-summary">
          <div>
            <span>Noise sample</span>
            <strong>{valid ? `${(settings[1] - settings[0]).toFixed(2)} s` : "—"}</strong>
          </div>
          <div>
            <span>Reduction</span>
            <strong>{valid ? `${settings[2]}%` : "—"}</strong>
          </div>
        </div>

        <p className="resize-note">Use at least 0.05 s of noise-only audio. Runs in a cancellable Web Worker.</p>
        {source && !valid && <p className="resize-error" role="alert">Choose a valid noise-only range of at least 0.05 seconds and a reduction strength from 0 to 100%.</p>}
        {error && <p className="resize-error" role="alert">{error}</p>}
        {!busy && status && <p className="source-info" role="status">{status}</p>}
        {busy && <><p className="source-info" role="status">{status}</p><progress max="100" value={progress} aria-label="Noise reduction progress" /><button type="button" className="editor-action danger" onClick={cancelReduction}>Cancel</button></>}
        <button className="export-button" disabled={!source || !valid || busy} onClick={() => void reduceNoise()}>{busy ? "Processing…" : "Reduce noise and preview"}</button>
        {cleanedUrl && <a className="export-button secondary-button download-link" href={cleanedUrl} download={`${file?.name.replace(/\.[^.]+$/, "")}-noise-reduced.wav`}>Download cleaned WAV</a>}
      </div>

      <div className="resize-preview audio-stage">
        <div className="preview-heading">
          <strong>Noise sample &amp; audio comparison</strong>
          <span>{settings[0].toFixed(3)}–{settings[1].toFixed(3)} s · {cleanedUrl ? "Original & cleaned" : "Original"}</span>
        </div>
        <div className="audio-tool-timeline">
          <AudioRangeTimeline audio={source} start={settings[0]} end={settings[1]} label="Noise sample range" onChange={(start, end) => { setNoiseStart(String(start)); setNoiseEnd(String(end)); clearResult(); }} />
        </div>
        <div className="audio-preview">
          <CustomMediaPreview kind="audio" src={sourceUrl} label="Original audio" />
          {cleanedUrl && <CustomMediaPreview kind="audio" src={cleanedUrl} label="Noise-reduced audio" />}
        </div>
      </div>
    </section>}
  </main>;
}
