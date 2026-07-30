# Release Workflow Certification
**Phase 11.8 — Pre-Production Certification**
**Date:** 2026-05-30
**Status:** READY FOR EXECUTION

---

## Test Release

```
Version: v11.0.0-certification
Name: Phase 11.8 Certification Test
Branch: main
Purpose: Validate full release lifecycle without production deploy
```

---

## Workflow Steps

### Step 1 — Create Draft

| Action | Route | Method |
|--------|-------|--------|
| Navigate to Release Center | `/admin/releases` | GET |
| Click "Create Release" | `/admin/releases/create` | GET |
| Fill form: name, version, notes | — | — |
| Submit | `/admin/releases/create` | POST |

**Expected:** Release created with status `draft`. Redirect to detail page.

**Verification:**
```sql
SELECT id, version, status, created_at
FROM releases
WHERE version = 'v11.0.0-certification';
-- Expected: status = 'draft'
```

| Result | Status |
|--------|--------|
| [TBD] | [PENDING] |

---

### Step 2 — Transition to Review

| Action | Route | Method |
|--------|-------|--------|
| Click "Move to Review" | `/api/admin/releases/{id}/transition` | POST |
| Payload: `{ status: 'review', csrf_token: '...' }` | — | — |

**Expected:** Status changes to `review`. Audit log entry created.

**Verification:**
```sql
SELECT status FROM releases WHERE version = 'v11.0.0-certification';
-- Expected: 'review'

SELECT action, created_at FROM release_audit_log
WHERE release_id = {id} ORDER BY created_at DESC LIMIT 1;
-- Expected: action = 'review'
```

| Result | Status |
|--------|--------|
| [TBD] | [PENDING] |

---

### Step 3 — Add Review / Approval

| Action | Route | Method |
|--------|-------|--------|
| Add comment | `/api/admin/releases/{id}/review` | POST |
| Payload: `{ type: 'comment', body: 'Certification test' }` | — | — |
| Add approval | `/api/admin/releases/{id}/review` | POST |
| Payload: `{ type: 'approval', body: 'Approved for certification' }` | — | — |

**Expected:** Review records created. Approval logged.

**Verification:**
```sql
SELECT type, body, created_at FROM release_reviews
WHERE release_id = {id} ORDER BY created_at DESC;
-- Expected: 2 rows (comment + approval)
```

| Result | Status |
|--------|--------|
| [TBD] | [PENDING] |

---

### Step 4 — Transition to Approved

| Action | Route | Method |
|--------|-------|--------|
| Click "Approve" | `/api/admin/releases/{id}/transition` | POST |
| Payload: `{ status: 'approved' }` | — | — |

**Expected:** Status = `approved`

| Result | Status |
|--------|--------|
| [TBD] | [PENDING] |

---

### Step 5 — Schedule (Simulation)

| Action | Route | Method |
|--------|-------|--------|
| Schedule for future | `/api/admin/releases/{id}/schedule` | POST |
| Payload: `{ scheduled_at: '2026-12-31 23:59:00', timezone: 'Asia/Ho_Chi_Minh' }` | — | — |

**Expected:** `scheduled_at` field populated. Status remains `approved`.

**Verification:**
```sql
SELECT status, scheduled_at, scheduled_timezone
FROM releases WHERE version = 'v11.0.0-certification';
-- Expected: status='approved', scheduled_at='2026-12-31 23:59:00'
```

| Result | Status |
|--------|--------|
| [TBD] | [PENDING] |

---

### Step 6 — Cancel Schedule

| Action | Route | Method |
|--------|-------|--------|
| Cancel schedule | `/api/admin/releases/{id}/cancel-schedule` | POST |

**Expected:** `scheduled_at` cleared.

| Result | Status |
|--------|--------|
| [TBD] | [PENDING] |

---

### Step 7 — Publish Simulation

| Action | Route | Method |
|--------|-------|--------|
| Attempt publish | `/api/admin/releases/{id}/transition` | POST |
| Payload: `{ status: 'published' }` | — | — |

**Expected:** Either succeeds (if all protection checks pass) or returns 422 with reasons.

**Protection checks verified:**
- [ ] QA score set
- [ ] Confidence score ≥ 70
- [ ] All walkthroughs passed
- [ ] No active deploy freeze

| Result | Status |
|--------|--------|
| [TBD] | [PENDING] |

---

### Step 8 — Rollback Simulation

| Action | Route | Method |
|--------|-------|--------|
| Rollback | `/api/admin/releases/{id}/transition` | POST |
| Payload: `{ status: 'rolled_back', reason: 'Certification test rollback' }` | — | — |

**Expected:** Status = `rolled_back`. Audit log records rollback with reason.

| Result | Status |
|--------|--------|
| [TBD] | [PENDING] |

---

### Step 9 — CEO Review Mode

| Action | Route | Method |
|--------|-------|--------|
| Open CEO Review | `/admin/releases/{id}/review` | GET |

**Expected:** Page loads with:
- Version badge
- Walkthrough matrix
- Quality scores
- Approval checklist
- New/Changed modules list
- Known issues section

| Result | Status |
|--------|--------|
| [TBD] | [PENDING] |

---

### Step 10 — Walkthrough Library

| Action | Route | Method |
|--------|-------|--------|
| Open library | `/admin/walkthrough-library` | GET |

**Expected:** Page loads with certification release visible in table.

| Result | Status |
|--------|--------|
| [TBD] | [PENDING] |

---

## Cleanup

After certification, delete test release:

```sql
DELETE FROM release_reviews WHERE release_id = {id};
DELETE FROM release_audit_log WHERE release_id = {id};
DELETE FROM release_links WHERE release_id = {id};
DELETE FROM releases WHERE version = 'v11.0.0-certification';
```

---

## Certification Result

| Step | Status |
|------|--------|
| 1. Create Draft | [PENDING] |
| 2. Transition to Review | [PENDING] |
| 3. Add Review/Approval | [PENDING] |
| 4. Transition to Approved | [PENDING] |
| 5. Schedule | [PENDING] |
| 6. Cancel Schedule | [PENDING] |
| 7. Publish Simulation | [PENDING] |
| 8. Rollback Simulation | [PENDING] |
| 9. CEO Review Mode | [PENDING] |
| 10. Walkthrough Library | [PENDING] |

**Overall: PENDING — Execute on live environment**
