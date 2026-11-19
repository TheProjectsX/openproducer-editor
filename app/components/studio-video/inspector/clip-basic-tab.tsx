import type { VideoClipTransform, VideoClipTransitions, VideoImageCrop, VideoTimelineAsset, VideoTimelineClip, VideoTransitionType } from "../../../lib/project-store";
import type { imageClipGeometry } from "../../../lib/video-image-layout";
import { clipLength } from "../utils";
import { EditorRange } from "../controls/editor-range";
import { ImageNumberInput } from "../controls/image-number-input";

export function ClipBasicTab({
  isMultiSelect,
  uniformMultiKind,
  multiAllVisual,
  multiHasAudio,
  selectedClip,
  selectedAsset,
  selectedTransform,
  hasTransformEdits,
  hasKeyframeAtPlayhead,
  selectedValues,
  selectedImageGeometry,
  imageCrop,
  transitionDuration,
  editClip,
  patchSelectedTransform,
  patchSelectedTransitions,
  patchSelectedVolume,
  toggleKeyframeAtPlayhead,
  alignSelectedVisual,
  freezeFrameClip,
  setSelectedImageSize,
  setSelectedImageCrop,
  resetSelectedImageCrop,
  createTransitionToNext,
  setTransitionDuration,
}: {
  isMultiSelect: boolean;
  uniformMultiKind: "video" | "image" | "text" | "audio" | null;
  multiAllVisual: boolean;
  multiHasAudio: boolean;
  selectedClip: VideoTimelineClip;
  selectedAsset?: VideoTimelineAsset;
  selectedTransform: VideoClipTransform;
  hasTransformEdits: boolean;
  hasKeyframeAtPlayhead: boolean;
  selectedValues: { transform: VideoClipTransform; volume: number } | null;
  selectedImageGeometry: ReturnType<typeof imageClipGeometry> | null;
  imageCrop: VideoImageCrop;
  transitionDuration: string;
  editClip: (id: string, patch: Partial<VideoTimelineClip>) => void;
  patchSelectedTransform: (patch: Partial<VideoClipTransform>, options?: { relative?: boolean; reset?: boolean }) => void;
  patchSelectedTransitions: (patch: Partial<VideoClipTransitions>) => void;
  patchSelectedVolume: (nextVolume: number) => void;
  toggleKeyframeAtPlayhead: () => void;
  alignSelectedVisual: (horizontal: "left" | "center" | "right", vertical: "top" | "middle" | "bottom") => void;
  freezeFrameClip: (id: string) => void;
  setSelectedImageSize: (axis: "width" | "height", value: number) => void;
  setSelectedImageCrop: (edge: keyof VideoImageCrop, percent: number) => void;
  resetSelectedImageCrop: () => void;
  createTransitionToNext: (kind: "dissolve" | "crossfade" | "fade-black" | VideoTransitionType) => void;
  setTransitionDuration: (duration: string) => void;
}) {
  const isVideoClip = uniformMultiKind === "video" || (!isMultiSelect && selectedClip.track >= 0 && selectedAsset?.kind === "video");
  const isImageClip = uniformMultiKind === "image" || (!isMultiSelect && selectedClip.track >= 0 && selectedAsset?.kind === "image");
  const isAudioClip = uniformMultiKind === "audio" || (!isMultiSelect && (selectedClip.track < 0 || selectedAsset?.kind === "audio"));
  const isTextClip = uniformMultiKind === "text" || (!isMultiSelect && selectedClip.track >= 0 && selectedAsset?.kind === "text");

  return (
    <>
      {isMultiSelect && multiAllVisual && (
        <div className="clip-control-group">
          <div className="clip-control-head">
            <strong>Transform</strong>
            {hasTransformEdits && (
              <button
                type="button"
                className="editor-action"
                onClick={() => patchSelectedTransform({}, { reset: true })}
              >
                Reset
              </button>
            )}
          </div>
          <div className="clip-range-pair">
            <EditorRange
              label="Scale"
              min={0.1}
              max={8}
              step={0.01}
              value={selectedTransform.scale}
              unit="×"
              onChange={(scale) => patchSelectedTransform({ scale })}
            />
            <EditorRange
              label="Rotate"
              min={-180}
              max={180}
              step={0.1}
              value={selectedTransform.rotation}
              unit="°"
              onChange={(rotation) => patchSelectedTransform({ rotation })}
            />
          </div>
          <div className="filter-fields two-column transform-fields">
            <ImageNumberInput
              label="Position X"
              unit="canvas px"
              value={selectedTransform.x}
              min={-32768}
              max={32768}
              onCommit={(x) => patchSelectedTransform({ x })}
            />
            <ImageNumberInput
              label="Position Y"
              unit="canvas px"
              value={selectedTransform.y}
              min={-32768}
              max={32768}
              onCommit={(y) => patchSelectedTransform({ y })}
            />
          </div>
          <EditorRange
            label="Opacity"
            min={0}
            max={100}
            step={1}
            value={Math.round(selectedTransform.opacity * 100)}
            unit="%"
            onChange={(opacity) =>
              patchSelectedTransform({ opacity: Math.max(0, Math.min(1, opacity / 100)) })
            }
          />
          <div className="clip-align-controls" aria-label="Align selection">
            <span>Align</span>
            {(["left", "center", "right"] as const).map((horizontal) => (
              <button
                type="button"
                key={horizontal}
                onClick={() => alignSelectedVisual(horizontal, "middle")}
                aria-label={`Align ${horizontal}`}
                title={`Align ${horizontal}`}
              >
                {horizontal === "left" ? "⇤" : horizontal === "right" ? "⇥" : "↔"}
              </button>
            ))}
            {(["top", "middle", "bottom"] as const).map((vertical) => (
              <button
                type="button"
                key={vertical}
                onClick={() => alignSelectedVisual("center", vertical)}
                aria-label={`Align ${vertical}`}
                title={`Align ${vertical}`}
              >
                {vertical === "top" ? "⇡" : vertical === "bottom" ? "⇣" : "↕"}
              </button>
            ))}
          </div>
          <div className="clip-align-controls">
            <span>Mirror</span>
            <button
              type="button"
              title="Flip horizontal"
              aria-label="Flip horizontal"
              aria-pressed={Boolean(selectedTransform.mirrorX)}
              onClick={() =>
                patchSelectedTransform({ mirrorX: !selectedTransform.mirrorX }, { relative: false })
              }
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 2v12M5.5 4.5 2 8l3.5 3.5zm5 0L14 8l-3.5 3.5z" />
              </svg>
            </button>
            <button
              type="button"
              title="Flip vertical"
              aria-label="Flip vertical"
              aria-pressed={Boolean(selectedTransform.mirrorY)}
              onClick={() =>
                patchSelectedTransform({ mirrorY: !selectedTransform.mirrorY }, { relative: false })
              }
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 8h12M4.5 5.5 8 2l3.5 3.5zm0 5L8 14l3.5-3.5z" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {isMultiSelect && multiHasAudio && (
        <div className="clip-control-group">
          <div className="clip-control-head">
            <strong>Volume &amp; Fade</strong>
            {Math.abs((selectedValues?.volume ?? selectedClip.volume) - 1) > 0.001 && (
              <button type="button" className="editor-action" onClick={() => editClip(selectedClip.id, { volume: 1 })}>
                Reset
              </button>
            )}
          </div>
          <EditorRange
            label="Audio volume"
            min={0}
            max={4}
            step={0.01}
            value={selectedValues?.volume ?? selectedClip.volume}
            unit="×"
            onChange={patchSelectedVolume}
          />
          <EditorRange
            label="Fade in"
            min={0}
            max={clipLength(selectedClip)}
            step={0.01}
            value={selectedClip.transitions?.fadeIn ?? 0}
            unit="s"
            onChange={(fadeIn) => patchSelectedTransitions({ fadeIn })}
          />
          <EditorRange
            label="Fade out"
            min={0}
            max={clipLength(selectedClip)}
            step={0.01}
            value={selectedClip.transitions?.fadeOut ?? 0}
            unit="s"
            onChange={(fadeOut) => patchSelectedTransitions({ fadeOut })}
          />
          <label className="ratio-toggle">
            <input
              type="checkbox"
              checked={selectedClip.muted}
              onChange={(event) => editClip(selectedClip.id, { muted: event.currentTarget.checked })}
            />
            Silence audio
          </label>
        </div>
      )}
      {isVideoClip && (
        <>
          <div className="clip-control-group">
            <div className="clip-control-head">
              <strong>Transform</strong>
              <div className="studio-details-color-row">
                {hasTransformEdits && (
                  <button
                    type="button"
                    className="editor-action"
                    onClick={() => patchSelectedTransform({}, { reset: true })}
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  className={`keyframe-diamond-btn${hasKeyframeAtPlayhead ? " active" : ""}`}
                  aria-pressed={hasKeyframeAtPlayhead}
                  title={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"}
                  aria-label={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"}
                  onClick={toggleKeyframeAtPlayhead}
                >
                  {hasKeyframeAtPlayhead ? "◆" : "◇"}
                </button>
              </div>
            </div>
            <div className="clip-range-pair">
              <EditorRange
                label="Scale"
                min={0.1}
                max={8}
                step={0.01}
                value={selectedTransform.scale}
                unit="×"
                onChange={(scale) => patchSelectedTransform({ scale })}
              />
              <EditorRange
                label="Rotate"
                min={-180}
                max={180}
                step={0.1}
                value={selectedTransform.rotation}
                unit="°"
                onChange={(rotation) => patchSelectedTransform({ rotation })}
              />
            </div>
            <div className="filter-fields two-column transform-fields">
              <ImageNumberInput
                label="Position X"
                unit="canvas px"
                value={selectedTransform.x}
                min={-32768}
                max={32768}
                onCommit={(x) => patchSelectedTransform({ x })}
              />
              <ImageNumberInput
                label="Position Y"
                unit="canvas px"
                value={selectedTransform.y}
                min={-32768}
                max={32768}
                onCommit={(y) => patchSelectedTransform({ y })}
              />
            </div>
            <EditorRange
              label="Opacity"
              min={0}
              max={100}
              step={1}
              value={Math.round(selectedTransform.opacity * 100)}
              unit="%"
              onChange={(opacity) =>
                patchSelectedTransform({ opacity: Math.max(0, Math.min(1, opacity / 100)) })
              }
            />
            <div className="clip-align-controls" aria-label="Align video overlay">
              <span>Align</span>
              {(["left", "center", "right"] as const).map((horizontal) => (
                <button
                  type="button"
                  key={horizontal}
                  onClick={() => alignSelectedVisual(horizontal, "middle")}
                  aria-label={`Align ${horizontal}`}
                  title={`Align ${horizontal}`}
                >
                  {horizontal === "left" ? "⇤" : horizontal === "right" ? "⇥" : "↔"}
                </button>
              ))}
              {(["top", "middle", "bottom"] as const).map((vertical) => (
                <button
                  type="button"
                  key={vertical}
                  onClick={() => alignSelectedVisual("center", vertical)}
                  aria-label={`Align ${vertical}`}
                  title={`Align ${vertical}`}
                >
                  {vertical === "top" ? "⇡" : vertical === "bottom" ? "⇣" : "↕"}
                </button>
              ))}
            </div>
            <div className="clip-align-controls">
              <span>Mirror</span>
              <button
                type="button"
                title="Flip horizontal"
                aria-label="Flip horizontal"
                aria-pressed={Boolean(selectedTransform.mirrorX)}
                onClick={() =>
                  editClip(selectedClip.id, {
                    transform: { ...selectedTransform, mirrorX: !selectedTransform.mirrorX },
                  })
                }
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M8 2v12M5.5 4.5 2 8l3.5 3.5zm5 0L14 8l-3.5 3.5z" />
                </svg>
              </button>
              <button
                type="button"
                title="Flip vertical"
                aria-label="Flip vertical"
                aria-pressed={Boolean(selectedTransform.mirrorY)}
                onClick={() =>
                  editClip(selectedClip.id, {
                    transform: { ...selectedTransform, mirrorY: !selectedTransform.mirrorY },
                  })
                }
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M2 8h12M4.5 5.5 8 2l3.5 3.5zm0 5L8 14l3.5-3.5z" />
                </svg>
              </button>
            </div>
          </div>
          <button type="button" className="editor-action" onClick={() => void freezeFrameClip(selectedClip.id)}>
            Freeze frame at playhead
          </button>
        </>
      )}
      {isImageClip && selectedImageGeometry && (
        <div className="clip-control-group studio-image-controls">
          <div className="clip-control-head">
            <strong>Transform &amp; Size</strong>
            <div className="studio-details-color-row">
              {(hasTransformEdits || selectedClip.imageSize) && (
                <button
                  type="button"
                  className="editor-action"
                  onClick={() => {
                  patchSelectedTransform({}, { reset: true });
                  editClip(selectedClip.id, { imageSize: undefined });
                }}
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                className={`keyframe-diamond-btn${hasKeyframeAtPlayhead ? " active" : ""}`}
                aria-pressed={hasKeyframeAtPlayhead}
                title={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"}
                aria-label={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"}
                onClick={toggleKeyframeAtPlayhead}
              >
                {hasKeyframeAtPlayhead ? "◆" : "◇"}
              </button>
            </div>
          </div>
          <EditorRange
            label="Scale"
            min={0.1}
            max={8}
            step={0.01}
            value={selectedTransform.scale}
            unit="×"
            onChange={(scale) => patchSelectedTransform({ scale })}
          />
          <div className="filter-fields two-column transform-fields">
            <ImageNumberInput
              label="Width"
              unit="canvas px"
              value={selectedImageGeometry.width}
              min={1}
              max={32768}
              step="1"
              onCommit={(value) => setSelectedImageSize("width", value)}
            />
            <ImageNumberInput
              label="Height"
              unit="canvas px"
              value={selectedImageGeometry.height}
              min={1}
              max={32768}
              step="1"
              onCommit={(value) => setSelectedImageSize("height", value)}
            />
          </div>
          <label className="ratio-toggle">
            <input
              type="checkbox"
              checked={selectedClip.imageMatchAspect !== false}
              onChange={(event) => {
                const match = event.currentTarget.checked;
                const scale = Math.max(0.001, selectedTransform.scale);
                editClip(selectedClip.id, {
                  imageMatchAspect: match,
                  ...(match
                    ? {
                        imageSize: {
                          width: selectedImageGeometry.width / scale,
                          height:
                            selectedImageGeometry.width /
                            (selectedImageGeometry.source.width / selectedImageGeometry.source.height) /
                            scale,
                        },
                      }
                    : {}),
                });
              }}
            />
            Maintain aspect ratio when resizing
          </label>
          <div className="filter-fields two-column transform-fields">
            <ImageNumberInput
              label="Position X"
              unit="canvas px"
              value={selectedTransform.x}
              min={-32768}
              max={32768}
              onCommit={(x) => patchSelectedTransform({ x })}
            />
            <ImageNumberInput
              label="Position Y"
              unit="canvas px"
              value={selectedTransform.y}
              min={-32768}
              max={32768}
              onCommit={(y) => patchSelectedTransform({ y })}
            />
          </div>
          <div className="clip-range-pair">
            <EditorRange
              label="Rotate"
              min={-180}
              max={180}
              step={0.1}
              value={selectedTransform.rotation}
              unit="°"
              onChange={(rotation) => patchSelectedTransform({ rotation })}
            />
            <EditorRange
              label="Opacity"
              min={0}
              max={100}
              step={1}
              value={Math.round(selectedTransform.opacity * 100)}
              unit="%"
              onChange={(opacity) =>
                patchSelectedTransform({ opacity: Math.max(0, Math.min(1, opacity / 100)) })
              }
            />
          </div>
          <div className="clip-align-controls" aria-label="Align image">
            <span>Align</span>
            {(["left", "center", "right"] as const).map((horizontal) => (
              <button
                type="button"
                key={horizontal}
                onClick={() => alignSelectedVisual(horizontal, "middle")}
                aria-label={`Align ${horizontal}`}
                title={`Align ${horizontal}`}
              >
                {horizontal === "left" ? "⇤" : horizontal === "right" ? "⇥" : "↔"}
              </button>
            ))}
            {(["top", "middle", "bottom"] as const).map((vertical) => (
              <button
                type="button"
                key={vertical}
                onClick={() => alignSelectedVisual("center", vertical)}
                aria-label={`Align ${vertical}`}
                title={`Align ${vertical}`}
              >
                {vertical === "top" ? "⇡" : vertical === "bottom" ? "⇣" : "↕"}
              </button>
            ))}
          </div>
          <div className="clip-align-controls">
            <span>Mirror</span>
            <button
              type="button"
              title="Flip horizontal"
              aria-label="Flip horizontal"
              aria-pressed={Boolean(selectedTransform.mirrorX)}
              onClick={() =>
                patchSelectedTransform({ mirrorX: !selectedTransform.mirrorX }, { relative: false })
              }
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 2v12M5.5 4.5 2 8l3.5 3.5zm5 0L14 8l-3.5 3.5z" />
              </svg>
            </button>
            <button
              type="button"
              title="Flip vertical"
              aria-label="Flip vertical"
              aria-pressed={Boolean(selectedTransform.mirrorY)}
              onClick={() =>
                patchSelectedTransform({ mirrorY: !selectedTransform.mirrorY }, { relative: false })
              }
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 8h12M4.5 5.5 8 2l3.5 3.5zm0 5L8 14l3.5-3.5z" />
              </svg>
            </button>
          </div>
          {selectedClip.imageSize && (
            <button
              type="button"
              className="editor-action"
              onClick={() => editClip(selectedClip.id, { imageSize: undefined })}
            >
              Reset size to fit
            </button>
          )}
          <strong>Crop source</strong>
          <p className="resize-note">
            Crop percentages remove edges from this clip only. Drag the image in the preview to move it; drag its corner
            to resize.
          </p>
          <div className="filter-fields two-column transform-fields">
            {(["left", "top", "right", "bottom"] as const).map((edge) => (
              <ImageNumberInput
                key={`${selectedClip.id}-crop-${edge}`}
                label={`Crop ${edge}`}
                unit="percent"
                value={imageCrop[edge] * 100}
                min={0}
                max={99.9}
                onCommit={(value) => setSelectedImageCrop(edge, value)}
              />
            ))}
          </div>
          <button type="button" className="editor-action" onClick={resetSelectedImageCrop}>
            Reset crop
          </button>
        </div>
      )}
      {selectedClip.track < 0 && selectedAsset?.kind === "audio" && (
        <div className="clip-control-group">
          <div className="clip-control-head">
            <strong>Volume &amp; Fade</strong>
            <div className="studio-details-color-row">
              {Math.abs((selectedValues?.volume ?? selectedClip.volume) - 1) > 0.001 && (
                <button type="button" className="editor-action" onClick={() => editClip(selectedClip.id, { volume: 1 })}>
                  Reset
                </button>
              )}
              <button
                type="button"
                className={`keyframe-diamond-btn${hasKeyframeAtPlayhead ? " active" : ""}`}
                aria-pressed={hasKeyframeAtPlayhead}
                title={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"}
                aria-label={
                  hasKeyframeAtPlayhead ? "Remove volume keyframe at playhead" : "Add volume keyframe at playhead"
                }
                onClick={toggleKeyframeAtPlayhead}
              >
                {hasKeyframeAtPlayhead ? "◆" : "◇"}
              </button>
            </div>
          </div>
          <EditorRange
            label="Audio volume"
            min={0}
            max={4}
            step={0.01}
            value={selectedValues?.volume ?? selectedClip.volume}
            unit="×"
            onChange={patchSelectedVolume}
          />
          <EditorRange
            label="Fade in"
            min={0}
            max={clipLength(selectedClip)}
            step={0.01}
            value={selectedClip.transitions?.fadeIn ?? 0}
            unit="s"
            onChange={(fadeIn) => patchSelectedTransitions({ fadeIn })}
          />
          <EditorRange
            label="Fade out"
            min={0}
            max={clipLength(selectedClip)}
            step={0.01}
            value={selectedClip.transitions?.fadeOut ?? 0}
            unit="s"
            onChange={(fadeOut) => patchSelectedTransitions({ fadeOut })}
          />
          <label className="ratio-toggle">
            <input
              type="checkbox"
              checked={selectedClip.muted}
              onChange={(event) => editClip(selectedClip.id, { muted: event.currentTarget.checked })}
            />
            Silence audio
          </label>
        </div>
      )}
      {selectedClip.track >= 0 && (!isMultiSelect || multiAllVisual) && (
        <label className="ratio-field">
          Blend mode
          <select
            value={selectedClip.blendMode ?? "source-over"}
            onChange={(event) =>
              editClip(selectedClip.id, {
                blendMode: event.currentTarget.value as NonNullable<VideoTimelineClip["blendMode"]>,
              })
            }
          >
            <option value="source-over">Normal</option>
            <option value="screen">Screen</option>
            <option value="multiply">Multiply</option>
            <option value="overlay">Overlay</option>
            <option value="lighten">Lighten</option>
            <option value="darken">Darken</option>
          </select>
        </label>
      )}
      {!isMultiSelect && (
        <div className="clip-placement-pair">
          <label className="speed-field">
            Track
            <input
              type="number"
              step="1"
              value={selectedClip.track}
              onChange={(event) => {
                const value = Number(event.currentTarget.value);
                if (Number.isInteger(value)) {
                  editClip(selectedClip.id, {
                    track: selectedClip.track < 0 ? Math.min(-1, value) : Math.max(0, value),
                  });
                }
              }}
            />
          </label>
          <label className="speed-field">
            Timeline start <span>seconds</span>
            <input
              type="number"
              min="0"
              step="0.001"
              value={Number(selectedClip.start.toFixed(3))}
              onChange={(event) =>
                editClip(selectedClip.id, { start: Math.max(0, Number(event.currentTarget.value) || 0) })
              }
            />
          </label>
          <label className="speed-field">
            Source in <span>seconds</span>
            <input
              type="number"
              min="0"
              max={selectedAsset?.duration}
              step="0.001"
              value={Number(selectedClip.sourceStart.toFixed(3))}
              onChange={(event) =>
                editClip(selectedClip.id, {
                  sourceStart: Math.max(
                    0,
                    Math.min(selectedClip.sourceEnd - 0.01, Number(event.currentTarget.value) || 0)
                  ),
                })
              }
            />
          </label>
          <label className="speed-field">
            Source out <span>seconds</span>
            <input
              type="number"
              min="0.01"
              max={selectedAsset?.duration}
              step="0.001"
              value={Number(selectedClip.sourceEnd.toFixed(3))}
              onChange={(event) =>
                editClip(selectedClip.id, {
                  sourceEnd: Math.min(
                    selectedAsset?.duration ?? selectedClip.sourceEnd,
                    Math.max(selectedClip.sourceStart + 0.01, Number(event.currentTarget.value) || 0)
                  ),
                })
              }
            />
          </label>
        </div>
      )}
      {isTextClip && (
        <div className="clip-control-group">
          <div className="clip-control-head">
            <strong>Transform</strong>
            <div className="studio-details-color-row">
              {hasTransformEdits && (
                <button
                  type="button"
                  className="editor-action"
                  onClick={() => patchSelectedTransform({}, { reset: true })}
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                className={`keyframe-diamond-btn${hasKeyframeAtPlayhead ? " active" : ""}`}
                aria-pressed={hasKeyframeAtPlayhead}
                title={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"}
                aria-label={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"}
                onClick={toggleKeyframeAtPlayhead}
              >
                {hasKeyframeAtPlayhead ? "◆" : "◇"}
              </button>
            </div>
          </div>
          <div className="clip-range-pair">
            <EditorRange
              label="Scale"
              min={0.1}
              max={8}
              step={0.01}
              value={selectedTransform.scale}
              unit="×"
              onChange={(scale) => patchSelectedTransform({ scale })}
            />
            <EditorRange
              label="Rotate"
              min={-180}
              max={180}
              step={0.1}
              value={selectedTransform.rotation}
              unit="°"
              onChange={(rotation) => patchSelectedTransform({ rotation })}
            />
          </div>
          <div className="filter-fields two-column transform-fields">
            <ImageNumberInput
              label="Position X"
              unit="canvas px"
              value={selectedTransform.x}
              min={-32768}
              max={32768}
              onCommit={(x) => patchSelectedTransform({ x })}
            />
            <ImageNumberInput
              label="Position Y"
              unit="canvas px"
              value={selectedTransform.y}
              min={-32768}
              max={32768}
              onCommit={(y) => patchSelectedTransform({ y })}
            />
          </div>
          <EditorRange
            label="Opacity"
            min={0}
            max={100}
            step={1}
            value={Math.round(selectedTransform.opacity * 100)}
            unit="%"
            onChange={(opacity) =>
              patchSelectedTransform({ opacity: Math.max(0, Math.min(1, opacity / 100)) })
            }
          />
          <div className="clip-align-controls" aria-label="Align text">
            <span>Align</span>
            {(["left", "center", "right"] as const).map((horizontal) => (
              <button
                type="button"
                key={horizontal}
                onClick={() => alignSelectedVisual(horizontal, "middle")}
                aria-label={`Align ${horizontal}`}
                title={`Align ${horizontal}`}
              >
                {horizontal === "left" ? "⇤" : horizontal === "right" ? "⇥" : "↔"}
              </button>
            ))}
            {(["top", "middle", "bottom"] as const).map((vertical) => (
              <button
                type="button"
                key={vertical}
                onClick={() => alignSelectedVisual("center", vertical)}
                aria-label={`Align ${vertical}`}
                title={`Align ${vertical}`}
              >
                {vertical === "top" ? "⇡" : vertical === "bottom" ? "⇣" : "↕"}
              </button>
            ))}
          </div>
        </div>
      )}
      {!isMultiSelect && selectedClip.track >= 0 && selectedAsset && ["video", "image", "text"].includes(selectedAsset.kind) && (
        <div className="transition-controls">
          <label>
            Transition duration <span>custom seconds</span>
            <input
              type="number"
              min="0.01"
              max={clipLength(selectedClip)}
              step="any"
              value={transitionDuration}
              onChange={(event) => setTransitionDuration(event.currentTarget.value)}
            />
          </label>
          <button className="secondary-button editor-action" onClick={() => createTransitionToNext("dissolve")}>
            Dissolve into next clip
          </button>
        </div>
      )}
      {!isMultiSelect && selectedClip.track < 0 && (
        <div className="transition-controls">
          <label>
            Crossfade duration <span>custom seconds</span>
            <input
              type="number"
              min="0.01"
              max={clipLength(selectedClip)}
              step="any"
              value={transitionDuration}
              onChange={(event) => setTransitionDuration(event.currentTarget.value)}
            />
          </label>
          <button className="secondary-button editor-action" onClick={() => createTransitionToNext("crossfade")}>
            Crossfade into next clip
          </button>
        </div>
      )}
      {!isMultiSelect && selectedAsset?.kind !== "video" && !isAudioClip && !isImageClip && !isTextClip && (
        <label className="ratio-toggle">
          <input
            type="checkbox"
            checked={selectedClip.muted}
            onChange={(event) => editClip(selectedClip.id, { muted: event.currentTarget.checked })}
          />
          Mute clip
        </label>
      )}
    </>
  );
}
