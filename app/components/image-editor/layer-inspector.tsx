import { useEffect, useState } from "react";
import {
  FONT_FAMILIES,
  STICKER_PRESETS,
  type CustomFontEntry,
  type EditorLayer,
  type ShadowEffect,
  type ShapeKind,
  type TextAlign,
  type TextCase,
} from "../../lib/image-editor/types";
import { FillStyleControl } from "./fill-style-control";

type StageToolMode = "select" | "draw" | "bezier" | "erase" | "perspective";

type SubViewId =
  | null
  | "transform"
  | "text-content"
  | "text-fill"
  | "text-shadow"
  | "text-bg"
  | "text-3d"
  | "shape-style"
  | "image-color"
  | "image-crop"
  | "image-cutout"
  | "image-fx"
  | "image-perspective"
  | "sticker"
  | "draw"
  | "bezier";

type LayerInspectorProps = {
  layer: EditorLayer;
  customFonts: CustomFontEntry[];
  stageMode: StageToolMode;
  eraserBrushSize: number;
  onEraserBrushSizeChange: (size: number) => void;
  onStageModeChange: (mode: StageToolMode) => void;
  onUpdate: (id: string, patch: Partial<EditorLayer>) => void;
  onDuplicate: (id: string) => void;
  onUploadCustomFont: (file: File | undefined) => void;
  onClearEraserMask: (id: string) => void;
};

const DEFAULT_SHADOW: ShadowEffect = {
  enabled: false,
  color: "#000000",
  blur: 10,
  offsetX: 4,
  offsetY: 4,
};

function ShadowControls({
  title,
  shadow,
  onChange,
}: {
  title: string;
  shadow?: ShadowEffect;
  onChange: (next: ShadowEffect) => void;
}) {
  const s = shadow ?? DEFAULT_SHADOW;
  return (
    <div className="collage-selected-controls" style={{ paddingTop: 6 }}>
      <label className="collage-check-control">
        <input type="checkbox" checked={s.enabled} onChange={(e) => onChange({ ...s, enabled: e.currentTarget.checked })} />
        {title}
      </label>
      {s.enabled && (
        <>
          <div className="dimension-fields">
            <label>Color<input type="color" value={s.color} onChange={(e) => onChange({ ...s, color: e.currentTarget.value })} /></label>
            <label>Blur <span>px</span><input type="number" min="0" max="100" step="1" value={s.blur} onChange={(e) => onChange({ ...s, blur: Math.max(0, Number(e.currentTarget.value) || 0) })} /></label>
          </div>
          <div className="dimension-fields">
            <label>Offset X <span>px</span><input type="number" min="-200" max="200" step="1" value={s.offsetX} onChange={(e) => onChange({ ...s, offsetX: Number(e.currentTarget.value) || 0 })} /></label>
            <label>Offset Y <span>px</span><input type="number" min="-200" max="200" step="1" value={s.offsetY} onChange={(e) => onChange({ ...s, offsetY: Number(e.currentTarget.value) || 0 })} /></label>
          </div>
        </>
      )}
    </div>
  );
}

function MenuRow({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="be-menu-item" onClick={onClick}>
      <span>{label}</span>
      {active && <span className="be-menu-dot" aria-label="Active" />}
    </button>
  );
}

