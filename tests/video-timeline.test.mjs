import assert from "node:assert/strict";
import test from "node:test";
import { canPlaceAssetOnTrack, canvasDimensionsForAspect, resolveTimelinePlacement, timelineContentWidth, timelineDropStart, timelineRulerOffset, timelineTimeAtPointer, timelineZoomScrollLeft, visibleTimelineTracks, zoomPixelsPerSecond } from "../app/lib/video-timeline.ts";

test("text clips can move on existing and new overlay lanes", () => {
  assert.equal(canPlaceAssetOnTrack("text", 1), true);
  assert.equal(canPlaceAssetOnTrack("text", 2), true);
  assert.equal(canPlaceAssetOnTrack("text", 0), false);
  assert.equal(canPlaceAssetOnTrack("text", -1), false);
  assert.equal(canPlaceAssetOnTrack("audio", -1), true);
  assert.equal(canPlaceAssetOnTrack("video", 0), true);
});

test("zoom keeps the hovered clip time at the pointer on a short timeline", () => {
  const pointerX = 254;
  const time = (pointerX - timelineRulerOffset()) / 60;
  const scrollLeft = timelineZoomScrollLeft(time, pointerX, 120);
  assert.equal(scrollLeft, 150);
  assert.equal(timelineTimeAtPointer(pointerX, 0, scrollLeft, 120, timelineRulerOffset()), time);
  assert.ok(timelineContentWidth(5, 120, 1262) - 1262 >= scrollLeft);
});

test("timeline lanes appear around the main lane as clips and drags require them", () => {
  assert.deepEqual(visibleTimelineTracks([]), [0]);
  assert.deepEqual(visibleTimelineTracks([], "audio"), [0]);
  assert.deepEqual(visibleTimelineTracks([{ track: -1 }]), [0, -1]);
  assert.deepEqual(visibleTimelineTracks([{ track: 0 }, { track: 2 }, { track: -2 }]), [2, 1, 0, -1, -2]);
  assert.deepEqual(visibleTimelineTracks([{ track: 0 }, { track: 1 }], "visual"), [2, 1, 0]);
});

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

test("original and preset canvas ratios fit without cropping", () => {
  assert.deepEqual(canvasDimensionsForAspect(16 / 9), { width: 1920, height: 1080 });
  assert.deepEqual(canvasDimensionsForAspect(9 / 16), { width: 1080, height: 1920 });
  assert.deepEqual(canvasDimensionsForAspect(4 / 3), { width: 1920, height: 1440 });
  assert.equal(canvasDimensionsForAspect(0), null);
});

test("Ctrl-wheel zoom changes timeline scale within readable bounds", () => {
  assert.equal(zoomPixelsPerSecond(60, -100), 67);
  assert.equal(zoomPixelsPerSecond(60, 100), 54);
  assert.equal(zoomPixelsPerSecond(160, -100), 160);
  assert.equal(zoomPixelsPerSecond(12, 100), 12);
});

test("magnetic placement joins neighboring edges and preserves open gaps", () => {
  const clips = [{ id: "first", start: 0, end: 8 }, { id: "second", start: 16, end: 24 }];
  assert.deepEqual(resolveTimelinePlacement(8.12, 8, clips, 0.2, true), { start: 8, shiftedStarts: {} });
  assert.deepEqual(resolveTimelinePlacement(10, 2, clips, 0.2, true), { start: 10, shiftedStarts: {} });
  assert.deepEqual(resolveTimelinePlacement(8.08, 8, [clips[0]], 0.2, true), { start: 8, shiftedStarts: {} });
});

test("dropping at an occupied edge opens room along the same track", () => {
  const clips = [{ id: "first", start: 0, end: 4 }, { id: "second", start: 4, end: 8 }, { id: "third", start: 8, end: 12 }];
  assert.deepEqual(resolveTimelinePlacement(4.08, 3, clips, 0.2, true), { start: 4, shiftedStarts: { second: 7, third: 11 } });
  assert.deepEqual(resolveTimelinePlacement(1, 2, clips, 0.2, true), { start: 0, shiftedStarts: { first: 2, second: 6, third: 10 } });
  assert.deepEqual(resolveTimelinePlacement(5, 3, clips, 0.2, false), { start: 4, shiftedStarts: { second: 7, third: 11 } });
  assert.deepEqual(resolveTimelinePlacement(12.5, 3, clips, 0.2, false), { start: 12.5, shiftedStarts: {} });
});
