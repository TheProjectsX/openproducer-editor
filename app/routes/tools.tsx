import type { Route } from "./+types/tools";
import { ToolDirectory } from "../components/tool-directory";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Choose a media workspace | OpenProducer Editor" }, { name: "description", content: "Choose the audio, video, or image workspace. Each page groups tools for one kind of media." }];
}

export default function Tools() { return <ToolDirectory />; }
