import type { MutableRefObject } from "react";
import type { VideoTimelineAsset, VideoTimelineClip, VideoTimelineProject } from "../../../lib/project-store";
import { clipLength } from "../utils";

export function TimelineTrack({
  track,
  timeline,
  dragKind,
  timelineWidth,
  pxPerSecond,
  dropPreview,
  waveforms,
  selected,
  selectedClips,
  assetUrls,
  justSeekedRef,
  suppressTimelineClickRef,
  draggingRef,
  toggleTrackState,
  previewTrackDrop,
  finishTrackDrop,
  selectTimelineClip,
  setDropPreview,
  moveTrim,
  finishTrim,
  beginTrim,
  setActiveTrackDragKind,
  setHoveredClipId,
  setClipContextMenu,
}: {
  track: number;
  timeline: VideoTimelineProject;
  dragKind: "visual" | "audio" | null;
  timelineWidth: number;
  pxPerSecond: number;
  dropPreview: { track: number; start: number; duration: number } | null;
  waveforms: Record<string, number[]>;
  selected: string;
  selectedClips: string[];
  assetUrls: Record<string, string>;
  justSeekedRef: MutableRefObject<boolean>;
  suppressTimelineClickRef: MutableRefObject<boolean>;
  draggingRef: MutableRefObject<{ kind: "asset" | "clip"; id: string; grabOffset: number } | null>;
  toggleTrackState: (track: number, key: "hidden" | "muted" | "locked") => void;
  previewTrackDrop: (event: React.DragEvent<HTMLDivElement>, track: number) => void;
  finishTrackDrop: (event: React.DragEvent<HTMLDivElement>, track: number) => void;
  selectTimelineClip: (id: string, additive?: boolean, range?: boolean) => void;
  setDropPreview: (preview: { track: number; start: number; duration: number } | null) => void;
  moveTrim: (event: React.PointerEvent<HTMLButtonElement>, clipId: string) => void;
  finishTrim: (event: React.PointerEvent<HTMLButtonElement>) => void;
  beginTrim: (event: React.PointerEvent<HTMLSpanElement>, clip: VideoTimelineClip, edge: "left" | "right") => void;
  setActiveTrackDragKind: (kind: "visual" | "audio" | null) => void;
  setHoveredClipId: (id: string) => void;
  setClipContextMenu: (menu: { clipId: string; x: number; y: number } | null) => void;
}) {
  const trackLabel =
    track === 0
      ? timeline.clips.some((clip) => clip.track === 0)
        ? "Video 1"
        : ""
      : track > 0
        ? `Overlay ${track}`
        : `Audio ${-track}`;
  const trackState = timeline.trackStates?.[track];
  const showTrackControls = Boolean(trackLabel);

  return (
    <div
      className={`timeline-track ${!timeline.clips.length && !dragKind && track === 0 ? "empty-main" : ""}${
        trackState?.locked ? " is-locked" : ""
      }${trackState?.hidden ? " is-hidden" : ""}${trackState?.muted ? " is-muted" : ""}`}
    >
      <strong>
        <span className="timeline-track-name">{trackLabel}</span>
        {showTrackControls && (
          <span className="timeline-track-controls">
            {track >= 0 && (
              <button
                type="button"
                className={trackState?.hidden ? "active" : ""}
                aria-pressed={Boolean(trackState?.hidden)}
                aria-label={trackState?.hidden ? `Show ${trackLabel}` : `Hide ${trackLabel}`}
                title={trackState?.hidden ? `Show ${trackLabel}` : `Hide ${trackLabel}`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleTrackState(track, "hidden");
                }}
              >
                {trackState?.hidden ? "⊘" : "👁"}
              </button>
            )}
            <button
              type="button"
              className={trackState?.muted ? "active" : ""}
              aria-pressed={Boolean(trackState?.muted)}
              aria-label={trackState?.muted ? `Unmute ${trackLabel}` : `Mute ${trackLabel}`}
              title={trackState?.muted ? `Unmute ${trackLabel}` : `Mute ${trackLabel}`}
              onClick={(event) => {
                event.stopPropagation();
                toggleTrackState(track, "muted");
              }}
            >
              {trackState?.muted ? "🔇" : "🔊"}
            </button>
            <button
              type="button"
              className={trackState?.locked ? "active" : ""}
              aria-pressed={Boolean(trackState?.locked)}
              aria-label={trackState?.locked ? `Unlock ${trackLabel}` : `Lock ${trackLabel}`}
              title={trackState?.locked ? `Unlock ${trackLabel}` : `Lock ${trackLabel}`}
              onClick={(event) => {
                event.stopPropagation();
                toggleTrackState(track, "locked");
              }}
            >
              {trackState?.locked ? "🔒" : "🔓"}
            </button>
          </span>
        )}
      </strong>
      <div
        className="track-lane"
        data-track={track}
        style={{ width: timelineWidth }}
        onDragOver={(event) => previewTrackDrop(event, track)}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropPreview(null);
        }}
        onDrop={(event) => finishTrackDrop(event, track)}
        onClick={() => {
          if (!justSeekedRef.current && !suppressTimelineClickRef.current) selectTimelineClip("");
        }}
      >
        {!timeline.clips.length && track === 0 && (
          <span className="timeline-empty-prompt">Drag media here to start creating</span>
        )}
        {dropPreview?.track === track && (
          <div
            className="timeline-drop-preview"
            aria-hidden="true"
            style={{ left: dropPreview.start * pxPerSecond, width: Math.max(22, dropPreview.duration * pxPerSecond) }}
          >
            <span>{dropPreview.start.toFixed(2)}s</span>
          </div>
        )}
        {timeline.clips
          .filter((clip) => clip.track === track)
          .map((clip) => {
            const asset = timeline.assets.find((item) => item.id === clip.assetId);
            const waveformAsset =
              asset?.kind === "audio"
                ? asset
                : asset?.kind === "video"
                  ? timeline.assets.find(
                      (item) => item.kind === "audio" && item.derivedFromAssetId === asset.id
                    ) ?? (asset.hasAudio !== false ? asset : undefined)
                  : undefined;
            const waveform = waveformAsset ? waveforms[waveformAsset.id] : undefined;
            const waveformStart = waveformAsset
              ? Math.floor((clip.sourceStart / waveformAsset.duration) * (waveform?.length ?? 0))
              : 0;
            const waveformEnd = waveformAsset
              ? Math.ceil((clip.sourceEnd / waveformAsset.duration) * (waveform?.length ?? 0))
              : 0;
            const clipWaveformSlice = waveform?.slice(waveformStart, Math.max(waveformStart + 1, waveformEnd));
            const waveformBarCount = Math.max(1, Math.floor((clipLength(clip) * pxPerSecond) / 2.5));
            const clipWaveform = clipWaveformSlice?.length
              ? Array.from({ length: Math.min(waveformBarCount, clipWaveformSlice.length) }, (_, index) => {
                  const barCount = Math.min(waveformBarCount, clipWaveformSlice.length);
                  const start = Math.floor((index * clipWaveformSlice.length) / barCount);
                  const end = Math.max(start + 1, Math.floor(((index + 1) * clipWaveformSlice.length) / barCount));
                  return Math.max(...clipWaveformSlice.slice(start, end));
                })
              : undefined;
            const isClipSelected = selected === clip.id || selectedClips.includes(clip.id);

            return (
              <button
                draggable={!trackState?.locked}
                key={clip.id}
                data-clip-id={clip.id}
                className={`timeline-clip ${isClipSelected ? "selected" : ""} ${asset?.kind ?? ""}`}
                style={{ left: clip.start * pxPerSecond, width: Math.max(22, clipLength(clip) * pxPerSecond) }}
                onPointerMove={(event) => moveTrim(event, clip.id)}
                onPointerUp={finishTrim}
                onPointerCancel={finishTrim}
                onDragStart={(event) => {
                  if (trackState?.locked) {
                    event.preventDefault();
                    return;
                  }
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const grabOffset = event.clientX - bounds.left;
                  draggingRef.current = { kind: "clip", id: clip.id, grabOffset };
                  setActiveTrackDragKind(asset?.kind === "audio" ? "audio" : "visual");
                  event.dataTransfer.setData("text/clip", clip.id);
                  event.dataTransfer.setData("text/clip-grab-offset", String(grabOffset));
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  draggingRef.current = null;
                  setActiveTrackDragKind(null);
                  setDropPreview(null);
                }}
                onPointerEnter={() => setHoveredClipId(clip.id)}
                onFocus={() => setHoveredClipId(clip.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!selectedClips.includes(clip.id)) selectTimelineClip(clip.id);
                  setHoveredClipId(clip.id);
                  setClipContextMenu({
                    clipId: clip.id,
                    x: Math.min(window.innerWidth - 190, event.clientX),
                    y: Math.min(window.innerHeight - 250, event.clientY),
                  });
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  selectTimelineClip(clip.id, event.ctrlKey || event.metaKey, event.shiftKey);
                  setHoveredClipId(clip.id);
                }}
              >
                {asset?.kind === "image" && assetUrls[asset.id] && (
                  <img className="studio-clip-visual" src={assetUrls[asset.id]} alt="" aria-hidden="true" />
                )}
                {asset?.kind === "video" && assetUrls[asset.id] && (
                  <video
                    className="studio-clip-visual"
                    src={assetUrls[clip.assetId]}
                    muted
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={(event) => {
                      event.currentTarget.currentTime = Math.min(0.1, asset.duration / 2);
                    }}
                    aria-hidden="true"
                  />
                )}
                {clipWaveform && (
                  <span
                    className={asset?.kind === "video" ? "studio-clip-wave video-audio-wave" : "studio-clip-wave"}
                    aria-hidden="true"
                  >
                    {clipWaveform.map((peak, index) => (
                      <i key={index} style={{ height: String(Math.max(12, peak * 100)) + "%" }} />
                    ))}
                  </span>
                )}
                <span
                  className="timeline-trim-handle left"
                  aria-hidden="true"
                  onPointerDown={(event) => beginTrim(event, clip, "left")}
                />
                <span
                  className="timeline-trim-handle right"
                  aria-hidden="true"
                  onPointerDown={(event) => beginTrim(event, clip, "right")}
                />
                <strong>{asset?.name}</strong>
                <small>
                  {clipLength(clip).toFixed(2)}s · {clip.speed.toFixed(3)}×
                </small>
                {clip.keyframes?.map((frame, index) => (
                  <span
                    key={`${clip.id}-key-${index}`}
                    className="timeline-keyframe"
                    aria-hidden="true"
                    style={{
                      left: `${Math.max(0, Math.min(100, (frame.time / Math.max(clipLength(clip), 0.001)) * 100))}%`,
                    }}
                  />
                ))}
              </button>
            );
          })}
      </div>
    </div>
  );
}
