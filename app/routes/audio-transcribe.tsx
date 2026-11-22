import { useEffect, useMemo, useRef, useState } from "react";
import { MediaImportScreen } from "../components/media-import-screen";
import { ProcessingProgress } from "../components/processing-progress";
import { ToolPageHeader } from "../components/tool-page-header";
import {
  formatTranscript,
  type TranscriptCasing,
  type TranscriptExportFormat,
  type TranscriptSegment,
  type TranscriptStyle,
  type TranscriptTimestampFormat,
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

export default function AudioTranscribe() {
  const workerRef = useRef<Worker | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [backend, setBackend] = useState("");
  const [error, setError] = useState("");

  const [language, setLanguage] = useState("auto");
  const [task, setTask] = useState<"transcribe" | "translate">("transcribe");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);

  const [style, setStyle] = useState<TranscriptStyle>("clean");
  const [stripFillers, setStripFillers] = useState(true);
  const [includeTimestamps, setIncludeTimestamps] = useState(false);
  const [timestampFormat, setTimestampFormat] = useState<TranscriptTimestampFormat>("mm:ss");
  const [paragraphPause, setParagraphPause] = useState("1.5");
  const [casing, setCasing] = useState<TranscriptCasing>("preserve");
  const [maxLineWidth, setMaxLineWidth] = useState("0");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [exportFormat, setExportFormat] = useState<TranscriptExportFormat>("txt");
  const [manualOverride, setManualOverride] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  useEffect(() => () => {
    workerRef.current?.terminate();
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const formattedOutput = useMemo(
    () =>
      formatTranscript(segments, exportFormat, {
        style,
        stripFillers,
        includeTimestamps,
        timestampFormat,
        paragraphPauseSeconds: Number(paragraphPause) || 1.5,
        casing,
        maxLineWidth: Number(maxLineWidth) || 0,
        findText,
        replaceText,
      }),
    [segments, exportFormat, style, stripFillers, includeTimestamps, timestampFormat, paragraphPause, casing, maxLineWidth, findText, replaceText],
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
    setSegments([]);
    setManualOverride(null);
    setError("");
  }

  async function toggleMicRecording() {
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const recordedFile = new File([blob], `voice-recording-${Date.now()}.webm`, { type: blob.type });
        loadMedia(recordedFile);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Microphone access was denied or unavailable.");
    }
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

  function downloadOutput() {
    if (!displayedText) return;
    const mimeMap: Record<TranscriptExportFormat, string> = {
      txt: "text/plain",
      md: "text/markdown",
      srt: "application/x-subrip",
      vtt: "text/vtt",
      json: "application/json",
    };
    const blob = new Blob([displayedText], { type: `${mimeMap[exportFormat]};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const baseName = file ? file.name.replace(/\.[^.]+$/, "") : "transcript";
    anchor.href = url;
    anchor.download = `${baseName}.${exportFormat}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className={`resize-page${file ? " has-media" : ""}`}>
      <ToolPageHeader />
      <section className="resize-intro">
        <p className="eyebrow">AUDIO · ON-DEVICE WHISPER</p>
        <h1>Voice to transcript</h1>
        <p>Transcribe audio, video, or microphone recordings locally with Whisper Base (cached on first use) and customize output style and export format.</p>
      </section>

      {!file ? (
        <MediaImportScreen
          kind="audio"
          accept="audio/*,video/*"
          onFile={loadMedia}
          error={error}
          secondaryAction={{
            label: recording ? "Stop recording" : "Record from microphone",
            onClick: () => void toggleMicRecording(),
          }}
        />
      ) : (
        <section className="resize-workspace" aria-label="Voice to transcript workspace">
          <div className="resize-controls">
            <h2 className="editor-sidebar-title">Voice to Transcript</h2>
            <div className="image-layer-actions">
              <label className="file-picker" style={{ gridColumn: "1 / -1" }}>
                <span>Choose another audio/video</span>
                <input type="file" accept="audio/*,video/*" onChange={(e) => { loadMedia(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} />
              </label>
              <button type="button" className="secondary-button" style={{ gridColumn: "1 / -1" }} onClick={() => void toggleMicRecording()}>
                {recording ? "⏹ Stop microphone recording" : "🎙 Record new mic clip"}
              </button>
            </div>
            <p className="source-info">Source: {file.name}{backend ? ` · ${backend}` : ""}</p>

            <details className="editor-control-group" open>
              <summary>Recognition (Whisper Base)</summary>
              <div className="editor-control-content">
                <div className="dimension-fields">
                  <label className="ratio-field">Language<select value={language} onChange={(e) => setLanguage(e.currentTarget.value)}>{LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
                  <label className="ratio-field">Task<select value={task} onChange={(e) => setTask(e.currentTarget.value as "transcribe" | "translate")}><option value="transcribe">Transcribe</option><option value="translate">Translate to English</option></select></label>
                </div>
                <button type="button" className="export-button" disabled={transcribing} onClick={() => void runTranscription()}>
                  {transcribing ? "Transcribing…" : segments.length ? "Re-transcribe locally" : "Transcribe locally"}
                </button>
                {transcribing && <>
                  <ProcessingProgress label={phase || "Running Whisper Base on this device"} value={progress / 100} />
                  <button type="button" className="secondary-button" onClick={cancelTranscription}>Cancel transcription</button>
                </>}
              </div>
            </details>

            <details className="editor-control-group" open>
              <summary>Output style & formatting</summary>
              <div className="editor-control-content">
                <label className="ratio-field">Output style<select value={style} onChange={(e) => { setStyle(e.currentTarget.value as TranscriptStyle); setManualOverride(null); }}>
                  <option value="clean">Clean paragraphs</option>
                  <option value="verbatim">Verbatim lines</option>
                  <option value="paragraphs">Pause-split paragraphs</option>
                  <option value="bullets">Bullet notes</option>
                  <option value="timestamps">Timestamped blocks</option>
                </select></label>
                <div className="dimension-fields">
                  <label className="ratio-field">Casing<select value={casing} onChange={(e) => { setCasing(e.currentTarget.value as TranscriptCasing); setManualOverride(null); }}>
                    <option value="preserve">Preserve</option>
                    <option value="sentence">Sentence case</option>
                    <option value="lower">lowercase</option>
                    <option value="upper">UPPERCASE</option>
                  </select></label>
                  <label className="ratio-field">Format<select value={exportFormat} onChange={(e) => { setExportFormat(e.currentTarget.value as TranscriptExportFormat); setManualOverride(null); }}>
                    <option value="txt">Plain Text (.txt)</option>
                    <option value="md">Markdown (.md)</option>
                    <option value="srt">SubRip (.srt)</option>
                    <option value="vtt">WebVTT (.vtt)</option>
                    <option value="json">JSON (.json)</option>
                  </select></label>
                </div>
                <div className="dimension-fields">
                  <label>Pause split <span>sec</span><input type="number" min="0.2" max="30" step="0.1" value={paragraphPause} onChange={(e) => { setParagraphPause(e.currentTarget.value); setManualOverride(null); }} /></label>
                  <label>Max line width <span>chars (0=off)</span><input type="number" min="0" max="240" step="1" value={maxLineWidth} onChange={(e) => { setMaxLineWidth(e.currentTarget.value); setManualOverride(null); }} /></label>
                </div>
                <label className="ratio-toggle"><input type="checkbox" checked={stripFillers} onChange={(e) => { setStripFillers(e.currentTarget.checked); setManualOverride(null); }} /> Strip filler words (um, uh, erm)</label>
                <label className="ratio-toggle"><input type="checkbox" checked={includeTimestamps} onChange={(e) => { setIncludeTimestamps(e.currentTarget.checked); setManualOverride(null); }} /> Include timestamps</label>
                {includeTimestamps && (
                  <label className="ratio-field">Timestamp format<select value={timestampFormat} onChange={(e) => { setTimestampFormat(e.currentTarget.value as TranscriptTimestampFormat); setManualOverride(null); }}><option value="mm:ss">MM:SS</option><option value="hh:mm:ss">HH:MM:SS</option></select></label>
                )}
                <div className="dimension-fields">
                  <label>Find<input type="text" value={findText} placeholder="e.g. local studio" onChange={(e) => { setFindText(e.currentTarget.value); setManualOverride(null); }} /></label>
                  <label>Replace<input type="text" value={replaceText} placeholder="Local Studio" onChange={(e) => { setReplaceText(e.currentTarget.value); setManualOverride(null); }} /></label>
                </div>
              </div>
            </details>

            {error && <p className="resize-error" role="alert">{error}</p>}
            <button type="button" className="export-button" disabled={!displayedText} onClick={downloadOutput}>
              Download .{exportFormat}
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
                <span>{segments.length} segment(s) · {exportFormat.toUpperCase()}</span>
              </div>
            </div>
            <audio className="audio-preview-player" controls src={audioUrl} />
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
