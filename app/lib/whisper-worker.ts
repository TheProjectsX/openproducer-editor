import { env, pipeline } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

type WorkerRequest = {
  type: "transcribe";
  audio: Float32Array;
  language: string;
  task: "transcribe" | "translate";
};

let transcriberPromise: Promise<{ transcriber: Awaited<ReturnType<typeof pipeline>>; backend: "webgpu" | "wasm" }> | null = null;

async function detectBackend(): Promise<"webgpu" | "wasm"> {
  try {
    const nav = self.navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> } };
    if (nav?.gpu) {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) return "webgpu";
    }
  } catch {
    // Fall back to WASM when WebGPU adapter probe fails.
  }
  return "wasm";
}

async function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const backend = await detectBackend();
      const transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-base", {
        device: backend,
        dtype: backend === "webgpu" ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
        progress_callback: (info: { status?: string; file?: string; progress?: number }) => {
          self.postMessage({
            type: "progress",
            phase: info.status === "progress" ? `Downloading ${info.file ?? "whisper-base"}…` : "Loading whisper-base…",
            progress: typeof info.progress === "number" ? Math.round(info.progress) : undefined,
            backend,
          });
        },
      });
      return { transcriber, backend };
    })();
  }
  return transcriberPromise;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, audio, language, task } = event.data;
  if (type !== "transcribe") return;
  try {
    const { transcriber, backend } = await getTranscriber();
    self.postMessage({ type: "progress", phase: "Transcribing locally with whisper-base…", progress: 45, backend });
    const run = transcriber as unknown as (
      input: Float32Array,
      opts: Record<string, unknown>,
    ) => Promise<{
      text?: string;
      chunks?: { timestamp?: [number | null, number | null]; text?: string }[];
    }>;
    const result = await run(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
      task,
      ...(language && language !== "auto" ? { language } : {}),
    });
    const segments = (result.chunks ?? [])
      .map((chunk) => ({
        start: typeof chunk.timestamp?.[0] === "number" ? chunk.timestamp[0] : 0,
        end: typeof chunk.timestamp?.[1] === "number" ? chunk.timestamp[1] : (typeof chunk.timestamp?.[0] === "number" ? chunk.timestamp[0] + 2 : 2),
        text: (chunk.text ?? "").trim(),
      }))
      .filter((s) => s.text.length > 0);
    self.postMessage({
      type: "done",
      backend,
      segments: segments.length ? segments : [{ start: 0, end: Math.max(1, audio.length / 16000), text: (result.text ?? "").trim() }],
    });
  } catch (cause) {
    transcriberPromise = null;
    self.postMessage({
      type: "error",
      message: cause instanceof Error ? cause.message : "Local transcription failed.",
    });
  }
};
