import { TEXT_PRESETS } from "../types";

export function TextTab({
  projectId,
  ready,
  exporting,
  onAddTitlePreset,
}: {
  projectId: string;
  ready: boolean;
  exporting: boolean;
  onAddTitlePreset: (preset: (typeof TEXT_PRESETS)[0]) => void;
}) {
  return (
    <>
      <div className="studio-bin-heading">
        <strong>Text presets</strong>
        <span>Click to add</span>
      </div>
      <div className="studio-bin-grid">
        {TEXT_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.id}
            className="bin-item studio-preset-tile"
            disabled={!projectId || !ready || exporting}
            onClick={() => onAddTitlePreset(preset)}
            title={preset.label}
          >
            <span className="studio-asset-thumb studio-text-preview-box">
              <span
                className="studio-text-preview-sample"
                style={{
                  fontFamily: preset.settings.fontFamily ?? "system-ui, sans-serif",
                  fontWeight: preset.settings.bold === false ? 400 : 700,
                  fontStyle: preset.settings.italic ? "italic" : "normal",
                  color: preset.settings.color,
                  backgroundColor: preset.settings.showBackground ? preset.settings.backgroundColor : "transparent",
                  borderRadius: preset.settings.backgroundRadius
                    ? `${Math.min(8, preset.settings.backgroundRadius)}px`
                    : undefined,
                  textShadow: preset.settings.shadow
                    ? `0 1px ${Math.min(10, preset.settings.shadowBlur ?? 8)}px ${preset.settings.shadowColor ?? "#000"}`
                    : preset.settings.strokeWidth
                      ? `0 0 2px ${preset.settings.strokeColor ?? "#000"}`
                      : undefined,
                }}
              >
                {preset.preview}
              </span>
            </span>
            <strong title={preset.label}>{preset.label}</strong>
          </button>
        ))}
      </div>
    </>
  );
}
