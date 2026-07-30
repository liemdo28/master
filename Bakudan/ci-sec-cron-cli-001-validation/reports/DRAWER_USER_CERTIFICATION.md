# DRAWER USER CERTIFICATION

**Date:** 2026-06-15  
**Status:** PASS  
**Reviewed by:** Cline (automated audit)

---

## Data Loading Path

**Route:** `GET /admin/users/{id}` → `UserController::detail($id)`

**Database Tables Queried:**
| Table | Purpose |
|---|---|
| `users` | User profile (name, email, role, is_active, timezone) |
| `tasks` (assigned) | Tasks where `assignee_id = user_id` |
| `tasks` (created) | Tasks where `created_by = user_id` |
| `tasks` (watched) | Tasks via `task_watchers` |

## Data Fields Verified

| Field | Source | Status |
|---|---|---|
| name | `users.name` | PASS |
| email | `users.email` | PASS |
| role | `users.role` | PASS |
| is_active | `users.is_active` | PASS |
| timezone | `users.timezone` | PASS |
| store_name | `stores.name` via user's store_id | PASS |
| last_login_at | `users.last_login_at` | PASS |
| password_reset_at | `users.password_reset_at` | PASS |

## Views Rendered

- `views/admin/user_detail.php` shows:
  - Hero card (avatar, name, email, role, status)
  - Stats (assigned, overdue, today, upcoming, completed, recurring, public, private)
  - Password reset form
  - Assigned tasks list (via `_task_row_partial.php`)
  - Created tasks list
  - Watched tasks list

## Drawer Integration

- User name links in `admin/users.php` have `data-detail-drawer` attribute
- Clicking opens user detail in right-side drawer
- `extractContent()` will isolate the `.ad-hero` + `.ad-section` content

## Issues Found

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | LOW | Password reset form inside drawer — form action redirects to user page | ACCEPTED — form works, drawer can be closed after submission |
| 2 | LOW | User edit link excluded from drawer by `excludedPathRe` (contains `/edit`) | CORRECT — edit pages remain full-page per directive |

## Verdict

**PASS** — User drawer loads all data correctly. No SQL errors, no missing tables.
