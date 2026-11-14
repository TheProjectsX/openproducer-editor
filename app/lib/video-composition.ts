import type { VideoTimelineAsset, VideoTimelineClip, VideoTimelineProject } from "./project-store";

export type VideoMediaElements = { videos: Record<string, HTMLVideoElement>; images: Record<string, HTMLImageElement> };

export function drawVideoComposition(
  canvas: HTMLCanvasElement,
  timeline: VideoTimelineProject,
  time: number,
  media: VideoMediaElements,
  assets: VideoTimelineAsset[],
) {
  canvas.width = timeline.width; canvas.height = timeline.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot create a 2D canvas renderer.");
  context.fillStyle = "#11131a"; context.fillRect(0, 0, canvas.width, canvas.height);
  const clips = timeline.clips.filter((clip) => clip.track >= 0 && time >= clip.start && time < clip.start + getClipLength(clip)).sort((a, b) => a.track - b.track);
  for (const clip of clips) {
    const asset = assets.find((item) => item.id === clip.assetId);
    const source: CanvasImageSource | undefined = asset?.kind === "video" ? media.videos[clip.id] : media.images[clip.assetId];
    const width = source instanceof HTMLVideoElement ? source.videoWidth : source instanceof HTMLImageElement ? source.naturalWidth : 0;
    const height = source instanceof HTMLVideoElement ? source.videoHeight : source instanceof HTMLImageElement ? source.naturalHeight : 0;
    if (!source || width === 0 || height === 0 || (source instanceof HTMLVideoElement && source.readyState < 2)) continue;
    const scale = Math.min(canvas.width / width, canvas.height / height);
    const drawWidth = width * scale; const drawHeight = height * scale;
    context.drawImage(source, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
  }
}

export function getClipLength(clip: VideoTimelineClip) {
  return Math.max(0, (clip.sourceEnd - clip.sourceStart) / clip.speed);
}
