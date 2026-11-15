import { useEffect, useRef } from "react";

type Props = {
  audio: AudioBuffer;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  label: string;
  playhead?: number;
  onGestureStart?: () => void;
};

type Gesture = { pointerId: number; mode: "start" | "end" | "move" | "create"; anchor: number; start: number; end: number };

export function AudioRangeTimeline({ audio, start, end, onChange, label, playhead, onGestureStart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<Gesture | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current, context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const draw = () => {
      const width = Math.max(1, Math.round(canvas.clientWidth * window.devicePixelRatio)), height = 132;
      canvas.width = width; canvas.height = height;
      context.fillStyle = "#0b1320"; context.fillRect(0, 0, width, height);
      const left = Math.max(0, Math.min(width, start / audio.duration * width));
      const right = Math.max(left, Math.min(width, end / audio.duration * width));
      context.fillStyle = "#1a3344"; context.fillRect(left, 0, right - left, height);
      const samples = audio.getChannelData(0), step = Math.max(1, Math.floor(samples.length / width));
      for (let x = 0; x < width; x++) {
        let peak = 0; const first = x * step;
        for (let index = first; index < Math.min(samples.length, first + step); index++) peak = Math.max(peak, Math.abs(samples[index]));
        context.fillStyle = x >= left && x <= right ? "#72d8c1" : "#4a6078";
        const amplitude = Math.max(1, peak * height * .42), center = height / 2;
        context.fillRect(x, center - amplitude, 1, amplitude * 2);
      }
      context.fillStyle = "#e9f1ff"; context.fillRect(left - 1, 0, 2, height); context.fillRect(right - 1, 0, 2, height);
      if (playhead !== undefined) { context.fillStyle = "#ff7388"; context.fillRect(Math.max(0, Math.min(width - 2, playhead / audio.duration * width)), 0, 2, height); }
    };
    draw();
    const observer = new ResizeObserver(draw); observer.observe(canvas);
    return () => observer.disconnect();
  }, [audio, start, end, playhead]);

  function timeAt(event: React.PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(audio.duration, (event.clientX - bounds.left) / bounds.width * audio.duration));
  }
  function begin(event: React.PointerEvent<HTMLCanvasElement>) {
    onGestureStart?.();
    const value = timeAt(event), bounds = event.currentTarget.getBoundingClientRect();
    const tolerance = audio.duration * 14 / Math.max(1, bounds.width);
    const mode = Math.abs(value - start) <= tolerance ? "start" : Math.abs(value - end) <= tolerance ? "end" : value > start && value < end ? "move" : "create";
    gestureRef.current = { pointerId: event.pointerId, mode, anchor: value, start, end };
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const value = timeAt(event), minimum = Math.min(.01, audio.duration);
    if (gesture.mode === "start") onChange(Math.max(0, Math.min(end - minimum, value)), end);
    else if (gesture.mode === "end") onChange(start, Math.max(start + minimum, Math.min(audio.duration, value)));
    else if (gesture.mode === "create") onChange(Math.min(gesture.anchor, value), Math.max(gesture.anchor + minimum, value));
    else {
      const length = gesture.end - gesture.start, nextStart = Math.max(0, Math.min(audio.duration - length, gesture.start + value - gesture.anchor));
      onChange(nextStart, nextStart + length);
    }
  }

  return <div className="audio-range-timeline">
    <div className="timeline-time-labels"><span>00:00</span><span>{audio.duration.toFixed(2)} s</span></div>
    <canvas ref={canvasRef} className="audio-range-waveform" role="img" aria-label={`${label}. Drag either edge to adjust the range, drag inside to move it, or drag outside to create a new selection.`} onPointerDown={begin} onPointerMove={move} onPointerUp={(event) => { if (gestureRef.current?.pointerId === event.pointerId) gestureRef.current = null; }} onPointerCancel={(event) => { if (gestureRef.current?.pointerId === event.pointerId) gestureRef.current = null; }} />
  </div>;
}
