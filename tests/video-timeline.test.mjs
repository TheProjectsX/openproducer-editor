import assert from "node:assert/strict";
import test from "node:test";
import { timelineDropStart, timelineRulerOffset, timelineTimeAtPointer } from "../app/lib/video-timeline.ts";

test("timeline pointer positions account for horizontal scrolling", () => {
  assert.equal(timelineTimeAtPointer(360, 120, 0, 60), 4);
  assert.equal(timelineTimeAtPointer(160, 120, 300, 60), 5 + 2 / 3);
});

test("ruler positions account for the track label gutter", () => {
  const gutter = timelineRulerOffset();
  assert.equal(timelineTimeAtPointer(224, 120, 300, 60, gutter), 5);
  assert.equal(timelineTimeAtPointer(120, 120, 0, 60, gutter), 0);
});

test("invalid timeline scale safely returns the start", () => {
  assert.equal(timelineTimeAtPointer(360, 120, 0, 0), 0);
  assert.equal(timelineTimeAtPointer(360, 120, 0, Number.NaN), 0);
});

test("clip drops preserve the pointer's grab offset within the clip", () => {
  assert.equal(timelineDropStart(5, 120, 60), 3);
  assert.equal(timelineDropStart(1, 120, 60), 0);
  assert.equal(timelineDropStart(5, Number.NaN, 60), 5);
});
