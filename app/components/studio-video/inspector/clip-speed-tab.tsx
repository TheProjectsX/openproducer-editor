import type { VideoTimelineAsset, VideoTimelineClip } from "../../../lib/project-store";
import { clipLength } from "../utils";
import { EditorRange } from "../controls/editor-range";
import { ImageNumberInput } from "../controls/image-number-input";

export function ClipSpeedTab({
  selectedClip,
  selectedAsset,
  isMultiSelect,
  multiHasAudio,
  timelineAssets,
  editClip,
  patchSelectedSpeed,
}: {
  selectedClip: VideoTimelineClip;
  selectedAsset?: VideoTimelineAsset;
  isMultiSelect: boolean;
  multiHasAudio: boolean;
  timelineAssets: VideoTimelineAsset[];
  editClip: (id: string, patch: Partial<VideoTimelineClip>) => void;
  patchSelectedSpeed: (nextSpeed: number) => void;
}) {
  const isVideoClip = selectedClip.track >= 0 && selectedAsset?.kind === "video";
  const sourceSpan = Math.max(0.01, selectedClip.sourceEnd - selectedClip.sourceStart);

  return (
    <>
      <EditorRange
        label="Speed"
        min={0.1}
        max={16}
        step={0.01}
        value={selectedClip.speed}
        unit="×"
        onChange={patchSelectedSpeed}
      />
      <div className="speed-presets" aria-label="Speed presets">
        {([0.25, 0.5, 1, 2, 4] as const).map((preset) => (
          <button
            type="button"
            key={preset}
            className={Math.abs(selectedClip.speed - preset) < 0.001 ? "active" : ""}
            onClick={() => editClip(selectedClip.id, { speed: preset })}
          >
            {preset}×
          </button>
        ))}
      </div>
      <label className="speed-field">
        Speed value <span>0.1–16×</span>
        <input
          type="number"
          min="0.1"
          max="16"
          step="0.001"
          value={Number(selectedClip.speed.toFixed(3))}
          onChange={(event) =>
            patchSelectedSpeed(Math.max(0.1, Math.min(16, Number(event.currentTarget.value) || 1)))
          }
        />
      </label>
      {!isMultiSelect && (
        <>
          <EditorRange
            label="Target duration"
            min={Math.max(0.01, sourceSpan / 16)}
            max={sourceSpan / 0.1}
            step={0.01}
            value={clipLength(selectedClip)}
            unit="s"
            onChange={(targetDuration) => {
              const nextSpeed = Math.max(0.1, Math.min(16, sourceSpan / Math.max(0.01, targetDuration)));
              editClip(selectedClip.id, { speed: nextSpeed });
            }}
          />
          <ImageNumberInput
            label="Target duration"
            unit="seconds"
            value={clipLength(selectedClip)}
            min={Math.max(0.01, sourceSpan / 16)}
            max={sourceSpan / 0.1}
            step="0.01"
            onCommit={(targetDuration) => {
              const nextSpeed = Math.max(0.1, Math.min(16, sourceSpan / Math.max(0.01, targetDuration)));
              editClip(selectedClip.id, { speed: nextSpeed });
            }}
          />
          <p className="resize-note">
            Clip duration: {clipLength(selectedClip).toFixed(2)} s (source {sourceSpan.toFixed(2)} s)
          </p>
          {selectedAsset?.kind === "audio" && selectedAsset.derivedFromAssetId && (
            <p className="resize-note" role="note">
              Detached from {timelineAssets.find((asset) => asset.id === selectedAsset.derivedFromAssetId)?.name ?? "a video source"}.
              This audio clip is independent; later video speed edits do not change it.
            </p>
          )}
        </>
      )}
      {(selectedClip.track < 0 || isVideoClip || multiHasAudio) && (
        <label className="ratio-field">
          Audio pitch mode
          <select
            value={selectedClip.pitchMode ?? "preserve"}
            onChange={(event) =>
              editClip(selectedClip.id, {
                pitchMode: event.currentTarget.value as "preserve" | "natural",
              })
            }
          >
            <option value="preserve">Preserve pitch (default)</option>
            <option value="natural">Natural pitch change</option>
          </select>
        </label>
      )}
    </>
  );
}
