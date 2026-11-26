import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useState } from "react";
import type { Route } from "./+types/video-extract-audio";
import { MediaImportScreen } from "../components/media-import-screen";
import { CustomMediaPreview } from "../components/custom-media-preview";
import { ProcessingProgress } from "../components/processing-progress";

const MAX_INPUT_BYTES = 512 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 512 * 1024 * 1024;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Extract audio from video | OpenProducer Editor" },
    { name: "description", content: "Extract the audio track from a local video and export WAV in your browser." },
  ];
}

export default function VideoExtractAudio() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  function chooseFile(next?: File) {
    setError(""); setResultUrl(""); setDuration(0); setFile(next ?? null);
    setUrl(next ? URL.createObjectURL(next) : "");
    if (next && !next.type.startsWith("video/") && !/\.(mp4|mov|webm|mkv|avi)$/i.test(next.name)) setError("Choose a video file.");
    if (next && next.size > MAX_INPUT_BYTES) setError("This prototype accepts videos up to 512 MiB.");
  }

  async function extract() {
    if (!file || !duration || file.size > MAX_INPUT_BYTES) return;
    const predictedBytes = 44 + duration * 48_000 * 2 * 2;
    if (predictedBytes > MAX_OUTPUT_BYTES) { setError("The 48 kHz stereo WAV would exceed the 512 MiB in-memory output limit."); return; }
    setProgress(0); setError(""); setResultUrl("");
    let input: import("mediabunny").Input | undefined;
    try {
      const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output, WavOutputFormat } = await import("mediabunny");
      input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const target = new BufferTarget();
      const output = new Output({ format: new WavOutputFormat(), target });
      const conversion = await Conversion.init({
        // "primary" may select only the primary video track. Include the
        // input tracks and explicitly discard video so audio-only extraction
        // still sees the source audio stream.
        input, output, tracks: "all", video: { discard: true },
        audio: { numberOfChannels: 2, sampleRate: 48_000, sampleFormat: "s16" },
      });
      if (!conversion.isValid || conversion.utilizedTracks.length === 0) throw new Error("This video has no audio track that the browser can export.");
      conversion.onProgress = (value) => setProgress(Math.round(value * 100));
      await conversion.execute();
      const buffer = target.buffer;
      if (!buffer) throw new Error("Audio extraction finished without producing a WAV file.");
      if (buffer.byteLength > MAX_OUTPUT_BYTES) throw new Error("The extracted WAV exceeds the 512 MiB output limit.");
      setResultUrl(URL.createObjectURL(new Blob([buffer], { type: "audio/wav" })));
      setProgress(null);
    } catch (cause) {
      setProgress(null);
      setError(cause instanceof Error ? cause.message : "Could not extract the audio track.");
    } finally {
      input?.dispose();
    }
  }

  return <main className={`resize-page video-tool-page${file ? " has-media" : ""}`}>
    <ToolPageHeader status={file && duration ? `${duration.toFixed(2)} s` : undefined} />
    <section className="resize-intro"><p className="eyebrow">VIDEO · LOCAL PROCESSING</p><h1>Extract a video’s audio</h1><p>Keep the primary audio track and export it as 48 kHz stereo WAV. Conversion runs in this browser.</p></section>
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
            <span>Format</span>
            <strong>16-bit PCM WAV</strong>
          </div>
          <div>
            <span>Sample rate</span>
            <strong>48 kHz stereo</strong>
          </div>
        </div>

        <p className="resize-note">Extracts the primary audio stream locally in your browser. Maximum input and output size: 512 MiB.</p>
        {error && <p className="resize-error" role="alert">{error}</p>}
        {progress !== null && <ProcessingProgress label="Extracting the primary audio track" value={progress} />}
        <button className="export-button" disabled={!file || !duration || progress !== null || file.size > MAX_INPUT_BYTES || Boolean(error)} onClick={extract}>{progress !== null ? "Extracting…" : "Extract and export WAV"}</button>
        {resultUrl && <a className="export-button secondary-button download-link" href={resultUrl} download={`${file?.name.replace(/\.[^.]+$/, "")}-audio.wav`}>Download extracted WAV</a>}
      </div>
      <div className="resize-preview video-stage">
        <div className="preview-heading"><strong>Video source</strong><span>{duration ? `${duration.toFixed(3)} s · local preview` : "Loading video…"}</span></div>
        {url ? <CustomMediaPreview kind="video" src={url} label="Video source preview" className="video-stage-media" onDuration={setDuration} /> : <div className="empty-preview">Choose a video with an audio track.</div>}
        {resultUrl && <div className="extracted-audio-preview"><CustomMediaPreview kind="audio" src={resultUrl} label="Extracted audio" /></div>}
      </div>
    </section>}
  </main>;
}
