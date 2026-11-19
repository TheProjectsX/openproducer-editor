import type { MutableRefObject } from "react";
import type { VideoTimelineAsset } from "../../../lib/project-store";

export function CaptionsTab({
  captionSourceAssets,
  selectedCaptionIds,
  timelineAssets,
  projectId,
  ready,
  exporting,
  captionSelectionAnchorRef,
  binPointerRef,
  suppressBinClickRef,
  setSelectedCaptionIds,
  importCaptionFiles,
  removeCaptionFiles,
  placeCaptionBatch,
  selectCaptionAsset,
  moveBinPointer,
  finishBinPointer,
  cancelBinPointer,
}: {
  captionSourceAssets: VideoTimelineAsset[];
  selectedCaptionIds: string[];
  timelineAssets: VideoTimelineAsset[];
  projectId: string;
  ready: boolean;
  exporting: boolean;
  captionSelectionAnchorRef: MutableRefObject<string | null>;
  binPointerRef: MutableRefObject<{
    pointerId: number;
    id: string;
    ids: string[];
    initialX: number;
    initialY: number;
    dragging: boolean;
  } | null>;
  suppressBinClickRef: MutableRefObject<boolean>;
  setSelectedCaptionIds: (ids: string[]) => void;
  importCaptionFiles: (files: File[]) => void;
  removeCaptionFiles: (ids: readonly string[]) => void;
  placeCaptionBatch: (ids: readonly string[]) => void;
  selectCaptionAsset: (id: string, shift: boolean, toggle: boolean) => void;
  moveBinPointer: (event: React.PointerEvent<HTMLButtonElement>) => void;
  finishBinPointer: (event: React.PointerEvent<HTMLButtonElement>) => void;
  cancelBinPointer: () => void;
}) {
  return (
    <>
      <div className="studio-bin-heading">
        <strong>Captions</strong>
        <div className="studio-bin-heading-actions">
          <button
            type="button"
            disabled={!captionSourceAssets.length}
            onClick={() => {
              setSelectedCaptionIds(captionSourceAssets.map((asset) => asset.id));
              captionSelectionAnchorRef.current = captionSourceAssets[0]?.id ?? null;
            }}
          >
            Select all
          </button>
          <button
            type="button"
            disabled={!selectedCaptionIds.length}
            onClick={() => {
              setSelectedCaptionIds([]);
              captionSelectionAnchorRef.current = null;
            }}
          >
            Deselect all
          </button>
          <span>{captionSourceAssets.length} files</span>
        </div>
      </div>
      <div className="studio-media-toolbar">
        <label className="studio-import-button">
          ＋ Import subtitles
          <input
            type="file"
            multiple
            accept=".srt,.vtt,text/vtt,application/x-subrip"
            disabled={Boolean(projectId && !ready) || exporting}
            onChange={(event) => {
              const chosen = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              void importCaptionFiles(chosen);
            }}
          />
        </label>
        <button
          type="button"
          className="studio-caption-remove"
          disabled={!selectedCaptionIds.length}
          onClick={() => removeCaptionFiles(selectedCaptionIds)}
        >
          Remove selected
        </button>
        <button
          type="button"
          className="studio-caption-place"
          disabled={!selectedCaptionIds.length}
          onClick={() => placeCaptionBatch(selectedCaptionIds)}
        >
          Add to timeline
        </button>
      </div>
      <p className="studio-caption-help">
        SRT and VTT files stay here until placed. Select multiple files with Ctrl or Shift, then drag them anywhere on
        the timeline. Cue times always follow the subtitle files.
      </p>
      <div className="studio-bin-grid">
        {captionSourceAssets.map((asset) => {
          const matchedVideo = timelineAssets.find(
            (item) => item.id === asset.derivedFromAssetId && item.kind === "video"
          );
          return (
            <button
              type="button"
              key={asset.id}
              data-asset-id={asset.id}
              className={`bin-item studio-caption-file ${selectedCaptionIds.includes(asset.id) ? "bin-selected" : ""}`}
              aria-pressed={selectedCaptionIds.includes(asset.id)}
              title={`Select ${asset.name}. Ctrl-click to toggle, Shift-click to select a range; drag selected subtitles to the timeline.`}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                const ids =
                  selectedCaptionIds.includes(asset.id) && !event.ctrlKey && !event.metaKey && !event.shiftKey
                    ? captionSourceAssets.filter((item) => selectedCaptionIds.includes(item.id)).map((item) => item.id)
                    : [asset.id];
                binPointerRef.current = {
                  pointerId: event.pointerId,
                  id: asset.id,
                  ids,
                  initialX: event.clientX,
                  initialY: event.clientY,
                  dragging: false,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={moveBinPointer}
              onPointerUp={finishBinPointer}
              onPointerCancel={cancelBinPointer}
              onClick={(event) => {
                if (suppressBinClickRef.current) {
                  event.preventDefault();
                  return;
                }
                if (event.detail === 0) return;
                selectCaptionAsset(asset.id, event.shiftKey, event.ctrlKey || event.metaKey);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey || event.shiftKey)) {
                  event.preventDefault();
                  selectCaptionAsset(asset.id, event.shiftKey, event.ctrlKey || event.metaKey);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  placeCaptionBatch(selectedCaptionIds.includes(asset.id) ? selectedCaptionIds : [asset.id]);
                }
              }}
            >
              <span className="studio-asset-thumb text">
                CC
                <span className="studio-asset-duration">{asset.captionCues?.length ?? 0} cues</span>
              </span>
              <strong title={asset.name}>{asset.name}</strong>
              {matchedVideo && <small>Matches {matchedVideo.name}</small>}
            </button>
          );
        })}
      </div>
      {!captionSourceAssets.length && (
        <div className="studio-bin-empty">
          <span>CC</span>
          <strong>No subtitle files</strong>
          <p>Import an SRT or VTT file to add it to this bin.</p>
        </div>
      )}
    </>
  );
}
