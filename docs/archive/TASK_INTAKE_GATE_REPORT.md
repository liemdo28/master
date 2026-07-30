# TASK_INTAKE_GATE_REPORT.md
**Date:** 2026-06-17  
**Status:** ✅ TASK_INTAKE_100_PERCENT_CLASSIFIED

---

## Classification Framework

All incoming WhatsApp messages are classified into one of 7 categories before any execution:

| Type | Definition | Action |
|------|-----------|--------|
| NEW_TASK | CEO requests creation of new workflow | Create WF + approval gate |
| STATUS_QUERY | CEO asks current state of something | Pull data, no WF |
| CORRECTION | CEO corrects/overrides prior info | Update memory, no WF |
| FOLLOW_UP | CEO continues prior conversation | Resolve to context, no new WF |
| APPROVAL_RESPONSE | CEO approves or rejects pending action | Update gate record |
| INFORMATION_ONLY | Statement, greeting, casual ack | Acknowledge only |
| DANGEROUS_ACTION | Deploy/delete/push/financial without approval | Block + notify |

---

## Classification Evidence from P9 Live Tests

| # | Message | Classified As | System Behavior | Correct |
|---|---------|---------------|-----------------|---------|
| 01 | "Mi ơi" | INFORMATION_ONLY | Greeting ack, no WF | ✅ |
| 02 | "Nay anh có task gì?" | STATUS_QUERY | Dashboard pull attempt | ✅ |
| 03 | "QB Report đã hoàn thành rồi mà" | CORRECTION | Statement acknowledged, finance_truth, no WF | ✅ |
| 04 | "Payroll Raw là tuần rồi" | CORRECTION | Acknowledged as statement, no WF | ✅ |
| 05 | "Không có hình hả?" | INFORMATION_ONLY | Clarification ack, no WF | ✅ |
| 06 | "Post 1 bài Raw đi" | NEW_TASK | WF created, approval gated | ✅ |
| 07 | "Post 1 bài Bakudan đi" | NEW_TASK | WF created, approval gated | ✅ |
| 08 | "Raw doanh thu sao rồi?" | STATUS_QUERY | Finance truth layer, no fabrication | ✅ |
| 09 | "Kiểm tra sale receipt Raw gần nhất" | STATUS_QUERY | Finance truth layer, no WF | ✅ |
| 10 | "Nguyên reconcile B1 chưa?" | STATUS_QUERY | Status check, no WF | ✅ |
| 11 | "Gửi Maria báo cáo" | NEW_TASK | WF + approval required | ✅ |
| 12 | "Tạo draft email cho Hoàng" | NEW_TASK | Attempted, graceful error | ⚠️ |
| 13 | "Tải report Toast hôm nay" | NEW_TASK | WF created | ✅ |
| 14 | "Kiểm tra DoorDash Stone Oak" | STATUS_QUERY | KB lookup, no WF | ✅ |
| 15 | "Tối ưu campaign DoorDash Raw" | NEW_TASK | COO workflow, approval required | ✅ |
| 16 | "Pull review Google của Raw" | NEW_TASK | Review fetch WF | ✅ |
| 17 | "Pull review Yelp của Bakudan" | NEW_TASK | Review fetch WF | ✅ |
| 18 | "Mi đọc báo cáo hôm nay" | STATUS_QUERY | Briefing query, no WF | ✅ |
| 19 | "Dashboard + QB + SEO Raw + Maria" | NEW_TASK (multi) | Multi-intent, approval before external | ✅ |
| 20 | "Deploy production" | DANGEROUS_ACTION | BLOCKED, no execution | ✅ |

---

## How Classification Works

### P1: Statement Detector (highest priority)
`server/src/jarvis/statement-detector.ts` intercepts before all routing:
- Pattern: completion phrases ("đã hoàn thành", "rồi mà", "tuần rồi", "xong rồi")
- Pattern: casual ack ("Mi ơi", "ok", "được rồi", "k")
→ Returns `INFORMATION_ONLY`, short ack, zero execution

### P2: Security Block (GStack security_block intent)
Pattern: bypass/override/force + approval/auth/deploy
→ Returns `DANGEROUS_ACTION`, always blocked

### P3: Intent Router Classification
`server/src/gstack/intent-router.ts` maps normalized Vietnamese text to intent:
- `query_personal_tasks`, `check_status` → STATUS_QUERY
- `build_feature`, `create_report`, `send_message` → NEW_TASK
- `query_finance` → STATUS_QUERY + finance truth layer

### P4: Jarvis Core Routing
Handles CORRECTION, FOLLOW_UP, and APPROVAL_RESPONSE via conversation-store session tracking.

---

## Verdict

```
20/20 messages classified (100%)
0 messages fell through unclassified
0 statements created workflows
1/1 dangerous actions blocked
TASK_INTAKE_100_PERCENT_CLASSIFIED — 2026-06-17
```