/** BeFunky-style drill-down inspector for the selected layer. */
export function LayerInspector({
  layer,
  customFonts,
  stageMode,
  eraserBrushSize,
  onEraserBrushSizeChange,
  onStageModeChange,
  onUpdate,
  onDuplicate,
  onUploadCustomFont,
  onClearEraserMask,
}: LayerInspectorProps) {
  const [subView, setSubView] = useState<SubViewId>(null);

  useEffect(() => {
    setSubView(null);
  }, [layer.id]);

  const isShape =
    layer.kind === "rectangle" ||
    layer.kind === "ellipse" ||
    layer.kind === "rounded-rect" ||
    layer.kind === "polygon" ||
    layer.kind === "star" ||
    layer.kind === "arrow" ||
    layer.kind === "speech-bubble";

  if (subView === null) {
    return (
      <div className="collage-selected-controls">
        <div className="dimension-fields" style={{ alignItems: "center" }}>
          <strong>{layer.kind.toUpperCase()} options</strong>
          <button type="button" className="secondary-button" onClick={() => onDuplicate(layer.id)}>Duplicate</button>
        </div>
        <div className="dimension-fields">
          <label className="collage-check-control">
            <input type="checkbox" checked={layer.visible} onChange={(e) => onUpdate(layer.id, { visible: e.currentTarget.checked })} />
            Visible
          </label>
          <label className="collage-check-control">
            <input type="checkbox" checked={Boolean(layer.locked)} onChange={(e) => onUpdate(layer.id, { locked: e.currentTarget.checked })} />
            Lock
          </label>
        </div>

        {layer.kind === "text" && (
          <label style={{ borderLeft: "3px solid #36d2e0", paddingLeft: 8 }}>
            Text <span style={{ color: "#36d2e0", fontWeight: 500 }}>(or double-click on canvas)</span>
            <textarea
              rows={2}
              maxLength={500}
              value={layer.text}
              onChange={(e) => onUpdate(layer.id, { text: e.currentTarget.value })}
              style={{ borderColor: "#36d2e0" }}
            />
          </label>
        )}

        <div className="be-menu-list">
          <MenuRow label="Position, Size & Opacity" onClick={() => setSubView("transform")} />

          {layer.kind === "text" && (
            <>
              <MenuRow label="Text, Font & Spacing" onClick={() => setSubView("text-content")} />
              <MenuRow label="Fill Gradient & Stroke" active={Boolean(layer.fillStyle && layer.fillStyle.kind !== "solid") || (layer.strokeWidth ?? 0) > 0} onClick={() => setSubView("text-fill")} />
              <MenuRow label="Shadow & Inner Shadow" active={Boolean(layer.shadow?.enabled || layer.innerShadow?.enabled)} onClick={() => setSubView("text-shadow")} />
              <MenuRow label="Background Highlight" active={Boolean(layer.background?.enabled)} onClick={() => setSubView("text-bg")} />
              <MenuRow label="3D Text, Curve & Reflection" active={Boolean(layer.text3d?.enabled || (layer.curveRadius ?? 0) !== 0 || layer.reflection?.enabled)} onClick={() => setSubView("text-3d")} />
            </>
          )}

          {isShape && (
            <MenuRow label="Shape Fill, Stroke & Shadow" active={Boolean(layer.shadow?.enabled || layer.strokeWidth > 0)} onClick={() => setSubView("shape-style")} />
          )}

          {layer.kind === "sticker" && (
            <MenuRow label="Sticker Emoji & Shadow" active={Boolean(layer.shadow?.enabled)} onClick={() => setSubView("sticker")} />
          )}

          {layer.kind === "draw" && (
            <MenuRow label="Brush Color, Dash & Glow" active={Boolean(layer.dashed || (layer.glowBlur ?? 0) > 0)} onClick={() => setSubView("draw")} />
          )}

          {layer.kind === "bezier" && (
            <MenuRow label="Path Fill, Stroke & Shadow" active={Boolean(layer.shadow?.enabled)} onClick={() => setSubView("bezier")} />
          )}

          {layer.kind === "image" && (
            <>
              <MenuRow label="Color, Brightness & Tint" active={Boolean(layer.colorize?.enabled || layer.brightness !== "100" || layer.contrast !== "100" || layer.saturation !== "100")} onClick={() => setSubView("image-color")} />
              <MenuRow label="Crop & Shape Mask" active={Boolean((layer.clipShape && layer.clipShape !== "none") || (layer.crop && (layer.crop.left || layer.crop.top || layer.crop.right || layer.crop.bottom)))} onClick={() => setSubView("image-crop")} />
              <MenuRow label="Cutout & Manual Eraser" active={Boolean(layer.eraseColor?.enabled || layer.eraserMaskFile)} onClick={() => setSubView("image-cutout")} />
              <MenuRow label="Stroke, Shadow, Emboss & Reflection" active={Boolean(layer.shadow?.enabled || layer.emboss?.enabled || layer.reflection?.enabled || (layer.strokeWidth ?? 0) > 0)} onClick={() => setSubView("image-fx")} />
              <MenuRow label="4-Corner Perspective Warp" active={Boolean(layer.perspective && Object.values(layer.perspective).some((p) => p.x !== 0 || p.y !== 0))} onClick={() => setSubView("image-perspective")} />
            </>
          )}
        </div>
      </div>
    );
  }

  const SUB_TITLES: Record<Exclude<SubViewId, null>, string> = {
    transform: "Position, Size & Opacity",
    "text-content": "Text, Font & Spacing",
    "text-fill": "Fill & Stroke",
    "text-shadow": "Shadow & Inner Shadow",
    "text-bg": "Background Highlight",
    "text-3d": "3D Text, Curve & Reflection",
    "shape-style": "Shape Style",
    "image-color": "Color & Tint",
    "image-crop": "Crop & Shape Mask",
    "image-cutout": "Cutout & Eraser",
    "image-fx": "Stroke, Shadow & Emboss",
    "image-perspective": "4-Corner Perspective",
    sticker: "Sticker & Shadow",
    draw: "Draw Stroke Style",
    bezier: "Bezier Path Style",
  };

  return (
    <div className="collage-selected-controls">
      <div className="be-subpanel-header">
        <button type="button" className="be-back-btn" onClick={() => { setSubView(null); if (stageMode !== "select") onStageModeChange("select"); }} aria-label="Back to options">←</button>
        <strong>{SUB_TITLES[subView]}</strong>
      </div>

      {subView === "transform" && (
        <>
          <div className="dimension-fields">
            <label>X <span>px</span><input type="number" step="1" value={layer.x} onChange={(e) => onUpdate(layer.id, { x: Number(e.currentTarget.value) || 0 })} /></label>
            <label>Y <span>px</span><input type="number" step="1" value={layer.y} onChange={(e) => onUpdate(layer.id, { y: Number(e.currentTarget.value) || 0 })} /></label>
          </div>
          <div className="dimension-fields">
            <label>Width <span>px</span><input type="number" min="1" step="1" value={layer.width} onChange={(e) => onUpdate(layer.id, { width: Math.max(1, Number(e.currentTarget.value) || 1) })} /></label>
            <label>Height <span>px</span><input type="number" min="1" step="1" value={layer.height} onChange={(e) => onUpdate(layer.id, { height: Math.max(1, Number(e.currentTarget.value) || 1) })} /></label>
          </div>
          <div className="dimension-fields">
            <label>Rotate <span>−180–180°</span><input type="number" min="-180" max="180" step="any" value={layer.rotation} onChange={(e) => onUpdate(layer.id, { rotation: e.currentTarget.value })} /></label>
            <label>Opacity <span>0–100%</span><input type="number" min="0" max="100" step="1" value={layer.opacity} onChange={(e) => onUpdate(layer.id, { opacity: e.currentTarget.value })} /></label>
          </div>
        </>
      )}

      {subView === "text-content" && layer.kind === "text" && (
        <>
          <label className="ratio-field">
            Font
            <select value={layer.fontFamily} onChange={(e) => onUpdate(layer.id, { fontFamily: e.currentTarget.value })}>
              {FONT_FAMILIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              {customFonts.map((cf) => <option key={cf.id} value={`"${cf.family}"`}>{cf.family} (Custom)</option>)}
            </select>
          </label>
          <label className="file-picker collage-add-layer">
            <span>+ Import custom font (.ttf / .otf)</span>
            <input type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf" onChange={(e) => { onUploadCustomFont(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} />
          </label>
          <div className="dimension-fields">
            <label>Font size <span>px</span><input type="number" min="8" max="512" step="1" value={layer.fontSize} onChange={(e) => onUpdate(layer.id, { fontSize: Math.max(8, Number(e.currentTarget.value) || 16) })} /></label>
            <label className="ratio-field">Align<select value={layer.align ?? "left"} onChange={(e) => onUpdate(layer.id, { align: e.currentTarget.value as TextAlign })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
          </div>
          <div className="dimension-fields">
            <label className="collage-check-control"><input type="checkbox" checked={layer.bold} onChange={(e) => onUpdate(layer.id, { bold: e.currentTarget.checked })} />Bold</label>
            <label className="collage-check-control"><input type="checkbox" checked={layer.italic} onChange={(e) => onUpdate(layer.id, { italic: e.currentTarget.checked })} />Italic</label>
          </div>
          <div className="dimension-fields">
            <label>Letter spacing <span>px</span><input type="number" min="-20" max="100" step="0.5" value={layer.letterSpacing ?? 0} onChange={(e) => onUpdate(layer.id, { letterSpacing: Number(e.currentTarget.value) || 0 })} /></label>
            <label>Line height <span>×</span><input type="number" min="0.8" max="3" step="0.05" value={layer.lineHeight ?? 1.25} onChange={(e) => onUpdate(layer.id, { lineHeight: Math.max(0.8, Number(e.currentTarget.value) || 1.25) })} /></label>
          </div>
          <label className="ratio-field">Case<select value={layer.textCase ?? "none"} onChange={(e) => onUpdate(layer.id, { textCase: e.currentTarget.value as TextCase })}><option value="none">As typed</option><option value="uppercase">UPPERCASE</option><option value="lowercase">lowercase</option><option value="capitalize">Title Case</option></select></label>
        </>
      )}

      {subView === "text-fill" && layer.kind === "text" && (
        <>
          <FillStyleControl label="Text fill" solidColor={layer.fill} fillStyle={layer.fillStyle} onChange={(nextSolid, nextFillStyle) => onUpdate(layer.id, { fill: nextSolid, fillStyle: nextFillStyle })} />
          <div className="dimension-fields">
            <label>Stroke color<input type="color" value={layer.strokeColor ?? "#000000"} onChange={(e) => onUpdate(layer.id, { strokeColor: e.currentTarget.value })} /></label>
            <label>Stroke width <span>px</span><input type="number" min="0" max="40" step="0.5" value={layer.strokeWidth ?? 0} onChange={(e) => onUpdate(layer.id, { strokeWidth: Math.max(0, Number(e.currentTarget.value) || 0) })} /></label>
          </div>
        </>
      )}

      {subView === "text-shadow" && layer.kind === "text" && (
        <>
          <ShadowControls title="Drop shadow" shadow={layer.shadow} onChange={(shadow) => onUpdate(layer.id, { shadow })} />
          <ShadowControls title="Inner shadow" shadow={layer.innerShadow} onChange={(innerShadow) => onUpdate(layer.id, { innerShadow })} />
        </>
      )}

      {subView === "text-bg" && layer.kind === "text" && (
        <>
          <label className="collage-check-control">
            <input type="checkbox" checked={Boolean(layer.background?.enabled)} onChange={(e) => onUpdate(layer.id, { background: { enabled: e.currentTarget.checked, color: layer.background?.color ?? "#111827", padding: layer.background?.padding ?? 12, radius: layer.background?.radius ?? 8, opacity: layer.background?.opacity ?? 85 } })} />
            Enable background highlight
          </label>
          {layer.background?.enabled && (
            <div className="dimension-fields">
              <label>Bg color<input type="color" value={layer.background.color} onChange={(e) => onUpdate(layer.id, { background: { ...layer.background!, color: e.currentTarget.value } })} /></label>
              <label>Padding <span>px</span><input type="number" min="0" max="100" step="1" value={layer.background.padding} onChange={(e) => onUpdate(layer.id, { background: { ...layer.background!, padding: Math.max(0, Number(e.currentTarget.value) || 0) } })} /></label>
              <label>Radius <span>px</span><input type="number" min="0" max="100" step="1" value={layer.background.radius} onChange={(e) => onUpdate(layer.id, { background: { ...layer.background!, radius: Math.max(0, Number(e.currentTarget.value) || 0) } })} /></label>
              <label>Opacity <span>%</span><input type="number" min="0" max="100" step="1" value={layer.background.opacity} onChange={(e) => onUpdate(layer.id, { background: { ...layer.background!, opacity: Math.max(0, Math.min(100, Number(e.currentTarget.value) || 0)) } })} /></label>
            </div>
          )}
        </>
      )}

      {subView === "text-3d" && layer.kind === "text" && (
        <>
          <label>Curve radius <span>px (0 = flat)</span><input type="number" min="-1000" max="1000" step="5" value={layer.curveRadius ?? 0} onChange={(e) => onUpdate(layer.id, { curveRadius: Number(e.currentTarget.value) || 0 })} /></label>
          <label className="collage-check-control">
            <input type="checkbox" checked={Boolean(layer.text3d?.enabled)} onChange={(e) => onUpdate(layer.id, { text3d: { enabled: e.currentTarget.checked, depth: layer.text3d?.depth ?? 8, angle: layer.text3d?.angle ?? 45, darken: layer.text3d?.darken ?? 65 } })} />
            3D Text Extrusion
          </label>
          {layer.text3d?.enabled && (
            <div className="dimension-fields">
              <label>Depth <span>px</span><input type="number" min="1" max="48" step="1" value={layer.text3d.depth} onChange={(e) => onUpdate(layer.id, { text3d: { ...layer.text3d!, depth: Math.max(1, Number(e.currentTarget.value) || 1) } })} /></label>
              <label>Angle <span>deg</span><input type="number" min="-180" max="180" step="1" value={layer.text3d.angle} onChange={(e) => onUpdate(layer.id, { text3d: { ...layer.text3d!, angle: Number(e.currentTarget.value) || 0 } })} /></label>
              <label>Darken <span>%</span><input type="number" min="10" max="90" step="1" value={layer.text3d.darken} onChange={(e) => onUpdate(layer.id, { text3d: { ...layer.text3d!, darken: Number(e.currentTarget.value) || 60 } })} /></label>
            </div>
          )}
          <label className="collage-check-control">
            <input type="checkbox" checked={Boolean(layer.reflection?.enabled)} onChange={(e) => onUpdate(layer.id, { reflection: { enabled: e.currentTarget.checked, offset: layer.reflection?.offset ?? 4, opacity: layer.reflection?.opacity ?? 40 } })} />
            Reflection
          </label>
        </>
      )}

      {subView === "shape-style" && isShape && (
        <>
          <label className="ratio-field">
            Shape type
            <select value={layer.kind} onChange={(e) => onUpdate(layer.id, { kind: e.currentTarget.value as ShapeKind })}>
              <option value="rectangle">Rectangle</option>
              <option value="rounded-rect">Rounded Rectangle</option>
              <option value="ellipse">Ellipse / Circle</option>
              <option value="polygon">Polygon</option>
              <option value="star">Star</option>
              <option value="arrow">Arrow</option>
              <option value="speech-bubble">Speech Bubble</option>
            </select>
          </label>
          <FillStyleControl label="Shape fill" solidColor={layer.fill} fillStyle={layer.fillStyle} onChange={(nextSolid, nextFillStyle) => onUpdate(layer.id, { fill: nextSolid, fillStyle: nextFillStyle })} />
          <div className="dimension-fields">
            <label>Stroke color<input type="color" value={layer.strokeColor} onChange={(e) => onUpdate(layer.id, { strokeColor: e.currentTarget.value })} /></label>
            <label>Stroke width <span>px</span><input type="number" min="0" max="60" step="1" value={layer.strokeWidth} onChange={(e) => onUpdate(layer.id, { strokeWidth: Math.max(0, Number(e.currentTarget.value) || 0) })} /></label>
          </div>
          {(layer.kind === "rounded-rect" || layer.kind === "speech-bubble") && (
            <label>Corner radius <span>px</span><input type="number" min="0" max="200" step="1" value={layer.cornerRadius ?? 20} onChange={(e) => onUpdate(layer.id, { cornerRadius: Math.max(0, Number(e.currentTarget.value) || 0) })} /></label>
          )}
          {(layer.kind === "polygon" || layer.kind === "star") && (
            <div className="dimension-fields">
              <label>Sides / Points<input type="number" min="3" max="24" step="1" value={layer.sides ?? (layer.kind === "star" ? 5 : 6)} onChange={(e) => onUpdate(layer.id, { sides: Math.max(3, Math.min(24, Number(e.currentTarget.value) || 5)) })} /></label>
              {layer.kind === "star" && <label>Inner ratio <span>0.15–0.9</span><input type="number" min="0.15" max="0.9" step="0.05" value={layer.innerRadiusRatio ?? 0.45} onChange={(e) => onUpdate(layer.id, { innerRadiusRatio: Math.max(0.15, Math.min(0.9, Number(e.currentTarget.value) || 0.45)) })} /></label>}
            </div>
          )}
          <ShadowControls title="Drop shadow" shadow={layer.shadow} onChange={(shadow) => onUpdate(layer.id, { shadow })} />
        </>
      )}

      {subView === "sticker" && layer.kind === "sticker" && (
        <>
          <label>Sticker / Emoji<input type="text" maxLength={8} value={layer.emoji} onChange={(e) => onUpdate(layer.id, { emoji: e.currentTarget.value })} /></label>
          <div className="speed-presets">{STICKER_PRESETS.map((em) => <button type="button" key={em} onClick={() => onUpdate(layer.id, { emoji: em })}>{em}</button>)}</div>
          <ShadowControls title="Drop shadow" shadow={layer.shadow} onChange={(shadow) => onUpdate(layer.id, { shadow })} />
        </>
      )}

      {subView === "draw" && layer.kind === "draw" && (
        <>
          <div className="dimension-fields">
            <label>Stroke color<input type="color" value={layer.strokeColor} onChange={(e) => onUpdate(layer.id, { strokeColor: e.currentTarget.value })} /></label>
            <label>Brush width <span>px</span><input type="number" min="1" max="120" step="1" value={layer.strokeWidth} onChange={(e) => onUpdate(layer.id, { strokeWidth: Math.max(1, Number(e.currentTarget.value) || 4) })} /></label>
          </div>
          <div className="dimension-fields">
            <label className="collage-check-control"><input type="checkbox" checked={Boolean(layer.dashed)} onChange={(e) => onUpdate(layer.id, { dashed: e.currentTarget.checked })} />Dashed stroke</label>
            <label>Neon glow <span>px</span><input type="number" min="0" max="60" step="1" value={layer.glowBlur ?? 0} onChange={(e) => onUpdate(layer.id, { glowBlur: Math.max(0, Number(e.currentTarget.value) || 0) })} /></label>
          </div>
        </>
      )}

      {subView === "bezier" && layer.kind === "bezier" && (
        <>
          <label className="collage-check-control"><input type="checkbox" checked={layer.closed} onChange={(e) => onUpdate(layer.id, { closed: e.currentTarget.checked })} />Closed path</label>
          {layer.closed && <FillStyleControl label="Path fill" solidColor={layer.fill} fillStyle={layer.fillStyle} onChange={(nextSolid, nextFillStyle) => onUpdate(layer.id, { fill: nextSolid, fillStyle: nextFillStyle })} />}
          <div className="dimension-fields">
            <label>Stroke color<input type="color" value={layer.strokeColor} onChange={(e) => onUpdate(layer.id, { strokeColor: e.currentTarget.value })} /></label>
            <label>Stroke width <span>px</span><input type="number" min="0" max="60" step="1" value={layer.strokeWidth} onChange={(e) => onUpdate(layer.id, { strokeWidth: Math.max(0, Number(e.currentTarget.value) || 0) })} /></label>
          </div>
          <ShadowControls title="Drop shadow" shadow={layer.shadow} onChange={(shadow) => onUpdate(layer.id, { shadow })} />
        </>
      )}

      {subView === "image-color" && layer.kind === "image" && (
        <>
          <label className="collage-check-control"><input type="checkbox" checked={layer.flipHorizontal} onChange={(e) => onUpdate(layer.id, { flipHorizontal: e.currentTarget.checked })} />Flip horizontally</label>
          <div className="dimension-fields">
            <label>Brightness <span>%</span><input type="number" min="0" max="300" step="any" value={layer.brightness} onChange={(e) => onUpdate(layer.id, { brightness: e.currentTarget.value })} /></label>
            <label>Contrast <span>%</span><input type="number" min="0" max="300" step="any" value={layer.contrast} onChange={(e) => onUpdate(layer.id, { contrast: e.currentTarget.value })} /></label>
          </div>
          <label>Saturation <span>0–300%</span><input type="number" min="0" max="300" step="any" value={layer.saturation} onChange={(e) => onUpdate(layer.id, { saturation: e.currentTarget.value })} /></label>
          <label className="collage-check-control">
            <input type="checkbox" checked={Boolean(layer.colorize?.enabled)} onChange={(e) => onUpdate(layer.id, { colorize: { enabled: e.currentTarget.checked, color: layer.colorize?.color ?? "#4f7cff", strength: layer.colorize?.strength ?? 50 } })} />
            Colorize / Tint
          </label>
          {layer.colorize?.enabled && (
            <div className="dimension-fields">
              <label>Tint color<input type="color" value={layer.colorize.color} onChange={(e) => onUpdate(layer.id, { colorize: { ...layer.colorize!, color: e.currentTarget.value } })} /></label>
              <label>Strength <span>%</span><input type="number" min="0" max="100" step="1" value={layer.colorize.strength} onChange={(e) => onUpdate(layer.id, { colorize: { ...layer.colorize!, strength: Math.max(0, Math.min(100, Number(e.currentTarget.value) || 0)) } })} /></label>
            </div>
          )}
        </>
      )}

      {subView === "image-crop" && layer.kind === "image" && (
        <>
          <div className="dimension-fields">
            <label>Left <span>0–0.45</span><input type="number" min="0" max="0.45" step="0.01" value={layer.crop?.left ?? 0} onChange={(e) => onUpdate(layer.id, { crop: { left: Math.max(0, Math.min(0.45, Number(e.currentTarget.value) || 0)), top: layer.crop?.top ?? 0, right: layer.crop?.right ?? 0, bottom: layer.crop?.bottom ?? 0 } })} /></label>
            <label>Top <span>0–0.45</span><input type="number" min="0" max="0.45" step="0.01" value={layer.crop?.top ?? 0} onChange={(e) => onUpdate(layer.id, { crop: { left: layer.crop?.left ?? 0, top: Math.max(0, Math.min(0.45, Number(e.currentTarget.value) || 0)), right: layer.crop?.right ?? 0, bottom: layer.crop?.bottom ?? 0 } })} /></label>
            <label>Right <span>0–0.45</span><input type="number" min="0" max="0.45" step="0.01" value={layer.crop?.right ?? 0} onChange={(e) => onUpdate(layer.id, { crop: { left: layer.crop?.left ?? 0, top: layer.crop?.top ?? 0, right: Math.max(0, Math.min(0.45, Number(e.currentTarget.value) || 0)), bottom: layer.crop?.bottom ?? 0 } })} /></label>
            <label>Bottom <span>0–0.45</span><input type="number" min="0" max="0.45" step="0.01" value={layer.crop?.bottom ?? 0} onChange={(e) => onUpdate(layer.id, { crop: { left: layer.crop?.left ?? 0, top: layer.crop?.top ?? 0, right: layer.crop?.right ?? 0, bottom: Math.max(0, Math.min(0.45, Number(e.currentTarget.value) || 0)) } })} /></label>
          </div>
          <label className="ratio-field">
            Clip shape
            <select value={layer.clipShape ?? "none"} onChange={(e) => onUpdate(layer.id, { clipShape: e.currentTarget.value as "none" | "circle" | "rounded-rect" })}>
              <option value="none">None</option>
              <option value="circle">Circle / Ellipse</option>
              <option value="rounded-rect">Rounded Rectangle</option>
            </select>
          </label>
          {layer.clipShape === "rounded-rect" && (
            <label>Clip radius <span>px</span><input type="number" min="0" max="400" step="1" value={layer.clipRadius ?? 20} onChange={(e) => onUpdate(layer.id, { clipRadius: Math.max(0, Number(e.currentTarget.value) || 0) })} /></label>
          )}
        </>
      )}

      {subView === "image-cutout" && layer.kind === "image" && (
        <>
          <label className="collage-check-control">
            <input type="checkbox" checked={Boolean(layer.eraseColor?.enabled)} onChange={(e) => onUpdate(layer.id, { eraseColor: { enabled: e.currentTarget.checked, targetColor: layer.eraseColor?.targetColor ?? "#ffffff", tolerance: layer.eraseColor?.tolerance ?? 35, feather: layer.eraseColor?.feather ?? 15 } })} />
            Erase solid background color (Worker)
          </label>
          {layer.eraseColor?.enabled && (
            <div className="dimension-fields">
              <label>Target color<input type="color" value={layer.eraseColor.targetColor} onChange={(e) => onUpdate(layer.id, { eraseColor: { ...layer.eraseColor!, targetColor: e.currentTarget.value } })} /></label>
              <label>Tolerance <span>0–255</span><input type="number" min="0" max="255" step="1" value={layer.eraseColor.tolerance} onChange={(e) => onUpdate(layer.id, { eraseColor: { ...layer.eraseColor!, tolerance: Math.max(0, Number(e.currentTarget.value) || 0) } })} /></label>
              <label>Feather <span>0–100</span><input type="number" min="0" max="100" step="1" value={layer.eraseColor.feather} onChange={(e) => onUpdate(layer.id, { eraseColor: { ...layer.eraseColor!, feather: Math.max(0, Number(e.currentTarget.value) || 0) } })} /></label>
            </div>
          )}
          <div className="dimension-fields">
            <button type="button" className={stageMode === "erase" ? "export-button" : "secondary-button"} onClick={() => onStageModeChange(stageMode === "erase" ? "select" : "erase")}>
              {stageMode === "erase" ? "Done Erasing" : "Manual Eraser Brush"}
            </button>
            {layer.eraserMaskFile && <button type="button" className="secondary-button" onClick={() => onClearEraserMask(layer.id)}>Reset Eraser</button>}
          </div>
          {stageMode === "erase" && (
            <label>Brush size <span>px</span><input type="number" min="4" max="200" step="1" value={eraserBrushSize} onChange={(e) => onEraserBrushSizeChange(Math.max(4, Number(e.currentTarget.value) || 24))} /></label>
          )}
        </>
      )}

      {subView === "image-fx" && layer.kind === "image" && (
        <>
          <div className="dimension-fields">
            <label>Stroke color<input type="color" value={layer.strokeColor ?? "#ffffff"} onChange={(e) => onUpdate(layer.id, { strokeColor: e.currentTarget.value })} /></label>
            <label>Stroke width <span>px</span><input type="number" min="0" max="40" step="1" value={layer.strokeWidth ?? 0} onChange={(e) => onUpdate(layer.id, { strokeWidth: Math.max(0, Number(e.currentTarget.value) || 0) })} /></label>
          </div>
          <ShadowControls title="Drop shadow" shadow={layer.shadow} onChange={(shadow) => onUpdate(layer.id, { shadow })} />
          <label className="collage-check-control">
            <input type="checkbox" checked={Boolean(layer.emboss?.enabled)} onChange={(e) => onUpdate(layer.id, { emboss: { enabled: e.currentTarget.checked, angle: layer.emboss?.angle ?? 135, intensity: layer.emboss?.intensity ?? 60 } })} />
            Emboss relief
          </label>
          {layer.emboss?.enabled && (
            <div className="dimension-fields">
              <label>Angle <span>deg</span><input type="number" min="-180" max="180" step="5" value={layer.emboss.angle} onChange={(e) => onUpdate(layer.id, { emboss: { ...layer.emboss!, angle: Number(e.currentTarget.value) || 0 } })} /></label>
              <label>Intensity <span>%</span><input type="number" min="0" max="150" step="1" value={layer.emboss.intensity} onChange={(e) => onUpdate(layer.id, { emboss: { ...layer.emboss!, intensity: Math.max(0, Number(e.currentTarget.value) || 0) } })} /></label>
            </div>
          )}
          <label className="collage-check-control">
            <input type="checkbox" checked={Boolean(layer.reflection?.enabled)} onChange={(e) => onUpdate(layer.id, { reflection: { enabled: e.currentTarget.checked, offset: layer.reflection?.offset ?? 6, opacity: layer.reflection?.opacity ?? 35 } })} />
            Reflection
          </label>
        </>
      )}

      {subView === "image-perspective" && layer.kind === "image" && (
        <>
          <p className="resize-note">Drag the 4 orange corner handles on the canvas to warp perspective.</p>
          <div className="dimension-fields">
            <button type="button" className={stageMode === "perspective" ? "export-button" : "secondary-button"} onClick={() => onStageModeChange(stageMode === "perspective" ? "select" : "perspective")}>
              {stageMode === "perspective" ? "Done Perspective" : "Drag Corners on Canvas"}
            </button>
            <button type="button" className="secondary-button" onClick={() => onUpdate(layer.id, { perspective: { tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } } })}>
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  );
}
