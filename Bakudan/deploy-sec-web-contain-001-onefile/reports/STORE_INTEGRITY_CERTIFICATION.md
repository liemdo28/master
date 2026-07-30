# Store Integrity Certification
**Phase 11.8 — Pre-Production Certification**
**Date:** 2026-05-30
**Status:** REQUIRES LIVE DB EXECUTION

---

## Objective

Verify every operational entity is anchored to a store. No orphans.

---

## Audit Queries (Execute on Production)

### 1. Projects Without Store

```sql
SELECT COUNT(*) AS orphan_projects
FROM projects
WHERE store_id IS NULL
  AND is_archived = 0;
```

**Expected:** 0 (or only "Corporate" catch-all projects)

**Certification Criteria:** ≤ 5 orphan projects (all assigned to Corporate)

---

### 2. Tasks Without Store (via Project)

```sql
SELECT COUNT(*) AS orphan_tasks
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id
WHERE t.is_completed = 0
  AND t.status != 'completed'
  AND (p.store_id IS NULL OR t.project_id IS NULL);
```

**Expected:** 0

**Certification Criteria:** All incomplete tasks must have a store path

---

### 3. Employees Without Store

```sql
SELECT COUNT(*) AS orphan_employees
FROM employees
WHERE store_id IS NULL
  AND status = 'active';
```

**Expected:** 0

**Certification Criteria:** Every active employee assigned to a store

---

### 4. Shifts Without Store

```sql
SELECT COUNT(*) AS orphan_shifts
FROM shifts
WHERE store_id IS NULL;
```

**Expected:** 0

**Certification Criteria:** Every shift belongs to a store

---

### 5. Checklists Without Store

```sql
SELECT COUNT(*) AS orphan_opening
FROM opening_checklists
WHERE store_id IS NULL;

SELECT COUNT(*) AS orphan_closing
FROM closing_checklists
WHERE store_id IS NULL;
```

**Expected:** 0

**Certification Criteria:** Every checklist submission linked to a store

---

### 6. Store Existence Verification

```sql
SELECT id, name, slug, is_active, created_at
FROM stores
ORDER BY id;
```

**Expected stores:**

| ID | Name | Status |
|----|------|--------|
| 1 | Bandera | Active |
| 2 | Stone Oak | Active |
| 3 | Corporate | Active |

---

### 7. Cross-Reference Integrity

```sql
-- Projects referencing non-existent stores
SELECT COUNT(*) AS broken_project_refs
FROM projects p
LEFT JOIN stores s ON p.store_id = s.id
WHERE p.store_id IS NOT NULL AND s.id IS NULL;

-- Task_stores referencing non-existent stores
SELECT COUNT(*) AS broken_task_store_refs
FROM task_stores ts
LEFT JOIN stores s ON ts.store_id = s.id
WHERE s.id IS NULL;

-- Users referencing non-existent stores
SELECT COUNT(*) AS broken_user_refs
FROM users u
LEFT JOIN stores s ON u.store_id = s.id
WHERE u.store_id IS NOT NULL AND s.id IS NULL;
```

**Expected:** All 0

---

## Results (Fill After Execution)

| Query | Result | Status |
|-------|--------|--------|
| 1. Orphan Projects | [TBD] | [PENDING] |
| 2. Orphan Tasks | [TBD] | [PENDING] |
| 3. Orphan Employees | [TBD] | [PENDING] |
| 4. Orphan Shifts | [TBD] | [PENDING] |
| 5. Orphan Checklists | [TBD] | [PENDING] |
| 6. Store Existence | [TBD] | [PENDING] |
| 7. Broken References | [TBD] | [PENDING] |

---

## Remediation (If Failures Found)

```sql
-- Fix orphan projects → assign to Corporate (id=3)
UPDATE projects SET store_id = 3
WHERE store_id IS NULL AND is_archived = 0;

-- Fix orphan employees → assign to Corporate
UPDATE employees SET store_id = 3
WHERE store_id IS NULL AND status = 'active';

-- Remove broken task_store references
DELETE FROM task_stores
WHERE store_id NOT IN (SELECT id FROM stores);
```

---

## Certification Criteria

| Check | Threshold | |
|-------|-----------|---|
| Orphan projects | ≤ 5 | Must be Corporate-assigned |
| Orphan tasks | 0 | Hard requirement |
| Orphan employees | 0 | Hard requirement |
| Orphan shifts | 0 | Hard requirement |
| Orphan checklists | 0 | Hard requirement |
| Broken references | 0 | Hard requirement |
| Store count | ≥ 3 | Bandera + Stone Oak + Corporate |

**Status: PENDING — Execute queries on live database**
