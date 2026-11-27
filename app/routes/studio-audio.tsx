import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/studio-audio";
import { NavBackButton } from "../components/nav-back-button";
import { BrandMark } from "../components/brand-mark";
import { ProcessingProgress } from "../components/processing-progress";
import { CustomMediaPreview } from "../components/custom-media-preview";
import { AudioStudioClipWave } from "../components/audio-studio-clip-wave";
import { createProject, getProject, readAudioAsset, saveAudioProject } from "../lib/project-store";
import {
  computeWaveformPeaks,
  dbToLinear,
  decodeMediaFileToAudioBuffer,
  encodeWavBlob,
  getClipDuration,
  measureClipPeakDb,
  renderMultitrackAudioMix,
  STUDIO_SAMPLE_RATE,
  type AudioStudioClip,
  type AudioStudioDocument,
  type AudioStudioSource,
  type AudioStudioTrack,
} from "../lib/audio-studio-engine";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Audio Studio | OpenProducer Editor" }, { name: "robots", content: "noindex,nofollow" }];
}

function createInitialDoc(): AudioStudioDocument {
  return {
    tracks: [
      { id: "track-1", name: "Track 1", muted: false, solo: false, gainDb: 0 },
    ],
    clips: [],
    masterGainDb: 0,
  };
}

