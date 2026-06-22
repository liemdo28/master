# Production Rollout Plan — Food Safety AI System

**Prepared:** 2026-06-12  
**Phase:** Dev 2 — Phase 5  
**Stores:** Stone Oak → Rim → Bandera

---

## Rollout Sequence

```
Stone Oak Pilot (ACTIVE)
    ↓ PASS verdict (10 forms, all criteria met)
Rim Pilot
    ↓ PASS verdict
Bandera Pilot
    ↓ PASS verdict
Full Production: All 3 stores live
```

**CEO Rule:** No store moves to the next phase until the previous store's pilot passes all 5 success criteria.

---

## Phase 1 — Stone Oak Pilot (Current)

**Goal:** Validate the full v3 system end-to-end with real store operations.

**Start trigger:** CEO added to Kitchen Log WhatsApp group. v3 form printed and in use.

**Target:** 10 submitted and tracked forms.

**Success criteria:**
| Criterion | Target | Check |
|---|---|---|
| Field accuracy | ≥ 95% | `GET /api/pilot/stone-oak/report` → `success_criteria.field_accuracy_95pct` |
| Employee edit rate | < 5% | `success_criteria.edit_rate_under_5pct` |
| Data loss | 0 submissions lost | `success_criteria.no_data_loss` |
| Wrong store mapping | 0 incidents | `success_criteria.no_wrong_store` |
| Dashboard visibility | 100% forms visible | `success_criteria.no_missing_from_dash` |

**PASS verdict:** `pilot_result: "PASS"` in pilot report.

**FAIL procedure:** Stop, diagnose with hardening audit, fix root cause, restart pilot count.

---

## Phase 2 — Rim Pilot

**Start trigger:** Stone Oak pilot shows `pilot_result: "PASS"`.

**Setup steps (ref: [STORE_SETUP_RUNBOOK.md](../runbooks/STORE_SETUP_RUNBOOK.md)):**
1. Add gateway bot to Rim Kitchen Log WhatsApp group
2. Set `RIM_GROUP_CHAT_ID` in `.env`
3. Print `FoodSafety-Rim-LineCheck-v3.pdf` (5 copies)
4. Manager training (30 min with store lead)
5. Submit 5 test forms and verify before going live

**Target:** 10 submitted and tracked forms (same criteria as Stone Oak).

**Timeline estimate:** 1-2 weeks after Stone Oak PASS, assuming 1-2 forms per shift per day.

---

## Phase 3 — Bandera Pilot

**Start trigger:** Rim pilot shows `PASS`.

**Setup steps:** Identical to Rim (see above, use Bandera form and `BANDERA_GROUP_CHAT_ID`).

**Timeline estimate:** 1-2 weeks after Rim PASS.

---

## Phase 4 — Full Production

**Start trigger:** All three pilots show `PASS`.

**Actions:**
1. Remove pilot badges from forms (update PDF generators)
2. Enable automated daily hardening audit: `GET /api/hardening/audit` on cron
3. Set up weekly metrics email to CEO: `GET /api/metrics/comparison`
4. Enable submission trend alerting (0 submissions in a shift = immediate alert)
5. Archive pilot data: `pilot_stone_oak` table kept for historical reference

**Monitoring baseline to establish in week 1:**
- OCR accuracy per store (target ≥ 95% week-over-week)
- Submission compliance rate (target: 100% of shifts submitted same day)
- Sheet sync success rate (target: 100%)

---

## Rollback Procedure

If a store experiences a P1 incident after going live:
1. Notify that store's staff to keep paper forms only
2. Do not delete any DB data — stop gateway polling for that store
3. Diagnose via `GET /api/hardening/audit`
4. Restore after root cause fixed and 3 consecutive clean test submissions

---

## Go / No-Go Decision Table

| Gate | Required | Current |
|---|---|---|
| Stone Oak pilot PASS | Required for Rim | PENDING |
| Rim pilot PASS | Required for Bandera | NOT STARTED |
| All hardening checks pass | Required for full production | 12/14 PASS |
| All 4 runbooks complete | Required for full production | COMPLETE |
| CEO rollout plan approval | Required to begin Rim | PENDING APPROVAL |

---

## Deliverables Checklist (Dev 2 Directive)

| Deliverable | File | Status |
|---|---|---|
| Rim v3 form + OCR template | `data/templates/FoodSafety-Rim-v3.json`, `docs/forms/FoodSafety-Rim-LineCheck-v3.pdf` | COMPLETE |
| Bandera v3 form + OCR template | `data/templates/FoodSafety-Bandera-v3.json`, `docs/forms/FoodSafety-Bandera-LineCheck-v3.pdf` | COMPLETE |
| Rim Readiness Report | `docs/reports/RIM_READINESS_REPORT.md` | COMPLETE |
| Bandera Readiness Report | `docs/reports/BANDERA_READINESS_REPORT.md` | COMPLETE |
| Command Center Metrics Report | `docs/reports/COMMAND_CENTER_METRICS_REPORT.md` | COMPLETE |
| Production Hardening Report | `docs/reports/PRODUCTION_HARDENING_REPORT.md` | COMPLETE |
| CEO Runbook | `docs/runbooks/CEO_RUNBOOK.md` | COMPLETE |
| Manager Runbook | `docs/runbooks/MANAGER_RUNBOOK.md` | COMPLETE |
| Store Setup Runbook | `docs/runbooks/STORE_SETUP_RUNBOOK.md` | COMPLETE |
| Incident Response Runbook | `docs/runbooks/INCIDENT_RESPONSE_RUNBOOK.md` | COMPLETE |
| Rollout Plan | `docs/reports/ROLLOUT_PLAN.md` | COMPLETE |
| Production Metrics Routes | `src/api/production-metrics-routes.js` | COMPLETE |
| Hardening Audit Module | `src/hardening/production-hardening-audit.js` | COMPLETE |

---

## Final Verdict

**Dev 2 Build Status: COMPLETE — PENDING STONE OAK PILOT PASS**

All infrastructure, forms, runbooks, metrics, and hardening code are built and committed. System cannot be marked production-ready until:

1. Stone Oak pilot reaches `pilot_result: "PASS"` (10 real forms, all 5 criteria met)
2. CEO approves this rollout plan
3. Rim and Bandera pilots complete per sequence above
