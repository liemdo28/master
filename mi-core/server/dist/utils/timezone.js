"use strict";
/**
 * TIMEZONE UTILITIES
 * Central timezone management for Mi Core.
 * OWNER timezone is always primary; store timezones are secondary.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OWNER_LABEL = exports.OWNER_TZ_CODE = exports.OWNER_TIMEZONE = exports.STORE_TIMEZONES = void 0;
exports.getOwnerTimezone = getOwnerTimezone;
exports.getAllClocks = getAllClocks;
exports.getTimeContextForAI = getTimeContextForAI;
exports.getOwnerDateInfo = getOwnerDateInfo;
exports.getTimeAtTimezone = getTimeAtTimezone;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ── Store timezone mapping ────────────────────────────────────────────────────
// These stores operate in their local time. CEO lives in Vietnam (ICT/UTC+7).
exports.STORE_TIMEZONES = {
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
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const REPO_LOCAL_OWNER_PROFILE = path_1.default.resolve(process.cwd(), '.local-agent-global', 'executive-memory-v2', 'owner_profile.json');
const REPO_PARENT_OWNER_PROFILE = path_1.default.resolve(process.cwd(), '..', '.local-agent-global', 'executive-memory-v2', 'owner_profile.json');
const GLOBAL_OWNER_PROFILE = path_1.default.join(GLOBAL_DIR, 'executive-memory-v2', 'owner_profile.json');
const OWNER_PROFILE_PATHS = [
    process.env.MI_OWNER_PROFILE_PATH,
    REPO_LOCAL_OWNER_PROFILE,
    REPO_PARENT_OWNER_PROFILE,
    GLOBAL_OWNER_PROFILE,
].filter(Boolean);
function readOwnerProfile() {
    for (const profilePath of OWNER_PROFILE_PATHS) {
        try {
            if (fs_1.default.existsSync(profilePath)) {
                return JSON.parse(fs_1.default.readFileSync(profilePath, 'utf-8'));
            }
        }
        catch {
            // Try the next profile path before falling back to the built-in owner timezone.
        }
    }
    return {};
}
// ── Owner timezone config ───────────────────────────────────────────────────────
exports.OWNER_TIMEZONE = 'Asia/Ho_Chi_Minh';
exports.OWNER_TZ_CODE = 'ICT';
exports.OWNER_LABEL = 'Ho Chi Minh City (ICT/UTC+7)';
function getOwnerTimezone() {
    const profile = readOwnerProfile();
    return profile.timezone || exports.OWNER_TIMEZONE;
}
function toFormatted(now, tz, tzCode) {
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
function getAllClocks() {
    const now = new Date();
    const ownerTz = getOwnerTimezone();
    return {
        owner: toFormatted(now, ownerTz, exports.OWNER_TZ_CODE),
        stores: Object.fromEntries(Object.entries(exports.STORE_TIMEZONES).map(([name, config]) => [name, toFormatted(now, config.timezone, config.tzCode)])),
    };
}
// ── Get time description for AI context ───────────────────────────────────────
function getTimeContextForAI() {
    const now = new Date();
    const ownerTz = getOwnerTimezone();
    const owner = toFormatted(now, ownerTz, exports.OWNER_TZ_CODE);
    const storeLines = Object.entries(exports.STORE_TIMEZONES).map(([name, config]) => {
        const s = toFormatted(now, config.timezone, config.tzCode);
        return `  ${name}: ${s.full}`;
    }).join('\n');
    return `=== TIME CONTEXT (OWNER PRIMARY) ===
Owner timezone PRIMARY: ${ownerTz} (${exports.OWNER_TZ_CODE})
Owner location: ${ownerTz} (${exports.OWNER_TZ_CODE})
Owner current time: ${owner.full}
Owner date: ${owner.date} (${owner.weekday})

Store times (for reference):
${storeLines}

IMPORTANT: When CEO says "today", "tomorrow", "this week", "morning", "afternoon", "evening", "schedule", "reminder" — use OWNER timezone (${ownerTz}) to interpret. Store times are informational only.`;
}
// ── Relative day helpers (owner timezone) ─────────────────────────────────────
function getOwnerDateInfo() {
    const now = new Date();
    const ownerTz = getOwnerTimezone();
    const dayNum = now.toLocaleDateString('en-US', { timeZone: ownerTz, weekday: 'short' });
    const hourStr = now.toLocaleString('en-US', { timeZone: ownerTz, hour: 'numeric' });
    const hour = parseInt(hourStr, 10);
    const isWeekend = dayNum === 'Sat' || dayNum === 'Sun';
    let timeOfDay;
    if (hour < 12)
        timeOfDay = 'morning';
    else if (hour < 17)
        timeOfDay = 'afternoon';
    else if (hour < 21)
        timeOfDay = 'evening';
    else
        timeOfDay = 'night';
    const todayYMD = now.toLocaleDateString('en-CA', { timeZone: ownerTz }); // YYYY-MM-DD
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(now.getDate() + 1);
    const tomorrowYMD = tomorrowDate.toLocaleDateString('en-CA', { timeZone: ownerTz });
    return {
        today: todayYMD,
        tomorrow: tomorrowYMD,
        isWeekend,
        timeOfDay,
    };
}
// ── Test helper ────────────────────────────────────────────────────────────────
function getTimeAtTimezone(date, tz) {
    return toFormatted(date, tz, exports.OWNER_TZ_CODE);
}
