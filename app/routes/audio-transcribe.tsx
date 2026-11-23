import { useEffect, useMemo, useRef, useState } from "react";
import { MediaImportScreen } from "../components/media-import-screen";
import { ProcessingProgress } from "../components/processing-progress";
import { ToolPageHeader } from "../components/tool-page-header";
import {
  formatTranscript,
  type TranscriptExportFormat,
  type TranscriptSegment,
  type TranscriptStyleOptions,
} from "../lib/transcript-format";
import type { Route } from "./+types/audio-transcribe";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Voice to Transcript | Local Studio" },
    {
      name: "description",
      content: "Transcribe audio, video, or microphone recordings locally in your browser with Whisper Base and custom output style and format controls.",
    },
    { name: "robots", content: "index,follow" },
  ];
}

const LANGUAGES = [
  ["auto", "Auto-detect"],
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["pt", "Portuguese"],
  ["it", "Italian"],
  ["nl", "Dutch"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh", "Chinese"],
  ["ar", "Arabic"],
  ["hi", "Hindi"],
  ["bn", "Bengali"],
] as const;

async function decodeAudioToMono16k(file: Blob): Promise<Float32Array> {
  const bytes = await file.arrayBuffer();
  const decodeCtx = new AudioContext();
  try {
    const decoded = await decodeCtx.decodeAudioData(bytes);
    const targetRate = 16_000;
    const targetLength = Math.max(1, Math.ceil(decoded.duration * targetRate));
    const offline = new OfflineAudioContext(1, targetLength, targetRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0);
  } finally {
    await decodeCtx.close();
  }
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function AudioTranscribe() {
  const workerRef = useRef<Worker | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const meterCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [editorOpened, setEditorOpened] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused">("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [recorderError, setRecorderError] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [backend, setBackend] = useState("");
  const [error, setError] = useState("");

  const [language, setLanguage] = useState("auto");
  const [task, setTask] = useState<"transcribe" | "translate">("transcribe");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);

  const [selectedFormats, setSelectedFormats] = useState<TranscriptExportFormat[]>(["txt"]);
  const [sectionTimestamps, setSectionTimestamps] = useState(false);
  const [maxWordsPerSegment, setMaxWordsPerSegment] = useState("8");
  const [maxDurationSeconds, setMaxDurationSeconds] = useState("10");
  const [maxCharsPerSegment, setMaxCharsPerSegment] = useState("80");
  const [sentenceAware, setSentenceAware] = useState(true);
  const [manualOverride, setManualOverride] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const primaryFormat: TranscriptExportFormat = selectedFormats[0] ?? "txt";

  const formatOptions: TranscriptStyleOptions = useMemo(
    () => ({
      style: "clean",
      stripFillers: false,
      includeTimestamps: sectionTimestamps,
      timestampFormat: "mm:ss",
      paragraphPauseSeconds: 1.5,
      casing: "preserve",
      maxLineWidth: 0,
      maxWordsPerSegment: Number(maxWordsPerSegment) || 0,
      maxDurationSeconds: Number(maxDurationSeconds) || 0,
      maxCharsPerSegment: Number(maxCharsPerSegment) || 0,
      sentenceAware,
    }),
    [sectionTimestamps, maxWordsPerSegment, maxDurationSeconds, maxCharsPerSegment, sentenceAware],
  );

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  function cleanupRecorderResources() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (meterRafRef.current !== null) {
      window.cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    if (meterCtxRef.current) {
      void meterCtxRef.current.close().catch(() => {});
      meterCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setMicLevel(0);
  }

  useEffect(() => () => {
    workerRef.current?.terminate();
    cleanupRecorderResources();
  }, []);

  const formattedOutput = useMemo(
    () => formatTranscript(segments, primaryFormat, formatOptions),
    [segments, primaryFormat, formatOptions],
  );

  const displayedText = manualOverride ?? formattedOutput;

  function loadMedia(next: File | undefined) {
    if (!next) return;
    if (!next.type.startsWith("audio/") && !next.type.startsWith("video/")) {
      setError("Choose an audio or video file.");
      return;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(next);
    setAudioUrl(URL.createObjectURL(next));
    setEditorOpened(true);
    setSegments([]);
    setManualOverride(null);
    setError("");
  }

  function openRecorderInEditor() {
    setError("");
    setRecorderError("");
    setEditorOpened(true);
    setRecorderOpen(true);
  }

  async function startMicRecording() {
    if (recordingState !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecorderError("Microphone recording is not supported in this browser or context.");
      return;
    }
    setRecorderError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      recordedChunksRef.current = [];
      discardRecordingRef.current = false;

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const shouldDiscard = discardRecordingRef.current;
        const mimeType = recorder.mimeType || "audio/webm";
        const chunks = recordedChunksRef.current;
        recorderRef.current = null;
        cleanupRecorderResources();
        setRecordingState("idle");
        setRecordingSeconds(0);
        if (!shouldDiscard && chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType });
          const recordedFile = new File([blob], `voice-recording-${Date.now()}.webm`, { type: blob.type });
          loadMedia(recordedFile);
          setRecorderOpen(false);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecordingSeconds(0);
      setRecordingState("recording");

      timerRef.current = window.setInterval(() => {
        if (recorderRef.current?.state === "recording") {
          setRecordingSeconds((prev) => prev + 1);
        }
      }, 1000);

      try {
        const meterCtx = new AudioContext();
        meterCtxRef.current = meterCtx;
        const source = meterCtx.createMediaStreamSource(stream);
        const analyser = meterCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const samples = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          if (!meterCtxRef.current) return;
          analyser.getByteTimeDomainData(samples);
          let peak = 0;
          for (let i = 0; i < samples.length; i += 1) {
            const amp = Math.abs(samples[i] - 128) / 128;
            if (amp > peak) peak = amp;
          }
          setMicLevel(Math.min(1, peak * 2.2));
          meterRafRef.current = window.requestAnimationFrame(updateMeter);
        };
        meterRafRef.current = window.requestAnimationFrame(updateMeter);
      } catch {
        // Level meter is optional; recording still works without AudioContext.
      }
    } catch (cause) {
      cleanupRecorderResources();
      setRecorderError(cause instanceof Error ? cause.message : "Microphone access was denied or unavailable.");
    }
  }

  function pauseOrResumeRecording() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording" && typeof recorder.pause === "function") {
      recorder.pause();
      setRecordingState("paused");
    } else if (recorder.state === "paused" && typeof recorder.resume === "function") {
      recorder.resume();
      setRecordingState("recording");
    }
  }

  function stopAndUseRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    discardRecordingRef.current = false;
    recorder.stop();
  }

  function closeOrDiscardRecorder() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      discardRecordingRef.current = true;
      recorder.stop();
    } else {
      cleanupRecorderResources();
      setRecordingState("idle");
      setRecordingSeconds(0);
    }
    setRecorderError("");
    setRecorderOpen(false);
  }

  function cancelTranscription() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setTranscribing(false);
    setPhase("Cancelled.");
  }

  async function runTranscription() {
    if (!file || transcribing) return;
    setError("");
    setTranscribing(true);
    setProgress(5);
    setPhase("Decoding audio to 16 kHz PCM…");
    setManualOverride(null);
    try {
      const pcm = await decodeAudioToMono16k(file);
      const worker = new Worker(new URL("../lib/whisper-worker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<{ type: string; phase?: string; progress?: number; backend?: string; segments?: TranscriptSegment[]; message?: string }>) => {
        const msg = event.data;
        if (msg.type === "progress") {
          if (msg.phase) setPhase(msg.phase);
          if (typeof msg.progress === "number") setProgress(msg.progress);
          if (msg.backend) setBackend(msg.backend.toUpperCase());
        } else if (msg.type === "done") {
          setSegments(msg.segments ?? []);
          if (msg.backend) setBackend(msg.backend.toUpperCase());
          setProgress(100);
          setPhase("Transcript ready.");
          setTranscribing(false);
          worker.terminate();
          workerRef.current = null;
        } else if (msg.type === "error") {
          setError(msg.message ?? "Transcription failed.");
          setTranscribing(false);
          worker.terminate();
          workerRef.current = null;
        }
      };
      worker.onerror = (err) => {
        setError(err.message || "Whisper worker failed.");
        setTranscribing(false);
        worker.terminate();
        workerRef.current = null;
      };
      worker.postMessage({ type: "transcribe", audio: pcm, language, task }, [pcm.buffer]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not decode this media file.");
      setTranscribing(false);
    }
  }

  async function copyOutput() {
    if (!displayedText) return;
    await navigator.clipboard.writeText(displayedText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function toggleExportFormat(fmt: TranscriptExportFormat) {
    setManualOverride(null);
    setSelectedFormats((prev) => {
      if (prev.includes(fmt)) {
        return prev.length > 1 ? prev.filter((item) => item !== fmt) : prev;
      }
      return [...prev, fmt];
    });
  }

  function downloadOutput() {
    if (!displayedText && segments.length === 0) return;
    const mimeMap: Record<TranscriptExportFormat, string> = {
      txt: "text/plain",
      csv: "text/csv",
      md: "text/markdown",
      srt: "application/x-subrip",
      vtt: "text/vtt",
      json: "application/json",
    };
    const baseName = file ? file.name.replace(/\.[^.]+$/, "") : "transcript";
    selectedFormats.forEach((fmt, idx) => {
      const content =
        fmt === primaryFormat && manualOverride !== null
          ? manualOverride
          : formatTranscript(segments, fmt, formatOptions);
      if (!content) return;
      const blob = new Blob([content], { type: `${mimeMap[fmt]};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${baseName}.${fmt}`;
      window.setTimeout(() => {
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, idx * 120);
    });
  }

  const workspaceActive = Boolean(file || editorOpened);

  return (
    <main className={`resize-page${workspaceActive ? " has-media" : ""}`}>
      <ToolPageHeader />
      <section className="resize-intro">
        <p className="eyebrow">AUDIO · ON-DEVICE WHISPER</p>
        <h1>Voice to transcript</h1>
        <p>Transcribe audio, video, or microphone recordings locally with Whisper Base (cached on first use) and customize output style and export format.</p>
      </section>

      {!workspaceActive ? (
        <MediaImportScreen
          kind="audio"
          accept="audio/*,video/*"
          onFile={loadMedia}
          error={error}
          secondaryAction={{
            label: "Record from microphone",
            onClick: openRecorderInEditor,
          }}
        />
      ) : (
        <section className="resize-workspace" aria-label="Voice to transcript workspace">
          <div className="resize-controls">
            <h2 className="editor-sidebar-title">Voice to Transcript</h2>
            <div className="image-layer-actions">
              <label className="file-picker" style={{ gridColumn: "1 / -1" }}>
                <span>{file ? "Choose another audio/video" : "Choose audio/video"}</span>
                <input type="file" accept="audio/*,video/*" onChange={(e) => { loadMedia(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} />
              </label>
              <button
                type="button"
                className="secondary-button"
                style={{ gridColumn: "1 / -1" }}
                onClick={recorderOpen ? closeOrDiscardRecorder : openRecorderInEditor}
              >
                {recorderOpen ? "Close microphone recorder" : file ? "🎙 Record new mic clip" : "🎙 Open microphone recorder"}
              </button>
            </div>
            <p className="source-info">
              {file ? `Source: ${file.name}${backend ? ` · ${backend}` : ""}` : "Source: No audio loaded yet"}
            </p>

            <details className="editor-control-group" open>
              <summary>Recognition (Whisper Base)</summary>
              <div className="editor-control-content transcribe-stack">
                <label className="transcribe-field">
                  Language
                  <select value={language} onChange={(e) => setLanguage(e.currentTarget.value)}>
                    {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                </label>
                <label className="transcribe-field">
                  Task
                  <select value={task} onChange={(e) => setTask(e.currentTarget.value as "transcribe" | "translate")}>
                    <option value="transcribe">Transcribe</option>
                    <option value="translate">Translate to English</option>
                  </select>
                </label>
                <button type="button" className="export-button" disabled={!file || transcribing} onClick={() => void runTranscription()}>
                  {transcribing ? "Transcribing…" : segments.length ? "Re-transcribe locally" : "Transcribe locally"}
                </button>
                {transcribing && <>
                  <ProcessingProgress label={phase || "Running Whisper Base on this device"} value={progress} />
                  <button type="button" className="secondary-button" onClick={cancelTranscription}>Cancel transcription</button>
                </>}
              </div>
            </details>

            <details className="editor-control-group" open>
              <summary>Export formats</summary>
              <div className="editor-control-content transcribe-format-list">
                {([
                  ["txt", "TXT", "Export as TXT"],
                  ["csv", "CSV", "Export as CSV"],
                  ["srt", "SRT", "Export as SRT"],
                  ["vtt", "VTT", "Export as VTT"],
                  ["md", "MD", "Export as Markdown"],
                  ["json", "JSON", "Export as JSON"],
                ] as const).map(([fmt, badge, label]) => {
                  const checked = selectedFormats.includes(fmt);
                  return (
                    <label key={fmt} className={`transcribe-format-item${checked ? " is-checked" : ""}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleExportFormat(fmt)} />
                      <span className="transcribe-format-badge">{badge}</span>
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </details>

            <details className="editor-control-group" open>
              <summary>Settings</summary>
              <div className="editor-control-content transcribe-stack">
                <label className="transcribe-check-row">
                  <input type="checkbox" checked={sectionTimestamps} onChange={(e) => { setSectionTimestamps(e.currentTarget.checked); setManualOverride(null); }} />
                  <span className="transcribe-check-text">
                    <strong>Section Timestamps</strong>
                    <small>Add timestamps before each section in TXT and MD formats.</small>
                  </span>
                </label>
                <label className="transcribe-field">
                  Max Words Per Segment
                  <input type="number" min="0" max="100" step="1" value={maxWordsPerSegment} onChange={(e) => { setMaxWordsPerSegment(e.currentTarget.value); setManualOverride(null); }} />
                </label>
                <details className="transcribe-advanced">
                  <summary>Advanced Segmentation Settings ▾</summary>
                  <div className="transcribe-stack">
                    <label className="transcribe-field">
                      Max Duration Per Segment (Seconds)
                      <input type="number" min="0" max="120" step="1" value={maxDurationSeconds} onChange={(e) => { setMaxDurationSeconds(e.currentTarget.value); setManualOverride(null); }} />
                    </label>
                    <label className="transcribe-field">
                      Max Characters Per Segment
                      <input type="number" min="0" max="500" step="1" value={maxCharsPerSegment} onChange={(e) => { setMaxCharsPerSegment(e.currentTarget.value); setManualOverride(null); }} />
                    </label>
                    <label className="transcribe-check-row">
                      <input type="checkbox" checked={sentenceAware} onChange={(e) => { setSentenceAware(e.currentTarget.checked); setManualOverride(null); }} />
                      <span className="transcribe-check-text">
                        <strong>Sentence-Aware Segmentation</strong>
                        <small>If enabled, the start of a new sentence will always begin a new segment.</small>
                      </span>
                    </label>
                  </div>
                </details>
              </div>
            </details>

            {error && <p className="resize-error" role="alert">{error}</p>}
            <button type="button" className="export-button" disabled={!displayedText} onClick={downloadOutput}>
              {selectedFormats.length > 1
                ? `Download (${selectedFormats.length} files)`
                : `Download .${primaryFormat}`}
            </button>
          </div>

          <div className="resize-preview collage-main-preview">
            <div className="preview-heading">
              <strong>Transcript output</strong>
              <div className="collage-history-actions">
                {manualOverride !== null && (
                  <button type="button" className="collage-history-btn" onClick={() => setManualOverride(null)}>Reset edits</button>
                )}
                <button type="button" className="collage-history-btn" disabled={!displayedText} onClick={() => void copyOutput()}>
                  {copied ? "Copied!" : "Copy text"}
                </button>
                <span>{segments.length} segment(s) · {primaryFormat.toUpperCase()}</span>
              </div>
            </div>
            {recorderOpen && (
              <section className="mic-recorder-card" aria-label="Microphone recorder">
                <div className="mic-recorder-header">
                  <div className="mic-recorder-title">
                    <strong>Microphone recorder</strong>
                    <span className={`mic-recorder-badge${recordingState === "recording" ? " is-live" : recordingState === "paused" ? " is-paused" : ""}`}>
                      <span className="mic-recorder-dot" aria-hidden="true" />
                      {recordingState === "recording" ? "Recording" : recordingState === "paused" ? "Paused" : "Ready"} · {formatDuration(recordingSeconds)}
                    </span>
                  </div>
                  <button type="button" className="collage-history-btn" onClick={closeOrDiscardRecorder}>
                    {recordingState === "idle" ? "Close" : "Discard"}
                  </button>
                </div>
                <p className="mic-recorder-hint">
                  {recordingState === "idle"
                    ? "Click Start recording to capture audio from your microphone. Everything stays in your browser."
                    : "Speak into your microphone. Click Stop & use recording when finished to load it for transcription."}
                </p>
                {recordingState !== "idle" && (
                  <div className="mic-recorder-meter" aria-label="Microphone input level">
                    <div className="mic-recorder-meter-fill" style={{ width: `${Math.round(micLevel * 100)}%` }} />
                  </div>
                )}
                {recorderError && <p className="resize-error" role="alert">{recorderError}</p>}
                <div className="mic-recorder-actions">
                  {recordingState === "idle" ? (
                    <button type="button" className="export-button" onClick={() => void startMicRecording()}>
                      🎙 Start recording
                    </button>
                  ) : (
                    <>
                      <button type="button" className="export-button" onClick={stopAndUseRecording}>
                        ⏹ Stop &amp; use recording
                      </button>
                      <button type="button" className="secondary-button" onClick={pauseOrResumeRecording}>
                        {recordingState === "paused" ? "Resume" : "Pause"}
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}
            {audioUrl ? (
              <audio className="audio-preview-player" controls src={audioUrl} />
            ) : !recorderOpen ? (
              <div className="mic-empty-state">
                <p>No audio loaded yet. Record from your microphone or choose a file from the sidebar.</p>
                <button type="button" className="secondary-button" onClick={openRecorderInEditor}>
                  🎙 Open microphone recorder
                </button>
              </div>
            ) : null}
            <textarea
              className="transcript-editor-box"
              aria-label="Editable transcript output"
              value={displayedText}
              placeholder={transcribing ? "Transcribing locally on your device…" : "Click “Transcribe locally” to generate your transcript with Whisper Base (downloaded and cached on first use)."}
              onChange={(e) => setManualOverride(e.currentTarget.value)}
            />
          </div>
        </section>
      )}
    </main>
  );
}
