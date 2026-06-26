/**
 * Antigravity Gateway — Dashboard Timezone Utilities
 *
 * All dashboard timestamps display in Asia/Bangkok (UTC+7).
 * Covers Hanoi, Ho Chi Minh City, Bangkok, Thailand, Vietnam.
 *
 * Rules:
 *  - Storage always stays UTC (ISO 8601 strings, unix-ms numbers).
 *  - Conversion happens ONLY at the render/format layer here.
 *  - Never mutate process.env.TZ or add manual +7 offsets.
 *
 * Server-side usage (TypeScript / Node.js):
 *   import { formatBangkokTime, formatBangkokDateTime } from '../utils/timezone.js';
 *   formatBangkokTime(Date.now())        // → "13:10:45"
 *   formatBangkokDateTime(Date.now())    // → "21/05/2026, 13:10:45"
 *
 * Client-side usage: the same logic is inlined inside the HTML <script> blocks
 * of each dashboard as `fmtTime()` / `fmtDateTime()`.  Keep them in sync with
 * the constants below if the format ever changes.
 */

const TIMEZONE = 'Asia/Bangkok';

/** "HH:MM:SS" — time only, Bangkok */
const _timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  hour12: false,
  hour:   '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** "DD/MM/YYYY, HH:MM:SS" — full date + time, Bangkok */
const _dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  hour12:  false,
  day:     '2-digit',
  month:   '2-digit',
  year:    'numeric',
  hour:    '2-digit',
  minute:  '2-digit',
  second:  '2-digit',
});

/**
 * Format a timestamp as HH:MM:SS in Asia/Bangkok time.
 * @param input  Unix-ms number, ISO string, or Date object.
 */
export function formatBangkokTime(input: Date | string | number): string {
  if (!input) return '—';
  return _timeFormatter.format(new Date(input as string));
}

/**
 * Format a timestamp as DD/MM/YYYY, HH:MM:SS in Asia/Bangkok time.
 * @param input  Unix-ms number, ISO string, or Date object.
 */
export function formatBangkokDateTime(input: Date | string | number): string {
  if (!input) return '—';
  return _dateTimeFormatter.format(new Date(input as string));
}

/**
 * The Bangkok timezone identifier string.
 * Use this when passing `timeZone` to Intl APIs directly.
 */
export const BANGKOK_TZ = TIMEZONE;

/**
 * Inline JS source that matches the server-side formatters above.
 * Paste this verbatim into any dashboard <script> block so the browser
 * uses the same format without a separate network request.
 *
 * Exports two functions:
 *   fmtTime(ts)     → "13:10:45"
 *   fmtDateTime(ts) → "21/05/2026, 13:10:45"
 */
export const BANGKOK_JS_FORMATTERS = `
var _bkkTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok', hour12: false,
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});
var _bkkDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok', hour12: false,
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});
function fmtTime(ts) {
  if (!ts) return '—';
  return _bkkTime.format(new Date(ts));
}
function fmtDateTime(ts) {
  if (!ts) return '—';
  return _bkkDateTime.format(new Date(ts));
}
`.trim();
