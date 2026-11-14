import type { Route } from "./+types/tools-video";
import { ToolDirectory } from "../components/tool-directory";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Video editing tools | Local Studio" }, { name: "description", content: "Browse local video trimming, speed, audio replacement, and multitrack editing tools." }];
}

export default function VideoTools() { return <ToolDirectory category="video" />; }
