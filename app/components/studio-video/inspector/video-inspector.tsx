import type {
  VideoAspectRatioMode,
  VideoClipTransform,
  VideoClipTransitions,
  VideoImageCrop,
  VideoTimelineAsset,
  VideoTimelineClip,
  VideoTimelineProject,
  VideoTransitionType,
} from "../../../lib/project-store";
import type { imageClipGeometry } from "../../../lib/video-image-layout";
import { ProjectDetailsPanel } from "./project-details-panel";
import { ClipBasicTab } from "./clip-basic-tab";
import { ClipSpeedTab } from "./clip-speed-tab";
import { ClipAudioTab } from "./clip-audio-tab";
import { ClipTextTab } from "./clip-text-tab";
import { ClipDurationTab } from "./clip-duration-tab";
import { ClipAdjustTab } from "./clip-adjust-tab";
import { ClipGlobalTab } from "./clip-global-tab";

export function VideoInspector({
  selectedClip,
  selectedClips,
  selectedAsset,
  selectedTransform,
  selectedValues,
  selectedImageGeometry,
  imageCrop,
  timeline,
  projectId,
  projectTitle,
  mediaAssetCount,
  visibleTracks,
  widthDraft,
  heightDraft,
  frameRateDraft,
  inspectorTab,
  hasTransformEdits,
  hasKeyframeAtPlayhead,
  extractingAudio,
  extractProgress,
  availableAudioAssets,
  selectedReplacementAudioAssetId,
  replacementAudioOffset,
  transitionDuration,
  setInspectorTab,
  setProjectTitle,
  selectAspectRatio,
  setWidthDraft,
  setHeightDraft,
  commitCustomCanvas,
  setFrameRateDraft,
  applyTimelineEdit,
  openExportSettings,
  editClip,
  anchorReason,
  patchSelectedTransform,
  patchSelectedTransitions,
  patchSelectedStart,
  patchSelectedSpeed,
  patchSelectedVolume,
  patchSelectedDuration,
  toggleKeyframeAtPlayhead,
  alignSelectedVisual,
  freezeFrameClip,
  setSelectedImageSize,
  setSelectedImageCrop,
  resetSelectedImageCrop,
  createTransitionToNext,
  setTransitionDuration,
  detachVideoAudio,
  setReplacementAudioAssetId,
  setReplacementAudioOffset,
  replaceVideoAudio,
  editTitleAsset,
  patchSelectedEffects,
  addOrUpdateKeyframe,
  removeKeyframeAtPlayhead,
}: {
  selectedClip?: VideoTimelineClip;
  selectedClips: string[];
  selectedAsset?: VideoTimelineAsset;
  selectedTransform: VideoClipTransform;
  selectedValues: { transform: VideoClipTransform; volume: number } | null;
  selectedImageGeometry: ReturnType<typeof imageClipGeometry> | null;
  imageCrop: VideoImageCrop;
  timeline: VideoTimelineProject;
  projectId: string;
  projectTitle: string;
  mediaAssetCount: number;
  visibleTracks: number[];
  widthDraft: string;
  heightDraft: string;
  frameRateDraft: string;
  inspectorTab: "basic" | "audio" | "speed" | "duration" | "text" | "adjust" | "global";
  anchorReason: "playhead" | "first" | "none";
  hasTransformEdits: boolean;
  hasKeyframeAtPlayhead: boolean;
  extractingAudio: boolean;
  extractProgress: number;
  availableAudioAssets: VideoTimelineAsset[];
  selectedReplacementAudioAssetId: string;
  replacementAudioOffset: string;
  transitionDuration: string;
  setInspectorTab: (tab: "basic" | "audio" | "speed" | "duration" | "text" | "adjust") => void;
  setProjectTitle: (title: string) => void;
  selectAspectRatio: (mode: VideoAspectRatioMode) => void;
  setWidthDraft: (width: string) => void;
  setHeightDraft: (height: string) => void;
  commitCustomCanvas: () => void;
  setFrameRateDraft: (fps: string) => void;
  applyTimelineEdit: (update: (current: VideoTimelineProject) => VideoTimelineProject) => void;
  openExportSettings: () => void;
  editClip: (id: string, patch: Partial<VideoTimelineClip>) => void;
  patchSelectedTransform: (patch: Partial<VideoClipTransform>, options?: { relative?: boolean; reset?: boolean }) => void;
  patchSelectedTransitions: (patch: Partial<VideoClipTransitions>) => void;
  patchSelectedStart: (nextStart: number) => void;
  patchSelectedSpeed: (nextSpeed: number) => void;
  patchSelectedVolume: (nextVolume: number) => void;
  patchSelectedDuration: (nextDuration: number) => void;
  toggleKeyframeAtPlayhead: () => void;
  alignSelectedVisual: (horizontal: "left" | "center" | "right", vertical: "top" | "middle" | "bottom") => void;
  freezeFrameClip: (id: string) => void;
  setSelectedImageSize: (axis: "width" | "height", value: number) => void;
  setSelectedImageCrop: (edge: keyof VideoImageCrop, percent: number) => void;
  resetSelectedImageCrop: () => void;
  createTransitionToNext: (kind: "dissolve" | "crossfade" | "fade-black" | VideoTransitionType) => void;
  setTransitionDuration: (duration: string) => void;
  detachVideoAudio: () => void;
  setReplacementAudioAssetId: (id: string) => void;
  setReplacementAudioOffset: (offset: string) => void;
  replaceVideoAudio: () => void;
  editTitleAsset: (assetId: string, settings: NonNullable<VideoTimelineAsset["textSettings"]>) => void;
  patchSelectedEffects: (patch: Partial<NonNullable<VideoTimelineClip["effects"]>>, options?: { relative?: boolean; reset?: boolean }) => void;
  addOrUpdateKeyframe: () => void;
  removeKeyframeAtPlayhead: () => void;
}) {
  const isMultiSelect = selectedClips.length > 1;
  const multiClips = isMultiSelect ? timeline.clips.filter((clip) => selectedClips.includes(clip.id)) : [];
  const multiKinds = new Set(
    multiClips.map((clip) => {
      const asset = timeline.assets.find((item) => item.id === clip.assetId);
      if (clip.track < 0 || asset?.kind === "audio") return "audio";
      if (asset?.kind === "text") return "text";
      if (asset?.kind === "image") return "image";
      return "video";
    })
  );
  const isMixedMultiSelect = isMultiSelect && multiKinds.size > 1;
  const uniformMultiKind = isMultiSelect && multiKinds.size === 1 ? [...multiKinds][0] : null;
  const multiAllVisual = isMultiSelect && multiClips.length > 0 && multiClips.every((clip) => clip.track >= 0);
  const multiHasAudio =
    isMultiSelect &&
    multiClips.some((clip) => {
      const asset = timeline.assets.find((item) => item.id === clip.assetId);
      return clip.track < 0 || asset?.kind === "audio" || asset?.kind === "video";
    });
  const multiHasColor =
    isMultiSelect &&
    multiClips.some((clip) => {
      const asset = timeline.assets.find((item) => item.id === clip.assetId);
      return clip.track >= 0 && asset?.kind !== "text";
    });
  const isAudioClip = uniformMultiKind === "audio" || (!isMultiSelect && Boolean(selectedClip && (selectedClip.track < 0 || selectedAsset?.kind === "audio")));
  const isVideoClip = uniformMultiKind === "video" || (!isMultiSelect && Boolean(selectedClip && selectedClip.track >= 0 && selectedAsset?.kind === "video"));
  const isImageClip = uniformMultiKind === "image" || (!isMultiSelect && Boolean(selectedClip && selectedClip.track >= 0 && selectedAsset?.kind === "image"));
  const isTextClip = uniformMultiKind === "text" || (!isMultiSelect && Boolean(selectedClip && selectedClip.track >= 0 && selectedAsset?.kind === "text"));

  const inspectorTabs = (
    isMixedMultiSelect
      ? ["global"]
      : isAudioClip
        ? ["basic", "speed"]
        : isVideoClip
          ? ["basic", "audio", "speed", "adjust"]
          : isImageClip
            ? ["basic", "duration", "adjust"]
            : isTextClip
              ? ["text", "basic", "duration"]
              : ["basic", "speed", "adjust"]
  ) as ("basic" | "audio" | "speed" | "duration" | "text" | "adjust" | "global")[];

  const activeInspectorTab = inspectorTabs.includes(inspectorTab) ? inspectorTab : inspectorTabs[0];

  return (
    <aside className="video-inspector">
      <div className="preview-heading">
        <strong>
          {isMixedMultiSelect
            ? "Global"
            : selectedClips.length > 1
              ? `Selection (${uniformMultiKind ? uniformMultiKind[0].toUpperCase() + uniformMultiKind.slice(1) : "Clips"})`
              : selectedClip
                ? selectedAsset?.kind === "audio"
                  ? "Audio"
                  : selectedAsset?.kind === "text"
                    ? "Text"
                    : selectedAsset?.kind === "image"
                      ? "Image"
                      : "Video"
                : "Details"}
        </strong>
        <span>
          {selectedClips.length > 1
            ? `${selectedClips.length} clips selected`
            : selectedClip
              ? "Clip settings"
              : "Project settings"}
        </span>
      </div>

      {!selectedClip && (
        <ProjectDetailsPanel
          projectId={projectId}
          projectTitle={projectTitle}
          mediaAssetCount={mediaAssetCount}
          visibleTracks={visibleTracks}
          timeline={timeline}
          widthDraft={widthDraft}
          heightDraft={heightDraft}
          frameRateDraft={frameRateDraft}
          setProjectTitle={setProjectTitle}
          selectAspectRatio={selectAspectRatio}
          setWidthDraft={setWidthDraft}
          setHeightDraft={setHeightDraft}
          commitCustomCanvas={commitCustomCanvas}
          setFrameRateDraft={setFrameRateDraft}
          applyTimelineEdit={applyTimelineEdit}
          openExportSettings={openExportSettings}
        />
      )}

      {selectedClip && (
        <>
          <div className="studio-inspector-tabs" role="tablist" aria-label="Clip settings">
            {inspectorTabs.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeInspectorTab === tab}
                className={activeInspectorTab === tab ? "active" : ""}
                onClick={() => {
                  if (tab !== "global") setInspectorTab(tab);
                }}
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeInspectorTab === "global" && (
            <ClipGlobalTab
              selectedClip={selectedClip}
              selectedAsset={selectedAsset}
              anchorReason={anchorReason}
              multiAllVisual={multiAllVisual}
              selectedTransform={selectedTransform}
              hasTransformEdits={hasTransformEdits}
              patchSelectedStart={patchSelectedStart}
              patchSelectedTransitions={patchSelectedTransitions}
              patchSelectedTransform={patchSelectedTransform}
            />
          )}

          {activeInspectorTab === "basic" && (
            <ClipBasicTab
              isMultiSelect={isMultiSelect}
              uniformMultiKind={uniformMultiKind}
              multiAllVisual={multiAllVisual}
              multiHasAudio={multiHasAudio}
              selectedClip={selectedClip}
              selectedAsset={selectedAsset}
              selectedTransform={selectedTransform}
              hasTransformEdits={hasTransformEdits}
              hasKeyframeAtPlayhead={hasKeyframeAtPlayhead}
              selectedValues={selectedValues}
              selectedImageGeometry={selectedImageGeometry}
              imageCrop={imageCrop}
              transitionDuration={transitionDuration}
              editClip={editClip}
              patchSelectedTransform={patchSelectedTransform}
              patchSelectedTransitions={patchSelectedTransitions}
              patchSelectedVolume={patchSelectedVolume}
              toggleKeyframeAtPlayhead={toggleKeyframeAtPlayhead}
              alignSelectedVisual={alignSelectedVisual}
              freezeFrameClip={freezeFrameClip}
              setSelectedImageSize={setSelectedImageSize}
              setSelectedImageCrop={setSelectedImageCrop}
              resetSelectedImageCrop={resetSelectedImageCrop}
              createTransitionToNext={createTransitionToNext}
              setTransitionDuration={setTransitionDuration}
            />
          )}

          {activeInspectorTab === "speed" && (
            <ClipSpeedTab
              selectedClip={selectedClip}
              selectedAsset={selectedAsset}
              isMultiSelect={isMultiSelect}
              multiHasAudio={multiHasAudio}
              timelineAssets={timeline.assets}
              editClip={editClip}
              patchSelectedSpeed={patchSelectedSpeed}
            />
          )}

          {activeInspectorTab === "audio" && isVideoClip && (
            <ClipAudioTab
              selectedClip={selectedClip}
              selectedValues={selectedValues}
              hasKeyframeAtPlayhead={hasKeyframeAtPlayhead}
              extractingAudio={extractingAudio}
              extractProgress={extractProgress}
              availableAudioAssets={availableAudioAssets}
              selectedReplacementAudioAssetId={selectedReplacementAudioAssetId}
              replacementAudioOffset={replacementAudioOffset}
              editClip={editClip}
              patchSelectedVolume={patchSelectedVolume}
              toggleKeyframeAtPlayhead={toggleKeyframeAtPlayhead}
              detachVideoAudio={detachVideoAudio}
              setReplacementAudioAssetId={setReplacementAudioAssetId}
              setReplacementAudioOffset={setReplacementAudioOffset}
              replaceVideoAudio={replaceVideoAudio}
            />
          )}

          {activeInspectorTab === "text" && isTextClip && (
            <ClipTextTab
              selectedAsset={selectedAsset}
              hasKeyframeAtPlayhead={hasKeyframeAtPlayhead}
              toggleKeyframeAtPlayhead={toggleKeyframeAtPlayhead}
              editTitleAsset={editTitleAsset}
              alignSelectedVisual={alignSelectedVisual}
            />
          )}

          {activeInspectorTab === "duration" && (isImageClip || isTextClip) && (
            <ClipDurationTab
              selectedClip={selectedClip}
              editClip={editClip}
              patchSelectedDuration={patchSelectedDuration}
              patchSelectedTransitions={patchSelectedTransitions}
            />
          )}

          {activeInspectorTab === "adjust" && (
            <ClipAdjustTab
              selectedClip={selectedClip}
              selectedAsset={selectedAsset}
              selectedTransform={selectedTransform}
              isMultiSelect={isMultiSelect}
              multiHasColor={multiHasColor}
              playhead={timeline.playhead}
              editClip={editClip}
              patchSelectedTransform={patchSelectedTransform}
              patchSelectedEffects={patchSelectedEffects}
              addOrUpdateKeyframe={addOrUpdateKeyframe}
              removeKeyframeAtPlayhead={removeKeyframeAtPlayhead}
            />
          )}
        </>
      )}
    </aside>
  );
}
