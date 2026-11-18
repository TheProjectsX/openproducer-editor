import type { VideoTimelineAsset, VideoTimelineClip, VideoTimelineProject } from "./project-store";
import { evaluateClipKeyframes, evaluateClipTransition } from "./video-keyframes";
import { getClipLength } from "./video-timing";
import { imageClipGeometry } from "./video-image-layout";
export { getClipLength } from "./video-timing";

export type VideoMediaElements = { videos: Record<string, HTMLVideoElement>; images: Record<string, HTMLImageElement> };

export function drawVideoComposition(
  canvas: HTMLCanvasElement,
  timeline: VideoTimelineProject,
  time: number,
  media: VideoMediaElements,
  assets: VideoTimelineAsset[],
) {
  if (canvas.width !== timeline.width) canvas.width = timeline.width;
  if (canvas.height !== timeline.height) canvas.height = timeline.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot create a 2D canvas renderer.");
  context.fillStyle = timeline.backgroundColor || "#11131a"; context.fillRect(0, 0, canvas.width, canvas.height);
  const clips = timeline.clips.filter((clip) => clip.track >= 0 && !timeline.trackStates?.[clip.track]?.hidden && time >= clip.start && time < clip.start + getClipLength(clip)).sort((a, b) => a.track - b.track || a.start - b.start);
  for (const clip of clips) {
    const asset = assets.find((item) => item.id === clip.assetId);
    const clipTime = time - clip.start;
    const clipDuration = getClipLength(clip);
    const fadeIn = Math.max(0, Math.min(clipDuration, clip.transitions?.fadeIn ?? 0));
    const fadeOut = Math.max(0, Math.min(clipDuration, clip.transitions?.fadeOut ?? 0));
    const inType = clip.transitions?.inType ?? "fade";
    const inProgress = fadeIn > 0 && clipTime < fadeIn ? Math.max(0, Math.min(1, clipTime / fadeIn)) : 1;
    const outProgress = fadeOut > 0 && clipTime > clipDuration - fadeOut ? Math.max(0, Math.min(1, (clipDuration - clipTime) / fadeOut)) : 1;
    const transitionAlpha = inType === "fade" || inType === "zoom-in"
      ? evaluateClipTransition(clip, clipTime)
      : outProgress;
    const transitionScale = inType === "zoom-in" && inProgress < 1 ? 0.55 + 0.45 * inProgress : 1;
    const transitionOffsetX = inType === "slide-left" && inProgress < 1 ? (1 - inProgress) * canvas.width
      : inType === "slide-right" && inProgress < 1 ? -(1 - inProgress) * canvas.width : 0;
    const applyTransitionClip = () => {
      if (inProgress >= 1 || !inType.startsWith("wipe-")) return;
      context.beginPath();
      if (inType === "wipe-left") context.rect(0, 0, canvas.width * inProgress, canvas.height);
      else if (inType === "wipe-right") context.rect(canvas.width * (1 - inProgress), 0, canvas.width * inProgress, canvas.height);
      else if (inType === "wipe-up") context.rect(0, 0, canvas.width, canvas.height * inProgress);
      else if (inType === "wipe-down") context.rect(0, canvas.height * (1 - inProgress), canvas.width, canvas.height * inProgress);
      context.clip();
    };
    if (asset?.kind === "text" && asset.textSettings) {
      const transform = evaluateClipKeyframes(clip, clipTime).transform;
      const settings = asset.textSettings;
      const fontSize = Math.max(8, Math.min(512, settings.fontSize * transform.scale * transitionScale));
      const textCase = settings.textCase ?? (settings.uppercase ? "uppercase" : "none");
      const transformedText = textCase === "uppercase"
        ? settings.text.toUpperCase()
        : textCase === "lowercase"
          ? settings.text.toLowerCase()
          : textCase === "capitalize"
            ? settings.text.toLowerCase().replace(/\b\p{L}/gu, (char) => char.toUpperCase())
            : settings.text;
      const lines = transformedText.split("\n");
      const alpha = Math.max(0, Math.min(1, transform.opacity * transitionAlpha));
      context.save();
      applyTransitionClip();
      context.globalAlpha = alpha;
      context.globalCompositeOperation = clip.blendMode ?? "source-over";
      context.translate(canvas.width / 2 + transform.x + transitionOffsetX, canvas.height / 2 + transform.y);
      context.rotate(transform.rotation * Math.PI / 180);
      const fontStyle = settings.italic ? "italic " : "";
      const fontWeight = settings.bold === false ? "400" : "700";
      const fontFamily = settings.fontFamily || "system-ui, sans-serif";
      context.font = `${fontStyle}${fontWeight} ${fontSize}px ${fontFamily}`;
      if ("letterSpacing" in context) {
        (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(settings.letterSpacing ?? 0) * transform.scale}px`;
      }
      const align = settings.align ?? "center";
      context.textAlign = align; context.textBaseline = "middle";
      const lineHeight = fontSize * (settings.lineHeight ?? 1.2);
      const widest = Math.max(0, ...lines.map((line) => context.measureText(line).width));
      if (settings.showBackground) {
        const extraPad = Math.max(0, (settings.backgroundPadding ?? 0) * transform.scale);
        const bgX = -widest / 2 - fontSize * 0.35 - extraPad;
        const bgY = -lines.length * lineHeight / 2 - fontSize * 0.2 - extraPad;
        const bgW = widest + fontSize * 0.7 + extraPad * 2;
        const bgH = lines.length * lineHeight + fontSize * 0.4 + extraPad * 2;
        const radius = Math.max(0, Math.min(Math.min(bgW, bgH) / 2, (settings.backgroundRadius ?? 0) * transform.scale));
        context.save();
        context.globalAlpha = alpha * Math.max(0, Math.min(1, settings.backgroundOpacity ?? 1));
        context.fillStyle = settings.backgroundColor;
        if (radius > 0 && typeof context.roundRect === "function") {
          context.beginPath(); context.roundRect(bgX, bgY, bgW, bgH, radius); context.fill();
        } else {
          context.fillRect(bgX, bgY, bgW, bgH);
        }
        context.restore();
      }
      if (settings.shadow) {
        context.shadowColor = settings.shadowColor ?? "#000000";
        context.shadowBlur = Math.max(0, (settings.shadowBlur ?? 8) * transform.scale);
        context.shadowOffsetX = (settings.shadowOffsetX ?? 0) * transform.scale;
        context.shadowOffsetY = (settings.shadowOffsetY ?? 2) * transform.scale;
      }
      const textX = align === "left" ? -widest / 2 : align === "right" ? widest / 2 : 0;
      if ((settings.strokeWidth ?? 0) > 0) {
        context.strokeStyle = settings.strokeColor ?? "#000000";
        context.lineWidth = Math.max(1, (settings.strokeWidth ?? 0) * 2 * transform.scale);
        context.lineJoin = "round";
        lines.forEach((line, index) => context.strokeText(line, textX, (index - (lines.length - 1) / 2) * lineHeight));
      }
      context.fillStyle = settings.color;
      lines.forEach((line, index) => {
        const y = (index - (lines.length - 1) / 2) * lineHeight;
        context.fillText(line, textX, y);
        if (settings.underline && line.length > 0) {
          const lineWidth = context.measureText(line).width;
          const startX = align === "left" ? textX : align === "right" ? textX - lineWidth : textX - lineWidth / 2;
          const underlineY = y + fontSize * 0.48;
          context.save();
          context.strokeStyle = settings.color;
          context.lineWidth = Math.max(1, fontSize * 0.07);
          context.beginPath();
          context.moveTo(startX, underlineY);
          context.lineTo(startX + lineWidth, underlineY);
          context.stroke();
          context.restore();
        }
      });
      context.restore(); continue;
    }
    const source: CanvasImageSource | undefined = asset?.kind === "video" ? media.videos[clip.id] : media.images[clip.assetId];
    const width = source instanceof HTMLVideoElement ? source.videoWidth : source instanceof HTMLImageElement ? source.naturalWidth : 0;
    const height = source instanceof HTMLVideoElement ? source.videoHeight : source instanceof HTMLImageElement ? source.naturalHeight : 0;
    if (!source || width === 0 || height === 0 || (source instanceof HTMLVideoElement && source.readyState < 2)) continue;
    const fitScale = Math.min(canvas.width / width, canvas.height / height);
    const transform = evaluateClipKeyframes(clip, clipTime).transform;
    const imageGeometry = asset?.kind === "image" ? imageClipGeometry(width, height, canvas.width, canvas.height, clip.imageCrop, clip.imageSize, transform.scale) : null;
    const drawWidth = imageGeometry?.width ?? width * fitScale * transform.scale;
    const drawHeight = imageGeometry?.height ?? height * fitScale * transform.scale;
    const effects = clip.effects ?? { brightness: 100, contrast: 100, saturation: 100, grayscale: 0 };
    context.save();
    applyTransitionClip();
    context.globalAlpha = Math.max(0, Math.min(1, transform.opacity * transitionAlpha));
    context.globalCompositeOperation = clip.blendMode ?? "source-over";
    context.filter = `brightness(${effects.brightness}%) contrast(${effects.contrast}%) saturate(${effects.saturation}%) grayscale(${effects.grayscale}%) hue-rotate(${effects.hue ?? 0}deg) sepia(${effects.sepia ?? 0}%) blur(${effects.blur ?? 0}px)`;
    context.translate(canvas.width / 2 + transform.x + transitionOffsetX, canvas.height / 2 + transform.y);
    context.rotate(transform.rotation * Math.PI / 180);
    context.scale((transform.mirrorX ? -1 : 1) * transitionScale, (transform.mirrorY ? -1 : 1) * transitionScale);
    if (imageGeometry) context.drawImage(source, imageGeometry.source.x, imageGeometry.source.y, imageGeometry.source.width, imageGeometry.source.height, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    else context.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.restore();
  }
}
