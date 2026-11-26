import type { VideoAspectRatioMode, VideoClipTransform, VideoImageCrop, VideoTextSettings, VideoTimelineAsset, VideoTimelineClip, VideoTimelineProject } from "../../lib/project-store";
import type { imageClipGeometry } from "../../lib/video-image-layout";

export const EMPTY: VideoTimelineProject = {
  version: 1,
  width: 1920,
  height: 1080,
  aspectRatioMode: "original",
  fps: 30,
  duration: 0,
  playhead: 0,
  assets: [],
  clips: [],
};

export const ASPECT_RATIOS: { label: string; value: VideoAspectRatioMode; ratio?: number }[] = [
  { label: "Original", value: "original" },
  { label: "Custom", value: "custom" },
  { label: "16:9", value: "16:9", ratio: 16 / 9 },
  { label: "4:3", value: "4:3", ratio: 4 / 3 },
  { label: "2.35:1", value: "2.35:1", ratio: 2.35 },
  { label: "2:1", value: "2:1", ratio: 2 },
  { label: "1.85:1", value: "1.85:1", ratio: 1.85 },
  { label: "9:16", value: "9:16", ratio: 9 / 16 },
  { label: "3:4", value: "3:4", ratio: 3 / 4 },
  { label: "1:1", value: "1:1", ratio: 1 },
];

export const MAX_ASSET_BYTES = 256 * 1024 * 1024;

export const IDENTITY_TRANSFORM: VideoClipTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

export type PreviewOverlayBox = { width: number; height: number; left: number; top: number; fit: number };

export type PreviewOverlayItem =
  | { kind: "text"; clip: VideoTimelineClip; asset: VideoTimelineAsset; transform: VideoClipTransform; box: PreviewOverlayBox }
  | { kind: "image"; clip: VideoTimelineClip; asset: VideoTimelineAsset; transform: VideoClipTransform; box: PreviewOverlayBox; imageGeometry: ReturnType<typeof imageClipGeometry> }
  | { kind: "video"; clip: VideoTimelineClip; asset: VideoTimelineAsset; transform: VideoClipTransform; box: PreviewOverlayBox };

export const TEXT_PRESETS: { id: string; label: string; preview: string; settings: VideoTextSettings; transform?: Partial<VideoClipTransform> }[] = [
  { id: "default", label: "Default title", preview: "Your title", settings: { text: "Your title", fontSize: 72, color: "#ffffff", backgroundColor: "#172033", showBackground: false } },
  { id: "lower-third", label: "Lower third", preview: "Name · Role", settings: { text: "Speaker Name\nRole or Title", fontSize: 42, color: "#f3f7fc", backgroundColor: "#0e1b2e", showBackground: true, align: "left", backgroundRadius: 12, backgroundOpacity: 0.86 }, transform: { x: -340, y: 310 } },
  { id: "bold-caption", label: "Bold caption", preview: "BOLD CAPTION", settings: { text: "BOLD CAPTION", fontSize: 64, color: "#ffe14d", backgroundColor: "#000000", showBackground: false, fontFamily: "Impact, sans-serif", strokeColor: "#000000", strokeWidth: 4, shadow: true, shadowColor: "#000000", shadowBlur: 10 }, transform: { y: 260 } },
  { id: "subtitle-bar", label: "Subtitle bar", preview: "Subtitle bar", settings: { text: "Subtitle text here", fontSize: 38, color: "#ffffff", backgroundColor: "#000000", showBackground: true, backgroundRadius: 6, backgroundOpacity: 0.72 }, transform: { y: 360 } },
  { id: "neon", label: "Neon glow", preview: "NEON GLOW", settings: { text: "NEON GLOW", fontSize: 78, color: "#6ef7ff", backgroundColor: "#000000", showBackground: false, fontFamily: "Impact, sans-serif", shadow: true, shadowColor: "#00b7ff", shadowBlur: 22 } },
  { id: "minimal-tag", label: "Minimal corner tag", preview: "TAG", settings: { text: "OPENPRODUCER EDITOR", fontSize: 28, color: "#dce8f5", backgroundColor: "#142033", showBackground: true, fontFamily: "'Courier New', monospace", backgroundRadius: 6, backgroundOpacity: 0.65 }, transform: { x: -460, y: -360 } },
];

export const SVG_SHAPES: { id: string; label: string; svg: (color: string) => string }[] = [
  { id: "rect", label: "Rectangle", svg: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320" viewBox="0 0 512 320"><rect x="16" y="16" width="480" height="288" fill="${c}"/></svg>` },
  { id: "pill", label: "Rounded pill", svg: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="220" viewBox="0 0 512 220"><rect x="16" y="16" width="480" height="188" rx="94" fill="${c}"/></svg>` },
  { id: "circle", label: "Circle", svg: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360"><circle cx="180" cy="180" r="164" fill="${c}"/></svg>` },
  { id: "arrow", label: "Arrow right", svg: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="260" viewBox="0 0 512 260"><path d="M24 96h310V32l154 98-154 98v-64H24z" fill="${c}"/></svg>` },
  { id: "badge", label: "Callout badge", svg: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="280" viewBox="0 0 420 280"><path d="M36 20h348a20 20 0 0 1 20 20v160a20 20 0 0 1-20 20H150l-58 46 14-46H36a20 20 0 0 1-20-20V40a20 20 0 0 1 20-20z" fill="${c}"/></svg>` },
  { id: "frame", label: "Outline frame", svg: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320" viewBox="0 0 512 320"><rect x="18" y="18" width="476" height="284" rx="20" fill="none" stroke="${c}" stroke-width="20"/></svg>` },
];
