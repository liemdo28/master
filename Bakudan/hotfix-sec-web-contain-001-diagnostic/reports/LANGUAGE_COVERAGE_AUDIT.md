# Language Coverage Audit Report

**Date:** 2026-06-22
**Scope:** Full dashboard UI — views, controllers, partials, assets/js, layouts

## Summary

| Metric | Count |
|--------|-------|
| Total translation keys | 811 |
| English (en-US) keys | 811 |
| Spanish (es-US) keys | 811 |
| Vietnamese (vi-VN) keys | 811 |
| Missing keys (per locale) | 0 |
| Duplicate keys | 0 |

## Key Categories

| Category | Key Count |
|----------|-----------|
| Navigation (nav.*) | 22 |
| Page titles (page.*) | 16 |
| Auth (auth.*) | 26 |
| Settings (settings.*) | 15 |
| Dashboard (dashboard.*) | 20 |
| Overview (overview.*) | 45 |
| Tasks (task.*) | 55 |
| Bills (bills.*) | 35 |
| Stores (store.*) | 40 |
| Vendors (vendor.*) | 20 |
| Calendar (calendar.*) | 12 |
| Projects (project.*) | 30 |
| Notifications (notif.*, notification.*) | 10 |
| Email (email.*) | 12 |
| AI Import (ai_import.*) | 40 |
| Filters (filter.*) | 6 |
| Create New (create.*) | 6 |
| Quick Task (quick_task.*) | 15 |
| Status labels (status.*) | 19 |
| Buttons (button.*) | 12 |
| Empty states (empty.*) | 5 |
| Error states (error.*) | 4 |
| Executive (executive.*) | 5 |
| CEO (ceo.*) | 4 |
| Drawer (drawer.*) | 3 |
| Mobile (mobile.*) | 5 |
| Penalty (penalty.*) | 3 |
| Release (release.*) | 3 |
| Common (common.*) | 25 |
| Seed/Asana/Login | ~30 |

## Hardcoded Strings Found (Phase L2 Audit)

### Priority P0 — Visible KPI Labels
| File | Line | Text | Suggested Key |
|------|------|------|---------------|
| views/dashboard/overview.php | ~50 | "Total Cash Risk" | dashboard.kpi.cash_risk |
| views/dashboard/overview.php | ~55 | "Critical Tasks" | dashboard.kpi.critical_tasks |
| views/dashboard/overview.php | ~60 | "Compliance Risk" | dashboard.kpi.compliance_risk |
| views/dashboard/overview.php | ~65 | "Recommended Payment Order" | dashboard.finance.recommended_payment_order |
| views/dashboard/overview.php | ~70 | "Payment Risk Board" | dashboard.finance.payment_risk_board |

### Priority P1 — Sidebar Labels
| File | Line | Text | Suggested Key |
|------|------|------|---------------|
| views/layouts/main.php | ~500+ | "Overview" | nav.overview |
| views/layouts/main.php | ~510 | "Operations Today" | nav.operations_today |
| views/layouts/main.php | ~530 | "Store Command Center" | nav.store_command |
| views/layouts/main.php | ~540 | "Store Health" | nav.store_health |

### Priority P2 — Status Labels in Controllers
| File | Line | Text | Suggested Key |
|------|------|------|---------------|
| controllers/DrilldownController.php | ~30 | "Critical Tasks — Drill-Down" | dashboard.kpi.critical_tasks |

## Recommendations

1. Replace all P0 hardcoded strings with `t()` calls using the new keys
2. Update P1 sidebar labels to use `t()` with nav.* keys
3. P2 controller strings should pass translated titles to views

## Verification

Run `python scripts/gen_lang.py` to regenerate language files after adding new keys.
Run `scripts/verify-translations.php` to validate completeness.
