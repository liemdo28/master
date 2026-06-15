# Risk Prediction Engine
**Module:** DEV3 Phase 13.6  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**File:** `mi-core/server/src/gstack/pm-agent/risk-prediction.ts`

---

## Objective

Before a single skill executes, predict the probability and impact of: deployment failure, dependency unavailability, execution blockers, and CEO approval delays.

---

## Risk Score Formula

```
overall_risk = deployment_risk × 0.40
             + blocker_risk    × 0.30
             + approval_risk   × 0.20
             + dependency_risk × 0.10
```

| Score | Level | Recommendation |
|-------|-------|---------------|
| < 15 | SAFE | ✅ Auto-execute |
| 15–34 | LOW | 🟡 Execute with standard monitoring |
| 35–54 | MEDIUM | 🟠 Execute with close monitoring |
| 55–74 | HIGH | 🔴 CEO confirmation required |
| ≥ 75 | CRITICAL | 🚨 Block — full CEO review needed |

---

## Risk Components

### Deployment Risk (weight 40%)

| Condition | Score Added |
|-----------|------------|
| deploy_release intent | +60 |
| fix_bug intent | +25 |
| rollback intent | +40 |
| LARGE effort | +15 |
| CRITICAL effort | +25 |

### Dependency Risk (weight 10%)

| Condition | Score Added |
|-----------|------------|
| Baseline | +20 |
| dashboard target | +10 (depends on mi-core) |
| scope ≥ 3 items | +15 |
| build_feature intent | +20 |

### Blocker Risk (weight 30%)

| Condition | Score Added |
|-----------|------------|
| requires_approval in intent | +35 |
| deploy_release intent | +20 |
| risks mention "approval" | +30 |

### Approval Risk (weight 20%)

| Risk Level | Score |
|-----------|-------|
| L1 (auto) | 5 |
| L2 (single approve) | 30 |
| L3 (double approve) | 70 |

---

## Risk Catalogue

| Type | Example | Mitigation |
|------|---------|-----------|
| DEPLOYMENT | Production service downtime possible | Pre/post health check + rollback ready |
| REGRESSION | Fix may break adjacent code | Regression suite after fix |
| APPROVAL | Pipeline blocks waiting for CEO | Queue approval early; WhatsApp notify |
| DEPENDENCY | Dashboard needs mi-core online | Health check mi-core before dashboard audit |
| BLOCKER | Post-fix test not requested | Mi auto-runs regression after any fix |
| DATA | Database migration risk | Only read-only in SAFE boundary |

---

## Recommended Workflow Generation

Workflow is computed based on intent + multi-phase detection + risk level:

**Multi-phase pipeline (audit + fix + test):**
```
1. PM Agent → Scope & Acceptance Criteria
2. Audit: health + pm2_status + source_scan + log_scan + dashboard_audit
3. Safety Gate → "nếu an toàn thì fix"
4. Auto-Fix (SAFE boundary only)
5. Build Check (0 TypeScript errors)
6. Regression Suite (≥ 80% pass)
7. QA Certification (5-gate)
8. CEO Report → WhatsApp
```

---

## Acceptance Test Result

**Input:** "Mi ơi kiểm tra Dashboard, tìm lỗi, nếu an toàn thì fix, test lại rồi báo anh."

| Component | Score | Rationale |
|-----------|-------|-----------|
| Deployment Risk | 25 | fix_bug sub-intent present |
| Dependency Risk | 30 | dashboard target + wide scope |
| Blocker Risk | 10 | no approval required (audit_project L1) |
| Approval Risk | 5 | L1 intent — SAFE auto-execute |
| **Overall** | **17/100** | **LOW** |

**Risk Level: LOW** — Safe to proceed without CEO confirmation ✅  
**Risks identified:** 2 (REGRESSION, DEPENDENCY)  
**Workflow:** 8 steps generated ✅
