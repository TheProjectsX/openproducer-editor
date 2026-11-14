import { useEffect, useState } from "react";
import type { Route } from "./+types/video-trim";

const MAX_INPUT_BYTES = 512 * 1024 * 1024;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Trim video | Local Studio" },
    { name: "description", content: "Trim a local video and export an MP4 in your browser." },
  ];
}

export default function VideoTrim() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [resultName, setResultName] = useState("");

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, [sourceUrl, resultUrl]);

  function selectFile(next: File | undefined) {
    setError(""); setProgress(null); setDuration(0); setEnd("");
    setFile(next ?? null);
    setSourceUrl(next ? URL.createObjectURL(next) : "");
    setResultUrl(""); setResultName("");
    if (next && next.size > MAX_INPUT_BYTES) setError("This prototype accepts files up to 512 MiB to limit browser memory use.");
  }

  async function exportTrim() {
    if (!file || !duration || file.size > MAX_INPUT_BYTES) return;
    const from = Number(start), to = Number(end || duration);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to > duration || to <= from) {
      setError("Enter a valid range: start must be below end, and end must not exceed the video duration."); return;
    }
    setError(""); setProgress(0); setResultUrl("");
    try {
      const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } = await import("mediabunny");
      const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const target = new BufferTarget();
      const output = new Output({ format: new Mp4OutputFormat(), target });
      const conversion = await Conversion.init({ input, output, tracks: "primary", trim: { start: from, end: to } });
      if (!conversion.isValid) throw new Error("The browser could not prepare a compatible audio/video export for this file.");
      conversion.onProgress = (value) => setProgress(Math.round(value * 100));
      await conversion.execute();
      input.dispose();
      if (!target.buffer) throw new Error("Export completed without producing an MP4 file.");
      const blob = new Blob([target.buffer], { type: "video/mp4" });
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${file.name.replace(/\.[^.]+$/, "")}-trimmed.mp4`);
      setProgress(null);
    } catch (cause) {
      setProgress(null);
      setError(cause instanceof Error ? cause.message : "Video export failed. Try another file or a shorter range.");
    }
  }

  return (
    <main className="resize-page">
      <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/">All tools</a></nav></header>
      <section className="resize-intro"><p className="eyebrow">VIDEO · LOCAL PROCESSING</p><h1>Trim a video</h1><p>Choose exact start and end times. Processing and export happen in this browser.</p></section>
      <section className="resize-workspace">
        <div className="resize-controls">
          <label className="file-picker"><span>{file ? "Choose a different video" : "Choose video file"}</span><input type="file" accept="video/*,.mkv,.webm" onChange={(event) => selectFile(event.currentTarget.files?.[0])} /></label>
          {file && <p className="source-info">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB{duration ? ` · ${duration.toFixed(2)} seconds` : " · Reading duration…"}</p>}
          <div className="dimension-fields">
            <label>Start time <span>seconds</span><input type="number" min="0" max={duration || undefined} step="0.01" value={start} onChange={(event) => setStart(event.currentTarget.value)} /></label>
            <label>End time <span>seconds</span><input type="number" min="0" max={duration || undefined} step="0.01" value={end} placeholder={duration ? duration.toFixed(2) : "Video duration"} onChange={(event) => setEnd(event.currentTarget.value)} /></label>
          </div>
          <p className="resize-note">MP4 output. Depending on the source codec and browser support, export may transcode and take longer. This prototype keeps the result in memory.</p>
          {error && <p className="resize-error" role="alert">{error}</p>}
          {progress !== null && <p className="source-info" role="status">Exporting video: {progress}%</p>}
          <button className="export-button" disabled={!file || !duration || progress !== null || file.size > MAX_INPUT_BYTES} onClick={exportTrim}>{progress !== null ? "Exporting…" : "Export trimmed MP4"}</button>
          {resultUrl && <a className="export-button download-link" href={resultUrl} download={resultName}>Download {resultName}</a>}
        </div>
        <div className="resize-preview"><div className="preview-heading"><strong>Video preview</strong><span>{file ? "Original" : "No video selected"}</span></div>{sourceUrl ? <video className="video-preview" src={sourceUrl} controls onLoadedMetadata={(event) => { const length = event.currentTarget.duration; if (Number.isFinite(length)) { setDuration(length); setEnd(String(length)); } }} /> : <div className="empty-preview">Choose a video to preview it here</div>}</div>
      </section>
    </main>
  );
}
