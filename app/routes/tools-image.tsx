import type { Route } from "./+types/tools-image";
import { ToolDirectory } from "../components/tool-directory";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Image editing tools | Local Studio" }, { name: "description", content: "Browse local image resize, crop, enlargement, collage, and layer editing tools." }];
}

export default function ImageTools() { return <ToolDirectory category="image" />; }
