# TIMEZONE ARCHITECTURE REPORT
## Mi Core — CEO Directive Implementation
**Date:** 2026-06-09
**Status:** ✅ COMPLETE
**Verdict:** `OWNER_TIMEZONE_PRIMARY_PASS`

---

## DIRECTIVE SUMMARY

| Directive | Before | After | Status |
|-----------|--------|-------|--------|
| Primary timezone | Store (hardcoded PT) | Owner (Vietnam ICT) | ✅ Fixed |
| Chat "today" | Stockon PT date | Vietnam date | ✅ Fixed |
| Briefing format | No timezone info | Owner + Store times | ✅ Fixed |
| UI header | No clock | 🇻🇳 ICT clock + toggle | ✅ Fixed |
| AI context | PT only | ICT primary + store refs | ✅ Fixed |

---

## WHAT WAS CHANGED

### 1. `owner-profile/owner_profile.json`
```json
{
  "preferred_name": "anh",
  "timezone": "Asia/Ho_Chi_Minh",
  "country": "Vietnam",
  "city": "Ho Chi Minh City",
  "role": "CEO",
  "language_primary": "vi",
  "language_secondary": "en"
}
```
- Changed: `timezone` from `America/Chicago` → `Asia/Ho_Chi_Minh`
- Added: `country: "Vietnam"`, `city: "Ho Chi Minh City"`
- Store: primary source of truth for owner timezone

### 2. `server/src/utils/timezone.ts` (NEW)
Central timezone utility module providing:
- `STORE_TIMEZONES` — Bakudan Ramen (Chicago CDT/CST), Raw Sushi Bar (Los Angeles PDT/PST)
- `getOwnerTimezone()` — reads from owner_profile.json, defaults to Asia/Ho_Chi_Minh
- `getAllClocks()` — returns owner + all store times
- `getTimeContextForAI()` — formatted context string injected into every AI response
- `getOwnerDateInfo()` — today/tomorrow/timeOfDay in owner timezone
- `OWNER_TZ_CODE = "ICT"` / `OWNER_LABEL = "Ho Chi Minh City (ICT/UTC+7)"`

### 3. `server/src/intelligence/executive-context.ts`
- Replaced hardcoded `America/Los_Angeles` PT with dynamic `getOwnerTimezone()`
- Owner time now uses `Asia/Ho_Chi_Minh`
- Injects `getTimeContextForAI()` into every AI response
- `TIMEZONE RULE` added to system prompt: owner primary, store secondary
- Holiday section now uses owner timezone as reference
- Changed: "Stockton, CA (Central Valley)" → "Ho Chi Minh City, Vietnam (ICT/UTC+7)"

### 4. `server/src/memory/executive-memory.ts`
- Default profile timezone: `America/Chicago` → `Asia/Ho_Chi_Minh`
- Default profile city/country added: Vietnam / Ho Chi Minh City
- Profile summary includes timezone display

### 5. `server/src/intelligence/holiday-engine.ts`
- `buildWeekSummary()`: PT → `Asia/Ho_Chi_Minh`
- `getHolidayContextString()`: PT → `Asia/Ho_Chi_Minh`, added store timezone annotations
- Header now reads: `[Owner timezone: Vietnam (ICT/UTC+7) — PRIMARY]`
- Store times (Chicago CDT, Los Angeles PDT) shown as secondary reference

### 6. `server/src/connectors/briefing-engine.ts`
- `generateBriefing()`: Uses `getOwnerTimezone()` for date/time display
- BRIEFING FORMAT updated to:
  - **Owner Time (PRIMARY)** — Vietnam ICT
  - **Store Times (secondary)** — Bakudan Ramen CDT, Raw Sushi PDT
  - Pending Tasks, Approvals, Project Health
- `BriefingData` interface updated with `owner_time` and `store_times`

### 7. `ui/index.html`
- Added timezone clock widget in header: `🇻🇳 19:42 ICT`
- Click to toggle store times: `Bakudan Ramen: 05:42 AM CDT | Raw Sushi Bar: 03:42 AM PDT`
- Updates every 30 seconds
- Client-side JS (no server dependency for display)

---

## TIMEZONE MAPPING

| Entity | Timezone | Code | Notes |
|--------|----------|------|-------|
| **CEO (Owner)** | `Asia/Ho_Chi_Minh` | ICT/UTC+7 | **PRIMARY** — all conversations, scheduling, reminders |
| **Bakudan Ramen** | `America/Chicago` | CDT/CST | Secondary — store local time |
| **Raw Sushi Bar** | `America/Los_Angeles` | PDT/PST | Secondary — store local time |

---

## CHAT BEHAVIOR (TIMEZONE RULE)

When CEO says these keywords, Mi uses **OWNER timezone** (Vietnam ICT):

| Keyword | Behavior |
|---------|----------|
| `today` | Vietnam date (not Chicago/LA date) |
| `tomorrow` | Vietnam date |
| `this week` | Vietnam week boundaries |
| `morning` | Vietnam morning (06:00-12:00 ICT) |
| `afternoon` | Vietnam afternoon (12:00-18:00 ICT) |
| `evening` | Vietnam evening (18:00-22:00 ICT) |
| `schedule` | Vietnam time slots |
| `reminder` | Vietnam time for notification |

Store times are shown as **reference only** in briefings and UI.

---

## TEST CASES

### Case 1: Vietnam 19:00 ICT (verified with Node.js Intl)

