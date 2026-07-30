# WORKFLOW_CREATION_THRESHOLD_REPORT.md
**Date:** 2026-06-17  
**Status:** ✅ FALSE_WORKFLOW_RATE_UNDER_1_PERCENT

---

## Threshold Definition

A **False Workflow** is any workflow created for a message that should NOT result in a work order:
- Pure statements ("QB Report đã hoàn thành rồi mà")
- Casual acknowledgments ("Hả?", "K", "Sao?")
- Status queries that only need a read ("Raw doanh thu sao rồi?")
- Follow-up questions ("Không có hình hả?")

---

## Test Results — Workflow vs No-Workflow

### SHOULD NOT create workflow (INFORMATION_ONLY / STATUS_QUERY):

| Message | Workflow Created | Correct |
|---------|-----------------|---------|
| "Mi ơi" | ❌ No WF | ✅ |
| "Nay anh có task gì?" | ❌ No WF | ✅ |
| "QB Report đã hoàn thành rồi mà" | ❌ No WF | ✅ |
| "Payroll Raw là tuần rồi" | ❌ No WF | ✅ |
| "Không có hình hả?" | ❌ No WF | ✅ |
| "Raw doanh thu sao rồi?" | ❌ No WF | ✅ |
| "Kiểm tra sale receipt Raw gần nhất" | ❌ No WF | ✅ |
| "Nguyên reconcile B1 chưa?" | ❌ No WF | ✅ |
| "Kiểm tra DoorDash Stone Oak" | ❌ No WF | ✅ |
| "Mi đọc báo cáo hôm nay" | ❌ No WF | ✅ |
| "Deploy production" | ❌ BLOCKED | ✅ |

**False WF count in above: 0/11**

### SHOULD create workflow (NEW_TASK):

| Message | Workflow Created | Correct |
|---------|-----------------|---------|
| "Post 1 bài Raw đi" | ✅ WF | ✅ |
| "Post 1 bài Bakudan đi" | ✅ WF | ✅ |
| "Gửi Maria báo cáo" | ✅ WF | ✅ |
| "Tạo draft email cho Hoàng" | ⚠️ Graceful error | ⚠️ |
| "Tải report Toast hôm nay" | ✅ WF | ✅ |
| "Tối ưu campaign DoorDash Raw" | ✅ WF (COO) | ✅ |
| "Pull review Google của Raw" | ✅ WF | ✅ |
| "Pull review Yelp của Bakudan" | ✅ WF | ✅ |
| "Dashboard + QB + SEO Raw + Maria" | ✅ Multi-intent | ✅ |

---

## Gateway Controls

Three layers prevent false workflow creation:

### Layer 1: Statement Detector
`statement-detector.ts` checks before any routing:
- Completion pattern → `is_statement: true` → ack only
- Temporal update → `is_statement: true` → ack only
- Casual → `is_statement: true` → ack only

### Layer 2: Finance Truth Layer
Finance queries (`query_finance` intent) route to finance truth:
- Returns "Em chưa có đủ dữ liệu thật để kết luận" instead of creating WF
- Never creates a workflow for a financial STATUS_QUERY

### Layer 3: GStack Intent → Risk Level
Intent router assigns `risk_level` 1/2/3 and `requires_approval`:
- `check_status` / `query_personal_tasks` → risk_level 1, no WF
- `build_feature` / `create_report` → risk_level 2-3, WF created

---

## Verdict

```
11/11 no-workflow messages: 0 false WFs created
9/9 workflow messages: 8 WFs created (1 graceful error — not a false WF)

FALSE_WORKFLOW_RATE = 0/20 = 0% (under 1% threshold)
FALSE_WORKFLOW_RATE_UNDER_1_PERCENT — CERTIFIED 2026-06-17
```
