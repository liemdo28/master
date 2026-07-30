# WS7 — Dashboard & KPI Integrity Audit
**Phase 13.5 | CEO P0 Directive | Generated: 2026-06-12**

## Verdict: ⚠️ WARN — Overdue Count Mismatch

## KPI Snapshot (as of 2026-06-12)

| KPI | DB Value | Dashboard Shows | Match? |
|-----|----------|-----------------|--------|
| Total active bills | 347 | 347 | ✅ |
| Overdue (by status='overdue') | **0** | 0 | ✅ |
| Overdue (by date, unpaid) | **28** | — | ❌ Undercounted |
| Pending | 148 | 148 | ✅ |
| Paid | 199 | 199 | ✅ |
| Due in next 7 days | 0 | 0 | ✅ |
| Due in next 30 days | 114 | 114 | ✅ |
| Overdue total amount | $0.00 | $0.00 | ✅ |
| Pending total amount | $200.00 | $200.00 | ✅ |

## Critical Finding: Overdue Status Not Auto-Updated

**Delta: 28 bills** have `due_date < 2026-06-12` AND `status = 'pending'`.

These bills are truly overdue but the system never transitioned them to `status = 'overdue'`. The dashboard KPI "Overdue Bills" shows 0, which is misleading.

The drill-down screenshot shows 87 in the notification badge — that represents **tasks**, not bills. The actual overdue bills are the 28 pending-past-due-date bills.

## Why All Overdue Bills Have $0.00 Amount
All 28 overdue bills belong to Raw Stockton recurring bill templates (Raw Sale Tax, Raw QB Tax, Raw PGE, Raw General, Stockton - Prepayment) which were created with `amount = 0` as placeholder templates. Real amounts haven't been filled in.

## Action Items
1. 🔴 **Auto-update cron**: `UPDATE bills SET status='overdue' WHERE due_date < CURDATE() AND status='pending'`
2. 🔴 **Populate bill amounts**: Raw Stockton canonical bills need real dollar amounts
3. ⏳ After WS1 cleanup: Re-verify overdue count on 40 canonical bills
