export const MIN_VIDEO_SPEED = 0.1;
export const MAX_VIDEO_SPEED = 16;
export const VIDEO_SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 4, 8] as const;
export const MAX_VIDEO_SPEED_BYTES = 512 * 1024 * 1024;
export const MAX_OUTPUT_FPS = 60;

export type VideoSpeedPitchMode = "preserve" | "natural";
export type VideoSpeedFormatPreference = "auto" | "mp4" | "webm";

export function isValidVideoSpeed(speed: number): boolean {
  return Number.isFinite(speed) && speed >= MIN_VIDEO_SPEED && speed <= MAX_VIDEO_SPEED;
}

export function computeRetimedDuration(sourceDuration: number, speed: number): number {
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0 || !isValidVideoSpeed(speed)) return 0;
  return sourceDuration / speed;
}

export function computeSpeedForTargetDuration(sourceDuration: number, targetDuration: number): number {
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0 || !Number.isFinite(targetDuration) || targetDuration <= 0) {
    return 1;
  }
  return Math.max(MIN_VIDEO_SPEED, Math.min(MAX_VIDEO_SPEED, sourceDuration / targetDuration));
}

export function shouldIncludeRetimedSample(
  retimedTimestamp: number,
  lastIncludedTimestamp: number | null,
  maxOutputFps = MAX_OUTPUT_FPS
): boolean {
  if (lastIncludedTimestamp === null) return true;
  const minInterval = 1 / Math.max(1, maxOutputFps);
  return retimedTimestamp - lastIncludedTimestamp >= minInterval - 1e-4;
}

export function chooseVideoSpeedOutputConfig(
  preference: VideoSpeedFormatPreference,
  capabilities: { mp4Video: boolean; mp4Audio: boolean; webmVideoCodec: "vp9" | "vp8" | null; webmAudio: boolean }
): { format: "mp4" | "webm"; videoCodec: "avc" | "vp9" | "vp8"; audioCodec: "aac" | "opus" } {
  const mp4Ready = capabilities.mp4Video && capabilities.mp4Audio;
  const webmReady = Boolean(capabilities.webmVideoCodec) && capabilities.webmAudio;

  if (preference === "mp4") {
    if (!mp4Ready) {
      throw new Error("This browser does not support MP4 (H.264/AAC) encoding for these video dimensions. Try Auto or WebM.");
    }
    return { format: "mp4", videoCodec: "avc", audioCodec: "aac" };
  }
  if (preference === "webm") {
    if (!webmReady || !capabilities.webmVideoCodec) {
      throw new Error("This browser does not support WebM (VP9/VP8/Opus) encoding for these video dimensions.");
    }
    return { format: "webm", videoCodec: capabilities.webmVideoCodec, audioCodec: "opus" };
  }
  if (mp4Ready) {
    return { format: "mp4", videoCodec: "avc", audioCodec: "aac" };
  }
  if (webmReady && capabilities.webmVideoCodec) {
    return { format: "webm", videoCodec: capabilities.webmVideoCodec, audioCodec: "opus" };
  }
  throw new Error("This browser has no supported WebCodecs video/audio encoder combination for this file.");
}
