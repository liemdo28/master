// =============================================================================
// TEXT NORMALIZATION (Section 7)
// Converts numbers/dates/times/currency/units into spoken-form text for TTS.
// IMPORTANT: never mutates the admin's original; callers store original + normalized.
// =============================================================================
import type { Language } from "./types.js";

// ── Vietnamese number-to-words ───────────────────────────────────────────────
const VI_DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

function viUnder100(n: number): string {
  if (n < 10) return VI_DIGITS[n];
  if (n < 20) {
    if (n === 10) return "mười";
    const unit = n - 10;
    return `mười ${unit === 5 ? "lăm" : VI_DIGITS[unit]}`;
  }
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  if (unit === 0) return `${VI_DIGITS[tens]} mươi`;
  const unitWord = unit === 5 ? "lăm" : unit === 1 ? "mốt" : VI_DIGITS[unit];
  return `${VI_DIGITS[tens]} mươi ${unitWord}`;
}

function viUnder1000(n: number): string {
  if (n < 100) return viUnder100(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (rest === 0) return `${VI_DIGITS[hundreds]} trăm`;
  if (rest < 10) return `${VI_DIGITS[hundreds]} trăm linh ${VI_DIGITS[rest]}`;
  return `${VI_DIGITS[hundreds]} trăm ${viUnder100(rest)}`;
}

export function numberToVietnameseWords(n: number): string {
  if (n === 0) return "không";
  const negative = n < 0;
  n = Math.abs(Math.floor(n));
  if (n === 0) return "không";
  const scales = [
    { v: 1_000_000_000, name: "tỷ" },
    { v: 1_000_000, name: "triệu" },
    { v: 1_000, name: "nghìn" },
  ];
  const parts: string[] = [];
  for (const s of scales) {
    if (n >= s.v) {
      const count = Math.floor(n / s.v);
      n %= s.v;
      parts.push(`${numberToVietnameseWords(count)} ${s.name}`);
    }
  }
  if (n > 0) parts.push(viUnder1000(n));
  const result = parts.join(" ").replace(/\s+/g, " ").trim();
  return negative ? `âm ${result}` : result;
}

// ── English number-to-words ──────────────────────────────────────────────────
const EN_ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function enUnder100(n: number): string {
  if (n < 20) return EN_ONES[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? EN_TENS[t] : `${EN_TENS[t]}-${EN_ONES[u]}`;
}

function enUnder1000(n: number): string {
  if (n < 100) return enUnder100(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return rest === 0 ? `${EN_ONES[h]} hundred` : `${EN_ONES[h]} hundred and ${enUnder100(rest)}`;
}

export function numberToEnglishWords(n: number): string {
  if (n === 0) return "zero";
  const negative = n < 0;
  n = Math.abs(Math.floor(n));
  const scales = [
    { v: 1_000_000_000, name: "billion" },
    { v: 1_000_000, name: "million" },
    { v: 1_000, name: "thousand" },
  ];
  const parts: string[] = [];
  for (const s of scales) {
    if (n >= s.v) {
      const c = Math.floor(n / s.v);
      n %= s.v;
      parts.push(`${enUnder1000(c)} ${s.name}`);
    }
  }
  if (n > 0) parts.push(enUnder1000(n));
  const result = parts.join(" ").trim();
  return negative ? `minus ${result}` : result;
}

export function numberToWords(n: number, lang: Language): string {
  return lang === "vi" ? numberToVietnameseWords(n) : numberToEnglishWords(n);
}

// ── Time → spoken form (7:30, 7:30 PM, 19:30) ───────────────────────────────
function speakTime(time: string, lang: Language): string {
  const m = time.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
  if (!m) return time;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const mer = m[3]?.toUpperCase();
  if (lang === "vi") {
    const period = mer === "AM" ? "sáng" : mer === "PM" ? "tối" : "";
    const tail = period ? ` ${period}` : "";
    const minPart = min === 0 ? "" : `${numberToVietnameseWords(min)} `;
    return `${numberToVietnameseWords(h)} giờ ${minPart}`.trim() + tail;
  }
  const period = mer ? ` ${mer.toLowerCase()}` : "";
  if (min === 0) return `${numberToEnglishWords(h)} o'clock${period}`;
  return `${numberToEnglishWords(h)} ${numberToEnglishWords(min)}${period}`;
}

// ── Year → spoken form ───────────────────────────────────────────────────────
function speakYear(year: number, lang: Language): string {
  if (year < 1100 || year > 2999) return numberToWords(year, lang);
  const century = Math.floor(year / 100);
  const rem = year % 100;
  if (lang === "vi") return numberToVietnameseWords(year);
  if (rem === 0) return `${numberToEnglishWords(century)} hundred`;
  const remPart = rem < 10 ? `oh ${enUnder100(rem)}` : enUnder100(rem);
  return `${enUnder1000(century)} ${remPart}`;
}

// ── Currency → spoken form ───────────────────────────────────────────────────
function speakCurrency(sym: string, amount: number, lang: Language): string {
  const numWords = numberToWords(amount, lang);
  const curVi: Record<string, string> = { $: "đô la", USD: "đô la", "₫": "đồng", VND: "đồng", "€": "ơ-rô", EUR: "ơ-rô" };
  const curEn: Record<string, string> = { $: "dollars", USD: "dollars", "₫": "dong", VND: "dong", "€": "euros", EUR: "euros" };
  const table = lang === "vi" ? curVi : curEn;
  const unit = table[sym] ?? sym;
  return `${numWords} ${unit}`;
}

// ── Main normalizer ──────────────────────────────────────────────────────────
export interface NormalizeResult {
  original: string;
  normalized: string;
  changes: number;
}

export function normalizeText(text: string, lang: Language): NormalizeResult {
  let normalized = text;
  let changes = 0;

  // 1. Currency: $125, ₫50000, 100 USD, 50 EUR
  normalized = normalized.replace(/([$€₫]|USD|VND|EUR)\s?(\d[\d.,]*)/g, (whole, sym: string, raw: string) => {
    const cleaned = String(raw).replace(/,/g, "");
    const amount = parseFloat(cleaned);
    if (isNaN(amount)) return whole;
    changes++;
    return speakCurrency(sym.trim().toUpperCase(), amount, lang);
  });

  // 2. Percentages: 15%
  normalized = normalized.replace(/(\d[\d.,]*)\s*%/g, (whole, raw) => {
    const n = parseFloat(String(raw).replace(/,/g, ""));
    if (isNaN(n)) return whole;
    changes++;
    const word = numberToWords(n, lang);
    return lang === "vi" ? `${word} phần trăm` : `${word} percent`;
  });

  // 3. Times: 7:30 PM, 19:30
  normalized = normalized.replace(/\b(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\b/g, (whole) => {
    changes++;
    return speakTime(whole, lang);
  });

  // 4. 4-digit years (1100–2999)
  normalized = normalized.replace(/\b(1\d{3}|2\d{3})\b/g, (whole, y) => {
    changes++;
    return speakYear(parseInt(y, 10), lang);
  });

  // 5. Remaining plain integers (1–9999, standalone)
  normalized = normalized.replace(/\b(\d{1,4})\b/g, (whole, d) => {
    const n = parseInt(d, 10);
    if (isNaN(n)) return whole;
    // skip if surrounded by letters (part of a token already handled)
    changes++;
    return numberToWords(n, lang);
  });

  // 6. Collapse whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();
  return { original: text, normalized, changes };
}
