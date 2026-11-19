import type { VideoClipTransform, VideoClipTransitions, VideoTimelineAsset, VideoTimelineClip } from "../../../lib/project-store";
import { clipLength } from "../utils";
import { EditorRange } from "../controls/editor-range";
import { ImageNumberInput } from "../controls/image-number-input";

export function ClipGlobalTab({
  selectedClip,
  selectedAsset,
  anchorReason,
  multiAllVisual,
  selectedTransform,
  hasTransformEdits,
  patchSelectedStart,
  patchSelectedTransitions,
  patchSelectedTransform,
}: {
  selectedClip: VideoTimelineClip;
  selectedAsset?: VideoTimelineAsset;
  anchorReason: "playhead" | "first" | "none";
  multiAllVisual: boolean;
  selectedTransform: VideoClipTransform;
  hasTransformEdits: boolean;
  patchSelectedStart: (nextStart: number) => void;
  patchSelectedTransitions: (patch: Partial<VideoClipTransitions>) => void;
  patchSelectedTransform: (patch: Partial<VideoClipTransform>, options?: { relative?: boolean; reset?: boolean }) => void;
}) {
  const anchorLabel = anchorReason === "playhead" ? "under seekbar" : "1st selected";
  const maxFade = Math.max(0.1, clipLength(selectedClip));

  return (
    <>
      <div className="clip-control-group">
        <div className="clip-control-head">
          <strong>Global Settings</strong>
          <span className="timeline-meta">
            Focused: {selectedAsset?.name ?? "Clip"} ({anchorLabel})
          </span>
        </div>
        <p className="field-hint">
          Mixed asset types selected. Changes apply across all selected clips relative to the focused clip.
        </p>
      </div>

      <div className="clip-control-group">
        <div className="clip-control-head">
          <strong>Timeline &amp; Fades</strong>
        </div>
        <div className="filter-fields two-column">
          <ImageNumberInput
            label="Start time"
            unit="s"
            value={selectedClip.start}
            min={0}
            max={86400}
            step="0.05"
            onCommit={patchSelectedStart}
          />
        </div>
        <div className="clip-range-pair">
          <EditorRange
            label="Fade in"
            min={0}
            max={maxFade}
            step={0.05}
            value={selectedClip.transitions?.fadeIn ?? 0}
            unit=" s"
            onChange={(fadeIn) => patchSelectedTransitions({ fadeIn })}
          />
          <EditorRange
            label="Fade out"
            min={0}
            max={maxFade}
            step={0.05}
            value={selectedClip.transitions?.fadeOut ?? 0}
            unit=" s"
            onChange={(fadeOut) => patchSelectedTransitions({ fadeOut })}
          />
        </div>
      </div>

      {multiAllVisual && (
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
              step="1"
              onCommit={(x) => patchSelectedTransform({ x })}
            />
            <ImageNumberInput
              label="Position Y"
              unit="canvas px"
              value={selectedTransform.y}
              min={-32768}
              max={32768}
              step="1"
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
            onChange={(opacity) => patchSelectedTransform({ opacity: Math.max(0, Math.min(1, opacity / 100)) })}
          />
          <div className="clip-toggle-row">
            <button
              type="button"
              className={`editor-action ${selectedTransform.mirrorX ? "active" : ""}`}
              onClick={() => patchSelectedTransform({ mirrorX: !selectedTransform.mirrorX }, { relative: false })}
            >
              Mirror X
            </button>
            <button
              type="button"
              className={`editor-action ${selectedTransform.mirrorY ? "active" : ""}`}
              onClick={() => patchSelectedTransform({ mirrorY: !selectedTransform.mirrorY }, { relative: false })}
            >
              Mirror Y
            </button>
          </div>
        </div>
      )}
    </>
  );
}
