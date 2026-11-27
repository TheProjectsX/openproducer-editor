import type { VideoAspectRatioMode, VideoTimelineProject } from "../../../lib/project-store";
import { ASPECT_RATIOS } from "../types";
import { formatTimecode } from "../utils";

export function VideoStudioTransport({
  timeline,
  playing,
  previewZoom,
  previewPan,
  previewZoomDraft,
  widthDraft,
  heightDraft,
  playerExpanded,
  stepFrame,
  togglePlayback,
  setPreviewZoomValue,
  setPreviewZoomDraft,
  selectAspectRatio,
  setWidthDraft,
  setHeightDraft,
  commitCustomCanvas,
  toggleFullscreen,
}: {
  timeline: VideoTimelineProject;
  playing: boolean;
  previewZoom: number;
  previewPan: { x: number; y: number };
  previewZoomDraft: string;
  widthDraft: string;
  heightDraft: string;
  playerExpanded: boolean;
  stepFrame: (direction: -1 | 1) => void;
  togglePlayback: () => void;
  setPreviewZoomValue: (value: number, resetPan?: boolean) => void;
  setPreviewZoomDraft: (value: string) => void;
  selectAspectRatio: (mode: VideoAspectRatioMode) => void;
  setWidthDraft: (value: string) => void;
  setHeightDraft: (value: string) => void;
  commitCustomCanvas: () => void;
  toggleFullscreen: () => void;
}) {
  return (
    <div className="editor-transport">
      <span className="studio-timecode" aria-label="Current time and timeline duration">
        {formatTimecode(timeline.playhead, timeline.fps)} <span>/</span> {formatTimecode(timeline.duration, timeline.fps)}
      </span>
      <div className="studio-playback-controls">
        <button
          type="button"
          aria-label="Previous frame"
          title="Previous frame"
          disabled={!timeline.clips.length}
          onClick={() => stepFrame(-1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="5" width="2.5" height="14" rx="1" />
            <polygon points="19,5 8.5,12 19,19" />
          </svg>
        </button>
        <button
          type="button"
          className="studio-play-button"
          aria-label={playing ? "Pause" : "Play"}
          title={playing ? "Pause" : "Play"}
          disabled={!timeline.clips.length}
          onClick={togglePlayback}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="5" width="4.5" height="14" rx="1" />
              <rect x="13.5" y="5" width="4.5" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <polygon points="7,4.5 20,12 7,19.5" />
            </svg>
          )}
        </button>
        <button
          type="button"
          aria-label="Next frame"
          title="Next frame"
          disabled={!timeline.clips.length}
          onClick={() => stepFrame(1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <polygon points="5,5 15.5,12 5,19" />
            <rect x="17.5" y="5" width="2.5" height="14" rx="1" />
          </svg>
        </button>
      </div>
      <div className="studio-player-tools">
        <span>
          {timeline.width} × {timeline.height}
        </span>
        <details className="studio-ratio-menu">
          <summary aria-label="Preview zoom">
            {previewZoom === 1 && previewPan.x === 0 && previewPan.y === 0
              ? "Fit"
              : `${Math.round(previewZoom * 100)}%`}
          </summary>
          <div className="studio-ratio-options">
            {(
              [
                ["Fit", 1],
                ["50%", 0.5],
                ["100%", 1],
                ["150%", 1.5],
                ["200%", 2],
              ] as const
            ).map(([label, value]) => (
              <button
                type="button"
                key={label}
                className={
                  label === "Fit"
                    ? previewZoom === 1 && previewPan.x === 0 && previewPan.y === 0
                      ? "active"
                      : ""
                    : Math.abs(previewZoom - value) < 0.01
                      ? "active"
                      : ""
                }
                onClick={() => setPreviewZoomValue(value, label === "Fit")}
              >
                {label}
              </button>
            ))}
            <div className="studio-custom-ratio">
              <label>
                Zoom %
                <input
                  type="number"
                  min="25"
                  max="400"
                  step="1"
                  value={previewZoomDraft}
                  onChange={(event) => setPreviewZoomDraft(event.currentTarget.value)}
                  onBlur={() => {
                    const parsed = Number(previewZoomDraft);
                    if (Number.isFinite(parsed) && parsed >= 25 && parsed <= 400) {
                      setPreviewZoomValue(parsed / 100);
                    } else {
                      setPreviewZoomDraft(String(Math.round(previewZoom * 100)));
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
              </label>
              {(previewZoom !== 1 || previewPan.x !== 0 || previewPan.y !== 0) && (
                <button type="button" className="editor-action" onClick={() => setPreviewZoomValue(1, true)}>
                  Reset view
                </button>
              )}
            </div>
          </div>
        </details>
        <details className="studio-ratio-menu">
          <summary aria-label="Canvas aspect ratio">Ratio</summary>
          <div className="studio-ratio-options">
            {ASPECT_RATIOS.map((option) => (
              <button
                type="button"
                key={option.value}
                className={(timeline.aspectRatioMode ?? "custom") === option.value ? "active" : ""}
                onClick={() => selectAspectRatio(option.value)}
              >
                {option.label}
              </button>
            ))}
            {(timeline.aspectRatioMode ?? "custom") === "custom" && (
              <div className="studio-custom-ratio">
                <label>
                  Width{" "}
                  <input
                    type="number"
                    min="16"
                    max="7680"
                    step="1"
                    value={widthDraft}
                    onChange={(event) => setWidthDraft(event.currentTarget.value)}
                    onBlur={commitCustomCanvas}
                  />
                </label>
                <label>
                  Height{" "}
                  <input
                    type="number"
                    min="16"
                    max="4320"
                    step="1"
                    value={heightDraft}
                    onChange={(event) => setHeightDraft(event.currentTarget.value)}
                    onBlur={commitCustomCanvas}
                  />
                </label>
              </div>
            )}
          </div>
        </details>
        <button
          type="button"
          aria-label={playerExpanded ? "Exit fullscreen player" : "Fullscreen player"}
          title={playerExpanded ? "Exit fullscreen player" : "Fullscreen player"}
          onClick={() => void toggleFullscreen()}
        >
          ⛶
        </button>
      </div>
    </div>
  );
}
