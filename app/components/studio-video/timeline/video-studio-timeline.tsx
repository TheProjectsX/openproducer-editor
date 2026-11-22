import { Fragment, type MutableRefObject, type RefObject } from "react";
import type { VideoTimelineClip, VideoTimelineProject } from "../../../lib/project-store";
import { timelineContentWidth, timelineRulerOffset } from "../../../lib/video-timeline";
import { TimelineToolbar } from "./timeline-toolbar";
import { TimelineRuler } from "./timeline-ruler";
import { TimelineTrack } from "./timeline-track";
import { TimelinePlayhead } from "./timeline-playhead";

export function VideoStudioTimeline({
  timeline,
  timelineViewportWidth,
  historyVersion,
  historyRef,
  selectedClip,
  mainClipAtPlayhead,
  ripplePrimaryTrack,
  snapEnabled,
  snapThreshold,
  zoom,
  pxPerSecond,
  deleteHoveredSide,
  undo,
  redo,
  splitSelected,
  removeClip,
  setRipplePrimaryTrack,
  setSnapEnabled,
  setSnapThreshold,
  setZoom,
  fitTimelineZoom,
  timelineScrollRef,
  beginTimelineMarquee,
  moveTimelineMarquee,
  finishTimelineMarquee,
  cancelTimelineMarquee,
  justSeekedRef,
  suppressTimelineClickRef,
  selectTimelineClip,
  rulerHoverGuide,
  setPlaying,
  seekTimeline,
  showRulerHoverGuide,
  setRulerHoverGuide,
  setTimeline,
  activeTrackDragKind,
  nextOverlayTrack,
  nextAudioTrack,
  previewTrackDrop,
  finishTrackDrop,
  audioLaneCount,
  overlayLaneCount,
  visibleTracks,
  dragKind,
  dropPreview,
  waveforms,
  selected,
  selectedClips,
  assetUrls,
  draggingRef,
  toggleTrackState,
  setDropPreview,
  moveTrim,
  finishTrim,
  beginTrim,
  setActiveTrackDragKind,
  setHoveredClipId,
  setClipContextMenu,
  playheadDragRef,
  movePlayhead,
  finishPlayheadDrag,
  exporting,
}: {
  timeline: VideoTimelineProject;
  timelineViewportWidth: number;
  historyVersion: number;
  historyRef: MutableRefObject<{ past: VideoTimelineProject[]; future: VideoTimelineProject[] }>;
  selectedClip?: VideoTimelineClip;
  mainClipAtPlayhead?: VideoTimelineClip;
  ripplePrimaryTrack: boolean;
  snapEnabled: boolean;
  snapThreshold: string;
  zoom: string;
  pxPerSecond: number;
  deleteHoveredSide: (side: "left" | "right") => void;
  undo: () => void;
  redo: () => void;
  splitSelected: () => void;
  removeClip: (id: string) => void;
  setRipplePrimaryTrack: (ripple: boolean) => void;
  setSnapEnabled: (snap: boolean) => void;
  setSnapThreshold: (threshold: string) => void;
  setZoom: (zoom: string) => void;
  fitTimelineZoom: () => void;
  timelineScrollRef: RefObject<HTMLDivElement | null>;
  beginTimelineMarquee: (event: React.PointerEvent<HTMLDivElement>) => void;
  moveTimelineMarquee: (event: React.PointerEvent<HTMLDivElement>) => void;
  finishTimelineMarquee: (event: React.PointerEvent<HTMLDivElement>) => void;
  cancelTimelineMarquee: (event: React.PointerEvent<HTMLDivElement>) => void;
  justSeekedRef: MutableRefObject<boolean>;
  suppressTimelineClickRef: MutableRefObject<boolean>;
  selectTimelineClip: (id: string, additive?: boolean, range?: boolean) => void;
  rulerHoverGuide: { left: number; top: number; height: number } | null;
  setPlaying: (playing: boolean) => void;
  seekTimeline: (clientX: number, ruler: HTMLElement, disableSnap?: boolean) => void;
  showRulerHoverGuide: (event: React.PointerEvent<HTMLDivElement>) => void;
  setRulerHoverGuide: (guide: { left: number; top: number; height: number } | null) => void;
  setTimeline: React.Dispatch<React.SetStateAction<VideoTimelineProject>>;
  activeTrackDragKind: "visual" | "audio" | null;
  nextOverlayTrack: number;
  nextAudioTrack: number;
  previewTrackDrop: (event: React.DragEvent<HTMLDivElement>, track: number) => void;
  finishTrackDrop: (event: React.DragEvent<HTMLDivElement>, track: number) => void;
  audioLaneCount: number;
  overlayLaneCount: number;
  visibleTracks: number[];
  dragKind: "visual" | "audio" | null;
  dropPreview: { track: number; start: number; duration: number } | null;
  waveforms: Record<string, number[]>;
  selected: string;
  selectedClips: string[];
  assetUrls: Record<string, string>;
  draggingRef: MutableRefObject<{ kind: "asset" | "clip"; id: string; grabOffset: number } | null>;
  toggleTrackState: (track: number, key: "hidden" | "muted" | "locked") => void;
  setDropPreview: (preview: { track: number; start: number; duration: number } | null) => void;
  moveTrim: (event: React.PointerEvent<HTMLButtonElement>, clipId: string) => void;
  finishTrim: (event: React.PointerEvent<HTMLButtonElement>) => void;
  beginTrim: (event: React.PointerEvent<HTMLSpanElement>, clip: VideoTimelineClip, edge: "left" | "right") => void;
  setActiveTrackDragKind: (kind: "visual" | "audio" | null) => void;
  setHoveredClipId: (id: string) => void;
  setClipContextMenu: (menu: { clipId: string; x: number; y: number } | null) => void;
  playheadDragRef: MutableRefObject<{ pointerId: number; initialX: number; initialTime: number } | null>;
  movePlayhead: (event: React.PointerEvent<HTMLButtonElement>) => void;
  finishPlayheadDrag: (event: React.PointerEvent<HTMLButtonElement>) => void;
  exporting: boolean;
}) {
  const timelineWidth = timelineContentWidth(timeline.duration, pxPerSecond, timelineViewportWidth);

  return (
    <section className="video-timeline" inert={exporting}>
      <TimelineToolbar
        duration={timeline.duration}
        historyVersion={historyVersion}
        historyRef={historyRef}
        selectedClip={selectedClip}
        mainClipAtPlayhead={mainClipAtPlayhead}
        ripplePrimaryTrack={ripplePrimaryTrack}
        snapEnabled={snapEnabled}
        snapThreshold={snapThreshold}
        zoom={zoom}
        pxPerSecond={pxPerSecond}
        deleteHoveredSide={deleteHoveredSide}
        undo={undo}
        redo={redo}
        splitSelected={splitSelected}
        removeClip={removeClip}
        setRipplePrimaryTrack={setRipplePrimaryTrack}
        setSnapEnabled={setSnapEnabled}
        setSnapThreshold={setSnapThreshold}
        setZoom={setZoom}
        fitTimelineZoom={fitTimelineZoom}
      />
      <div
        className="timeline-scroll"
        ref={timelineScrollRef}
        title="Hold Ctrl and scroll to zoom the timeline"
        onPointerDown={beginTimelineMarquee}
        onPointerMove={moveTimelineMarquee}
        onPointerUp={finishTimelineMarquee}
        onPointerCancel={cancelTimelineMarquee}
        onClick={(event) => {
          if (justSeekedRef.current || suppressTimelineClickRef.current) return;
          if (
            !(event.target instanceof Element) ||
            !event.target.closest(".timeline-clip, .timeline-ruler, .timeline-playhead")
          ) {
            selectTimelineClip("");
          }
        }}
      >
        <TimelineRuler
          timeline={timeline}
          timelineWidth={timelineWidth}
          pxPerSecond={pxPerSecond}
          rulerHoverGuide={rulerHoverGuide}
          justSeekedRef={justSeekedRef}
          setPlaying={setPlaying}
          seekTimeline={seekTimeline}
          showRulerHoverGuide={showRulerHoverGuide}
          setRulerHoverGuide={setRulerHoverGuide}
          setTimeline={setTimeline}
        />
        {activeTrackDragKind === "visual" && (
          <div
            className="track-lane timeline-new-overlay-target"
            data-track={nextOverlayTrack}
            onDragOver={(event) => previewTrackDrop(event, nextOverlayTrack)}
            onDrop={(event) => finishTrackDrop(event, nextOverlayTrack)}
          >
            Move to new Overlay {nextOverlayTrack}
          </div>
        )}
        <div
          className="timeline-center-spacer"
          style={{ paddingTop: Math.max(0, audioLaneCount - overlayLaneCount) * 52 }}
          aria-hidden="true"
        />
        {visibleTracks.map((track) => (
          <Fragment key={track}>
            <TimelineTrack
              track={track}
              timeline={timeline}
              dragKind={dragKind}
              timelineWidth={timelineWidth - timelineRulerOffset()}
              pxPerSecond={pxPerSecond}
              dropPreview={dropPreview}
              waveforms={waveforms}
              selected={selected}
              selectedClips={selectedClips}
              assetUrls={assetUrls}
              justSeekedRef={justSeekedRef}
              suppressTimelineClickRef={suppressTimelineClickRef}
              draggingRef={draggingRef}
              toggleTrackState={toggleTrackState}
              previewTrackDrop={previewTrackDrop}
              finishTrackDrop={finishTrackDrop}
              selectTimelineClip={selectTimelineClip}
              setDropPreview={setDropPreview}
              moveTrim={moveTrim}
              finishTrim={finishTrim}
              beginTrim={beginTrim}
              setActiveTrackDragKind={setActiveTrackDragKind}
              setHoveredClipId={setHoveredClipId}
              setClipContextMenu={setClipContextMenu}
            />
          </Fragment>
        ))}
        {dragKind === "audio" && (
          <div
            className="track-lane timeline-new-overlay-target timeline-new-audio-target"
            data-track={nextAudioTrack}
            onDragOver={(event) => previewTrackDrop(event, nextAudioTrack)}
            onDrop={(event) => finishTrackDrop(event, nextAudioTrack)}
          >
            Move to new Audio {-nextAudioTrack}
          </div>
        )}
        <div
          className="timeline-center-spacer"
          style={{ paddingBottom: Math.max(0, overlayLaneCount - audioLaneCount) * 52 }}
          aria-hidden="true"
        />
        <TimelinePlayhead
          hasClips={Boolean(timeline.clips.length)}
          playhead={timeline.playhead}
          pxPerSecond={pxPerSecond}
          playheadDragRef={playheadDragRef}
          setPlaying={setPlaying}
          movePlayhead={movePlayhead}
          finishPlayheadDrag={finishPlayheadDrag}
        />
      </div>
    </section>
  );
}
