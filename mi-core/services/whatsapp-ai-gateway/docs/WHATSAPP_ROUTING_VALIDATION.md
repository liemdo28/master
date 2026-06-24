# WhatsApp Routing Validation Report

**Branch:** `feature/agent-mi-command-routing` | **Date:** 2026-06-10 | **Status:** ✅ PASS

## Test Cases

| # | Test | Input | Expected | Result |
|---|---|---|---|---|
| 1 | /mi greeting | `/mi chào em` | Mi replies naturally | ✅ PASS |
| 2 | /mi daily question | `/mi hôm nay anh nên làm gì?` | Mi response from Mi-Core | ✅ PASS |
| 3 | /agent workflow | `/agent show active workflows` | Agent-Coding response | ✅ PASS |
| 4 | /agent QA | `/agent run QA RawWebsite` | Agent-Coding creates/returns QA action | ✅ PASS |
| 5 | /mi summarize | `/mi tóm tắt chat hôm nay` | Mi summarizes chat | ✅ PASS |
| 6 | /mi create task | `/mi tạo task cho Maria từ tin nhắn này` | Task proposal + approval_required=true | ✅ PASS |
| 7 | No-prefix message | `hôm nay thời tiết thế nào?` | No routing, silent drop | ✅ PASS |
| 8 | Invalid API key | Wrong key → route | Rejected with audit log | ✅ PASS |
| 9 | Revoked API key | Revoked key → route | Rejected with KEY_FAILED audit | ✅ PASS |
| 10 | Rate limit exceeded | More than rate_limit/min | Safe error reply | ✅ PASS |

## Security Tests

| Test | Expected | Result |
|---|---|---|
| `/agent` never routes to Mi-Core | Route to Agent-Coding only | ✅ PASS |
| `/mi` never routes to Agent-Coding | Route to Mi-Core only | ✅ PASS |
| No-prefix → no bot trigger | Silent drop | ✅ PASS |
| Raw key never stored | Hash+salt only in DB | ✅ PASS |
| Raw key shown once at creation | Console.log only | ✅ PASS |
| API key redacted in logs | `api_key: ***REDACTED***` | ✅ PASS |
| Revoked key fails validation | status !== 'active' check | ✅ PASS |
| All routes audited | routed_messages record | ✅ PASS |

## Health Endpoints Verified

| Endpoint | Status |
|---|---|
| `GET /api/clients` | ✅ Available |
| `GET /api/clients/:id/health` | ✅ Available |
| `GET /api/router/status` | ✅ Available |
| `GET /api/whatsapp/session` | ✅ Existing |
| `GET /api/whatsapp/groups` | ✅ Available |
| `GET /api/audit/messages` | ✅ Available |