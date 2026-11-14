import type { Route } from "./+types/tools";
import { ToolDirectory } from "../components/tool-directory";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Audio, video, and image tools | Local Studio" }, { name: "description", content: "Explore private, browser-based tools for editing audio, video, and images on your device." }];
}

export default function Tools() { return <ToolDirectory />; }
