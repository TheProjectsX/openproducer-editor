import type { MutableRefObject, RefObject } from "react";
import type { VideoTimelineAsset, VideoTimelineClip, VideoTransitionType } from "../../../lib/project-store";
import type { MediaFilter, MediaSort, SortDirection } from "../../../lib/video-media-bin";
import type { TEXT_PRESETS } from "../types";
import { MediaTab } from "./media-tab";
import { LibraryTab } from "./library-tab";
import { TextTab } from "./text-tab";
import { CaptionsTab } from "./captions-tab";
import { ShapesTab } from "./shapes-tab";
import { TransitionsTab } from "./transitions-tab";

export function VideoStudioBin({
  activeBinTab,
  setActiveBinTab,
  binBodyRef,
  beginBinMarquee,
  moveBinMarquee,
  finishBinMarquee,
  cancelBinMarquee,
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
  libraryTab,
  libraryBackgroundColor,
  setLibraryTab,
  setLibraryBackgroundColor,
  addLibraryColorBackground,
  onAddTitlePreset,
  captionSourceAssets,
  selectedCaptionIds,
  timelineAssets,
  captionSelectionAnchorRef,
  setSelectedCaptionIds,
  importCaptionFiles,
  removeCaptionFiles,
  placeCaptionBatch,
  selectCaptionAsset,
  shapeColor,
  setShapeColor,
  onAddShapeOverlay,
  selectedClip,
  transitionDuration,
  setTransitionDuration,
  createTransitionToNext,
}: {
  activeBinTab: "media" | "library" | "text" | "caption" | "shapes" | "transitions";
  setActiveBinTab: (tab: "media" | "library" | "text" | "caption" | "shapes" | "transitions") => void;
  binBodyRef: RefObject<HTMLDivElement | null>;
  beginBinMarquee: (event: React.PointerEvent<HTMLDivElement>) => void;
  moveBinMarquee: (event: React.PointerEvent<HTMLDivElement>) => void;
  finishBinMarquee: (event: React.PointerEvent<HTMLDivElement>) => void;
  cancelBinMarquee: (event: React.PointerEvent<HTMLDivElement>) => void;
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
  libraryTab: "image" | "video" | "sound";
  libraryBackgroundColor: string;
  setLibraryTab: (tab: "image" | "video" | "sound") => void;
  setLibraryBackgroundColor: (color: string) => void;
  addLibraryColorBackground: () => void;
  onAddTitlePreset: (preset: (typeof TEXT_PRESETS)[0]) => void;
  captionSourceAssets: VideoTimelineAsset[];
  selectedCaptionIds: string[];
  timelineAssets: VideoTimelineAsset[];
  captionSelectionAnchorRef: MutableRefObject<string | null>;
  setSelectedCaptionIds: (ids: string[]) => void;
  importCaptionFiles: (files: File[]) => void;
  removeCaptionFiles: (ids: readonly string[]) => void;
  placeCaptionBatch: (ids: readonly string[]) => void;
  selectCaptionAsset: (id: string, shift: boolean, toggle: boolean) => void;
  shapeColor: string;
  setShapeColor: (color: string) => void;
  onAddShapeOverlay: (shapeId: string) => void;
  selectedClip?: VideoTimelineClip;
  transitionDuration: string;
  setTransitionDuration: (duration: string) => void;
  createTransitionToNext: (kind: "dissolve" | "crossfade" | "fade-black" | VideoTransitionType) => void;
}) {
  const tabs = ["media", "library", "text", "caption", "shapes", "transitions"] as const;

  return (
    <aside className="video-bin">
      <div className="studio-bin-tabs" role="tablist" aria-label="Editor tools">
        {tabs.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeBinTab === tab}
            className={activeBinTab === tab ? "active" : ""}
            onClick={() => setActiveBinTab(tab)}
          >
            {tab === "media"
              ? "▣"
              : tab === "library"
                ? "▤"
                : tab === "text"
                  ? "T"
                  : tab === "caption"
                    ? "CC"
                    : tab === "shapes"
                      ? "□"
                      : "◇"}
            <span>{tab[0].toUpperCase() + tab.slice(1)}</span>
          </button>
        ))}
      </div>
      <div
        className="studio-bin-body"
        ref={binBodyRef}
        onPointerDown={beginBinMarquee}
        onPointerMove={moveBinMarquee}
        onPointerUp={finishBinMarquee}
        onPointerCancel={cancelBinMarquee}
      >
        {activeBinTab === "media" ? (
          <MediaTab
            visibleMediaAssets={visibleMediaAssets}
            selectedBinIds={selectedBinIds}
            mediaAssetCount={mediaAssetCount}
            mediaFilter={mediaFilter}
            mediaSort={mediaSort}
            mediaSortDirection={mediaSortDirection}
            assetUrls={assetUrls}
            projectId={projectId}
            ready={ready}
            exporting={exporting}
            binSelectionAnchorRef={binSelectionAnchorRef}
            binPointerRef={binPointerRef}
            suppressBinClickRef={suppressBinClickRef}
            setSelectedBinIds={setSelectedBinIds}
            setMediaFilter={setMediaFilter}
            setMediaSort={setMediaSort}
            setMediaSortDirection={setMediaSortDirection}
            importFiles={importFiles}
            removeMediaAssets={removeMediaAssets}
            selectBinAsset={selectBinAsset}
            placeMediaBatch={placeMediaBatch}
            playhead={playhead}
            moveBinPointer={moveBinPointer}
            finishBinPointer={finishBinPointer}
            cancelBinPointer={cancelBinPointer}
          />
        ) : activeBinTab === "library" ? (
          <LibraryTab
            libraryTab={libraryTab}
            libraryBackgroundColor={libraryBackgroundColor}
            projectId={projectId}
            ready={ready}
            exporting={exporting}
            setLibraryTab={setLibraryTab}
            setLibraryBackgroundColor={setLibraryBackgroundColor}
            addLibraryColorBackground={addLibraryColorBackground}
          />
        ) : activeBinTab === "text" ? (
          <TextTab
            projectId={projectId}
            ready={ready}
            exporting={exporting}
            onAddTitlePreset={onAddTitlePreset}
          />
        ) : activeBinTab === "caption" ? (
          <CaptionsTab
            captionSourceAssets={captionSourceAssets}
            selectedCaptionIds={selectedCaptionIds}
            timelineAssets={timelineAssets}
            projectId={projectId}
            ready={ready}
            exporting={exporting}
            captionSelectionAnchorRef={captionSelectionAnchorRef}
            binPointerRef={binPointerRef}
            suppressBinClickRef={suppressBinClickRef}
            setSelectedCaptionIds={setSelectedCaptionIds}
            importCaptionFiles={importCaptionFiles}
            removeCaptionFiles={removeCaptionFiles}
            placeCaptionBatch={placeCaptionBatch}
            selectCaptionAsset={selectCaptionAsset}
            moveBinPointer={moveBinPointer}
            finishBinPointer={finishBinPointer}
            cancelBinPointer={cancelBinPointer}
          />
        ) : activeBinTab === "shapes" ? (
          <ShapesTab
            shapeColor={shapeColor}
            projectId={projectId}
            ready={ready}
            exporting={exporting}
            setShapeColor={setShapeColor}
            onAddShapeOverlay={onAddShapeOverlay}
          />
        ) : (
          <TransitionsTab
            selectedClip={selectedClip}
            transitionDuration={transitionDuration}
            setTransitionDuration={setTransitionDuration}
            createTransitionToNext={createTransitionToNext}
          />
        )}
      </div>
    </aside>
  );
}
