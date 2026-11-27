import { BungeeStretcher, compileBungee, instantiateBungee, Transport } from "bungee-web";
import wasmUrl from "bungee-web/bungee.wasm?url";
import { PITCH_PRESERVE_RENDER_CHUNK_FRAMES, renderNaturalSpeedChunk, shouldUsePitchPreservingStretcher } from "./audio-speed";

export const STUDIO_SAMPLE_RATE = 48_000;
export const MAX_STUDIO_SOURCE_BYTES = 256 * 1024 * 1024;
export const MAX_STUDIO_OUTPUT_BYTES = 512 * 1024 * 1024;

export interface AudioStudioSource {
  id: string;
  name: string;
  kind: "audio" | "video";
  duration: number;
  sampleRate: number;
  channels: number;
  buffer: AudioBuffer;
  peaks: Float32Array;
}

export interface AudioStudioTrack {
  id: string;
  name: string;
  muted: boolean;
  solo: boolean;
  gainDb: number;
}

export interface AudioStudioClip {
  id: string;
  trackId: string;
  sourceId: string;
  name: string;
  /** Timeline start position in seconds */
  start: number;
  /** Source trim start in seconds */
  sourceStart: number;
  /** Source trim end in seconds */
  sourceEnd: number;
  speed: number;
  pitchMode: "preserve" | "natural";
  gainDb: number;
  fadeIn: number;
  fadeOut: number;
  muted: boolean;
}

export interface AudioStudioDocument {
  tracks: AudioStudioTrack[];
  clips: AudioStudioClip[];
  masterGainDb: number;
}

export function getClipDuration(clip: AudioStudioClip): number {
  const sourceSpan = Math.max(0, clip.sourceEnd - clip.sourceStart);
  const speed = Number.isFinite(clip.speed) && clip.speed >= 0.1 ? clip.speed : 1;
  return sourceSpan / speed;
}

export function dbToLinear(db: number): number {
  if (!Number.isFinite(db) || db <= -60) return 0;
  return 10 ** (db / 20);
}

export function computeWaveformPeaks(buffer: AudioBuffer, targetBuckets = 1600): Float32Array {
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const total = left.length;
  const buckets = Math.max(64, Math.min(targetBuckets, total));
  const peaks = new Float32Array(buckets);
  const step = total / buckets;
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * step);
    const end = Math.min(total, Math.max(start + 1, Math.floor((i + 1) * step)));
    let maxVal = 0;
    const stride = Math.max(1, Math.floor((end - start) / 64));
    for (let j = start; j < end; j += stride) {
      const v = Math.max(Math.abs(left[j]), Math.abs(right[j]));
      if (v > maxVal) maxVal = v;
    }
    peaks[i] = maxVal;
  }
  return peaks;
}

export function measureClipPeakDb(buffer: AudioBuffer, sourceStart: number, sourceEnd: number): number {
  const rate = buffer.sampleRate;
  const startFrame = Math.max(0, Math.min(buffer.length - 1, Math.floor(sourceStart * rate)));
  const endFrame = Math.max(startFrame + 1, Math.min(buffer.length, Math.ceil(sourceEnd * rate)));
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = startFrame; i < endFrame; i++) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
    }
  }
  if (peak <= 1e-6) return -60;
  return 20 * Math.log10(peak);
}

export async function decodeMediaFileToAudioBuffer(file: File): Promise<{
  buffer: AudioBuffer;
  kind: "audio" | "video";
}> {
  if (file.size > MAX_STUDIO_SOURCE_BYTES) {
    throw new Error(`“${file.name}” exceeds the 256 MiB source limit.`);
  }
  const isLikelyVideo =
    file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name);

  const context = new AudioContext({ sampleRate: STUDIO_SAMPLE_RATE });
  try {
    if (!isLikelyVideo) {
      try {
        const raw = await file.arrayBuffer();
        const decoded = await context.decodeAudioData(raw);
        return { buffer: decoded, kind: "audio" };
      } catch {
        // Fallback to mediabunny extraction for containers decodeAudioData cannot handle natively
      }
    }

    const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output, WavOutputFormat } = await import("mediabunny");
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    try {
      const audioTracks = await input.getAudioTracks();
      if (!audioTracks.length) {
        throw new Error(`“${file.name}” does not contain an audio track.`);
      }
      const target = new BufferTarget();
      const output = new Output({ format: new WavOutputFormat(), target });
      const conversion = await Conversion.init({
        input,
        output,
        tracks: "all",
        video: { discard: true },
        audio: { numberOfChannels: 2, sampleRate: STUDIO_SAMPLE_RATE, sampleFormat: "s16" },
      });
      if (!conversion.isValid || !conversion.utilizedTracks.length) {
        throw new Error(`Could not extract an audio stream from “${file.name}”.`);
      }
      await conversion.execute();
      if (!target.buffer) {
        throw new Error(`Audio extraction produced no data for “${file.name}”.`);
      }
      const decoded = await context.decodeAudioData(target.buffer.slice(0));
      return { buffer: decoded, kind: isLikelyVideo ? "video" : "audio" };
    } finally {
      input.dispose();
    }
  } finally {
    await context.close().catch(() => undefined);
  }
}

