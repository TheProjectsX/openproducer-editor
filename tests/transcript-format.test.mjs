import test from "node:test";
import assert from "node:assert/strict";
import { cleanTranscriptText, formatTranscript } from "../app/lib/transcript-format.ts";

const baseOptions = {
  style: "clean",
  stripFillers: true,
  includeTimestamps: false,
  timestampFormat: "mm:ss",
  paragraphPauseSeconds: 1.5,
  casing: "preserve",
  maxLineWidth: 0,
};

const sampleSegments = [
  { start: 0, end: 2.2, text: "Um, hello everyone and welcome to local studio." },
  { start: 2.5, end: 5.0, text: "Uh, everything runs privately on your device." },
  { start: 7.5, end: 10.4, text: "You can export subtitles and clean transcripts." },
];

test("cleanTranscriptText strips filler words, applies find/replace, and sets casing", () => {
  const cleaned = cleanTranscriptText("Um, hello   uh world.", {
    stripFillers: true,
    casing: "upper",
    findText: "world",
    replaceText: "studio",
  });
  assert.equal(cleaned, "HELLO STUDIO.");
});

test("formatTranscript groups paragraphs by pause threshold and formats SRT/VTT/MD/JSON", () => {
  const txt = formatTranscript(sampleSegments, "txt", baseOptions);
  assert.equal(
    txt,
    "hello everyone and welcome to local studio. everything runs privately on your device.\n\nYou can export subtitles and clean transcripts.",
  );

  const srt = formatTranscript(sampleSegments, "srt", { ...baseOptions, maxLineWidth: 32 });
  assert.ok(srt.includes("1\n00:00:00,000 --> 00:00:02,200\n"));
  assert.ok(srt.includes("\n\n2\n00:00:02,500 --> 00:00:05,000\n"));

  const vtt = formatTranscript(sampleSegments, "vtt", baseOptions);
  assert.ok(vtt.startsWith("WEBVTT\n\n00:00:00.000 --> 00:00:02.200\n"));

  const md = formatTranscript(sampleSegments, "md", { ...baseOptions, style: "bullets", includeTimestamps: true });
  assert.ok(md.includes("- [00:00] hello everyone"));

  const json = JSON.parse(formatTranscript(sampleSegments, "json", baseOptions));
  assert.equal(json.segments.length, 3);

  const csv = formatTranscript(sampleSegments, "csv", baseOptions);
  assert.ok(csv.startsWith("Index,Start,End,Text\n1,00:00:00.000,00:00:02.200,"));
});

test("resegmentTranscript splits segments by word limit and sentence boundaries", () => {
  const longSegments = [
    { start: 0, end: 10, text: "First sentence has five words. Second sentence also has five words." },
  ];
  const srt = formatTranscript(longSegments, "srt", {
    ...baseOptions,
    maxWordsPerSegment: 4,
    maxDurationSeconds: 10,
    maxCharsPerSegment: 80,
    sentenceAware: true,
  });
  assert.ok(srt.includes("1\n00:00:00,000 --> "));
  assert.ok(srt.includes("\n\n4\n"));
});
