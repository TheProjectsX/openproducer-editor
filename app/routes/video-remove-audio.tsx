import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useState } from "react";
import type { Route } from "./+types/video-remove-audio";
import { MediaImportScreen } from "../components/media-import-screen";
import { CustomMediaPreview } from "../components/custom-media-preview";
import { ProcessingProgress } from "../components/processing-progress";

const MAX_BYTES = 512 * 1024 * 1024;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Remove audio from video | OpenProducer Editor" },
    { name: "description", content: "Remove primary audio from a local video and export an MP4 in your browser." },
  ];
}

export default function VideoRemoveAudio() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [resultUrl, setResultUrl] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  function chooseFile(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("video/") && !/\.(mp4|mov|webm|mkv|avi)$/i.test(next.name)) { setError("Choose a video file."); return; }
    if (next.size > MAX_BYTES) { setError("Choose a video up to 512 MiB."); return; }
    setFile(next); setUrl(URL.createObjectURL(next)); setDuration(0); setResultUrl(""); setError("");
  }

  async function removeAudio() {
    if (!file) return;
    setProgress(0); setError(""); setResultUrl("");
    let input: import("mediabunny").Input | undefined;
    try {
      const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } = await import("mediabunny");
      input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const target = new BufferTarget();
      const output = new Output({ format: new Mp4OutputFormat(), target });
      const conversion = await Conversion.init({ input, output, tracks: "primary", audio: { discard: true } });
      if (!conversion.isValid || conversion.utilizedTracks.length === 0) {
        const reasons = conversion.discardedTracks.map(({ track, reason }) => `${track.type}: ${reason}`).join("; ");
        throw new Error(`No compatible video track is available to export${reasons ? ` (${reasons})` : ""}.`);
      }
      conversion.onProgress = (value) => setProgress(Math.round(value * 100));
      await conversion.execute();
      if (!target.buffer) throw new Error("Conversion finished without producing a video file.");
      if (target.buffer.byteLength > MAX_BYTES) throw new Error("The MP4 output exceeds the 512 MiB prototype limit.");
      setResultUrl(URL.createObjectURL(new Blob([target.buffer], { type: "video/mp4" })));
      setProgress(null);
    } catch (cause) {
      setProgress(null); setError(cause instanceof Error ? cause.message : "Could not remove audio from this video.");
    } finally { input?.dispose(); }
  }

  return <main className={`resize-page video-tool-page${file ? " has-media" : ""}`}>
    <ToolPageHeader status={resultUrl ? "Muted MP4" : duration ? `${duration.toFixed(2)} s` : undefined} />
    <section className="resize-intro"><p className="eyebrow">VIDEO · LOCAL PROCESSING</p><h1>Remove video audio</h1><p>Discard the primary audio track and export the remaining video as MP4. Your file stays in this browser.</p></section>
    {!file ? <MediaImportScreen kind="video" accept="video/*,.mkv,.webm" onFile={chooseFile} error={error} /> : <section className="resize-workspace">
      <div className="resize-controls">
        <div className="audio-file-bar">
          <div className="audio-file-meta">
            <strong>{file.name}</strong>
            <span>{(file.size / 1024 / 1024).toFixed(1)} MiB{duration ? ` · ${duration.toFixed(3)} s` : " · Reading…"}</span>
          </div>
          <label className="audio-file-change">
            <span>Change file</span>
            <input type="file" accept="video/*,.mkv,.webm" onChange={(event) => chooseFile(event.currentTarget.files?.[0])} />
          </label>
        </div>

        <div className="audio-output-summary">
          <div>
            <span>Audio track</span>
            <strong>Discarded</strong>
          </div>
          <div>
            <span>Output</span>
            <strong>Muted MP4</strong>
          </div>
        </div>

        <p className="resize-note">The primary audio track is discarded. Video packets are copied when supported; other cases transcode locally. Limit: 512 MiB.</p>
        {error && <p className="resize-error" role="alert">{error}</p>}
        {progress !== null && <ProcessingProgress label="Removing audio and writing video" value={progress} />}
        <button className="export-button" disabled={!file || progress !== null} onClick={() => void removeAudio()}>{progress !== null ? "Processing…" : "Remove audio and export MP4"}</button>
        {resultUrl && <a className="export-button secondary-button download-link" href={resultUrl} download={`${file?.name.replace(/\.[^.]+$/, "")}-muted.mp4`}>Download muted MP4</a>}
      </div>
      <div className="resize-preview video-stage">
        <div className="preview-heading"><strong>{resultUrl ? "Muted video result" : "Video preview"}</strong><span>{resultUrl ? "Muted MP4 ready" : duration ? `${duration.toFixed(3)} s · original source` : "Loading video…"}</span></div>
        {resultUrl ? <>
          <CustomMediaPreview kind="video" src={resultUrl} label="Muted video result preview" className="video-stage-media" />
          <button type="button" className="editor-action" onClick={() => setResultUrl("")}>Back to source video</button>
        </> : url ? <CustomMediaPreview kind="video" src={url} label="Original video preview" className="video-stage-media" onDuration={setDuration} /> : <div className="empty-preview">Choose a video to begin.</div>}
      </div>
    </section>}
  </main>;
}
