import test from "node:test";
import assert from "node:assert/strict";
import { evaluateClipKeyframes, evaluateClipTransition, upsertClipKeyframe } from "../app/lib/video-keyframes.ts";
import { migrateProjectRecord } from "../app/lib/project-store.ts";
import { createPcmWavHeader, encodeNormalizedPcm16, normalizationGain } from "../app/lib/audio-normalization.ts";
import { getClipLength } from "../app/lib/video-timing.ts";
import { createImageHistory, recordImageEdit, redoImageEdit, undoImageEdit } from "../app/lib/image-history.ts";
import { renderNaturalSpeedChunk, shouldUsePitchPreservingStretcher, PITCH_PRESERVE_RENDER_CHUNK_FRAMES } from "../app/lib/audio-speed.ts";
import { BungeeStretcher, Transport, compileBungee, instantiateBungee } from "bungee-web";
import { readFile } from "node:fs/promises";
import { createSpectralNoiseReductionJob } from "../app/lib/audio-denoise.ts";

const transform = (x) => ({ x, y: 0, scale: 1, rotation: 0, opacity: 1 });
const clip = (overrides = {}) => ({
  id: "clip-1", assetId: "asset-1", track: 0, start: 0, sourceStart: 0, sourceEnd: 4, speed: 1, volume: 1, muted: false,
  ...overrides,
});

test("keyframes hold nearest value outside the authored range", () => {
  const item = clip({ keyframes: [
    { time: 1, transform: transform(10), volume: 0.2 },
    { time: 3, transform: transform(30), volume: 0.8 },
  ] });
  assert.equal(evaluateClipKeyframes(item, 0).transform.x, 10);
  assert.equal(evaluateClipKeyframes(item, 4).transform.x, 30);
});

test("keyframes interpolate transforms and volume linearly", () => {
  const item = clip({ keyframes: [
    { time: 0, transform: transform(0), volume: 0 },
    { time: 2, transform: transform(20), volume: 1 },
  ] });
  assert.deepEqual(evaluateClipKeyframes(item, 1), { transform: transform(10), volume: 0.5 });
});

test("adding a keyframe at an existing time updates rather than duplicates it", () => {
  const frames = upsertClipKeyframe(clip({ keyframes: [{ time: 1, transform: transform(1), volume: 1 }] }), { time: 1.0005, transform: transform(7), volume: 0.5 });
  assert.equal(frames.length, 1);
  assert.equal(frames[0].transform.x, 7);
});

test("clip fades create bounded linear transition envelopes", () => {
  const item = clip({ transitions: { fadeIn: 1, fadeOut: 1 } });
  assert.equal(evaluateClipTransition(item, 0), 0);
  assert.equal(evaluateClipTransition(item, 0.5), 0.5);
  assert.equal(evaluateClipTransition(item, 2), 1);
  assert.equal(evaluateClipTransition(item, 3.5), 0.5);
  assert.equal(evaluateClipTransition(item, 4), 0);
});

test("custom clip speeds produce the expected timeline duration", () => {
  const item = clip({ sourceStart: 2, sourceEnd: 5.7, speed: 3.7 });
  assert.ok(Math.abs(getClipLength(item) - 1) < 1e-12);
  assert.ok(Math.abs(getClipLength({ ...item, speed: 0.1 }) - 37) < 1e-12);
  assert.equal(getClipLength({ ...item, speed: 16 }), 3.7 / 16);
  assert.equal(getClipLength({ ...item, speed: 0 }), 0);
  assert.equal(getClipLength({ ...item, speed: Number.NaN }), 0);
});

test("legacy audio projects migrate to the current editable project schema", () => {
  const migrated = migrateProjectRecord({ id: "p1", title: "Legacy", kind: "audio", createdAt: 1, updatedAt: 1 });
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.audioDocument?.version, 1);
  assert.equal(migrated.audioDocument?.pitchMode, "preserve");
});

