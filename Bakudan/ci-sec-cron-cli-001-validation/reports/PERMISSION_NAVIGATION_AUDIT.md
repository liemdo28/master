# Permission Navigation Audit

Generated: 2026-05-30T14:04:43.199Z

## Accounts Used

| Role Under Test | Account | DB Role | Notes |
|---|---|---|---|
| CEO | liem.dt0208@gmail.com | admin | No distinct ceo user exists in synced preview data; real executive/admin account used for executive visibility evidence. |
| Manager / GM | hoangdle@gmail.com | manager |  |
| Member | nkthanhnguyen09@gmail.com | staff |  |

## Navigation Evidence

Each role recording captured visible sidebar modules and route outcomes. Final QA had no SQLSTATE, missing-table, blank-sidebar, or login-dead-end failures.

## Permission Notes

- Manager / GM can access Store Command after guard changed from admin-only to `canManage()`.
- Publish/governance controls remain scoped by existing release permission checks in `ReleaseController` and release views.
- Member recording used a staff account and completed allowed navigation without admin/governance access in the tested path.

## Residual Governance Gap

The app currently still relies on role helper gates such as `canAdmin()` and `canManage()` in multiple controllers/views. The Phase 12 permissions tables are present and seeded, but full permission-table-driven navigation is not fully wired across the app. Treat this as a P2 architecture follow-up, not a current preview QA blocker.
