import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type { VideoAspectRatioMode, VideoClipTransform, VideoTimelineAsset, VideoTimelineClip, VideoTimelineProject } from "../../../lib/project-store";
import type { imageClipGeometry } from "../../../lib/video-image-layout";
import type { PreviewOverlayBox, PreviewOverlayItem } from "../types";
import { PreviewOverlays } from "./preview-overlays";
import { VideoStudioTransport } from "./video-studio-transport";

export function VideoStudioPreview({
  previewRef,
  stageRef,
  viewportRef,
  canvasRef,
  playerExpanded,
  previewAsset,
  timeline,
  previewPan,
  previewZoom,
  previewSnapGuides,
  previewOverlays,
  selected,
  selectedClips,
  assetUrls,
  videoRefs,
  audioRefs,
  imageRefs,
  playing,
  previewZoomDraft,
  widthDraft,
  heightDraft,
  beginStagePan,
  moveStagePan,
  finishStagePan,
  beginTextGesture,
  moveTextGesture,
  finishTextGesture,
  beginImageGesture,
  moveImageGesture,
  finishImageGesture,
  setMediaRevision,
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
  previewRef: RefObject<HTMLElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  playerExpanded: boolean;
  previewAsset?: VideoTimelineAsset;
  timeline: VideoTimelineProject;
  previewPan: { x: number; y: number };
  previewZoom: number;
  previewSnapGuides: { x: number | null; y: number | null };
  previewOverlays: PreviewOverlayItem[];
  selected: string;
  selectedClips: string[];
  assetUrls: Record<string, string>;
  videoRefs: MutableRefObject<Record<string, HTMLVideoElement>>;
  audioRefs: MutableRefObject<Record<string, HTMLAudioElement>>;
  imageRefs: MutableRefObject<Record<string, HTMLImageElement>>;
  playing: boolean;
  previewZoomDraft: string;
  widthDraft: string;
  heightDraft: string;
  beginStagePan: (event: React.PointerEvent<HTMLDivElement>) => void;
  moveStagePan: (event: React.PointerEvent<HTMLDivElement>) => void;
  finishStagePan: (event: React.PointerEvent<HTMLDivElement>) => void;
  beginTextGesture: (
    event: React.PointerEvent<HTMLDivElement>,
    clip: VideoTimelineClip,
    transform: VideoClipTransform,
    box: PreviewOverlayBox
  ) => void;
  moveTextGesture: (event: React.PointerEvent<HTMLDivElement>) => void;
  finishTextGesture: (event: React.PointerEvent<HTMLDivElement>) => void;
  beginImageGesture: (
    event: React.PointerEvent<HTMLDivElement>,
    clip: VideoTimelineClip,
    transform: VideoClipTransform,
    imageGeometry: ReturnType<typeof imageClipGeometry>,
    box: PreviewOverlayBox
  ) => void;
  moveImageGesture: (event: React.PointerEvent<HTMLDivElement>) => void;
  finishImageGesture: (event: React.PointerEvent<HTMLDivElement>) => void;
  setMediaRevision: Dispatch<SetStateAction<number>>;
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
    <section className={`editor-preview${playerExpanded ? " expanded" : ""}`} ref={previewRef}>
      <div className="preview-heading">
        <strong>Composite preview</strong>
        <span>
          {previewAsset?.name ?? "Nothing at playhead"} · {timeline.playhead.toFixed(2)} s · {timeline.width}×
          {timeline.height}
        </span>
      </div>
      <div
        className="editor-stage"
        ref={stageRef}
        title="Drag empty area to pan when zoomed, or Ctrl+scroll to zoom"
        onPointerDown={beginStagePan}
        onPointerMove={moveStagePan}
        onPointerUp={finishStagePan}
        onPointerCancel={finishStagePan}
      >
        <div
          className="editor-stage-viewport"
          ref={viewportRef}
          style={{ transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})` }}
        >
          <canvas ref={canvasRef} aria-label="Composited video timeline preview" />
          {previewSnapGuides.x !== null && (
            <div className="studio-snap-guide vertical" aria-hidden="true" style={{ left: previewSnapGuides.x }} />
          )}
          {previewSnapGuides.y !== null && (
            <div className="studio-snap-guide horizontal" aria-hidden="true" style={{ top: previewSnapGuides.y }} />
          )}
          <PreviewOverlays
            previewOverlays={previewOverlays}
            selected={selected}
            selectedClips={selectedClips}
            beginTextGesture={beginTextGesture}
            moveTextGesture={moveTextGesture}
            finishTextGesture={finishTextGesture}
            beginImageGesture={beginImageGesture}
            moveImageGesture={moveImageGesture}
            finishImageGesture={finishImageGesture}
          />
        </div>
        <div className="media-sources" aria-hidden="true">
          {timeline.assets
            .filter((asset) => asset.kind === "image")
            .map((asset) => (
              <img
                key={asset.id}
                ref={(el) => {
                  if (el) imageRefs.current[asset.id] = el;
                  else delete imageRefs.current[asset.id];
                }}
                src={assetUrls[asset.id]}
                alt=""
                onLoad={() => setMediaRevision((n) => n + 1)}
              />
            ))}
          {timeline.clips
            .filter((clip) => timeline.assets.find((asset) => asset.id === clip.assetId)?.kind === "video")
            .map((clip) => (
              <video
                key={clip.id}
                ref={(el) => {
                  if (el) videoRefs.current[clip.id] = el;
                  else delete videoRefs.current[clip.id];
                }}
                src={assetUrls[clip.assetId]}
                playsInline
                preload="auto"
                onLoadedData={() => setMediaRevision((n) => n + 1)}
                onSeeked={() => setMediaRevision((n) => n + 1)}
              />
            ))}
          {timeline.clips
            .filter((clip) => clip.track < 0)
            .map((clip) => (
              <audio
                key={clip.id}
                ref={(el) => {
                  if (el) audioRefs.current[clip.id] = el;
                  else delete audioRefs.current[clip.id];
                }}
                src={assetUrls[clip.assetId]}
                preload="auto"
              />
            ))}
        </div>
      </div>
      <VideoStudioTransport
        timeline={timeline}
        playing={playing}
        previewZoom={previewZoom}
        previewPan={previewPan}
        previewZoomDraft={previewZoomDraft}
        widthDraft={widthDraft}
        heightDraft={heightDraft}
        playerExpanded={playerExpanded}
        stepFrame={stepFrame}
        togglePlayback={togglePlayback}
        setPreviewZoomValue={setPreviewZoomValue}
        setPreviewZoomDraft={setPreviewZoomDraft}
        selectAspectRatio={selectAspectRatio}
        setWidthDraft={setWidthDraft}
        setHeightDraft={setHeightDraft}
        commitCustomCanvas={commitCustomCanvas}
        toggleFullscreen={toggleFullscreen}
      />
    </section>
  );
}
