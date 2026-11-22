import type { VideoTimelineAsset, VideoTimelineClip } from "../../../lib/project-store";
import { clipLength } from "../utils";
import { EditorRange } from "../controls/editor-range";

export function ClipAudioTab({
  selectedClip,
  selectedValues,
  hasKeyframeAtPlayhead,
  extractingAudio,
  extractProgress,
  availableAudioAssets,
  selectedReplacementAudioAssetId,
  replacementAudioOffset,
  editClip,
  patchSelectedVolume,
  toggleKeyframeAtPlayhead,
  detachVideoAudio,
  setReplacementAudioAssetId,
  setReplacementAudioOffset,
  replaceVideoAudio,
}: {
  selectedClip: VideoTimelineClip;
  selectedValues: { volume: number } | null;
  hasKeyframeAtPlayhead: boolean;
  extractingAudio: boolean;
  extractProgress: number;
  availableAudioAssets: VideoTimelineAsset[];
  selectedReplacementAudioAssetId: string;
  replacementAudioOffset: string;
  editClip: (id: string, patch: Partial<VideoTimelineClip>) => void;
  patchSelectedVolume: (nextVolume: number) => void;
  toggleKeyframeAtPlayhead: () => void;
  detachVideoAudio: () => void;
  setReplacementAudioAssetId: (id: string) => void;
  setReplacementAudioOffset: (offset: string) => void;
  replaceVideoAudio: () => void;
}) {
  return (
    <>
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
              aria-label={hasKeyframeAtPlayhead ? "Remove volume keyframe at playhead" : "Add volume keyframe at playhead"}
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
          onChange={(fadeIn) =>
            editClip(selectedClip.id, {
              transitions: {
                ...selectedClip.transitions,
                fadeIn: Math.max(0, Math.min(clipLength(selectedClip), fadeIn)),
                fadeOut: selectedClip.transitions?.fadeOut ?? 0,
              },
            })
          }
        />
        <EditorRange
          label="Fade out"
          min={0}
          max={clipLength(selectedClip)}
          step={0.01}
          value={selectedClip.transitions?.fadeOut ?? 0}
          unit="s"
          onChange={(fadeOut) =>
            editClip(selectedClip.id, {
              transitions: {
                ...selectedClip.transitions,
                fadeIn: selectedClip.transitions?.fadeIn ?? 0,
                fadeOut: Math.max(0, Math.min(clipLength(selectedClip), fadeOut)),
              },
            })
          }
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
      <div className="clip-control-group">
        <div className="clip-control-head">
          <strong>Source &amp; Replacement Audio</strong>
        </div>
        <button className="editor-action" disabled={extractingAudio} onClick={detachVideoAudio}>
          {extractingAudio ? `Extracting ${extractProgress}%` : "Detach source audio to Audio 1"}
        </button>
        <label className="ratio-field">
          Replacement audio
          <select
            value={selectedReplacementAudioAssetId}
            onChange={(event) => setReplacementAudioAssetId(event.currentTarget.value)}
          >
            <option value="">Select imported audio</option>
            {availableAudioAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </label>
        <label className="speed-field">
          Audio offset <span>custom seconds</span>
          <input
            type="number"
            min="0"
            max={Math.max(0, clipLength(selectedClip) - 0.01)}
            step="0.001"
            value={Number((Number(replacementAudioOffset) || 0).toFixed(3))}
            onChange={(event) => setReplacementAudioOffset(event.currentTarget.value)}
          />
        </label>
        <button
          className="secondary-button editor-action"
          disabled={!availableAudioAssets.length}
          onClick={replaceVideoAudio}
        >
          Replace clip audio
        </button>
      </div>
    </>
  );
}
