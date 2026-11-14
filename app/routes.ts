import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("tools/image/resize", "routes/image-resize.tsx"),
  route("tools/audio/trim", "routes/audio-trim.tsx"),
  route("tools/audio/speed", "routes/audio-speed.tsx"),
  route("tools/audio/merge", "routes/audio-merge.tsx"),
  route("tools/audio/split", "routes/audio-split.tsx"),
  route("tools/video/trim", "routes/video-trim.tsx"),
  route("tools/video/extract-audio", "routes/video-extract-audio.tsx"),
  route("projects", "routes/projects.tsx"),
  route("studio/image", "routes/studio-image.tsx"),
] satisfies RouteConfig;
