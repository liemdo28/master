# Phase 11.9 — CEO Operational Alignment
**Date:** 2026-05-30
**Status:** RESOLVED

---

## Issue Summary

| # | Issue | Priority | Status |
|---|-------|----------|--------|
| 1 | Store Command / Manager Command broken (`manager_id`) | P0 | **FIXED** |
| 2 | People section too complex | P1 | **FIXED** |
| 3 | Multi-store management model | P1 | **DOCUMENTED** (Phase 12) |
| 4 | Preview data must mirror main | P1 | **DOCUMENTED** (existing architecture) |
| 5 | User accounts must sync | P1 | **DOCUMENTED** (existing architecture) |
| 6 | Tasks must sync | P1 | **DOCUMENTED** (existing architecture) |
| 7 | Digital Asset Library | P2 | **REQUIRES DECISION** (Phase 12) |
| 8 | Secure Vault | P2 | **DOCUMENTED** (Phase 12) |
| 9 | Task Verification Workflow | P2 | **DOCUMENTED** (Phase 12) |

---

## FIXED — Issue 1: Manager Command / Store Command

### Root Cause

Two broken column references:
1. `users.manager_id` — **never existed** in any migration. Used in `views/manager/command.php`
2. `stores.manager_id` — exists in migration `2026_05_29_franchise_platform.sql` but may not be applied on all environments

### Fix Applied

**`views/manager/command.php`:**
- Replaced all `WHERE u.manager_id = ?` with `WHERE u.store_id IN (SELECT store_id FROM users WHERE id = ? AND store_id IS NOT NULL)`
- Team scope now uses store-based relationship (multi-store aware)
- Priority filter changed from numeric `>= 8` to enum `IN ('high','urgent')`

**`models/StoreCommand.php`:**
- `find()` and `getAllStores()` now check `$this->db->columnExists('stores', 'manager_id')` before JOINing
- Graceful fallback: returns `NULL as manager_name` if column doesn't exist
- No more SQLSTATE errors on environments without the franchise migration

### Verification

Both routes now load without SQL errors regardless of whether `stores.manager_id` column exists.

---

## FIXED — Issue 2: People Section Simplified

### Before
```
PEOPLE
├── Employees
├── Shifts
├── Training
└── Team Load
```

### After
```
PEOPLE
├── Team Members
└── Team Load
```

Employee Center, Shift Center, and Training Center removed from high-level navigation. Still accessible via Admin section.

---

## DOCUMENTED — Issue 3: Multi-Store Access Model

**Deliverable:** `reports/MULTI_STORE_ACCESS_MODEL.md`

### Decision Required

Current: `users.store_id` (one-to-one)
Proposed: `user_stores` junction table (many-to-many)

**Impact:** Moderate. Requires migration + query pattern changes across ~10 files.
**Recommendation:** Implement in Phase 12 after publish.

---

## DOCUMENTED — Issues 4-6: Preview Sync

**Existing architecture:** `docs/PREVIEW_SYNC_ARCHITECTURE.md`

Already designed:
- 15-minute selective dump (stores, users, projects, tasks, shifts)
- One-way only (Production → Preview)
- Sessions/email_queue excluded
- QA bypass for preview login

**User sync:** Passwords never copied. Preview uses `PREVIEW_QA_BYPASS` for auto-login.

**Status:** Architecture complete. Requires deployment of sync cron script.

---

## REQUIRES DECISION — Issue 7: Digital Asset Library

### CEO Request

Shared library for Images, PDFs, Documents, Videos, SOPs organized by Store → Category → Folder.

### Assessment

This is a **new business module** (not operational readiness). Per Phase 11 directive:

> No new business modules. Focus exclusively on Operational Readiness.

**Recommendation:** Defer to Phase 12. Document requirements only.

### Estimated Effort

- Schema: 2 hours
- File upload/storage: 4 hours
- UI (browse, upload, organize): 8 hours
- Permissions: 4 hours
- **Total: ~18 hours**

---

## DOCUMENTED — Issue 8: Secure Vault

**Deliverable:** `docs/SECURE_VAULT_ARCHITECTURE.md`

Schema designed. AES-256-GCM encryption. Audit logging. Permission-based access.

**Status:** Phase 12 module. Requires security review before implementation.

---

## DOCUMENTED — Issue 9: Task Verification Workflow

**Deliverable:** `docs/TASK_VERIFICATION_WORKFLOW.md`

Multi-step verification: Submitted → Verified → Accepted → Financial Confirmed → Completed.
Evidence upload per step. Approval chain. Audit trail.

**Status:** Phase 12 module. Requires UI design.

---

## Publish Readiness Assessment

| Criteria | Status |
|----------|--------|
| P0 bugs fixed | ✅ |
| Navigation simplified per CEO | ✅ |
| Broken queries resolved | ✅ |
| Architecture docs for Phase 12 | ✅ |
| No new business modules added | ✅ (per directive) |

### Risks

| Risk | Mitigation |
|------|-----------|
| `stores.manager_id` migration not applied | Graceful fallback in code |
| Multi-store model not yet implemented | Current store_id still works; Phase 12 |
| Preview sync not deployed | Architecture ready; deploy separately |

---

## Executive Verdict

```
╔══════════════════════════════════════════════════╗
║                                                  ║
║  Phase 11.9 Issues: RESOLVED                    ║
║                                                  ║
║  P0 Fixes: Applied (Manager Command, Store Cmd) ║
║  P1 Simplification: Applied (People sidebar)    ║
║  P2 Architecture: Documented for Phase 12       ║
║                                                  ║
║  Publish Status: UNBLOCKED                       ║
║                                                  ║
╚══════════════════════════════════════════════════╝
```
