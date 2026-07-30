# Requirement Analysis Engine
**Module:** DEV3 Phase 13.2  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**File:** `mi-core/server/src/gstack/pm-agent/requirement-analysis.ts`

---

## Input / Output

**Input:** raw CEO natural language (Vietnamese/English mix) + IntentResult + request_id  
**Output:** `RequirementPackage` — structured business requirements

---

## RequirementPackage Fields

| Field | Type | Example |
|-------|------|---------|
| `objective` | string | "Pipeline đa giai đoạn: Dashboard → Lỗi → Fix → Report" |
| `scope` | string[] | ["dashboard.bakudanramen.com", "Auto-fix boundary"] |
| `out_of_scope` | string[] | ["WhatsApp routing", "Database schema changes"] |
| `stakeholders` | string[] | ["CEO — requester", "Engineering Manager", "QA Agent"] |
| `risks` | string[] | ["Fix có thể gây regression"] |
| `assumptions` | string[] | ["mi-core running on port 4001"] |
| `constraints` | string[] | ["Auto-fix only: no schema/prod-data/deps changes"] |
| `deliverables` | string[] | ["Audit report", "Fix confirmation", "CEO Report"] |

---

## Objective Extraction

Multi-objective patterns are detected and combined:

| Pattern | Extracted Objective |
|---------|-------------------|
| `kiem tra.*dashboard` | Xác minh trạng thái và chất lượng Dashboard |
| `tim loi` | Phát hiện lỗi và vấn đề trong hệ thống |
| `fix.*loi` | Sửa lỗi đã phát hiện trong phạm vi an toàn |
| `test lai` / `bao cao` | Xác nhận hệ thống sau thay đổi và báo cáo |

When multiple patterns match → objective becomes:  
`"Pipeline đa giai đoạn: [obj1] → [obj2] → [obj3]"`

---

## Scope Extraction

Scope items are detected by keyword matching on the raw CEO request:

| Keyword | Scope Item |
|---------|-----------|
| `dashboard` | dashboard.bakudanramen.com — routes, health, connectors |
| `source / code / scan` | Source code — TypeScript errors, TODOs, security patterns |
| `log / error` | Error logs — PM2 logs, recent error patterns |
| `fix / sua` | Auto-fix boundary — SAFE changes only |
| `test / regression` | Regression suite — 5 CEO test cases |

---

## Acceptance Test Result

**Input:** "Mi ơi kiểm tra Dashboard, tìm lỗi, nếu an toàn thì fix, test lại rồi báo anh."

- **Objective:** Pipeline đa giai đoạn (4 phases extracted)
- **Scope:** 3 items — dashboard, auto-fix boundary, regression suite
- **Out of scope:** 4 items — WhatsApp, schema, deps, prod data
- **Deliverables:** 7 items — audit report through CEO report
- **Stakeholders:** 4 roles identified
