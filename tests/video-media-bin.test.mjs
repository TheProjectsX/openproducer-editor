import assert from "node:assert/strict";
import test from "node:test";
import { isMediaAsset, sortMediaAssets, updateMediaSelection } from "../app/lib/video-media-bin.ts";

const assets = [
  { id: "old", name: "Zebra.mp4", kind: "video", duration: 12, importedAt: 100, fileModifiedAt: 1000 },
  { id: "image", name: "Apple.png", kind: "image", duration: 3600, importedAt: 200, fileModifiedAt: 500 },
  { id: "audio", name: "Beta.wav", kind: "audio", duration: 5, importedAt: 300, fileModifiedAt: 1500 },
  { id: "legacy", name: "Gamma.mp4", kind: "video", duration: 8 },
];
const ids = (items) => items.map((asset) => asset.id);

test("media filters retain only the requested kind", () => {
  assert.deepEqual(ids(sortMediaAssets(assets, "video", "name", "asc")), ["legacy", "old"]);
  assert.deepEqual(ids(sortMediaAssets(assets, "audio", "name", "asc")), ["audio"]);
});

test("text titles stay in the project but never appear in Media", () => {
  const title = { id: "title", name: "Default title", kind: "text", duration: 5, importedAt: 400 };
  const projectAssets = [...assets, title];
  assert.deepEqual(ids(sortMediaAssets(projectAssets, "all", "imported", "asc")), ["legacy", "old", "image", "audio"]);
  assert.deepEqual(ids(sortMediaAssets(projectAssets, "image", "name", "asc")), ["image"]);
  assert.equal(projectAssets.filter(isMediaAsset).length, assets.length);
  assert.equal(projectAssets.at(-1), title);
});

test("media sorting supports both directions and leaves the project order intact", () => {
  assert.deepEqual(ids(sortMediaAssets(assets, "all", "name", "asc")), ["image", "audio", "legacy", "old"]);
  assert.deepEqual(ids(sortMediaAssets(assets, "all", "name", "desc")), ["old", "legacy", "audio", "image"]);
  assert.deepEqual(ids(sortMediaAssets(assets, "all", "imported", "desc")), ["audio", "image", "old", "legacy"]);
  assert.deepEqual(ids(sortMediaAssets(assets, "all", "fileDate", "asc")), ["image", "old", "audio", "legacy"]);
  assert.deepEqual(ids(sortMediaAssets(assets, "all", "duration", "asc")), ["audio", "legacy", "old", "image"]);
  assert.deepEqual(ids(assets), ["old", "image", "audio", "legacy"]);
});

test("media selection supports single, additive, and visible range selection", () => {
  const visible = ["image", "audio", "legacy", "old"];
  assert.deepEqual(updateMediaSelection(visible, [], null, "image", false, false), ["image"]);
  assert.deepEqual(updateMediaSelection(visible, ["image"], "image", "old", true, false), visible);
  assert.deepEqual(updateMediaSelection(visible, ["image", "audio"], "audio", "audio", false, true), ["image"]);
  assert.deepEqual(updateMediaSelection(visible, ["image"], "image", "hidden", false, false), ["image"]);
});
