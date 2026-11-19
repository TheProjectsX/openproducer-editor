export function ShortcutsModal({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div
      className="studio-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <section className="studio-shortcuts-modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className="studio-export-heading">
          <div>
            <span>VIDEO STUDIO</span>
            <h2>Keyboard shortcuts</h2>
          </div>
          <button type="button" autoFocus aria-label="Close shortcuts" onClick={onClose}>
            ×
          </button>
        </div>
        <dl className="studio-shortcuts-list">
          <div>
            <dt><kbd>Space</kbd></dt>
            <dd>Play / Pause</dd>
          </div>
          <div>
            <dt><kbd>J</kbd> / <kbd>K</kbd> / <kbd>L</kbd></dt>
            <dd>Step back 1s / Pause / Play</dd>
          </div>
          <div>
            <dt><kbd>←</kbd> / <kbd>→</kbd></dt>
            <dd>Step 1 frame (<kbd>Shift</kbd> for 1s)</dd>
          </div>
          <div>
            <dt><kbd>Home</kbd></dt>
            <dd>Jump to start</dd>
          </div>
          <div>
            <dt><kbd>S</kbd> or <kbd>Ctrl+B</kbd></dt>
            <dd>Split selected clip at playhead</dd>
          </div>
          <div>
            <dt><kbd>Q</kbd> / <kbd>W</kbd></dt>
            <dd>Delete left / right of playhead</dd>
          </div>
          <div>
            <dt><kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd></dt>
            <dd>Copy / Paste clip at playhead</dd>
          </div>
          <div>
            <dt><kbd>Ctrl+D</kbd></dt>
            <dd>Duplicate selected clip</dd>
          </div>
          <div>
            <dt><kbd>Delete</kbd> / <kbd>Backspace</kbd></dt>
            <dd>Delete selected clip(s)</dd>
          </div>
          <div>
            <dt><kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd></dt>
            <dd>Undo / Redo</dd>
          </div>
          <div>
            <dt><kbd>+</kbd> / <kbd>-</kbd> or <kbd>Ctrl+Scroll</kbd></dt>
            <dd>Zoom timeline (or stage)</dd>
          </div>
          <div>
            <dt><kbd>Alt</kbd> + Drag</dt>
            <dd>Temporarily bypass snapping</dd>
          </div>
          <div>
            <dt><kbd>?</kbd></dt>
            <dd>Toggle this shortcut list</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
