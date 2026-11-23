import { useState } from "react";
import type { CanvasOverlayEffects, FillStyle } from "../../lib/image-editor/types";
import { FillStyleControl } from "./fill-style-control";

type EffectsSubView = null | "gradient" | "vignette" | "noise" | "stripes" | "base" | "export";

type CanvasEffectsPanelProps = {
  hasBaseImage: boolean;
  baseBrightness: string;
  baseContrast: string;
  baseSaturation: string;
  baseRotation: string;
  baseFlipHorizontal: boolean;
  onBaseChange: (patch: {
    baseBrightness?: string;
    baseContrast?: string;
    baseSaturation?: string;
    baseRotation?: string;
    baseFlipHorizontal?: boolean;
  }) => void;
  background: string;
  backgroundFill: FillStyle | null;
  onBackgroundFillChange: (solid: string, fill: FillStyle) => void;
  overlays: CanvasOverlayEffects;
  onOverlaysChange: (next: CanvasOverlayEffects) => void;
  showGrid: boolean;
  onShowGridChange: (next: boolean) => void;
  exportFormat: "png" | "jpeg" | "webp";
  onExportFormatChange: (fmt: "png" | "jpeg" | "webp") => void;
  jpegQuality: string;
  onJpegQualityChange: (q: string) => void;
};

function MenuRow({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="be-menu-item" onClick={onClick}>
      <span>{label}</span>
      {active && <span className="be-menu-dot" aria-label="Active" />}
    </button>
  );
}

