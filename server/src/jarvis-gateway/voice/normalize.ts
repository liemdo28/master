/**
 * Phase 7F §6 — transcript normalization. Only ever touches whitespace,
 * punctuation, and locale-formatting noise a real ASR engine commonly
 * introduces. Never rewrites a security-sensitive target (recipient email,
 * calendar target, project name, file/path, branch name) — those pass
 * through completely unmodified, so any ambiguity in them reaches the
 * Gateway's own project resolver / handler clarification logic unchanged,
 * rather than being silently "corrected" into a different target.
 */

/** Collapse ASR-typical repeated whitespace/newlines and trim. Never
 *  touches internal casing or punctuation choices that could change an
 *  email address, path, or proper noun. */
function collapseWhitespace(text: string): string {
  return text.replace(/[ \t\f\v]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

/** Strip a small set of ASR filler artifacts that are pure noise, never
 *  content — spoken filler words are deliberately NOT stripped, since
 *  "um, send it" vs "send it" must not silently change meaning; only
 *  literal transcription-engine artifacts (stray bracketed tags some
 *  engines emit for silence/noise) are removed. */
function stripAsrArtifacts(text: string): string {
  return text.replace(/\[(silence|noise|inaudible|music)\]/gi, '').trim();
}

/** Normalize doubled terminal punctuation an ASR engine sometimes emits
 *  ("what is the status??" / "status.."), never removing punctuation that
 *  could be part of an actual target (e.g. "user..name@example.com" stays
 *  untouched — this only collapses 3+ repeats of the exact same terminal
 *  punctuation character at the very end of the string). */
function normalizeTerminalPunctuation(text: string): string {
  return text.replace(/([.?!]){3,}$/, '$1');
}

export interface NormalizedTranscript {
  original: string;
  normalized: string;
  /** True if normalization changed anything beyond whitespace — surfaced
   *  for transparency in the operator-visible trace (§4), never hidden. */
  changed: boolean;
}

export function normalizeTranscript(raw: string): NormalizedTranscript {
  const afterArtifacts = stripAsrArtifacts(raw);
  const afterPunctuation = normalizeTerminalPunctuation(afterArtifacts);
  const normalized = collapseWhitespace(afterPunctuation);
  return { original: raw, normalized, changed: normalized !== raw.trim() };
}
