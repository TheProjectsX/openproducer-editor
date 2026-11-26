import { BungeeStretcher, compileBungee, instantiateBungee, Transport } from "bungee-web";
import wasmUrl from "bungee-web/bungee.wasm?url";
import {
  PITCH_PRESERVE_RENDER_CHUNK_FRAMES,
  renderNaturalSpeedChunk,
  shouldUsePitchPreservingStretcher,
} from "./audio-speed";
import {
  MAX_OUTPUT_FPS,
  MAX_VIDEO_SPEED,
  MAX_VIDEO_SPEED_BYTES,
  MIN_VIDEO_SPEED,
  VIDEO_SPEED_PRESETS,
  chooseVideoSpeedOutputConfig,
  computeRetimedDuration,
  computeSpeedForTargetDuration,
  isValidVideoSpeed,
  shouldIncludeRetimedSample,
  type VideoSpeedFormatPreference,
  type VideoSpeedPitchMode,
} from "./video-speed-math";

export {
  MAX_OUTPUT_FPS,
  MAX_VIDEO_SPEED,
  MAX_VIDEO_SPEED_BYTES,
  MIN_VIDEO_SPEED,
  VIDEO_SPEED_PRESETS,
  chooseVideoSpeedOutputConfig,
  computeRetimedDuration,
  computeSpeedForTargetDuration,
  isValidVideoSpeed,
  shouldIncludeRetimedSample,
  type VideoSpeedFormatPreference,
  type VideoSpeedPitchMode,
};

export type VideoSpeedProgress = {
  phase: string;
  percent: number;
};

export type VideoSpeedExportResult = {
  blob: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
};

async function renderSpeedAdjustedAudio(
  file: File,
  speed: number,
  pitchMode: VideoSpeedPitchMode,
  onProgress: (progress: VideoSpeedProgress) => void,
  isCancelled: () => boolean
): Promise<AudioBuffer | null> {
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output, WavOutputFormat } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  let context: AudioContext | null = null;
  let stretcher: BungeeStretcher | null = null;

  try {
    const audioTracks = await input.getAudioTracks();
    if (!audioTracks.length) return null;

    onProgress({ phase: "Decoding audio track…", percent: 5 });
    const target = new BufferTarget();
    const output = new Output({ format: new WavOutputFormat(), target });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: { discard: true },
      audio: { numberOfChannels: 2, sampleRate: 48_000, sampleFormat: "s16" },
    });
    if (!conversion.isValid || !conversion.utilizedTracks.length) return null;
    await conversion.execute();
    if (isCancelled()) throw new Error("Export cancelled.");
    if (!target.buffer || target.buffer.byteLength > MAX_VIDEO_SPEED_BYTES) {
      throw new Error("Decoded audio exceeds the 512 MiB in-memory processing limit.");
    }

    context = new AudioContext({ sampleRate: 48_000 });
    const decoded = await context.decodeAudioData(target.buffer.slice(0));
    const sampleRate = decoded.sampleRate;
    const sourceFrames = decoded.length;
    const left = decoded.getChannelData(0);
    const right = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : left;
    const outputFrames = Math.max(1, Math.ceil(sourceFrames / speed));
    const resultLeft = new Float32Array(outputFrames);
    const resultRight = new Float32Array(outputFrames);

    if (Math.abs(speed - 1) <= 1e-6) {
      resultLeft.set(left.subarray(0, outputFrames));
      resultRight.set(right.subarray(0, outputFrames));
    } else if (shouldUsePitchPreservingStretcher(pitchMode, speed)) {
      onProgress({ phase: "Time-stretching audio (pitch preserved)…", percent: 15 });
      const module = await instantiateBungee(await compileBungee(fetch(wasmUrl)));
      stretcher = new BungeeStretcher(module, { sampleRate, channels: 2 });
      const transport = new Transport(stretcher, sourceFrames);
      transport.setSource("source", { left, right }, { gain: 1, pan: 0 });
      transport.speed = speed;
      transport.play();

      const chunkSize = PITCH_PRESERVE_RENDER_CHUNK_FRAMES;
      for (let offset = 0; offset < outputFrames; offset += chunkSize) {
        if (isCancelled()) throw new Error("Export cancelled.");
        const length = Math.min(chunkSize, outputFrames - offset);
        const blockLeft = new Float32Array(length);
        const blockRight = new Float32Array(length);
        transport.render(blockLeft, blockRight, length);
        resultLeft.set(blockLeft, offset);
        resultRight.set(blockRight, offset);
        if (offset % (chunkSize * 24) === 0) {
          onProgress({
            phase: "Time-stretching audio (pitch preserved)…",
            percent: 15 + Math.round((offset / outputFrames) * 20),
          });
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    } else {
      onProgress({ phase: "Resampling audio (natural pitch)…", percent: 20 });
      const chunkSize = PITCH_PRESERVE_RENDER_CHUNK_FRAMES;
      for (let offset = 0; offset < outputFrames; offset += chunkSize) {
        if (isCancelled()) throw new Error("Export cancelled.");
        const length = Math.min(chunkSize, outputFrames - offset);
        const rendered = renderNaturalSpeedChunk(left, right, speed, offset, length);
        resultLeft.set(rendered.left, offset);
        resultRight.set(rendered.right, offset);
      }
    }

    const audioBuffer = context.createBuffer(2, outputFrames, sampleRate);
    audioBuffer.copyToChannel(resultLeft, 0);
    audioBuffer.copyToChannel(resultRight, 1);
    return audioBuffer;
  } finally {
    stretcher?.destroy();
    if (context) await context.close().catch(() => undefined);
    input.dispose();
  }
}

