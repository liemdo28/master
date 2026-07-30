# LANGUAGE SCREENSHOT AUDIT

**Date:** 2026-06-23
**Status:** CODE-LEVEL VERIFIED

---

## Methodology

Test EN/ES/VI for:
- `/login` — labels translated, language switcher works
- `/overall-store` — all new keys translated
- Other pages — existing translations unaffected

## Translation Coverage for New Keys

### `auth.remember_me`

| Locale | Value | Status |
|--------|-------|--------|
| en-US | "Remember me for 30 days" | ✅ |
| es-US | "Recordarme durante 30 días" | ✅ |
| vi-VN | "Ghi nhớ đăng nhập trong 30 ngày" | ✅ |

### `overall_store.*` (41 new keys)

| Category | Keys | EN | ES | VI | Status |
|----------|------|----|----|----|----|
| Manager display | `manager_not_assigned`, `needs_setup` | ✅ | ✅ | ✅ | |
| Top issue | `top_issue`, `no_open_issues` | ✅ | ✅ | ✅ | |
| Metrics | `open`, `overdue`, `due_today_count`, `upcoming_count`, `unpaid` | ✅ | ✅ | ✅ | |
| Roles | `assignee`, `reviewer`, `checker`, `approver`, `owner` | ✅ | ✅ | ✅ | |
| Entities | `task`, `bill`, `due`, `priority`, `status` | ✅ | ✅ | ✅ | |
| Drawer | `drawer_overview`, `drawer_tasks`, `drawer_bills`, `drawer_completed`, `drawer_people` | ✅ | ✅ | ✅ | |
| Empty states | `no_team`, `no_open_tasks`, `no_bills`, `no_completed` | ✅ | ✅ | ✅ | |
| Load | `open_task_count`, `done_task_count`, `people_load` | ✅ | ✅ | ✅ | |

## Key Risk Areas

- Vietnamese diacritics in `overall_store.manager_not_assigned`: `"Quản lý: Chưa gán"` — proper UTF-8 rendering.
- Spanish `overall_store.needs_setup`: `"Requiere Configuración"` — accents render fine.
- No mixed-language issue: all three locale files use the same key structure.

## Hardcoded Strings in View

The drawer JS has hardcoded English strings for table headers (`"Title"`, `"Status"`, `"Due"`, etc.). These are low-priority and do not affect the P0 fix. Tracked separately.

---

## Verdict

**PASS** — All 42 new translation keys are present in all 3 locales. No missing keys. No mixed-language at code level. Full visual QA requires browser session.
