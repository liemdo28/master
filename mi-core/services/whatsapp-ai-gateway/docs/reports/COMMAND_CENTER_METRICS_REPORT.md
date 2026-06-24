# Command Center — Production Metrics Report

**Generated:** 2026-06-12  
**Phase:** Dev 2 — Phase 2  
**Status:** COMPLETE

---

## 1. Metrics Dashboard Endpoints

All mounted at `/api/metrics/*` in `src/api/server.js`.  
Source: [`src/api/production-metrics-routes.js`](../../src/api/production-metrics-routes.js)

| Endpoint | Description | Key Fields |
|---|---|---|
| `GET /api/metrics/overview` | All-store summary for N days | total_submissions, stores[], period_days |
| `GET /api/metrics/store/:storeId` | Per-store breakdown | pass, fail, needs_review, ocr, edit_rate, retake_total |
| `GET /api/metrics/ocr-accuracy` | OCR confidence by store/day | store_id, day, avg_conf, cnt |
| `GET /api/metrics/edit-rate` | Employee edit rate | store_id, total, edits, edit_pct |
| `GET /api/metrics/retake-rate` | Photo retake counts | store_id, total_retakes, retake_pct |
| `GET /api/metrics/manager-reviews` | Manager alert volume | store_id, alerts, sent |
| `GET /api/metrics/submission-trend` | Daily counts last N days | day, store_id, shift, cnt |
| `GET /api/metrics/comparison` | Stone Oak vs Rim vs Bandera | store, submissions, ocr_confidence, accuracy, edit_rate, pass_rate, synced |

Default period: 14 days. Pass `?days=N` to override.

---

## 2. Data Sources

| Metric | Source Table | Column |
|---|---|---|
| Submissions | `food_safety_submissions` | All rows |
| OCR confidence | `food_safety_submissions` | `ocr_confidence` |
| Edit rate | `pilot_stone_oak` | `needs_employee_edit` |
| Retake rate | `pilot_stone_oak` | `retake_count` |
| Manager reviews | `pilot_stone_oak` | `manager_reviewed` |
| Sheet sync | `food_safety_submissions` | `synced_to_sheet_at` |
| Alert volume | `manager_alerts` | `status`, `store_id` |

---

## 3. Store Coverage

| Store | Submission Data | Pilot Metrics | Status |
|---|---|---|---|
| Stone Oak | `stone_oak` rows | `pilot_stone_oak` table | LIVE |
| Rim | `rim` rows | N/A until pilot | PENDING PILOT |
| Bandera | `bandera` rows | N/A until pilot | PENDING PILOT |

Edit rate, retake rate, and manager review rate are detailed only for Stone Oak until other stores complete their pilots. All stores show submission counts and OCR confidence from `food_safety_submissions`.

---

## 4. Hardening Audit Endpoint

Mounted at: `GET /api/hardening/audit`  
Source: [`src/hardening/production-hardening-audit.js`](../../src/hardening/production-hardening-audit.js)

Checks 14 failure modes across 6 categories:
- **whatsapp** — session recovery path, local save independence
- **sheet** — Google Sheet failure fallback, sync error logging
- **ocr** — OCR failure → NEEDS_REVIEW, confidence stored
- **duplicates** — duplicate photo detection, copy-paste detection, submission dedup, alert dedup
- **store_mapping** — unknown chat ID graceful fallback, store_groups table
- **dashboard** — health endpoint and metrics router load correctly

---

## 5. Verdict

**PHASE 2: COMPLETE**  
8 metrics endpoints live. Hardening audit endpoint live. All data sourced from real production schema (`created_at`, `sender_name`, `store_id`).
