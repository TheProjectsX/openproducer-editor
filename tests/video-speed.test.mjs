import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseVideoSpeedOutputConfig,
  computeRetimedDuration,
  computeSpeedForTargetDuration,
  isValidVideoSpeed,
  shouldIncludeRetimedSample,
} from "../app/lib/video-speed-math.ts";

test("isValidVideoSpeed accepts custom rates in 0.1x-16x and rejects out-of-range values", () => {
  assert.equal(isValidVideoSpeed(0.1), true);
  assert.equal(isValidVideoSpeed(1.375), true);
  assert.equal(isValidVideoSpeed(16), true);
  assert.equal(isValidVideoSpeed(0.09), false);
  assert.equal(isValidVideoSpeed(16.1), false);
  assert.equal(isValidVideoSpeed(Number.NaN), false);
});

test("computeRetimedDuration and computeSpeedForTargetDuration stay consistent", () => {
  assert.equal(computeRetimedDuration(10, 2), 5);
  assert.equal(computeRetimedDuration(10, 0.5), 20);
  assert.equal(computeSpeedForTargetDuration(10, 4), 2.5);
  assert.equal(computeSpeedForTargetDuration(10, 0.1), 16);
  assert.equal(computeSpeedForTargetDuration(10, 200), 0.1);
});

test("shouldIncludeRetimedSample caps extreme speedups at 60 fps while keeping normal frames", () => {
  assert.equal(shouldIncludeRetimedSample(0, null, 60), true);
  assert.equal(shouldIncludeRetimedSample(0.005, 0, 60), false);
  assert.equal(shouldIncludeRetimedSample(1 / 60, 0, 60), true);
  assert.equal(shouldIncludeRetimedSample(0.033, 0, 60), true);
});

test("chooseVideoSpeedOutputConfig prefers MP4 in auto mode and falls back to WebM only when needed", () => {
  assert.deepEqual(
    chooseVideoSpeedOutputConfig("auto", { mp4Video: true, mp4Audio: true, webmVideoCodec: "vp9", webmAudio: true }),
    { format: "mp4", videoCodec: "avc", audioCodec: "aac" }
  );
  assert.deepEqual(
    chooseVideoSpeedOutputConfig("auto", { mp4Video: false, mp4Audio: true, webmVideoCodec: "vp9", webmAudio: true }),
    { format: "webm", videoCodec: "vp9", audioCodec: "opus" }
  );
  assert.throws(
    () => chooseVideoSpeedOutputConfig("mp4", { mp4Video: false, mp4Audio: true, webmVideoCodec: "vp9", webmAudio: true }),
    /MP4/
  );
});
