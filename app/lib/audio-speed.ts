export const PITCH_PRESERVE_RENDER_CHUNK_FRAMES = 2048;

export function shouldUsePitchPreservingStretcher(pitchMode: "preserve" | "natural", speed: number) {
  return pitchMode === "preserve" && Math.abs(speed - 1) > 1e-6;
}

export function renderNaturalSpeedChunk(left: Float32Array, right: Float32Array, speed: number, offset: number, length: number) {
  const outputLeft = new Float32Array(length);
  const outputRight = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    const position = Math.min(left.length - 1, Math.max(0, (offset + index) * speed));
    const before = Math.floor(position), after = Math.min(left.length - 1, before + 1), mix = position - before;
    outputLeft[index] = left[before] + (left[after] - left[before]) * mix;
    outputRight[index] = right[before] + (right[after] - right[before]) * mix;
  }
  return { left: outputLeft, right: outputRight };
}
