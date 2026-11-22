import { CustomMediaPreview } from "../../custom-media-preview";
import type { VideoTimelineProject } from "../../../lib/project-store";

export function ExportModal({
  exportOpen,
  exporting,
  exportProgress,
  timeline,
  exportWidthDraft,
  exportHeightDraft,
  exportFrameRateDraft,
  videoBitrate,
  audioBitrate,
  outputSettingsValid,
  resultUrl,
  resultType,
  setExportOpen,
  setExportWidthDraft,
  setExportHeightDraft,
  setExportFrameRateDraft,
  setVideoBitrate,
  setAudioBitrate,
  cancelExport,
  onExportTimeline,
}: {
  exportOpen: boolean;
  exporting: boolean;
  exportProgress: number;
  timeline: VideoTimelineProject;
  exportWidthDraft: string;
  exportHeightDraft: string;
  exportFrameRateDraft: string;
  videoBitrate: string;
  audioBitrate: string;
  outputSettingsValid: boolean;
  resultUrl: string;
  resultType: string;
  setExportOpen: (open: boolean) => void;
  setExportWidthDraft: (val: string) => void;
  setExportHeightDraft: (val: string) => void;
  setExportFrameRateDraft: (val: string) => void;
  setVideoBitrate: (val: string) => void;
  setAudioBitrate: (val: string) => void;
  cancelExport: () => void;
  onExportTimeline: () => void;
}) {
  if (!exportOpen) return null;

  return (
    <div
      className="studio-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !exporting) setExportOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !exporting) setExportOpen(false);
      }}
    >
      <section className="video-export-panel" role="dialog" aria-modal="true" aria-label="Export video settings">
        <div className="resize-controls">
          <div className="studio-export-heading">
            <div>
              <span>LOCAL EXPORT</span>
              <h2>Export video</h2>
            </div>
            <button
              type="button"
              autoFocus
              aria-label="Close export settings"
              disabled={exporting}
              onClick={() => setExportOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="filter-fields">
            <label>
              Output width <span>custom px</span>
              <input
                type="number"
                min="16"
                max="7680"
                value={exportWidthDraft}
                disabled={exporting}
                onChange={(event) => setExportWidthDraft(event.currentTarget.value)}
              />
            </label>
            <label>
              Output height <span>custom px</span>
              <input
                type="number"
                min="16"
                max="4320"
                value={exportHeightDraft}
                disabled={exporting}
                onChange={(event) => setExportHeightDraft(event.currentTarget.value)}
              />
            </label>
          </div>
          <div className="filter-fields">
            <label>
              Frame rate <span>custom · 12–60 fps</span>
              <input
                type="number"
                min="12"
                max="60"
                step="any"
                value={exportFrameRateDraft}
                disabled={exporting}
                onChange={(event) => setExportFrameRateDraft(event.currentTarget.value)}
              />
            </label>
            <label>
              Video bitrate <span>custom · Mbps</span>
              <input
                type="number"
                min="0.5"
                max="40"
                step="any"
                value={videoBitrate}
                disabled={exporting}
                onChange={(event) => setVideoBitrate(event.currentTarget.value)}
              />
            </label>
          </div>
          {timeline.clips.some((clip) => clip.track < 0) && (
            <label className="speed-field">
              Audio bitrate <span>custom · 64–320 kbps</span>
              <input
                type="number"
                min="64"
                max="320"
                step="any"
                value={audioBitrate}
                disabled={exporting}
                onChange={(event) => setAudioBitrate(event.currentTarget.value)}
              />
            </label>
          )}
          <p className="resize-note">
            The renderer chooses MP4 or WebM after checking this browser’s video and audio encoders. First renderer
            limits: 120 seconds, 4 megapixels per frame, 180 seconds of source audio, and 512 MiB output. Export is local
            and may run slower than playback. Audio in video clips is included in preview and export; detaching or
            replacing it mutes the original clip audio.
          </p>
          {timeline.width * timeline.height > 4_000_000 && (
            <p className="resize-error" role="alert">
              Choose canvas dimensions under 4 megapixels for this first export renderer.
            </p>
          )}
          {exporting && (
            <>
              <p className="source-info" role="status">
                Rendering local timeline: {exportProgress}%
              </p>
              <progress max="100" value={exportProgress} aria-label="Timeline export progress" />
              <button className="editor-action danger" onClick={cancelExport}>
                Cancel export
              </button>
            </>
          )}
          {!outputSettingsValid && (
            <p className="resize-error" role="alert">
              Enter valid dimensions, frame rate, and bitrates within the displayed ranges.
            </p>
          )}
          <button
            className="export-button"
            disabled={
              !timeline.clips.length ||
              !timeline.duration ||
              timeline.duration > 120 ||
              !outputSettingsValid ||
              exporting
            }
            onClick={() => void onExportTimeline()}
          >
            {exporting ? "Rendering…" : "Render and export video"}
          </button>
          {timeline.duration > 120 && (
            <p className="resize-error" role="alert">
              Trim the timeline to 120 seconds or less for this export prototype.
            </p>
          )}
          {resultUrl && (
            <a
              className="export-button download-link"
              href={resultUrl}
              download={`local-studio-edit.${resultType === "video/mp4" ? "mp4" : "webm"}`}
            >
              Download {resultType === "video/mp4" ? "MP4" : "WebM"}
            </a>
          )}
        </div>
        <div className="resize-preview">
          <div className="preview-heading">
            <strong>Export preview</strong>
            <span>{resultUrl ? "Rendered file" : "Export keeps your editable project"}</span>
          </div>
          {resultUrl ? (
            <CustomMediaPreview kind="video" src={resultUrl} label="Rendered video preview" />
          ) : (
            <div className="empty-preview">Render a project to get a playable file.</div>
          )}
        </div>
      </section>
    </div>
  );
}
