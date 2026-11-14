import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/studio-video";
import { getProject, readVideoAsset, saveVideoTimeline, type VideoTimelineAsset, type VideoTimelineClip, type VideoTimelineProject } from "../lib/project-store";

const EMPTY: VideoTimelineProject = { version: 1, width: 1920, height: 1080, fps: 30, duration: 0, playhead: 0, assets: [], clips: [] };
const MAX_ASSET_BYTES = 256 * 1024 * 1024;

export function meta({}: Route.MetaArgs) { return [{ title: "Video Studio | Local Studio" }, { name: "robots", content: "noindex,nofollow" }]; }

function clipLength(clip: VideoTimelineClip) { return Math.max(0, (clip.sourceEnd - clip.sourceStart) / clip.speed); }

export default function VideoStudio() {
  const [params] = useSearchParams();
  const projectId = params.get("project") ?? "";
  const [timeline, setTimeline] = useState<VideoTimelineProject>(EMPTY);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("Create a video project from Projects, or import files to begin.");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState("60");
  const previewRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const selectedClip = timeline.clips.find((clip) => clip.id === selected);
  const selectedAsset = selectedClip && timeline.assets.find((asset) => asset.id === selectedClip.assetId);
  const sourceFile = selectedClip ? files[selectedClip.assetId] : undefined;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (!projectId) { setError("Open a video workspace from Projects to save the timeline."); return; }
    void (async () => {
      try {
        const project = await getProject(projectId);
        if (!project || project.kind !== "video") throw new Error("This video workspace is missing or has the wrong project type.");
        const saved = project.videoTimeline ?? EMPTY;
        const loaded = await Promise.all(saved.assets.map(async (asset) => [asset.id, await readVideoAsset(asset.id)] as const));
        if (cancelled) return;
        const restored = Object.fromEntries(loaded.filter((item): item is readonly [string, File] => Boolean(item[1])));
        setFiles(restored); setTimeline(saved); setSelected(saved.clips[0]?.id ?? "");
        setReady(true);
        setStatus(`Project “${project.title}” loaded. ${saved.assets.length} media item(s) restored.`);
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not open this video project."); }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !ready || playing) return;
    const timeout = window.setTimeout(() => {
      void saveVideoTimeline(projectId, timeline).then(() => setStatus("Timeline saved on this device.")).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not save the video timeline."));
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [projectId, ready, timeline, playing]);

  const previewClip = timeline.clips.filter((clip) => clip.track >= 0 && timeline.playhead >= clip.start && timeline.playhead < clip.start + clipLength(clip)).sort((a, b) => b.track - a.track)[0];
  const previewAsset = previewClip && timeline.assets.find((asset) => asset.id === previewClip.assetId);
  const previewFile = previewClip && files[previewClip.assetId];
  const previewUrl = useMemo(() => previewFile ? URL.createObjectURL(previewFile) : "", [previewFile]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    const element = previewRef.current;
    if (!element || !previewClip) return;
    const localTime = previewClip.sourceStart + (timeline.playhead - previewClip.start) * previewClip.speed;
    element.playbackRate = previewClip.speed;
    if (Math.abs(element.currentTime - localTime) > 0.2) element.currentTime = localTime;
    if (playing) void element.play().catch(() => undefined); else element.pause();
  }, [previewClip?.id, timeline.playhead, previewClip?.sourceStart, previewClip?.speed, playing]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const timer = window.setInterval(() => { const now = performance.now(); const delta = Math.min((now - last) / 1000, 0.25); last = now; setTimeline((current) => ({ ...current, playhead: current.duration > 0 && current.playhead >= current.duration ? 0 : current.playhead + delta })); }, 100);
    return () => window.clearInterval(timer);
  }, [playing]);

  async function importFiles(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    const assets: VideoTimelineAsset[] = [];
    const nextFiles: Record<string, File> = {};
    const addedClips: VideoTimelineClip[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_ASSET_BYTES) { setError(`${file.name} is over the 256 MiB per-file limit.`); continue; }
      const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("image/") ? "image" : null;
      if (!kind) { setError(`${file.name} is not a supported video, audio, or image file.`); continue; }
      const id = crypto.randomUUID(); let duration = 0;
      if (kind === "image") duration = 5;
      else duration = await new Promise<number>((resolve) => {
        const element = document.createElement(kind);
        const url = URL.createObjectURL(file);
        element.onloadedmetadata = () => { const value = Number.isFinite(element.duration) ? element.duration : 0; URL.revokeObjectURL(url); resolve(value); };
        element.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
        element.src = url;
      });
      if (!duration) { setError(`Could not read a usable duration for ${file.name}.`); continue; }
      const asset = { id, name: file.name, type: file.type, size: file.size, duration, kind } satisfies VideoTimelineAsset;
      if ([...timeline.assets, ...assets].reduce((total, item) => total + item.size, file.size) > 512 * 1024 * 1024) { setError("The total local media limit for this prototype is 512 MiB per project."); continue; }
      assets.push(asset); nextFiles[id] = file;
      const track = kind === "audio" ? -1 : 0;
      const start = Math.max(timeline.duration, ...addedClips.filter((clip) => clip.track === track).map((clip) => clip.start + clipLength(clip)), 0);
      addedClips.push({ id: crypto.randomUUID(), assetId: id, track, start, sourceStart: 0, sourceEnd: duration, speed: 1, volume: 1, muted: false });
    }
    const updated = { ...timeline, assets: [...timeline.assets, ...assets], clips: [...timeline.clips, ...addedClips], duration: Math.max(timeline.duration, ...addedClips.map((clip) => clip.start + clipLength(clip)), 0) };
    setFiles((current) => ({ ...current, ...nextFiles })); setTimeline(updated); setSelected(addedClips[0]?.id ?? selected);
    try { await saveVideoTimeline(projectId, updated, assets.map((asset) => ({ id: asset.id, file: nextFiles[asset.id] }))); setStatus(`${assets.length} media item(s) added and saved locally.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save imported media in this browser."); }
  }

  function editClip(id: string, patch: Partial<VideoTimelineClip>) {
    setTimeline((current) => {
      const clips = current.clips.map((clip) => clip.id === id ? { ...clip, ...patch } : clip);
      return { ...current, clips, duration: Math.max(0, ...clips.map((clip) => clip.start + clipLength(clip))) };
    });
  }
  function removeClip(id: string) {
    setTimeline((current) => {
      const clips = current.clips.filter((clip) => clip.id !== id);
      const used = new Set(clips.map((clip) => clip.assetId));
      const assets = current.assets.filter((asset) => used.has(asset.id));
      setFiles((existing) => Object.fromEntries(Object.entries(existing).filter(([key]) => used.has(key))));
      return { ...current, clips, assets, duration: Math.max(0, ...clips.map((clip) => clip.start + clipLength(clip))) };
    });
    setSelected("");
  }
  function splitSelected() {
    if (!selectedClip) return;
    const cut = timeline.playhead;
    if (cut <= selectedClip.start || cut >= selectedClip.start + clipLength(selectedClip)) { setError("Move the playhead inside the selected clip to split it."); return; }
    const sourceCut = selectedClip.sourceStart + (cut - selectedClip.start) * selectedClip.speed;
    const right = { ...selectedClip, id: crypto.randomUUID(), start: cut, sourceStart: sourceCut };
    editClip(selectedClip.id, { sourceEnd: sourceCut }); setTimeline((current) => ({ ...current, clips: [...current.clips, right] })); setSelected(right.id); setError("");
  }
  const pxPerSecond = Math.max(12, Math.min(160, Number(zoom) || 60));

  return <main className="video-studio-page">
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav><a href="/projects">Projects</a></nav><span role="status">{status}</span></header>
    <div className="video-studio-top"><section><p className="eyebrow">LOCAL VIDEO STUDIO · TIMELINE FOUNDATION</p><h1>Video Studio</h1><p>Arrange local video, image, and audio clips on independent tracks. Project edits and imported assets stay in this browser.</p></section><label className="file-picker"><span>{projectId ? "Import video, audio, or images" : "Open a project to import media"}<input type="file" multiple accept="video/*,audio/*,image/*" disabled={!projectId} onChange={(event) => void importFiles(event.currentTarget.files)} /></span></label></div>
    {error && <p className="resize-error" role="alert">{error}</p>}
    <section className="video-editor-layout">
      <aside className="video-bin"><div className="preview-heading"><strong>Media bin</strong><span>{timeline.assets.length} items</span></div>{timeline.assets.map((asset) => <button key={asset.id} className="bin-item" onClick={() => setSelected(timeline.clips.find((clip) => clip.assetId === asset.id)?.id ?? "")}><strong>{asset.name}</strong><small>{asset.kind} · {asset.duration.toFixed(2)} s · {(asset.size / 1048576).toFixed(1)} MiB</small></button>)}{!timeline.assets.length && <p className="resize-note">Import media to build your timeline.</p>}</aside>
      <section className="editor-preview"><div className="preview-heading"><strong>Preview</strong><span>{previewAsset?.name ?? "Nothing at playhead"} · {timeline.playhead.toFixed(2)} s</span></div><div className="editor-stage">{previewFile && previewAsset?.kind === "video" ? <video ref={(el) => { previewRef.current = el; }} src={previewUrl} controls={false} muted onLoadedMetadata={(event) => { if (previewClip) event.currentTarget.currentTime = previewClip.sourceStart + (timeline.playhead - previewClip.start) * previewClip.speed; }} /> : previewFile && previewAsset?.kind === "image" ? <img src={previewUrl} alt={previewAsset.name} /> : previewFile && previewAsset?.kind === "audio" ? <div className="empty-preview">Audio clip: {previewAsset.name}</div> : <div className="empty-preview">Move the playhead over a clip to preview it.</div>}</div><div className="editor-transport"><button onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"}</button><button onClick={() => setTimeline((current) => ({ ...current, playhead: 0 }))}>Start</button><label>Playhead (s)<input type="number" min="0" max={timeline.duration} step="any" value={timeline.playhead.toFixed(2)} onChange={(event) => setTimeline((current) => ({ ...current, playhead: Math.max(0, Math.min(current.duration, Number(event.currentTarget.value) || 0)) }))} /></label></div></section>
      <aside className="video-inspector"><div className="preview-heading"><strong>Inspector</strong><span>{selectedClip ? "Selected clip" : "No selection"}</span></div>{selectedClip && <><label className="speed-field">Track <span>video 0–2 · audio −1 to −3</span><input type="number" min="-3" max="2" step="1" value={selectedClip.track} onChange={(event) => editClip(selectedClip.id, { track: Number(event.currentTarget.value) })} /></label><label className="speed-field">Timeline start <span>seconds</span><input type="number" min="0" step="any" value={selectedClip.start} onChange={(event) => editClip(selectedClip.id, { start: Math.max(0, Number(event.currentTarget.value) || 0) })} /></label><label className="speed-field">Source in <span>seconds</span><input type="number" min="0" max={selectedAsset?.duration} step="any" value={selectedClip.sourceStart} onChange={(event) => editClip(selectedClip.id, { sourceStart: Math.max(0, Math.min(selectedClip.sourceEnd - 0.01, Number(event.currentTarget.value) || 0)) })} /></label><label className="speed-field">Source out <span>seconds</span><input type="number" min="0.01" max={selectedAsset?.duration} step="any" value={selectedClip.sourceEnd} onChange={(event) => editClip(selectedClip.id, { sourceEnd: Math.min(selectedAsset?.duration ?? selectedClip.sourceEnd, Math.max(selectedClip.sourceStart + 0.01, Number(event.currentTarget.value) || 0)) })} /></label><label className="speed-field">Speed <span>custom · 0.1–16×</span><input type="number" min="0.1" max="16" step="any" value={selectedClip.speed} onChange={(event) => editClip(selectedClip.id, { speed: Math.max(0.1, Math.min(16, Number(event.currentTarget.value) || 1)) })} /></label><label className="speed-field">Volume <span>0–2×</span><input type="number" min="0" max="2" step="any" value={selectedClip.volume} onChange={(event) => editClip(selectedClip.id, { volume: Math.max(0, Math.min(2, Number(event.currentTarget.value) || 0)) })} /></label><label className="ratio-toggle"><input type="checkbox" checked={selectedClip.muted} onChange={(event) => editClip(selectedClip.id, { muted: event.currentTarget.checked })} />Mute clip</label><button className="secondary-button editor-action" onClick={splitSelected}>Split at playhead</button><button className="editor-action danger" onClick={() => removeClip(selectedClip.id)}>Delete clip</button></>}</aside>
    </section>
    <section className="video-timeline"><div className="timeline-toolbar"><strong>Timeline · {timeline.duration.toFixed(2)} seconds</strong><label>Zoom<input type="number" min="12" max="160" value={zoom} onChange={(event) => setZoom(event.currentTarget.value)} />px/s</label></div><div className="timeline-scroll"><div className="timeline-ruler" style={{ width: Math.max(800, timeline.duration * pxPerSecond) }} onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); setTimeline((current) => ({ ...current, playhead: Math.max(0, Math.min(current.duration, (event.clientX - bounds.left + event.currentTarget.scrollLeft) / pxPerSecond)) })); }}>{Array.from({ length: Math.ceil(timeline.duration) + 1 }, (_, second) => <span key={second} style={{ left: second * pxPerSecond }}>{second}s</span>)}</div>{[2, 1, 0, -1, -2, -3].map((track) => <div className="timeline-track" key={track}><strong>{track >= 0 ? `Video ${track + 1}` : `Audio ${-track}`}</strong><div className="track-lane" style={{ width: Math.max(800, timeline.duration * pxPerSecond) }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/clip"); const rect = event.currentTarget.getBoundingClientRect(); editClip(id, { track, start: Math.max(0, (event.clientX - rect.left + event.currentTarget.scrollLeft) / pxPerSecond) }); }} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setTimeline((current) => ({ ...current, playhead: Math.max(0, Math.min(current.duration, (event.clientX - rect.left + event.currentTarget.scrollLeft) / pxPerSecond)) })); }}>{timeline.clips.filter((clip) => clip.track === track).map((clip) => { const asset = timeline.assets.find((item) => item.id === clip.assetId); return <button draggable key={clip.id} className={`timeline-clip ${selected === clip.id ? "selected" : ""} ${asset?.kind ?? ""}`} style={{ left: clip.start * pxPerSecond, width: Math.max(22, clipLength(clip) * pxPerSecond) }} onDragStart={(event) => event.dataTransfer.setData("text/clip", clip.id)} onClick={(event) => { event.stopPropagation(); setSelected(clip.id); }}><strong>{asset?.name}</strong><small>{clipLength(clip).toFixed(2)}s · {clip.speed}×</small></button>; })}</div></div>)}<div className="timeline-playhead" style={{ left: 104 + timeline.playhead * pxPerSecond }} /> </div></section>
    <p className="resize-note editor-disclaimer">Foundation status: clips can be moved between tracks, trimmed with exact source in/out values, split, and saved with media in IndexedDB. Preview shows the topmost active video or an image; composited multi-track preview, mixed audio playback, keyframes, transitions, undo/redo, and rendered timeline export are future slices.</p>
  </main>;
}
