import { useEffect, useState } from "react";
import type { Route } from "./+types/video-replace-audio";

const MAX_BYTES = 512 * 1024 * 1024;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Replace video audio | Local Studio" },
    { name: "description", content: "Replace a local video’s audio track with your own audio in the browser." },
  ];
}

export default function VideoReplaceAudio() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [offset, setOffset] = useState("0");
  const [resultUrl, setResultUrl] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  function chooseVideo(file?: File) {
    if (!file) return;
    if ((!file.type.startsWith("video/") && !/\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)) || file.size > MAX_BYTES) {
      setError("Choose a video up to 512 MiB."); return;
    }
    setVideoFile(file); setVideoUrl(URL.createObjectURL(file)); setDuration(0); setResultUrl(""); setError("");
  }

  function chooseAudio(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("audio/") || file.size > MAX_BYTES) { setError("Choose an audio file up to 512 MiB."); return; }
    setAudioFile(file); setAudioUrl(URL.createObjectURL(file)); setResultUrl(""); setError("");
  }

  const audioOffset = Number(offset);
  const valid = Number.isFinite(audioOffset) && audioOffset >= 0 && audioOffset <= 600 && (!duration || audioOffset < duration) && Boolean(videoFile && audioFile && duration > 0);

  async function replaceAudio() {
    if (!videoFile || !audioFile || !duration || !valid) return;
    setProgress(0); setError(""); setResultUrl("");
    let videoInput: import("mediabunny").Input | undefined;
    let audioInput: import("mediabunny").Input | undefined;
    try {
      const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } = await import("mediabunny");
      videoInput = new Input({ source: new BlobSource(videoFile), formats: ALL_FORMATS });
      audioInput = new Input({ source: new BlobSource(audioFile), formats: ALL_FORMATS });
      const target = new BufferTarget();
      const output = new Output({ format: new Mp4OutputFormat(), target });
      const videoConversion = await Conversion.init({
        input: videoInput, output, tracks: "primary", audio: { discard: true }, composable: true,
      });
      const audioConversion = await Conversion.init({
        input: audioInput, output, tracks: "primary", video: { discard: true }, composable: true,
        audio: { forceTranscode: true, process: (sample) => { sample.setTimestamp(sample.timestamp + audioOffset); return sample; } },
        trim: { start: 0, end: duration - audioOffset },
      });
      if (!videoConversion.isValid) throw new Error("No compatible video track is available.");
      if (!audioConversion.isValid) throw new Error("No compatible audio track or browser encoder is available for this replacement file.");
      videoConversion.onProgress = (value) => setProgress(Math.round(value * 50));
      audioConversion.onProgress = (value) => setProgress(Math.round(50 + value * 50));
      await output.start();
      await Promise.all([videoConversion.execute(), audioConversion.execute()]);
      await output.finalize();
      if (!target.buffer) throw new Error("Conversion finished without producing an MP4.");
      if (target.buffer.byteLength > MAX_BYTES) throw new Error("The output MP4 exceeds the 512 MiB memory limit.");
      setResultUrl(URL.createObjectURL(new Blob([target.buffer], { type: "video/mp4" })));
      setProgress(null);
    } catch (cause) {
      setProgress(null); setError(cause instanceof Error ? cause.message : "Could not replace the video audio track.");
    } finally { videoInput?.dispose(); audioInput?.dispose(); }
  }

  return <main className="resize-page">
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/">All tools</a></nav></header>
    <section className="resize-intro"><p className="eyebrow">VIDEO · LOCAL PROCESSING</p><h1>Replace video audio</h1><p>Keep the video track, replace its primary audio, and set a custom start offset for the new soundtrack.</p></section>
    <section className="resize-workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>{videoFile ? "Choose another video" : "Choose video"}<input type="file" accept="video/*,.mkv,.webm" onChange={(event) => chooseVideo(event.currentTarget.files?.[0])} /></span></label>
        {videoFile && <p className="source-info">Video: {videoFile.name} · {duration ? `${duration.toFixed(2)} s` : "Reading duration…"}</p>}
        <label className="file-picker"><span>{audioFile ? "Choose another audio file" : "Choose replacement audio"}<input type="file" accept="audio/*" onChange={(event) => chooseAudio(event.currentTarget.files?.[0])} /></span></label>
        {audioFile && <p className="source-info">Audio: {audioFile.name}</p>}
        <label className="speed-field">Audio start offset <span>custom · 0–600 seconds</span><input type="number" min="0" max="600" step="any" value={offset} onChange={(event) => setOffset(event.currentTarget.value)} /></label>
        <p className="resize-note">The existing primary audio is discarded. Replacement audio is delayed by the chosen offset and trimmed to fit the remaining video duration; a shorter source will end before the video.</p>
        {!valid && duration > 0 && audioOffset >= duration && <p className="resize-error" role="alert">Offset must be less than the video duration.</p>}
        {error && <p className="resize-error" role="alert">{error}</p>}
        {progress !== null && <p className="source-info" role="status">Composing replacement MP4: {progress}%</p>}
        <button className="export-button" disabled={!valid || progress !== null} onClick={() => void replaceAudio()}>{progress !== null ? "Processing…" : "Replace audio and export MP4"}</button>
        {resultUrl && <a className="export-button download-link" href={resultUrl} download={`${videoFile?.name.replace(/\.[^.]+$/, "")}-new-audio.mp4`}>Download MP4</a>}
        {audioUrl && <audio className="audio-player" controls src={audioUrl} />}
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>Video preview</strong><span>{videoFile ? "Original source" : "No video selected"}</span></div>{videoUrl ? <video className="video-preview" src={videoUrl} controls onLoadedMetadata={(event) => { const value = event.currentTarget.duration; if (Number.isFinite(value)) setDuration(value); }} /> : <div className="empty-preview">Choose a video and replacement audio.</div>}</div>
    </section>
  </main>;
}
