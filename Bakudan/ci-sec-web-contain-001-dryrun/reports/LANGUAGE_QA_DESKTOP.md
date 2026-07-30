# Language QA — Desktop

**Date:** 2026-06-22
**Status:** CODE VERIFIED — PENDING BROWSER VERIFICATION

## What was verified programmatically

### Translation file integrity
- `lang/en-US.php`: 811 keys, valid PHP array syntax
- `lang/es-US.php`: 811 keys, valid PHP array syntax
- `lang/vi-VN.php`: 811 keys, valid PHP array syntax
- Key parity: All 3 files have identical key sets
- No duplicate keys within any file
- No placeholder text (TODO, XXX, FIXME)

### i18n engine
- `config/i18n.php` loads from lang/ files
- `t()` function fallback chain works: locale → en-US → raw key
- Legacy code mapping: `en` → `en-US`, `vi` → `vi-VN`, `es` → `es-US`
- Missing key logging configured

### P0/P1 hardcoded strings fixed
- KPI cards: Cash Risk, Critical Tasks, Compliance Risk, Payment Risk Board, Recommended Payment Order
- Drilldown views: critical_tasks.php, cash_risk.php, compliance_risk.php
- Operations today: Store Health Issues
- CEO dashboard: Critical Tasks
- Sidebar: Overview, Store Command Center, Store Health, Release Center

## Browser Testing Matrix (requires manual testing)

| Page | EN | ES | VI |
|------|----|----|-----|
| /login | ⬜ | ⬜ | ⬜ |
| /overview | ⬜ | ⬜ | ⬜ |
| /my-tasks | ⬜ | ⬜ | ⬜ |
| /tasks | ⬜ | ⬜ | ⬜ |
| /bills | ⬜ | ⬜ | ⬜ |
| /admin/stores | ⬜ | ⬜ | ⬜ |
| /admin/store-command | ⬜ | ⬜ | ⬜ |
| /store-health | ⬜ | ⬜ | ⬜ |
| /calendar | ⬜ | ⬜ | ⬜ |
| /inbox | ⬜ | ⬜ | ⬜ |
| /admin/penalties | ⬜ | ⬜ | ⬜ |
| /ceo/penalties | ⬜ | ⬜ | ⬜ |

### Per-page checklist
- [ ] No missing key text (raw key showing)
- [ ] No mixed system language
- [ ] No layout break
- [ ] No PHP error
- [ ] No JS console error

## Screenshots
_Pending — browser testing required on production environment_
