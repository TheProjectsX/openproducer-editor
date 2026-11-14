import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("tools/image/resize", "routes/image-resize.tsx"),
  route("tools/audio/trim", "routes/audio-trim.tsx"),
  route("tools/audio/speed", "routes/audio-speed.tsx"),
  route("tools/video/trim", "routes/video-trim.tsx"),
] satisfies RouteConfig;