/** BeFunky-style drill-down panel for canvas-wide overlays, base image adjustments, and export format. */
export function CanvasEffectsPanel({
  hasBaseImage,
  baseBrightness,
  baseContrast,
  baseSaturation,
  baseRotation,
  baseFlipHorizontal,
  onBaseChange,
  background,
  backgroundFill,
  onBackgroundFillChange,
  overlays,
  onOverlaysChange,
  showGrid,
  onShowGridChange,
  exportFormat,
  onExportFormatChange,
  jpegQuality,
  onJpegQualityChange,
}: CanvasEffectsPanelProps) {
  const [subView, setSubView] = useState<EffectsSubView>(null);

  if (subView === null) {
    return (
      <section className="collage-sidebar-section">
        <label className="collage-check-control">
          <input type="checkbox" checked={showGrid} onChange={(e) => onShowGridChange(e.currentTarget.checked)} />
          Show alignment grid (8×8)
        </label>
        <div className="be-menu-list">
          {background !== "transparent" && (
            <MenuRow label="Background Gradient" active={Boolean(backgroundFill && backgroundFill.kind !== "solid")} onClick={() => setSubView("gradient")} />
          )}
          <MenuRow label="Vignette" active={overlays.vignette.enabled} onClick={() => setSubView("vignette")} />
          <MenuRow label="Film Grain / Noise" active={overlays.noise.enabled} onClick={() => setSubView("noise")} />
          <MenuRow label="Stripes Overlay" active={overlays.stripes.enabled} onClick={() => setSubView("stripes")} />
          <MenuRow label="Base Image Adjustments" active={hasBaseImage} onClick={() => setSubView("base")} />
          <MenuRow label={`Export Format (${exportFormat.toUpperCase()})`} onClick={() => setSubView("export")} />
        </div>
      </section>
    );
  }

  const TITLES: Record<Exclude<EffectsSubView, null>, string> = {
    gradient: "Background Gradient",
    vignette: "Vignette",
    noise: "Film Grain / Noise",
    stripes: "Stripes Overlay",
    base: "Base Image Adjustments",
    export: "Export Format & Quality",
  };

  return (
    <section className="collage-sidebar-section">
      <div className="be-subpanel-header">
        <button type="button" className="be-back-btn" onClick={() => setSubView(null)} aria-label="Back to effects">←</button>
        <strong>{TITLES[subView]}</strong>
      </div>

      {subView === "gradient" && background !== "transparent" && (
        <FillStyleControl
          label="Canvas background"
          solidColor={background}
          fillStyle={backgroundFill}
          onChange={onBackgroundFillChange}
        />
      )}

      {subView === "vignette" && (
        <>
          <label className="collage-check-control">
            <input type="checkbox" checked={overlays.vignette.enabled} onChange={(e) => onOverlaysChange({ ...overlays, vignette: { ...overlays.vignette, enabled: e.currentTarget.checked } })} />
            Enable Vignette
          </label>
          {overlays.vignette.enabled && (
            <div className="dimension-fields">
              <label>Intensity <span>%</span><input type="number" min="0" max="100" step="1" value={overlays.vignette.intensity} onChange={(e) => onOverlaysChange({ ...overlays, vignette: { ...overlays.vignette, intensity: Number(e.currentTarget.value) || 0 } })} /></label>
              <label>Radius <span>%</span><input type="number" min="5" max="95" step="1" value={overlays.vignette.radius} onChange={(e) => onOverlaysChange({ ...overlays, vignette: { ...overlays.vignette, radius: Number(e.currentTarget.value) || 70 } })} /></label>
            </div>
          )}
        </>
      )}

      {subView === "noise" && (
        <>
          <label className="collage-check-control">
            <input type="checkbox" checked={overlays.noise.enabled} onChange={(e) => onOverlaysChange({ ...overlays, noise: { ...overlays.noise, enabled: e.currentTarget.checked } })} />
            Enable Film Grain / Noise
          </label>
          {overlays.noise.enabled && (
            <label>Amount <span>1–100</span><input type="number" min="1" max="100" step="1" value={overlays.noise.amount} onChange={(e) => onOverlaysChange({ ...overlays, noise: { ...overlays.noise, amount: Number(e.currentTarget.value) || 18 } })} /></label>
          )}
        </>
      )}

      {subView === "stripes" && (
        <>
          <label className="collage-check-control">
            <input type="checkbox" checked={overlays.stripes.enabled} onChange={(e) => onOverlaysChange({ ...overlays, stripes: { ...overlays.stripes, enabled: e.currentTarget.checked } })} />
            Enable Stripes Overlay
          </label>
          {overlays.stripes.enabled && (
            <>
              <div className="dimension-fields">
                <label>Spacing <span>px</span><input type="number" min="4" max="256" step="1" value={overlays.stripes.spacing} onChange={(e) => onOverlaysChange({ ...overlays, stripes: { ...overlays.stripes, spacing: Number(e.currentTarget.value) || 24 } })} /></label>
                <label>Thickness <span>px</span><input type="number" min="1" max="128" step="1" value={overlays.stripes.thickness} onChange={(e) => onOverlaysChange({ ...overlays, stripes: { ...overlays.stripes, thickness: Number(e.currentTarget.value) || 4 } })} /></label>
              </div>
              <div className="dimension-fields">
                <label>Opacity <span>%</span><input type="number" min="0" max="100" step="1" value={overlays.stripes.opacity} onChange={(e) => onOverlaysChange({ ...overlays, stripes: { ...overlays.stripes, opacity: Number(e.currentTarget.value) || 20 } })} /></label>
                <label>Angle <span>deg</span><input type="number" min="-180" max="180" step="1" value={overlays.stripes.angle} onChange={(e) => onOverlaysChange({ ...overlays, stripes: { ...overlays.stripes, angle: Number(e.currentTarget.value) || 0 } })} /></label>
              </div>
              <label className="collage-custom-color">Stripe color<input type="color" value={overlays.stripes.color} onChange={(e) => onOverlaysChange({ ...overlays, stripes: { ...overlays.stripes, color: e.currentTarget.value } })} /></label>
            </>
          )}
        </>
      )}

      {subView === "base" && (
        hasBaseImage ? (
          <>
            <label>Brightness <span>0–300%</span><input type="number" min="0" max="300" step="any" value={baseBrightness} onChange={(e) => onBaseChange({ baseBrightness: e.currentTarget.value })} /></label>
            <label>Contrast <span>0–300%</span><input type="number" min="0" max="300" step="any" value={baseContrast} onChange={(e) => onBaseChange({ baseContrast: e.currentTarget.value })} /></label>
            <label>Saturation <span>0–300%</span><input type="number" min="0" max="300" step="any" value={baseSaturation} onChange={(e) => onBaseChange({ baseSaturation: e.currentTarget.value })} /></label>
            <label>Rotation <span>−180–180°</span><input type="number" min="-180" max="180" step="any" value={baseRotation} onChange={(e) => onBaseChange({ baseRotation: e.currentTarget.value })} /></label>
            <label className="collage-check-control"><input type="checkbox" checked={baseFlipHorizontal} onChange={(e) => onBaseChange({ baseFlipHorizontal: e.currentTarget.checked })} />Flip horizontally</label>
          </>
        ) : (
          <p className="resize-note">Insert a base image in Canvas first to adjust its brightness, contrast, or rotation.</p>
        )
      )}

      {subView === "export" && (
        <>
          <label className="ratio-field">
            Export format
            <select value={exportFormat} onChange={(e) => onExportFormatChange(e.currentTarget.value as "png" | "jpeg" | "webp")}>
              <option value="png">PNG (lossless, transparency)</option>
              <option value="jpeg">JPEG (white background)</option>
              <option value="webp">WebP (lossy/transparency)</option>
            </select>
          </label>
          {(exportFormat === "jpeg" || exportFormat === "webp") && (
            <label>Quality <span>0–1</span><input type="number" min="0" max="1" step="any" value={jpegQuality} onChange={(e) => onJpegQualityChange(e.currentTarget.value)} /></label>
          )}
        </>
      )}
    </section>
  );
}
