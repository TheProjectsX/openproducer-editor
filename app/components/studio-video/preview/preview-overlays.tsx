import type { VideoClipTransform, VideoTimelineClip } from "../../../lib/project-store";
import type { imageClipGeometry } from "../../../lib/video-image-layout";
import type { PreviewOverlayBox, PreviewOverlayItem } from "../types";

export function PreviewOverlays({
  previewOverlays,
  selected,
  selectedClips,
  beginTextGesture,
  moveTextGesture,
  finishTextGesture,
  beginImageGesture,
  moveImageGesture,
  finishImageGesture,
}: {
  previewOverlays: PreviewOverlayItem[];
  selected: string;
  selectedClips: string[];
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
}) {
  return (
    <>
      {previewOverlays.map((item, index) => {
        const isSelected = selected === item.clip.id || selectedClips.includes(item.clip.id);
        const style = {
          left: item.box.left,
          top: item.box.top,
          width: item.box.width,
          height: item.box.height,
          zIndex: 5 + index,
          transform: `translate(-50%, -50%) rotate(${item.transform.rotation}deg)`,
        };
        if (item.kind === "text") {
          return (
            <div
              key={item.clip.id}
              className={`studio-title-overlay ${isSelected ? "selected" : ""}`}
              role="group"
              aria-label={
                isSelected
                  ? "Selected title: drag to move, use corner to resize, top handle to rotate"
                  : `Select title ${item.asset.name}`
              }
              style={style}
              onPointerDown={(event) => beginTextGesture(event, item.clip, item.transform, item.box)}
              onPointerMove={moveTextGesture}
              onPointerUp={finishTextGesture}
              onPointerCancel={finishTextGesture}
            >
              <span className="studio-title-rotate" data-title-handle="rotate" title="Rotate text" />
              <span className="studio-title-width" data-title-handle="width" title="Adjust text wrap width" />
              <span className="studio-title-resize" data-title-handle="scale" title="Resize text" />
            </div>
          );
        }
        if (item.kind === "image") {
          return (
            <div
              key={item.clip.id}
              className={`studio-image-overlay ${isSelected ? "selected" : ""}`}
              role="group"
              aria-label={
                isSelected
                  ? "Selected image: drag to move, use corner to resize, top handle to rotate"
                  : `Select image ${item.asset.name}`
              }
              style={style}
              onPointerDown={(event) =>
                beginImageGesture(event, item.clip, item.transform, item.imageGeometry, item.box)
              }
              onPointerMove={moveImageGesture}
              onPointerUp={finishImageGesture}
              onPointerCancel={finishImageGesture}
            >
              <span className="studio-image-rotate" data-image-handle="rotate" title="Rotate image" />
              <span className="studio-image-resize" data-image-handle="resize" title="Resize image" />
            </div>
          );
        }
        return (
          <div
            key={item.clip.id}
            className={`studio-video-overlay ${isSelected ? "selected" : ""}`}
            role="group"
            aria-label={
              isSelected
                ? "Selected video: drag to move, use corner to resize, top handle to rotate"
                : `Select video ${item.asset.name}`
            }
            style={style}
            onPointerDown={(event) => beginTextGesture(event, item.clip, item.transform, item.box)}
            onPointerMove={moveTextGesture}
            onPointerUp={finishTextGesture}
            onPointerCancel={finishTextGesture}
          >
            <span className="studio-title-rotate" data-title-handle="rotate" title="Rotate video" />
            <span className="studio-title-resize" data-title-handle="scale" title="Resize video" />
          </div>
        );
      })}
    </>
  );
}