export function encodeWavBlob(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
  const frames = Math.min(left.length, right.length);
  const bytes = new ArrayBuffer(44 + frames * 4);
  const view = new DataView(bytes);
  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, frames * 4, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, l < 0 ? l * 32768 : l * 32767, true);
    view.setInt16(offset + 2, r < 0 ? r * 32768 : r * 32767, true);
    offset += 4;
  }
  return new Blob([bytes], { type: "audio/wav" });
}

function resampleChannel(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const outLength = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const output = new Float32Array(outLength);
  const ratio = fromRate / toRate;
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s0 = input[Math.min(idx, input.length - 1)];
    const s1 = input[Math.min(idx + 1, input.length - 1)];
    output[i] = s0 + (s1 - s0) * frac;
  }
  return output;
}

export async function renderMultitrackAudioMix(options: {
  doc: AudioStudioDocument;
  sources: Record<string, AudioStudioSource>;
  onProgress: (percent: number) => void;
  isCancelled: () => boolean;
}): Promise<{ blob: Blob; duration: number; buffer: AudioBuffer }> {
  const { doc, sources, onProgress, isCancelled } = options;
  const anySolo = doc.tracks.some((t) => t.solo);
  const trackMap = new Map(doc.tracks.map((t) => [t.id, t]));

  const activeClips = doc.clips.filter((clip) => {
    if (clip.muted) return false;
    const track = trackMap.get(clip.trackId);
    if (!track || track.muted) return false;
    if (anySolo && !track.solo) return false;
    return Boolean(sources[clip.sourceId]) && getClipDuration(clip) > 0.001;
  });

  if (!activeClips.length) {
    throw new Error("No audible clips on unmuted tracks to render.");
  }

  const totalDuration = activeClips.reduce((maxEnd, clip) => Math.max(maxEnd, clip.start + getClipDuration(clip)), 0);
  const totalFrames = Math.max(1, Math.ceil(totalDuration * STUDIO_SAMPLE_RATE));
  if (totalFrames * 8 > MAX_STUDIO_OUTPUT_BYTES) {
    throw new Error("The mixed timeline exceeds the 512 MiB in-memory WAV limit.");
  }

  const mixedLeft = new Float32Array(totalFrames);
  const mixedRight = new Float32Array(totalFrames);
  const masterGain = dbToLinear(doc.masterGainDb);
  let bungeeModule: Awaited<ReturnType<typeof instantiateBungee>> | null = null;

  for (let idx = 0; idx < activeClips.length; idx++) {
    if (isCancelled()) throw new Error("Export cancelled.");
    const clip = activeClips[idx];
    const source = sources[clip.sourceId];
    const track = trackMap.get(clip.trackId)!;
    const buf = source.buffer;
    const srcRate = buf.sampleRate;
    const startSample = Math.max(0, Math.min(buf.length - 1, Math.floor(clip.sourceStart * srcRate)));
    const endSample = Math.max(startSample + 1, Math.min(buf.length, Math.ceil(clip.sourceEnd * srcRate)));
    const rawLeft = buf.getChannelData(0).subarray(startSample, endSample);
    const rawRight = (buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)).subarray(startSample, endSample);

    const srcLeft = resampleChannel(rawLeft, srcRate, STUDIO_SAMPLE_RATE);
    const srcRight = resampleChannel(rawRight, srcRate, STUDIO_SAMPLE_RATE);

    const speed = Math.max(0.1, Math.min(16, clip.speed || 1));
    const clipFrames = Math.max(1, Math.round(srcLeft.length / speed));
    let procLeft: Float32Array;
    let procRight: Float32Array;

    if (Math.abs(speed - 1) < 1e-4) {
      procLeft = srcLeft;
      procRight = srcRight;
    } else if (shouldUsePitchPreservingStretcher(clip.pitchMode, speed)) {
      if (!bungeeModule) {
        bungeeModule = await instantiateBungee(await compileBungee(fetch(wasmUrl)));
      }
      const stretcher = new BungeeStretcher(bungeeModule, { sampleRate: STUDIO_SAMPLE_RATE, channels: 2 });
      const transport = new Transport(stretcher, srcLeft.length);
      transport.setSource("clip", { left: srcLeft, right: srcRight }, { gain: 1, pan: 0 });
      transport.speed = speed;
      transport.play();
      procLeft = new Float32Array(clipFrames);
      procRight = new Float32Array(clipFrames);
      for (let off = 0; off < clipFrames; off += PITCH_PRESERVE_RENDER_CHUNK_FRAMES) {
        if (isCancelled()) throw new Error("Export cancelled.");
        const len = Math.min(PITCH_PRESERVE_RENDER_CHUNK_FRAMES, clipFrames - off);
        const blockLeft = new Float32Array(len);
        const blockRight = new Float32Array(len);
        transport.render(blockLeft, blockRight, len);
        procLeft.set(blockLeft, off);
        procRight.set(blockRight, off);
        await new Promise((r) => setTimeout(r, 0));
      }
    } else {
      procLeft = new Float32Array(clipFrames);
      procRight = new Float32Array(clipFrames);
      for (let off = 0; off < clipFrames; off += PITCH_PRESERVE_RENDER_CHUNK_FRAMES) {
        if (isCancelled()) throw new Error("Export cancelled.");
        const len = Math.min(PITCH_PRESERVE_RENDER_CHUNK_FRAMES, clipFrames - off);
        const chunk = renderNaturalSpeedChunk(srcLeft, srcRight, speed, off, len);
        procLeft.set(chunk.left, off);
        procRight.set(chunk.right, off);
      }
    }

    const combinedGain = dbToLinear(clip.gainDb) * dbToLinear(track.gainDb) * masterGain;
    const timelineOffset = Math.max(0, Math.round(clip.start * STUDIO_SAMPLE_RATE));
    const fadeInFrames = Math.max(0, Math.round(clip.fadeIn * STUDIO_SAMPLE_RATE));
    const fadeOutFrames = Math.max(0, Math.round(clip.fadeOut * STUDIO_SAMPLE_RATE));
    const usableFrames = Math.min(procLeft.length, totalFrames - timelineOffset);

    for (let i = 0; i < usableFrames; i++) {
      let env = combinedGain;
      if (fadeInFrames > 0 && i < fadeInFrames) env *= i / fadeInFrames;
      if (fadeOutFrames > 0 && i >= procLeft.length - fadeOutFrames) {
        env *= Math.max(0, (procLeft.length - i) / fadeOutFrames);
      }
      mixedLeft[timelineOffset + i] += procLeft[i] * env;
      mixedRight[timelineOffset + i] += procRight[i] * env;
    }

    onProgress(Math.round(((idx + 1) / activeClips.length) * 94));
  }

  // Soft-clip protection if summed tracks exceed 0 dBFS
  for (let i = 0; i < totalFrames; i++) {
    if (mixedLeft[i] > 1 || mixedLeft[i] < -1) mixedLeft[i] = Math.tanh(mixedLeft[i]);
    if (mixedRight[i] > 1 || mixedRight[i] < -1) mixedRight[i] = Math.tanh(mixedRight[i]);
  }

  onProgress(98);
  const blob = encodeWavBlob(mixedLeft, mixedRight, STUDIO_SAMPLE_RATE);
  const ctx = new AudioContext({ sampleRate: STUDIO_SAMPLE_RATE });
  try {
    const outBuffer = ctx.createBuffer(2, totalFrames, STUDIO_SAMPLE_RATE);
    outBuffer.copyToChannel(mixedLeft, 0);
    outBuffer.copyToChannel(mixedRight, 1);
    onProgress(100);
    return { blob, duration: totalDuration, buffer: outBuffer };
  } finally {
    await ctx.close().catch(() => undefined);
  }
}
