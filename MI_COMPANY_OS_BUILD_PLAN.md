# MI_COMPANY_OS_BUILD_PLAN.md
> Mi Company OS — Master Build Plan
> Status: Phase 1 COMPLETE
> Target: MI_COMPANY_OS_CERTIFIED
> Updated: 2026-06-18

---

## Phase 1 — Core OS ✅ COMPLETE

**Target: `MI_CORE_OPERATING_SYSTEM_READY`**

| File | Status |
|------|--------|
| `server/src/company-os/departments.ts` | ✅ 19 departments registered |
| `server/src/company-os/evidence-store.ts` | ✅ SQLite WAL, step-level evidence |
| `server/src/company-os/qa-gate.ts` | ✅ Independent QA, PASS/FAIL only |
| `server/src/company-os/report-center.ts` | ✅ CEO-level output, strips logs/IDs |
| `server/src/company-os/dispatch-center.ts` | ✅ Steps 1-5 of 12-step pipeline |
| `server/src/company-os/execution-pipeline.ts` | ✅ Full 12-step orchestrator |
| `server/src/company-os/source-inventory.ts` | ✅ Source classification registry |
| `server/src/company-os/company-os-router.ts` | ✅ Express routes mounted |
| `server/src/index.ts` | ✅ `/api/company-os` mounted |
| `REMOVE_CANDIDATES.md` | ✅ 2 models confirmed REMOVE |
| `ACTIVE_SOURCE_INVENTORY.md` | ✅ 32 ACTIVE, 8 PLANNED, 2 REMOVE |

**TypeScript:** Zero compile errors in Company OS files.

---

## 12-Step Execution Pipeline

Every CEO command passes through all 12 steps. No bypass allowed.

| Step | Name | Dept |
|------|------|------|
| 1 | Context Resolution | dispatch |
| 2 | Intent Classification | dispatch |
| 3 | Block Check | dispatch |
| 4 | Department Assignment | dispatch |
| 5 | Task Decomposition | dispatch |
| 6 | Source Truth Check | library |
| 7 | Execution | assigned dept |
| 8 | Evidence Collection | assigned dept |
| 9 | QA Verification | qa (independent) |
| 10 | Report Center Summary | report-center |
| 11 | Mi Final Review | dispatch |
| 12 | CEO Response | dispatch |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/company-os/command` | CEO sends a command |
| GET | `/api/company-os/pipelines` | Recent 50 pipeline runs |
| GET | `/api/company-os/pipelines/:id` | Single pipeline run |
| GET | `/api/company-os/departments` | Department registry |
| GET | `/api/company-os/sources` | Source inventory |
| GET | `/api/company-os/health` | System health |

---

## 19 Departments

| Phase | Dept | Status | Autonomy |
|-------|------|--------|----------|
| 1 | Dispatch Center | ACTIVE | FULL_AUTO |
| 1 | Executive Assistant | ACTIVE | FULL_AUTO |
| 1 | Reporting Center | ACTIVE | FULL_AUTO |
| 1 | Library | PLANNED | FULL_AUTO |
| 1 | QA | ACTIVE | FULL_AUTO |
| 2 | Finance & Accounting | ACTIVE | REQUIRES_APPROVAL |
| 2 | Tax & Compliance | PLANNED | REQUIRES_APPROVAL |
| 2 | Restaurant Intelligence | ACTIVE | FULL_AUTO |
| 2 | Investment & FP&A | PLANNED | FULL_AUTO |
| 3 | Technical Operations | ACTIVE | FULL_AUTO |
| 3 | Engineering | ACTIVE | REQUIRES_APPROVAL |
| 3 | R&D | PLANNED | FULL_AUTO |
| 3 | Competitive Intelligence | PLANNED | FULL_AUTO |
| 3 | HR / Recruiting | PLANNED | REQUIRES_APPROVAL |
| 4 | Marketing | ACTIVE | REQUIRES_APPROVAL |
| 4 | Brand & Creative | ACTIVE | FULL_AUTO |
| 4 | Website Studio | PLANNED | REQUIRES_APPROVAL |
| 4 | CRM / Sales | PLANNED | FULL_AUTO |
| 5 | Video Studio | PLANNED | FULL_AUTO |

---

## Quality Rules

1. **95% confidence gate** — Mi only delivers result if evidence + QA PASS + confidence ≥ 95%
2. **QA independence** — Executing dept cannot certify its own work
3. **PASS/FAIL only** — No PROVISIONAL, DESIGNED, FRAMEWORK_COMPLETE, REPORT_ONLY_PASS
4. **CEO receives:** what was done, result, blockers, evidence, next action
5. **CEO never receives:** raw logs, UUIDs, stack traces, internal task names
6. **Evidence-first** — Every step stored in SQLite before QA
7. **No bloat** — Every source must be in ACTIVE_SOURCE_INVENTORY.md

---

## Approval Policy (Never without CEO approval)

- Email / WhatsApp / SMS to external parties
- Payment, wire transfer, financial transaction
- Production deployment
- Tax filing
- Data deletion
- Payroll changes

---

## Phase 2+ Remaining Build

| Phase | Target |
|-------|--------|
| Phase 2: Money Operations | QuickBooks full sync, Tax dept activation |
| Phase 3: Company Operations | Twenty CRM, HR onboarding, R&D eval framework |
| Phase 4: Growth | Marketing automation, Website Studio activation |
| Phase 5: Advanced Media | Video Studio, Wan/Hunyuan/LTX pipeline |

**Final target: `MI_COMPANY_OS_CERTIFIED`**
