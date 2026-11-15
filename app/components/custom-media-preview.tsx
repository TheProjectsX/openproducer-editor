import { useRef, useState } from "react";

type Props = {
  kind: "audio" | "video";
  src: string;
  label: string;
  onDuration?: (duration: number) => void;
  className?: string;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0.000 s";
  return `${seconds.toFixed(3)} s`;
}

export function CustomMediaPreview({ kind, src, label, onDuration, className = "" }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const media = () => kind === "audio" ? audioRef.current : videoRef.current;

  function togglePlayback() {
    const element = media();
    if (!element) return;
    if (element.paused) void element.play().catch(() => setPlaying(false));
    else element.pause();
  }

  function seek(value: number) {
    const element = media();
    if (!element) return;
    element.currentTime = value;
    setCurrentTime(value);
  }

  function updateDuration(value: number) {
    if (!Number.isFinite(value)) return;
    setDuration(value);
    onDuration?.(value);
  }

  return <div className={`custom-media-preview custom-preview-${kind} ${className}`}>
    {kind === "video" ? <div className="custom-video-stage"><video ref={videoRef} src={src} playsInline preload="metadata" aria-label={label} onLoadedMetadata={(event) => updateDuration(event.currentTarget.duration)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} /></div> : <>
      <audio ref={audioRef} src={src} preload="metadata" aria-label={label} onLoadedMetadata={(event) => updateDuration(event.currentTarget.duration)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <div className="custom-audio-art"><span className="custom-audio-glyph" aria-hidden="true">♫</span><div className="custom-audio-copy"><span className="custom-audio-label">LOCAL AUDIO</span><strong>{label}</strong><small>Private preview · stays on this device</small></div></div>
    </>}
    <div className="custom-media-transport">
      <button type="button" className="transport-play" onClick={togglePlayback} aria-label={playing ? `Pause ${label}` : `Play ${label}`}>{playing ? "Ⅱ" : "▶"}</button>
      <span className="transport-time">{formatTime(currentTime)} <i>/</i> {formatTime(duration)}</span>
      <input className="transport-scrub" type="range" min="0" max={duration || 0} step="any" value={Math.min(currentTime, duration)} aria-label={`${label} timeline`} disabled={!duration} onChange={(event) => seek(event.currentTarget.valueAsNumber)} />
    </div>
  </div>;
}