function formatTimecode(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${secs.toFixed(3).padStart(6, "0")}`;
}

type DragState =
  | {
      kind: "move";
      pointerId: number;
      clipId: string;
      originX: number;
      originStart: number;
      originTrackId: string;
      moved: boolean;
    }
  | {
      kind: "trim-start" | "trim-end";
      pointerId: number;
      clipId: string;
      originX: number;
      originStart: number;
      originSourceStart: number;
      originSourceEnd: number;
      moved: boolean;
    };

export default function AudioStudio() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") ?? "";

  const [doc, setDoc] = useState<AudioStudioDocument>(createInitialDoc);
  const [past, setPast] = useState<AudioStudioDocument[]>([]);
  const [future, setFuture] = useState<AudioStudioDocument[]>([]);
  const [sources, setSources] = useState<Record<string, AudioStudioSource>>({});
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string>("track-1");
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(72);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(1200);
  const [meterLevel, setMeterLevel] = useState<{ l: number; r: number }>({ l: 0, r: 0 });
  const [projectTitle, setProjectTitle] = useState("Audio Studio");
  const [status, setStatus] = useState("Local multitrack workspace");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState("");
  const [exportDuration, setExportDuration] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const masterGainNodeRef = useRef<GainNode | null>(null);
  const trackGainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const clipTrimGainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const playStartRef = useRef<{ wall: number; timeline: number }>({ wall: 0, timeline: 0 });
  const dragRef = useRef<DragState | null>(null);
  const rulerScrubRef = useRef<number | null>(null);
  const timelineTracksRef = useRef<HTMLDivElement>(null);
  const cancelExportRef = useRef(false);
  const docRef = useRef(doc);
  docRef.current = doc;

  // Load saved project only when ?project=<id> is explicitly provided
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      try {
        const project = await getProject(projectId);
        if (!project || project.kind !== "audio") return;
        if (!cancelled) setProjectTitle(project.title || "Audio Studio");
        const saved = project.audioDocument;
        if (saved?.sourceAssetId) {
          const restoredFile = await readAudioAsset(saved.sourceAssetId);
          if (restoredFile && !cancelled) {
            const { buffer, kind } = await decodeMediaFileToAudioBuffer(restoredFile);
            if (cancelled) return;
            const srcId = saved.sourceAssetId;
            const src: AudioStudioSource = {
              id: srcId,
              name: saved.sourceName || restoredFile.name,
              kind,
              duration: buffer.duration,
              sampleRate: buffer.sampleRate,
              channels: buffer.numberOfChannels,
              buffer,
              peaks: computeWaveformPeaks(buffer),
            };
            setSources((prev) => ({ ...prev, [srcId]: src }));
            const clip: AudioStudioClip = {
              id: crypto.randomUUID(),
              trackId: "track-1",
              sourceId: srcId,
              name: src.name,
              start: 0,
              sourceStart: saved.sourceStart || 0,
              sourceEnd: saved.sourceEnd > saved.sourceStart ? saved.sourceEnd : buffer.duration,
              speed: saved.speed || 1,
              pitchMode: saved.pitchMode || "preserve",
              gainDb: saved.gainDb || 0,
              fadeIn: saved.fadeIn || 0,
              fadeOut: saved.fadeOut || 0,
              muted: false,
            };
            setDoc((prev) => ({ ...prev, clips: prev.clips.length ? prev.clips : [clip] }));
            setSelectedClipId(clip.id);
            setStatus("Project loaded from this device");
          }
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load saved audio project.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => () => { if (exportUrl) URL.revokeObjectURL(exportUrl); }, [exportUrl]);

  const stopPlayback = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    for (const node of activeNodesRef.current) {
      try { node.stop(); } catch { /* already stopped */ }
      node.disconnect();
    }
    activeNodesRef.current = [];
    masterGainNodeRef.current = null;
    trackGainNodesRef.current.clear();
    clipTrimGainNodesRef.current.clear();
    setPlaying(false);
    setMeterLevel({ l: 0, r: 0 });
  }, []);

  useEffect(() => () => {
    stopPlayback();
    void audioCtxRef.current?.close().catch(() => undefined);
  }, [stopPlayback]);

  // Measure timeline container width so tracks & ruler always stretch full width
  useEffect(() => {
    const el = timelineTracksRef.current;
    if (!el) return;
    const update = () => {
      if (el.clientWidth > 0) setTimelineViewportWidth(el.clientWidth);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Native non-passive wheel listener for Ctrl + Scroll timeline zooming (blocks browser page zoom)
  useEffect(() => {
    const el = timelineTracksRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      setPixelsPerSecond((prev) => Math.max(20, Math.min(240, Math.round(prev * factor))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Auto-scroll timeline horizontally when playhead moves past the visible lane
  useEffect(() => {
    const container = timelineTracksRef.current;
    if (!container || rulerScrubRef.current !== null) return;
    const laneViewportWidth = Math.max(120, container.clientWidth - 170);
    const playheadPx = playhead * pixelsPerSecond;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + laneViewportWidth;
    if (playheadPx > viewRight - 20) {
      container.scrollLeft = Math.max(0, playheadPx - laneViewportWidth * 0.25);
    } else if (playheadPx < viewLeft) {
      container.scrollLeft = Math.max(0, playheadPx - 24);
    }
  }, [playhead, pixelsPerSecond]);

  const timelineDuration = useMemo(() => {
    const maxClipEnd = doc.clips.reduce((max, c) => Math.max(max, c.start + getClipDuration(c)), 0);
    return Math.max(12, Math.ceil(maxClipEnd + 4));
  }, [doc.clips]);

  const selectedClip = useMemo(
    () => doc.clips.find((c) => c.id === selectedClipId) ?? null,
    [doc.clips, selectedClipId],
  );
  const selectedSource = selectedClip ? sources[selectedClip.sourceId] ?? null : null;

  const commitDoc = useCallback((updater: (prev: AudioStudioDocument) => AudioStudioDocument, recordHistory = true) => {
    setDoc((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      if (recordHistory) {
        setPast((h) => [...h.slice(-49), prev]);
        setFuture([]);
      }
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (!prevPast.length) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      setFuture((f) => [docRef.current, ...f.slice(0, 49)]);
      setDoc(previous);
      return prevPast.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (!prevFuture.length) return prevFuture;
      const [next, ...rest] = prevFuture;
      setPast((p) => [...p.slice(-49), docRef.current]);
      setDoc(next);
      return rest;
    });
  }, []);

  const startPlaybackFrom = useCallback(async (fromTime: number) => {
    stopPlayback();
    const totalContentEnd = doc.clips.reduce((m, c) => Math.max(m, c.start + getClipDuration(c)), 0);
    if (totalContentEnd <= 0.001) return;

    const startAt = fromTime >= totalContentEnd - 0.01 ? 0 : Math.max(0, fromTime);
    const ctx = audioCtxRef.current ?? new AudioContext({ sampleRate: STUDIO_SAMPLE_RATE });
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const masterGain = ctx.createGain();
    masterGain.gain.value = dbToLinear(doc.masterGainDb);
    masterGainNodeRef.current = masterGain;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    const anySolo = doc.tracks.some((t) => t.solo);
    const trackMap = new Map(doc.tracks.map((t) => [t.id, t]));
    const trackGains = new Map<string, GainNode>();
    for (const track of doc.tracks) {
      const tg = ctx.createGain();
      const audible = !track.muted && (!anySolo || track.solo);
      tg.gain.value = audible ? dbToLinear(track.gainDb) : 0;
      tg.connect(masterGain);
      trackGains.set(track.id, tg);
    }
    trackGainNodesRef.current = trackGains;
    clipTrimGainNodesRef.current.clear();

    const now = ctx.currentTime + 0.02;
    const spawned: AudioBufferSourceNode[] = [];

    for (const clip of doc.clips) {
      const trackGain = trackGains.get(clip.trackId);
      if (!trackGain) continue;
      const src = sources[clip.sourceId];
      if (!src) continue;

      const clipDur = getClipDuration(clip);
      const clipEnd = clip.start + clipDur;
      if (clipEnd <= startAt) continue;

      const node = ctx.createBufferSource();
      node.buffer = src.buffer;
      node.playbackRate.value = Math.max(0.1, Math.min(16, clip.speed || 1));

      const envGainNode = ctx.createGain();
      const clipTrimNode = ctx.createGain();
      clipTrimNode.gain.value = clip.muted ? 0 : dbToLinear(clip.gainDb);
      clipTrimGainNodesRef.current.set(clip.id, clipTrimNode);

      const delay = Math.max(0, clip.start - startAt);
      const offsetIntoClip = Math.max(0, startAt - clip.start);
      const sourceOffset = clip.sourceStart + offsetIntoClip * (clip.speed || 1);
      const remainingSource = Math.max(0.001, clip.sourceEnd - sourceOffset);
      const whenStart = now + delay;
      const remainingPlayDur = remainingSource / (clip.speed || 1);
      const whenEnd = whenStart + remainingPlayDur;

      // Apply fade-in / fade-out envelope (0..1)
      envGainNode.gain.setValueAtTime(1, whenStart);
      if (clip.fadeIn > 0 && offsetIntoClip < clip.fadeIn) {
        const fadeEnd = whenStart + (clip.fadeIn - offsetIntoClip);
        const startRatio = offsetIntoClip / clip.fadeIn;
        envGainNode.gain.setValueAtTime(startRatio, whenStart);
        envGainNode.gain.linearRampToValueAtTime(1, Math.min(whenEnd, fadeEnd));
      }
      if (clip.fadeOut > 0 && remainingPlayDur > 0.01) {
        const fadeStart = Math.max(whenStart, whenEnd - clip.fadeOut);
        envGainNode.gain.setValueAtTime(1, fadeStart);
        envGainNode.gain.linearRampToValueAtTime(0, whenEnd);
      }

      node.connect(envGainNode);
      envGainNode.connect(clipTrimNode);
      clipTrimNode.connect(trackGain);
      node.start(whenStart, sourceOffset, remainingSource);
      spawned.push(node);
    }

    activeNodesRef.current = spawned;
    playStartRef.current = { wall: performance.now(), timeline: startAt };
    setPlaying(true);

    const meterData = new Float32Array(analyser.fftSize);
    const tick = () => {
      const elapsed = (performance.now() - playStartRef.current.wall) / 1000;
      const nextTime = playStartRef.current.timeline + elapsed;

      if (analyserRef.current) {
        analyserRef.current.getFloatTimeDomainData(meterData);
        let peak = 0;
        for (let i = 0; i < meterData.length; i += 2) {
          const v = Math.abs(meterData[i]);
          if (v > peak) peak = v;
        }
        const db = peak > 1e-5 ? 20 * Math.log10(peak) : -60;
        const pct = Math.max(0, Math.min(100, Math.round(((db + 48) / 48) * 100)));
        setMeterLevel({ l: pct, r: Math.max(0, pct - 2) });
      }

      if (nextTime >= totalContentEnd) {
        if (loop) {
          void startPlaybackFrom(0);
          return;
        }
        setPlayhead(totalContentEnd);
        stopPlayback();
        return;
      }
      setPlayhead(nextTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [doc, sources, loop, stopPlayback]);

  const togglePlay = useCallback(() => {
    if (playing) stopPlayback();
    else void startPlaybackFrom(playhead);
  }, [playing, playhead, startPlaybackFrom, stopPlayback]);

  // Live-update Master Gain, Track Gain/Mute/Solo, and Clip Gain/Mute during playback
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (masterGainNodeRef.current) {
      masterGainNodeRef.current.gain.setTargetAtTime(dbToLinear(doc.masterGainDb), ctx.currentTime, 0.015);
    }
    const anySolo = doc.tracks.some((t) => t.solo);
    for (const track of doc.tracks) {
      const tg = trackGainNodesRef.current.get(track.id);
      if (tg) {
        const audible = !track.muted && (!anySolo || track.solo);
        tg.gain.setTargetAtTime(audible ? dbToLinear(track.gainDb) : 0, ctx.currentTime, 0.015);
      }
    }
    for (const clip of doc.clips) {
      const cg = clipTrimGainNodesRef.current.get(clip.id);
      if (cg) {
        cg.gain.setTargetAtTime(clip.muted ? 0 : dbToLinear(clip.gainDb), ctx.currentTime, 0.015);
      }
    }
  }, [doc.masterGainDb, doc.tracks, doc.clips]);

  const importFiles = useCallback(async (fileList: FileList | File[] | null, targetTrackId?: string, dropTime?: number) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      const addedSources: AudioStudioSource[] = [];
      for (const file of files) {
        const { buffer, kind } = await decodeMediaFileToAudioBuffer(file);
        addedSources.push({
          id: crypto.randomUUID(),
          name: file.name,
          kind,
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
          channels: buffer.numberOfChannels,
          buffer,
          peaks: computeWaveformPeaks(buffer),
        });
      }
      setSources((prev) => {
        const next = { ...prev };
        for (const s of addedSources) next[s.id] = s;
        return next;
      });

      let firstClipId: string | null = null;
      let lastTrackId: string | null = null;

      commitDoc((prev) => {
        const nextTracks = [...prev.tracks];
        const nextClips = [...prev.clips];

        for (let i = 0; i < addedSources.length; i++) {
          const src = addedSources[i];
          const desiredStart = targetTrackId ? (dropTime ?? Math.max(0, playhead)) : 0;
          let chosenTrack = targetTrackId ? nextTracks.find((t) => t.id === targetTrackId) : undefined;
          const overlaps = chosenTrack
            ? nextClips.some((c) => c.trackId === chosenTrack!.id && desiredStart < c.start + getClipDuration(c) && desiredStart + src.duration > c.start)
            : false;

          if (!chosenTrack || overlaps) {
            chosenTrack = nextTracks.find((t) => !nextClips.some((c) => c.trackId === t.id));
            if (!chosenTrack) {
              chosenTrack = {
                id: crypto.randomUUID(),
                name: `Track ${nextTracks.length + 1}`,
                muted: false,
                solo: false,
                gainDb: 0,
              };
              nextTracks.push(chosenTrack);
            }
          }

          const clip: AudioStudioClip = {
            id: crypto.randomUUID(),
            trackId: chosenTrack.id,
            sourceId: src.id,
            name: src.name,
            start: targetTrackId && !overlaps ? desiredStart : 0,
            sourceStart: 0,
            sourceEnd: src.duration,
            speed: 1,
            pitchMode: "preserve",
            gainDb: 0,
            fadeIn: 0,
            fadeOut: 0,
            muted: false,
          };
          nextClips.push(clip);
          if (!firstClipId) firstClipId = clip.id;
          lastTrackId = chosenTrack.id;
        }

        return { ...prev, tracks: nextTracks, clips: nextClips };
      });

      if (firstClipId) setSelectedClipId(firstClipId);
      if (lastTrackId) setActiveTrackId(lastTrackId);
      setStatus(`Imported ${addedSources.length} ${addedSources.length === 1 ? "source" : "sources"}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not decode the selected file.");
    } finally {
      setBusy(false);
    }
  }, [commitDoc, playhead]);

  const addSourceToTrack = useCallback((source: AudioStudioSource, trackId?: string, atTime?: number) => {
    let createdClipId = "";
    let chosenTrackId = "";
    commitDoc((prev) => {
      const nextTracks = [...prev.tracks];
      const nextClips = [...prev.clips];
      const desiredStart = Math.max(0, atTime ?? (trackId ? playhead : 0));
      let chosenTrack = trackId ? nextTracks.find((t) => t.id === trackId) : undefined;
      const overlaps = chosenTrack
        ? nextClips.some((c) => c.trackId === chosenTrack!.id && desiredStart < c.start + getClipDuration(c) && desiredStart + source.duration > c.start)
        : false;

      if (!chosenTrack || overlaps) {
        chosenTrack = nextTracks.find((t) => !nextClips.some((c) => c.trackId === t.id));
        if (!chosenTrack) {
          chosenTrack = {
            id: crypto.randomUUID(),
            name: `Track ${nextTracks.length + 1}`,
            muted: false,
            solo: false,
            gainDb: 0,
          };
          nextTracks.push(chosenTrack);
        }
      }

      const clip: AudioStudioClip = {
        id: crypto.randomUUID(),
        trackId: chosenTrack.id,
        sourceId: source.id,
        name: source.name,
        start: trackId && !overlaps ? desiredStart : 0,
        sourceStart: 0,
        sourceEnd: source.duration,
        speed: 1,
        pitchMode: "preserve",
        gainDb: 0,
        fadeIn: 0,
        fadeOut: 0,
        muted: false,
      };
      createdClipId = clip.id;
      chosenTrackId = chosenTrack.id;
      return { ...prev, tracks: nextTracks, clips: [...nextClips, clip] };
    });
    if (createdClipId) setSelectedClipId(createdClipId);
    if (chosenTrackId) setActiveTrackId(chosenTrackId);
  }, [commitDoc, playhead]);

  const updateSelectedClip = useCallback((patch: Partial<AudioStudioClip>) => {
    if (!selectedClipId) return;
    commitDoc((prev) => ({
      ...prev,
      clips: prev.clips.map((c) => (c.id === selectedClipId ? { ...c, ...patch } : c)),
    }));
  }, [commitDoc, selectedClipId]);

  const splitSelectedAtPlayhead = useCallback(() => {
    if (!selectedClip) return;
    const dur = getClipDuration(selectedClip);
    const localOffset = playhead - selectedClip.start;
    if (localOffset <= 0.02 || localOffset >= dur - 0.02) {
      setError("Move the playhead inside the selected clip to split it.");
      return;
    }
    setError("");
    const splitSourcePoint = selectedClip.sourceStart + localOffset * (selectedClip.speed || 1);
    const leftClip: AudioStudioClip = {
      ...selectedClip,
      sourceEnd: splitSourcePoint,
      fadeOut: Math.min(selectedClip.fadeOut, localOffset),
    };
    const rightClip: AudioStudioClip = {
      ...selectedClip,
      id: crypto.randomUUID(),
      start: playhead,
      sourceStart: splitSourcePoint,
      fadeIn: 0,
    };
    commitDoc((prev) => ({
      ...prev,
      clips: prev.clips.flatMap((c) => (c.id === selectedClip.id ? [leftClip, rightClip] : [c])),
    }));
    setSelectedClipId(rightClip.id);
    setStatus("Split clip at playhead");
  }, [commitDoc, playhead, selectedClip]);

  const duplicateSelectedClip = useCallback(() => {
    if (!selectedClip) return;
    const copy: AudioStudioClip = {
      ...selectedClip,
      id: crypto.randomUUID(),
      start: selectedClip.start + getClipDuration(selectedClip) + 0.05,
    };
    commitDoc((prev) => ({ ...prev, clips: [...prev.clips, copy] }));
    setSelectedClipId(copy.id);
  }, [commitDoc, selectedClip]);

  const deleteSelectedClip = useCallback(() => {
    if (!selectedClipId) return;
    commitDoc((prev) => ({ ...prev, clips: prev.clips.filter((c) => c.id !== selectedClipId) }));
    setSelectedClipId(null);
  }, [commitDoc, selectedClipId]);

  const joinWithNextClip = useCallback(async () => {
    if (!selectedClip) return;
    const sameTrack = doc.clips
      .filter((c) => c.trackId === selectedClip.trackId && c.id !== selectedClip.id && c.start >= selectedClip.start)
      .sort((a, b) => a.start - b.start);
    const nextClip = sameTrack[0];
    if (!nextClip) {
      setError("Place another clip after the selected clip on the same track to join them.");
      return;
    }
    const pairStart = selectedClip.start;
    const pairEnd = Math.max(selectedClip.start + getClipDuration(selectedClip), nextClip.start + getClipDuration(nextClip));
    const shiftedClips = [selectedClip, nextClip].map((c) => ({ ...c, start: c.start - pairStart }));
    const pairDoc: AudioStudioDocument = {
      tracks: doc.tracks.map((t) => (t.id === selectedClip.trackId ? { ...t, muted: false, solo: false, gainDb: 0 } : { ...t, muted: true, solo: false })),
      clips: shiftedClips,
      masterGainDb: 0,
    };
    setBusy(true);
    setError("");
    try {
      const rendered = await renderMultitrackAudioMix({
        doc: pairDoc,
        sources,
        onProgress: () => undefined,
        isCancelled: () => false,
      });
      const mergedId = crypto.randomUUID();
      const mergedName = `${selectedClip.name.replace(/\.[^.]+$/, "")}-joined.wav`;
      const mergedSource: AudioStudioSource = {
        id: mergedId,
        name: mergedName,
        kind: "audio",
        duration: rendered.buffer.duration,
        sampleRate: rendered.buffer.sampleRate,
        channels: rendered.buffer.numberOfChannels,
        buffer: rendered.buffer,
        peaks: computeWaveformPeaks(rendered.buffer),
      };
      setSources((prev) => ({ ...prev, [mergedId]: mergedSource }));
      const joinedClip: AudioStudioClip = {
        id: crypto.randomUUID(),
        trackId: selectedClip.trackId,
        sourceId: mergedId,
        name: mergedName,
        start: pairStart,
        sourceStart: 0,
        sourceEnd: mergedSource.duration,
        speed: 1,
        pitchMode: "preserve",
        gainDb: 0,
        fadeIn: 0,
        fadeOut: 0,
        muted: false,
      };
      commitDoc((prev) => ({
        ...prev,
        clips: [...prev.clips.filter((c) => c.id !== selectedClip.id && c.id !== nextClip.id), joinedClip],
      }));
      setSelectedClipId(joinedClip.id);
      setStatus(`Joined 2 clips (${(pairEnd - pairStart).toFixed(2)} s)`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join clips.");
    } finally {
      setBusy(false);
    }
  }, [commitDoc, doc.clips, doc.tracks, selectedClip, sources]);

  const normalizeSelectedClip = useCallback(() => {
    if (!selectedClip || !selectedSource) return;
    const peakDb = measureClipPeakDb(selectedSource.buffer, selectedClip.sourceStart, selectedClip.sourceEnd);
    const targetGain = Math.max(-24, Math.min(24, Number((-1 - peakDb).toFixed(1))));
    updateSelectedClip({ gainDb: targetGain });
    setStatus(`Normalized clip gain to ${targetGain > 0 ? `+${targetGain}` : targetGain} dB`);
  }, [selectedClip, selectedSource, updateSelectedClip]);

  const trimLeftAtPlayhead = useCallback(() => {
    if (!selectedClip) return;
    const dur = getClipDuration(selectedClip);
    const localOffset = playhead - selectedClip.start;
    if (localOffset <= 0.02 || localOffset >= dur - 0.02) {
      setError("Move the playhead inside the selected clip to remove the left side.");
      return;
    }
    setError("");
    const nextSourceStart = selectedClip.sourceStart + localOffset * (selectedClip.speed || 1);
    const nextDur = Math.max(0.02, dur - localOffset);
    updateSelectedClip({
      start: Number(playhead.toFixed(3)),
      sourceStart: Number(nextSourceStart.toFixed(3)),
      fadeIn: Math.min(selectedClip.fadeIn, nextDur),
    });
    setStatus("Removed left of playhead");
  }, [playhead, selectedClip, updateSelectedClip]);

  const trimRightAtPlayhead = useCallback(() => {
    if (!selectedClip) return;
    const dur = getClipDuration(selectedClip);
    const localOffset = playhead - selectedClip.start;
    if (localOffset <= 0.02 || localOffset >= dur - 0.02) {
      setError("Move the playhead inside the selected clip to remove the right side.");
      return;
    }
    setError("");
    const nextSourceEnd = selectedClip.sourceStart + localOffset * (selectedClip.speed || 1);
    updateSelectedClip({
      sourceEnd: Number(nextSourceEnd.toFixed(3)),
      fadeOut: Math.min(selectedClip.fadeOut, localOffset),
    });
    setStatus("Removed right of playhead");
  }, [playhead, selectedClip, updateSelectedClip]);

  const addTrack = useCallback(() => {
    const nextIndex = doc.tracks.length + 1;
    const newTrack: AudioStudioTrack = {
      id: crypto.randomUUID(),
      name: `Track ${nextIndex}`,
      muted: false,
      solo: false,
      gainDb: 0,
    };
    commitDoc((prev) => ({ ...prev, tracks: [...prev.tracks, newTrack] }));
    setActiveTrackId(newTrack.id);
  }, [commitDoc, doc.tracks.length]);

  const removeTrack = useCallback((trackId: string) => {
    if (doc.tracks.length <= 1) return;
    commitDoc((prev) => ({
      ...prev,
      tracks: prev.tracks.filter((t) => t.id !== trackId),
      clips: prev.clips.filter((c) => c.trackId !== trackId),
    }));
    if (activeTrackId === trackId) {
      const remaining = doc.tracks.find((t) => t.id !== trackId);
      if (remaining) setActiveTrackId(remaining.id);
    }
  }, [activeTrackId, commitDoc, doc.tracks]);

  // Keyboard shortcuts (Space Play/Pause, Ctrl+Z Undo, Ctrl+Y/Shift+Z Redo, Delete/Backspace, S Split)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey))) {
        event.preventDefault();
        redo();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedClipId) {
          event.preventDefault();
          deleteSelectedClip();
        }
      } else if (event.key.toLowerCase() === "s" && !event.ctrlKey && !event.metaKey) {
        if (selectedClipId) {
          event.preventDefault();
          splitSelectedAtPlayhead();
        }
      } else if (event.key === "[" && !event.ctrlKey && !event.metaKey) {
        if (selectedClipId) {
          event.preventDefault();
          trimLeftAtPlayhead();
        }
      } else if (event.key === "]" && !event.ctrlKey && !event.metaKey) {
        if (selectedClipId) {
          event.preventDefault();
          trimRightAtPlayhead();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelectedClip, redo, selectedClipId, splitSelectedAtPlayhead, togglePlay, trimLeftAtPlayhead, trimRightAtPlayhead, undo]);

  // Pointer drag for clips & trim handles
  function snapTime(candidate: number, excludeClipId: string): number {
    if (!snapEnabled) return Math.max(0, candidate);
    const threshold = 10 / pixelsPerSecond;
    const targets = [0, playhead];
    for (const c of doc.clips) {
      if (c.id === excludeClipId) continue;
      targets.push(c.start, c.start + getClipDuration(c));
    }
    let best = candidate;
    let bestDist = threshold;
    for (const t of targets) {
      const d = Math.abs(candidate - t);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return Math.max(0, best);
  }

  function handleTimelinePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.originX;
    if (!drag.moved && Math.abs(dx) < 3) return;
    drag.moved = true;
    const dt = dx / pixelsPerSecond;

    if (drag.kind === "move") {
      const rawStart = Math.max(0, drag.originStart + dt);
      const nextStart = snapTime(rawStart, drag.clipId);
      let nextTrackId = drag.originTrackId;
      const laneEls = timelineTracksRef.current?.querySelectorAll<HTMLElement>("[data-track-id]");
      if (laneEls) {
        for (const el of laneEls) {
          const r = el.getBoundingClientRect();
          if (event.clientY >= r.top && event.clientY <= r.bottom && el.dataset.trackId) {
            nextTrackId = el.dataset.trackId;
            break;
          }
        }
      }
      setDoc((prev) => ({
        ...prev,
        clips: prev.clips.map((c) => (c.id === drag.clipId ? { ...c, start: Number(nextStart.toFixed(3)), trackId: nextTrackId } : c)),
      }));
    } else if (drag.kind === "trim-start") {
      const clip = doc.clips.find((c) => c.id === drag.clipId);
      if (!clip) return;
      const speed = clip.speed || 1;
      const maxSourceDelta = drag.originSourceEnd - drag.originSourceStart - 0.05 * speed;
      const minSourceDelta = -drag.originSourceStart;
      const deltaSource = Math.max(minSourceDelta, Math.min(maxSourceDelta, dt * speed));
      const nextSourceStart = drag.originSourceStart + deltaSource;
      const nextStart = Math.max(0, drag.originStart + deltaSource / speed);
      setDoc((prev) => ({
        ...prev,
        clips: prev.clips.map((c) => (c.id === drag.clipId ? { ...c, start: Number(nextStart.toFixed(3)), sourceStart: Number(nextSourceStart.toFixed(3)) } : c)),
      }));
    } else if (drag.kind === "trim-end") {
      const clip = doc.clips.find((c) => c.id === drag.clipId);
      const src = clip ? sources[clip.sourceId] : null;
      if (!clip || !src) return;
      const speed = clip.speed || 1;
      const nextSourceEnd = Math.max(clip.sourceStart + 0.05 * speed, Math.min(src.duration, drag.originSourceEnd + dt * speed));
      setDoc((prev) => ({
        ...prev,
        clips: prev.clips.map((c) => (c.id === drag.clipId ? { ...c, sourceEnd: Number(nextSourceEnd.toFixed(3)) } : c)),
      }));
    }
  }

  function handleTimelinePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  async function handleExportMix() {
    setExporting(true);
    setExportProgress(0);
    setError("");
    cancelExportRef.current = false;
    setShowExportModal(true);
    try {
      const result = await renderMultitrackAudioMix({
        doc,
        sources,
        onProgress: setExportProgress,
        isCancelled: () => cancelExportRef.current,
      });
      setExportUrl(URL.createObjectURL(result.blob));
      setExportDuration(result.duration);
      setStatus("Master WAV rendered");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not export audio mix.");
      setShowExportModal(false);
    } finally {
      setExporting(false);
    }
  }

  async function handleCreateProject() {
    try {
      const created = await createProject(projectTitle === "Audio Studio" ? "Untitled audio mix" : projectTitle, "audio");
      setParams({ project: created.id });
      const firstClip = doc.clips[0];
      if (firstClip && sources[firstClip.sourceId]) {
        const s = sources[firstClip.sourceId];
        const wav = encodeWavBlob(
          s.buffer.getChannelData(0),
          s.buffer.numberOfChannels > 1 ? s.buffer.getChannelData(1) : s.buffer.getChannelData(0),
          s.buffer.sampleRate,
        );
        await saveAudioProject(
          created.id,
          {
            version: 1,
            sourceAssetId: null,
            sourceName: s.name,
            sourceType: "audio/wav",
            sourceDuration: s.duration,
            sourceStart: firstClip.sourceStart,
            sourceEnd: firstClip.sourceEnd,
            speed: firstClip.speed,
            pitchMode: firstClip.pitchMode,
            gainDb: firstClip.gainDb,
            fadeIn: firstClip.fadeIn,
            fadeOut: firstClip.fadeOut,
          },
          new File([wav], s.name.endsWith(".wav") ? s.name : `${s.name}.wav`, { type: "audio/wav" }),
        );
      }
      setStatus("Saved as local project");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create local project.");
    }
  }

  const sourceList = Object.values(sources);
  const timelineWidthPx = Math.max(Math.max(400, timelineViewportWidth - 170), Math.round(timelineDuration * pixelsPerSecond));
  const visibleSeconds = timelineWidthPx / pixelsPerSecond;
  const rulerTicks = useMemo(() => {
    const step = pixelsPerSecond >= 90 ? 1 : pixelsPerSecond >= 45 ? 2 : 5;
    const ticks: number[] = [];
    for (let t = 0; t <= visibleSeconds; t += step) ticks.push(t);
    return ticks;
  }, [pixelsPerSecond, visibleSeconds]);

  return (
    <main className="video-studio-page audio-studio-page">
      <header className="video-studio-top">
        <div className="studio-project-identity">
          <NavBackButton fallback="/tools" />
          <BrandMark className="studio-app-mark" />
          <div>
            <h1>{projectTitle}</h1>
            <span className="studio-save-status" role="status">{status}</span>
          </div>
        </div>
        <div className="editor-top-actions">
          {!projectId && (
            <button type="button" className="studio-new-project" onClick={() => void handleCreateProject()}>
              Save project
            </button>
          )}
          <span className="studio-local-badge">● On-device</span>
          <button
            type="button"
            className="studio-export-trigger"
            disabled={!doc.clips.length || exporting}
            onClick={() => void handleExportMix()}
          >
            {exporting ? `Rendering ${exportProgress}%` : "Export WAV"}
          </button>
        </div>
      </header>

      <div className="video-editor-layout audio-studio-layout">
        {/* Left Pane: Audio & Video Sources Bin */}
        <aside className="video-bin audio-studio-bin" aria-label="Audio sources">
          <div className="preview-heading">
            <strong>Audio sources</strong>
            <span>{sourceList.length} loaded</span>
          </div>
          <div className="audio-studio-bin-body">
            <label className="studio-import-button audio-studio-import-btn">
              <span>{busy ? "Decoding…" : "+ Import audio / video"}</span>
              <input
                type="file"
                multiple
                accept="audio/*,video/*,.mkv,.webm,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                disabled={busy}
                onChange={(e) => {
                  void importFiles(e.currentTarget.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            {error && <p className="resize-error" role="alert">{error}</p>}

            {!sourceList.length ? (
              <div
                className="studio-bin-empty"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void importFiles(e.dataTransfer.files);
                }}
              >
                <span>♪</span>
                <strong>Drop audio or video files</strong>
                <p>MP3, WAV, M4A, OGG, FLAC, or MP4/MOV/WebM video tracks. Everything stays in your browser.</p>
              </div>
            ) : (
              <ul className="audio-source-list">
                {sourceList.map((src) => (
                  <li
                    key={src.id}
                    className="audio-source-card"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("application/x-op-audio-source", src.id)}
                  >
                    <div className="audio-source-card-top">
                      <span className="audio-source-badge">{src.kind === "video" ? "VID" : "AUD"}</span>
                      <strong title={src.name}>{src.name}</strong>
                    </div>
                    <small>{src.duration.toFixed(2)} s · {src.sampleRate} Hz · {src.channels}ch</small>
                    <div className="audio-source-card-actions">
                      <button type="button" className="editor-action" onClick={() => addSourceToTrack(src)}>
                        + Add to track
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Center Pane: Master Monitor & Transport */}
        <section className="editor-preview audio-studio-monitor" aria-label="Master monitor">
          <div className="preview-heading">
            <strong>Master monitor</strong>
            <span>{doc.tracks.length} tracks · {doc.clips.length} clips</span>
          </div>
          <div
            className="audio-studio-monitor-stage"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void importFiles(e.dataTransfer.files);
            }}
          >
            <div className="audio-studio-timecode-readout">
              <strong>{formatTimecode(playhead)}</strong>
              <span>/ {formatTimecode(doc.clips.reduce((m, c) => Math.max(m, c.start + getClipDuration(c)), 0))}</span>
            </div>

            <div className="audio-studio-meters" aria-label="Stereo output level">
              <div className="audio-meter-row">
                <span>L</span>
                <div className="audio-meter-track"><div className="audio-meter-fill" style={{ width: `${meterLevel.l}%` }} /></div>
              </div>
              <div className="audio-meter-row">
                <span>R</span>
                <div className="audio-meter-track"><div className="audio-meter-fill" style={{ width: `${meterLevel.r}%` }} /></div>
              </div>
            </div>

            <div className="audio-studio-master-gain">
              <label>
                <span>Master level <strong>{doc.masterGainDb > 0 ? `+${doc.masterGainDb}` : doc.masterGainDb} dB</strong></span>
                <input
                  type="range"
                  min="-24"
                  max="12"
                  step="0.5"
                  value={doc.masterGainDb}
                  onChange={(e) => {
                    const masterGainDb = e.currentTarget.valueAsNumber;
                    commitDoc((prev) => ({ ...prev, masterGainDb }), false);
                  }}
                />
              </label>
            </div>
          </div>

          <div className="editor-transport">
            <span className="studio-timecode">{formatTimecode(playhead)}</span>
            <div className="studio-playback-controls">
              <button type="button" title="Jump to start" aria-label="Jump to start" onClick={() => { stopPlayback(); setPlayhead(0); }}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M18 6l-9 6 9 6V6z" /></svg>
              </button>
              <button type="button" title="Back 1 second" aria-label="Back 1 second" onClick={() => { const t = Math.max(0, playhead - 1); setPlayhead(t); if (playing) void startPlaybackFrom(t); }}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 6l-7 6 7 6V6zM20 6l-7 6 7 6V6z" /></svg>
              </button>
              <button type="button" className="studio-play-button" title={playing ? "Pause (Space)" : "Play (Space)"} aria-label={playing ? "Pause" : "Play"} onClick={togglePlay}>
                {playing ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5l11 6.5-11 6.5V5.5z" /></svg>
                )}
              </button>
              <button type="button" title="Forward 1 second" aria-label="Forward 1 second" onClick={() => { const t = Math.min(timelineDuration, playhead + 1); setPlayhead(t); if (playing) void startPlaybackFrom(t); }}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6l7 6-7 6V6zM13 6l7 6-7 6V6z" /></svg>
              </button>
            </div>
            <div className="studio-player-tools">
              <button
                type="button"
                className={loop ? "is-active-tool" : ""}
                title="Toggle loop"
                aria-pressed={loop}
                onClick={() => setLoop((v) => !v)}
              >
                Loop
              </button>
            </div>
          </div>
        </section>

        {/* Right Pane: Independent Clip Inspector */}
        <aside className="video-inspector audio-studio-inspector" aria-label="Clip inspector">
          <div className="preview-heading">
            <strong>Clip inspector</strong>
            <span>{selectedClip ? selectedClip.name : "No clip selected"}</span>
          </div>

          {!selectedClip || !selectedSource ? (
            <div className="studio-bin-empty audio-inspector-empty">
              <span>🎚</span>
              <strong>Independent clip controls</strong>
              <p>Select any clip on a track to adjust its gain, speed, pitch, fades, trim, split, replace, or merge.</p>
            </div>
          ) : (
            <div className="audio-inspector-body">
              <div className="audio-control-group">
                <p className="audio-control-group-title">Clip &amp; source</p>
                <label className="ratio-field">
                  Clip name
                  <input
                    type="text"
                    className="studio-details-input"
                    value={selectedClip.name}
                    onChange={(e) => updateSelectedClip({ name: e.currentTarget.value })}
                  />
                </label>
                {sourceList.length > 1 && (
                  <label className="ratio-field">
                    Replace source
                    <select
                      value={selectedClip.sourceId}
                      onChange={(e) => {
                        const nextSrc = sources[e.currentTarget.value];
                        if (!nextSrc) return;
                        updateSelectedClip({
                          sourceId: nextSrc.id,
                          name: nextSrc.name,
                          sourceStart: 0,
                          sourceEnd: nextSrc.duration,
                        });
                      }}
                    >
                      {sourceList.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="audio-control-group">
                <p className="audio-control-group-title">Level &amp; normalization</p>
                <div className="dimension-fields">
                  <label>
                    Gain <span>dB</span>
                    <input
                      type="number"
                      min="-60"
                      max="24"
                      step="0.5"
                      value={selectedClip.gainDb}
                      onChange={(e) => {
                        const v = e.currentTarget.valueAsNumber;
                        if (Number.isFinite(v)) updateSelectedClip({ gainDb: Math.max(-60, Math.min(24, v)) });
                      }}
                    />
                  </label>
                  <div className="audio-inspector-inline-actions">
                    <button type="button" className="editor-action" onClick={normalizeSelectedClip}>Normalize</button>
                    <button
                      type="button"
                      className={`editor-action${selectedClip.muted ? " danger" : ""}`}
                      onClick={() => updateSelectedClip({ muted: !selectedClip.muted })}
                    >
                      {selectedClip.muted ? "Unmute" : "Mute"}
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  className="video-speed-range"
                  min="-36"
                  max="24"
                  step="0.5"
                  value={Math.max(-36, Math.min(24, selectedClip.gainDb))}
                  onChange={(e) => updateSelectedClip({ gainDb: e.currentTarget.valueAsNumber })}
                />
              </div>

              <div className="audio-control-group">
                <p className="audio-control-group-title">Speed &amp; pitch</p>
                <div className="dimension-fields">
                  <label>
                    Speed <span>0.1–16×</span>
                    <input
                      type="number"
                      min="0.1"
                      max="16"
                      step="0.05"
                      value={selectedClip.speed}
                      onChange={(e) => {
                        const v = e.currentTarget.valueAsNumber;
                        if (Number.isFinite(v) && v >= 0.1 && v <= 16) updateSelectedClip({ speed: v });
                      }}
                    />
                  </label>
                  <label>
                    Pitch <span>mode</span>
                    <select
                      value={selectedClip.pitchMode}
                      onChange={(e) => updateSelectedClip({ pitchMode: e.currentTarget.value as "preserve" | "natural" })}
                    >
                      <option value="preserve">Preserve</option>
                      <option value="natural">Natural</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="audio-control-group">
                <p className="audio-control-group-title">Timing &amp; fades</p>
                <div className="dimension-fields">
                  <label>
                    Start <span>s</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={Number(selectedClip.start.toFixed(3))}
                      onChange={(e) => {
                        const v = e.currentTarget.valueAsNumber;
                        if (Number.isFinite(v) && v >= 0) updateSelectedClip({ start: v });
                      }}
                    />
                  </label>
                  <label>
                    Duration <span>s</span>
                    <input type="text" readOnly value={`${getClipDuration(selectedClip).toFixed(3)} s`} />
                  </label>
                  <label>
                    Fade in <span>s</span>
                    <input
                      type="number"
                      min="0"
                      max={getClipDuration(selectedClip)}
                      step="0.05"
                      value={selectedClip.fadeIn}
                      onChange={(e) => {
                        const v = e.currentTarget.valueAsNumber;
                        if (Number.isFinite(v) && v >= 0) updateSelectedClip({ fadeIn: v });
                      }}
                    />
                  </label>
                  <label>
                    Fade out <span>s</span>
                    <input
                      type="number"
                      min="0"
                      max={getClipDuration(selectedClip)}
                      step="0.05"
                      value={selectedClip.fadeOut}
                      onChange={(e) => {
                        const v = e.currentTarget.valueAsNumber;
                        if (Number.isFinite(v) && v >= 0) updateSelectedClip({ fadeOut: v });
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Bottom Pane: Multitrack Timeline */}
      <section className="video-timeline audio-studio-timeline" aria-label="Multitrack audio timeline">
        <div className="timeline-toolbar">
          <div className="timeline-edit-tools" role="toolbar" aria-label="Timeline edit tools">
            <button type="button" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!past.length} onClick={undo}>
              <svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
            </button>
            <button type="button" title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!future.length} onClick={redo}>
              <svg viewBox="0 0 24 24"><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></svg>
            </button>
            <span className="timeline-toolbar-separator" aria-hidden="true" />
            <button type="button" title="Split clip at playhead (S)" aria-label="Split clip at playhead" disabled={!selectedClip} onClick={splitSelectedAtPlayhead}>
              <svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" /></svg>
            </button>
            <button type="button" title="Remove left of playhead ([)" aria-label="Remove left of playhead" disabled={!selectedClip} onClick={trimLeftAtPlayhead}>
              <svg viewBox="0 0 24 24"><path d="M5 4v16M9 12h11M13 8l-4 4 4 4" /></svg>
            </button>
            <button type="button" title="Remove right of playhead (])" aria-label="Remove right of playhead" disabled={!selectedClip} onClick={trimRightAtPlayhead}>
              <svg viewBox="0 0 24 24"><path d="M19 4v16M4 12h11M11 8l4 4-4 4" /></svg>
            </button>
            <button type="button" title="Join selected clip with next clip on track" aria-label="Join with next clip" disabled={!selectedClip || busy} onClick={() => void joinWithNextClip()}>
              <svg viewBox="0 0 24 24"><path d="M4 8h6v8H4zM14 8h6v8h-6zM10 12h4" /></svg>
            </button>
            <button type="button" title="Duplicate selected clip" aria-label="Duplicate selected clip" disabled={!selectedClip} onClick={duplicateSelectedClip}>
              <svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            </button>
            <button type="button" title="Remove selected clip (Del)" aria-label="Remove selected clip" disabled={!selectedClip} onClick={deleteSelectedClip}>
              <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
            </button>
          </div>

          <div className="timeline-actions">
            <label>
              <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.currentTarget.checked)} />
              Snap
            </label>
            <div className="timeline-zoom-group">
              <span>Zoom</span>
              <input
                type="range"
                className="timeline-zoom-slider"
                min="20"
                max="240"
                step="4"
                value={pixelsPerSecond}
                aria-label="Timeline zoom"
                onChange={(e) => setPixelsPerSecond(e.currentTarget.valueAsNumber)}
              />
            </div>
            <button type="button" className="editor-action" onClick={addTrack}>+ Add track</button>
          </div>
        </div>

        <div
          className="timeline-scroll audio-timeline-scroll"
          ref={timelineTracksRef}
          onPointerMove={handleTimelinePointerMove}
          onPointerUp={handleTimelinePointerUp}
          onPointerCancel={handleTimelinePointerUp}
        >
          {/* Ruler Row */}
          <div className="audio-ruler-row" style={{ width: `${170 + timelineWidthPx}px` }}>
            <div className="audio-track-corner">Tracks</div>
            <div
              className="timeline-ruler audio-timeline-ruler"
              style={{ width: `${timelineWidthPx}px` }}
              onPointerDown={(e) => {
                rulerScrubRef.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                const r = e.currentTarget.getBoundingClientRect();
                const t = Math.max(0, (e.clientX - r.left) / pixelsPerSecond);
                setPlayhead(t);
                if (playing) void startPlaybackFrom(t);
              }}
              onPointerMove={(e) => {
                if (rulerScrubRef.current !== e.pointerId) return;
                const r = e.currentTarget.getBoundingClientRect();
                setPlayhead(Math.max(0, (e.clientX - r.left) / pixelsPerSecond));
              }}
              onPointerUp={(e) => {
                if (rulerScrubRef.current === e.pointerId) rulerScrubRef.current = null;
              }}
            >
              {rulerTicks.map((t) => (
                <span key={t} className="audio-ruler-tick" style={{ left: `${t * pixelsPerSecond}px` }}>
                  {t}s
                </span>
              ))}
            </div>
          </div>

          {/* Track Rows */}
          <div className="audio-tracks-wrap" style={{ width: `${170 + timelineWidthPx}px` }}>
            <button
              type="button"
              className="audio-playhead-line"
              style={{ left: `${170 + playhead * pixelsPerSecond}px` }}
              aria-label="Drag to seek audio playhead"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                rulerScrubRef.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (rulerScrubRef.current !== e.pointerId || !timelineTracksRef.current) return;
                const container = timelineTracksRef.current;
                const r = container.getBoundingClientRect();
                const x = e.clientX - r.left + container.scrollLeft - 170;
                setPlayhead(Math.max(0, x / pixelsPerSecond));
              }}
              onPointerUp={(e) => {
                if (rulerScrubRef.current === e.pointerId) {
                  rulerScrubRef.current = null;
                  if (playing) void startPlaybackFrom(playhead);
                }
              }}
              onPointerCancel={(e) => {
                if (rulerScrubRef.current === e.pointerId) rulerScrubRef.current = null;
              }}
            >
              <span />
            </button>
            {doc.tracks.map((track) => {
              const trackClips = doc.clips.filter((c) => c.trackId === track.id);
              return (
                <div
                  key={track.id}
                  data-track-id={track.id}
                  className={`audio-track-row${activeTrackId === track.id ? " is-active" : ""}${track.muted ? " is-muted" : ""}`}
                  onClick={() => setActiveTrackId(track.id)}
                >
                  <div className="audio-track-header">
                    <div className="audio-track-title-row">
                      <strong>{track.name}</strong>
                      <div className="timeline-track-controls">
                        <button
                          type="button"
                          title={track.muted ? "Unmute track" : "Mute track"}
                          aria-label={track.muted ? `Unmute ${track.name}` : `Mute ${track.name}`}
                          aria-pressed={track.muted}
                          className={track.muted ? "active" : ""}
                          onClick={(e) => {
                            e.stopPropagation();
                            commitDoc((prev) => ({
                              ...prev,
                              tracks: prev.tracks.map((t) => (t.id === track.id ? { ...t, muted: !t.muted } : t)),
                            }));
                          }}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M11 5L6 9H2v6h4l5 4V5z" />
                            {track.muted ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7" />}
                          </svg>
                        </button>
                        <button
                          type="button"
                          title={track.solo ? "Unsolo track" : "Solo track"}
                          aria-label={track.solo ? `Unsolo ${track.name}` : `Solo ${track.name}`}
                          aria-pressed={track.solo}
                          className={track.solo ? "active" : ""}
                          onClick={(e) => {
                            e.stopPropagation();
                            commitDoc((prev) => ({
                              ...prev,
                              tracks: prev.tracks.map((t) => (t.id === track.id ? { ...t, solo: !t.solo } : t)),
                            }));
                          }}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                          </svg>
                        </button>
                        {doc.tracks.length > 1 && (
                          <button
                            type="button"
                            title="Remove track"
                            aria-label={`Remove ${track.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTrack(track.id);
                            }}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="range"
                      className="audio-track-gain"
                      min="-36"
                      max="12"
                      step="0.5"
                      value={track.gainDb}
                      title={`Track gain: ${track.gainDb} dB`}
                      aria-label={`${track.name} gain`}
                      onChange={(e) => {
                        const gainDb = e.currentTarget.valueAsNumber;
                        commitDoc((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) => (t.id === track.id ? { ...t, gainDb } : t)),
                        }), false);
                      }}
                    />
                  </div>

                  <div
                    className="audio-track-lane"
                    style={{ width: `${timelineWidthPx}px`, backgroundSize: `${pixelsPerSecond}px 100%` }}
                    onPointerDown={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      const t = Math.max(0, (e.clientX - r.left) / pixelsPerSecond);
                      setPlayhead(t);
                      if (playing) void startPlaybackFrom(t);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const r = e.currentTarget.getBoundingClientRect();
                      const dropAt = Math.max(0, (e.clientX - r.left) / pixelsPerSecond);
                      const srcId = e.dataTransfer.getData("application/x-op-audio-source");
                      if (srcId && sources[srcId]) {
                        addSourceToTrack(sources[srcId], track.id, dropAt);
                      } else if (e.dataTransfer.files?.length) {
                        void importFiles(e.dataTransfer.files, track.id, dropAt);
                      }
                    }}
                  >
                    {trackClips.map((clip) => {
                      const src = sources[clip.sourceId];
                      const dur = getClipDuration(clip);
                      const leftPx = clip.start * pixelsPerSecond;
                      const widthPx = Math.max(18, dur * pixelsPerSecond);
                      const isSelected = clip.id === selectedClipId;
                      return (
                        <div
                          key={clip.id}
                          className={`audio-timeline-clip${isSelected ? " selected" : ""}${clip.muted ? " is-muted" : ""}`}
                          style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setSelectedClipId(clip.id);
                            setActiveTrackId(track.id);
                            dragRef.current = {
                              kind: "move",
                              pointerId: e.pointerId,
                              clipId: clip.id,
                              originX: e.clientX,
                              originStart: clip.start,
                              originTrackId: clip.trackId,
                              moved: false,
                            };
                          }}
                        >
                          <span
                            className="audio-clip-trim-handle left"
                            title="Drag to trim start"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setSelectedClipId(clip.id);
                              dragRef.current = {
                                kind: "trim-start",
                                pointerId: e.pointerId,
                                clipId: clip.id,
                                originX: e.clientX,
                                originStart: clip.start,
                                originSourceStart: clip.sourceStart,
                                originSourceEnd: clip.sourceEnd,
                                moved: false,
                              };
                            }}
                          />
                          {src && (
                            <AudioStudioClipWave
                              peaks={src.peaks}
                              sourceDuration={src.duration}
                              sourceStart={clip.sourceStart}
                              sourceEnd={clip.sourceEnd}
                              gainDb={clip.gainDb}
                              fadeIn={clip.fadeIn}
                              fadeOut={clip.fadeOut}
                              clipDuration={dur}
                              muted={clip.muted || track.muted}
                            />
                          )}
                          <span className="audio-clip-label">
                            <strong>{clip.name}</strong>
                            <small>{clip.gainDb !== 0 ? `${clip.gainDb > 0 ? "+" : ""}${clip.gainDb}dB · ` : ""}{dur.toFixed(2)}s</small>
                          </span>
                          <span
                            className="audio-clip-trim-handle right"
                            title="Drag to trim end"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setSelectedClipId(clip.id);
                              dragRef.current = {
                                kind: "trim-end",
                                pointerId: e.pointerId,
                                clipId: clip.id,
                                originX: e.clientX,
                                originStart: clip.start,
                                originSourceStart: clip.sourceStart,
                                originSourceEnd: clip.sourceEnd,
                                moved: false,
                              };
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {showExportModal && (
        <div className="studio-modal-backdrop" role="dialog" aria-modal="true" aria-label="Audio mix export">
          <div className="studio-shortcuts-modal audio-export-modal">
            <div className="studio-export-heading">
              <div>
                <span>MASTER MIXDOWN</span>
                <h2>{exporting ? "Rendering WAV…" : "Mixdown ready"}</h2>
              </div>
              <button type="button" aria-label="Close export dialog" onClick={() => { if (exporting) cancelExportRef.current = true; setShowExportModal(false); }}>×</button>
            </div>
            {exporting ? (
              <ProcessingProgress label="Mixing tracks, speed, and fades" value={exportProgress} />
            ) : exportUrl ? (
              <div className="audio-export-result">
                <p className="source-info">48 kHz · 16-bit stereo PCM WAV · {exportDuration.toFixed(2)} s</p>
                <CustomMediaPreview kind="audio" src={exportUrl} label="Master audio mixdown" />
                <a className="export-button download-link" href={exportUrl} download="openproducer-audio-mix.wav">
                  Download Master WAV
                </a>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
