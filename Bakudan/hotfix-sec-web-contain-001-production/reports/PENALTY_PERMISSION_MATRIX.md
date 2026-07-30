# Penalty Permission Matrix
**Phase 13.4 — Accountability System**
**Date: 2026-06-11**

---

## Role: USER (member)

### Can See
- Own penalties only (`/penalties`)
- Own penalty history (penalty_log entries where user_id = self)
- Own open late tasks
- Own 30d / 90d / 12-month accumulated fines
- Own appeal status

### Cannot See
- Other users' penalties
- Store-level statistics
- Organization-wide data
- Admin configurations

### Can Do
- View own penalty summary
- Submit appeal for own penalty_log entry (once per entry)
- View appeal status/admin note

### Route
- `GET /penalties` — own penalties page
- `POST /penalties/appeal` — submit appeal

---

## Role: MANAGER

### Can See
- All members in their assigned store(s)
- Store-level penalty statistics (this month)
- Per-member penalty counts and totals
- Open appeals for their store members
- Members flagged for coaching

### Cannot See
- Unrelated stores
- Organization-wide accountability score
- Admin configurations
- Other managers' stores

### Can Do
- View team penalties dashboard
- See coaching recommendations
- View open appeals (read-only, cannot approve — admin only)

### Route
- `GET /manager/penalties` — team penalties dashboard

---

## Role: ADMIN

### Can See
- All users, all stores, all periods
- Full penalty log with filters
- Analytics: by user, by project, by store
- All appeals (pending + reviewed)
- Penalty rules configuration

### Can Do
- Create / edit / disable penalty rules
- Add users to penalty config (activate per-user penalties)
- Update per-user penalty amounts
- Toggle user active/inactive
- Review and approve/reject appeals
- Export (CSV via `/admin/penalties/export?...`)
- Configure global default amounts

### Route
- `GET /admin/penalties` — full penalty dashboard
- `GET /admin/penalty-rules` — rule management
- `POST /admin/penalty-rules/save` — create/edit rule
- `POST /admin/penalty-rules/toggle` — enable/disable rule
- `POST /admin/penalties/appeal/review` — approve/reject appeal
- `GET /admin/penalty` — legacy per-user config

---

## Role: CEO

### Can See
- Organization accountability score (0–100)
- 6-month penalty trend (count + total VND)
- High-risk users (3+ penalties in 90 days)
- High-risk stores (3+ penalties in 90 days)
- Repeated violations list
- Active penalty rules (read-only)
- Pending appeals (count, read-only)

### Cannot Do
- Create/edit/delete rules
- Apply penalties to users
- Approve/reject appeals
- Any operational editing

### Route
- `GET /ceo/accountability` — accountability dashboard (read-only)

---

## Enforcement Model

All permission checks use the existing `isAdmin()`, `isCeo()`, `isManager()`, and `isLoggedIn()` helpers defined in `index.php`:

```php
function isLoggedIn() { return isset($_SESSION['user_id']); }
function isAdmin()    { return $u && $u['role'] === 'admin'; }
function isCeo()      { return $u && $u['role'] === 'ceo'; }
function isManager()  { return $u && in_array($u['role'], ['admin','ceo','manager']); }
function canAdmin()   { return $u && in_array($u['role'], ['admin','ceo']); }
```

Every controller method performs an auth check at the top and returns 403/redirects to `overview` on failure.
