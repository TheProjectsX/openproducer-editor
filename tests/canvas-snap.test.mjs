import test from "node:test";
import assert from "node:assert/strict";
import { snapAxisCoordinate, snapLayerMove } from "../app/lib/canvas-snap.ts";

test("snapLayerMove snaps to canvas borders, center, and sibling layer edges", () => {
  const toLeft = snapLayerMove({ x: 6, y: 120, width: 200, height: 100 }, 1200, 900);
  assert.equal(toLeft.x, 0);
  assert.equal(toLeft.guideX, 0);

  const toCenter = snapLayerMove({ x: 495, y: 394, width: 200, height: 100 }, 1200, 900);
  assert.equal(toCenter.x, 500);
  assert.equal(toCenter.y, 400);
  assert.equal(toCenter.guideX, 600);
  assert.equal(toCenter.guideY, 450);

  const sibling = { x: 300, y: 200, width: 150, height: 120 };
  const toSibling = snapLayerMove({ x: 454, y: 205, width: 100, height: 100 }, 1200, 900, [sibling]);
  assert.equal(toSibling.x, 450);
  assert.equal(toSibling.y, 200);
});

test("snapAxisCoordinate snaps resize edges within threshold and leaves distant values untouched", () => {
  const snapped = snapAxisCoordinate(596, 1200);
  assert.equal(snapped.value, 600);
  assert.equal(snapped.guide, 600);

  const untouched = snapAxisCoordinate(720, 1200);
  assert.equal(untouched.value, 720);
  assert.equal(untouched.guide, null);
});