test("image projects migrate to the schema that supports editable collage documents", () => {
  const migrated = migrateProjectRecord({ id: "p3", schemaVersion: 3, title: "Image", kind: "image", createdAt: 1, updatedAt: 1 });
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.collageDocument, undefined);
});

test("schema 4 source metadata survives immutable source-ID migration", () => {
  const migrated = migrateProjectRecord({ id: "p4", schemaVersion: 4, title: "Audio", kind: "audio", createdAt: 1, updatedAt: 1, assetName: "track.wav", assetType: "audio/wav" });
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.assetName, "track.wav");
  assert.equal(migrated.assetType, "audio/wav");
});

test("project migrations reject a future schema instead of overwriting it", () => {
  assert.throws(() => migrateProjectRecord({ id: "p2", schemaVersion: 99, title: "Future", kind: "image", createdAt: 1, updatedAt: 1 }), /cannot be opened/);
});

test("pitch-preserved 3.7× export renders its full duration and retains a 440 Hz tone", async () => {
  const sampleRate = 48_000;
  const sourceFrames = sampleRate * 4;
  const source = Float32Array.from({ length: sourceFrames }, (_, frame) => Math.sin(2 * Math.PI * 440 * frame / sampleRate) * 0.5);
  const wasmBytes = await readFile(new URL("../node_modules/bungee-web/dist/bungee.wasm", import.meta.url));
  const module = await compileBungee(wasmBytes);
  const wasm = await instantiateBungee(module);
  const stretcher = new BungeeStretcher(wasm, { sampleRate, channels: 2 });
  try {
    const speed = 3.7;
    const outputFrames = Math.ceil(sourceFrames / speed);
    const transport = new Transport(stretcher, sourceFrames);
    transport.setSource("tone", { left: source, right: source });
    transport.speed = speed;
    transport.play();
    const output = new Float32Array(outputFrames);
    for (let offset = 0; offset < outputFrames; offset += PITCH_PRESERVE_RENDER_CHUNK_FRAMES) {
      const length = Math.min(PITCH_PRESERVE_RENDER_CHUNK_FRAMES, outputFrames - offset);
      transport.render(output.subarray(offset, offset + length), new Float32Array(length), length);
    }
    let first = output.length, last = -1, crossings = 0, previous = 0;
    for (let index = 0; index < output.length; index++) {
      const sample = output[index];
      if (Math.abs(sample) > 0.003) { first = Math.min(first, index); last = index; }
      if (index > 0 && ((previous < 0 && sample >= 0) || (previous >= 0 && sample < 0))) crossings++;
      previous = sample;
    }
    const activeFrames = last - first;
    const frequency = crossings / (2 * (activeFrames / sampleRate));
    assert.ok(activeFrames >= outputFrames - 256, `expected about ${outputFrames} active frames, received ${activeFrames}`);
    assert.ok(Math.abs(frequency - 440) < 8, `expected pitch near 440 Hz, received ${frequency.toFixed(2)} Hz`);
    assert.equal(transport.stats.underruns, 0);
  } finally { stretcher.destroy(); }
});

test("spectral noise reduction attenuates profiled noise while retaining a tone", () => {
  const sampleRate = 48_000, frames = sampleRate * 2, source = new Float32Array(frames);
  let seed = 0x12345678;
  for (let frame = 0; frame < frames; frame++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = ((seed / 0x1_0000_0000) * 2 - 1) * 0.04;
    source[frame] = noise + (frame >= sampleRate / 2 ? Math.sin(2 * Math.PI * 440 * frame / sampleRate) * 0.25 : 0);
  }
  const job = createSpectralNoiseReductionJob(source, 0, sampleRate / 2, 80);
  while (!job.done) job.processNextFrame();
  const output = job.getOutput();
  const rms = (data, from, to) => Math.sqrt(data.slice(from, to).reduce((sum, value) => sum + value * value, 0) / (to - from));
  const sourceNoise = rms(source, sampleRate / 10, sampleRate * 4 / 10);
  const outputNoise = rms(output, sampleRate / 10, sampleRate * 4 / 10);
  const sourceTone = rms(source, sampleRate, sampleRate * 3 / 2);
  const outputTone = rms(output, sampleRate, sampleRate * 3 / 2);
  assert.ok(outputNoise < sourceNoise * 0.65, `expected noise to drop, got ${sourceNoise.toFixed(4)}→${outputNoise.toFixed(4)}`);
  assert.ok(outputTone > sourceTone * 0.8, `expected the tone to remain audible, got ${sourceTone.toFixed(4)}→${outputTone.toFixed(4)}`);
});

