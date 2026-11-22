import test from "node:test";
import assert from "node:assert/strict";
import { applyKeyframeEasing, evaluateAnimatedEffect, evaluateClipKeyframes } from "../app/lib/video-keyframes.ts";
import {
  buildImageToVideoTimeline,
  buildPresetKeyframes,
  resolveCanvasDimensions,
  snapImageOffsetToCanvas,
  syncSlideDurations,
} from "../app/lib/image-to-video.ts";

test("easing functions respect bounds and curve direction", () => {
  assert.equal(applyKeyframeEasing(0, "ease-in-out"), 0);
  assert.equal(applyKeyframeEasing(1, "ease-in-out"), 1);
  assert.ok(applyKeyframeEasing(0.25, "ease-in") < 0.25);
  assert.ok(applyKeyframeEasing(0.25, "ease-out") > 0.25);
  assert.equal(applyKeyframeEasing(0.5, "ease-in-out"), 0.5);
});

test("evaluateClipKeyframes applies keyframe easing when specified", () => {
  const clip = {
    id: "c1",
    assetId: "a1",
    track: 0,
    start: 0,
    sourceStart: 0,
    sourceEnd: 2,
    speed: 1,
    volume: 1,
    muted: false,
    keyframes: [
      { time: 0, transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }, volume: 1, easing: "linear" },
      { time: 2, transform: { x: 100, y: 0, scale: 1, rotation: 0, opacity: 1 }, volume: 1, easing: "ease-in" },
    ],
  };
  // At t=0.5s (ratio=0.25), ease-in yields 0.25^2 = 0.0625 -> x = 6.25
  assert.equal(evaluateClipKeyframes(clip, 0.5).transform.x, 6.25);
});

test("syncSlideDurations scales slides to exact total video duration", () => {
  const slides = [
    {
      id: "s1", name: "a.png", type: "image/png", size: 100, width: 800, height: 600,
      duration: 2, preset: "ken-burns-in", transitionType: "none", transitionDuration: 0,
      keyframes: buildPresetKeyframes("ken-burns-in", 2, 1280, 720),
    },
    {
      id: "s2", name: "b.png", type: "image/png", size: 100, width: 800, height: 600,
      duration: 4, preset: "pan-left", transitionType: "fade", transitionDuration: 0.5,
      keyframes: buildPresetKeyframes("pan-left", 4, 1280, 720),
    },
  ];
  const synced = syncSlideDurations(slides, "total", 9);
  const sum = synced.reduce((acc, s) => acc + s.duration, 0);
  assert.ok(Math.abs(sum - 9) < 1e-6);
  assert.equal(synced[0].duration, 3);
  assert.equal(synced[1].duration, 6);
  assert.equal(synced[0].keyframes[1].time, 3);
  assert.equal(synced[1].keyframes[1].time, 6);
});

test("resolveCanvasDimensions handles presets, original even-rounding, and custom dimensions", () => {
  assert.deepEqual(resolveCanvasDimensions("9:16", 0, 0), { width: 720, height: 1280 });
  assert.deepEqual(resolveCanvasDimensions("original", 0, 0, 1001, 501), { width: 1000, height: 500 });
  assert.deepEqual(resolveCanvasDimensions("custom", 1920, 1080), { width: 1920, height: 1080 });
});

test("buildImageToVideoTimeline sequences slides and loops optional audio to exact video duration", () => {
  const slides = [
    {
      id: "img1", name: "one.png", type: "image/png", size: 10, width: 1280, height: 720,
      duration: 4, preset: "ken-burns-in", transitionType: "none", transitionDuration: 0,
      keyframes: buildPresetKeyframes("ken-burns-in", 4, 1280, 720),
    },
    {
      id: "img2", name: "two.png", type: "image/png", size: 10, width: 1280, height: 720,
      duration: 6, preset: "fade-in-out", transitionType: "wipe-left", transitionDuration: 0.5,
      keyframes: buildPresetKeyframes("fade-in-out", 6, 1280, 720),
    },
  ];
  const { timeline, assets } = buildImageToVideoTimeline({
    slides,
    width: 1280,
    height: 720,
    aspectRatioMode: "16:9",
    backgroundColor: "#000000",
    fps: 30,
    playhead: 0,
    audio: {
      id: "aud1", name: "bg.mp3", type: "audio/mpeg", size: 500, duration: 4,
      volume: 0.8, fadeIn: 0.5, fadeOut: 1, loop: true,
    },
  });

  assert.equal(timeline.duration, 10);
  assert.equal(assets.length, 3);
  const visualClips = timeline.clips.filter((c) => c.track === 0);
  assert.equal(visualClips.length, 2);
  assert.equal(visualClips[0].start, 0);
  assert.equal(visualClips[1].start, 4);
  assert.equal(visualClips[1].transitions?.inType, "wipe-left");

  const audioClips = timeline.clips.filter((c) => c.track === -1);
  assert.equal(audioClips.length, 3); // 4s + 4s + 2s = 10s
  assert.equal(audioClips[0].transitions?.fadeIn, 0.5);
  assert.equal(audioClips[2].sourceEnd, 2);
  assert.equal(audioClips[2].transitions?.fadeOut, 1);
});

test("snapImageOffsetToCanvas snaps to canvas borders and center", () => {
  // 400x200 image on 1280x720 canvas: left border snap at x = 200 - 640 = -440
  const leftSnap = snapImageOffsetToCanvas({
    x: -435, y: 120, imageWidth: 400, imageHeight: 200, rotationDeg: 0,
    canvasWidth: 1280, canvasHeight: 720, threshold: 10,
  });
  assert.equal(leftSnap.x, -440);
  assert.equal(leftSnap.guideX, "left");
  assert.equal(leftSnap.guideY, null);

  // Bottom border snap at y = 360 - 100 = 260, center X snap at x = 0
  const bottomCenter = snapImageOffsetToCanvas({
    x: 4, y: 254, imageWidth: 400, imageHeight: 200, rotationDeg: 0,
    canvasWidth: 1280, canvasHeight: 720, threshold: 10,
  });
  assert.equal(bottomCenter.x, 0);
  assert.equal(bottomCenter.guideX, "center");
  assert.equal(bottomCenter.y, 260);
  assert.equal(bottomCenter.guideY, "bottom");
});

test("evaluateAnimatedEffect computes bounded effect animations and blur/flash decay", () => {
  const none = evaluateAnimatedEffect(undefined, 1, 4);
  assert.equal(none.scaleMultiplier, 1);
  assert.equal(none.extraBlurPx, 0);

  const blurStart = evaluateAnimatedEffect({ kind: "blur-in", intensity: 1 }, 0, 4);
  const blurEnd = evaluateAnimatedEffect({ kind: "blur-in", intensity: 1 }, 2, 4);
  assert.ok(blurStart.extraBlurPx > 10);
  assert.equal(blurEnd.extraBlurPx, 0);

  const pulse = evaluateAnimatedEffect({ kind: "pulse", intensity: 1 }, 0.5, 4);
  assert.ok(pulse.scaleMultiplier > 1);
});
