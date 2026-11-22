import test from "node:test";
import assert from "node:assert/strict";
import {
    applyGapDividerDrag,
    applyOverlappingEdgeDrag,
    cellsToNormalized,
    deleteCellWithAutoResize,
    detectGapDividers,
    detectOverlappingCellEdges,
    findCollagePreset,
    presetCellsToRects,
    presetsForCategory,
} from "../app/lib/collage-presets.ts";

test("featured category has 19 fixed presets with valid normalized cells", () => {
    const featured = presetsForCategory("featured");
    assert.equal(featured.length, 19);
    for (const preset of featured) {
        assert.ok(preset.cells.length > 0, `${preset.id} has cells`);
        for (const cell of preset.cells) {
            assert.ok(cell.x >= 0 && cell.y >= 0 && cell.w > 0 && cell.h > 0);
            assert.ok(cell.x + cell.w <= 1.0001 && cell.y + cell.h <= 1.0001);
        }
    }
});

test("grid category has 30 fixed presets with valid normalized cells", () => {
    const gridPresets = presetsForCategory("grid");
    assert.equal(gridPresets.length, 30);
    for (const preset of gridPresets) {
        assert.ok(preset.cells.length > 0, `${preset.id} has cells`);
        for (const cell of preset.cells) {
            assert.ok(cell.x >= 0 && cell.y >= 0 && cell.w > 0 && cell.h > 0);
            assert.ok(cell.x + cell.w <= 1.0001 && cell.y + cell.h <= 1.0001);
        }
    }
});

test("big-photo-wrap category has 24 fixed presets with valid normalized cells", () => {
  const wrapPresets = presetsForCategory("big-photo-wrap");
  assert.equal(wrapPresets.length, 24);
  for (const preset of wrapPresets) {
    assert.ok(preset.cells.length > 0, `${preset.id} has cells`);
    for (const cell of preset.cells) {
      assert.ok(cell.x >= 0 && cell.y >= 0 && cell.w > 0 && cell.h > 0);
      assert.ok(cell.x + cell.w <= 1.0001 && cell.y + cell.h <= 1.0001);
    }
  }
});

test("wide category has 29 fixed presets with valid normalized cells", () => {
  const widePresets = presetsForCategory("wide");
  assert.equal(widePresets.length, 29);
  for (const preset of widePresets) {
    assert.ok(preset.cells.length > 0, `${preset.id} has cells`);
    for (const cell of preset.cells) {
      assert.ok(cell.x >= 0 && cell.y >= 0 && cell.w > 0 && cell.h > 0);
      assert.ok(cell.x + cell.w <= 1.0001 && cell.y + cell.h <= 1.0001);
    }
  }
});

test("tall category has 17 fixed presets with valid normalized cells", () => {
  const tallPresets = presetsForCategory("tall");
  assert.equal(tallPresets.length, 17);
  for (const preset of tallPresets) {
    assert.ok(preset.cells.length > 0, `${preset.id} has cells`);
    for (const cell of preset.cells) {
      assert.ok(cell.x >= 0 && cell.y >= 0 && cell.w > 0 && cell.h > 0);
      assert.ok(cell.x + cell.w <= 1.0001 && cell.y + cell.h <= 1.0001);
    }
  }
});

test("square category has 19 fixed presets with valid normalized cells", () => {
  const squarePresets = presetsForCategory("square");
  assert.equal(squarePresets.length, 19);
  for (const preset of squarePresets) {
    assert.ok(preset.cells.length > 0, `${preset.id} has cells`);
    for (const cell of preset.cells) {
      assert.ok(cell.x >= 0 && cell.y >= 0 && cell.w > 0 && cell.h > 0);
      assert.ok(cell.x + cell.w <= 1.0001 && cell.y + cell.h <= 1.0001);
    }
  }
});

test("shapes category has 13 fixed presets with valid normalized cells", () => {
  const shapePresets = presetsForCategory("shapes");
  assert.equal(shapePresets.length, 13);
  for (const preset of shapePresets) {
    assert.ok(preset.cells.length > 0, `${preset.id} has cells`);
    for (const cell of preset.cells) {
      assert.ok(cell.x >= 0 && cell.y >= 0 && cell.w > 0 && cell.h > 0);
      assert.ok(cell.x + cell.w <= 1.0001 && cell.y + cell.h <= 1.0001);
    }
  }
});

test("instagram category has 33 fixed presets with valid normalized cells", () => {
  const instaPresets = presetsForCategory("instagram");
  assert.equal(instaPresets.length, 33);
  for (const preset of instaPresets) {
    assert.ok(preset.cells.length > 0, `${preset.id} has cells`);
    for (const cell of preset.cells) {
      assert.ok(cell.x >= 0 && cell.y >= 0 && cell.w > 0 && cell.h > 0);
      assert.ok(cell.x + cell.w <= 1.0001 && cell.y + cell.h <= 1.0001);
    }
  }
});

test("facebook-cover category has 27 fixed presets with valid normalized cells", () => {
  const fbPresets = presetsForCategory("facebook-cover");
  assert.equal(fbPresets.length, 27);
  for (const preset of fbPresets) {
    assert.ok(preset.cells.length > 0, `${preset.id} has cells`);
    for (const cell of preset.cells) {
      assert.ok(cell.x >= 0 && cell.y >= 0 && cell.w > 0 && cell.h > 0);
      assert.ok(cell.x + cell.w <= 1.0001 && cell.y + cell.h <= 1.0001);
    }
  }
});

