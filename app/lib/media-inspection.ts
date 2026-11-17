export type MediaTrackInspection = {
  kind: "audio" | "video";
  codec: string;
  decodable: boolean;
  details: string;
  width?: number;
  height?: number;
};

export type MediaFileInspection = {
  container: string;
  mimeType: string;
  duration: number | null;
  tracks: MediaTrackInspection[];
};

/** Inspect container and track codecs from file bytes. File names and extensions are never used to infer support. */
export async function inspectMediaFile(file: File): Promise<MediaFileInspection> {
  const { ALL_FORMATS, BlobSource, Input } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    if (!(await input.canRead())) throw new Error("The file container is not recognized by the local media reader.");
    const format = await input.getFormat();
    const [videoTracks, audioTracks, duration, mimeType] = await Promise.all([
      input.getVideoTracks(),
      input.getAudioTracks(),
      input.getDurationFromMetadata(),
      input.getMimeType(),
    ]);
    const tracks = await Promise.all([
      ...videoTracks.map(async (track): Promise<MediaTrackInspection> => {
        const [width, height, codec, decodable] = await Promise.all([track.getCodedWidth(), track.getCodedHeight(), track.getCodec(), track.canDecode()]);
        return { kind: "video", codec: codec ?? "unknown", decodable, details: `${width}×${height}`, width, height };
      }),
      ...audioTracks.map(async (track): Promise<MediaTrackInspection> => ({
        kind: "audio",
        codec: (await track.getCodec()) ?? "unknown",
        decodable: await track.canDecode(),
        details: `${await track.getNumberOfChannels()} channel(s), ${await track.getSampleRate()} Hz`,
      })),
    ]);
    if (!tracks.length) throw new Error("The file contains no supported audio or video tracks.");
    const unsupported = tracks.filter((track) => !track.decodable);
    if (unsupported.length) {
      const labels = unsupported.map((track) => `${track.kind} ${track.codec}`).join(", ");
      throw new Error(`This browser cannot decode ${labels} in this file. It was not added to the project.`);
    }
    return { container: format.name, mimeType, duration, tracks };
  } finally {
    input.dispose();
  }
}
