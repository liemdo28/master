/**
 * Multi-Intent Splitter
 * Decomposes a single CEO message containing compound requests into
 * an ordered list of sub-requests, preserving dependency order.
 *
 * All matching is done on NFD-normalized, diacritic-stripped text so that
 * Vietnamese conjunctions ("và", "rồi", "cùng") match reliably regardless
 * of how the text was encoded at the transport layer.
 *
 * Examples:
 *   "Kiểm tra Dashboard và QB rồi báo anh"
 *   → 3 sub-intents: [kiem tra dashboard, kiem tra qb, bao anh ket qua]
 *
 *   "Kiểm tra Dashboard, coi QB, tạo SEO Raw Sushi, rồi gửi Maria"
 *   → 4 sub-intents + 1 report step
 */

export interface SubIntent {
  text: string;              // normalized sub-request text (for intent routing)
  original_fragment: string;
  sequence: number;          // execution order (0-based)
  depends_on: number[];      // indices this one waits for before executing
}

export interface SplitResult {
  is_compound: boolean;
  sub_intents: SubIntent[];
  parent_summary: string;
}

// ── Text normalization (mirrors intent-router) ─────────────────────────────────

function norm(t: string): string {
  return t.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')   // đ → d (precomposed)
    .replace(/[^a-z0-9\s,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Normalized conjunction patterns (no diacritics) ───────────────────────────

// Sequential: B depends on A completing first
const NORM_SEQUENTIAL: RegExp[] = [
  /\s+roi\s+/i,           // rồi → roi  ("then")
  /\s+sau\s+do\s+/i,      // sau đó → sau do  ("after that")
  /\s+sau\s+khi\s+/i,     // sau khi → sau khi
  /\s+then\s+/i,
  /\s+and\s+then\s+/i,
  /\s+xong\s+roi\s+/i,    // xong rồi → xong roi
  /\s+xong\s+thi\s+/i,    // xong thì → xong thi
  /(?<=\S)\s+xong\s+(?=\S)/i,
];

// Parallel: A and B can run in any order / no dependency
const NORM_PARALLEL: RegExp[] = [
  /\s+va\s+/i,             // và → va  ("and")
  /\s*,\s*/,               // comma
  /\s+cung\s+/i,           // cùng → cung  ("together")
  /\s+&\s+/,
];

// Report suffix — always the last step, depends on all prior
const NORM_REPORT_SUFFIX: RegExp[] = [
  /\s+roi\s+bao\s+(?:anh|em|toi|tao|boss)\s*$/i,
  /\s+roi\s+(?:bao cao|report|tong hop)\s*$/i,
  /\s+(?:bao|thong bao)\s+(?:anh|em|toi)\s+(?:ket qua|result)\s*$/i,
  /\s+(?:send|gui)\s+(?:maria|anh|em|toi|boss)\s*$/i,
  /\s+(?:gui|send)\s+(?:report|bao cao)\s*$/i,
];

// ── Core splitter ──────────────────────────────────────────────────────────────

export function splitCompoundRequest(text: string): SplitResult {
  const n = norm(text);

  const allPatterns = [...NORM_SEQUENTIAL, ...NORM_PARALLEL];
  const hasAnyConjunction = allPatterns.some(p => p.test(n));

  if (!hasAnyConjunction) {
    return {
      is_compound: false,
      sub_intents: [{ text: n, original_fragment: text, sequence: 0, depends_on: [] }],
      parent_summary: text.slice(0, 80),
    };
  }

  let workingN = n;

  // ── Step 1: extract trailing "report/send" suffix ─────────────────────────
  let reportSuffixN: string | null = null;
  for (const pat of NORM_REPORT_SUFFIX) {
    const m = workingN.match(pat);
    if (m) {
      reportSuffixN = m[0].trim();
      workingN = workingN.slice(0, workingN.lastIndexOf(m[0])).trim();
      break;
    }
  }

  // ── Step 2: replace conjunctions with typed delimiters ───────────────────
  const separatorTypes: Array<'seq' | 'par'> = [];

  // Use global flag so ALL occurrences are replaced, not just the first
  for (const pat of NORM_SEQUENTIAL) {
    const gPat = new RegExp(pat.source, pat.flags.includes('g') ? pat.flags : pat.flags + 'g');
    workingN = workingN.replace(gPat, () => {
      separatorTypes.push('seq');
      return ' __SEQ__ ';
    });
  }
  for (const pat of NORM_PARALLEL) {
    const gPat = new RegExp(pat.source, pat.flags.includes('g') ? pat.flags : pat.flags + 'g');
    workingN = workingN.replace(gPat, () => {
      separatorTypes.push('par');
      return ' __PAR__ ';
    });
  }

  // Bare conjunctions or filler words with no verb — discard, they carry no intent
  const FILLER_ONLY = /^(roi|thi|va|cung|and|then|sau\s*do|xong|ok|okay|oke)$/i;

  const rawFragments = workingN
    .split(/\s*__(?:SEQ|PAR)__\s*/)
    .map(f => f.trim())
    .filter(f => f.length > 0)
    .filter(f => !FILLER_ONLY.test(f));

  if (rawFragments.length <= 1) {
    return {
      is_compound: false,
      sub_intents: [{ text: n, original_fragment: text, sequence: 0, depends_on: [] }],
      parent_summary: text.slice(0, 80),
    };
  }

  // ── Step 3: build sub-intents with dependency graph ──────────────────────
  const subIntents: SubIntent[] = [];
  for (let i = 0; i < rawFragments.length; i++) {
    const depends_on: number[] = [];
    if (i > 0) {
      const sep = separatorTypes[i - 1] ?? 'par';
      if (sep === 'seq') depends_on.push(i - 1);
    }
    subIntents.push({
      text: rawFragments[i],
      original_fragment: rawFragments[i],
      sequence: i,
      depends_on,
    });
  }

  // ── Step 4: report suffix is final step, depends on everything ────────────
  if (reportSuffixN) {
    subIntents.push({
      text: reportSuffixN,
      original_fragment: reportSuffixN,
      sequence: subIntents.length,
      depends_on: subIntents.map((_, i) => i),
    });
  }

  return {
    is_compound: subIntents.length > 1,
    sub_intents: subIntents,
    parent_summary: `${subIntents.length} tasks: ${subIntents.map(s => s.text.slice(0, 30)).join(' → ')}`,
  };
}
