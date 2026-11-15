import { useEffect, useRef, useState } from "react";

export function AudioWaveformPreview({ src, label = "Extracted audio waveform" }: { src: string; label?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let context: AudioContext | null = null;
    setBuffer(null); setError("");
    void (async () => {
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error("The local audio preview could not be read.");
        context = new AudioContext();
        const decoded = await context.decodeAudioData(await response.arrayBuffer());
        if (!cancelled) setBuffer(decoded);
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not decode the audio waveform."); }
      finally { await context?.close(); }
    })();
    return () => { cancelled = true; void context?.close(); };
  }, [src]);

  useEffect(() => {
    const element = canvas.current, context = element?.getContext("2d");
    if (!element || !context || !buffer) return;
    const width = Math.max(1, Math.round(element.clientWidth * window.devicePixelRatio)), height = 96;
    element.width = width; element.height = height;
    context.fillStyle = "#0b1422"; context.fillRect(0, 0, width, height);
    const samples = buffer.getChannelData(0), framesPerPixel = Math.max(1, Math.floor(samples.length / width));
    context.fillStyle = "#65d3b1";
    for (let x = 0; x < width; x++) {
      let peak = 0;
      const first = x * framesPerPixel;
      for (let frame = first; frame < Math.min(samples.length, first + framesPerPixel); frame++) peak = Math.max(peak, Math.abs(samples[frame]));
      const amplitude = Math.max(1, peak * height * 0.46);
      context.fillRect(x, (height - amplitude) / 2, 1, amplitude);
    }
  }, [buffer]);

  return <div className="audio-waveform-preview"><div className="preview-heading"><strong>{label}</strong><span>{buffer ? `${buffer.duration.toFixed(3)} s · ${buffer.sampleRate} Hz` : error || "Loading waveform…"}</span></div>{buffer ? <canvas ref={canvas} role="img" aria-label={`${label}, ${buffer.duration.toFixed(3)} seconds`} /> : error ? <p className="resize-error" role="alert">{error}</p> : <p className="processing-inline"><span className="processing-spinner" />Decoding the local audio preview…</p>}</div>;
}
