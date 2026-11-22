import type { MutableRefObject } from "react";
import type { VideoTimelineProject } from "../../../lib/project-store";
import { formatTimecode } from "../utils";
import { timelineRulerOffset } from "../../../lib/video-timeline";

export function TimelineRuler({
  timeline,
  timelineWidth,
  pxPerSecond,
  rulerHoverGuide,
  justSeekedRef,
  setPlaying,
  seekTimeline,
  showRulerHoverGuide,
  setRulerHoverGuide,
  setTimeline,
}: {
  timeline: VideoTimelineProject;
  timelineWidth: number;
  pxPerSecond: number;
  rulerHoverGuide: { left: number; top: number; height: number } | null;
  justSeekedRef: MutableRefObject<boolean>;
  setPlaying: (playing: boolean) => void;
  seekTimeline: (clientX: number, ruler: HTMLElement, disableSnap?: boolean) => void;
  showRulerHoverGuide: (event: React.PointerEvent<HTMLDivElement>) => void;
  setRulerHoverGuide: (guide: { left: number; top: number; height: number } | null) => void;
  setTimeline: React.Dispatch<React.SetStateAction<VideoTimelineProject>>;
}) {
  return (
    <>
      <div
        className="timeline-ruler"
        role="slider"
        tabIndex={timeline.clips.length ? 0 : -1}
        onPointerEnter={showRulerHoverGuide}
        onPointerLeave={() => setRulerHoverGuide(null)}
        aria-label="Timeline seek"
        onClick={(event) => {
          event.stopPropagation();
          if (event.detail > 0 && timeline.clips.length) {
            setPlaying(false);
            seekTimeline(event.clientX, event.currentTarget, event.altKey);
          }
        }}
        aria-valuemin={0}
        aria-valuemax={timeline.duration}
        aria-valuenow={timeline.playhead}
        aria-valuetext={formatTimecode(timeline.playhead, timeline.fps)}
        style={{ width: timelineWidth }}
        onPointerDown={(event) => {
          if (!timeline.clips.length) return;
          setRulerHoverGuide(null);
          setPlaying(false);
          justSeekedRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          seekTimeline(event.clientX, event.currentTarget, event.altKey);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            seekTimeline(event.clientX, event.currentTarget, event.altKey);
          } else {
            showRulerHoverGuide(event);
          }
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          window.setTimeout(() => {
            justSeekedRef.current = false;
          }, 0);
        }}
        onPointerCancel={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          justSeekedRef.current = false;
        }}
        onKeyDown={(event) => {
          if (!timeline.clips.length) return;
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            setPlaying(false);
            setTimeline((current) => ({
              ...current,
              playhead:
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? current.duration
                    : Math.max(
                        0,
                        Math.min(
                          current.duration,
                          current.playhead +
                            (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 1 : 1 / Math.max(1, current.fps))
                        )
                      ),
            }));
          }
        }}
      >
        {Array.from({ length: Math.ceil(timeline.duration) + 1 }, (_, second) => (
          <span key={second} style={{ left: timelineRulerOffset() + second * pxPerSecond }}>
            {second}s
          </span>
        ))}
      </div>
      {rulerHoverGuide && <div className="timeline-hover-guide" aria-hidden="true" style={rulerHoverGuide} />}
    </>
  );
}
