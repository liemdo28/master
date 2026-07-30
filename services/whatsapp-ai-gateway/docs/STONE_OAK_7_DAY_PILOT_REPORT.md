# Stone Oak 7-Day Pilot Report

**Phase:** G — Stone Oak 7-Day Pilot
**Date:** 2026-06-04
**Status:** READY TO EXECUTE

---

## Goal

Run a 7-day controlled pilot at Stone Oak with one employee. Track submissions, issues, and staff feedback. Do NOT expand to Bandera or Rim until this gate passes.

## Pre-conditions

- Phase F: Stone Oak group mapped and locked
- Phase D: Manager alert working for real warning
- Phase E: Sheet queue verified
- Stone Oak employee trained (simple instruction: send `/ldagent` → answer values → `CONFIRM`)

## Pilot Rules

| Allowed | Not Allowed |
|---|---|
| Fix P0/P1 pilot blockers | New Vision AI |
| Fix message wording if confused | New Incident AI |
| Fix dashboard bugs | New analytics |
| Fix sheet queue bugs | New YoLink automation |
| Fix mapping bugs | New OCR expansion |
| Document all fixes in PILOT_FIX_LOG.md | Large refactor |

## Daily Workflow

Each day, Stone Oak employee sends:
```
/ldagent
1
<values for each item>
CONFIRM
```

## Tracking Fields (for each day)

| Day | Date | Submitted? | Completion Time | Warnings | Manager Alerts | Sheet Queue Issues | Language Used | Staff Feedback | Bugs |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | |
| 2 | | | | | | | | | |
| 3 | | | | | | | | | | |
| 4 | | | | | | | | | | |
| 5 | | | | | | | | | | |
| 6 | | | | | | | | | | |
| 7 | | | | | | | | | | |

## Daily CEO/GM Review

Each day, before end of business:
1. Open dashboard → check last submission timestamp
2. Open manager WhatsApp group → check alerts
3. Check Google Sheet → verify row count increases
4. Check PILOT_FIX_LOG.md for any logged issues

## Gate Criteria

At end of Day 7:

| Metric | Target | Actual | ✓/✗ |
|---|---|---|---|
| Completion rate | ≥95% (at least 6 of 7 days) | | |
| No data loss | 0 missing rows | | |
| No P0 bugs | 0 | | |
| No wrong-store writes | 0 | | |
| Manager alerts working | All warnings triggered | | |
| Staff can use without dev | CEO/GM confirms | | |
| GM approves | GM sign-off | | |

## If Gate PASSES

After 7 days with all criteria met:
→ Authorize Bandera + Rim pilot
→ Move to Phase I: PILOT_GATE_DECISION.md

## If Gate FAILS

- Extend Stone Oak pilot (days 8–14)
- Fix only blockers from PILOT_FIX_LOG.md
- Document extension reason
- Re-evaluate at Day 14

## Deliverable

This report at: `docs/STONE_OAK_7_DAY_PILOT_REPORT.md`

---

## Stone Oak Employee Instructions (for reference)

```
1. In Stone Oak LD Agent group, send: /ldagent
2. Choose: 1 — Daily Entry Log
3. Bot will ask for each temperature item.
   Enter the value you read on the thermometer.
   If the value is outside the target range,
   the bot will ask: 1=Confirm / 2=Re-enter / 3=Skip
4. After all items, bot will show a summary.
5. Review and send: CONFIRM
6. If you make a mistake, send: STATUS
   to see your current draft.
```

---

## Notes

- Only Stone Oak at this stage — do NOT involve Bandera or Rim employees
- Collect qualitative feedback from the employee each day
- If employee struggles with WhatsApp, document specific confusion point
- Any confusion with bot wording = P1 fix (document in PILOT_FIX_LOG.md)