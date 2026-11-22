import { createPortal } from "react-dom";
import { VideoStudioProvider, useVideoStudio } from "./video-studio-context";
import { VideoStudioHeader } from "./header/video-studio-header";
import { VideoStudioBin } from "./bin/video-studio-bin";
import { VideoStudioPreview } from "./preview/video-studio-preview";
import { VideoInspector } from "./inspector/video-inspector";
import { VideoStudioTimeline } from "./timeline/video-studio-timeline";
import { ExportModal } from "./modals/export-modal";
import { ShortcutsModal } from "./modals/shortcuts-modal";
import { ClipContextMenu } from "./modals/clip-context-menu";

function VideoStudioContent() {
  const studio = useVideoStudio();

  const targetContextMenuClip = studio.clipContextMenu
    ? studio.timeline.clips.find((clip) => clip.id === studio.clipContextMenu?.clipId)
    : null;
  const targetContextMenuAsset = targetContextMenuClip
    ? studio.timeline.assets.find((asset) => asset.id === targetContextMenuClip.assetId)
    : undefined;

  return (
    <main
      className="video-studio-page"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (event.dataTransfer.files.length) void studio.importFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <VideoStudioHeader
        projectId={studio.projectId}
        projectTitle={studio.projectTitle}
        setProjectTitle={studio.setProjectTitle}
        status={studio.status}
        error={studio.error}
        extractingAudio={studio.extractingAudio}
        extractProgress={studio.extractProgress}
        onCancelAudioExtraction={() => void studio.cancelAudioExtraction()}
        onCreateVideoProject={() => void studio.createVideoProject()}
        onOpenShortcuts={() => studio.setShortcutsOpen(true)}
        onOpenExportSettings={studio.openExportSettings}
      />

      <section className="video-editor-layout" inert={studio.exporting || studio.extractingAudio}>
        <VideoStudioBin
          activeBinTab={studio.activeBinTab}
          setActiveBinTab={studio.setActiveBinTab}
          binBodyRef={studio.binBodyRef}
          beginBinMarquee={studio.beginBinMarquee}
          moveBinMarquee={studio.moveBinMarquee}
          finishBinMarquee={studio.finishBinMarquee}
          cancelBinMarquee={studio.cancelBinMarquee}
          visibleMediaAssets={studio.visibleMediaAssets}
          selectedBinIds={studio.selectedBinIds}
          mediaAssetCount={studio.mediaAssetCount}
          mediaFilter={studio.mediaFilter}
          mediaSort={studio.mediaSort}
          mediaSortDirection={studio.mediaSortDirection}
          assetUrls={studio.assetUrls}
          projectId={studio.projectId}
          ready={studio.ready}
          exporting={studio.exporting}
          binSelectionAnchorRef={studio.binSelectionAnchorRef}
          binPointerRef={studio.binPointerRef}
          suppressBinClickRef={studio.suppressBinClickRef}
          setSelectedBinIds={studio.setSelectedBinIds}
          setMediaFilter={studio.setMediaFilter}
          setMediaSort={studio.setMediaSort}
          setMediaSortDirection={studio.setMediaSortDirection}
          importFiles={studio.importFiles}
          removeMediaAssets={studio.removeMediaAssets}
          selectBinAsset={studio.selectBinAsset}
          placeMediaBatch={studio.placeMediaBatch}
          playhead={studio.timeline.playhead}
          moveBinPointer={studio.moveBinPointer}
          finishBinPointer={studio.finishBinPointer}
          cancelBinPointer={studio.cancelBinPointer}
          libraryTab={studio.libraryTab}
          libraryBackgroundColor={studio.libraryBackgroundColor}
          setLibraryTab={studio.setLibraryTab}
          setLibraryBackgroundColor={studio.setLibraryBackgroundColor}
          addLibraryColorBackground={studio.addLibraryColorBackground}
          onAddTitlePreset={studio.addTitlePreset}
          captionSourceAssets={studio.captionSourceAssets}
          selectedCaptionIds={studio.selectedCaptionIds}
          timelineAssets={studio.timeline.assets}
          captionSelectionAnchorRef={studio.captionSelectionAnchorRef}
          setSelectedCaptionIds={studio.setSelectedCaptionIds}
          importCaptionFiles={studio.importCaptionFiles}
          removeCaptionFiles={studio.removeCaptionFiles}
          placeCaptionBatch={studio.placeCaptionBatch}
          selectCaptionAsset={studio.selectCaptionAsset}
          shapeColor={studio.shapeColor}
          setShapeColor={studio.setShapeColor}
          onAddShapeOverlay={studio.addShapeOverlay}
          selectedClip={studio.selectedClip}
          transitionDuration={studio.transitionDuration}
          setTransitionDuration={studio.setTransitionDuration}
          createTransitionToNext={studio.createTransitionToNext}
        />

        <VideoStudioPreview
          previewRef={studio.previewRef}
          stageRef={studio.stageRef}
          viewportRef={studio.viewportRef}
          canvasRef={studio.canvasRef}
          playerExpanded={studio.playerExpanded}
          previewAsset={studio.previewAsset}
          timeline={studio.timeline}
          previewPan={studio.previewPan}
          previewZoom={studio.previewZoom}
          previewSnapGuides={studio.previewSnapGuides}
          previewOverlays={studio.previewOverlays}
          selected={studio.selected}
          selectedClips={studio.selectedClips}
          assetUrls={studio.assetUrls}
          videoRefs={studio.videoRefs}
          audioRefs={studio.audioRefs}
          imageRefs={studio.imageRefs}
          playing={studio.playing}
          previewZoomDraft={studio.previewZoomDraft}
          widthDraft={studio.widthDraft}
          heightDraft={studio.heightDraft}
          beginStagePan={studio.beginStagePan}
          moveStagePan={studio.moveStagePan}
          finishStagePan={studio.finishStagePan}
          beginTextGesture={studio.beginTextGesture}
          moveTextGesture={studio.moveTextGesture}
          finishTextGesture={studio.finishTextGesture}
          beginImageGesture={studio.beginImageGesture}
          moveImageGesture={studio.moveImageGesture}
          finishImageGesture={studio.finishImageGesture}
          setMediaRevision={studio.setMediaRevision}
          stepFrame={studio.stepFrame}
          togglePlayback={studio.togglePlayback}
          setPreviewZoomValue={studio.setPreviewZoomValue}
          setPreviewZoomDraft={studio.setPreviewZoomDraft}
          selectAspectRatio={studio.selectAspectRatio}
          setWidthDraft={studio.setWidthDraft}
          setHeightDraft={studio.setHeightDraft}
          commitCustomCanvas={studio.commitCustomCanvas}
          toggleFullscreen={studio.toggleFullscreen}
        />

        <VideoInspector
          selectedClip={studio.selectedClip}
          selectedClips={studio.selectedClips}
          selectedAsset={studio.selectedAsset}
          selectedTransform={studio.selectedTransform}
          selectedValues={studio.selectedValues}
          selectedImageGeometry={studio.selectedImageGeometry}
          imageCrop={studio.imageCrop}
          timeline={studio.timeline}
          projectId={studio.projectId}
          projectTitle={studio.projectTitle}
          mediaAssetCount={studio.mediaAssetCount}
          visibleTracks={studio.visibleTracks}
          widthDraft={studio.widthDraft}
          heightDraft={studio.heightDraft}
          frameRateDraft={studio.frameRateDraft}
          inspectorTab={studio.inspectorTab}
          anchorReason={studio.anchorReason}
          hasTransformEdits={studio.hasTransformEdits}
          hasKeyframeAtPlayhead={studio.hasKeyframeAtPlayhead}
          extractingAudio={studio.extractingAudio}
          extractProgress={studio.extractProgress}
          availableAudioAssets={studio.availableAudioAssets}
          selectedReplacementAudioAssetId={studio.selectedReplacementAudioAssetId}
          replacementAudioOffset={studio.replacementAudioOffset}
          transitionDuration={studio.transitionDuration}
          setInspectorTab={studio.setInspectorTab}
          setProjectTitle={studio.setProjectTitle}
          selectAspectRatio={studio.selectAspectRatio}
          setWidthDraft={studio.setWidthDraft}
          setHeightDraft={studio.setHeightDraft}
          commitCustomCanvas={studio.commitCustomCanvas}
          setFrameRateDraft={studio.setFrameRateDraft}
          applyTimelineEdit={studio.applyTimelineEdit}
          openExportSettings={studio.openExportSettings}
          editClip={studio.editClip}
          patchSelectedTransform={studio.patchSelectedTransform}
          patchSelectedTransitions={studio.patchSelectedTransitions}
          patchSelectedStart={studio.patchSelectedStart}
          patchSelectedSpeed={studio.patchSelectedSpeed}
          patchSelectedVolume={studio.patchSelectedVolume}
          patchSelectedDuration={studio.patchSelectedDuration}
          toggleKeyframeAtPlayhead={studio.toggleKeyframeAtPlayhead}
          alignSelectedVisual={studio.alignSelectedVisual}
          freezeFrameClip={studio.freezeFrameClip}
          setSelectedImageSize={studio.setSelectedImageSize}
          setSelectedImageCrop={studio.setSelectedImageCrop}
          resetSelectedImageCrop={studio.resetSelectedImageCrop}
          createTransitionToNext={studio.createTransitionToNext}
          setTransitionDuration={studio.setTransitionDuration}
          detachVideoAudio={studio.detachVideoAudio}
          setReplacementAudioAssetId={studio.setReplacementAudioAssetId}
          setReplacementAudioOffset={studio.setReplacementAudioOffset}
          replaceVideoAudio={studio.replaceVideoAudio}
          editTitleAsset={studio.editTitleAsset}
          patchSelectedEffects={studio.patchSelectedEffects}
          addOrUpdateKeyframe={studio.addOrUpdateKeyframe}
          removeKeyframeAtPlayhead={studio.removeKeyframeAtPlayhead}
        />
      </section>

      <VideoStudioTimeline
        timeline={studio.timeline}
        timelineViewportWidth={studio.timelineViewportWidth}
        historyVersion={studio.historyVersion}
        historyRef={studio.historyRef}
        selectedClip={studio.selectedClip}
        mainClipAtPlayhead={studio.mainClipAtPlayhead}
        ripplePrimaryTrack={studio.ripplePrimaryTrack}
        snapEnabled={studio.snapEnabled}
        snapThreshold={studio.snapThreshold}
        zoom={studio.zoom}
        pxPerSecond={studio.pxPerSecond}
        deleteHoveredSide={studio.deleteHoveredSide}
        undo={studio.undo}
        redo={studio.redo}
        splitSelected={studio.splitSelected}
        removeClip={studio.removeClip}
        setRipplePrimaryTrack={studio.setRipplePrimaryTrack}
        setSnapEnabled={studio.setSnapEnabled}
        setSnapThreshold={studio.setSnapThreshold}
        setZoom={studio.setZoom}
        fitTimelineZoom={studio.fitTimelineZoom}
        timelineScrollRef={studio.timelineScrollRef}
        beginTimelineMarquee={studio.beginTimelineMarquee}
        moveTimelineMarquee={studio.moveTimelineMarquee}
        finishTimelineMarquee={studio.finishTimelineMarquee}
        cancelTimelineMarquee={studio.cancelTimelineMarquee}
        justSeekedRef={studio.justSeekedRef}
        suppressTimelineClickRef={studio.suppressTimelineClickRef}
        selectTimelineClip={studio.selectTimelineClip}
        rulerHoverGuide={studio.rulerHoverGuide}
        setPlaying={studio.setPlaying}
        seekTimeline={studio.seekTimeline}
        showRulerHoverGuide={studio.showRulerHoverGuide}
        setRulerHoverGuide={studio.setRulerHoverGuide}
        setTimeline={studio.setTimeline}
        activeTrackDragKind={studio.activeTrackDragKind}
        nextOverlayTrack={studio.nextOverlayTrack}
        nextAudioTrack={studio.nextAudioTrack}
        previewTrackDrop={studio.previewTrackDrop}
        finishTrackDrop={studio.finishTrackDrop}
        audioLaneCount={studio.audioLaneCount}
        overlayLaneCount={studio.overlayLaneCount}
        visibleTracks={studio.visibleTracks}
        dragKind={studio.dragKind}
        dropPreview={studio.dropPreview}
        waveforms={studio.waveforms}
        selected={studio.selected}
        selectedClips={studio.selectedClips}
        assetUrls={studio.assetUrls}
        draggingRef={studio.draggingRef}
        toggleTrackState={studio.toggleTrackState}
        setDropPreview={studio.setDropPreview}
        moveTrim={studio.moveTrim}
        finishTrim={studio.finishTrim}
        beginTrim={studio.beginTrim}
        setActiveTrackDragKind={studio.setActiveTrackDragKind}
        setHoveredClipId={studio.setHoveredClipId}
        setClipContextMenu={studio.setClipContextMenu}
        playheadDragRef={studio.playheadDragRef}
        movePlayhead={studio.movePlayhead}
        finishPlayheadDrag={studio.finishPlayheadDrag}
        exporting={studio.exporting}
      />

      <p className="resize-note editor-disclaimer">
        Timeline preview composites active visual clips from bottom to top, including per-clip transforms, text titles,
        and custom linear fade transitions. Audio lanes play in sync with the project clock. Timeline render/export is
        available in supported browsers; verify output playback for your media and device.
      </p>

      {studio.binMarquee &&
        typeof document !== "undefined" &&
        createPortal(<div className="studio-bin-marquee" style={studio.binMarquee} aria-hidden="true" />, document.body)}

      {studio.timelineMarquee &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="studio-bin-marquee" style={studio.timelineMarquee} aria-hidden="true" />,
          document.body
        )}

      {studio.binDragPreview &&
        studio.draggedBinAsset &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="studio-bin-drag-ghost"
            style={{ left: studio.binDragPreview.x + 12, top: studio.binDragPreview.y + 12 }}
            aria-hidden="true"
          >
            {studio.draggedBinAsset.kind === "image" && studio.assetUrls[studio.draggedBinAsset.id] ? (
              <img src={studio.assetUrls[studio.draggedBinAsset.id]} alt="" />
            ) : studio.draggedBinAsset.kind === "video" && studio.assetUrls[studio.draggedBinAsset.id] ? (
              <video
                src={studio.assetUrls[studio.draggedBinAsset.id]}
                muted
                preload="metadata"
                onLoadedMetadata={(event) => {
                  event.currentTarget.currentTime = Math.min(0.1, studio.draggedBinAsset!.duration / 2);
                }}
              />
            ) : (
              <span>{studio.draggedBinAsset.captionSourceName ? "CC" : studio.draggedBinAsset.kind === "audio" ? "♫" : "T"}</span>
            )}
            {studio.binDragPreview.count > 1 && (
              <span className="studio-bin-drag-count">{studio.binDragPreview.count}</span>
            )}
          </div>,
          document.body
        )}

      {studio.clipContextMenu && targetContextMenuClip && (
        <ClipContextMenu
          menu={studio.clipContextMenu}
          targetClip={targetContextMenuClip}
          targetAsset={targetContextMenuAsset}
          hasCopiedClip={Boolean(studio.copiedClipRef.current)}
          extractingAudio={studio.extractingAudio}
          onClose={() => studio.setClipContextMenu(null)}
          onSelectClip={studio.selectTimelineClip}
          onSplit={studio.splitSelected}
          onCopy={studio.copyClip}
          onPaste={studio.pasteClip}
          onDuplicate={studio.duplicateClip}
          onFreezeFrame={(id) => void studio.freezeFrameClip(id)}
          onDetachAudio={() => void studio.detachVideoAudio()}
          onDelete={studio.removeClip}
        />
      )}

      {studio.shortcutsOpen && <ShortcutsModal onClose={() => studio.setShortcutsOpen(false)} />}

      <ExportModal
        exportOpen={studio.exportOpen}
        exporting={studio.exporting}
        exportProgress={studio.exportProgress}
        timeline={studio.timeline}
        exportWidthDraft={studio.exportWidthDraft}
        exportHeightDraft={studio.exportHeightDraft}
        exportFrameRateDraft={studio.exportFrameRateDraft}
        videoBitrate={studio.videoBitrate}
        audioBitrate={studio.audioBitrate}
        outputSettingsValid={studio.outputSettingsValid}
        resultUrl={studio.resultUrl}
        resultType={studio.resultType}
        setExportOpen={studio.setExportOpen}
        setExportWidthDraft={studio.setExportWidthDraft}
        setExportHeightDraft={studio.setExportHeightDraft}
        setExportFrameRateDraft={studio.setExportFrameRateDraft}
        setVideoBitrate={studio.setVideoBitrate}
        setAudioBitrate={studio.setAudioBitrate}
        cancelExport={studio.cancelExport}
        onExportTimeline={studio.exportTimeline}
      />
    </main>
  );
}

export default function VideoStudio() {
  return (
    <VideoStudioProvider>
      <VideoStudioContent />
    </VideoStudioProvider>
  );
}
