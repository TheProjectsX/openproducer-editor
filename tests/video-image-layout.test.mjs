import assert from "node:assert/strict";
import test from "node:test";
import { imageClipGeometry } from "../app/lib/video-image-layout.ts";

test("image crop keeps the source intact and supports independent output dimensions", () => {
  const crop = { left: 0.1, top: 0.25, right: 0.2, bottom: 0.25 };
  const layout = imageClipGeometry(400, 200, 1920, 1080, crop, { width: 300, height: 300 });
  assert.deepEqual(layout.source, { x: 40, y: 50, width: 280, height: 100 });
  assert.equal(layout.width, 300);
  assert.equal(layout.height, 300);
  assert.deepEqual(crop, { left: 0.1, top: 0.25, right: 0.2, bottom: 0.25 });
});

test("image crop defaults to contained source sizing and never reaches an empty rectangle", () => {
  const layout = imageClipGeometry(400, 200, 1920, 1080, { left: 0.2, top: 0, right: 0.2, bottom: 0 });
  assert.equal(layout.width, 1152);
  assert.equal(layout.height, 960);
  const extreme = imageClipGeometry(400, 200, 1920, 1080, { left: 0.99, top: 0.99, right: 0.99, bottom: 0.99 });
  assert.ok(extreme.source.width >= 1);
  assert.ok(extreme.source.height >= 1);
});
