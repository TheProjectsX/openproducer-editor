import { createPortal } from "react-dom";
import type { VideoTimelineAsset, VideoTimelineClip } from "../../../lib/project-store";

export function ClipContextMenu({
  menu,
  targetClip,
  targetAsset,
  hasCopiedClip,
  extractingAudio,
  onClose,
  onSelectClip,
  onSplit,
  onCopy,
  onPaste,
  onDuplicate,
  onFreezeFrame,
  onDetachAudio,
  onDelete,
}: {
  menu: { clipId: string; x: number; y: number };
  targetClip: VideoTimelineClip;
  targetAsset?: VideoTimelineAsset;
  hasCopiedClip: boolean;
  extractingAudio: boolean;
  onClose: () => void;
  onSelectClip: (id: string) => void;
  onSplit: () => void;
  onCopy: (id: string) => void;
  onPaste: () => void;
  onDuplicate: (id: string) => void;
  onFreezeFrame: (id: string) => void;
  onDetachAudio: () => void;
  onDelete: (id: string) => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="studio-clip-context-menu"
      role="menu"
      aria-label="Clip actions"
      style={{ left: menu.x, top: menu.y }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onSelectClip(targetClip.id);
          onSplit();
          onClose();
        }}
      >
        Split at playhead
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onCopy(targetClip.id);
          onClose();
        }}
      >
        Copy clip
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!hasCopiedClip}
        onClick={() => {
          onPaste();
          onClose();
        }}
      >
        Paste at playhead
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onDuplicate(targetClip.id);
          onClose();
        }}
      >
        Duplicate
      </button>
      {targetAsset?.kind === "video" && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onFreezeFrame(targetClip.id);
            onClose();
          }}
        >
          Freeze frame
        </button>
      )}
      {targetAsset?.kind === "video" && (
        <button
          type="button"
          role="menuitem"
          disabled={extractingAudio}
          onClick={() => {
            onSelectClip(targetClip.id);
            onDetachAudio();
            onClose();
          }}
        >
          Detach audio
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        className="danger"
        onClick={() => {
          onDelete(targetClip.id);
          onClose();
        }}
      >
        Delete
      </button>
    </div>,
    document.body
  );
}
