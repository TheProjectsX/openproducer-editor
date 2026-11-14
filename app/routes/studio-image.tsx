import type { Route } from "./+types/studio-image";
import { ImageResizeTool } from "./image-resize";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Image workspace | Local Studio" },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

export default function ImageStudio() {
  return <ImageResizeTool workspace />;
}
