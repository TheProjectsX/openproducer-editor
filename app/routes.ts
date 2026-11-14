import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("tools/image/resize", "routes/image-resize.tsx"),
] satisfies RouteConfig;
