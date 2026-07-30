# WS10 — Store Bill Health Score
**Phase 13.5 | CEO P0 Directive | Generated: 2026-06-12**

## Overall Health: 🔴 CRITICAL

Scoring: `score = max(0, 100 - min(100, overdue×2 + dup_groups×3 + missing_cat + missing_owner))`

| Store | Bills | Paid | Overdue | Dup Groups | Score | Grade |
|-------|-------|------|---------|------------|-------|-------|
| 🔴 Raw Stockton | 209 | 141 | 28 | 14 | **0** | **F** |
| 🟡 Heo Holding | 42 | 28 | 0 | 2 | 52 | D |
| 🟡 IFT | 42 | 28 | 0 | 2 | 52 | D |
| 🟡 Modesto | 42 | 28 | 0 | 2 | 52 | D |
| 🟢 Bakudan - Bandera (B3) | 3 | 1 | 0 | 0 | 97 | A |
| 🟢 Bakudan - The Rim (B1) | 3 | 1 | 0 | 0 | 97 | A |
| 🟢 Bakudan - Stone Oak (B2) | 0 | 0 | 0 | 0 | 100 | A |
| 🟢 Copper (C1, C2, C3) | 0 | 0 | 0 | 0 | 100 | A |

## Store Analysis

### Raw Stockton — Grade F (Score: 0/100)
- **14 duplicate groups** — recurrence engine ran ~29 times on this store's bills
- **28 overdue bills** — all Raw recurring templates (Sale Tax, QB Tax, PGE, General, Prepayment) past due date but status='pending'
- **Root cause**: AI import + recurrence engine without dedup guard
- **Action**: Archive 181 duplicate bills (groups #7–11, #15–20), update 28 to overdue status

### Heo Holding / IFT / Modesto — Grade D (Score: 52/100)
- **2 duplicate groups each** (May and June batches)
- No overdue bills (all future or paid)
- Penalty: -6 for dup_groups × 2 stores (each) × 3 per group
- **Action**: Archive ~39 duplicate bills per store (May batch: 25 + June batch: 14)

### Bakudan Stores (B1, B2, B3) — Grade A
- Very few bills (3 each), properly managed
- B2 and Copper have 0 bills — need to onboard bill tracking

## Priority Action Plan
1. **P0**: Archive 307 duplicate bills (WS1) — reduces Raw Stockton from 209 → 28 bills
2. **P1**: Fix recurrence engine deduplication bug
3. **P1**: Update 28 overdue Raw Stockton bills (status: pending → overdue)
4. **P2**: Assign real amounts to Raw Stockton canonical bills
5. **P3**: Onboard B2, B3, Copper to bill tracking system
