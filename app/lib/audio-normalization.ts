export function normalizationGain(peak: number, targetDb: number) {
  const target = 10 ** (targetDb / 20);
  return peak > 0 ? target / peak : 1;
}

export function createPcmWavHeader(frames: number, channels: number, sampleRate: number) {
  const bytes = new ArrayBuffer(44), view = new DataView(bytes);
  const text = (at: number, value: string) => [...value].forEach((character, index) => view.setUint8(at + index, character.charCodeAt(0)));
  const dataBytes = frames * channels * 2;
  text(0, "RIFF"); view.setUint32(4, 36 + dataBytes, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, dataBytes, true);
  return bytes;
}

export function encodeNormalizedPcm16(channels: Float32Array[], gain: number) {
  if (!channels.length || channels.some((channel) => channel.length !== channels[0].length)) throw new Error("Audio channels must have matching sample counts.");
  const frames = channels[0].length, pcm = new Int16Array(frames * channels.length);
  let offset = 0;
  for (let frame = 0; frame < frames; frame++) for (const channel of channels) {
    const sample = Math.max(-1, Math.min(1, channel[frame] * gain));
    pcm[offset++] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return pcm.buffer;
}
