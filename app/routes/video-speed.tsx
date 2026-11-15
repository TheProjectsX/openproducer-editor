import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/video-speed";
import { MediaImportScreen } from "../components/media-import-screen";
import { CustomMediaPreview } from "../components/custom-media-preview";
import { ProcessingProgress } from "../components/processing-progress";

const MAX_INPUT_BYTES = 512 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 512 * 1024 * 1024;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Custom video speed | Local Studio" },
    { name: "description", content: "Preview and record a local video at a custom playback speed." },
  ];
}

export default function VideoSpeed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState("1");
  const [preservePitch, setPreservePitch] = useState(true);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [error, setError] = useState("");
  const [recordedMime, setRecordedMime] = useState("");

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);
  useEffect(() => {
    if (videoRef.current && Number.isFinite(Number(speed)) && Number(speed) > 0) {
      videoRef.current.playbackRate = Number(speed);
      videoRef.current.preservesPitch = preservePitch;
    }
  }, [speed, preservePitch]);
  useEffect(() => () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); }, []);

  function chooseFile(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("video/") && !/\.(mp4|mov|webm|mkv|avi)$/i.test(next.name)) { setError("Choose a video file."); return; }
    if (next.size > MAX_INPUT_BYTES) { setError("Choose a video up to 512 MiB for this prototype."); return; }
    setFile(next); setUrl(URL.createObjectURL(next)); setResultUrl(""); setDuration(0); setCurrentTime(0); setPreviewPlaying(false); setProgress(0); setError(""); setRecordedMime("");
  }

  const rate = Number(speed), validRate = Number.isFinite(rate) && rate >= 0.1 && rate <= 16;
  const estimatedDuration = duration && validRate ? duration / rate : 0;

  function startExport() {
    const video = videoRef.current;
    if (!video || !file || !validRate || recording) return;
    try {
      const mediaVideo = video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
      const stream = mediaVideo.captureStream?.() ?? mediaVideo.mozCaptureStream?.();
      if (!stream) throw new Error("This browser does not support recording a video element. Use a current Chromium or Firefox browser.");
      const mimeTypes = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
      const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("This browser has no supported MediaRecorder video format.");
      if (!stream.getVideoTracks().length) throw new Error("The browser did not provide a capturable video track.");
      const chunks: Blob[] = []; let totalBytes = 0; let failed = false;
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      setRecordedMime(mimeType); setResultUrl(""); setProgress(0); setError("");
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        totalBytes += event.data.size;
        if (totalBytes > MAX_OUTPUT_BYTES) {
          failed = true;
          setError("Recording reached the 512 MiB in-memory output limit.");
          if (recorder.state === "recording") recorder.stop();
          return;
        }
        chunks.push(event.data);
      };
      recorder.onerror = () => { failed = true; setError("The browser recorder reported an error. Try a shorter video or another format."); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null; setRecording(false);
        if (chunks.length && !failed) setResultUrl(URL.createObjectURL(new Blob(chunks, { type: mimeType })));
      };
      video.pause(); video.currentTime = 0; video.playbackRate = rate; video.preservesPitch = preservePitch;
      recorder.start(1000); setRecording(true);
      void video.play().catch(() => { setError("Playback could not start. Press play once, then retry export."); recorder.stop(); });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start video recording."); }
  }

  function cancelExport() {
    videoRef.current?.pause();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }

  const outputExtension = recordedMime.includes("mp4") ? "mp4" : "webm";
  return <main className={`resize-page${file ? " has-media" : ""}`}>
    <ToolPageHeader />
    <section className="resize-intro"><p className="eyebrow">VIDEO · LOCAL PROCESSING</p><h1>Set a custom video speed</h1><p>Preview at any custom rate from 0.1× to 16× and record the playback locally. Export format depends on browser support.</p></section>
    {!file ? <MediaImportScreen kind="video" accept="video/*,.mkv,.webm" onFile={chooseFile} error={error} /> : <section className="resize-workspace video-tool-workspace">
      <div className="resize-controls">
        <label className="file-picker"><span>{file ? "Choose another video" : "Choose a video"}<input type="file" accept="video/*,.mkv,.webm" disabled={recording} onChange={(event) => chooseFile(event.currentTarget.files?.[0])} /></span></label>
        {file && <p className="source-info">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB · {duration ? `${duration.toFixed(3)} s` : "Reading duration…"}</p>}
        <label className="speed-field">Playback speed <span>custom · 0.1×–16×</span><input type="number" min="0.1" max="16" step="any" value={speed} disabled={recording} onChange={(event) => setSpeed(event.currentTarget.value)} /></label>
        <label className="ratio-toggle"><input type="checkbox" checked={preservePitch} disabled={recording} onChange={(event) => setPreservePitch(event.currentTarget.checked)} /> Preserve audio pitch where the browser supports it</label>
        <p className="resize-note">Estimated output duration: {estimatedDuration ? `${estimatedDuration.toFixed(3)} seconds` : "—"}. Recording runs in real time. Browsers may mute source audio at extreme playback rates; inspect output before relying on it.</p>
        {recording && <ProcessingProgress label={`Recording speed-adjusted video · ${recordedMime || "browser format"}`} value={progress} />}
        {error && <p className="resize-error" role="alert">{error}</p>}
        {!validRate && <p className="resize-error" role="alert">Enter a custom speed from 0.1× to 16×.</p>}
        {recording ? <button className="export-button secondary-button" onClick={cancelExport}>Stop recording</button> : <button className="export-button" disabled={!file || !duration || !validRate} onClick={startExport}>Record speed-adjusted video</button>}
        {resultUrl && <a className="export-button download-link" href={resultUrl} download={`${file?.name.replace(/\.[^.]+$/, "")}-${rate}x.${outputExtension}`}>Download {outputExtension.toUpperCase()}</a>}
      </div>
      <div className="resize-preview"><div className="preview-heading"><strong>{resultUrl ? "Speed-adjusted video" : "Speed preview"}</strong><span>{resultUrl ? `${rate}× · ${outputExtension.toUpperCase()} result` : validRate ? `${rate}×` : "Enter a valid rate"}</span></div>{resultUrl ? <CustomMediaPreview kind="video" src={resultUrl} label="Speed-adjusted video result" /> : url ? <><div className="custom-video-stage"><video ref={videoRef} className="video-preview" src={url} playsInline onLoadedMetadata={(event) => { const length = event.currentTarget.duration; if (Number.isFinite(length)) setDuration(length); }} onTimeUpdate={(event) => { setCurrentTime(event.currentTarget.currentTime); if (recording && duration) setProgress(Math.min(100, Math.round(event.currentTarget.currentTime / duration * 100))); }} onPlay={() => setPreviewPlaying(true)} onPause={() => setPreviewPlaying(false)} onEnded={() => { setPreviewPlaying(false); if (recorderRef.current?.state === "recording") recorderRef.current.stop(); }} /></div><div className="video-custom-transport"><button type="button" className="transport-play" aria-label={previewPlaying ? "Pause video preview" : "Play video preview"} onClick={() => { const video = videoRef.current; if (!video) return; if (video.paused) void video.play(); else video.pause(); }}>{previewPlaying ? "Ⅱ" : "▶"}</button><span className="transport-time">{currentTime.toFixed(3)} / {duration.toFixed(3)} s</span><input className="transport-scrub" type="range" min="0" max={duration || 0} step="0.001" value={Math.min(currentTime, duration)} aria-label="Video preview timeline" disabled={!duration} onChange={(event) => { const time = event.currentTarget.valueAsNumber; setCurrentTime(time); if (videoRef.current) videoRef.current.currentTime = time; }} /></div></> : <div className="empty-preview">Choose a local video to begin.</div>}</div>
    </section>}
  </main>;
}
