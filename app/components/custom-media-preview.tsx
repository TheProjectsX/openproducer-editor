import { useEffect, useRef, useState } from "react";

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
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [sampleRate, setSampleRate] = useState(0);
  const onDurationRef = useRef(onDuration);
  onDurationRef.current = onDuration;
  const media = () => (kind === "audio" ? audioRef.current : videoRef.current);

  useEffect(() => {
    setDuration(0);
    setCurrentTime(0);
    setPlaying(false);
    const element = kind === "audio" ? audioRef.current : videoRef.current;
    if (!element) return;
    const syncDuration = () => {
      const value = element.duration;
      if (!Number.isFinite(value)) return;
      setDuration(value);
      onDurationRef.current?.(value);
    };
    element.addEventListener("loadedmetadata", syncDuration);
    element.addEventListener("durationchange", syncDuration);
    syncDuration();
    return () => {
      element.removeEventListener("loadedmetadata", syncDuration);
      element.removeEventListener("durationchange", syncDuration);
    };
  }, [src, kind]);

  useEffect(() => {
    if (kind !== "audio" || !src) {
      setPeaks(null);
      setSampleRate(0);
      return;
    }
    let cancelled = false;
    let context: AudioContext | null = null;
    setPeaks(null);
    void (async () => {
      try {
        const response = await fetch(src);
        if (!response.ok) return;
        context = new AudioContext();
        const decoded = await context.decodeAudioData(await response.arrayBuffer());
        if (cancelled) return;
        const samples = decoded.getChannelData(0);
        const buckets = 512;
        const nextPeaks = new Float32Array(buckets);
        const step = Math.max(1, Math.floor(samples.length / buckets));
        for (let b = 0; b < buckets; b++) {
          let peak = 0;
          const start = b * step;
          for (let i = start; i < Math.min(samples.length, start + step); i++) {
            const abs = Math.abs(samples[i]);
            if (abs > peak) peak = abs;
          }
          nextPeaks[b] = peak;
        }
        setSampleRate(decoded.sampleRate);
        setPeaks(nextPeaks);
      } catch {
        // Fallback silently to transport bar if decode is unavailable
      } finally {
        await context?.close();
      }
    })();
    return () => {
      cancelled = true;
      void context?.close();
    };
  }, [src, kind]);

  useEffect(() => {
    if (kind !== "audio" || !peaks || !waveCanvasRef.current) return;
    const canvas = waveCanvasRef.current;
    const draw = () => {
      const context = canvas.getContext("2d");
      if (!context) return;
      const width = Math.max(240, Math.round(canvas.clientWidth * window.devicePixelRatio));
      const height = Math.max(76, Math.round(canvas.clientHeight * window.devicePixelRatio));
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#080d16";
      context.fillRect(0, 0, width, height);

      const ratio = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
      const playX = Math.round(ratio * width);
      const center = height / 2;

      for (let x = 0; x < width; x++) {
        const idx = Math.min(peaks.length - 1, Math.floor((x / width) * peaks.length));
        const amp = Math.max(1, peaks[idx] * height * 0.44);
        context.fillStyle = x <= playX ? "#5ed4d5" : "#3a4f6b";
        context.fillRect(x, center - amp, 1, amp * 2);
      }

      if (duration > 0) {
        context.fillStyle = "#ff7187";
        context.fillRect(Math.max(0, Math.min(width - 2, playX)), 0, 2, height);
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [kind, peaks, currentTime, duration]);

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

  return (
    <div className={`custom-media-preview custom-preview-${kind} ${className}`}>
      {kind === "video" ? (
        <div className="custom-video-stage">
          <video
            ref={videoRef}
            src={src}
            playsInline
            preload="metadata"
            aria-label={label}
            onLoadedMetadata={(event) => updateDuration(event.currentTarget.duration)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
        </div>
      ) : (
        <>
          <audio
            ref={audioRef}
            src={src}
            preload="metadata"
            aria-label={label}
            onLoadedMetadata={(event) => updateDuration(event.currentTarget.duration)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
          <div className="custom-audio-wave-wrap">
            <div className="custom-audio-wave-meta">
              <strong>{label}</strong>
              <span>
                {sampleRate ? `${sampleRate} Hz · ` : ""}
                {duration ? formatTime(duration) : "Loading…"}
              </span>
            </div>
            <canvas
              ref={waveCanvasRef}
              className="custom-audio-wave-canvas"
              role="img"
              aria-label={`${label} waveform`}
              onClick={(event) => {
                if (!duration) return;
                const rect = event.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
                seek(ratio * duration);
              }}
            />
          </div>
        </>
      )}
      <div className="custom-media-transport">
        <button
          type="button"
          className="transport-play"
          onClick={togglePlayback}
          aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <span className="transport-time">
          {formatTime(currentTime)} <i>/</i> {formatTime(duration)}
        </span>
        <input
          className="transport-scrub"
          type="range"
          min="0"
          max={duration || 0}
          step="any"
          value={Math.min(currentTime, duration)}
          aria-label={`${label} timeline`}
          disabled={!duration}
          onChange={(event) => seek(event.currentTarget.valueAsNumber)}
        />
      </div>
    </div>
  );
}
