# Store Ownership Audit
**Phase 11.7 — Operational Readiness Sprint**
**Date:** 2026-05-30
**Status:** PENDING — Run against live database

---

## Executive Rule

Every operational task belongs to exactly one store. Orphan tasks (no `store_id` or invalid `store_id`) pollute dashboard signal and distort store health metrics.

---

## Audit Queries

### Query A — Tasks with NULL store_id

```sql
-- Find all tasks that have no store ownership
-- (not linked via project.store_id either)
SELECT t.id, t.title, t.due_date, t.status, t.priority,
       p.name AS project_name, p.store_id AS project_store_id,
       u.name AS assignee_name
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id
LEFT JOIN users u ON t.assignee_id = u.id
WHERE t.is_completed = 0
  AND t.status != 'completed'
  AND p.store_id IS NULL
ORDER BY t.due_date ASC;
```

**Expected behavior:** Returns all incomplete tasks not anchored to a store via their project.

### Query B — Orphan store_id references

```sql
-- Find project.store_id pointing to deleted/missing stores
SELECT p.id AS project_id, p.name AS project_name, p.store_id
FROM projects p
LEFT JOIN stores s ON p.store_id = s.id
WHERE p.store_id IS NOT NULL AND s.id IS NULL;
```

**Expected behavior:** Should return zero rows if all store references are valid.

### Query C — Tasks via task_stores with missing store

```sql
-- Find task_store links to non-existent stores
SELECT ts.task_id, ts.store_id, t.title
FROM task_stores ts
LEFT JOIN stores s ON ts.store_id = s.id
LEFT JOIN tasks t ON ts.task_id = t.id
WHERE s.id IS NULL;
```

---

## Store Structure (Current)

| Store Name | ID | Role |
|-----------|----|------|
| Bandera | 1 | Franchise Restaurant |
| Stone Oak | 2 | Franchise Restaurant |
| Corporate | 3 | Operations HQ |

> **Note:** Corporate store (id=3) must exist to receive all orphan/headquarters tasks.
> If Corporate does not exist, create it:
> ```sql
> INSERT INTO stores (name, slug, color, is_active, created_at)
> VALUES ('Corporate', 'corporate', '#6366f1', 1, NOW());
> ```

---

## Audit Results

### Query A Results

```
Total Tasks:          [PENDING — run on live DB]
NULL store_id Tasks:   [PENDING]
```

### Query B Results

```
Orphan project.store_id: [PENDING — run on live DB]
```

### Query C Results

```
Orphan task_stores:    [PENDING — run on live DB]
```

---

## Migration Plan

### Step 1 — Create Corporate Store (if missing)

```php
// In AdminTaskAuditController or via direct migration
$db = Database::getInstance();
$corp = $db->fetch("SELECT id FROM stores WHERE slug = 'corporate' LIMIT 1");
if (!$corp) {
    $db->execute(
        "INSERT INTO stores (name, slug, color, is_active, created_at, region, city)
         VALUES ('Corporate', 'corporate', '#6366f1', 1, NOW(), 'HQ', 'San Antonio')"
    );
    $corporateStoreId = $db->lastInsertId();
} else {
    $corporateStoreId = $corp['id'];
}
```

### Step 2 — Assign Orphan Tasks to Corporate

```php
// For tasks with no project or project with no store_id
$db->execute("
    UPDATE tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    SET t.store_id = ?
    WHERE t.is_completed = 0
      AND t.store_id IS NULL
      AND (p.store_id IS NULL OR p.id IS NULL)
", [$corporateStoreId]);
```

### Step 3 — Fix Orphan project.store_id

```php
// Assign orphaned projects to Corporate
$db->execute("
    UPDATE projects p
    LEFT JOIN stores s ON p.store_id = s.id
    SET p.store_id = ?
    WHERE p.store_id IS NOT NULL AND s.id IS NULL
", [$corporateStoreId]);
```

---

## Classification

| Category | Count | Action |
|----------|-------|--------|
| Category A — Obsolete (overdue > 90 days) | TBD | Auto-complete |
| Category B — Still relevant | TBD | Assign to Corporate |
| Category C — Needs manual review | TBD | Flag for manager |

---

## Deliverable Checklist

- [ ] Corporate store exists (ID confirmed)
- [ ] Query A — NULL store_id tasks identified
- [ ] Query B — Orphan project.store_id identified
- [ ] Query C — Orphan task_stores identified
- [ ] Auto-fix applied for Categories A and B
- [ ] Manual review queue exported for Category C
- [ ] Sign-off from Operations Lead

---

## Summary

```
Total Tasks Scanned:     [TBD]
Orphan Tasks Found:      [TBD]
Auto-Fixed:              [TBD]
Manual Review Required:   [TBD]
```

**Audit Status:** PENDING — Requires live database execution
