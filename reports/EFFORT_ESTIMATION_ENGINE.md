# Effort Estimation Engine
**Module:** DEV3 Phase 13.5  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**File:** `mi-core/server/src/gstack/pm-agent/effort-estimation.ts`

---

## Output Schema

```typescript
interface EffortEstimate {
  size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'CRITICAL';
  estimated_duration_min: number;
  complexity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;       // 0–100
  rationale: string;
  skill_count: number;
  phase_count: number;
  breakdown: PhaseEstimate[];  // per-phase skill + duration
}
```

---

## Complexity Score

```
complexity_score = intent_base_score
                 + scope_width_bonus   (scope.length >= 3 → +2)
                 + deliverables_bonus  (deliverables.length >= 4 → +1)
                 + approval_overhead   (requires_approval → +2)
                 + risk_level * 1.5
```

| Score | Complexity | Size |
|-------|-----------|------|
| < 5 | LOW | SMALL |
| 5–7 | MEDIUM | MEDIUM |
| 8–11 | HIGH | LARGE |
| ≥ 12 | CRITICAL | CRITICAL |

---

## Intent Base Scores

| Intent | Score | Typical Size |
|--------|-------|-------------|
| check_status | 1 | SMALL |
| monitor_runtime | 1 | SMALL |
| search_knowledge | 1 | SMALL |
| create_report | 2 | SMALL |
| audit_project | 3 | MEDIUM |
| fix_bug | 4 | MEDIUM |
| rollback | 5 | LARGE |
| build_feature | 6 | LARGE |
| deploy_release | 7 | LARGE |

---

## Multi-Phase Detection

When the request contains `fix` AND (`kiem tra` OR `test`), the engine inserts an additional phase:

```
Post-Fix Regression: 2min — skills: [regression_suite, build_check]
```

This pushes size from MEDIUM → LARGE and duration by +2 minutes.

---

## Phase Library (audit_project)

| Phase | Duration | Skills |
|-------|---------|--------|
| Health & Status Check | 1 min | health, pm2_status |
| Source & Log Scan | 2 min | source_scan, log_scan |
| Dashboard Audit | 2 min | dashboard_audit |
| QA Certification | 1 min | regression_suite |

With multi-phase fix: +Safety Gate +Auto-Fix +Post-Fix Regression = **8 phases total**

---

## Acceptance Test Result

**Input:** "Mi ơi kiểm tra Dashboard, tìm lỗi, nếu an toàn thì fix, test lại rồi báo anh."

| Dimension | Value |
|-----------|-------|
| Size | **LARGE** |
| Duration | **~10 minutes** |
| Complexity | **HIGH** |
| Confidence | 78% |
| Phases | **8** |
| Skills | **7** (health, pm2_status, source_scan, log_scan, dashboard_audit, build_check, regression_suite) |

**Phase Breakdown:**
```
1. Health & Status Check       1min  [health, pm2_status]
2. Source & Log Scan           2min  [source_scan, log_scan]
3. Dashboard Audit             2min  [dashboard_audit]
4. Safety Gate                 0min  []
5. Auto-Fix Application        2min  [build_check]
6. Post-Fix Regression         2min  [regression_suite, build_check]
7. QA Certification            1min  [regression_suite]
8. CEO Report                  0min  []
```
