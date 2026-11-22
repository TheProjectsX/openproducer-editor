import type { VideoTimelineClip, VideoTransitionType } from "../../../lib/project-store";

export function TransitionsTab({
  selectedClip,
  transitionDuration,
  setTransitionDuration,
  createTransitionToNext,
}: {
  selectedClip?: VideoTimelineClip;
  transitionDuration: string;
  setTransitionDuration: (duration: string) => void;
  createTransitionToNext: (kind: "dissolve" | "crossfade" | "fade-black" | VideoTransitionType) => void;
}) {
  return (
    <>
      <div className="studio-bin-heading">
        <strong>Transitions</strong>
      </div>
      <p className="studio-bin-hint">Select a clip on the timeline, then apply a transition to the next clip on the same track.</p>
      <label className="speed-field">
        Duration <span>seconds</span>
        <input
          type="number"
          min="0.01"
          max="10"
          step="0.05"
          value={transitionDuration}
          onChange={(event) => setTransitionDuration(event.currentTarget.value)}
        />
      </label>
      <div className="studio-bin-grid">
        {(
          [
            ["dissolve", "Dissolve", "Blend adjacent visuals"],
            ["fade-black", "Fade black", "Fade out then fade in"],
            ["wipe-left", "Wipe left", "Reveal next clip from left"],
            ["wipe-right", "Wipe right", "Reveal next clip from right"],
            ["wipe-up", "Wipe up", "Reveal next clip from top"],
            ["wipe-down", "Wipe down", "Reveal next clip from bottom"],
            ["slide-left", "Slide left", "Slide next clip in from right"],
            ["slide-right", "Slide right", "Slide next clip in from left"],
            ["zoom-in", "Zoom in", "Scale next clip up"],
          ] as const
        ).map(([kind, label, desc]) => (
          <button
            type="button"
            key={kind}
            className="bin-item studio-preset-tile"
            disabled={!selectedClip || selectedClip.track < 0}
            onClick={() => createTransitionToNext(kind)}
            title={desc}
          >
            <span className={`studio-asset-thumb studio-transition-preview-box tr-${kind}`} aria-hidden="true">
              <i className="tr-a" />
              <i className="tr-b" />
            </span>
            <strong title={label}>{label}</strong>
          </button>
        ))}
        <button
          type="button"
          className="bin-item studio-preset-tile"
          disabled={!selectedClip || selectedClip.track >= 0}
          onClick={() => createTransitionToNext("crossfade")}
          title="Blend adjacent audio"
        >
          <span className="studio-asset-thumb studio-transition-preview-box tr-crossfade" aria-hidden="true">
            <i className="tr-a" />
            <i className="tr-b" />
          </span>
          <strong title="Crossfade">Crossfade</strong>
        </button>
      </div>
    </>
  );
}
