import { renameProject } from "../../../lib/project-store";
import { NavBackButton } from "../../nav-back-button";
import { BrandMark } from "../../brand-mark";

export function VideoStudioHeader({
  projectId,
  projectTitle,
  setProjectTitle,
  status,
  error,
  extractingAudio,
  extractProgress,
  onCancelAudioExtraction,
  onCreateVideoProject,
  onOpenShortcuts,
  onOpenExportSettings,
}: {
  projectId: string;
  projectTitle: string;
  setProjectTitle: (title: string) => void;
  status: string;
  error: string;
  extractingAudio: boolean;
  extractProgress: number;
  onCancelAudioExtraction: () => void;
  onCreateVideoProject: () => void;
  onOpenShortcuts: () => void;
  onOpenExportSettings: () => void;
}) {
  return (
    <>
      <div className="video-studio-top">
        <div className="studio-project-identity">
          <NavBackButton fallback="/tools" />
          <BrandMark className="studio-app-mark" />
          <div>
            {projectId ? (
              <input
                className="studio-project-title-input"
                value={projectTitle}
                aria-label="Project title"
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
            ) : (
              <h1>Video Studio</h1>
            )}
            <span className="studio-save-status" role="status">
              {status}
            </span>
          </div>
        </div>
        <div className="editor-top-actions">
          {!projectId && (
            <button className="studio-new-project" onClick={onCreateVideoProject}>
              New project
            </button>
          )}
          <span className="studio-local-badge">● Local project</span>
          <button
            type="button"
            className="studio-shortcuts-button"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            onClick={onOpenShortcuts}
          >
            ?
          </button>
          <button className="studio-export-trigger" onClick={onOpenExportSettings}>
            Export video
          </button>
        </div>
      </div>
      {error && (
        <p className="resize-error" role="alert">
          {error}
        </p>
      )}
      {extractingAudio && (
        <p className="source-info" role="status">
          Detaching source audio: {extractProgress}%{" "}
          <button className="editor-action danger" onClick={onCancelAudioExtraction}>
            Cancel
          </button>
        </p>
      )}
    </>
  );
}
