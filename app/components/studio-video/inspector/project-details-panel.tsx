import { renameProject, type VideoAspectRatioMode, type VideoTimelineProject } from "../../../lib/project-store";
import { ASPECT_RATIOS } from "../types";

export function ProjectDetailsPanel({
  projectId,
  projectTitle,
  mediaAssetCount,
  visibleTracks,
  timeline,
  widthDraft,
  heightDraft,
  frameRateDraft,
  setProjectTitle,
  selectAspectRatio,
  setWidthDraft,
  setHeightDraft,
  commitCustomCanvas,
  setFrameRateDraft,
  applyTimelineEdit,
  openExportSettings,
}: {
  projectId: string;
  projectTitle: string;
  mediaAssetCount: number;
  visibleTracks: number[];
  timeline: VideoTimelineProject;
  widthDraft: string;
  heightDraft: string;
  frameRateDraft: string;
  setProjectTitle: (title: string) => void;
  selectAspectRatio: (mode: VideoAspectRatioMode) => void;
  setWidthDraft: (width: string) => void;
  setHeightDraft: (height: string) => void;
  commitCustomCanvas: () => void;
  setFrameRateDraft: (fps: string) => void;
  applyTimelineEdit: (update: (current: VideoTimelineProject) => VideoTimelineProject) => void;
  openExportSettings: () => void;
}) {
  return (
    <div className="studio-project-details">
      <h2>Project</h2>
      <dl>
        {projectId && (
          <div>
            <dt>Name</dt>
            <dd>
              <input
                className="studio-details-input"
                value={projectTitle}
                aria-label="Project name"
                maxLength={80}
                placeholder="Untitled video"
                onChange={(event) => setProjectTitle(event.currentTarget.value)}
                onBlur={() => {
                  const trimmed = projectTitle.trim() || "Untitled video";
                  setProjectTitle(trimmed);
                  void renameProject(projectId, trimmed);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            </dd>
          </div>
        )}
        <div>
          <dt>Media</dt>
          <dd>{mediaAssetCount} files</dd>
        </div>
        <div>
          <dt>Tracks</dt>
          <dd>
            {visibleTracks.filter((track) => track >= 0).length} video ·{" "}
            {visibleTracks.filter((track) => track < 0).length} audio
          </dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{timeline.duration.toFixed(2)} s</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>On this device</dd>
        </div>
      </dl>
      <div className="clip-control-group">
        <div className="clip-control-head">
          <strong>Canvas &amp; Output</strong>
        </div>
        <label className="ratio-field">
          Aspect ratio
          <select
            value={timeline.aspectRatioMode ?? "custom"}
            onChange={(event) => selectAspectRatio(event.currentTarget.value as VideoAspectRatioMode)}
          >
            {ASPECT_RATIOS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="filter-fields two-column transform-fields">
          <label className="speed-field">
            Width <span>px</span>
            <input
              type="number"
              min="16"
              max="7680"
              step="1"
              value={widthDraft}
              onChange={(event) => setWidthDraft(event.currentTarget.value)}
              onBlur={commitCustomCanvas}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </label>
          <label className="speed-field">
            Height <span>px</span>
            <input
              type="number"
              min="16"
              max="4320"
              step="1"
              value={heightDraft}
              onChange={(event) => setHeightDraft(event.currentTarget.value)}
              onBlur={commitCustomCanvas}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </label>
        </div>
        <label className="speed-field">
          Frame rate <span>12–60 fps</span>
          <input
            type="number"
            min="12"
            max="60"
            step="any"
            value={frameRateDraft}
            onChange={(event) => setFrameRateDraft(event.currentTarget.value)}
            onBlur={() => {
              const value = Number(frameRateDraft);
              if (Number.isFinite(value) && value >= 12 && value <= 60) {
                applyTimelineEdit((current) => ({ ...current, fps: value }));
              } else {
                setFrameRateDraft(String(timeline.fps));
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </label>
        <div className="studio-details-color-row">
          <label>
            Background{" "}
            <input
              type="color"
              value={timeline.backgroundColor ?? "#11131a"}
              onChange={(event) => {
                const color = event.currentTarget.value;
                applyTimelineEdit((current) => ({ ...current, backgroundColor: color }));
              }}
            />
          </label>
          {timeline.backgroundColor && timeline.backgroundColor !== "#11131a" && (
            <button
              type="button"
              className="editor-action"
              onClick={() => applyTimelineEdit((current) => ({ ...current, backgroundColor: undefined }))}
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <button className="editor-action" onClick={openExportSettings}>
        Export settings
      </button>
    </div>
  );
}
