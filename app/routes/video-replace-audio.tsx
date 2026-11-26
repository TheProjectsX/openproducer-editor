import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/video-replace-audio";
import { MediaImportScreen } from "../components/media-import-screen";
import { CustomMediaPreview } from "../components/custom-media-preview";
import { ProcessingProgress } from "../components/processing-progress";

const MAX_BYTES = 512 * 1024 * 1024;
const MAX_SOURCE_WAVE_BYTES = 128 * 1024 * 1024;
const MAX_TRACKS = 8;
const MAX_AUDIO_INPUT_BYTES = 128 * 1024 * 1024;
const MIX_SAMPLE_RATE = 48_000;
const MAX_MIX_SECONDS = 240;
const MAX_DECODED_AUDIO_SECONDS = 480;
type AudioLane = { id: string; file: File; url: string; duration: number; offset: string; volumeDb: string; enabled: boolean };

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Replace video audio | OpenProducer Editor" },
    { name: "description", content: "Replace a local video’s audio track with your own audio in the browser." },
  ];
}

export default function VideoReplaceAudio() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioLanes, setAudioLanes] = useState<AudioLane[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const audioUrls = useRef<string[]>([]);
  const [sourceAudioUrl, setSourceAudioUrl] = useState("");
  const [sourceAudioStatus, setSourceAudioStatus] = useState("");
  const [sourceAudioProgress, setSourceAudioProgress] = useState<number | null>(null);
  const [keepVideoAudio, setKeepVideoAudio] = useState(true);
  const [sourceVolumeDb, setSourceVolumeDb] = useState("0");
  const [duration, setDuration] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const laneDrag = useRef<{ id: string; pointerId: number; clientX: number; offset: number } | null>(null);
  const [resultUrl, setResultUrl] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => () => { audioUrls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  useEffect(() => () => { if (sourceAudioUrl) URL.revokeObjectURL(sourceAudioUrl); }, [sourceAudioUrl]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  useEffect(() => {
    if (!videoFile || !duration) return;
    let cancelled = false;
    let input: import("mediabunny").Input | undefined;
    setSourceAudioUrl(""); setSourceAudioProgress(0); setSourceAudioStatus("Preparing the source audio waveform…");
    void (async () => {
      try {
        if (44 + duration * 48_000 * 2 * 2 > MAX_SOURCE_WAVE_BYTES) throw new Error("Source audio is too long to decode for its waveform preview.");
        const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output, WavOutputFormat } = await import("mediabunny");
        input = new Input({ source: new BlobSource(videoFile), formats: ALL_FORMATS });
        const target = new BufferTarget();
        const conversion = await Conversion.init({ input, output: new Output({ format: new WavOutputFormat(), target }), tracks: "primary", video: { discard: true }, audio: { numberOfChannels: 2, sampleRate: 48_000, sampleFormat: "s16" } });
        if (!conversion.isValid || conversion.utilizedTracks.length === 0) throw new Error("This video has no supported source audio track.");
        conversion.onProgress = (value) => { if (!cancelled) setSourceAudioProgress(Math.round(value * 100)); };
        await conversion.execute();
        const buffer = target.buffer;
        if (!buffer || buffer.byteLength > MAX_SOURCE_WAVE_BYTES) throw new Error("The source-audio waveform would exceed the local preview memory limit.");
        const nextUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
        if (cancelled) URL.revokeObjectURL(nextUrl);
        else { setSourceAudioUrl(nextUrl); setSourceAudioStatus("Source video audio"); setSourceAudioProgress(null); }
      } catch (cause) {
        if (!cancelled) { setSourceAudioProgress(null); setSourceAudioStatus(cause instanceof Error ? cause.message : "Could not read the source audio waveform."); }
      } finally { input?.dispose(); }
    })();
    return () => { cancelled = true; input?.dispose(); };
  }, [videoFile, duration]);

  function chooseVideo(file?: File) {
    if (!file) return;
    if ((!file.type.startsWith("video/") && !/\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)) || file.size > MAX_BYTES) {
      setError("Choose a video up to 512 MiB."); return;
    }
    setVideoFile(file); setVideoUrl(URL.createObjectURL(file)); setDuration(0); setSourceAudioUrl(""); setSourceAudioStatus(""); setSourceAudioProgress(null); setResultUrl(""); setError(""); setKeepVideoAudio(true); setSourceVolumeDb("0");
  }

  function chooseAudio(files?: FileList | null) {
    if (!files?.length) return;
    const room = Math.max(0, MAX_TRACKS - audioLanes.length);
    const availableBytes = Math.max(0, MAX_AUDIO_INPUT_BYTES - audioLanes.reduce((sum, lane) => sum + lane.file.size, 0));
    if (room === 0) { setError(`A mix can contain up to ${MAX_TRACKS} added tracks.`); return; }
    let importMessage = files.length > room ? `Added the first ${room} file(s); a mix can contain up to ${MAX_TRACKS} added tracks.` : "";
    const incoming: AudioLane[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      if (!file.type.startsWith("audio/") || file.size > MAX_AUDIO_INPUT_BYTES) { importMessage = "Each added track must be audio and smaller than 128 MiB."; continue; }
      if (incoming.reduce((sum, lane) => sum + lane.file.size, 0) + file.size > availableBytes) { importMessage = "Added audio is limited to 128 MiB total to protect browser memory while mixing."; break; }
      const url = URL.createObjectURL(file); audioUrls.current.push(url);
      incoming.push({ id: crypto.randomUUID(), file, url, duration: 0, offset: "0", volumeDb: "0", enabled: true });
    }
    if (incoming.length) { setAudioLanes((current) => [...current, ...incoming]); setResultUrl(""); }
    if (importMessage) setError(importMessage);
    else if (incoming.length) setError("");
  }

  function updateLane(id: string, patch: Partial<Pick<AudioLane, "duration" | "offset" | "volumeDb" | "enabled">>) {
    setAudioLanes((current) => current.map((lane) => lane.id === id ? { ...lane, ...patch } : lane)); setResultUrl("");
  }
  function removeLane(lane: AudioLane) {
    URL.revokeObjectURL(lane.url); audioUrls.current = audioUrls.current.filter((url) => url !== lane.url);
    setAudioLanes((current) => current.filter((item) => item.id !== lane.id)); setResultUrl("");
  }
  function beginLaneDrag(event: React.PointerEvent<HTMLSpanElement>, lane: AudioLane) {
    if (!duration || progress !== null || !timelineRef.current) return;
    laneDrag.current = { id: lane.id, pointerId: event.pointerId, clientX: event.clientX, offset: Number(lane.offset) };
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function moveLaneDrag(event: React.PointerEvent<HTMLSpanElement>) {
    const drag = laneDrag.current, bounds = timelineRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !bounds || !duration) return;
    const next = Math.max(0, Math.min(duration - 0.001, drag.offset + (event.clientX - drag.clientX) / bounds.width * duration));
    updateLane(drag.id, { offset: String(Math.round(next * 1000) / 1000) });
  }

  const enabledLanes = audioLanes.filter((lane) => lane.enabled);
  const laneSettingsValid = enabledLanes.every((lane) => Number.isFinite(Number(lane.offset)) && Number(lane.offset) >= 0 && Number(lane.offset) < duration
    && lane.duration > 0 && Number.isFinite(lane.duration)
    && Number.isFinite(Number(lane.volumeDb)) && Number(lane.volumeDb) >= -60 && Number(lane.volumeDb) <= 6);
  const decodedAudioSeconds = (keepVideoAudio ? duration : 0) + enabledLanes.reduce((sum, lane) => sum + lane.duration, 0);
  const withinMemoryBudget = decodedAudioSeconds <= MAX_DECODED_AUDIO_SECONDS;
  const valid = Boolean(videoFile && duration > 0 && duration <= MAX_MIX_SECONDS && (keepVideoAudio || enabledLanes.length > 0) && laneSettingsValid && withinMemoryBudget && Number.isFinite(Number(sourceVolumeDb)) && Number(sourceVolumeDb) >= -60 && Number(sourceVolumeDb) <= 6);

  async function replaceAudio() {
    if (!videoFile || !duration || !valid) return;
    setProgress(0); setError(""); setResultUrl("");
    const inputs: import("mediabunny").Input[] = [];
    let decodeContext: AudioContext | undefined;
    let offlineContext: OfflineAudioContext | undefined;
    try {
      if (duration > MAX_MIX_SECONDS) throw new Error(`The current local mix is limited to ${MAX_MIX_SECONDS / 60} minutes to keep high-quality audio rendering within browser memory limits.`);
      if (!withinMemoryBudget) throw new Error("The total decoded audio duration is over the local browser memory budget. Disable or remove some long tracks.");
      const mixFrames = Math.ceil(duration * MIX_SAMPLE_RATE);
      if (mixFrames * 2 * Float32Array.BYTES_PER_ELEMENT > 192 * 1024 * 1024) throw new Error("This video is too long for the available in-memory mix preview.");
      const { ALL_FORMATS, AudioBufferSource, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, Quality, canEncodeAudio } = await import("mediabunny");
      if (!await canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: MIX_SAMPLE_RATE, bitrate: 192_000 })) {
        throw new Error("This browser cannot encode AAC audio for MP4 export. Try an up-to-date version of Chrome, Edge, or Safari.");
      }
      const target = new BufferTarget();
      const output = new Output({ format: new Mp4OutputFormat(), target });
      const videoInput = new Input({ source: new BlobSource(videoFile), formats: ALL_FORMATS }); inputs.push(videoInput);
      const videoConversion = await Conversion.init({
        input: videoInput, output, tracks: "primary", audio: { discard: true }, composable: true,
      });
      if (!videoConversion.isValid || videoConversion.utilizedTracks.length === 0) throw new Error("No compatible video track is available.");
      const audioSource = new AudioBufferSource({ codec: "aac", quality: new Quality({ bitrate: 192_000 }) });
      output.addAudioTrack(audioSource, { name: "Audio mix" });
      decodeContext = new AudioContext({ sampleRate: MIX_SAMPLE_RATE });
      offlineContext = new OfflineAudioContext({ numberOfChannels: 2, length: mixFrames, sampleRate: MIX_SAMPLE_RATE });
      const mixBus = offlineContext.createDynamicsCompressor();
      mixBus.threshold.value = -2; mixBus.knee.value = 6; mixBus.ratio.value = 8; mixBus.attack.value = 0.003; mixBus.release.value = 0.18;
      mixBus.connect(offlineContext.destination);
      const decodeAndSchedule = async (blob: Blob, offset: number, gainDb: number) => {
        const encoded = await blob.arrayBuffer();
        const decoded = await decodeContext!.decodeAudioData(encoded);
        if (offset >= duration || decoded.duration <= 0) return;
        const source = offlineContext!.createBufferSource(); source.buffer = decoded;
        const gain = offlineContext!.createGain(); gain.gain.value = 10 ** (gainDb / 20);
        source.connect(gain).connect(mixBus);
        source.start(offset);
      };
      if (keepVideoAudio) {
        if (!sourceAudioUrl) throw new Error("The video's original audio is not ready. Wait for its waveform to finish loading.");
        await decodeAndSchedule(await (await fetch(sourceAudioUrl)).blob(), 0, Number(sourceVolumeDb));
      }
      for (const lane of enabledLanes) {
        await decodeAndSchedule(lane.file, Number(lane.offset), Number(lane.volumeDb));
      }
      setProgress(15);
      const mixedAudio = await offlineContext.startRendering();
      setProgress(50);
      await output.start();
      await Promise.all([videoConversion.execute(), audioSource.add(mixedAudio)]);
      audioSource.close();
      setProgress(90);
      await output.finalize();
      if (!target.buffer) throw new Error("Conversion finished without producing an MP4.");
      if (target.buffer.byteLength > MAX_BYTES) throw new Error("The output MP4 exceeds the 512 MiB memory limit.");
      setResultUrl(URL.createObjectURL(new Blob([target.buffer], { type: "video/mp4" })));
      setProgress(null);
    } catch (cause) {
      setProgress(null); setError(cause instanceof Error ? cause.message : "Could not replace the video audio track.");
    } finally { inputs.forEach((input) => input.dispose()); await decodeContext?.close().catch(() => undefined); }
  }

  return <main className={`resize-page video-tool-page video-replace-audio-page${videoFile ? " has-media" : ""}`}>
    <ToolPageHeader status={duration ? `${duration.toFixed(2)} s · ${enabledLanes.length + Number(keepVideoAudio)} track(s)` : undefined} />
    <section className="resize-intro"><p className="eyebrow">VIDEO · LOCAL PROCESSING</p><h1>Video audio mixer</h1><p>Keep or mute the source audio, add audio lanes, set timing and levels, then export one composed audio mix with the video.</p></section>
    {!videoFile ? <MediaImportScreen kind="video" accept="video/*,.mkv,.webm" onFile={chooseVideo} error={error} /> : <section className="resize-workspace">
      <div className="resize-controls">
        <div className="audio-file-bar">
          <div className="audio-file-meta">
            <strong>{videoFile.name}</strong>
            <span>{(videoFile.size / 1024 / 1024).toFixed(1)} MiB{duration ? ` · ${duration.toFixed(3)} s` : " · Reading…"}</span>
          </div>
          <label className="audio-file-change">
            <span>Change file</span>
            <input type="file" accept="video/*,.mkv,.webm" onChange={(event) => chooseVideo(event.currentTarget.files?.[0])} />
          </label>
        </div>
        <fieldset className="mix-controller"><legend>Master audio controller</legend>
          <label className="ratio-toggle"><input type="checkbox" checked={keepVideoAudio} onChange={(event) => { setKeepVideoAudio(event.currentTarget.checked); setResultUrl(""); }} /> Keep the original video audio</label>
          {keepVideoAudio && <label className="speed-field">Source audio level <span>−60 to +6 dB</span><input type="number" min="-60" max="6" step="0.1" value={sourceVolumeDb} onChange={(event) => { setSourceVolumeDb(event.currentTarget.value); setResultUrl(""); }} /></label>}
          <p className="resize-note">Enabled tracks mix into one audio track. Drag a lane on the timeline to position it.</p>
        </fieldset>
        <label className="file-picker add-audio-lanes"><span>+ Add audio tracks<input type="file" accept="audio/*" multiple onChange={(event) => { chooseAudio(event.currentTarget.files); event.currentTarget.value = ""; }} /></span></label>
        {!audioLanes.length && <p className="resize-note">Add one or more local audio files to layer over the video.</p>}
        {audioLanes.map((lane, index) => <fieldset className="mix-track-panel" key={lane.id}>
          <legend>Audio {index + 1}</legend>
          <div className="mix-track-heading"><label className="ratio-toggle"><input type="checkbox" checked={lane.enabled} onChange={(event) => updateLane(lane.id, { enabled: event.currentTarget.checked })} /> Include</label><button type="button" className="editor-action danger" onClick={() => removeLane(lane)}>Remove</button></div>
          <strong className="mix-track-name">{lane.file.name} · {lane.duration ? `${lane.duration.toFixed(3)} s` : "Reading…"}</strong>
          <div className="dimension-fields"><label>Start offset <span>s</span><input type="number" min="0" max={duration} step="0.001" value={lane.offset} onChange={(event) => updateLane(lane.id, { offset: event.currentTarget.value })} /></label><label>Level <span>dB</span><input type="number" min="-60" max="6" step="0.1" value={lane.volumeDb} onChange={(event) => updateLane(lane.id, { volumeDb: event.currentTarget.value })} /></label></div>
          {duration > 0 && <input className="transport-scrub" type="range" min="0" max={Math.max(0, duration - 0.001)} step="0.001" value={Math.min(Number(lane.offset) || 0, duration - 0.001)} aria-label={`${lane.file.name} track start offset`} onChange={(event) => updateLane(lane.id, { offset: String(event.currentTarget.valueAsNumber) })} />}
          <CustomMediaPreview kind="audio" src={lane.url} label={`${lane.file.name} preview`} onDuration={(value) => updateLane(lane.id, { duration: value })} />
        </fieldset>)}
        {sourceAudioProgress !== null && <ProcessingProgress label="Reading source audio" value={sourceAudioProgress} />}
        {sourceAudioStatus && sourceAudioProgress === null && <p className="source-info" role="status">{sourceAudioStatus}</p>}
        {!valid && duration > 0 && <p className="resize-error" role="alert">{!withinMemoryBudget ? "Combined audio exceeds the decoded-memory budget. Disable or remove long tracks." : duration > MAX_MIX_SECONDS ? `This local mixer supports video up to ${MAX_MIX_SECONDS / 60} minutes.` : "Keep source audio or enable an extra track with valid offset and level."}</p>}
        {error && <p className="resize-error" role="alert">{error}</p>}
        {progress !== null && <ProcessingProgress label="Composing video and audio tracks" value={progress} />}
        <button className="export-button" disabled={!valid || progress !== null || sourceAudioProgress !== null} onClick={() => void replaceAudio()}>{progress !== null ? "Building mix…" : resultUrl ? "Rebuild mix preview" : "Preview and export mixed video"}</button>
        {resultUrl && <a className="export-button secondary-button download-link" href={resultUrl} download={`${videoFile.name.replace(/\.[^.]+$/, "")}-audio-mix.mp4`}>Download MP4</a>}
      </div>
      <div className="resize-preview video-stage">
        <div className="preview-heading"><strong>{resultUrl ? "Mixed video result" : "Video preview"}</strong><span>{resultUrl ? "Audio track mix" : duration ? `${duration.toFixed(3)} s · original source` : "Loading video…"}</span></div>
        {resultUrl ? <CustomMediaPreview kind="video" src={resultUrl} label="Video with composed audio tracks" className="video-stage-media" /> : videoUrl ? <CustomMediaPreview kind="video" src={videoUrl} label="Original video preview" className="video-stage-media" onDuration={setDuration} /> : <div className="empty-preview">Choose a video and audio tracks.</div>}
        {duration > 0 && <div className="replace-audio-timeline"><div className="preview-heading"><strong>Audio timeline</strong><span>Drag a lane to adjust start time</span></div><div className="replace-lane" ref={timelineRef} style={{ height: `${Math.max(52, 40 + 17 * (enabledLanes.length + Number(keepVideoAudio)))}px` }}>
          <span className="replace-video-lane">VIDEO · {duration.toFixed(3)} s</span>
          {keepVideoAudio && <span className="replace-audio-lane source-audio-lane" style={{ left: "0%", width: "100%" }}>SOURCE AUDIO · {Number(sourceVolumeDb).toFixed(1)} dB</span>}
          {enabledLanes.map((lane, index) => { const laneOffset = Number(lane.offset) || 0; const laneDuration = lane.duration || duration - laneOffset; return <span key={lane.id} className={`replace-audio-lane mix-track-color-${index % 4}`} style={{ left: `${Math.max(0, Math.min(100, laneOffset / duration * 100))}%`, width: `${Math.max(2, Math.min(100 - laneOffset / duration * 100, laneDuration / duration * 100))}%`, top: `${19 + (keepVideoAudio ? 17 : 0) + index * 17}px` }} onPointerDown={(event) => beginLaneDrag(event, lane)} onPointerMove={moveLaneDrag} onPointerUp={(event) => { if (laneDrag.current?.pointerId === event.pointerId) laneDrag.current = null; }} onPointerCancel={() => { laneDrag.current = null; }}>⠿ {lane.file.name}</span>; })}
        </div><div className="timeline-time-labels"><span>0.000 s</span><span>{duration.toFixed(3)} s</span></div></div>}
      </div>
    </section>}
  </main>;
}
