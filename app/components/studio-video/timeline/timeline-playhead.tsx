import type { MutableRefObject } from "react";
import { timelineRulerOffset } from "../../../lib/video-timeline";

export function TimelinePlayhead({
  hasClips,
  playhead,
  pxPerSecond,
  playheadDragRef,
  setPlaying,
  movePlayhead,
  finishPlayheadDrag,
}: {
  hasClips: boolean;
  playhead: number;
  pxPerSecond: number;
  playheadDragRef: MutableRefObject<{ pointerId: number; initialX: number; initialTime: number } | null>;
  setPlaying: (playing: boolean) => void;
  movePlayhead: (event: React.PointerEvent<HTMLButtonElement>) => void;
  finishPlayheadDrag: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Drag playhead to seek"
      disabled={!hasClips}
      className="timeline-playhead"
      style={{ left: timelineRulerOffset() + playhead * pxPerSecond }}
      onPointerDown={(event) => {
        if (!hasClips) return;
        event.preventDefault();
        event.stopPropagation();
        setPlaying(false);
        event.currentTarget.setPointerCapture(event.pointerId);
        playheadDragRef.current = {
          pointerId: event.pointerId,
          initialX: event.clientX,
          initialTime: playhead,
        };
      }}
      onPointerMove={movePlayhead}
      onPointerUp={finishPlayheadDrag}
      onPointerCancel={finishPlayheadDrag}
    />
  );
}
