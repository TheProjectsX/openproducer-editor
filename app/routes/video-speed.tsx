import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/video-speed";
import { MediaImportScreen } from "../components/media-import-screen";
import { CustomMediaPreview } from "../components/custom-media-preview";
import { ProcessingProgress } from "../components/processing-progress";
import {
  MAX_VIDEO_SPEED,
  MAX_VIDEO_SPEED_BYTES,
  MIN_VIDEO_SPEED,
  VIDEO_SPEED_PRESETS,
  computeRetimedDuration,
  computeSpeedForTargetDuration,
  exportVideoWithSpeed,
  isValidVideoSpeed,
  type VideoSpeedFormatPreference,
  type VideoSpeedPitchMode,
} from "../lib/video-speed";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Video Speed | Local Studio" },
    {
      name: "description",
      content: "Change video speed from 0.1× to 16× with pitch-preserved audio and fast local MP4 or WebM export.",
    },
    { name: "robots", content: "index,follow" },
  ];
}

export default function VideoSpeed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cancelRef = useRef(false);
  const activeOutputRef = useRef<import("mediabunny").Output | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [resultMeta, setResultMeta] = useState<{
    extension: "mp4" | "webm";
    sizeBytes: number;
    duration: number;
  } | null>(null);
  const [duration, setDuration] = useState(0);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [speed, setSpeed] = useState("1");
  const [pitchMode, setPitchMode] = useState<VideoSpeedPitchMode>("preserve");
  const [formatPreference, setFormatPreference] = useState<VideoSpeedFormatPreference>("auto");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);
  useEffect(() => () => {
    cancelRef.current = true;
    if (activeOutputRef.current && activeOutputRef.current.state !== "canceled" && activeOutputRef.current.state !== "finalized") {
      void activeOutputRef.current.cancel().catch(() => undefined);
    }
  }, []);

  const rate = Number(speed);
  const validRate = isValidVideoSpeed(rate);
  const estimatedDuration = computeRetimedDuration(duration, rate);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !validRate) return;
    video.playbackRate = rate;
    video.preservesPitch = pitchMode === "preserve";
  }, [rate, validRate, pitchMode]);

  useEffect(() => {
    setResultUrl("");
    setResultMeta(null);
  }, [speed, pitchMode, formatPreference]);

  function chooseFile(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("video/") && !/\.(mp4|mov|webm|mkv|avi)$/i.test(next.name)) {
      setError("Choose a video file.");
      return;
    }
    if (next.size > MAX_VIDEO_SPEED_BYTES) {
      setError("Choose a video up to 512 MiB for in-browser processing.");
      return;
    }
    setFile(next);
    setUrl(URL.createObjectURL(next));
    setResultUrl("");
    setResultMeta(null);
    setDuration(0);
    setVideoDimensions(null);
    setCurrentTime(0);
    setPreviewPlaying(false);
    setProgress(0);
    setProgressPhase("");
    setError("");
  }

  function applySpeedValue(next: number) {
    const clamped = Math.max(MIN_VIDEO_SPEED, Math.min(MAX_VIDEO_SPEED, next));
    setSpeed(String(Number(clamped.toFixed(3))));
  }

  function seekPreview(time: number) {
    const video = videoRef.current;
    if (!video || !duration) return;
    const clamped = Math.max(0, Math.min(duration, time));
    video.currentTime = clamped;
    setCurrentTime(clamped);
  }

  async function startExport() {
    if (!file || !validRate || exporting) return;
    videoRef.current?.pause();
    cancelRef.current = false;
    setExporting(true);
    setProgress(0);
    setProgressPhase("Preparing video & audio…");
    setError("");
    setResultUrl("");
    setResultMeta(null);

    try {
      const result = await exportVideoWithSpeed({
        file,
        speed: rate,
        pitchMode,
        formatPreference,
        onProgress: ({ phase, percent }) => {
          setProgressPhase(phase);
          setProgress(percent);
        },
        isCancelled: () => cancelRef.current,
        onOutputCreated: (output) => {
          activeOutputRef.current = output;
        },
      });
      if (cancelRef.current) return;
      setResultUrl(URL.createObjectURL(result.blob));
      setResultMeta({
        extension: result.extension,
        sizeBytes: result.blob.size,
        duration: result.duration,
      });
      setProgress(100);
    } catch (cause) {
      if (!cancelRef.current) {
        setError(cause instanceof Error ? cause.message : "Could not process video speed.");
      }
    } finally {
      activeOutputRef.current = null;
      setExporting(false);
      setProgressPhase("");
    }
  }

  function cancelExport() {
    cancelRef.current = true;
    const output = activeOutputRef.current;
    if (output && output.state !== "canceled" && output.state !== "finalized") {
      void output.cancel().catch(() => undefined);
    }
    setExporting(false);
    setProgress(0);
    setProgressPhase("");
  }

  const aspectRatio = videoDimensions ? videoDimensions.width / videoDimensions.height : 0;
  const portraitPreviewStyle =
    videoDimensions && aspectRatio < 1
      ? {
          width: `min(100%, ${aspectRatio * 26}dvh, ${aspectRatio * 380}px)`,
          maxHeight: "min(26dvh, 380px)",
          aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}`,
          minHeight: 0,
          flex: "0 0 auto",
        }
      : undefined;

  const targetDurationMin = duration ? Number((duration / MAX_VIDEO_SPEED).toFixed(2)) : 0.01;
  const targetDurationMax = duration ? Number((duration / MIN_VIDEO_SPEED).toFixed(2)) : 3600;
  const exportLabel = formatPreference === "webm" ? "Export WebM" : "Export MP4";

  return (
    <main className={`resize-page video-speed-page${file ? " has-media" : ""}`}>
      <ToolPageHeader />
      <section className="resize-intro">
        <p className="eyebrow">VIDEO · LOCAL PROCESSING</p>
        <h1>Change video speed</h1>
        <p>
          Preview at any custom rate from 0.1× to 16× and render locally with WebCodecs — faster than real time,
          with pitch-preserved audio and MP4 export.
        </p>
      </section>

      {!file ? (
        <MediaImportScreen kind="video" accept="video/*,.mkv,.webm" onFile={chooseFile} error={error} />
      ) : (
        <section className="resize-workspace video-tool-workspace video-speed-workspace">
          <div className="resize-controls video-speed-controls">
            <div className="video-speed-file-row">
              <label className="file-picker">
                <span>
                  Choose another video
                  <input
                    type="file"
                    accept="video/*,.mkv,.webm"
                    disabled={exporting}
                    onChange={(event) => chooseFile(event.currentTarget.files?.[0])}
                  />
                </span>
              </label>
              <p className="source-info">
                {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB
                {videoDimensions ? ` · ${videoDimensions.width}×${videoDimensions.height}` : ""}
                {duration ? ` · ${duration.toFixed(3)} s` : " · Reading duration…"}
              </p>
            </div>

            <div className="video-speed-panel">
              <div className="video-speed-slider-row">
                <label className="speed-field">
                  Playback speed <span>0.1× – 16×</span>
                  <input
                    type="number"
                    min={MIN_VIDEO_SPEED}
                    max={MAX_VIDEO_SPEED}
                    step="any"
                    value={speed}
                    disabled={exporting}
                    onChange={(event) => setSpeed(event.currentTarget.value)}
                  />
                </label>
                <label className="speed-field">
                  Target duration <span>seconds</span>
                  <input
                    type="number"
                    min={targetDurationMin}
                    max={targetDurationMax}
                    step="0.01"
                    value={estimatedDuration ? Number(estimatedDuration.toFixed(2)) : ""}
                    placeholder={duration ? duration.toFixed(2) : "—"}
                    disabled={exporting || !duration}
                    onChange={(event) => {
                      const target = event.currentTarget.valueAsNumber;
                      if (Number.isFinite(target) && target > 0 && duration > 0) {
                        applySpeedValue(computeSpeedForTargetDuration(duration, target));
                      }
                    }}
                  />
                </label>
              </div>

              <input
                className="video-speed-range"
                type="range"
                min={MIN_VIDEO_SPEED}
                max={MAX_VIDEO_SPEED}
                step="0.05"
                value={validRate ? rate : 1}
                disabled={exporting}
                aria-label="Video playback speed slider"
                onChange={(event) => applySpeedValue(event.currentTarget.valueAsNumber)}
              />

              <div className="speed-presets" aria-label="Speed presets">
                {VIDEO_SPEED_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    disabled={exporting}
                    className={validRate && Math.abs(rate - preset) < 0.001 ? "active" : ""}
                    onClick={() => applySpeedValue(preset)}
                  >
                    {preset}×
                  </button>
                ))}
              </div>
            </div>

            <div className="video-speed-options">
              <label className="ratio-field">
                Audio pitch
                <select
                  value={pitchMode}
                  disabled={exporting}
                  onChange={(event) => setPitchMode(event.currentTarget.value as VideoSpeedPitchMode)}
                >
                  <option value="preserve">Preserve pitch (default)</option>
                  <option value="natural">Natural pitch change</option>
                </select>
              </label>

              <label className="ratio-field">
                Output format
                <select
                  value={formatPreference}
                  disabled={exporting}
                  onChange={(event) => setFormatPreference(event.currentTarget.value as VideoSpeedFormatPreference)}
                >
                  <option value="auto">Auto (MP4 preferred)</option>
                  <option value="mp4">MP4 (H.264 / AAC)</option>
                  <option value="webm">WebM (VP9 / Opus)</option>
                </select>
              </label>
            </div>

            <div className="video-speed-summary" aria-live="polite">
              <div>
                <span>Original</span>
                <strong>{duration ? `${duration.toFixed(3)} s` : "—"}</strong>
              </div>
              <div className="summary-arrow" aria-hidden="true">→</div>
              <div>
                <span>Output ({validRate ? `${rate}×` : "invalid"})</span>
                <strong>{estimatedDuration ? `${estimatedDuration.toFixed(3)} s` : "—"}</strong>
              </div>
              <div>
                <span>Audio</span>
                <strong>{pitchMode === "preserve" ? "Pitch preserved" : "Natural pitch"}</strong>
              </div>
            </div>

            {exporting && <ProcessingProgress label={progressPhase || "Processing speed-adjusted video…"} value={progress} />}
            {error && (
              <p className="resize-error" role="alert">
                {error}
              </p>
            )}
            {!validRate && (
              <p className="resize-error" role="alert">
                Enter a custom speed from 0.1× to 16×.
              </p>
            )}

            <div className="video-speed-actions">
              {exporting ? (
                <button type="button" className="export-button secondary-button" onClick={cancelExport}>
                  Cancel export
                </button>
              ) : (
                <button
                  type="button"
                  className="export-button"
                  disabled={!file || !duration || !validRate}
                  onClick={() => void startExport()}
                >
                  {exportLabel}
                </button>
              )}
              {resultUrl && resultMeta && (
                <a
                  className="export-button download-link"
                  href={resultUrl}
                  download={`${file.name.replace(/\.[^.]+$/, "")}-${rate}x.${resultMeta.extension}`}
                >
                  Download {resultMeta.extension.toUpperCase()} ({(resultMeta.sizeBytes / 1024 / 1024).toFixed(1)} MiB)
                </a>
              )}
            </div>
          </div>

          <div className="resize-preview">
            <div className="preview-heading">
              <strong>{resultUrl ? "Speed-adjusted video" : "Live speed preview"}</strong>
              <span>
                {resultUrl && resultMeta
                  ? `${rate}× · ${resultMeta.extension.toUpperCase()} · ${resultMeta.duration.toFixed(3)} s`
                  : validRate
                    ? `${rate}× · ${pitchMode === "preserve" ? "Pitch preserved" : "Natural pitch"}`
                    : "Enter a valid rate"}
              </span>
            </div>

            {resultUrl ? (
              <>
                <CustomMediaPreview kind="video" src={resultUrl} label="Speed-adjusted video result" />
                <button
                  type="button"
                  className="editor-action"
                  onClick={() => {
                    setResultUrl("");
                    setResultMeta(null);
                  }}
                >
                  Adjust speed again
                </button>
              </>
            ) : url ? (
              <>
                <div className="custom-video-stage" style={portraitPreviewStyle}>
                  <video
                    ref={videoRef}
                    className="video-preview"
                    src={url}
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      if (Number.isFinite(video.duration)) setDuration(video.duration);
                      if (video.videoWidth && video.videoHeight) {
                        setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
                      }
                      if (validRate) {
                        video.playbackRate = rate;
                        video.preservesPitch = pitchMode === "preserve";
                      }
                    }}
                    onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                    onPlay={() => setPreviewPlaying(true)}
                    onPause={() => setPreviewPlaying(false)}
                    onEnded={() => setPreviewPlaying(false)}
                  />
                </div>
                <div className="video-custom-transport">
                  <button
                    type="button"
                    className="transport-play"
                    aria-label={previewPlaying ? "Pause video preview" : "Play video preview"}
                    onClick={() => {
                      const video = videoRef.current;
                      if (!video) return;
                      if (video.paused) void video.play().catch(() => setError("Playback could not start. Press Play again."));
                      else video.pause();
                    }}
                  >
                    {previewPlaying ? "Ⅱ" : "▶"}
                  </button>
                  <button
                    type="button"
                    className="transport-step"
                    onClick={() => seekPreview(currentTime - 1 / 30)}
                    aria-label="Step back one frame"
                  >
                    −1f
                  </button>
                  <button
                    type="button"
                    className="transport-step"
                    onClick={() => seekPreview(currentTime + 1 / 30)}
                    aria-label="Step forward one frame"
                  >
                    +1f
                  </button>
                  <span className="transport-time">
                    {currentTime.toFixed(3)} / {duration.toFixed(3)} s
                  </span>
                  <input
                    className="transport-scrub"
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.001"
                    value={Math.min(currentTime, duration)}
                    aria-label="Video preview timeline"
                    disabled={!duration}
                    onChange={(event) => seekPreview(event.currentTarget.valueAsNumber)}
                  />
                </div>
              </>
            ) : (
              <div className="empty-preview">Choose a local video to begin.</div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