test("peak normalization gain reaches a custom dBFS target and leaves silence unchanged", () => {
  const gain = normalizationGain(0.5, -6);
  assert.ok(Math.abs(20 * Math.log10(0.5 * gain) + 6) < 1e-10);
  assert.equal(normalizationGain(0, -6), 1);
});

test("worker PCM encoder interleaves channels and clips samples to signed 16-bit", () => {
  const pcm = new Int16Array(encodeNormalizedPcm16([new Float32Array([-1, 0.5]), new Float32Array([1, -0.5])], 2));
  assert.deepEqual([...pcm], [-32768, 32767, 32767, -32768]);
  assert.throws(() => encodeNormalizedPcm16([new Float32Array(1), new Float32Array(2)], 1), /matching sample counts/);
});

test("PCM WAV header reflects sample rate, channel count, and sample byte length", () => {
  const view = new DataView(createPcmWavHeader(100, 2, 48_000));
  assert.equal(new TextDecoder().decode(new Uint8Array(view.buffer, 0, 4)), "RIFF");
  assert.equal(view.getUint32(24, true), 48_000);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(40, true), 400);
});

test("image edit history undoes and redoes settings and layers as snapshots", () => {
  const history = createImageHistory();
  const source = {};
  recordImageEdit(history, source, { width: 400, brightness: "100", layers: [] });
  recordImageEdit(history, source, { width: 300, brightness: "100", layers: [] });
  recordImageEdit(history, source, { width: 300, brightness: "125", layers: [{ id: "text" }] });
  assert.deepEqual(undoImageEdit(history), { width: 300, brightness: "100", layers: [] });
  assert.deepEqual(undoImageEdit(history), { width: 400, brightness: "100", layers: [] });
  assert.deepEqual(redoImageEdit(history), { width: 300, brightness: "100", layers: [] });
});

test("image edit history resets on source change and is bounded to 100 steps", () => {
  const history = createImageHistory();
  const firstSource = {};
  recordImageEdit(history, firstSource, { value: 0 });
  for (let value = 1; value <= 120; value++) recordImageEdit(history, firstSource, { value });
  assert.equal(history.undo.length, 100);
  recordImageEdit(history, {}, { value: 999 });
  assert.equal(history.undo.length, 0);
  assert.equal(undoImageEdit(history), null);
});

test("natural-pitch speed chunks linearly resample at the selected playback rate", () => {
  const output = renderNaturalSpeedChunk(new Float32Array([0, 10, 20, 30, 40]), new Float32Array([0, 20, 40, 60, 80]), 0.5, 1, 3);
  assert.deepEqual([...output.left], [5, 10, 15]);
  assert.deepEqual([...output.right], [10, 20, 30]);
});

test("pitch preservation skips time stretching at unity speed", () => {
  assert.equal(shouldUsePitchPreservingStretcher("preserve", 1), false);
  assert.equal(shouldUsePitchPreservingStretcher("preserve", 1 + 1e-7), false);
  assert.equal(shouldUsePitchPreservingStretcher("preserve", 1.5), true);
  assert.equal(shouldUsePitchPreservingStretcher("natural", 1.5), false);
});
