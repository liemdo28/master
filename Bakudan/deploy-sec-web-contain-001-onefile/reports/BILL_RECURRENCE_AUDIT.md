# WS2 — Bill Recurrence & Template Audit
**Phase 13.5 | CEO P0 Directive | Generated: 2026-06-12**

## Verdict: ⚠️ WARN

| Metric | Value |
|--------|-------|
| Total active bills | 347 |
| Bills with frequency != 'once' | 347 (100%) |
| Overdue recurring bills | 28 |
| Double-recurrence anomalies | Detected (see WS1 — mass duplication) |

## Critical Finding
**ALL 347 bills are tagged as recurring.** This means the recurrence engine treats every bill as a template. Without a deduplication check, each cron/AI-import run spawns new copies of every bill.

## Overdue Recurring Bills
28 recurring bills have `due_date < 2026-06-12` with `status = 'pending'` (not paid, not marked overdue).

These represent:
- Raw Stockton recurring bills: Raw General (×1 canonical), Raw Sale Tax (×1), Raw QB Tax (×1), Raw PGE (×1), Stockton - Prepayment (×1)
- Due dates: 2026-05-20 and 2026-06-01 batches

## Recommended Fixes
1. **Add deduplication guard to recurrence engine**: Before creating a new recurring bill, check if an identical bill (title + store_id + amount + due_date) already exists.
2. **Add `last_generated_date` to bill templates**: Track when each template last generated an instance.
3. **Mark overdue**: Auto-transition `status='pending'` → `status='overdue'` when `due_date < TODAY`.

## Status
- 🔴 Root cause fix required in recurrence engine (engineering task)
- 🔴 28 overdue recurring bills need status update
- ⏳ BLOCKED on WS1 duplicate cleanup first
