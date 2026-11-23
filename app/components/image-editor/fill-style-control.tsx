import type { FillStyle } from "../../lib/image-editor/types";

type FillStyleControlProps = {
  label: string;
  solidColor: string;
  fillStyle?: FillStyle | null;
  onChange: (nextSolid: string, nextFillStyle: FillStyle) => void;
};

/** Reusable Solid / Linear Gradient / Radial Gradient picker with typed angle input. */
export function FillStyleControl({ label, solidColor, fillStyle, onChange }: FillStyleControlProps) {
  const mode = fillStyle?.kind ?? "solid";
  const current: FillStyle = fillStyle ?? { kind: "solid", color: solidColor };

  return (
    <div className="collage-selected-controls" style={{ paddingTop: 6 }}>
      <strong>{label}</strong>
      <label className="ratio-field">
        Fill type
        <select
          value={mode}
          onChange={(event) => {
            const nextKind = event.currentTarget.value as FillStyle["kind"];
            if (nextKind === "solid") {
              onChange(solidColor, { kind: "solid", color: solidColor });
            } else if (nextKind === "linear") {
              onChange(solidColor, { kind: "linear", from: solidColor, to: "#4f7cff", angle: 45 });
            } else {
              onChange(solidColor, { kind: "radial", inner: solidColor, outer: "#111827" });
            }
          }}
        >
          <option value="solid">Solid color</option>
          <option value="linear">Linear gradient</option>
          <option value="radial">Radial gradient</option>
        </select>
      </label>

      {current.kind === "solid" && (
        <label className="collage-custom-color">
          Color
          <input
            type="color"
            value={current.color}
            onChange={(event) => onChange(event.currentTarget.value, { kind: "solid", color: event.currentTarget.value })}
          />
        </label>
      )}

      {current.kind === "linear" && (
        <>
          <div className="dimension-fields">
            <label>
              From
              <input
                type="color"
                value={current.from}
                onChange={(event) => onChange(event.currentTarget.value, { ...current, from: event.currentTarget.value })}
              />
            </label>
            <label>
              To
              <input
                type="color"
                value={current.to}
                onChange={(event) => onChange(current.from, { ...current, to: event.currentTarget.value })}
              />
            </label>
          </div>
          <label>
            Angle <span>deg</span>
            <input
              type="number"
              min="-360"
              max="360"
              step="1"
              value={current.angle}
              onChange={(event) => onChange(current.from, { ...current, angle: Number(event.currentTarget.value) || 0 })}
            />
          </label>
        </>
      )}

      {current.kind === "radial" && (
        <div className="dimension-fields">
          <label>
            Inner
            <input
              type="color"
              value={current.inner}
              onChange={(event) => onChange(event.currentTarget.value, { ...current, inner: event.currentTarget.value })}
            />
          </label>
          <label>
            Outer
            <input
              type="color"
              value={current.outer}
              onChange={(event) => onChange(current.inner, { ...current, outer: event.currentTarget.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
