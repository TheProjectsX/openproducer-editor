import type { Route } from "./+types/tools-audio";
import { ToolDirectory } from "../components/tool-directory";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Audio editing tools | Local Studio" }, { name: "description", content: "Browse local audio trimming, splitting, merging, speed, volume, normalization, and noise tools." }];
}

export default function AudioTools() { return <ToolDirectory category="audio" />; }
