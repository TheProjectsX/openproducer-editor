import assert from "node:assert/strict";
import test from "node:test";
import { applyEraseColorToPixels, parseHexRgb } from "../app/lib/image-editor/effects.ts";
import {
  applyHomography,
  getPerspectiveBounds,
  hasNonZeroPerspective,
  solveHomographyMatrix,
} from "../app/lib/image-editor/perspective.ts";
import { applyTextCase, measureTrackedTextWidth, wrapTextLines } from "../app/lib/image-editor/text-layout.ts";
import { serializeEditorDocument, snapshotKey, validateCanvasDimensions } from "../app/lib/image-editor/types.ts";
import { migrateProjectRecord } from "../app/lib/project-store.ts";

test("validateCanvasDimensions enforces integer bounds and pixel limit", () => {
  assert.deepEqual(validateCanvasDimensions("1200", "900"), { valid: true, width: 1200, height: 900 });
  assert.equal(validateCanvasDimensions("0", "900").valid, false);
  assert.equal(validateCanvasDimensions("1200.5", "900").valid, false);
  assert.equal(validateCanvasDimensions("32769", "100").valid, false);
  assert.equal(validateCanvasDimensions("20000", "10000").valid, false);
});

test("wrapTextLines, applyTextCase, and measureTrackedTextWidth work deterministically", () => {
  const measure = (s) => s.length * 10;
  const lines = wrapTextLines(measure, "hello world from local studio\nnext line", 120);
  assert.deepEqual(lines, ["hello world", "from local", "studio", "next line"]);
  assert.equal(applyTextCase("hello world", "uppercase"), "HELLO WORLD");
  assert.equal(applyTextCase("hello world", "capitalize"), "Hello World");
  assert.equal(measureTrackedTextWidth((c) => c.length * 10, "ABC", 5), 40);
});

test("applyEraseColorToPixels removes matching color within tolerance and preserves distant colors", () => {
  assert.deepEqual(parseHexRgb("#ffffff"), { r: 255, g: 255, b: 255 });
  const pixels = new Uint8ClampedArray([
    255, 255, 255, 255, // exact white -> alpha 0
    250, 250, 250, 255, // within tolerance -> alpha 0
    10, 20, 30, 255,    // dark blue -> untouched (alpha 255)
  ]);
  applyEraseColorToPixels(pixels, "#ffffff", 20, 10);
  assert.equal(pixels[3], 0);
  assert.equal(pixels[7], 0);
  assert.equal(pixels[11], 255);
});

test("solveHomographyMatrix and applyHomography map source quad to destination quad", () => {
  const src = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  const dst = [
    { x: 10, y: 5 },
    { x: 110, y: 15 },
    { x: 95, y: 105 },
    { x: 0, y: 95 },
  ];
  const H = solveHomographyMatrix(src, dst);
  assert.ok(H);
  const mapped = applyHomography(H, 100, 0);
  assert.ok(Math.abs(mapped.x - 110) < 1e-6);
  assert.ok(Math.abs(mapped.y - 15) < 1e-6);

  const zeroOffsets = { tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } };
  assert.equal(hasNonZeroPerspective(zeroOffsets), false);
  const skewed = { ...zeroOffsets, tr: { x: 20, y: -10 } };
  assert.equal(hasNonZeroPerspective(skewed), true);
  const bounds = getPerspectiveBounds(100, 100, skewed);
  assert.equal(bounds.outW, 120);
  assert.equal(bounds.outH, 110);
});

test("serializeEditorDocument strips File objects and collects asset entries including custom fonts", () => {
  const baseFile = new File(["base"], "photo.png", { type: "image/png" });
  const overlayFile = new File(["layer"], "logo.png", { type: "image/png" });
  const fontFile = new File(["font"], "custom.ttf", { type: "font/ttf" });
  const snapshot = {
    width: "1080",
    height: "1080",
    background: "#ffffff",
    backgroundFill: { kind: "linear", from: "#111827", to: "#4f7cff", angle: 45 },
    baseImage: { id: "base-1", file: baseFile, width: 1080, height: 1080 },
    baseBrightness: "100",
    baseContrast: "100",
    baseSaturation: "100",
    baseRotation: "0",
    baseFlipHorizontal: false,
    layers: [
      {
        id: "img-1",
        kind: "image",
        name: "logo.png",
        file: overlayFile,
        x: 10,
        y: 20,
        width: 200,
        height: 100,
        rotation: "0",
        opacity: "100",
        flipHorizontal: false,
        brightness: "100",
        contrast: "100",
        saturation: "100",
        visible: true,
      },
      {
        id: "txt-1",
        kind: "text",
        name: "Text",
        text: "Headline",
        fontFamily: "system-ui, sans-serif",
        fontSize: 48,
        bold: true,
        italic: false,
        fill: "#111827",
        x: 50,
        y: 60,
        width: 300,
        height: 60,
        rotation: "0",
        opacity: "100",
        visible: true,
      },
    ],
  };

  const { document, files } = serializeEditorDocument(snapshot, "webp", "0.9", [
    { id: "font-1", family: "Custom", fileName: "custom.ttf", file: fontFile },
  ]);
  assert.equal(document.version, 2);
  assert.equal(document.baseImage?.id, "base-1");
  assert.equal(document.customFonts?.length, 1);
  assert.equal(files.length, 3);
  assert.deepEqual(files.map((f) => f.id), ["base-1", "font-1", "img-1"]);
  assert.equal("file" in document.layers[0], false);
  assert.equal(snapshotKey(snapshot).includes("Headline"), true);
});

test("migrateProjectRecord preserves imageEditorDocument", () => {
  const project = {
    schemaVersion: 1,
    id: "proj-ie-1",
    title: "Poster",
    kind: "image",
    createdAt: 1000,
    updatedAt: 2000,
    imageEditorDocument: {
      version: 2,
      width: "1080",
      height: "1080",
      background: "#111827",
      baseImage: null,
      baseBrightness: "100",
      baseContrast: "100",
      baseSaturation: "100",
      baseRotation: "0",
      baseFlipHorizontal: false,
      layers: [],
    },
  };
  const migrated = migrateProjectRecord(project);
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.imageEditorDocument?.width, "1080");
});
