/**
 * TIMEZONE UTILITIES
 * Central timezone management for Mi Core.
 * OWNER timezone is always primary; store timezones are secondary.
 */

import fs from 'fs';
import path from 'path';

// ── Store timezone mapping ────────────────────────────────────────────────────
// These stores operate in their local time. CEO lives in Vietnam (ICT/UTC+7).
export const STORE_TIMEZONES: Record<string, { timezone: string; tzCode: string; label: string }> = {
  'Bakudan Ramen': {
    timezone: 'America/Chicago',
    tzCode: 'CDT/CST',
    label: 'Chicago (CDT/CST)',
  },
  'Raw Sushi Bar': {
    timezone: 'America/Los_Angeles',
    tzCode: 'PDT/PST',
    label: 'Los Angeles (PDT/PST)',
  },
};

// ── Load owner profile ─────────────────────────────────────────────────────────
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const REPO_LOCAL_OWNER_PROFILE = path.resolve(process.cwd(), '.local-agent-global', 'executive-memory-v2', 'owner_profile.json');
const REPO_PARENT_OWNER_PROFILE = path.resolve(process.cwd(), '..', '.local-agent-global', 'executive-memory-v2', 'owner_profile.json');
const GLOBAL_OWNER_PROFILE = path.join(GLOBAL_DIR, 'executive-memory-v2', 'owner_profile.json');
const OWNER_PROFILE_PATHS = [
  process.env.MI_OWNER_PROFILE_PATH,
  REPO_LOCAL_OWNER_PROFILE,
  REPO_PARENT_OWNER_PROFILE,
  GLOBAL_OWNER_PROFILE,
].filter(Boolean) as string[];

function readOwnerProfile(): Record<string, unknown> {
  for (const profilePath of OWNER_PROFILE_PATHS) {
    try {
      if (fs.existsSync(profilePath)) {
        return JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
      }
    } catch {
      // Try the next profile path before falling back to the built-in owner timezone.
    }
  }
  return {};
}

// ── Owner timezone config ───────────────────────────────────────────────────────
export const OWNER_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const OWNER_TZ_CODE = 'ICT';
export const OWNER_LABEL = 'Ho Chi Minh City (ICT/UTC+7)';

export function getOwnerTimezone(): string {
  const profile = readOwnerProfile();
  return (profile.timezone as string) || OWNER_TIMEZONE;
}

// ── Format helpers ────────────────────────────────────────────────────────────
export interface FormattedTime {
  time: string;       // HH:MM (12-hour)
  period: string;      // AM/PM
  tzCode: string;     // ICT, CDT, PDT
  full: string;       // 07:42 PM ICT
  date: string;       // Vietnamese full date
  weekday: string;    // Monday, Tuesday...
  dayNum: number;
  month: string;
  year: number;
}

function toFormatted(now: Date, tz: string, tzCode: string): FormattedTime {
  const timeStr = now.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const [hourStr, minStr] = timeStr.split(':').map(Number);
  const period = hourStr >= 12 ? 'PM' : 'AM';
  const hour12 = hourStr % 12 || 12;
  return {
    time: `${String(hour12).padStart(2, '0')}:${String(minStr).padStart(2, '0')}`,
    period,
    tzCode,
    full: `${String(hour12).padStart(2, '0')}:${String(minStr).padStart(2, '0')} ${period} ${tzCode}`,
    date: now.toLocaleString('vi-VN', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    weekday: now.toLocaleString('en-US', { timeZone: tz, weekday: 'long' }),
    dayNum: now.getDate(),
    month: now.toLocaleString('en-US', { timeZone: tz, month: 'long' }),
    year: now.getFullYear(),
  };
}

// ── Get all timezone clocks ────────────────────────────────────────────────────
export interface TimezoneClock {
  owner: FormattedTime;
  stores: Record<string, FormattedTime>;
}

export function getAllClocks(): TimezoneClock {
  const now = new Date();
  const ownerTz = getOwnerTimezone();

  return {
    owner: toFormatted(now, ownerTz, OWNER_TZ_CODE),
    stores: Object.fromEntries(
      Object.entries(STORE_TIMEZONES).map(([name, config]) => [name, toFormatted(now, config.timezone, config.tzCode)])
    ),
  };
}

// ── Get time description for AI context ───────────────────────────────────────
export function getTimeContextForAI(): string {
  const now = new Date();
  const ownerTz = getOwnerTimezone();
  const owner = toFormatted(now, ownerTz, OWNER_TZ_CODE);

  const storeLines = Object.entries(STORE_TIMEZONES).map(([name, config]) => {
    const s = toFormatted(now, config.timezone, config.tzCode);
    return `  ${name}: ${s.full}`;
  }).join('\n');

  return `=== TIME CONTEXT (OWNER PRIMARY) ===
Owner timezone PRIMARY: ${ownerTz} (${OWNER_TZ_CODE})
Owner location: ${ownerTz} (${OWNER_TZ_CODE})
Owner current time: ${owner.full}
Owner date: ${owner.date} (${owner.weekday})

Store times (for reference):
${storeLines}

IMPORTANT: When CEO says "today", "tomorrow", "this week", "morning", "afternoon", "evening", "schedule", "reminder" — use OWNER timezone (${ownerTz}) to interpret. Store times are informational only.`;
}

// ── Relative day helpers (owner timezone) ─────────────────────────────────────
export function getOwnerDateInfo(): { today: string; tomorrow: string; isWeekend: boolean; timeOfDay: string } {
  const now = new Date();
  const ownerTz = getOwnerTimezone();

  const dayNum = now.toLocaleDateString('en-US', { timeZone: ownerTz, weekday: 'short' });
  const hourStr = now.toLocaleString('en-US', { timeZone: ownerTz, hour: 'numeric' });
  const hour = parseInt(hourStr, 10);

  const isWeekend = dayNum === 'Sat' || dayNum === 'Sun';
  let timeOfDay: string;
  if (hour < 12) timeOfDay = 'morning';
  else if (hour < 17) timeOfDay = 'afternoon';
  else if (hour < 21) timeOfDay = 'evening';
  else timeOfDay = 'night';

  const todayYMD = now.toLocaleDateString('en-CA', { timeZone: ownerTz }); // YYYY-MM-DD
  const tomorrowDate = new Date(now); tomorrowDate.setDate(now.getDate() + 1);
  const tomorrowYMD = tomorrowDate.toLocaleDateString('en-CA', { timeZone: ownerTz });

  return {
    today: todayYMD,
    tomorrow: tomorrowYMD,
    isWeekend,
    timeOfDay,
  };
}

// ── Test helper ────────────────────────────────────────────────────────────────
export function getTimeAtTimezone(date: Date, tz: string): FormattedTime {
  return toFormatted(date, tz, OWNER_TZ_CODE);
}
