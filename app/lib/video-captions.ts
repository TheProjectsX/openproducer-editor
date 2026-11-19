export type SubtitleCue = { start: number; end: number; text: string };
import type { VideoTimelineAsset, VideoTimelineClip } from "./project-store";

const MAX_SUBTITLE_BYTES = 1024 * 1024;
const MAX_CUES = 2000;

export function isSubtitleFile(name: string) {
  return /\.(srt|vtt)$/i.test(name);
}

function parseTimecode(value: string) {
  const match = /^(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (minutes >= 60 || seconds >= 60) return null;
  return hours * 3600 + minutes * 60 + seconds + Number(match[4].padEnd(3, "0")) / 1000;
}

function plainCueText(value: string) {
  return value.replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:\d+|x[\da-f]+);/gi, (entity) => {
      const named: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " " };
      const key = entity.toLowerCase();
      if (named[key]) return named[key];
      const hex = key.startsWith("&#x");
      const code = Number.parseInt(key.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }).trim();
}

export function parseSubtitleText(content: string, filename: string): SubtitleCue[] {
  if (!isSubtitleFile(filename)) throw new Error("Choose an .srt or .vtt subtitle file.");
  if (new TextEncoder().encode(content).byteLength > MAX_SUBTITLE_BYTES) throw new Error("Subtitle files must be 1 MiB or smaller.");
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const isVtt = /\.vtt$/i.test(filename);
  if (isVtt && !/^WEBVTT(?:[ \t].*)?(?:\n|$)/.test(normalized)) throw new Error("This VTT file is missing its WEBVTT header.");
  const blocks = normalized.split(/\n[ \t]*\n+/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim());
    if (!lines.length || /^(WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) continue;
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const timing = /^\s*(\S+)\s*-->\s*(\S+)(?:\s+.*)?$/.exec(lines[timingIndex]);
    if (!timing) throw new Error(`Invalid subtitle timing in ${filename}.`);
    const start = parseTimecode(timing[1]);
    const end = parseTimecode(timing[2]);
    if (start === null || end === null || end <= start || end > 24 * 3600) throw new Error(`Invalid subtitle timing in ${filename}.`);
    const text = plainCueText(lines.slice(timingIndex + 1).join("\n"));
    if (!text) continue;
    if (text.length > 1000) throw new Error("A subtitle cue is too long to display. Shorten the cue and try again.");
    cues.push({ start, end, text });
    if (cues.length > MAX_CUES) throw new Error("Subtitle files can contain at most 2,000 cues.");
  }
  if (!cues.length) throw new Error(`No timed subtitle cues were found in ${filename}.`);
  return cues.sort((a, b) => a.start - b.start || a.end - b.end);
}

export function matchingSidecar(videoName: string, subtitleName: string) {
  if (!isSubtitleFile(subtitleName)) return false;
  const videoStem = videoName.replace(/\.[^.]+$/, "").toLowerCase();
  const subtitleStem = subtitleName.replace(/\.(srt|vtt)$/i, "").toLowerCase();
  return subtitleStem === videoStem || subtitleStem.startsWith(`${videoStem}.`);
}

export function createCaptionClips(cues: readonly SubtitleCue[], sourceName: string, timelineStart: number, track: number, canvasHeight: number, makeId: () => string, mediaDuration = Number.POSITIVE_INFINITY) {
  const assets: VideoTimelineAsset[] = [];
  const clips: VideoTimelineClip[] = [];
  const fontSize = Math.max(24, Math.min(72, Math.round(canvasHeight * 0.04)));
  for (const [index, cue] of cues.entries()) {
    const end = Math.min(cue.end, mediaDuration);
    if (cue.start >= end) continue;
    const id = makeId();
    assets.push({
      id, name: `${sourceName} · ${index + 1}`, type: "text/vtt", size: 0, duration: 3600, kind: "text",
      textSettings: { text: cue.text, fontSize, color: "#ffffff", backgroundColor: "#000000", showBackground: false, align: "center", strokeColor: "#000000", strokeWidth: 3, shadow: true, shadowColor: "#000000", shadowBlur: 5 },
    });
    clips.push({ id: makeId(), assetId: id, track, start: Math.max(0, timelineStart + cue.start), sourceStart: 0, sourceEnd: end - cue.start, speed: 1, volume: 1, muted: false,
      transform: { x: 0, y: Math.round(canvasHeight * 0.37), scale: 1, rotation: 0, opacity: 1 } });
  }
  return { assets, clips };
}
