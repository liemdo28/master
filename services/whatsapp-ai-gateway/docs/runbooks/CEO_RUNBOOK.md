# CEO Runbook — Food Safety AI System

**Audience:** CEO / Business Owner  
**System:** WhatsApp Food Safety OCR + Command Center  
**Updated:** 2026-06-12

---

## What This System Does

Staff photos a paper food safety form on their phone and sends it to the Kitchen Log WhatsApp group. The AI reads the temperatures, validates them against FDA standards, saves everything to a database, and syncs to Google Sheets automatically. You get an alert on WhatsApp if anything is unsafe or missing.

---

## Your Dashboard

URL: `https://dashboard.bakudanramen.com` (or your configured domain)

What you see:
- **Today's submissions** — which stores submitted, which shifts
- **Alerts** — any UNSAFE temperatures or missing submissions
- **Pilot status** — Stone Oak pilot progress toward 10-form goal
- **Store comparison** — side-by-side OCR accuracy, edit rate, pass rate

API (for custom reports): `GET /api/metrics/comparison`

---

## Morning Check (2 minutes)

1. Open dashboard → check that each active store submitted AM shift
2. If any store shows **MISSING**: text the store manager directly
3. If you see **UNSAFE** flag: review the temperature and call the store
4. If you see **NEEDS_REVIEW**: a manager must approve that form before it counts

If everything shows green — you're done.

---

## Weekly Review (15 minutes)

Run: `GET /api/metrics/overview?days=7`

Check:
- OCR accuracy ≥ 95% across all stores
- Edit rate < 5% (employees rarely need to correct AI reads)
- Retake rate < 10% (photos are clear)
- All submissions synced to Google Sheet

If metrics degrade, review with store managers before the next shift.

---

## Pilot Status (Stone Oak)

URL: `GET /api/pilot/stone-oak/report`

You're looking for:
- `pilot_result: "PASS"` — all 5 criteria met across 10 forms
- `collected: 10` — 10 forms submitted and tracked

**Do not activate Rim or Bandera** until Stone Oak pilot shows `PASS`.

---

## Escalation Guide

| Situation | Who to call | What to tell them |
|---|---|---|
| Gateway down — no messages processed | Dev team | "The WhatsApp gateway is down, check server logs" |
| Unsafe temperature found | Store manager | "Form from [shift] shows [item] at [temp] — verify and respond" |
| Google Sheet not updating | Dev team | "Sheet sync failed — check `sync_error` column in DB" |
| Store submitting to wrong group | Dev team | "Store mapping wrong — check `STORE_GROUP_CHAT_ID` env vars" |
| AI reading temperatures wrong | Dev team | "OCR confidence below threshold — check photo quality guide" |

---

## How to Read an Alert

```
[ALERT] Stone Oak — AM Shift
Walk-In Cooler: 45°F (UNSAFE — must be ≤40°F)
Action: Verify cooler immediately. Log corrective action on form.
```

- **UNSAFE**: Temperature out of range. Call store immediately.
- **NEEDS_REVIEW**: AI wasn't confident. Manager must verify the photo.
- **MISSING**: No submission received for that shift. Call store.

---

## What You Can't Fix

These require the dev team:
- Adding a new store
- Changing temperature thresholds
- Restarting the gateway server
- Re-running a failed sync

Call or message the dev lead for any of the above.