test("pinterest category has 28 fixed presets with valid normalized cells", () => {
  const pinPresets = presetsForCategory("pinterest");
  assert.equal(pinPresets.length, 28);
  for (const preset of pinPresets) {
    assert.ok(preset.cells.length > 0, `${preset.id} has cells`);
    for (const cell of preset.cells) {
      assert.ok(cell.x >= 0 && cell.y >= 0 && cell.w > 0 && cell.h > 0);
      assert.ok(cell.x + cell.w <= 1.0001 && cell.y + cell.h <= 1.0001);
    }
  }
});

test("presetCellsToRects converts normalized cells into pixel rectangles with outer and inner gap", () => {
    const preset = findCollagePreset("featured-05");
    assert.ok(preset);
    const rects = presetCellsToRects(preset, 1000, 800, 10);
    assert.equal(rects.length, 3);
    assert.equal(rects[0].x, 10);
    assert.equal(rects[0].y, 10);
    assert.equal(rects[0].width, 980);
});

test("detectGapDividers and applyGapDividerDrag resize adjacent rows and columns cleanly", () => {
    const preset = findCollagePreset("grid-01"); // 3x4 grid
    assert.ok(preset);
    const dividers = detectGapDividers(preset.cells);
    const vertical = dividers.find((d) => d.orientation === "vertical");
    const horizontal = dividers.find((d) => d.orientation === "horizontal");
    assert.ok(vertical);
    assert.ok(horizontal);
    const resizedV = applyGapDividerDrag(preset.cells, vertical, 0.4);
    assert.ok(Math.abs(resizedV[0].w - 0.4) < 1e-6);
    assert.ok(Math.abs(resizedV[1].x - 0.4) < 1e-6);
    assert.ok(Math.abs(resizedV[1].w - (2 / 3 - 0.4)) < 1e-6);
    const resizedH = applyGapDividerDrag(resizedV, horizontal, 0.35);
    assert.ok(Math.abs(resizedH[0].h - 0.35) < 1e-6);
    assert.ok(Math.abs(resizedH[3].y - 0.35) < 1e-6);
    assert.ok(Math.abs(resizedH[3].h - (0.5 - 0.35)) < 1e-6);
});

test("cellsToNormalized round-trips pixel rects back to normalized coordinates", () => {
    const preset = findCollagePreset("featured-05");
    assert.ok(preset);
    const rects = presetCellsToRects(preset, 1000, 800, 12);
    const normalized = cellsToNormalized(rects, 1000, 800, 12);
    assert.equal(normalized.length, preset.cells.length);
    for (let i = 0; i < normalized.length; i++) {
        assert.ok(Math.abs(normalized[i].x - preset.cells[i].x) < 1e-6);
        assert.ok(Math.abs(normalized[i].y - preset.cells[i].y) < 1e-6);
        assert.ok(Math.abs(normalized[i].w - preset.cells[i].w) < 1e-6);
        assert.ok(Math.abs(normalized[i].h - preset.cells[i].h) < 1e-6);
    }
});

test("detectOverlappingCellEdges and applyOverlappingEdgeDrag resize the enlarged center cell", () => {
    const preset = findCollagePreset("featured-11");
    assert.ok(preset);
    const handles = detectOverlappingCellEdges(preset.cells);
    assert.equal(handles.length, 4);
    const left = handles.find((h) => h.edge === "left");
    const bottom = handles.find((h) => h.edge === "bottom");
    assert.ok(left && bottom);
    const origRight = preset.cells[8].x + preset.cells[8].w;
    const origTop = preset.cells[8].y;
    const resizedLeft = applyOverlappingEdgeDrag(preset.cells, left, 0.2);
    assert.ok(Math.abs(resizedLeft[8].x - 0.2) < 1e-6);
    assert.ok(Math.abs(resizedLeft[8].w - (origRight - 0.2)) < 1e-6);
    const resizedBottom = applyOverlappingEdgeDrag(resizedLeft, bottom, 0.85);
    assert.ok(Math.abs(resizedBottom[8].h - (0.85 - origTop)) < 1e-6);
});

test("deleteCellWithAutoResize stretches neighbors when removing middle cell of a 3-cell column or row", () => {
    const col3 = [
        { x: 0, y: 0, w: 1, h: 1 / 3 },
        { x: 0, y: 1 / 3, w: 1, h: 1 / 3 },
        { x: 0, y: 2 / 3, w: 1, h: 1 / 3 },
    ];
    const afterColDelete = deleteCellWithAutoResize(col3, 1, true);
    assert.equal(afterColDelete.length, 2);
    assert.ok(Math.abs(afterColDelete[0].h - 0.5) < 1e-6);
    assert.ok(Math.abs(afterColDelete[1].y - 0.5) < 1e-6);
    assert.ok(Math.abs(afterColDelete[1].h - 0.5) < 1e-6);

    const row3 = [
        { x: 0, y: 0, w: 1 / 3, h: 1 },
        { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
        { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ];
    const afterRowDelete = deleteCellWithAutoResize(row3, 1, true);
    assert.equal(afterRowDelete.length, 2);
    assert.ok(Math.abs(afterRowDelete[0].w - 0.5) < 1e-6);
    assert.ok(Math.abs(afterRowDelete[1].x - 0.5) < 1e-6);
    assert.ok(Math.abs(afterRowDelete[1].w - 0.5) < 1e-6);

    const withoutAutoResize = deleteCellWithAutoResize(col3, 1, false);
    assert.equal(withoutAutoResize.length, 2);
    assert.ok(Math.abs(withoutAutoResize[0].h - 1 / 3) < 1e-6);
});