```
Input:   2026-06-09T19:00:00+07:00
UTC offset: Vietnam UTC+7

Verified:
  Header:  🇻🇳 07:00 PM ICT      ✅
  Bakudan:   07:00 AM CDT        ✅ (UTC+7 → UTC-5 = -12h)
  Raw Sushi:  05:00 AM PDT        ✅ (UTC+7 → UTC-7 = -14h)

Chat: "What should I do today?"
  → Answer based on Vietnam date: 2026-06-09 ✅
  → NOT based on Chicago or LA date ✅
```

Current moment (live verification):
```
VIETNAM ICT:  20:09  ← owner primary
CHICAGO CDT:  08:09  ← secondary
LOS ANGELES PDT: 06:09  ← secondary
```

### Case 2: Briefing at Vietnam 19:00

```
Owner Time:     07:00 PM ICT     ← PRIMARY
Bakudan Ramen:  07:00 AM CDT      ← secondary
Raw Sushi Bar:   05:00 AM PDT     ← secondary
Pending:        [from gate]
Approvals:      [from gate]
Project Health: [from project-connector]
```

### Case 3: AI Context Injection

Every AI response receives:
```
=== TIME CONTEXT (OWNER PRIMARY) ===
Owner location: Asia/Ho_Chi_Minh (ICT)
Owner current time: 07:00 PM ICT
Owner date: Tuesday, June 9, 2026

Store times (for reference):
  Bakudan Ramen: 07:00 AM CDT
  Raw Sushi Bar: 05:00 AM PDT

IMPORTANT: When CEO says "today", "tomorrow", "this week",
"morning", "afternoon", "evening", "schedule", "reminder" —
use OWNER timezone (Asia/Ho_Chi_Minh) to interpret.
Store times are informational only.
```

---

## FILES CHANGED

| File | Change | Lines |
|------|--------|-------|
| `owner-profile/owner_profile.json` | timezone + location | 12 |
| `server/src/utils/timezone.ts` | **NEW** — central tz utils | 163 |
| `server/src/utils/timezone.test.ts` | **NEW** — test cases | 88 |
| `server/src/intelligence/executive-context.ts` | Owner tz primary | 45 |
| `server/src/memory/executive-memory.ts` | Default timezone updated | 8 |
| `server/src/intelligence/holiday-engine.ts` | PT → ICT, store annotations | 6 |
| `server/src/connectors/briefing-engine.ts` | Briefing format update | 25 |
| `ui/index.html` | Header clock widget | 18 |

**Total: 8 files changed, 365 lines affected**

---

## ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────┐
│                   CEO (Vietnam ICT)                 │
│                 Asia/Ho_Chi_Minh / UTC+7            │
└──────────────────────────┬──────────────────────────┘
                           │
            OWNER TIMEZONE PRIMARY ─────────────────┐
                           │                           │
         ┌─────────────────┼─────────────────────┐    │
         ▼                 ▼                     ▼    │
   ┌──────────┐     ┌──────────────┐     ┌────────────┐│
   │ Chat UI  │     │ Briefing    │     │ AI Context ││
   │ Header   │     │ Engine      │     │ Injection  ││
   │ 🇻🇳 ICT  │     │ Owner Time  │     │ Owner Time ││
   └─────┬────┘     └──────┬───────┘     └──────┬─────┘│
         │                │                     │      │
         ▼                ▼                     ▼      │
   ┌─────────────────────────────────────────────┐      │
   │        server/src/utils/timezone.ts         │◄─────┘
   │  • getOwnerTimezone() → Asia/Ho_Chi_Minh    │
   │  • getAllClocks() → owner + all stores      │
   │  • getTimeContextForAI()                    │
   └──────────────────────────┬──────────────────┘
                              │
         STORE TIMEZONES (secondary) ────────────────┐
                              │                      │
         ┌────────────────────┼────────────────────┐ │
         ▼                    ▼                    ▼ │
   ┌─────────────┐     ┌──────────────┐     ┌──────────┐
   │Bakudan Ramen│     │Raw Sushi Bar │     │ UI Toggle│
   │America/     │     │America/      │     │Store Times│
   │Chicago CDT  │     │Los_Angeles   │     │          │
   └─────────────┘     │PDT/PST       │     └──────────┘
                       └──────────────┘
```

---

## VERDICT

```
╔══════════════════════════════════════════════════════╗
║  FINAL VERDICT:  OWNER_TIMEZONE_PRIMARY_PASS         ║
╠══════════════════════════════════════════════════════╣
║ ✅ owner_profile.json → Asia/Ho_Chi_Minh            ║
║ ✅ server/src/utils/timezone.ts — CREATED           ║
║ ✅ executive-context.ts — owner tz primary          ║
║ ✅ executive-memory.ts — default updated            ║
║ ✅ holiday-engine.ts — PT → ICT, store annotated   ║
║ ✅ briefing-engine.ts — Owner + Store format        ║
║ ✅ ui/index.html — Header clock widget             ║
║ ✅ timezone.test.ts — ALL CASES PASS                 ║
╠══════════════════════════════════════════════════════╣
║ VERIFIED: Vietnam 19:00 ICT (UTC+7)                ║
║   Header:     🇻🇳 07:00 PM ICT       ✅             ║
║   Bakudan:        07:00 AM CDT        ✅ (UTC+7→UTC-5)║
║   Raw Sushi:      05:00 AM PDT        ✅ (UTC+7→UTC-7)║
║   Chat "today": Vietnam date ✅                     ║
║   NOTE: CEO directive expected values had UTC      ║
║   math errors (05:42/03:42). Correct values used.   ║
╠══════════════════════════════════════════════════════╣
║ CEO Directive: COMPLETE                              ║
║ Architecture: OWNER_TIMEZONE_PRIMARY ✅             ║
╚══════════════════════════════════════════════════════╝
