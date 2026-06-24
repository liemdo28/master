# CEO Language Coverage Report
**Date:** 2026-06-15
**Phase:** DEV3 CEO_READY_V3 Closeout — D2
**Result:** CEO_LANGUAGE_READY

---

## Coverage Summary

```
92 CEO phrases tested (stress test D6)
92/92 PASS
Coverage: 100%
Target: ≥95%
```

---

## Language Patterns Supported

### Stores — all 6 stores with aliases

| Store | Patterns | Example |
|-------|----------|---------|
| Raw Sushi | `raw`, `raw sushi`, `rawsushi` | "raw sao roi" |
| Bakudan Ramen | `bakudan`, `ramen`, `bakudan ramen` | "bakudan sao roi" |
| Stockton | `stockton` | "stockton sao roi" |
| Stone Oak | `stone oak`, `stone oaks`, `stoneoaks` | "stone oak sao roi" |
| Rim | `rim` | "rim the nao" |
| Bandera | `bandera` | "bandera sao roi" |

### People — all named recipients

| Person | Patterns | Example |
|--------|----------|---------|
| Maria | `maria` | "gui maria", "nhan maria", "mail maria" |
| Hoang | `hoang` | "gui hoang", "nhan hoang bao cao" |
| Nguyen | `nguyen` | "gui nguyen ket qua" |
| Anh (boss/self) | `anh` | "bao anh ket qua" |
| Boss | `boss` | "gui boss bao cao" |
| Team | `team` | "gui team bao cao" |
| Manager | `manager` | "gui manager update" |

### Actions — full alias map

| Action | Patterns | Intent |
|--------|----------|--------|
| Send message | `gui`, `send`, `mail`, `nhan`, `nhan tin`, `email` + [recipient] | `send_message` |
| View/check | `coi`, `xem`, `kiem tra`, `check`, `coi gium`, `kiem tra gium` | `check_status` / `audit_project` |
| Audit | `audit`, `kiem tra`, `review`, `scan` + [project/system] | `audit_project` |
| Finance | `doanh thu`, `revenue`, `bao nhieu` + [time/store] | `query_finance` |
| Build | `tao`, `viet`, `lam`, `create`, `generate` + [content] | `build_feature` |
| Deploy | `deploy`, `len production`, `phat hanh` | `deploy_release` |
| Fix | `fix`, `sua`, `debug` + [loi/bug] | `fix_bug` |

---

## Action Alias Coverage

### "coi" family
```
coi giùm anh     → check_status ✅
coi qb           → check_status ✅
coi qb đi        → check_status ✅
coi raw          → check_status ✅
coi bakudan      → check_status ✅
coi stockton     → check_status ✅
coi stone oak    → check_status ✅
coi rim          → check_status ✅
coi bandera      → check_status ✅
xem qb           → check_status ✅
xem raw          → check_status ✅
kiem tra gium    → check_status ✅
```

### "gửi" family
```
gui maria        → send_message ✅
gui anh ket qua  → send_message ✅
gui boss bao cao → send_message ✅
gui team bao cao → send_message ✅
gui nguyen ket qua → send_message ✅
nhan maria       → send_message ✅
nhan hoang bao cao → send_message ✅
mail maria       → send_message ✅
mail anh ket qua → send_message ✅
email maria bao cao → send_message ✅
```

### "báo anh" — report suffix (multi-intent splitter)
```
"roi bao anh"         → report suffix, depends_on ALL
"roi bao anh ket qua" → report suffix, depends_on ALL
"roi gui maria"       → extracted as last sub-intent
```

---

## Edge Cases Handled

| Phrase | Notes |
|--------|-------|
| "audit toàn bộ hệ thống" | `audit + toan bo he thong` → `audit_project` |
| "audit Dashboard và cho anh biết vấn đề" | `audit + dashboard` → `audit_project` (priority over `cho anh`) |
| "raw sao rồi" | `raw + sao roi` → `check_status` (not finance — no `doanh thu`) |
| "raw sushi doanh thu sao rồi" | `raw sushi + doanh thu` → `query_finance` |
| "qb invoice tháng này" | `qb + invoice` → `query_finance` |
| "kiem tra mi-core" | `kiem tra + mi-core` → `audit_project` |
| "xem kế toán tháng này" | `ke toan` → `query_finance` |
| "gui boss bao cao" | `gui + boss` → `send_message` (not create_report) |

---

## Certification

- ALL_6_STORES_COVERED: ✅
- ALL_PEOPLE_ALIASES_COVERED: ✅
- COI_FAMILY_COVERED: ✅
- GUI_FAMILY_COVERED: ✅
- FINANCE_PHRASES_COVERED: ✅
- COMPOUND_PHRASES_COVERED: ✅
- INTENT_COVERAGE_100PCT: ✅
- **CEO_LANGUAGE_READY: ✅**
