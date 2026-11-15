import { useRef } from "react";

type Props = { duration: number; points: number[]; onChange: (points: number[]) => void };

export function AudioSplitTimeline({ duration, points, onChange }: Props) {
  const dragging = useRef<{ pointerId: number; value: number } | null>(null);
  function timeAt(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.max(.01, Math.min(duration - .01, (event.clientX - bounds.left) / bounds.width * duration));
  }
  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const marker = (event.target as HTMLElement).closest<HTMLElement>("[data-split-index]");
    if (marker) {
      const index = Number(marker.dataset.splitIndex);
      dragging.current = { pointerId: event.pointerId, value: points[index] };
    } else {
      const time = timeAt(event);
      const next = [...points, time].sort((a, b) => a - b);
      onChange(next);
      dragging.current = { pointerId: event.pointerId, value: time };
    }
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const active = dragging.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const next = [...points], markerIndex = next.findIndex((point) => Math.abs(point - active.value) < .000001);
    if (markerIndex < 0) return;
    const value = timeAt(event); next[markerIndex] = value; next.sort((a, b) => a - b);
    const unique = next.filter((point, index) => index === 0 || point - next[index - 1] > .03);
    onChange(unique);
    active.value = value;
  }
  return <div className="audio-split-timeline" role="group" aria-label="Split timeline. Click to add a cut point and drag markers to adjust them." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={(event) => { if (dragging.current?.pointerId === event.pointerId) dragging.current = null; }} onPointerCancel={(event) => { if (dragging.current?.pointerId === event.pointerId) dragging.current = null; }}>
    <div className="audio-split-track" />
    <span className="audio-split-label start">00:00</span><span className="audio-split-label end">{duration.toFixed(2)} s</span>
    {points.map((point, index) => <button key={`${index}-${point}`} type="button" data-split-index={index} className="audio-split-marker" style={{ left: `${point / duration * 100}%` }} aria-label={`Cut ${index + 1} at ${point.toFixed(2)} seconds`} title={`${point.toFixed(2)} s`}><i /></button>)}
  </div>;
}
