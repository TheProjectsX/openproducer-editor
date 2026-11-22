export function applyTextCase(text: string, textCase?: "none" | "uppercase" | "lowercase" | "capitalize", uppercase?: boolean) {
  const mode = textCase ?? (uppercase ? "uppercase" : "none");
  if (mode === "uppercase") return text.toUpperCase();
  if (mode === "lowercase") return text.toLowerCase();
  if (mode === "capitalize") return text.toLowerCase().replace(/\b\p{L}/gu, (char) => char.toUpperCase());
  return text;
}

/**
 * Splits text by explicit newlines and wraps each paragraph at word boundaries
 * (breaking long words if needed) when a positive maxWidth is provided.
 */
export function wrapTextLines(
  text: string,
  maxWidth: number | undefined,
  measureText: (segment: string) => number
): string[] {
  const paragraphs = text.split("\n");
  if (!maxWidth || !Number.isFinite(maxWidth) || maxWidth <= 0) return paragraphs;
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(" ");
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureText(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) {
        lines.push(current);
        current = "";
      }
      if (measureText(word) <= maxWidth) {
        current = word;
        continue;
      }
      let chunk = "";
      for (const char of word) {
        const nextChunk = chunk + char;
        if (chunk && measureText(nextChunk) > maxWidth) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk = nextChunk;
        }
      }
      current = chunk;
    }
    lines.push(current);
  }
  return lines;
}