export async function exportVideoWithSpeed(options: {
  file: File;
  speed: number;
  pitchMode: VideoSpeedPitchMode;
  formatPreference: VideoSpeedFormatPreference;
  onProgress: (progress: VideoSpeedProgress) => void;
  isCancelled: () => boolean;
  onOutputCreated?: (output: import("mediabunny").Output) => void;
}): Promise<VideoSpeedExportResult> {
  const { file, speed, pitchMode, formatPreference, onProgress, isCancelled, onOutputCreated } = options;
  if (!isValidVideoSpeed(speed)) {
    throw new Error("Enter a custom speed from 0.1× to 16×.");
  }

  const {
    ALL_FORMATS,
    AudioBufferSource,
    BlobSource,
    BufferTarget,
    Input,
    Mp4OutputFormat,
    Output,
    Quality,
    VideoSampleSink,
    VideoSampleSource,
    WebMOutputFormat,
    canEncodeAudio,
    canEncodeVideo,
  } = await import("mediabunny");

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  let output: import("mediabunny").Output | undefined;
  let outputOverLimit = false;

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      throw new Error("No primary video track was found in this file.");
    }
    if (!(await videoTrack.canDecode())) {
      throw new Error("This browser cannot decode the video codec in this file.");
    }

    const sourceDuration = await videoTrack.computeDuration();
    const width = Math.max(2, Math.round(videoTrack.displayWidth));
    const height = Math.max(2, Math.round(videoTrack.displayHeight));
    const evenWidth = width % 2 === 0 ? width : width - 1;
    const evenHeight = height % 2 === 0 ? height : height - 1;

    const audioBuffer = await renderSpeedAdjustedAudio(file, speed, pitchMode, onProgress, isCancelled);
    if (isCancelled()) throw new Error("Export cancelled.");

    const hasAudio = audioBuffer !== null;
    const targetBitrate = Math.max(2_000_000, Math.min(20_000_000, Math.round(evenWidth * evenHeight * 4)));
    const mp4Video = await canEncodeVideo("avc", {
      width: evenWidth,
      height: evenHeight,
      bitrate: targetBitrate,
    });
    const mp4Audio =
      !hasAudio || (await canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: 48_000, bitrate: 192_000 }));
    const webmVideoCodec: "vp9" | "vp8" | null = (await canEncodeVideo("vp9", {
      width,
      height,
      bitrate: targetBitrate,
    }))
      ? "vp9"
      : (await canEncodeVideo("vp8", { width, height, bitrate: targetBitrate }))
        ? "vp8"
        : null;
    const webmAudio =
      !hasAudio || (await canEncodeAudio("opus", { numberOfChannels: 2, sampleRate: 48_000, bitrate: 192_000 }));

    const chosen = chooseVideoSpeedOutputConfig(formatPreference, {
      mp4Video,
      mp4Audio,
      webmVideoCodec,
      webmAudio,
    });

    const target = new BufferTarget();
    let written = 0;
    target.on("write", ({ end }) => {
      written = Math.max(written, end);
      if (written > MAX_VIDEO_SPEED_BYTES) {
        outputOverLimit = true;
      }
    });

    output = new Output({
      format: chosen.format === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat(),
      target,
    });
    onOutputCreated?.(output);

    const videoSource = new VideoSampleSource({
      codec: chosen.videoCodec,
      quality: new Quality({ bitrate: targetBitrate }),
    });
    output.addVideoTrack(videoSource);

    let audioSource: InstanceType<typeof AudioBufferSource> | null = null;
    if (hasAudio) {
      audioSource = new AudioBufferSource({
        codec: chosen.audioCodec,
        quality: new Quality({ bitrate: 192_000 }),
      });
      output.addAudioTrack(audioSource);
    }

    await output.start();
    if (audioBuffer && audioSource) {
      await audioSource.add(audioBuffer);
    }

    const sink = new VideoSampleSink(videoTrack);
    let lastIncludedTimestamp: number | null = null;
    let processedCount = 0;
    const baseProgress = hasAudio ? 35 : 5;

    onProgress({
      phase: `Encoding ${chosen.format.toUpperCase()} frames…`,
      percent: baseProgress,
    });

    for await (const sample of sink.samples()) {
      try {
        if (isCancelled() || outputOverLimit) {
          throw new Error(outputOverLimit ? "Output exceeded the 512 MiB in-memory limit." : "Export cancelled.");
        }
        const retimedTimestamp = sample.timestamp / speed;
        const retimedDuration = Math.max(1 / 120, (sample.duration || 1 / 30) / speed);

        if (shouldIncludeRetimedSample(retimedTimestamp, lastIncludedTimestamp, MAX_OUTPUT_FPS)) {
          sample.setTimestamp(retimedTimestamp);
          sample.setDuration(retimedDuration);
          await videoSource.add(sample);
          lastIncludedTimestamp = retimedTimestamp;
        }

        processedCount += 1;
        if (processedCount % 8 === 0 && sourceDuration > 0) {
          const ratio = Math.min(1, sample.timestamp / sourceDuration);
          onProgress({
            phase: `Encoding ${chosen.format.toUpperCase()} frames…`,
            percent: Math.min(97, baseProgress + Math.round(ratio * (97 - baseProgress))),
          });
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } finally {
        sample.close();
      }
    }

    onProgress({ phase: `Finalizing ${chosen.format.toUpperCase()}…`, percent: 99 });
    await output.finalize();

    if (!target.buffer) {
      throw new Error("The browser encoder finished without producing a video file.");
    }
    if (target.buffer.byteLength > MAX_VIDEO_SPEED_BYTES) {
      throw new Error("Output exceeded the 512 MiB in-memory limit.");
    }

    const mimeType = chosen.format === "mp4" ? "video/mp4" : "video/webm";
    return {
      blob: new Blob([target.buffer], { type: mimeType }),
      mimeType,
      extension: chosen.format,
      width,
      height,
      duration: computeRetimedDuration(sourceDuration, speed),
      hasAudio,
    };
  } catch (cause) {
    if (output && output.state !== "canceled" && output.state !== "finalized") {
      await output.cancel().catch(() => undefined);
    }
    throw cause;
  } finally {
    input.dispose();
  }
}
