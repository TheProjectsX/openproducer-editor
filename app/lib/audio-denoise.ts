const FRAME_SIZE = 2048;
const HOP_SIZE = FRAME_SIZE / 4;

function fft(real: Float64Array, imaginary: Float64Array, inverse = false) {
  const size = real.length;
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = (inverse ? 2 : -2) * Math.PI / length;
    const stepReal = Math.cos(angle), stepImaginary = Math.sin(angle);
    for (let start = 0; start < size; start += length) {
      let twiddleReal = 1, twiddleImaginary = 0;
      for (let offset = 0; offset < length / 2; offset++) {
        const even = start + offset, odd = even + length / 2;
        const oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary;
        const oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal;
        real[odd] = real[even] - oddReal; imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal; imaginary[even] += oddImaginary;
        const nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal; twiddleReal = nextReal;
      }
    }
  }
  if (inverse) for (let i = 0; i < size; i++) { real[i] /= size; imaginary[i] /= size; }
}

export function createSpectralNoiseReductionJob(input: Float32Array, noiseStartFrame: number, noiseEndFrame: number, strengthPercent: number) {
  if (!Number.isInteger(noiseStartFrame) || !Number.isInteger(noiseEndFrame) || noiseStartFrame < 0 || noiseEndFrame > input.length || noiseEndFrame - noiseStartFrame < FRAME_SIZE) {
    throw new Error("Choose at least 0.05 seconds of background-only audio for the noise profile.");
  }
  if (!Number.isFinite(strengthPercent) || strengthPercent < 0 || strengthPercent > 100) throw new Error("Noise reduction strength must be from 0 to 100%.");
  const window = Float64Array.from({ length: FRAME_SIZE }, (_, index) => 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (FRAME_SIZE - 1)));
  const noise = new Float64Array(FRAME_SIZE / 2 + 1);
  let profileFrames = 0;
  for (let start = noiseStartFrame; start + FRAME_SIZE <= noiseEndFrame; start += HOP_SIZE) {
    const real = new Float64Array(FRAME_SIZE), imaginary = new Float64Array(FRAME_SIZE);
    for (let index = 0; index < FRAME_SIZE; index++) real[index] = input[start + index] * window[index];
    fft(real, imaginary);
    for (let bin = 0; bin < noise.length; bin++) noise[bin] += Math.hypot(real[bin], imaginary[bin]);
    profileFrames++;
  }
  if (!profileFrames) throw new Error("The selected noise sample is too short. Choose at least 0.05 seconds.");
  for (let bin = 0; bin < noise.length; bin++) {
    noise[bin] /= profileFrames;
    const first = Math.max(0, bin - 2), last = Math.min(noise.length - 1, bin + 2);
    let total = 0;
    for (let neighbor = first; neighbor <= last; neighbor++) total += noise[neighbor];
    noise[bin] = total / (last - first + 1);
  }

  const output = new Float32Array(input.length), weights = new Float32Array(input.length);
  let frameStart = -FRAME_SIZE + HOP_SIZE;
  let processedFrames = 0;
  const totalFrames = Math.ceil(input.length / HOP_SIZE) + 3;
  const strength = strengthPercent / 100;

  return {
    totalFrames,
    get processedFrames() { return processedFrames; },
    get done() { return frameStart >= input.length; },
    processNextFrame() {
      if (frameStart >= input.length) return;
      const real = new Float64Array(FRAME_SIZE), imaginary = new Float64Array(FRAME_SIZE);
      for (let index = 0; index < FRAME_SIZE; index++) {
        const sourceIndex = frameStart + index;
        real[index] = sourceIndex >= 0 && sourceIndex < input.length ? input[sourceIndex] * window[index] : 0;
      }
      fft(real, imaginary);
      for (let bin = 0; bin < FRAME_SIZE; bin++) {
        const mirror = bin <= FRAME_SIZE / 2 ? bin : FRAME_SIZE - bin;
        const magnitude = Math.hypot(real[bin], imaginary[bin]);
        const gain = Math.max(0.04, Math.min(1, 1 - strength * noise[mirror] / (magnitude + 1e-9)));
        real[bin] *= gain; imaginary[bin] *= gain;
      }
      fft(real, imaginary, true);
      for (let index = 0; index < FRAME_SIZE; index++) {
        const outputIndex = frameStart + index;
        if (outputIndex < 0 || outputIndex >= input.length) continue;
        output[outputIndex] += real[index] * window[index];
        weights[outputIndex] += window[index] * window[index];
      }
      frameStart += HOP_SIZE; processedFrames++;
    },
    getOutput() {
      const result = new Float32Array(input.length);
      for (let index = 0; index < input.length; index++) result[index] = weights[index] > 1e-8 ? output[index] / weights[index] : input[index];
      return result;
    },
  };
}
