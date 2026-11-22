import type { VideoClipTransitions, VideoTimelineClip } from "../../../lib/project-store";
import { clipLength } from "../utils";
import { EditorRange } from "../controls/editor-range";
import { ImageNumberInput } from "../controls/image-number-input";

export function ClipDurationTab({
  selectedClip,
  patchSelectedDuration,
  patchSelectedTransitions,
}: {
  selectedClip: VideoTimelineClip;
  editClip: (id: string, patch: Partial<VideoTimelineClip>) => void;
  patchSelectedDuration: (nextDuration: number) => void;
  patchSelectedTransitions: (patch: Partial<VideoClipTransitions>) => void;
}) {
  return (
    <>
      <EditorRange
        label="Duration"
        min={0.05}
        max={Math.max(60, Math.ceil(clipLength(selectedClip)))}
        step={0.05}
        value={clipLength(selectedClip)}
        unit="s"
        onChange={patchSelectedDuration}
      />
      <ImageNumberInput
        label="Duration"
        unit="seconds"
        value={clipLength(selectedClip)}
        min={0.05}
        max={3600}
        step="0.01"
        onCommit={patchSelectedDuration}
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
    </>
  );
}
