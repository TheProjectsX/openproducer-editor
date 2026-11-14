import type { VideoTimelineAsset, VideoTimelineClip, VideoTimelineProject } from "./project-store";
import { evaluateClipKeyframes } from "./video-keyframes";

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
    const clipTime = time - clip.start;
    const clipDuration = getClipLength(clip);
    const fadeIn = Math.max(0, Math.min(clipDuration, clip.transitions?.fadeIn ?? 0));
    const fadeOut = Math.max(0, Math.min(clipDuration, clip.transitions?.fadeOut ?? 0));
    const fadeInAlpha = fadeIn > 0 ? Math.min(1, clipTime / fadeIn) : 1;
    const fadeOutAlpha = fadeOut > 0 ? Math.min(1, (clipDuration - clipTime) / fadeOut) : 1;
    const transitionAlpha = Math.min(fadeInAlpha, fadeOutAlpha);
    if (asset?.kind === "text" && asset.textSettings) {
      const transform = evaluateClipKeyframes(clip, clipTime).transform;
      const settings = asset.textSettings;
      const fontSize = Math.max(8, Math.min(512, settings.fontSize * transform.scale));
      const lines = settings.text.split("\n");
      context.save(); context.globalAlpha = Math.max(0, Math.min(1, transform.opacity * transitionAlpha));
      context.translate(canvas.width / 2 + transform.x, canvas.height / 2 + transform.y);
      context.rotate(transform.rotation * Math.PI / 180);
      context.font = `700 ${fontSize}px system-ui, sans-serif`; context.textAlign = "center"; context.textBaseline = "middle";
      const lineHeight = fontSize * 1.2; const widest = Math.max(0, ...lines.map((line) => context.measureText(line).width));
      if (settings.showBackground) { context.fillStyle = settings.backgroundColor; context.fillRect(-widest / 2 - fontSize * 0.35, -lines.length * lineHeight / 2 - fontSize * 0.2, widest + fontSize * 0.7, lines.length * lineHeight + fontSize * 0.4); }
      context.fillStyle = settings.color;
      lines.forEach((line, index) => context.fillText(line, 0, (index - (lines.length - 1) / 2) * lineHeight));
      context.restore(); continue;
    }
    const source: CanvasImageSource | undefined = asset?.kind === "video" ? media.videos[clip.id] : media.images[clip.assetId];
    const width = source instanceof HTMLVideoElement ? source.videoWidth : source instanceof HTMLImageElement ? source.naturalWidth : 0;
    const height = source instanceof HTMLVideoElement ? source.videoHeight : source instanceof HTMLImageElement ? source.naturalHeight : 0;
    if (!source || width === 0 || height === 0 || (source instanceof HTMLVideoElement && source.readyState < 2)) continue;
    const fitScale = Math.min(canvas.width / width, canvas.height / height);
    const transform = evaluateClipKeyframes(clip, clipTime).transform;
    const drawWidth = width * fitScale * transform.scale; const drawHeight = height * fitScale * transform.scale;
    context.save();
    context.globalAlpha = Math.max(0, Math.min(1, transform.opacity * transitionAlpha));
    context.translate(canvas.width / 2 + transform.x, canvas.height / 2 + transform.y);
    context.rotate(transform.rotation * Math.PI / 180);
    context.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.restore();
  }
}

export function getClipLength(clip: VideoTimelineClip) {
  return Math.max(0, (clip.sourceEnd - clip.sourceStart) / clip.speed);
}
