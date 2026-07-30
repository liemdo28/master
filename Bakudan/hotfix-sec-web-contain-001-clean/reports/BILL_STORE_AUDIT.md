# WS4 — Bill Store Ownership Audit
**Phase 13.5 | CEO P0 Directive | Generated: 2026-06-12**

## Verdict: ✅ PASS

| Metric | Value |
|--------|-------|
| Bills with no store_id | 0 |
| Bills with invalid store_id | 0 |
| Total stores with bills | 5 |

## Store Distribution

| Store | Total Bills | Overdue | Dup Groups | Grade |
|-------|-------------|---------|------------|-------|
| Raw Stockton | 209 | 28 | 14 | F |
| Heo Holding | 42 | 0 | 2 | D |
| IFT | 42 | 0 | 2 | D |
| Modesto | 42 | 0 | 2 | D |
| Bakudan - Bandera (B3) | 3 | 0 | 0 | A |
| Bakudan - The Rim (B1) | 3 | 0 | 0 | A |
| Bakudan - Stone Oak (B2) | 0 | 0 | 0 | A |
| Copper (C1, C2, C3) | 0 | 0 | 0 | A |

## Notes
- All 347 bills have a valid `store_id` referencing an active store
- Raw Stockton concentration (60% of all bills) is abnormally high — result of duplicate generation
- Bakudan stores (B1, B2, B3) and Copper have near-zero bills — likely not yet onboarded to bill tracking
