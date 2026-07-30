// =============================================================================
// SCRIPT SEGMENTATION (Section 12)
// Splits long narration into reviewable / regeneratable segments.
// =============================================================================
import type { Language } from "./types.js";

export interface SegmentInput {
  index: number;
  sourceText: string;
  normalizedText: string;
}

export interface SegmentOptions {
  maxChars?: number; // hard cap per segment (default 300)
  maxEstimatedSeconds?: number; // cap by estimated duration (default 25s)
  charsPerSecond?: number; // speaking-rate estimate (default 14)
  splitBy?: "sentence" | "paragraph" | "auto";
}

const DEFAULT_OPTS: Required<SegmentOptions> = {
  maxChars: 300,
  maxEstimatedSeconds: 25,
  charsPerSecond: 14,
  splitBy: "auto",
};

function splitSentences(text: string, lang: Language): string[] {
  // Vietnamese + English sentence boundaries (. ! ? … and VI ellipsis)
  const re = /[^.!?…]+[.!?…]+["'”’)\]]*\s*|\S[^.!?…]*$/g;
  const matches = text.match(re);
  if (!matches) return [text].filter(Boolean);
  return matches.map((s) => s.trim()).filter(Boolean);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Segment a script. Each emitted segment respects maxChars / maxEstimatedSeconds.
 */
export function segmentScript(raw: string, lang: Language, opts: SegmentOptions = {}): SegmentInput[] {
  const o = { ...DEFAULT_OPTS, ...opts };
  const cleaned = raw.trim();
  if (!cleaned) return [];

  let chunks: string[];
  if (o.splitBy === "paragraph") {
    chunks = splitParagraphs(cleaned);
  } else {
    chunks = splitSentences(cleaned, lang);
  }

  const maxLen = Math.max(1, o.maxChars);
  const maxDur = Math.max(1, o.maxEstimatedSeconds);
  const out: SegmentInput[] = [];
  let idx = 0;

  const push = (text: string) => {
    out.push({ index: idx++, sourceText: text, normalizedText: text });
  };

  for (let chunk of chunks) {
    // If chunk exceeds caps, greedily merge sentences into groups that fit.
    while (chunk.length > maxLen || chunk.length / o.charsPerSecond > maxDur) {
      let cut = Math.min(maxLen, Math.floor(maxDur * o.charsPerSecond));
      // try to break at a space near the cut
      let space = chunk.lastIndexOf(" ", cut);
      if (space <= 0) space = cut;
      push(chunk.slice(0, space).trim());
      chunk = chunk.slice(space).trim();
    }
    if (chunk.length > 0) push(chunk);
  }

  return out;
}
