import { createSpectralNoiseReductionJob } from "../lib/audio-denoise";

type StartMessage = { type: "start"; jobId: number; channels: ArrayBuffer[]; sampleRate: number; noiseStartFrame: number; noiseEndFrame: number; strength: number };
type CancelMessage = { type: "cancel"; jobId: number };
type WorkerMessage = StartMessage | CancelMessage;
type WorkerScope = { postMessage(message: unknown, transfer?: Transferable[]): void; onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null };

const workerScope = self as unknown as WorkerScope;
const cancelledJobs = new Set<number>();

function writeText(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
}

async function makeWav(channels: Float32Array[], sampleRate: number, jobId: number) {
  const frames = channels[0]?.length ?? 0;
  const byteLength = 44 + frames * channels.length * 2;
  if (byteLength > 512 * 1024 * 1024) throw new Error("The cleaned WAV exceeds the 512 MiB output limit.");
  const output = new ArrayBuffer(byteLength), view = new DataView(output);
  writeText(view, 0, "RIFF"); view.setUint32(4, byteLength - 8, true); writeText(view, 8, "WAVE");
  writeText(view, 12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 2, true); view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true); writeText(view, 36, "data"); view.setUint32(40, frames * channels.length * 2, true);
  const framesPerChunk = 65_536;
  for (let firstFrame = 0; firstFrame < frames; firstFrame += framesPerChunk) {
    if (cancelledJobs.has(jobId)) throw new Error("Processing cancelled.");
    const endFrame = Math.min(frames, firstFrame + framesPerChunk);
    for (let frame = firstFrame; frame < endFrame; frame++) for (let channel = 0; channel < channels.length; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      const offset = 44 + (frame * channels.length + channel) * 2;
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
    }
    workerScope.postMessage({ type: "progress", jobId, progress: 94 + Math.round(endFrame / frames * 6) });
    await yieldToWorkerMessages();
  }
  return output;
}

async function yieldToWorkerMessages() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function processAudio(message: StartMessage) {
  try {
    const inputs = message.channels.map((channel) => new Float32Array(channel));
    const jobs = inputs.map((channel) => createSpectralNoiseReductionJob(channel, message.noiseStartFrame, message.noiseEndFrame, message.strength));
    const totalFrames = jobs.reduce((sum, job) => sum + job.totalFrames, 0);
    let completedFrames = 0;
    for (const job of jobs) {
      while (!job.done) {
        if (cancelledJobs.has(message.jobId)) throw new Error("Processing cancelled.");
        for (let index = 0; index < 24 && !job.done; index++) { job.processNextFrame(); completedFrames++; }
        workerScope.postMessage({ type: "progress", jobId: message.jobId, progress: Math.min(94, Math.round(completedFrames / totalFrames * 92)) });
        await yieldToWorkerMessages();
      }
    }
    if (cancelledJobs.has(message.jobId)) throw new Error("Processing cancelled.");
    const outputs: Float32Array[] = [];
    for (const job of jobs) outputs.push(job.getOutput());
    const wav = await makeWav(outputs, message.sampleRate, message.jobId);
    if (cancelledJobs.has(message.jobId)) throw new Error("Processing cancelled.");
    workerScope.postMessage({ type: "complete", jobId: message.jobId, wav }, [wav]);
  } catch (cause) {
    workerScope.postMessage({ type: "error", jobId: message.jobId, message: cause instanceof Error ? cause.message : "Could not reduce the background noise." });
  } finally { cancelledJobs.delete(message.jobId); }
}

workerScope.onmessage = (event: MessageEvent<WorkerMessage>) => {
  if (event.data.type === "cancel") { cancelledJobs.add(event.data.jobId); return; }
  void processAudio(event.data);
};
