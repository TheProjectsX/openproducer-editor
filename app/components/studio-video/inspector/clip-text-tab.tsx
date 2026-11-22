import type { VideoTimelineAsset } from "../../../lib/project-store";
import { EditorRange } from "../controls/editor-range";
import { ImageNumberInput } from "../controls/image-number-input";

export function ClipTextTab({
  selectedAsset,
  hasKeyframeAtPlayhead,
  toggleKeyframeAtPlayhead,
  editTitleAsset,
  alignSelectedVisual,
}: {
  selectedAsset?: VideoTimelineAsset;
  hasKeyframeAtPlayhead: boolean;
  toggleKeyframeAtPlayhead: () => void;
  editTitleAsset: (assetId: string, settings: NonNullable<VideoTimelineAsset["textSettings"]>) => void;
  alignSelectedVisual: (horizontal: "left" | "center" | "right", vertical: "top" | "middle" | "bottom") => void;
}) {
  if (!selectedAsset?.textSettings) return null;
  const ts = selectedAsset.textSettings;
  const currentCase = ts.textCase ?? (ts.uppercase ? "uppercase" : "none");

  return (
    <div className="title-inspector">
      <div className="clip-control-head">
        <strong>Title style</strong>
        <button
          type="button"
          className={`keyframe-diamond-btn${hasKeyframeAtPlayhead ? " active" : ""}`}
          aria-pressed={hasKeyframeAtPlayhead}
          title={hasKeyframeAtPlayhead ? "Remove keyframe at playhead" : "Add keyframe at playhead"}
          aria-label={hasKeyframeAtPlayhead ? "Remove title keyframe at playhead" : "Add title keyframe at playhead"}
          onClick={toggleKeyframeAtPlayhead}
        >
          {hasKeyframeAtPlayhead ? "◆" : "◇"}
        </button>
      </div>
      <label className="ratio-field">
        Title text
        <textarea
          rows={3}
          maxLength={500}
          value={ts.text}
          onChange={(event) => editTitleAsset(selectedAsset.id, { ...ts, text: event.currentTarget.value })}
        />
      </label>
      <label className="ratio-field">
        Font
        <select
          value={ts.fontFamily ?? "system-ui, sans-serif"}
          onChange={(event) => editTitleAsset(selectedAsset.id, { ...ts, fontFamily: event.currentTarget.value })}
        >
          <option value="system-ui, sans-serif">System</option>
          <option value="Inter Variable, sans-serif">Inter</option>
          <option value="Ubuntu, sans-serif">Ubuntu</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Courier New', monospace">Courier New</option>
          <option value="Impact, sans-serif">Impact</option>
        </select>
      </label>
      <EditorRange
        label="Font size"
        min={8}
        max={512}
        step={1}
        value={ts.fontSize}
        unit="px"
        onChange={(fontSize) =>
          editTitleAsset(selectedAsset.id, { ...ts, fontSize: Math.max(8, Math.min(512, fontSize)) })
        }
      />
      <div className="clip-control-head">
        <strong>Wrap width</strong>
        {ts.maxWidth && ts.maxWidth > 0 ? (
          <button
            type="button"
            className="editor-action"
            onClick={() => editTitleAsset(selectedAsset.id, { ...ts, maxWidth: undefined })}
          >
            Auto
          </button>
        ) : null}
      </div>
      <EditorRange
        label="Max width"
        min={0}
        max={2560}
        step={10}
        value={ts.maxWidth ?? 0}
        unit={ts.maxWidth && ts.maxWidth > 0 ? "px" : " (Auto)"}
        onChange={(value) =>
          editTitleAsset(selectedAsset.id, { ...ts, maxWidth: value > 0 ? Math.max(20, value) : undefined })
        }
      />
      <ImageNumberInput
        label="Max width (0 = auto)"
        unit="canvas px"
        value={ts.maxWidth ?? 0}
        min={0}
        max={16384}
        step="1"
        onCommit={(value) =>
          editTitleAsset(selectedAsset.id, { ...ts, maxWidth: value > 0 ? Math.max(20, value) : undefined })
        }
      />
      <div className="clip-align-controls">
        <span>Pattern</span>
        <button
          type="button"
          title="Bold"
          aria-label="Bold"
          aria-pressed={ts.bold !== false}
          onClick={() => editTitleAsset(selectedAsset.id, { ...ts, bold: ts.bold === false })}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          title="Underline"
          aria-label="Underline"
          aria-pressed={Boolean(ts.underline)}
          onClick={() => editTitleAsset(selectedAsset.id, { ...ts, underline: !ts.underline })}
        >
          <u>U</u>
        </button>
        <button
          type="button"
          title="Italic"
          aria-label="Italic"
          aria-pressed={Boolean(ts.italic)}
          onClick={() => editTitleAsset(selectedAsset.id, { ...ts, italic: !ts.italic })}
        >
          <em>I</em>
        </button>
      </div>
      <div className="clip-align-controls">
        <span>Case</span>
        {(
          [
            ["uppercase", "TT", "Uppercase"],
            ["lowercase", "tt", "Lowercase"],
            ["capitalize", "Tt", "Title case"],
          ] as const
        ).map(([value, label, title]) => (
          <button
            key={value}
            type="button"
            title={title}
            aria-label={title}
            aria-pressed={currentCase === value}
            onClick={() =>
              editTitleAsset(selectedAsset.id, {
                ...ts,
                textCase: currentCase === value ? "none" : value,
                uppercase: currentCase === value ? false : value === "uppercase",
              })
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div className="filter-fields two-column transform-fields">
        <label>
          Color{" "}
          <input
            type="color"
            value={ts.color}
            onChange={(event) => editTitleAsset(selectedAsset.id, { ...ts, color: event.currentTarget.value })}
          />
        </label>
        <label>
          Character <span>px</span>
          <input
            type="number"
            min="-10"
            max="60"
            step="0.5"
            value={ts.letterSpacing ?? 0}
            onChange={(event) =>
              editTitleAsset(selectedAsset.id, {
                ...ts,
                letterSpacing: Math.max(-10, Math.min(60, Number(event.currentTarget.value) || 0)),
              })
            }
          />
        </label>
        <label>
          Line <span>0.8–3</span>
          <input
            type="number"
            min="0.8"
            max="3"
            step="0.05"
            value={ts.lineHeight ?? 1.2}
            onChange={(event) =>
              editTitleAsset(selectedAsset.id, {
                ...ts,
                lineHeight: Math.max(0.8, Math.min(3, Number(event.currentTarget.value) || 1.2)),
              })
            }
          />
        </label>
        <label>
          Stroke width <span>px</span>
          <input
            type="number"
            min="0"
            max="24"
            step="0.5"
            value={ts.strokeWidth ?? 0}
            onChange={(event) =>
              editTitleAsset(selectedAsset.id, {
                ...ts,
                strokeWidth: Math.max(0, Math.min(24, Number(event.currentTarget.value) || 0)),
              })
            }
          />
        </label>
        <label>
          Stroke color{" "}
          <input
            type="color"
            value={ts.strokeColor ?? "#000000"}
            onChange={(event) => editTitleAsset(selectedAsset.id, { ...ts, strokeColor: event.currentTarget.value })}
          />
        </label>
      </div>
      <div className="clip-align-controls" aria-label="Text alignment">
        <span>Alignment</span>
        <button
          type="button"
          title="Align left"
          aria-label="Align left"
          aria-pressed={(ts.align ?? "center") === "left"}
          onClick={() => editTitleAsset(selectedAsset.id, { ...ts, align: "left" })}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 3.5h12M2 6.5h8M2 9.5h12M2 12.5h8" />
          </svg>
        </button>
        <button
          type="button"
          title="Align center"
          aria-label="Align center"
          aria-pressed={(ts.align ?? "center") === "center"}
          onClick={() => editTitleAsset(selectedAsset.id, { ...ts, align: "center" })}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 3.5h12M4 6.5h8M2 9.5h12M4 12.5h8" />
          </svg>
        </button>
        <button
          type="button"
          title="Align right"
          aria-label="Align right"
          aria-pressed={(ts.align ?? "center") === "right"}
          onClick={() => editTitleAsset(selectedAsset.id, { ...ts, align: "right" })}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 3.5h12M6 6.5h8M2 9.5h12M6 12.5h8" />
          </svg>
        </button>
        <button
          type="button"
          title="Align top of canvas"
          aria-label="Align top of canvas"
          onClick={() => alignSelectedVisual("center", "top")}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 2v12M6.5 2v8M9.5 2v12M12.5 2v8" />
          </svg>
        </button>
        <button
          type="button"
          title="Align middle of canvas"
          aria-label="Align middle of canvas"
          onClick={() => alignSelectedVisual("center", "middle")}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 2v12M6.5 4v8M9.5 2v12M12.5 4v8" />
          </svg>
        </button>
        <button
          type="button"
          title="Align bottom of canvas"
          aria-label="Align bottom of canvas"
          onClick={() => alignSelectedVisual("center", "bottom")}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 2v12M6.5 6v8M9.5 2v12M12.5 6v8" />
          </svg>
        </button>
      </div>
      <label className="ratio-toggle">
        <input
          type="checkbox"
          checked={Boolean(ts.shadow)}
          onChange={(event) => editTitleAsset(selectedAsset.id, { ...ts, shadow: event.currentTarget.checked })}
        />
        Drop shadow
      </label>
      {ts.shadow && (
        <div className="filter-fields two-column transform-fields">
          <label>
            Shadow color{" "}
            <input
              type="color"
              value={ts.shadowColor ?? "#000000"}
              onChange={(event) => editTitleAsset(selectedAsset.id, { ...ts, shadowColor: event.currentTarget.value })}
            />
          </label>
          <label>
            Shadow blur <span>px</span>
            <input
              type="number"
              min="0"
              max="40"
              step="1"
              value={ts.shadowBlur ?? 8}
              onChange={(event) =>
                editTitleAsset(selectedAsset.id, {
                  ...ts,
                  shadowBlur: Math.max(0, Math.min(40, Number(event.currentTarget.value) || 0)),
                })
              }
            />
          </label>
          <label>
            Offset X <span>px</span>
            <input
              type="number"
              min="-64"
              max="64"
              step="1"
              value={ts.shadowOffsetX ?? 0}
              onChange={(event) =>
                editTitleAsset(selectedAsset.id, {
                  ...ts,
                  shadowOffsetX: Math.max(-64, Math.min(64, Number(event.currentTarget.value) || 0)),
                })
              }
            />
          </label>
          <label>
            Offset Y <span>px</span>
            <input
              type="number"
              min="-64"
              max="64"
              step="1"
              value={ts.shadowOffsetY ?? 2}
              onChange={(event) =>
                editTitleAsset(selectedAsset.id, {
                  ...ts,
                  shadowOffsetY: Math.max(-64, Math.min(64, Number(event.currentTarget.value) || 0)),
                })
              }
            />
          </label>
        </div>
      )}
      <label className="ratio-toggle">
        <input
          type="checkbox"
          checked={ts.showBackground}
          onChange={(event) => editTitleAsset(selectedAsset.id, { ...ts, showBackground: event.currentTarget.checked })}
        />
        Show title background
      </label>
      {ts.showBackground && (
        <div className="filter-fields two-column transform-fields">
          <label>
            Background{" "}
            <input
              type="color"
              value={ts.backgroundColor}
              onChange={(event) => editTitleAsset(selectedAsset.id, { ...ts, backgroundColor: event.currentTarget.value })}
            />
          </label>
          <label>
            Radius <span>px</span>
            <input
              type="number"
              min="0"
              max="64"
              step="1"
              value={ts.backgroundRadius ?? 0}
              onChange={(event) =>
                editTitleAsset(selectedAsset.id, {
                  ...ts,
                  backgroundRadius: Math.max(0, Math.min(64, Number(event.currentTarget.value) || 0)),
                })
              }
            />
          </label>
          <label>
            BG opacity <span>%</span>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={Math.round((ts.backgroundOpacity ?? 1) * 100)}
              onChange={(event) =>
                editTitleAsset(selectedAsset.id, {
                  ...ts,
                  backgroundOpacity: Math.max(0, Math.min(1, (Number(event.currentTarget.value) || 0) / 100)),
                })
              }
            />
          </label>
          <label>
            Padding <span>px</span>
            <input
              type="number"
              min="0"
              max="64"
              step="1"
              value={ts.backgroundPadding ?? 0}
              onChange={(event) =>
                editTitleAsset(selectedAsset.id, {
                  ...ts,
                  backgroundPadding: Math.max(0, Math.min(64, Number(event.currentTarget.value) || 0)),
                })
              }
            />
          </label>
        </div>
      )}
    </div>
  );
}
