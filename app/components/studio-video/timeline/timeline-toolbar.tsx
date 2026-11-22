import type { MutableRefObject } from "react";
import type { VideoTimelineClip, VideoTimelineProject } from "../../../lib/project-store";

export function TimelineToolbar({
  duration,
  historyVersion,
  historyRef,
  selectedClip,
  mainClipAtPlayhead,
  ripplePrimaryTrack,
  snapEnabled,
  snapThreshold,
  zoom,
  pxPerSecond,
  deleteHoveredSide,
  undo,
  redo,
  splitSelected,
  removeClip,
  setRipplePrimaryTrack,
  setSnapEnabled,
  setSnapThreshold,
  setZoom,
  fitTimelineZoom,
}: {
  duration: number;
  historyVersion: number;
  historyRef: MutableRefObject<{ past: VideoTimelineProject[]; future: VideoTimelineProject[] }>;
  selectedClip?: VideoTimelineClip;
  mainClipAtPlayhead?: VideoTimelineClip;
  ripplePrimaryTrack: boolean;
  snapEnabled: boolean;
  snapThreshold: string;
  zoom: string;
  pxPerSecond: number;
  deleteHoveredSide: (side: "left" | "right") => void;
  undo: () => void;
  redo: () => void;
  splitSelected: () => void;
  removeClip: (id: string) => void;
  setRipplePrimaryTrack: (ripple: boolean) => void;
  setSnapEnabled: (snap: boolean) => void;
  setSnapThreshold: (threshold: string) => void;
  setZoom: (zoom: string) => void;
  fitTimelineZoom: () => void;
}) {
  return (
    <div className="timeline-toolbar">
      <strong>Timeline · {duration.toFixed(2)} seconds</strong>
      <span className="timeline-toolbar-separator" aria-hidden="true" />
      <div className="timeline-edit-tools">
        <button
          type="button"
          title="Delete Left"
          aria-label="Delete Left"
          onClick={() => deleteHoveredSide("left")}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 3v14M12 5h6v10h-6zM2 7l6 6M8 7l-6 6" />
          </svg>
        </button>
        <button
          type="button"
          title="Delete Right"
          aria-label="Delete Right"
          onClick={() => deleteHoveredSide("right")}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 3v14M2 5h6v10H2zM12 7l6 6m0-6-6 6" />
          </svg>
        </button>
      </div>
      <span className="timeline-toolbar-separator" aria-hidden="true" />
      <div className="timeline-actions" data-history-version={historyVersion}>
        <button disabled={!historyRef.current.past.length} onClick={undo}>
          Undo
        </button>
        <button disabled={!historyRef.current.future.length} onClick={redo}>
          Redo
        </button>
        <span className="timeline-toolbar-separator" aria-hidden="true" />
        <button disabled={!selectedClip && !mainClipAtPlayhead} onClick={splitSelected}>
          Split
        </button>
        <button disabled={!selectedClip} onClick={() => selectedClip && removeClip(selectedClip.id)}>
          Delete
        </button>
        <span className="timeline-toolbar-separator" aria-hidden="true" />
        <label>
          <input
            type="checkbox"
            checked={ripplePrimaryTrack}
            onChange={(event) => setRipplePrimaryTrack(event.currentTarget.checked)}
          />
          Ripple
        </label>
        <label>
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(event) => setSnapEnabled(event.currentTarget.checked)}
          />
          Snap
        </label>
        <span className="timeline-toolbar-separator" aria-hidden="true" />
        <label>
          Snap tolerance
          <input
            type="number"
            min="0"
            max="5"
            step="any"
            value={snapThreshold}
            disabled={!snapEnabled}
            onChange={(event) => setSnapThreshold(event.currentTarget.value)}
          />
          s
        </label>
        <span className="timeline-toolbar-separator" aria-hidden="true" />
        <div className="timeline-zoom-group">
          <button
            type="button"
            title="Zoom out timeline"
            aria-label="Zoom out timeline"
            onClick={() => setZoom(String(Math.max(12, Math.round(pxPerSecond / 1.2))))}
          >
            −
          </button>
          <input
            className="timeline-zoom-slider"
            type="range"
            min="12"
            max="160"
            step="1"
            value={pxPerSecond}
            aria-label="Timeline zoom slider"
            onChange={(event) => setZoom(event.currentTarget.value)}
          />
          <button
            type="button"
            title="Zoom in timeline"
            aria-label="Zoom in timeline"
            onClick={() => setZoom(String(Math.min(160, Math.round(pxPerSecond * 1.2))))}
          >
            +
          </button>
          <label>
            Zoom
            <input
              type="number"
              min="12"
              max="160"
              value={zoom}
              onChange={(event) => setZoom(event.currentTarget.value)}
            />
            px/s
          </label>
          <button type="button" title="Fit timeline to view" onClick={fitTimelineZoom}>
            Fit
          </button>
        </div>
      </div>
    </div>
  );
}
