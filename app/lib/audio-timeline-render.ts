import { BungeeStretcher, compileBungee, instantiateBungee, Transport } from "bungee-web";
import wasmUrl from "bungee-web/bungee.wasm?url";
import type { VideoTimelineAsset, VideoTimelineClip } from "./project-store";

const OUTPUT_SAMPLE_RATE = 48_000;
const MAX_SOURCE_AUDIO_SECONDS = 180;

export async function renderTimelineAudio(
  clips: VideoTimelineClip[],
  assets: VideoTimelineAsset[],
  files: Record<string, File>,
  duration: number,
  onProgress: (percent: number) => void,
  isCancelled: () => boolean,
) {
  const audioClips = clips.filter((clip) => clip.track < 0);
  if (!audioClips.length) return null;
  const audioAssets = assets.filter((asset) => audioClips.some((clip) => clip.assetId === asset.id));
  const sourceDuration = audioAssets.reduce((sum, asset) => sum + asset.duration, 0);
  if (sourceDuration > MAX_SOURCE_AUDIO_SECONDS) throw new Error("This first export supports up to 180 seconds of unique audio sources per project. Shorten or remove unused audio sources.");
  const context = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
  try {
    if (context.sampleRate !== OUTPUT_SAMPLE_RATE) throw new Error("This browser cannot create the 48 kHz audio format required for a synchronized video export.");
    const decoded = new Map<string, AudioBuffer>();
    for (let index = 0; index < audioAssets.length; index++) {
      if (isCancelled()) throw new Error("Export cancelled.");
      const asset = audioAssets[index]; const file = files[asset.id];
      if (!file) throw new Error(`The project source “${asset.name}” is missing. Re-import it before exporting.`);
      decoded.set(asset.id, await context.decodeAudioData(await file.arrayBuffer()));
      onProgress(Math.round(((index + 1) / audioAssets.length) * 20));
    }
    const module = await instantiateBungee(await compileBungee(fetch(wasmUrl)));
    const sampleCount = Math.ceil(duration * OUTPUT_SAMPLE_RATE);
    const mixedLeft = new Float32Array(sampleCount); const mixedRight = new Float32Array(sampleCount);
    for (let clipIndex = 0; clipIndex < audioClips.length; clipIndex++) {
      if (isCancelled()) throw new Error("Export cancelled.");
      const clip = audioClips[clipIndex]; const buffer = decoded.get(clip.assetId);
      if (!buffer) continue;
      const rate = buffer.sampleRate;
      const startFrame = Math.min(buffer.length - 1, Math.floor(clip.sourceStart * rate));
      const endFrame = Math.max(startFrame + 1, Math.min(buffer.length, Math.ceil(clip.sourceEnd * rate)));
      const sourceFrames = endFrame - startFrame;
      const left = buffer.getChannelData(0).subarray(startFrame, endFrame);
      const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1).subarray(startFrame, endFrame) : left;
      const stretcher = new BungeeStretcher(module, { sampleRate: rate, channels: 2 });
      try {
        const keyframes = [...(clip.keyframes ?? [])].sort((a, b) => a.time - b.time);
        let keyframeIndex = 0;
        const transport = new Transport(stretcher, sourceFrames);
        transport.setSource("clip", { left, right }, { gain: clip.muted ? 0 : clip.keyframes?.length ? 1 : clip.volume, pan: 0 });
        transport.speed = clip.speed; transport.play();
        const outputFrames = Math.min(Math.ceil(sourceFrames / clip.speed), sampleCount - Math.round(clip.start * OUTPUT_SAMPLE_RATE));
        const destination = Math.max(0, Math.round(clip.start * OUTPUT_SAMPLE_RATE));
        const chunkSize = 4096;
        for (let offset = 0; offset < outputFrames; offset += chunkSize) {
          if (isCancelled()) throw new Error("Export cancelled.");
          const length = Math.min(chunkSize, outputFrames - offset);
          const blockLeft = new Float32Array(length); const blockRight = new Float32Array(length);
          transport.render(blockLeft, blockRight, length);
          for (let sample = 0; sample < length; sample++) {
            const localTime = (offset + sample) / OUTPUT_SAMPLE_RATE;
            while (keyframeIndex < keyframes.length - 2 && keyframes[keyframeIndex + 1].time < localTime) keyframeIndex++;
            const left = keyframes[keyframeIndex]; const right = keyframes[keyframeIndex + 1];
            const animatedGain = !left ? clip.volume : !right ? left.volume : left.volume + (right.volume - left.volume) * Math.max(0, Math.min(1, (localTime - left.time) / Math.max(0.001, right.time - left.time)));
            const gain = clip.muted ? 0 : keyframes.length ? animatedGain : clip.volume;
            mixedLeft[destination + offset + sample] += blockLeft[sample] * gain;
            mixedRight[destination + offset + sample] += blockRight[sample] * gain;
          }
          if (offset % (chunkSize * 32) === 0) {
            onProgress(20 + Math.round(((clipIndex + offset / Math.max(outputFrames, 1)) / audioClips.length) * 70));
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
      } finally { stretcher.destroy(); }
      onProgress(20 + Math.round(((clipIndex + 1) / audioClips.length) * 70));
    }
    let peak = 0;
    for (let index = 0; index < sampleCount; index++) peak = Math.max(peak, Math.abs(mixedLeft[index]), Math.abs(mixedRight[index]));
    const masterGain = peak > 0.98 ? 0.98 / peak : 1;
    if (masterGain !== 1) for (let index = 0; index < sampleCount; index++) { mixedLeft[index] *= masterGain; mixedRight[index] *= masterGain; }
    const output = context.createBuffer(2, sampleCount, OUTPUT_SAMPLE_RATE);
    output.copyToChannel(mixedLeft, 0); output.copyToChannel(mixedRight, 1);
    return output;
  } finally { await context.close(); }
}
