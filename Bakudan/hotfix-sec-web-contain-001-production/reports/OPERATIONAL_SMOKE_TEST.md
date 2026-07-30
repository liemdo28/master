# Operational Smoke Test
**Phase 11.8 — Pre-Production Certification**
**Date:** 2026-05-30
**Status:** READY FOR EXECUTION

---

## Objective

Create one of each core entity, perform CRUD operations, verify data persists across page refresh.

---

## Test 1 — Store

| Step | Action | Route | Expected | Result |
|------|--------|-------|----------|--------|
| 1.1 | Create store "Test Store QA" | POST `/admin/stores` | Store created, appears in list | [PENDING] |
| 1.2 | Edit store name → "Test Store QA Updated" | POST `/admin/stores/{id}/update` | Name updated | [PENDING] |
| 1.3 | Refresh page | GET `/admin/stores` | Updated name persists | [PENDING] |
| 1.4 | View in Store Command | GET `/admin/stores/{id}` | Health score, stats visible | [PENDING] |

---

## Test 2 — Employee

| Step | Action | Route | Expected | Result |
|------|--------|-------|----------|--------|
| 2.1 | Create employee "QA Tester" | POST `/admin/employees` | Employee created | [PENDING] |
| 2.2 | Assign to "Test Store QA Updated" | — | store_id set | [PENDING] |
| 2.3 | Refresh page | GET `/admin/employees` | Employee visible in list | [PENDING] |

---

## Test 3 — Project

| Step | Action | Route | Expected | Result |
|------|--------|-------|----------|--------|
| 3.1 | Create project "QA Certification Project" | POST `/projects` | Project created | [PENDING] |
| 3.2 | Assign to store | — | store_id set | [PENDING] |
| 3.3 | Add section "Phase 1" | POST `/projects/{id}/sections` | Section created | [PENDING] |
| 3.4 | Refresh page | GET `/projects/{id}` | Project + section visible | [PENDING] |

---

## Test 4 — Task

| Step | Action | Route | Expected | Result |
|------|--------|-------|----------|--------|
| 4.1 | Create task "Smoke Test Task" | POST `/tasks` | Task created | [PENDING] |
| 4.2 | Assign to project + user | — | project_id + assignee_id set | [PENDING] |
| 4.3 | Edit title → "Smoke Test Task Updated" | POST `/api/tasks/{id}/title` | Title updated | [PENDING] |
| 4.4 | Add comment "Test comment" | POST `/api/tasks/{id}/comments` | Comment created | [PENDING] |
| 4.5 | Change status → in_progress | POST `/api/tasks/{id}/status` | Status updated | [PENDING] |
| 4.6 | Reassign to different user | POST `/api/tasks/{id}/reassign` | Assignee changed | [PENDING] |
| 4.7 | Complete task | POST `/api/tasks/{id}/complete` | is_completed = 1 | [PENDING] |
| 4.8 | Refresh page | GET `/my-tasks` | Task shows as completed | [PENDING] |

---

## Test 5 — Checklist

| Step | Action | Route | Expected | Result |
|------|--------|-------|----------|--------|
| 5.1 | Open store checklist | GET `/store/checklist/open` | Form loads | [PENDING] |
| 5.2 | Submit opening checklist | POST `/store/checklist/open/submit` | Checklist saved | [PENDING] |
| 5.3 | View history | GET `/store/checklist/history` | Submission visible | [PENDING] |

---

## Test 6 — Release

| Step | Action | Route | Expected | Result |
|------|--------|-------|----------|--------|
| 6.1 | Create release "v0.0.1-smoke" | POST `/admin/releases/create` | Release created | [PENDING] |
| 6.2 | Add review comment | POST `/api/admin/releases/{id}/review` | Review saved | [PENDING] |
| 6.3 | Update walkthrough CEO → pass | POST `/api/admin/releases/{id}/walkthrough` | Status updated | [PENDING] |
| 6.4 | Open CEO Review Mode | GET `/admin/releases/{id}/review` | Page loads correctly | [PENDING] |
| 6.5 | Refresh | — | All data persists | [PENDING] |

---

## Test 7 — Cross-Module Flow

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 7.1 | Task → click project link | Navigate to project detail | [PENDING] |
| 7.2 | Project → click store link | Navigate to store command | [PENDING] |
| 7.3 | Store → view team members | Employee list visible | [PENDING] |
| 7.4 | Notification → click target | Navigate to target object | [PENDING] |

---

## Data Persistence Verification

After all operations, verify via SQL:

```sql
-- Verify task exists and is complete
SELECT id, title, is_completed, status FROM tasks WHERE title LIKE '%Smoke Test%';

-- Verify comment exists
SELECT id, content FROM comments WHERE content LIKE '%Test comment%';

-- Verify release exists
SELECT id, version, walkthrough_ceo FROM releases WHERE version = 'v0.0.1-smoke';
```

---

## Cleanup

```sql
-- After certification, remove test data
DELETE FROM comments WHERE content LIKE '%Test comment%';
DELETE FROM tasks WHERE title LIKE '%Smoke Test%';
DELETE FROM releases WHERE version = 'v0.0.1-smoke';
DELETE FROM projects WHERE name = 'QA Certification Project';
DELETE FROM employees WHERE name = 'QA Tester';
DELETE FROM stores WHERE name LIKE '%Test Store QA%';
```

---

## Summary

| Test | Steps | Status |
|------|-------|--------|
| Store CRUD | 4 | [PENDING] |
| Employee CRUD | 3 | [PENDING] |
| Project CRUD | 4 | [PENDING] |
| Task CRUD | 8 | [PENDING] |
| Checklist | 3 | [PENDING] |
| Release | 5 | [PENDING] |
| Cross-Module | 4 | [PENDING] |
| **Total** | **31** | **[PENDING]** |

**Status: READY FOR EXECUTION on live environment**
