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

type ProgressInfo = {
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

async function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const backend = await detectBackend();
      const fileProgress = new Map<string, { loaded: number; total: number; progress: number; done: boolean }>();
      let maxReportedProgress = 5;

      const transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-base", {
        device: backend,
        dtype: backend === "webgpu" ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
        progress_callback: (info: ProgressInfo) => {
          const key = info.file ?? "whisper-base";
          const prev = fileProgress.get(key) ?? { loaded: 0, total: 0, progress: 0, done: false };
          const next = {
            loaded: typeof info.loaded === "number" ? info.loaded : prev.loaded,
            total: typeof info.total === "number" ? info.total : prev.total,
            progress: info.status === "done" ? 100 : (typeof info.progress === "number" ? info.progress : prev.progress),
            done: info.status === "done" ? true : prev.done,
          };
          fileProgress.set(key, next);

          let totalBytes = 0;
          let loadedBytes = 0;
          let sumPercent = 0;
          for (const entry of fileProgress.values()) {
            if (entry.total > 0) {
              totalBytes += entry.total;
              loadedBytes += entry.done ? entry.total : Math.min(entry.loaded, entry.total);
            }
            sumPercent += entry.done ? 100 : entry.progress;
          }
          const rawRatio = totalBytes > 0 ? loadedBytes / totalBytes : sumPercent / (fileProgress.size * 100);
          const scaledProgress = Math.min(85, Math.max(maxReportedProgress, Math.round(5 + rawRatio * 80)));
          maxReportedProgress = scaledProgress;

          const shortName = key.split("/").pop() ?? key;
          const phase = info.status === "progress" || info.status === "download"
            ? `Downloading ${shortName}…`
            : "Loading whisper-base…";

          self.postMessage({
            type: "progress",
            phase,
            progress: scaledProgress,
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
    self.postMessage({ type: "progress", phase: "Transcribing locally with whisper-base…", progress: 88, backend });
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
