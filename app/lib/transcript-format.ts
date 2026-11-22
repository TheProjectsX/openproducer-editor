export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptStyle = "clean" | "verbatim" | "paragraphs" | "bullets" | "timestamps";
export type TranscriptCasing = "preserve" | "sentence" | "lower" | "upper";
export type TranscriptTimestampFormat = "mm:ss" | "hh:mm:ss";
export type TranscriptExportFormat = "txt" | "md" | "srt" | "vtt" | "json";

export type TranscriptStyleOptions = {
  style: TranscriptStyle;
  stripFillers: boolean;
  includeTimestamps: boolean;
  timestampFormat: TranscriptTimestampFormat;
  paragraphPauseSeconds: number;
  casing: TranscriptCasing;
  maxLineWidth: number;
  findText?: string;
  replaceText?: string;
};

export function formatDisplayTimestamp(seconds: number, format: TranscriptTimestampFormat): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalSec = Math.floor(safe);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (format === "hh:mm:ss" || h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function formatSubtitleTimestamp(seconds: number, separator: "," | "."): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalMs = Math.round(safe * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const m = Math.floor((totalSec % 3600) / 60);
  const h = Math.floor(totalSec / 3600);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(ms, 3)}`;
}

export function cleanTranscriptText(raw: string, options: Pick<TranscriptStyleOptions, "stripFillers" | "casing" | "findText" | "replaceText">): string {
  let text = raw.replace(/\s+/g, " ").trim();
  if (options.stripFillers) {
    text = text
      .replace(/\b(um+|uh+|erm+|hmm+|ah+)\b[,.!?]?\s*/gi, "")
      .replace(/\s+([,.!?])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  if (options.findText && options.findText.length > 0) {
    text = text.split(options.findText).join(options.replaceText ?? "");
  }
  if (options.casing === "lower") text = text.toLowerCase();
  else if (options.casing === "upper") text = text.toUpperCase();
  else if (options.casing === "sentence" && text.length > 0) {
    text = text.replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (m) => m.toUpperCase());
  }
  return text.trim();
}

export function wrapTextLines(text: string, maxChars: number): string {
  if (!Number.isFinite(maxChars) || maxChars <= 0) return text;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function groupIntoParagraphs(segments: TranscriptSegment[], pauseGap: number): TranscriptSegment[][] {
  const safeGap = Number.isFinite(pauseGap) && pauseGap > 0 ? pauseGap : 1.5;
  const groups: TranscriptSegment[][] = [];
  for (const seg of segments) {
    const prevGroup = groups[groups.length - 1];
    const prevSeg = prevGroup?.[prevGroup.length - 1];
    if (!prevGroup || !prevSeg || seg.start - prevSeg.end >= safeGap) {
      groups.push([seg]);
    } else {
      prevGroup.push(seg);
    }
  }
  return groups;
}

export function formatTranscript(
  rawSegments: TranscriptSegment[],
  format: TranscriptExportFormat,
  options: TranscriptStyleOptions,
): string {
  const cleaned = rawSegments
    .map((seg) => ({
      start: seg.start,
      end: Math.max(seg.start + 0.1, seg.end),
      text: cleanTranscriptText(seg.text, options),
    }))
    .filter((seg) => seg.text.length > 0);

  if (!cleaned.length) return "";

  if (format === "json") {
    return JSON.stringify(
      {
        style: options.style,
        segments: cleaned,
        text: cleaned.map((s) => s.text).join(" "),
      },
      null,
      2,
    );
  }

  if (format === "srt") {
    return cleaned
      .map((seg, i) => {
        const body = wrapTextLines(seg.text, options.maxLineWidth);
        return `${i + 1}\n${formatSubtitleTimestamp(seg.start, ",")} --> ${formatSubtitleTimestamp(seg.end, ",")}\n${body}`;
      })
      .join("\n\n");
  }

  if (format === "vtt") {
    const cues = cleaned
      .map((seg) => {
        const body = wrapTextLines(seg.text, options.maxLineWidth);
        return `${formatSubtitleTimestamp(seg.start, ".")} --> ${formatSubtitleTimestamp(seg.end, ".")}\n${body}`;
      })
      .join("\n\n");
    return `WEBVTT\n\n${cues}`;
  }

  const isMarkdown = format === "md";
  const prefixTs = (seg: TranscriptSegment) =>
    options.includeTimestamps || options.style === "timestamps"
      ? `[${formatDisplayTimestamp(seg.start, options.timestampFormat)}] `
      : "";

  if (options.style === "bullets") {
    return cleaned.map((seg) => `- ${prefixTs(seg)}${seg.text}`).join("\n");
  }

  if (options.style === "timestamps") {
    const lines = cleaned.map((seg) => {
      const ts = `[${formatDisplayTimestamp(seg.start, options.timestampFormat)}]`;
      return isMarkdown ? `**${ts}** ${seg.text}` : `${ts} ${seg.text}`;
    });
    return isMarkdown ? `# Transcript\n\n${lines.join("\n\n")}` : lines.join("\n");
  }

  if (options.style === "paragraphs" || options.style === "clean") {
    const groups = groupIntoParagraphs(cleaned, options.paragraphPauseSeconds);
    const paras = groups.map((group) => {
      const lead = options.includeTimestamps ? `[${formatDisplayTimestamp(group[0].start, options.timestampFormat)}] ` : "";
      const joined = `${lead}${group.map((s) => s.text).join(" ")}`;
      return options.maxLineWidth > 0 ? wrapTextLines(joined, options.maxLineWidth) : joined;
    });
    return isMarkdown ? `# Transcript\n\n${paras.join("\n\n")}` : paras.join("\n\n");
  }

  // verbatim
  const lines = cleaned.map((seg) => `${prefixTs(seg)}${seg.text}`);
  return isMarkdown ? `# Transcript\n\n${lines.join("  \n")}` : lines.join("\n");
}
