# COMPANY EXECUTION CAPABILITY MATRIX

> Generated: 2026-06-24T20:18+07:00
> Phase 28 — Execution Audit

---

## Per-System Capability Classification

### 1. Bakudan Website (bakudanramen.com-current)

| Capability | Status |
|---|---|
| CAN_READ | ✅ YES |
| CAN_ANALYZE | ✅ YES |
| CAN_CREATE_TASK | ✅ YES |
| CAN_MODIFY_SOURCE | ✅ YES |
| CAN_TEST | ✅ YES (local HTML) |
| CAN_CREATE_PR | ✅ YES (via GitHub CLI) |
| CAN_DEPLOY_PREVIEW | ⚠️ PARTIAL (preview env exists) |
| CAN_DEPLOY_PRODUCTION | ❌ REQUIRES CEO APPROVAL |
| CAN_ROLLBACK | ✅ YES (git revert) |
| CAN_VERIFY_OUTCOME | ✅ YES (HTML diff) |

**STATUS: EXECUTION_READY**

---

### 2. Raw Sushi Website (RawWebsite)

| Capability | Status |
|---|---|
| CAN_READ | ✅ YES |
| CAN_ANALYZE | ✅ YES |
| CAN_CREATE_TASK | ✅ YES |
| CAN_MODIFY_SOURCE | ⚠️ PARTIAL (submodule/untracked) |
| CAN_TEST | ⚠️ PARTIAL |
| CAN_CREATE_PR | ⚠️ PARTIAL |
| CAN_DEPLOY_PREVIEW | ❌ NO |
| CAN_DEPLOY_PRODUCTION | ❌ REQUIRES CEO APPROVAL |
| CAN_ROLLBACK | ✅ YES (git) |
| CAN_VERIFY_OUTCOME | ✅ YES |

**STATUS: READ_ONLY** (submodule, not in main tree)

---

### 3. Dashboard (dashboard.bakudanramen.com)

| Capability | Status |
|---|---|
| CAN_READ | ✅ YES |
| CAN_ANALYZE | ✅ YES |
| CAN_CREATE_TASK | ✅ YES |
| CAN_MODIFY_SOURCE | ✅ YES |
| CAN_TEST | ✅ YES (PHP) |
| CAN_CREATE_PR | ✅ YES |
| CAN_DEPLOY_PREVIEW | ✅ YES (preview env) |
| CAN_DEPLOY_PRODUCTION | ❌ REQUIRES CEO APPROVAL |
| CAN_ROLLBACK | ✅ YES (git) |
| CAN_VERIFY_OUTCOME | ✅ YES |

**STATUS: EXECUTION_READY**

---

### 4. SEO Agents (seo-*-agent)

| Capability | Status |
|---|---|
| CAN_READ | ✅ YES |
| CAN_ANALYZE | ✅ YES |
| CAN_CREATE_TASK | ✅ YES |
| CAN_MODIFY_SOURCE | ✅ YES |
| CAN_TEST | ✅ YES |
| CAN_CREATE_PR | ✅ YES |
| CAN_DEPLOY_PREVIEW | ⚠️ PARTIAL |
| CAN_DEPLOY_PRODUCTION | ❌ REQUIRES CEO APPROVAL |
| CAN_ROLLBACK | ✅ YES |
| CAN_VERIFY_OUTCOME | ✅ YES |

**STATUS: EXECUTION_READY**

---

### 5. n8n Workflows

| Capability | Status |
|---|---|
| CAN_READ | ✅ YES (workflow files) |
| CAN_ANALYZE | ✅ YES |
| CAN_CREATE_TASK | ✅ YES |
| CAN_MODIFY_SOURCE | ✅ YES (workflow JSON) |
| CAN_TEST | ⚠️ PARTIAL (cron verification) |
| CAN_CREATE_PR | ✅ YES |
| CAN_DEPLOY_PREVIEW | ❌ NO |
| CAN_DEPLOY_PRODUCTION | ❌ REQUIRES CEO APPROVAL |
| CAN_ROLLBACK | ✅ YES (git + backup) |
| CAN_VERIFY_OUTCOME | ✅ YES (execution logs) |

**STATUS: EXECUTION_READY**

---

### 6. Mi-Core

