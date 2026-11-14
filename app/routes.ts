import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("tools/image/resize", "routes/image-resize.tsx"),
  route("tools/image/upscale", "routes/image-upscale.tsx"),
  route("tools/image/collage", "routes/image-collage.tsx"),
  route("tools/image/crop", "routes/image-crop.tsx"),
  route("tools/audio/trim", "routes/audio-trim.tsx"),
  route("tools/audio/speed", "routes/audio-speed.tsx"),
  route("tools/audio/merge", "routes/audio-merge.tsx"),
  route("tools/audio/split", "routes/audio-split.tsx"),
  route("tools/audio/noise-gate", "routes/audio-noise-gate.tsx"),
  route("tools/video/trim", "routes/video-trim.tsx"),
  route("tools/video/extract-audio", "routes/video-extract-audio.tsx"),
  route("projects", "routes/projects.tsx"),
  route("studio/image", "routes/studio-image.tsx"),
] satisfies RouteConfig;
