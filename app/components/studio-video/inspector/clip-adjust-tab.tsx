import type { VideoClipTransform, VideoTimelineAsset, VideoTimelineClip } from "../../../lib/project-store";
import { clipLength } from "../utils";

export function ClipAdjustTab({
  selectedClip,
  selectedAsset,
  selectedTransform,
  isMultiSelect,
  multiHasColor,
  playhead,
  editClip,
  patchSelectedTransform,
  patchSelectedEffects,
  addOrUpdateKeyframe,
  removeKeyframeAtPlayhead,
}: {
  selectedClip: VideoTimelineClip;
  selectedAsset?: VideoTimelineAsset;
  selectedTransform: VideoClipTransform;
  isMultiSelect: boolean;
  multiHasColor: boolean;
  playhead: number;
  editClip: (id: string, patch: Partial<VideoTimelineClip>) => void;
  patchSelectedTransform: (patch: Partial<VideoClipTransform>, options?: { relative?: boolean; reset?: boolean }) => void;
  patchSelectedEffects: (patch: Partial<NonNullable<VideoTimelineClip["effects"]>>, options?: { relative?: boolean; reset?: boolean }) => void;
  addOrUpdateKeyframe: () => void;
  removeKeyframeAtPlayhead: () => void;
}) {
  const isVideoClip = !isMultiSelect && selectedClip.track >= 0 && selectedAsset?.kind === "video";
  const isImageClip = !isMultiSelect && selectedClip.track >= 0 && selectedAsset?.kind === "image";

  return (
    <>
      {!isMultiSelect && (
        <>
          <button className="secondary-button editor-action" onClick={addOrUpdateKeyframe}>
            Add/update keyframe at playhead
          </button>
          {selectedClip.keyframes?.some(
            (frame) => Math.abs(frame.time - Math.max(0, Math.min(clipLength(selectedClip), playhead - selectedClip.start))) < 0.05
          ) && (
            <button className="editor-action" onClick={removeKeyframeAtPlayhead}>
              Remove keyframe at playhead
            </button>
          )}
          <p className="resize-note">
            {selectedClip.keyframes?.length ?? 0} keyframe(s). Values interpolate linearly between keys in clip-relative
            seconds.
          </p>
        </>
      )}

      {((selectedClip.track >= 0 && selectedAsset?.kind !== "text") || multiHasColor) && (
        <>
          <div className="filter-fields two-column transform-fields">
            <label>
              Brightness <span>percent</span>
              <input
                type="number"
                min="0"
                max="300"
                step="any"
                value={selectedClip.effects?.brightness ?? 100}
                onChange={(event) =>
                  patchSelectedEffects({
                    brightness: Math.max(0, Math.min(300, Number(event.currentTarget.value) || 0)),
                  })
                }
              />
            </label>
            <label>
              Contrast <span>percent</span>
              <input
                type="number"
                min="0"
                max="300"
                step="any"
                value={selectedClip.effects?.contrast ?? 100}
                onChange={(event) =>
                  patchSelectedEffects({
                    contrast: Math.max(0, Math.min(300, Number(event.currentTarget.value) || 0)),
                  })
                }
              />
            </label>
            <label>
              Saturation <span>percent</span>
              <input
                type="number"
                min="0"
                max="300"
                step="any"
                value={selectedClip.effects?.saturation ?? 100}
                onChange={(event) =>
                  patchSelectedEffects({
                    saturation: Math.max(0, Math.min(300, Number(event.currentTarget.value) || 0)),
                  })
                }
              />
            </label>
            <label>
              Grayscale <span>percent</span>
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                value={selectedClip.effects?.grayscale ?? 0}
                onChange={(event) =>
                  patchSelectedEffects({
                    grayscale: Math.max(0, Math.min(100, Number(event.currentTarget.value) || 0)),
                  })
                }
              />
            </label>
            <label>
              Hue <span>degrees</span>
              <input
                type="number"
                min="-180"
                max="180"
                step="1"
                value={selectedClip.effects?.hue ?? 0}
                onChange={(event) =>
                  patchSelectedEffects({
                    hue: Math.max(-180, Math.min(180, Number(event.currentTarget.value) || 0)),
                  })
                }
              />
            </label>
            <label>
              Sepia <span>percent</span>
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                value={selectedClip.effects?.sepia ?? 0}
                onChange={(event) =>
                  patchSelectedEffects({
                    sepia: Math.max(0, Math.min(100, Number(event.currentTarget.value) || 0)),
                  })
                }
              />
            </label>
            <label>
              Blur <span>px</span>
              <input
                type="number"
                min="0"
                max="40"
                step="0.5"
                value={selectedClip.effects?.blur ?? 0}
                onChange={(event) =>
                  patchSelectedEffects({
                    blur: Math.max(0, Math.min(40, Number(event.currentTarget.value) || 0)),
                  })
                }
              />
            </label>
          </div>
          <button
            type="button"
            className="editor-action"
            onClick={() => patchSelectedEffects({}, { reset: true })}
          >
            Reset adjustments
          </button>
        </>
      )}

      {selectedClip.track >= 0 && !isVideoClip && !isImageClip && !isMultiSelect && (
        <div className="filter-fields two-column transform-fields">
          <label>
            Position X <span>custom px</span>
            <input
              type="number"
              step="0.001"
              value={Number(selectedTransform.x.toFixed(3))}
              onChange={(event) =>
                editClip(selectedClip.id, {
                  transform: { ...selectedTransform, x: Number(event.currentTarget.value) || 0 },
                })
              }
            />
          </label>
          <label>
            Position Y <span>custom px</span>
            <input
              type="number"
              step="0.001"
              value={Number(selectedTransform.y.toFixed(3))}
              onChange={(event) =>
                editClip(selectedClip.id, {
                  transform: { ...selectedTransform, y: Number(event.currentTarget.value) || 0 },
                })
              }
            />
          </label>
          <label>
            Opacity <span>custom percent</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.001"
              value={Number((selectedTransform.opacity * 100).toFixed(3))}
              onChange={(event) =>
                editClip(selectedClip.id, {
                  transform: {
                    ...selectedTransform,
                    opacity: Math.max(0, Math.min(1, (Number(event.currentTarget.value) || 0) / 100)),
                  },
                })
              }
            />
          </label>
        </div>
      )}
    </>
  );
}
