export function LibraryTab({
  libraryTab,
  libraryBackgroundColor,
  projectId,
  ready,
  exporting,
  setLibraryTab,
  setLibraryBackgroundColor,
  addLibraryColorBackground,
}: {
  libraryTab: "image" | "video" | "sound";
  libraryBackgroundColor: string;
  projectId: string;
  ready: boolean;
  exporting: boolean;
  setLibraryTab: (tab: "image" | "video" | "sound") => void;
  setLibraryBackgroundColor: (color: string) => void;
  addLibraryColorBackground: () => void;
}) {
  return (
    <>
      <div className="studio-bin-heading">
        <strong>Library</strong>
        <span>On this device</span>
      </div>
      <div className="studio-library-tabs" role="tablist" aria-label="Library categories">
        {(["image", "video", "sound"] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            role="tab"
            aria-selected={libraryTab === tab}
            className={libraryTab === tab ? "active" : ""}
            onClick={() => setLibraryTab(tab)}
          >
            {tab === "sound" ? "Sound effects" : `${tab[0].toUpperCase()}${tab.slice(1)}s`}
          </button>
        ))}
      </div>
      {libraryTab === "image" ? (
        <div className="studio-library-grid">
          <div className="studio-library-color-tile">
            <button
              type="button"
              className="studio-library-color-preview"
              aria-label="Add color background to timeline"
              title="Add color background to timeline"
              style={{ backgroundColor: libraryBackgroundColor }}
              disabled={Boolean(projectId && !ready) || exporting}
              onClick={() => void addLibraryColorBackground()}
            />
            <label className="studio-library-color-picker" title="Choose background color">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 2.5a7.5 7.5 0 1 0 0 15h1a2 2 0 0 0 1.5-3.3c-.7-.8-.2-2.2.9-2.2H15a2.5 2.5 0 0 0 2.5-2.5C17.5 5.6 14.1 2.5 10 2.5Z" />
                <circle cx="6.5" cy="9" r=".7" />
                <circle cx="9.5" cy="6.5" r=".7" />
                <circle cx="13" cy="7" r=".7" />
              </svg>
              <input
                aria-label="Choose background color"
                type="color"
                value={libraryBackgroundColor}
                onChange={(event) => setLibraryBackgroundColor(event.currentTarget.value)}
              />
            </label>
          </div>
        </div>
      ) : libraryTab === "video" ? (
        <p className="studio-bin-hint">Library videos are not available yet.</p>
      ) : (
        <p className="studio-bin-hint">Sound effects are not available yet.</p>
      )}
    </>
  );
}
