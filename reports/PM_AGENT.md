# PM Agent
**Module:** DEV3 Phase 13.1  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**File:** `mi-core/server/src/gstack/pm-agent/pm-agent.ts`

---

## Objective

The PM Agent runs **before any execution begins**. It transforms a CEO natural language request into a structured `PMPackage` — objective, scope, acceptance criteria, effort estimate, and risk score — so that execution has a clear contract before the first skill fires.

---

## Position in the Pipeline

```
CEO Request
    ↓
PM Agent ← NEW (Phase 13)
    ↓  produces PMPackage
Work Order Engine
    ↓
Role Engine → Skill Selection → Approval → Execution
    ↓
Evidence → QA → CEO Report
```

---

## PMPackage Schema

```typescript
interface PMPackage {
  request_id: string;
  generated_at: string;

  requirements: RequirementPackage;      // objective, scope, out_of_scope, stakeholders
  boundary: ScopeBoundaryResult;         // clarity, creep, missing, conflicts
  criteria: AcceptanceCriteriaPackage;   // measurable criteria with gate links
  effort: EffortEstimate;                // size, duration, phases, skills
  risk: RiskAssessment;                  // overall score, component scores, mitigations

  pm_summary: string;     // WhatsApp-ready brief for CEO
  pm_brief: string;       // Full markdown PM report
  proceed: boolean;       // false → execution blocked
  proceed_reason: string;
}
```

---

## Sub-Engines Orchestrated

| Engine | Module | Output |
|--------|--------|--------|
| Requirement Analysis | `requirement-analysis.ts` | objective, scope, out_of_scope, stakeholders, deliverables |
| Scope Boundary | `scope-boundary.ts` | CLEAR / AMBIGUOUS / MISSING + PROCEED / CLARIFY / REJECT |
| Acceptance Criteria | `acceptance-criteria.ts` | 5–9 measurable criteria linked to QA gates |
| Effort Estimation | `effort-estimation.ts` | SMALL/MEDIUM/LARGE/CRITICAL + duration + phase breakdown |
| Risk Prediction | `risk-prediction.ts` | 0–100 risk score + SAFE/LOW/MEDIUM/HIGH/CRITICAL |

---

## Proceed Gate

```
if boundary.recommendation === 'REJECT' → block execution, return PM brief to CEO
if risk.risk_level === 'CRITICAL' → block execution, return PM brief to CEO
if boundary.recommendation === 'CLARIFY' → proceed with defaults, flag open questions in pm_summary
else → PROCEED
```

---

## Acceptance Test Result

**Input:** "Mi ơi kiểm tra Dashboard, tìm lỗi, nếu an toàn thì fix, test lại rồi báo anh."

| Output | Value |
|--------|-------|
| Business Objective | Pipeline đa giai đoạn: Xác minh Dashboard → Phát hiện lỗi → Sửa lỗi an toàn → Báo cáo |
| Scope | 3 items (dashboard, source, regression) |
| Out of Scope | 4 items (WhatsApp, schema, deps, prod data) |
| Acceptance Criteria | 7 total (6 blocking, 1 advisory) |
| Effort | LARGE — ~10 min — 8 phases — 7 skills |
| Risk Score | 17/100 (LOW) — safe to proceed |
| Scope Clarity | CLEAR (0 conflicts, 0 ambiguities, 0 missing) |
| Proceed | ✅ true |
| Test Result | **17/17 PASS** |
