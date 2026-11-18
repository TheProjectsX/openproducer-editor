import type { VideoImageCrop, VideoImageSize } from "./project-store";

export const EMPTY_IMAGE_CROP: VideoImageCrop = { left: 0, top: 0, right: 0, bottom: 0 };

const finite = (value: number | undefined, fallback: number) => Number.isFinite(value) ? value! : fallback;

export function imageClipGeometry(
  sourceWidth: number, sourceHeight: number, canvasWidth: number, canvasHeight: number,
  crop?: VideoImageCrop, size?: VideoImageSize, scale = 1,
) {
  const width = Math.max(1, finite(sourceWidth, 1));
  const height = Math.max(1, finite(sourceHeight, 1));
  const left = Math.max(0, Math.min(1 - 1 / width, finite(crop?.left, 0)));
  const top = Math.max(0, Math.min(1 - 1 / height, finite(crop?.top, 0)));
  const right = Math.max(0, Math.min(1 - left - 1 / width, finite(crop?.right, 0)));
  const bottom = Math.max(0, Math.min(1 - top - 1 / height, finite(crop?.bottom, 0)));
  const source = { x: width * left, y: height * top, width: width * (1 - left - right), height: height * (1 - top - bottom) };
  const fit = Math.min(Math.max(1, canvasWidth) / width, Math.max(1, canvasHeight) / height);
  const multiplier = Math.max(0.001, finite(scale, 1));
  return {
    source,
    width: Math.max(1, finite(size?.width, source.width * fit)) * multiplier,
    height: Math.max(1, finite(size?.height, source.height * fit)) * multiplier,
  };
}
