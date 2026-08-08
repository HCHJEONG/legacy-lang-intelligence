export type CobolNormalizedLine = {
  text: string;
  originalStartLine: number;
  originalEndLine: number;
};

export type CobolRemovedLine = {
  originalLine: number;
  reason: "blank" | "comment" | "header" | "empty-source-area";
  text: string;
};

export type CobolNormalizerMetrics = {
  originalLineCount: number;
  normalizedLineCount: number;
  commentLinesRemoved: number;
  blankLinesRemoved: number;
  headerLinesRemoved: number;
  continuationLinesJoined: number;
  fixedFormatLikely: boolean;
};

export type CobolNormalizationResult = {
  lines: CobolNormalizedLine[];
  removedLines: CobolRemovedLine[];
  metrics: CobolNormalizerMetrics;
};

const HEADER_PARAGRAPH_PATTERN =
  /^\s*(AUTHOR|INSTALLATION|DATE-WRITTEN|DATE-COMPILED|SECURITY|REMARKS)\s*\./i;

export function normalizeCobolSource(lines: string[]): CobolNormalizationResult {
  const fixedFormatLikely = isLikelyFixedFormat(lines);
  const normalized: CobolNormalizedLine[] = [];
  const removedLines: CobolRemovedLine[] = [];
  let continuationLinesJoined = 0;

  lines.forEach((rawLine, index) => {
    const originalLine = index + 1;
    const fixed = fixedFormatLikely ? fixedFormatParts(rawLine) : undefined;
    const sourceText = fixed ? fixed.sourceArea : rawLine.trimEnd();
    const indicator = fixed?.indicator;
    const trimmed = sourceText.trim();

    if (!trimmed) {
      removedLines.push({
        originalLine,
        reason: fixedFormatLikely ? "empty-source-area" : "blank",
        text: rawLine,
      });
      return;
    }

    if (isComment(rawLine, sourceText, indicator)) {
      removedLines.push({ originalLine, reason: "comment", text: rawLine });
      return;
    }

    if (HEADER_PARAGRAPH_PATTERN.test(sourceText)) {
      removedLines.push({ originalLine, reason: "header", text: rawLine });
      return;
    }

    if (indicator === "-" && normalized.length > 0) {
      const previous = normalized[normalized.length - 1];
      previous.text = `${previous.text}${sourceText.trimStart()}`;
      previous.originalEndLine = originalLine;
      continuationLinesJoined += 1;
      return;
    }

    normalized.push({
      text: sourceText,
      originalStartLine: originalLine,
      originalEndLine: originalLine,
    });
  });

  const metrics: CobolNormalizerMetrics = {
    originalLineCount: lines.length,
    normalizedLineCount: normalized.length,
    commentLinesRemoved: removedLines.filter((line) => line.reason === "comment").length,
    blankLinesRemoved: removedLines.filter((line) => line.reason === "blank" || line.reason === "empty-source-area").length,
    headerLinesRemoved: removedLines.filter((line) => line.reason === "header").length,
    continuationLinesJoined,
    fixedFormatLikely,
  };

  return {
    lines: normalized,
    removedLines,
    metrics,
  };
}

function isLikelyFixedFormat(lines: string[]): boolean {
  const meaningful = lines.filter((line) => line.trim()).slice(0, 50);
  if (meaningful.length === 0) {
    return false;
  }

  const fixedSignals = meaningful.filter((line) => {
    if (line.length >= 7 && ["*", "/", "-", "D", "d", " "].includes(line.charAt(6))) {
      const prefix = line.slice(0, 6);
      return prefix.trim() === "" || /^\d+$/.test(prefix.trim());
    }
    return false;
  }).length;

  return fixedSignals / meaningful.length >= 0.6;
}

function fixedFormatParts(line: string): { indicator: string; sourceArea: string } {
  const padded = line.padEnd(72, " ");
  return {
    indicator: padded.charAt(6),
    sourceArea: padded.slice(7, 72).trimEnd(),
  };
}

function isComment(rawLine: string, sourceText: string, indicator?: string): boolean {
  if (indicator && ["*", "/"].includes(indicator)) {
    return true;
  }

  const trimmedSource = sourceText.trimStart();
  if (trimmedSource.startsWith("*>") || trimmedSource.startsWith("*")) {
    return true;
  }

  return rawLine.length >= 7 && ["*", "/"].includes(rawLine.charAt(6));
}
