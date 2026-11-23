import { applyEraseColorToPixels } from "../lib/image-editor/effects";

export type ImageEffectJobRequest = {
  id: string;
  kind: "erase-color";
  width: number;
  height: number;
  pixels: ArrayBuffer;
  targetColor: string;
  tolerance: number;
  feather: number;
};

export type ImageEffectJobResponse =
  | { id: string; ok: true; width: number; height: number; pixels: ArrayBuffer }
  | { id: string; ok: false; error: string };

const cancelledIds = new Set<string>();

self.onmessage = (event: MessageEvent<ImageEffectJobRequest | { kind: "cancel"; id: string }>) => {
  const msg = event.data;
  if (msg.kind === "cancel") {
    cancelledIds.add(msg.id);
    return;
  }
  if (cancelledIds.has(msg.id)) {
    cancelledIds.delete(msg.id);
    return;
  }
  try {
    const view = new Uint8ClampedArray(msg.pixels);
    applyEraseColorToPixels(view, msg.targetColor, msg.tolerance, msg.feather);
    if (cancelledIds.has(msg.id)) {
      cancelledIds.delete(msg.id);
      return;
    }
    const response: ImageEffectJobResponse = {
      id: msg.id,
      ok: true,
      width: msg.width,
      height: msg.height,
      pixels: view.buffer,
    };
    (self as unknown as Worker).postMessage(response, [view.buffer]);
  } catch (cause) {
    const response: ImageEffectJobResponse = {
      id: msg.id,
      ok: false,
      error: cause instanceof Error ? cause.message : "Image effect worker failed.",
    };
    (self as unknown as Worker).postMessage(response);
  }
};
