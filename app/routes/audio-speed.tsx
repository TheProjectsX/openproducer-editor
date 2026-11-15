import { useEffect, useRef, useState } from "react";
import { BungeeNode, BungeeStretcher, compileBungee, instantiateBungee, Transport } from "bungee-web";
import wasmUrl from "bungee-web/bungee.wasm?url";
import workletUrl from "bungee-web/worklet?url";
import type { Route } from "./+types/audio-speed";
import { MediaImportScreen } from "../components/media-import-screen";
import { PITCH_PRESERVE_RENDER_CHUNK_FRAMES } from "../lib/audio-speed";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Audio Speed | Local Studio" },
    { name: "description", content: "Change audio speed with a custom value while preserving pitch." },
    { name: "robots", content: "index,follow" },
  ];
}

function pcmToWav(left: Float32Array, right: Float32Array, sampleRate: number) {
  const frames = Math.min(left.length, right.length);
  const bytes = new ArrayBuffer(44 + frames * 4);
  const view = new DataView(bytes);
  const text = (at: number, value: string) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, frames * 4, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (const channel of [left, right]) {
      const sample = Math.max(-1, Math.min(1, channel[i]));
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2;
    }
  }
  return new Blob([bytes], { type: "audio/wav" });
}

export default function AudioSpeed() {
  const nodeRef = useRef<BungeeNode | null>(null);
  const nodeListenersRef = useRef<Array<() => void>>([]);
  const moduleRef = useRef<WebAssembly.Module | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [sampleRate, setSampleRate] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [ready, setReady] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => {
    nodeListenersRef.current.forEach((unsubscribe) => unsubscribe());
    nodeRef.current?.close();
    void contextRef.current?.close();
  }, []);

  async function importFile(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("audio/")) { setError("Choose an audio file."); return; }
    setWorking(true); setError(""); setReady(false); setStatus("Decoding audio locally…");
    nodeListenersRef.current.forEach((unsubscribe) => unsubscribe()); nodeListenersRef.current = [];
    nodeRef.current?.close(); nodeRef.current = null;
    await contextRef.current?.close();
    try {
      const context = new AudioContext(); contextRef.current = context;
      const decoded = await context.decodeAudioData(await next.arrayBuffer());
      const modulePromise = moduleRef.current ? Promise.resolve(moduleRef.current) : compileBungee(fetch(wasmUrl));
      await BungeeNode.addModule(context, workletUrl);
      const module = await modulePromise; moduleRef.current = module;
      const node = new BungeeNode(context, module); await node.ready;
      const left = decoded.getChannelData(0).slice();
      const right = decoded.numberOfChannels > 1 ? decoded.getChannelData(1).slice() : left.slice();
      node.load(decoded.length, [{ id: "source", left, right }]);
      node.node.connect(context.destination);
      node.setSpeed(speed);
      nodeRef.current = node; setFile(next); setDuration(decoded.duration); setSampleRate(decoded.sampleRate); setPlayhead(0); setPlaying(false); setReady(true); setStatus("Ready. Audio remains on this device.");
      nodeListenersRef.current = [
        node.on("position", (report) => { setPlayhead(Math.max(0, Math.min(decoded.duration, report.position / decoded.sampleRate))); setPlaying(report.playing); }),
        node.on("ended", () => { setPlayhead(decoded.duration); setPlaying(false); }),
      ];
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "Unknown processing error";
      setError(`Could not prepare this file for pitch-preserved playback: ${reason}`);
      setStatus("");
    } finally { setWorking(false); }
  }

  function changeSpeed(value: number) {
    setSpeed(value);
    if (Number.isFinite(value) && value >= 0.1 && value <= 16) nodeRef.current?.setSpeed(value);
  }

  async function exportAudio() {
    const context = contextRef.current;
    if (!context || !file || !ready || speed < 0.1 || speed > 16) return;
    setWorking(true); setError(""); setStatus("Rendering pitch-preserved audio…");
    try {
      const wasm = await instantiateBungee(moduleRef.current!);
      const stretcher = new BungeeStretcher(wasm, { sampleRate, channels: 2 });
      const frameCount = Math.ceil(duration * sampleRate);
      const transport = new Transport(stretcher, frameCount);
      const sourceBuffer = await context.decodeAudioData(await file.arrayBuffer());
      const left = sourceBuffer.getChannelData(0).slice();
      const right = sourceBuffer.numberOfChannels > 1 ? sourceBuffer.getChannelData(1).slice() : left.slice();
      transport.setSource("source", { left, right });
      transport.speed = speed; transport.play();
      const outputFrames = Math.ceil(frameCount / speed) + Math.ceil(sampleRate * 0.2);
      const resultLeft = new Float32Array(outputFrames);
      const resultRight = new Float32Array(outputFrames);
      const chunk = PITCH_PRESERVE_RENDER_CHUNK_FRAMES;
      for (let offset = 0; offset < outputFrames; offset += chunk) {
        const length = Math.min(chunk, outputFrames - offset);
        const blockLeft = new Float32Array(length); const blockRight = new Float32Array(length);
        transport.render(blockLeft, blockRight, length);
        resultLeft.set(blockLeft, offset); resultRight.set(blockRight, offset);
        if (offset % (chunk * 16) === 0) {
          setStatus(`Rendering… ${Math.min(100, Math.round((offset / outputFrames) * 100))}%`);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      stretcher.destroy();
      const usefulFrames = Math.min(outputFrames, Math.ceil(frameCount / speed));
      const blob = pcmToWav(resultLeft.subarray(0, usefulFrames), resultRight.subarray(0, usefulFrames), sampleRate);
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = `${file.name.replace(/\.[^.]+$/, "")}-${speed}x.wav`; link.click(); URL.revokeObjectURL(url);
      setStatus("Export complete.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Audio export failed."); setStatus("");
    } finally { setWorking(false); }
  }

  const validSpeed = Number.isFinite(speed) && speed >= 0.1 && speed <= 16;
  const estimatedBytes = duration && validSpeed ? (duration / speed) * sampleRate * 4 : 0;
  const exportFitsMemory = estimatedBytes <= 512 * 1024 * 1024;
  return <main className={`resize-page${file ? " has-media" : ""}`}>
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/tools/audio/speed">Audio Speed</a></nav></header>
    <section className="resize-intro"><p className="eyebrow">AUDIO TOOL · PITCH PRESERVED</p><h1>Set your own playback speed.</h1><p>Enter any speed from 0.1× to 16×. Pitch stays steady while the duration changes.</p></section>
    {!file ? <MediaImportScreen kind="audio" accept="audio/*" onFile={(next) => void importFile(next)} error={error} /> : <section className="resize-workspace" aria-label="Audio speed workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>{file ? "Choose another audio file" : "Choose an audio file"}<input type="file" accept="audio/*" onChange={(event) => void importFile(event.currentTarget.files?.[0])} /></span></label>
        {file && <p className="source-info">{file.name} · {duration.toFixed(2)} s · {sampleRate} Hz</p>}
        <label className="speed-field">Speed <span>×</span><input type="number" min="0.1" max="16" step="0.1" value={speed} onChange={(event) => changeSpeed(event.currentTarget.valueAsNumber)} /></label>
        <div className="speed-presets">{[0.5, 1, 1.5, 2, 4, 6].map((value) => <button key={value} type="button" onClick={() => changeSpeed(value)}>{value}×</button>)}</div>
        <p className="resize-note">Estimated output: {validSpeed && duration ? `${(duration / speed).toFixed(2)} s · ${(estimatedBytes / 1024 / 1024).toFixed(1)} MB` : "Enter a speed from 0.1× to 16×."} · Pitch preserved</p>
        <button className="export-button" type="button" disabled={!ready || working || !validSpeed} onClick={() => nodeRef.current?.play()}>{working ? "Processing…" : "Preview speed"}</button>
        <button className="export-button secondary-button" type="button" disabled={!ready || working || !validSpeed || !exportFitsMemory} onClick={() => void exportAudio()}>Export WAV</button>
        {!exportFitsMemory && <p className="resize-error" role="alert">Estimated WAV output exceeds the 512 MB prototype limit. Use a shorter clip or a faster rate.</p>}
        {status && <p className="resize-note" role="status">{status}</p>}{error && <p className="resize-error" role="alert">{error}</p>}
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>Speed preview</strong><span>{ready ? `${speed}× · pitch preserved` : "Choose audio to begin"}</span></div>{ready ? <div className="audio-speed-player"><div className="custom-audio-art"><span className="custom-audio-glyph" aria-hidden="true">♫</span><div className="custom-audio-copy"><span className="custom-audio-label">LOCAL AUDIO</span><strong>{file?.name}</strong><small>Pitch-preserved preview · {duration.toFixed(2)} s source</small></div></div><div className="custom-media-transport"><button type="button" className="transport-play" aria-label={playing ? "Pause speed preview" : "Play speed preview"} onClick={() => { const node = nodeRef.current; if (!node) return; if (playing) node.pause(); else { if (playhead >= duration) { node.seek(0); setPlayhead(0); } node.play(); } }}>{playing ? "Ⅱ" : "▶"}</button><span className="transport-time">{playhead.toFixed(2)} / {duration.toFixed(2)} s</span><input className="transport-scrub" type="range" min="0" max={duration} step="any" value={Math.min(playhead, duration)} aria-label="Pitch-preserved audio timeline" onChange={(event) => { const time = event.currentTarget.valueAsNumber; setPlayhead(time); nodeRef.current?.seek(Math.round(time * sampleRate)); }} /></div></div> : <div className="empty-preview">Choose an audio file to begin.</div>}</div>
    </section>}
  </main>;
}
