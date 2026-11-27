import { useEffect, useRef } from "react";
import { dbToLinear } from "../lib/audio-studio-engine";

export function AudioStudioClipWave({
  peaks,
  sourceDuration,
  sourceStart,
  sourceEnd,
  gainDb,
  fadeIn,
  fadeOut,
  clipDuration,
  muted,
}: {
  peaks: Float32Array;
  sourceDuration: number;
  sourceStart: number;
  sourceEnd: number;
  gainDb: number;
  fadeIn: number;
  fadeOut: number;
  clipDuration: number;
  muted: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks.length || sourceDuration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(24, Math.round(rect.width || 160));
    const height = Math.max(24, Math.round(rect.height || 44));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const startRatio = Math.max(0, Math.min(1, sourceStart / sourceDuration));
    const endRatio = Math.max(startRatio, Math.min(1, sourceEnd / sourceDuration));
    const startIdx = Math.floor(startRatio * peaks.length);
    const endIdx = Math.max(startIdx + 1, Math.ceil(endRatio * peaks.length));
    const gainScale = Math.min(2.2, dbToLinear(gainDb));
    const midY = height / 2;

    ctx.fillStyle = muted ? "rgba(151, 168, 196, 0.35)" : "rgba(116, 232, 232, 0.85)";
    const bars = Math.max(12, Math.floor(width / 2.5));
    const barW = width / bars;

    for (let i = 0; i < bars; i++) {
      const t = i / bars;
      const idx = Math.min(peaks.length - 1, startIdx + Math.floor(t * (endIdx - startIdx)));
      let amp = peaks[idx] * gainScale;
      if (clipDuration > 0) {
        const localTime = t * clipDuration;
        if (fadeIn > 0 && localTime < fadeIn) amp *= localTime / fadeIn;
        if (fadeOut > 0 && localTime > clipDuration - fadeOut) {
          amp *= Math.max(0, (clipDuration - localTime) / fadeOut);
        }
      }
      const barH = Math.max(2, Math.min(height - 4, amp * (height - 6)));
      ctx.fillRect(i * barW, midY - barH / 2, Math.max(1, barW - 0.6), barH);
    }
  }, [peaks, sourceDuration, sourceStart, sourceEnd, gainDb, fadeIn, fadeOut, clipDuration, muted]);

  return <canvas ref={canvasRef} className="audio-studio-clip-canvas" aria-hidden="true" />;
}
