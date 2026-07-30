# Language QA — Mobile

**Date:** 2026-06-22
**Status:** CODE VERIFIED — PENDING BROWSER VERIFICATION

## Code Verification

### Mobile bottom nav (views/layouts/main.php)
- Bottom nav uses `t('nav.overview')`, `t('nav.my_tasks')`, `t('nav.calendar')`, `t('nav.inbox')` — all translatable ✅
- Language switcher visible in header on mobile ✅
- CSS responsive rules for lang-switcher present ✅

### Translation file sizes (no overflow risk)
- en-US.php: ~40KB — no long strings
- es-US.php: ~40KB — Spanish labels are within normal length
- vi-VN.php: ~44KB — Vietnamese with diacritics

### Mobile-specific checks (code-level)
- [x] Bottom nav labels use t() calls
- [x] Header lang-switcher renders on mobile
- [x] No hardcoded English in mobile nav section
- [x] PWA manifest references lang/ files

## Browser Testing Matrix

| Page | iPhone Safari | Android Chrome | iPad Safari |
|------|--------------|----------------|-------------|
| /login | ⬜ | ⬜ | ⬜ |
| /overview | ⬜ | ⬜ | ⬜ |
| /my-tasks | ⬜ | ⬜ | ⬜ |
| /bills | ⬜ | ⬜ | ⬜ |
| /admin/stores | ⬜ | ⬜ | ⬜ |
| /calendar | ⬜ | ⬜ | ⬜ |
| /inbox | ⬜ | ⬜ | ⬜ |

### Per-page checklist
- [ ] No horizontal overflow from long Spanish strings
- [ ] Vietnamese accents render correctly
- [ ] Mobile bottom nav translated
- [ ] Drawers translated
- [ ] No console error
- [ ] No internal error

## Screenshots
_Pending — browser testing required on physical devices_
