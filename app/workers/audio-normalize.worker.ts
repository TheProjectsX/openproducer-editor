import { createPcmWavHeader, encodeNormalizedPcm16 } from "../lib/audio-normalization";

type Request =
  | { type: "analyze"; id: number; channels: ArrayBuffer[] }
  | { type: "initialize"; id: number; frames: number; channels: number; sampleRate: number; gain: number }
  | { type: "encode"; id: number; channels: ArrayBuffer[] };
type Response = { type: "analyzed"; id: number; peak: number } | { type: "ready"; id: number; header: ArrayBuffer } | { type: "encoded"; id: number; pcm: ArrayBuffer } | { type: "failed"; id: number; message: string };
const workerScope = self as unknown as { onmessage: ((event: MessageEvent<Request>) => void) | null; postMessage(message: Response, transfer?: Transferable[]): void };
let renderGain: number | null = null;

workerScope.onmessage = (event) => {
  const request = event.data;
  try {
    if (request.type === "analyze") {
      let peak = 0;
      for (const bytes of request.channels) for (const sample of new Float32Array(bytes)) peak = Math.max(peak, Math.abs(sample));
      workerScope.postMessage({ type: "analyzed", id: request.id, peak });
    } else if (request.type === "initialize") {
      const header = createPcmWavHeader(request.frames, request.channels, request.sampleRate);
      workerScope.postMessage({ type: "ready", id: request.id, header }, [header]);
      renderGain = request.gain;
    } else {
      if (renderGain === null) throw new Error("The normalizer worker has not been initialized.");
      const channels = request.channels.map((bytes) => new Float32Array(bytes));
      const pcm = encodeNormalizedPcm16(channels, renderGain);
      workerScope.postMessage({ type: "encoded", id: request.id, pcm }, [pcm]);
    }
  } catch (cause) {
    workerScope.postMessage({ type: "failed", id: request.id, message: cause instanceof Error ? cause.message : "Audio normalization failed." });
  }
};
