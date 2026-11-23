import type { TextCase } from "./types";

export type TextMeasureInput = {
  text: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  letterSpacing?: number;
  lineHeight?: number;
  textCase?: TextCase;
};

let textMeasureCtx: CanvasRenderingContext2D | null = null;

/** Apply text-case transformation to a string. */
export function applyTextCase(text: string, textCase: TextCase = "none"): string {
  if (textCase === "uppercase") return text.toUpperCase();
  if (textCase === "lowercase") return text.toLowerCase();
  if (textCase === "capitalize") {
    return text.replace(/\b\p{L}/gu, (ch) => ch.toUpperCase());
  }
  return text;
}

/** Build a CSS canvas font string from text layer properties. */
export function buildCanvasFont(layer: Pick<TextMeasureInput, "italic" | "bold" | "fontSize" | "fontFamily">): string {
  return `${layer.italic ? "italic " : ""}${layer.bold ? "700" : "500"} ${layer.fontSize}px ${layer.fontFamily || "system-ui, sans-serif"}`;
}

/** Measure a string accounting for optional letter spacing. */
export function measureTrackedTextWidth(
  measureChar: (s: string) => number,
  text: string,
  letterSpacing = 0,
): number {
  if (!text) return 0;
  if (!letterSpacing) return measureChar(text);
  const chars = Array.from(text);
  let total = 0;
  for (let i = 0; i < chars.length; i++) {
    total += measureChar(chars[i]) + (i < chars.length - 1 ? letterSpacing : 0);
  }
  return Math.max(0, total);
}

/** Word-wrap paragraphs using a caller-supplied string width measurement function. */
export function wrapTextLines(
  measureWidth: (text: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const safeMax = Math.max(16, maxWidth);
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(" ");
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureWidth(candidate) <= safeMax || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

/** Measure the bounding box of a text layer, optionally constrained to a fixed width. */
export function measureTextLayerSize(
  layer: TextMeasureInput,
  constrainWidth?: number,
): { width: number; height: number } {
  const cased = applyTextCase(layer.text, layer.textCase);
  const lineRatio = Math.max(0.8, Math.min(3, layer.lineHeight ?? 1.25));
  const spacing = layer.letterSpacing ?? 0;

  if (typeof document === "undefined") {
    const lineCount = Math.max(1, cased.split("\n").length);
    return {
      width: constrainWidth ?? Math.max(40, Math.round(cased.length * (layer.fontSize * 0.6 + spacing))),
      height: Math.ceil(lineCount * layer.fontSize * lineRatio),
    };
  }
  if (!textMeasureCtx) {
    textMeasureCtx = document.createElement("canvas").getContext("2d");
  }
  const ctx = textMeasureCtx;
  if (!ctx) return { width: constrainWidth ?? 160, height: Math.ceil(layer.fontSize * lineRatio) };
  ctx.font = buildCanvasFont(layer);
  const measure = (s: string) => measureTrackedTextWidth((c) => ctx.measureText(c).width, s, spacing);
  const paragraphs = cased.split("\n");

  if (constrainWidth === undefined) {
    const maxW = Math.max(...paragraphs.map((p) => measure(p || " ")));
    return {
      width: Math.max(16, Math.ceil(maxW) + 4),
      height: Math.max(16, Math.ceil(paragraphs.length * layer.fontSize * lineRatio)),
    };
  }
  const maxW = Math.max(16, constrainWidth);
  const lines = wrapTextLines(measure, cased, maxW);
  return {
    width: Math.round(maxW),
    height: Math.max(16, Math.ceil(lines.length * layer.fontSize * lineRatio)),
  };
}
