import assert from "node:assert/strict";
import test from "node:test";
import { createCaptionClips, matchingSidecar, parseSubtitleText } from "../app/lib/video-captions.ts";

test("SRT cues keep their timing and turn subtitle markup into display text", () => {
  const cues = parseSubtitleText("\uFEFF1\r\n00:00:01,250 --> 00:00:02,500\r\n<b>Hello</b> &amp; welcome\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,125\r\nSecond line\r\n", "scene.srt");
  assert.deepEqual(cues, [
    { start: 1.25, end: 2.5, text: "Hello & welcome" },
    { start: 3, end: 4.125, text: "Second line" },
  ]);
});

test("VTT cues accept identifiers, settings, and minute timecodes", () => {
  const cues = parseSubtitleText("WEBVTT\n\nopening\n00:01.000 --> 00:02.250 align:start\nFirst line\nSecond line\n\nNOTE editor note\nignored\n\n00:03.000 --> 00:04.000\nNext", "scene.vtt");
  assert.deepEqual(cues, [
    { start: 1, end: 2.25, text: "First line\nSecond line" },
    { start: 3, end: 4, text: "Next" },
  ]);
});

test("subtitle import rejects invalid timing and empty files", () => {
  assert.throws(() => parseSubtitleText("1\n00:00:03,000 --> 00:00:02,000\nBackwards", "bad.srt"), /Invalid subtitle timing/);
  assert.throws(() => parseSubtitleText("WEBVTT\n\nNOTE no cues", "empty.vtt"), /No timed subtitle cues/);
  assert.throws(() => parseSubtitleText("00:00:01,000 --> 00:00:02,000\nHello", "bad.txt"), /Choose an .srt or .vtt/);
});

test("matching sidecars are identified and explicitly placed cues use timeline time", () => {
  assert.equal(matchingSidecar("Scene.MP4", "scene.en.srt"), true);
  assert.equal(matchingSidecar("Scene.MP4", "scene.vtt"), true);
  assert.equal(matchingSidecar("Scene.MP4", "other.srt"), false);
  let id = 0;
  const { assets, clips } = createCaptionClips([{ start: 1.25, end: 2.5, text: "Hello" }], "scene.en.srt", 7, 2, 1080, () => String(++id));
  assert.equal(assets[0].textSettings.text, "Hello");
  assert.equal(clips[0].assetId, assets[0].id);
  assert.deepEqual({ track: clips[0].track, start: clips[0].start, duration: clips[0].sourceEnd }, { track: 2, start: 8.25, duration: 1.25 });
  const bounded = createCaptionClips([{ start: 1, end: 9, text: "Long" }, { start: 5, end: 6, text: "Outside" }], "scene.srt", 7, 2, 1080, () => String(++id), 4);
  assert.equal(bounded.clips.length, 1);
  assert.equal(bounded.clips[0].sourceEnd, 3);
});
