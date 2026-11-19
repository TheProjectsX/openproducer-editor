import { SVG_SHAPES } from "../types";

export function ShapesTab({
  shapeColor,
  projectId,
  ready,
  exporting,
  setShapeColor,
  onAddShapeOverlay,
}: {
  shapeColor: string;
  projectId: string;
  ready: boolean;
  exporting: boolean;
  setShapeColor: (color: string) => void;
  onAddShapeOverlay: (shapeId: string) => void;
}) {
  return (
    <>
      <div className="studio-bin-heading">
        <strong>Shapes</strong>
        <span>Vector overlays</span>
      </div>
      <label className="speed-field">
        Shape color
        <input type="color" value={shapeColor} onChange={(event) => setShapeColor(event.currentTarget.value)} />
      </label>
      <div className="studio-bin-grid">
        {SVG_SHAPES.map((shape) => (
          <button
            type="button"
            key={shape.id}
            className="bin-item studio-preset-tile"
            disabled={Boolean(projectId && !ready) || exporting}
            onClick={() => void onAddShapeOverlay(shape.id)}
            title={shape.label}
          >
            <span className="studio-asset-thumb studio-shape-preview-box">
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(shape.svg(shapeColor))}`}
                alt=""
                aria-hidden="true"
              />
            </span>
            <strong title={shape.label}>{shape.label}</strong>
          </button>
        ))}
      </div>
    </>
  );
}
