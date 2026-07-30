// =============================================================================
// AUDIO QA — text similarity & checks (Section 13)
// Compares a generated-audio transcription back to the source text.
// =============================================================================
import type { Language } from "./types.js";

/** Normalize a string for comparison (lowercase, strip punctuation/diacritics-light). */
export function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:"'“”‘’()\[\]…]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token-level similarity (Jaccard over word sets, 0–100). */
export function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeForCompare(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeForCompare(b).split(" ").filter(Boolean));
  if (ta.size === 0 && tb.size === 0) return 100;
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const union = new Set([...ta, ...tb]).size;
  return Math.round((inter / union) * 100);
}

/** Levenshtein-based similarity (0–100), robust to word-order differences. */
export function sequenceSimilarity(a: string, b: string): number {
  const sa = normalizeForCompare(a).split(" ").filter(Boolean);
  const sb = normalizeForCompare(b).split(" ").filter(Boolean);
  if (sa.length === 0 && sb.length === 0) return 100;
  const maxLen = Math.max(sa.length, sb.length);
  if (maxLen === 0) return 100;
  const dist = levenshtein(sa, sb);
  return Math.round(((maxLen - dist) / maxLen) * 100);
}

function levenshtein(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/** Combined QA score: weighted blend of token + sequence similarity. */
export function qaScore(sourceText: string, transcription: string): number {
  const t = tokenSimilarity(sourceText, transcription);
  const s = sequenceSimilarity(sourceText, transcription);
  return Math.round(t * 0.4 + s * 0.6);
}

export interface QADetail {
  similarityPercent: number;
  passed: boolean;
  checks: Record<string, boolean>;
  notes: string;
}

/**
 * Run QA against a transcription. `audioMeta` provides duration/silence/clipping.
 */
export function runQA(
  sourceText: string,
  transcription: string,
  language: Language,
  audioMeta: { durationSec: number; silencePercent?: number; clippingDetected?: boolean; empty?: boolean },
  threshold = 95
): QADetail {
  const checks: Record<string, boolean> = {};
  const notes: string[] = [];

  // Empty / corrupted
  checks.not_empty = !audioMeta.empty && !!transcription.trim();
  if (!checks.not_empty) notes.push("Audio empty or transcription blank.");

  // Duration plausibility (estimate ~14 chars/sec)
  const estDur = sourceText.length / 14;
  const tooShort = audioMeta.durationSec < estDur * 0.4;
  const tooLong = audioMeta.durationSec > estDur * 3.0;
  checks.duration_plausible = !tooShort && !tooLong;
  if (tooShort) notes.push(`Duration ${audioMeta.durationSec.toFixed(1)}s much shorter than expected ${estDur.toFixed(1)}s.`);
  if (tooLong) notes.push(`Duration ${audioMeta.durationSec.toFixed(1)}s much longer than expected ${estDur.toFixed(1)}s.`);

  // Clipping
  checks.no_clipping = !audioMeta.clippingDetected;
  if (audioMeta.clippingDetected) notes.push("Clipping detected.");

  // Silence
  if (audioMeta.silencePercent != null) {
    checks.silence_ok = audioMeta.silencePercent < 40;
    if (!checks.silence_ok) notes.push(`Silence ${audioMeta.silencePercent}% too high.`);
  }

  // Similarity
  const similarity = qaScore(sourceText, transcription);
  checks.similarity_ok = similarity >= threshold;

  // Language mismatch heuristic: if VI expected but transcription is mostly ASCII letters
  if (language === "vi") {
    const diacritic = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    checks.language_match = diacritic.test(transcription) || /[ăăđ]/i.test(transcription);
    if (!checks.language_match) notes.push("Vietnamese diacritics absent — possible language mismatch.");
  } else {
    checks.language_match = true;
  }

  const passed = Object.values(checks).every(Boolean) && similarity >= threshold;
  return {
    similarityPercent: similarity,
    passed,
    checks,
    notes: notes.join(" ") || "All checks passed.",
  };
}
