# Preview Data Sync Verification

Generated: 2026-05-30T14:04:43.199Z
Environment: https://preview.dashboard.bakudanramen.com

## Row Counts

| Table | Preview Count |
|---|---:|
| users | 7 |
| stores | 12 |
| projects | 18 |
| tasks | 1216 |
| comments | 5 |

## Sample Users

Passwords are scrubbed in preview; pass_len must remain 0.

| ID | Name | Email | Role | Store ID | Password Length |
|---:|---|---|---|---:|---:|
| 1 | admin | liem.dt0208@gmail.com | admin |  | 0 |
| 3 | Hoang Le | hoangdle@gmail.com | manager |  | 0 |
| 4 | Nguyễn Nguyên | nkthanhnguyen09@gmail.com | staff |  | 0 |
| 6 | David | ccdave20@yahoo.com | staff |  | 0 |
| 7 | Miles | yurimotohaliwell@yahoo.com | staff |  | 0 |
| 8 | Omar | omarmm81@gmail.com | staff |  | 0 |
| 9 | Edgar | enavarro@bakudanramen.com | staff |  | 0 |

## Sample Stores

| ID | Store | Store Code | Manager ID |
|---:|---|---|---|
| 1 | JHT |  |  |
| 2 | Raw Stockton |  |  |
| 3 | B2 |  |  |
| 4 | Raw |  |  |
| 5 | Bakudan - The Rim (B1) |  |  |
| 6 | Bakudan - Stone Oak (B2) |  |  |
| 7 | Bakudan - Bandera (B3) |  |  |
| 8 | IFT |  |  |
| 9 | HEO |  |  |
| 10 | Copper (C1, C2, C3) |  |  |
| 11 | Modesto |  |  |
| 12 | Heo Holding |  |  |

## Required Tables

| Table | Status |
|---|---|
| incidents | present |
| store_kpis | present |
| budget_requests | present |
| users | present |
| stores | present |
| projects | present |
| tasks | present |
| comments | present |
| permissions | present |
| user_stores | present |

## Notes

- Preview was synced from main data before this QA cycle.
- Preview passwords are intentionally blank and QA uses PREVIEW_QA_BYPASS per role.
- No missing required Phase 12 tables remain after applying preview migrations.
