import type { MutableRefObject } from "react";
import type { VideoTimelineAsset } from "../../../lib/project-store";
import type { MediaFilter, MediaSort, SortDirection } from "../../../lib/video-media-bin";
import { formatAssetDuration } from "../utils";
import { MediaBinControls } from "../controls/media-bin-controls";

export function MediaTab({
  visibleMediaAssets,
  selectedBinIds,
  mediaAssetCount,
  mediaFilter,
  mediaSort,
  mediaSortDirection,
  assetUrls,
  projectId,
  ready,
  exporting,
  binSelectionAnchorRef,
  binPointerRef,
  suppressBinClickRef,
  setSelectedBinIds,
  setMediaFilter,
  setMediaSort,
  setMediaSortDirection,
  importFiles,
  removeMediaAssets,
  selectBinAsset,
  placeMediaBatch,
  playhead,
  moveBinPointer,
  finishBinPointer,
  cancelBinPointer,
}: {
  visibleMediaAssets: VideoTimelineAsset[];
  selectedBinIds: string[];
  mediaAssetCount: number;
  mediaFilter: MediaFilter;
  mediaSort: MediaSort;
  mediaSortDirection: SortDirection;
  assetUrls: Record<string, string>;
  projectId: string;
  ready: boolean;
  exporting: boolean;
  binSelectionAnchorRef: MutableRefObject<string | null>;
  binPointerRef: MutableRefObject<{
    pointerId: number;
    id: string;
    ids: string[];
    initialX: number;
    initialY: number;
    dragging: boolean;
  } | null>;
  suppressBinClickRef: MutableRefObject<boolean>;
  setSelectedBinIds: (ids: string[]) => void;
  setMediaFilter: (filter: MediaFilter) => void;
  setMediaSort: (sort: MediaSort) => void;
  setMediaSortDirection: (dir: SortDirection) => void;
  importFiles: (files: File[]) => void;
  removeMediaAssets: (ids: readonly string[]) => void;
  selectBinAsset: (id: string, shift: boolean, toggle: boolean) => void;
  placeMediaBatch: (ids: readonly string[], track: number, time: number) => void;
  playhead: number;
  moveBinPointer: (event: React.PointerEvent<HTMLButtonElement>) => void;
  finishBinPointer: (event: React.PointerEvent<HTMLButtonElement>) => void;
  cancelBinPointer: () => void;
}) {
  return (
    <>
      <div className="studio-bin-heading">
        <strong>Your media</strong>
        <div className="studio-bin-heading-actions">
          <button
            type="button"
            disabled={!visibleMediaAssets.length}
            onClick={() => {
              setSelectedBinIds(visibleMediaAssets.map((asset) => asset.id));
              binSelectionAnchorRef.current = visibleMediaAssets[0]?.id ?? null;
            }}
          >
            Select all
          </button>
          <button
            type="button"
            disabled={!selectedBinIds.length}
            onClick={() => {
              setSelectedBinIds([]);
              binSelectionAnchorRef.current = null;
            }}
          >
            Deselect all
          </button>
          <button
            type="button"
            disabled={!selectedBinIds.length}
            onClick={() => removeMediaAssets(selectedBinIds)}
          >
            Delete
          </button>
          <span>{mediaAssetCount} items</span>
        </div>
      </div>
      <div className="studio-media-toolbar">
        <label className="studio-import-button">
          ＋ Import media
          <input
            type="file"
            multiple
            accept="video/*,audio/*,image/*,.srt,.vtt"
            disabled={Boolean(projectId && !ready) || exporting}
            onChange={(event) => {
              const chosen = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              void importFiles(chosen);
            }}
          />
        </label>
        <MediaBinControls
          filter={mediaFilter}
          onFilter={(filter) => {
            setMediaFilter(filter);
            setSelectedBinIds([]);
            binSelectionAnchorRef.current = null;
          }}
          sort={mediaSort}
          onSort={(sort) => {
            setMediaSort(sort);
            setMediaSortDirection(sort === "name" || sort === "type" ? "asc" : "desc");
          }}
          direction={mediaSortDirection}
          onDirection={setMediaSortDirection}
        />
      </div>
      <div className="studio-bin-grid">
        {visibleMediaAssets.map((asset) => (
          <button
            key={asset.id}
            data-asset-id={asset.id}
            className={`bin-item ${selectedBinIds.includes(asset.id) ? "bin-selected" : ""}`}
            aria-pressed={selectedBinIds.includes(asset.id)}
            onPointerDown={(event) => {
              if (event.button !== 0 || asset.kind === "text") return;
              const ids =
                selectedBinIds.includes(asset.id) && !event.ctrlKey && !event.metaKey && !event.shiftKey
                  ? visibleMediaAssets.filter((item) => selectedBinIds.includes(item.id)).map((item) => item.id)
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
              selectBinAsset(asset.id, event.shiftKey, event.ctrlKey || event.metaKey);
            }}
            onKeyDown={(event) => {
              if (asset.kind === "text") return;
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey || event.shiftKey)) {
                event.preventDefault();
                selectBinAsset(asset.id, event.shiftKey, event.ctrlKey || event.metaKey);
              } else if (event.key === "Enter") {
                event.preventDefault();
                const ids = selectedBinIds.includes(asset.id) ? selectedBinIds : [asset.id];
                placeMediaBatch(ids, asset.kind === "audio" ? -1 : 0, playhead);
              } else if (event.key === "Delete" || event.key === "Backspace") {
                event.preventDefault();
                const ids = selectedBinIds.includes(asset.id) ? selectedBinIds : [asset.id];
                removeMediaAssets(ids);
              }
            }}
            title={`Select ${asset.name}. Ctrl-click to toggle, Shift-click to select a range; drag selected media to the timeline.`}
          >
            <span className={`studio-asset-thumb ${asset.kind}`}>
              {asset.kind === "image" && assetUrls[asset.id] ? (
                <img src={assetUrls[asset.id]} alt="" />
              ) : asset.kind === "video" && assetUrls[asset.id] ? (
                <video
                  src={assetUrls[asset.id]}
                  muted
                  preload="metadata"
                  onLoadedMetadata={(event) => {
                    event.currentTarget.currentTime = Math.min(0.1, asset.duration / 2);
                  }}
                  aria-hidden="true"
                />
              ) : asset.kind === "audio" ? (
                "♫"
              ) : (
                "T"
              )}
              {asset.kind !== "image" && (
                <span className="studio-asset-duration">{formatAssetDuration(asset.duration)}</span>
              )}
            </span>
            <strong title={asset.name}>{asset.name}</strong>
          </button>
        ))}
      </div>
      {mediaAssetCount > 0 && !visibleMediaAssets.length && (
        <p className="studio-bin-hint studio-bin-no-results">No {mediaFilter} media in this project.</p>
      )}
      {!mediaAssetCount && (
        <div className="studio-bin-empty">
          <span>▣</span>
          <strong>Start with your media</strong>
          <p>Import video, audio, or images. Your files stay on this device.</p>
        </div>
      )}
    </>
  );
}
