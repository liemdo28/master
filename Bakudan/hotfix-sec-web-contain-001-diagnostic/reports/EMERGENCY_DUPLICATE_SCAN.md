# P0 Emergency — Full Duplicate Scan Report
**CEO P0 Directive | Scan Date: 2026-06-12 | Source: Production DB (CLI)**

> ⚠️ DO NOT trust dashboard counts until cleanup is complete. All KPIs recomputed from DB below.

---

## 🔴 Executive Summary

| System | Duplicates Found | Impact | Severity |
|--------|-----------------|--------|----------|
| Bills | **307 duplicate bills** in 20 groups | Dashboard overcounts active bills by 8.8× | 🔴 P0 |
| Payments | Table not yet deployed | N/A | ⚪ N/A |
| Tasks | **102 duplicate tasks** in 97 groups | Noise in task lists and counts | 🟡 P1 |
| Task Recurrence Engine | Table not deployed | N/A | ⚪ N/A |
| Bill Recurrence Engine | Table not deployed | N/A | ⚪ N/A |

---

## Table Inventory

| Table | Exists | Notes |
|-------|--------|-------|
| `bills` | ✅ | 347 total, 347 active |
| `payments` | ❌ | Not yet deployed |
| `tasks` | ✅ | 1,670 total active |
| `task_recurrences` | ❌ | Not yet deployed |
| `bill_recurrences` | ❌ | Not yet deployed |

---

## Bill Duplicates — Summary

- **Total bills:** 347
- **Canonical bills (keep):** 40
- **Duplicate bills (archive):** 307
- **Duplicate groups:** 20
- **Worst group:** 29 copies of the same bill (recurrence engine ran 29 times)
- **Root cause:** Recurrence/AI-import engine has no deduplication guard

### Top Duplicate Groups
| Rank | Keep | Archive | Title | Store | Amount |
|------|------|---------|-------|-------|--------|
| 1 | #25 | 28× | Raw Sale Tax | Raw Stockton | $0.00 |
| 2 | #26 | 28× | Raw QB Tax | Raw Stockton | $0.00 |
| 3 | #27 | 28× | Raw PGE | Raw Stockton | $0.00 |
| 4 | #22 | 25× | Heo Holding Sale Tax | Heo Holding | $0.00 |
| 5 | #23 | 25× | IFT Sale Tax | IFT | $0.00 |
| 6 | #24 | 25× | Amtrust | Modesto | $0.00 |
| 7–14 | Various | 14–20× | June batch | Multiple | $0.00 |
| 15–20 | Various | 1× | July batch | Raw Stockton | $0.00 |

---

## Task Duplicates — Summary

- **Total tasks:** 1,670
- **Active tasks (post-cleanup estimate):** 1,568
- **Duplicate tasks:** 102 in 97 groups
- **Root cause:** Two Asana sync batches re-imported existing tasks
  - **Batch A** (IDs 18xxx): Asana sync ran without dedup → re-created tasks originally in IDs #100–8300+
  - **Batch B** (IDs 20xxx): Second Asana sync run → re-created tasks from IDs 18xxx–20xxx range

---

## Corrected Dashboard KPIs

| KPI | Dashboard Shows | Real DB Value | Status |
|-----|-----------------|---------------|--------|
| Active bills | 347 | **40** (post-cleanup) | 🔴 Wrong |
| Overdue bills | 0 | **28** (by due date) | 🔴 Wrong |
| Bills at risk (amount) | $200.00 | $0.00 (all $0 templates) | ⚠️ Misleading |
| Active tasks | 1,670 | **1,568** (post-cleanup) | 🟡 Slightly high |
| Active payments | N/A | N/A (table missing) | ⚪ N/A |

---

## Scan Evidence
- Raw JSON: `qa/evidence/emergency-scan.json`
- GitHub Actions Run: #27404112935
- Scan timestamp: 2026-06-12T00:45:xx-07:00
