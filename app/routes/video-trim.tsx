import { ToolPageHeader } from "../components/tool-page-header";
import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/video-trim";
import { MediaImportScreen } from "../components/media-import-screen";
import { ProcessingProgress } from "../components/processing-progress";
import { CustomMediaPreview } from "../components/custom-media-preview";

const MAX_INPUT_BYTES = 512 * 1024 * 1024;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Trim video | OpenProducer Editor" },
    { name: "description", content: "Trim a local video and export an MP4 in your browser." },
  ];
}

export default function VideoTrim() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trimTimelineRef = useRef<HTMLDivElement>(null);
  const stopAtRef = useRef<number | null>(null);
  const playbackRaf = useRef<number | null>(null);
  const playheadGesture = useRef<number | null>(null);
  const timelineGesture = useRef<{ pointerId: number; mode: "start" | "end" | "move" | "create"; anchor: number; start: number; end: number; originX: number; moved: boolean } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState("0.000");
  const [end, setEnd] = useState("");
  const [trimMode, setTrimMode] = useState<"keep" | "remove">("keep");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [resultName, setResultName] = useState("");
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);
  useEffect(() => { setResultUrl(""); setResultName(""); }, [start, end, trimMode]);
  useEffect(() => () => { if (playbackRaf.current !== null) cancelAnimationFrame(playbackRaf.current); }, []);

  function selectFile(next: File | undefined) {
    setError(""); setProgress(null); setDuration(0); setEnd(""); setPlayhead(0); setPlaying(false); setVideoDimensions(null);
    setFile(next ?? null);
    setSourceUrl(next ? URL.createObjectURL(next) : "");
    setResultUrl(""); setResultName("");
    if (next && next.size > MAX_INPUT_BYTES) setError("This prototype accepts files up to 512 MiB to limit browser memory use.");
  }

  const from = Number(start), to = Number(end || duration);
  const precise = (value: number) => (Math.round(value * 1000) / 1000).toFixed(3);
  function timeFromTimeline(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(duration, (event.clientX - bounds.left) / bounds.width * duration));
  }
  function timeAtClientX(clientX: number) {
    const bounds = trimTimelineRef.current?.getBoundingClientRect();
    return bounds && duration ? Math.max(0, Math.min(duration, (clientX - bounds.left) / bounds.width * duration)) : 0;
  }
  function updateTimelineCursor(event: React.PointerEvent<HTMLDivElement>) {
    if (!duration || timelineGesture.current?.pointerId === event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const startX = from / duration * bounds.width;
    const endX = to / duration * bounds.width;
    const nearHandle = Math.min(Math.abs(x - startX), Math.abs(x - endX)) <= 7;
    event.currentTarget.style.cursor = nearHandle ? "ew-resize" : "auto";
  }
  function beginTimeline(event: React.PointerEvent<HTMLDivElement>) {
    if (!duration || progress !== null) return;
    const value = timeFromTimeline(event), tolerance = duration * 7 / Math.max(1, event.currentTarget.clientWidth);
    const mode = Math.abs(value - from) <= tolerance ? "start" : Math.abs(value - to) <= tolerance ? "end" : value > from && value < to ? "move" : "create";
    timelineGesture.current = { pointerId: event.pointerId, mode, anchor: value, start: from, end: to, originX: event.clientX, moved: false };
    event.currentTarget.style.cursor = mode === "start" || mode === "end" ? "ew-resize" : "auto";
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function moveTimeline(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = timelineGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !duration) return;
    if (!gesture.moved && Math.abs(event.clientX - gesture.originX) < 3) return;
    gesture.moved = true;
    if (gesture.mode === "move") event.currentTarget.style.cursor = "grabbing";
    const value = timeFromTimeline(event), minLength = Math.min(.01, duration);
    if (gesture.mode === "start") setStart(precise(Math.max(0, Math.min(to - minLength, value))));
    else if (gesture.mode === "end") setEnd(precise(Math.max(from + minLength, Math.min(duration, value))));
    else if (gesture.mode === "create") { setStart(precise(Math.min(gesture.anchor, value))); setEnd(precise(Math.max(gesture.anchor + minLength, value))); }
    else {
      const length = gesture.end - gesture.start, nextStart = Math.max(0, Math.min(duration - length, gesture.start + value - gesture.anchor));
      setStart(precise(nextStart)); setEnd(precise(nextStart + length));
    }
  }
  function togglePlayback() {
    const video = videoRef.current;
    if (!video || !duration || to <= from) return;
    if (!video.paused) { video.pause(); setPlaying(false); return; }
    if (trimMode === "keep") {
      if (video.currentTime < from || video.currentTime >= to) video.currentTime = from;
      stopAtRef.current = to;
    } else {
      const hasFirst = from > 0.001;
      const hasSecond = duration - to > 0.001;
      if (!hasFirst && !hasSecond) return;
      if (!hasFirst || (video.currentTime >= from && video.currentTime < to) || video.currentTime >= duration - 0.001) {
        video.currentTime = hasFirst && video.currentTime >= duration - 0.001 ? 0 : hasSecond ? to : 0;
      }
      stopAtRef.current = hasSecond ? duration : from;
    }
    void video.play().then(() => setPlaying(true)).catch(() => setError("Video playback was blocked. Press Play again to preview."));
  }
  function syncPlayheadContinuously() {
    const video = videoRef.current;
    if (!video) { playbackRaf.current = null; return; }
    let time = video.currentTime;
    if (trimMode === "remove" && time >= from && time < to) {
      if (duration - to > 0.001) {
        video.currentTime = to;
        time = to;
      } else {
        video.pause(); stopAtRef.current = null; setPlaying(false); playbackRaf.current = null; setPlayhead(from); return;
      }
    }
    setPlayhead(time);
    if (stopAtRef.current !== null && time >= stopAtRef.current) {
      video.pause(); stopAtRef.current = null; setPlaying(false); playbackRaf.current = null; return;
    }
    if (!video.paused && !video.ended) playbackRaf.current = requestAnimationFrame(syncPlayheadContinuously);
    else playbackRaf.current = null;
  }
  function startPlayheadSync() {
    if (playbackRaf.current !== null) cancelAnimationFrame(playbackRaf.current);
    playbackRaf.current = requestAnimationFrame(syncPlayheadContinuously);
  }
  function stopPlayheadSync() {
    if (playbackRaf.current !== null) cancelAnimationFrame(playbackRaf.current);
    playbackRaf.current = null;
    if (videoRef.current) setPlayhead(videoRef.current.currentTime);
  }
  function beginPlayheadDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (!duration || progress !== null) return;
    event.preventDefault(); event.stopPropagation(); playheadGesture.current = event.pointerId;
    event.currentTarget.style.cursor = "grabbing";
    event.currentTarget.setPointerCapture(event.pointerId); seekTo(timeAtClientX(event.clientX));
  }
  function movePlayheadDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (playheadGesture.current !== event.pointerId) return;
    event.stopPropagation(); seekTo(timeAtClientX(event.clientX));
  }
  function finishPlayheadDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (playheadGesture.current === event.pointerId) playheadGesture.current = null;
    event.currentTarget.style.cursor = "grab";
    event.stopPropagation();
  }
  function finishTimeline(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = timelineGesture.current;
    if (gesture?.pointerId !== event.pointerId) return;
    if (!gesture.moved) seekTo(timeFromTimeline(event));
    timelineGesture.current = null;
    updateTimelineCursor(event);
  }
  function seekTo(value: number) {
    const time = Math.max(0, Math.min(duration, value));
    setPlayhead(time); if (videoRef.current) videoRef.current.currentTime = time;
  }

  async function exportTrim() {
    if (!file || !duration || file.size > MAX_INPUT_BYTES) return;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to > duration || to <= from) {
      setError("Enter a valid range: start must be below end, and end must not exceed the video duration."); return;
    }
    const keptRanges: Array<[number, number]> = trimMode === "keep"
      ? [[from, to]]
      : [
          ...(from > 0.001 ? [[0, from] as [number, number]] : []),
          ...(duration - to > 0.001 ? [[to, duration] as [number, number]] : []),
        ];
    if (keptRanges.length === 0) {
      setError("Cannot remove the entire video. Narrow the selection to keep at least one part."); return;
    }
    setError(""); setProgress(0); setResultUrl("");
    try {
      const mediabunny = await import("mediabunny");
      const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } = mediabunny;
      const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const target = new BufferTarget();
      const output = new Output({ format: new Mp4OutputFormat(), target });

      if (keptRanges.length === 1) {
        const [keepStart, keepEnd] = keptRanges[0];
        const conversion = await Conversion.init({ input, output, tracks: "primary", trim: { start: keepStart, end: keepEnd } });
        if (!conversion.isValid) throw new Error("The browser could not prepare a compatible audio/video export for this file.");
        conversion.onProgress = (value) => setProgress(Math.round(value * 100));
        await conversion.execute();
        input.dispose();
      } else {
        const { AudioSampleSink, AudioSampleSource, Quality, VideoSampleSink, VideoSampleSource, canEncodeAudio, canEncodeVideo } = mediabunny;
        try {
          const videoTrack = await input.getPrimaryVideoTrack();
          if (!videoTrack || !(await videoTrack.canDecode())) {
            throw new Error("This browser cannot decode the video track in this file.");
          }
          const rawAudioTrack = await input.getPrimaryAudioTrack();
          const audioTrack = rawAudioTrack && (await rawAudioTrack.canDecode()) ? rawAudioTrack : null;
          const width = Math.max(2, Math.round(videoTrack.displayWidth));
          const height = Math.max(2, Math.round(videoTrack.displayHeight));
          const evenWidth = width % 2 === 0 ? width : width - 1;
          const evenHeight = height % 2 === 0 ? height : height - 1;
          const targetBitrate = Math.max(2_000_000, Math.min(20_000_000, Math.round(evenWidth * evenHeight * 4)));
          if (!(await canEncodeVideo("avc", { width: evenWidth, height: evenHeight, bitrate: targetBitrate }))) {
            throw new Error("This browser cannot encode H.264/MP4 video for multi-segment removal.");
          }
          const canAac = audioTrack
            ? await canEncodeAudio("aac", {
                numberOfChannels: Math.max(1, Math.min(2, audioTrack.numberOfChannels)),
                sampleRate: audioTrack.sampleRate || 48_000,
                bitrate: 192_000,
              })
            : false;

          const videoSource = new VideoSampleSource({ codec: "avc", quality: new Quality({ bitrate: targetBitrate }) });
          output.addVideoTrack(videoSource);
          const audioSource = audioTrack && canAac
            ? new AudioSampleSource({ codec: "aac", quality: new Quality({ bitrate: 192_000 }) })
            : null;
          if (audioSource) output.addAudioTrack(audioSource);

          await output.start();
          const totalKept = keptRanges.reduce((sum, [s, e]) => sum + (e - s), 0);
          const videoMaxProgress = audioSource ? 60 : 95;
          const videoSink = new VideoSampleSink(videoTrack);
          let videoOffset = 0;
          let lastVideoTimestamp = -1e-4;
          for (const [segStart, segEnd] of keptRanges) {
            let maxLocalEnd = 0;
            for await (const sample of videoSink.samples(segStart, segEnd)) {
              try {
                const localStart = Math.max(0, sample.timestamp - segStart);
                const nextTs = Math.max(lastVideoTimestamp + 1e-4, videoOffset + localStart);
                lastVideoTimestamp = nextTs;
                maxLocalEnd = Math.max(maxLocalEnd, localStart + (sample.duration || 1 / 30));
                sample.setTimestamp(nextTs);
                await videoSource.add(sample);
                if (totalKept > 0) setProgress(Math.min(videoMaxProgress, Math.round((nextTs / totalKept) * videoMaxProgress)));
              } finally {
                sample.close();
              }
            }
            videoOffset += Math.max(segEnd - segStart, maxLocalEnd);
          }

          if (audioSource && audioTrack) {
            const audioSink = new AudioSampleSink(audioTrack);
            let audioOffset = 0;
            let lastAudioTimestamp = -1e-4;
            for (const [segStart, segEnd] of keptRanges) {
              let maxLocalEnd = 0;
              for await (const sample of audioSink.samples(segStart, segEnd)) {
                try {
                  const localStart = Math.max(0, sample.timestamp - segStart);
                  const nextTs = Math.max(lastAudioTimestamp + 1e-4, audioOffset + localStart);
                  lastAudioTimestamp = nextTs;
                  maxLocalEnd = Math.max(maxLocalEnd, localStart + (sample.duration || 0));
                  sample.setTimestamp(nextTs);
                  await audioSource.add(sample);
                  if (totalKept > 0) setProgress(Math.min(96, videoMaxProgress + Math.round((nextTs / totalKept) * (96 - videoMaxProgress))));
                } finally {
                  sample.close();
                }
              }
              audioOffset += Math.max(segEnd - segStart, maxLocalEnd);
            }
          }

          setProgress(99);
          await output.finalize();
        } finally {
          input.dispose();
        }
      }

      if (!target.buffer) throw new Error("Export completed without producing an MP4 file.");
      const blob = new Blob([target.buffer], { type: "video/mp4" });
      setResultUrl(URL.createObjectURL(blob));
      setResultName(`${file.name.replace(/\.[^.]+$/, "")}-${trimMode === "keep" ? "trimmed" : "selection-removed"}.mp4`);
      setProgress(null);
    } catch (cause) {
      setProgress(null);
      setError(cause instanceof Error ? cause.message : "Video export failed. Try another file or a shorter range.");
    }
  }

  const selectedDuration = Number.isFinite(from) && Number.isFinite(to) ? Math.max(0, to - from) : 0;
  const outputDuration = trimMode === "keep" ? selectedDuration : Math.max(0, duration - selectedDuration);
  const selectionValid = Boolean(duration && Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to > from && to <= duration && outputDuration > 0.001);

  return <main className={`resize-page video-tool-page video-trim-page${file ? " has-media" : ""}`}>
    <ToolPageHeader status={selectionValid ? `${outputDuration.toFixed(2)} s MP4` : undefined} />
    <section className="resize-intro">
      <p className="eyebrow">VIDEO · LOCAL PROCESSING</p>
      <h1>Trim a video</h1>
      <p>Choose a range on the timeline or enter exact times. Processing and export happen in this browser.</p>
    </section>
    {!file ? <MediaImportScreen kind="video" accept="video/*,.mkv,.webm" onFile={selectFile} error={error} /> : <section className="resize-workspace video-trim-workspace">
      <div className="resize-controls">
        <div className="audio-file-bar">
          <div className="audio-file-meta">
            <strong>{file.name}</strong>
            <span>{(file.size / 1024 / 1024).toFixed(1)} MiB{videoDimensions ? ` · ${videoDimensions.width}×${videoDimensions.height}` : ""}{duration ? ` · ${duration.toFixed(3)} s` : " · Reading…"}</span>
          </div>
          <label className="audio-file-change">
            <span>Change file</span>
            <input type="file" accept="video/*,.mkv,.webm" onChange={(event) => selectFile(event.currentTarget.files?.[0])} />
          </label>
        </div>

        <div className="audio-control-group">
          <fieldset className="trim-mode-toggle">
            <legend>Trim mode</legend>
            <label>
              <input type="radio" name="video-trim-mode" checked={trimMode === "keep"} onChange={() => setTrimMode("keep")} />
              Keep
            </label>
            <label>
              <input type="radio" name="video-trim-mode" checked={trimMode === "remove"} onChange={() => setTrimMode("remove")} />
              Remove
            </label>
          </fieldset>
        </div>

        <div className="audio-control-group">
          <p className="audio-control-group-title">Exact range</p>
          <div className="dimension-fields">
            <label>Start time <span>s</span><input type="number" min="0" max={duration || undefined} step="0.001" value={start} onBlur={() => { const value = Number(start); if (Number.isFinite(value)) setStart(precise(value)); }} onChange={(event) => setStart(event.currentTarget.value)} /></label>
            <label>End time <span>s</span><input type="number" min="0" max={duration || undefined} step="0.001" value={end} placeholder={duration ? duration.toFixed(3) : "Video duration"} onBlur={() => { const value = Number(end); if (Number.isFinite(value)) setEnd(precise(value)); }} onChange={(event) => setEnd(event.currentTarget.value)} /></label>
          </div>
        </div>

        <div className="audio-output-summary">
          <div>
            <span>Selected</span>
            <strong>{to > from ? `${selectedDuration.toFixed(3)} s` : "—"}</strong>
          </div>
          <div>
            <span>{trimMode === "keep" ? "Trimmed MP4" : "Edited MP4"}</span>
            <strong>{selectionValid ? `${outputDuration.toFixed(3)} s` : "—"}</strong>
          </div>
        </div>

        <p className="resize-note">MP4 output. Timeline handles and exact time fields edit the same selection.</p>
        {error && <p className="resize-error" role="alert">{error}</p>}
        {progress !== null && <ProcessingProgress label={trimMode === "keep" ? "Exporting trimmed video" : "Removing selection & exporting MP4"} value={progress} />}
        <button className="export-button" disabled={!selectionValid || progress !== null || file.size > MAX_INPUT_BYTES} onClick={exportTrim}>
          {progress !== null ? "Exporting…" : trimMode === "keep" ? "Export trimmed MP4" : "Export edited MP4"}
        </button>
        {resultUrl && <a className="export-button secondary-button download-link" href={resultUrl} download={resultName}>Download {resultName}</a>}
      </div>

      <div className={`resize-preview video-stage video-trim-preview${resultUrl ? " video-trim-result-preview" : ""}`}>
        <div className="preview-heading">
          <strong>{resultUrl ? (trimMode === "keep" ? "Trimmed video result" : "Edited video result") : "Video preview"}</strong>
          <span>{resultUrl ? `${outputDuration.toFixed(3)} s · ${trimMode === "keep" ? "kept selection" : "selection removed"}` : duration ? `${playhead.toFixed(3)} / ${duration.toFixed(3)} s` : "Loading video metadata…"}</span>
        </div>
        {resultUrl ? <>
          <CustomMediaPreview kind="video" src={resultUrl} label={trimMode === "keep" ? "Trimmed video result" : "Edited video result"} className="video-trim-result-media" />
          <button type="button" className="editor-action" onClick={() => { setResultUrl(""); setResultName(""); }}>Edit selection</button>
        </> : <>
          <div className="trim-video-stage">
            {sourceUrl && <video ref={videoRef} className="trim-video-surface" src={sourceUrl} playsInline preload="metadata" onLoadedMetadata={(event) => { const video = event.currentTarget; const length = video.duration; if (Number.isFinite(length)) { setDuration(length); setEnd(precise(length)); } if (video.videoWidth && video.videoHeight) setVideoDimensions({ width: video.videoWidth, height: video.videoHeight }); }} onTimeUpdate={(event) => { const video = event.currentTarget; let time = video.currentTime; if (trimMode === "remove" && !video.paused && time >= from && time < to) { if (duration - to > 0.001) { video.currentTime = to; time = to; } else { video.pause(); stopAtRef.current = null; setPlaying(false); setPlayhead(from); return; } } setPlayhead(time); if (stopAtRef.current !== null && time >= stopAtRef.current) { video.pause(); stopAtRef.current = null; setPlaying(false); } }} onPlay={() => { setPlaying(true); startPlayheadSync(); }} onPause={() => { setPlaying(false); stopPlayheadSync(); }} onEnded={() => { setPlaying(false); stopPlayheadSync(); }} />}
          </div>
          {duration > 0 && <>
            <div className="video-trim-ruler"><span>0.000 s</span><span>{duration.toFixed(3)} s</span></div>
            <div className={`video-trim-timeline${trimMode === "remove" ? " is-remove" : ""}`} ref={trimTimelineRef} role="group" aria-label="Video trim timeline. Click to seek. Drag the range edges to trim, drag inside the range to move it, or drag outside to create a new selection." onPointerDown={beginTimeline} onPointerMove={(event) => { updateTimelineCursor(event); moveTimeline(event); }} onPointerLeave={(event) => { if (!timelineGesture.current) event.currentTarget.style.cursor = "auto"; }} onPointerUp={finishTimeline} onPointerCancel={finishTimeline}>
              <div className="video-trim-track" />
              <div className="video-trim-selected" style={{ left: `${Math.max(0, from / duration * 100)}%`, width: `${Math.max(0, (to - from) / duration * 100)}%` }} />
              <span className="video-range-handle start" style={{ left: `${Math.max(0, Math.min(100, from / duration * 100))}%` }} />
              <span className="video-range-handle end" style={{ left: `${Math.max(0, Math.min(100, to / duration * 100))}%` }} />
              <button type="button" className="video-trim-playhead" style={{ left: `${Math.max(0, Math.min(100, playhead / duration * 100))}%` }} aria-label="Drag to seek video trim playhead" onPointerDown={beginPlayheadDrag} onPointerMove={movePlayheadDrag} onPointerUp={finishPlayheadDrag} onPointerCancel={finishPlayheadDrag}><span /></button>
            </div>
            <div className="video-custom-transport">
              <button type="button" className="transport-play" onClick={togglePlayback} aria-label={playing ? "Pause video preview" : "Play video preview"}>{playing ? "Ⅱ" : "▶"}</button>
              <button type="button" className="transport-step" onClick={() => seekTo(playhead - 1 / 30)} aria-label="Step back one frame">−1f</button>
              <button type="button" className="transport-step" onClick={() => seekTo(playhead + 1 / 30)} aria-label="Step forward one frame">+1f</button>
              <input className="transport-scrub" type="range" min="0" max={duration} step="0.001" value={playhead} aria-label="Video preview playhead" onChange={(event) => seekTo(event.currentTarget.valueAsNumber)} />
            </div>
          </>}
        </>}
      </div>
    </section>}
  </main>;
}
