import type { Route } from "./+types/studio-video";
import VideoStudio from "../components/studio-video";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Video Studio | OpenProducer Editor" }, { name: "robots", content: "noindex,nofollow" }];
}

export default function VideoStudioRoute() {
  return <VideoStudio />;
}
