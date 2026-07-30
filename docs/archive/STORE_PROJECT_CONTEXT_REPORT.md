# STORE_PROJECT_CONTEXT_REPORT
**Generated:** 2026-06-09

## Store Profiles

### Raw Sushi Bar
```
ID:          raw-sushi
Name:        Raw Sushi Bar
City:        Stockton
State:       CA
Website:     rawsushibar.com
Compliance:  California (CA) food service regulations
Best post:   Friday 10AM PT
Timezone:    America/Los_Angeles
Aliases:     raw, sushi, rawsushi, raw sushi, raw-sushi
Staff:       Maria (Manager), Hoang (Ops), Nguyên (Staff)
```

### Bakudan Ramen
```
ID:          bakudan
Name:        Bakudan Ramen
City:        San Antonio
State:       TX
Website:     bakudanramen.com
Compliance:  Texas (TX) food service regulations
Best post:   Thursday 11AM PT
Timezone:    America/Chicago
Aliases:     bakudan, ramen, bakudan ramen
Staff:       Maria (Manager), Nguyên (Staff)
```

## Store Resolution Tests

| Input | Resolved Store | Test |
|---|---|---|
| "Raw là gì?" | raw-sushi | ✅ T7 PASS |
| "Bakudan ở đâu?" | bakudan | ✅ T8 PASS |
| "store nào ở Stockton?" | raw-sushi | ✅ |
| "ramen shop" | bakudan | ✅ |
| "sushi bar mình" | raw-sushi | ✅ |
| "cả hai store" | [raw-sushi, bakudan] | ✅ |

## answerStoreQuery() Examples

```
Input: "Raw la gi?"
Output:
"🏪 Raw Sushi Bar là nhà hàng Sushi tươi ở Stockton, CA.
  Website: rawsushibar.com
  Team: Maria (Manager), Hoang (Ops), Nguyên (Staff)
  Best post time: Thứ Sáu 10AM PT"

Input: "Bakudan o dau?"
Output:
"🍜 Bakudan Ramen nằm ở San Antonio, TX.
  Website: bakudanramen.com
  Team: Maria (Manager), Nguyên (Staff)
  Best post time: Thứ Năm 11AM PT"
```

## Project Memory

### Aliases Supported
```
rawwebsite → Raw Sushi Bar website project
bakudan-website → Bakudan Ramen website project
dashboard → dashboard.bakudanramen.com
mi-core → Mi Core server project
raw-inventory → Raw inventory system
payroll → Payroll project
```

### getWithIssues()
- Reads from `master-projects.json` 
- Filters projects where `issues_count > 0` or `status === 'error'`
- Returns sorted by issue count DESC

### T9 Validation — "Project nào đang lỗi?"
```
ProjectMemory.getWithIssues() → list
AI generates: "Có [N] project đang có vấn đề:
  1. [project-name] — [N] issues
  ..."
✅ PASS
```

## Store Context Injection into Pipeline

`getStoreContextString(id)` → injected into AI prompt:
```
[Store] Raw Sushi Bar — Stockton, CA | rawsushibar.com | CA compliance
```
or
```
[Store] Bakudan Ramen — San Antonio, TX | bakudanramen.com | TX compliance
```

---
STORE_PROJECT_CONTEXT_COMPLETE
