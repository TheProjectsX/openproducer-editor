import { ImageResizeTool } from "./image-resize";

export function meta() {
  return [
    { title: "Downscale image | OpenProducer Editor" },
    { name: "description", content: "Scale down a local image by a custom percentage or reduction factor while preserving its aspect ratio." },
    { name: "robots", content: "index,follow" },
  ];
}

export default function ImageDownscale() {
  return <ImageResizeTool downscale />;
}