| Capability | Status |
|---|---|
| CAN_READ | ✅ YES |
| CAN_ANALYZE | ✅ YES |
| CAN_CREATE_TASK | ✅ YES |
| CAN_MODIFY_SOURCE | ✅ YES |
| CAN_TEST | ✅ YES |
| CAN_CREATE_PR | ✅ YES |
| CAN_DEPLOY_PREVIEW | ⚠️ PARTIAL |
| CAN_DEPLOY_PRODUCTION | ❌ REQUIRES CEO APPROVAL |
| CAN_ROLLBACK | ✅ YES |
| CAN_VERIFY_OUTCOME | ✅ YES |

**STATUS: EXECUTION_READY** (but has uncommitted changes)

---

### 7. QB Ops Agent

| Capability | Status |
|---|---|
| CAN_READ | ✅ YES |
| CAN_ANALYZE | ✅ YES |
| CAN_CREATE_TASK | ✅ YES |
| CAN_MODIFY_SOURCE | ✅ YES |
| CAN_TEST | ⚠️ PARTIAL |
| CAN_CREATE_PR | ✅ YES |
| CAN_DEPLOY_PREVIEW | ❌ NO |
| CAN_DEPLOY_PRODUCTION | ❌ REQUIRES CEO APPROVAL |
| CAN_ROLLBACK | ✅ YES |
| CAN_VERIFY_OUTCOME | ✅ YES |

**STATUS: PR_READY**

---

### 8. DoorDash Agent

| Capability | Status |
|---|---|
| CAN_READ | ✅ YES |
| CAN_ANALYZE | ✅ YES |
| CAN_CREATE_TASK | ✅ YES |
| CAN_MODIFY_SOURCE | ⚠️ PARTIAL (submodule) |
| CAN_TEST | ⚠️ PARTIAL |
| CAN_CREATE_PR | ⚠️ PARTIAL |
| CAN_DEPLOY_PREVIEW | ❌ NO |
| CAN_DEPLOY_PRODUCTION | ❌ REQUIRES CEO APPROVAL |
| CAN_ROLLBACK | ⚠️ PARTIAL |
| CAN_VERIFY_OUTCOME | ✅ YES |

**STATUS: READ_ONLY** (submodule)

---

### 9. Review System (review-management-mcp)

| Capability | Status |
|---|---|
| CAN_READ | ✅ YES |
| CAN_ANALYZE | ✅ YES |
| CAN_CREATE_TASK | ✅ YES |
| CAN_MODIFY_SOURCE | ✅ YES |
| CAN_TEST | ⚠️ PARTIAL |
| CAN_CREATE_PR | ✅ YES |
| CAN_DEPLOY_PREVIEW | ❌ NO |
| CAN_DEPLOY_PRODUCTION | ❌ REQUIRES CEO APPROVAL |
| CAN_ROLLBACK | ✅ YES |
| CAN_VERIFY_OUTCOME | ✅ YES |

**STATUS: PARTIAL**

---

### 10. Food Safety Gateway

| Capability | Status |
|---|---|
| CAN_READ | ✅ YES |
| CAN_ANALYZE | ✅ YES |
| CAN_CREATE_TASK | ✅ YES |
| CAN_MODIFY_SOURCE | ✅ YES |
| CAN_TEST | ⚠️ PARTIAL |
| CAN_CREATE_PR | ✅ YES |
| CAN_DEPLOY_PREVIEW | ❌ NO |
| CAN_DEPLOY_PRODUCTION | ❌ REQUIRES CEO APPROVAL |
| CAN_ROLLBACK | ✅ YES |
| CAN_VERIFY_OUTCOME | ✅ YES |

**STATUS: PARTIAL**

---

## Summary

| System | Status |
|---|---|
| Bakudan Website | EXECUTION_READY |
| Raw Sushi Website | READ_ONLY |
| Dashboard | EXECUTION_READY |
| SEO Agents | EXECUTION_READY |
| n8n Workflows | EXECUTION_READY |
| Mi-Core | EXECUTION_READY |
| QB Ops Agent | PR_READY |
| DoorDash Agent | READ_ONLY |
| Review System | PARTIAL |
| Food Safety Gateway | PARTIAL |

**Overall: 5 EXECUTION_READY, 1 PR_READY, 2 READ_ONLY, 2 PARTIAL, 0 BLOCKED**
