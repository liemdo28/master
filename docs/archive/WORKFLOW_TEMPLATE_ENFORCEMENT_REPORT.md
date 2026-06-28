# WORKFLOW_TEMPLATE_ENFORCEMENT_REPORT.md
**Date:** 2026-06-17  
**Status:** ✅ WORKFLOW_TEMPLATES_DEFINED

---

## 10 Task Type Templates

Each workflow created by Mi must carry these fields. The COO orchestrator and jarvis-core enforce this schema.

---

### T1 — SEO / Website Post

```json
{
  "task_type": "seo_website_post",
  "required_fields": ["store_entity", "target_url", "draft_content"],
  "source_of_truth": "draft file + CEO approval",
  "evidence_required": ["draft_text", "store_name", "target_page"],
  "approval_required": true,
  "approval_level": 2,
  "execution_steps": ["draft", "ceo_review", "publish"],
  "rollback": "unpublish if CEO rejects within 24h",
  "final_verification": "URL 200 + content visible",
  "ceo_response_template": "Bài [{store}] đã được draft. Anh có muốn duyệt không?"
}
```

### T2 — DoorDash Campaign

```json
{
  "task_type": "doordash_campaign",
  "required_fields": ["store_entity", "campaign_type", "budget", "duration"],
  "source_of_truth": "DoorDash portal API",
  "evidence_required": ["campaign_id", "store_id", "budget_confirmed"],
  "approval_required": true,
  "approval_level": 2,
  "execution_steps": ["create_brief", "ceo_review_budget", "activate_campaign"],
  "rollback": "pause campaign immediately",
  "final_verification": "Campaign status = active in DoorDash",
  "ceo_response_template": "Campaign [{store}] đã tạo. Ngân sách: {budget}. Anh duyệt để kích hoạt."
}
```

### T3 — Toast Report

```json
{
  "task_type": "toast_report",
  "required_fields": ["store_entity", "report_date", "report_type"],
  "source_of_truth": "Toast POS API",
  "evidence_required": ["toast_export_url", "date_range"],
  "approval_required": false,
  "approval_level": 1,
  "execution_steps": ["pull_toast_api", "format_report", "send_to_ceo"],
  "rollback": "N/A — read-only",
  "final_verification": "Report contains order count + revenue",
  "ceo_response_template": "Toast report [{store}] ngày {date}: Doanh thu {revenue}, {orders} đơn."
}
```

### T4 — Google / Yelp Review Pull

```json
{
  "task_type": "review_pull",
  "required_fields": ["store_entity", "platform", "review_count"],
  "source_of_truth": "Google Maps API / Yelp API",
  "evidence_required": ["api_response", "store_place_id"],
  "approval_required": false,
  "approval_level": 1,
  "execution_steps": ["call_review_api", "summarize", "send_to_ceo"],
  "rollback": "N/A — read-only",
  "final_verification": "Review list non-empty + rating included",
  "ceo_response_template": "Review [{platform}] của [{store}]: {count} reviews, {rating}⭐ avg."
}
```

### T5 — Dashboard Query

```json
{
  "task_type": "dashboard_query",
  "required_fields": ["query_scope"],
  "source_of_truth": "dashboard.bakudanramen.com/api/mi/snapshot",
  "evidence_required": ["api_response_ok", "timestamp"],
  "approval_required": false,
  "approval_level": 1,
  "execution_steps": ["call_dashboard_api", "format_summary", "reply"],
  "rollback": "N/A — read-only",
  "final_verification": "Response contains task count + project status",
  "ceo_response_template": "Dashboard: {total_tasks} tasks | {overdue} overdue | {pending_approvals} cần duyệt."
}
```

### T6 — Finance / QB

```json
{
  "task_type": "finance_qb",
  "required_fields": ["store_entity", "period", "report_type"],
  "source_of_truth": "QB API + Accounting DB + Finance Cache",
  "evidence_required": ["qb_sync_status", "period_confirmed"],
  "approval_required": false,
  "approval_level": 1,
  "execution_steps": ["check_qb_sync", "pull_finance_data", "reply"],
  "rollback": "N/A — read-only",
  "final_verification": "Data timestamp < 24h OR flag as STALE",
  "ceo_response_template": "Finance [{store}] {period}: {summary}. Data từ {source_ts}.",
  "fabrication_rule": "NEVER fabricate — if MISSING/STALE say so"
}
```

### T7 — Payroll

```json
{
  "task_type": "payroll",
  "required_fields": ["store_entity", "payroll_period", "staff_count"],
  "source_of_truth": "Payroll system + Gusto/ADP API",
  "evidence_required": ["period_dates", "store_confirmed"],
  "approval_required": true,
  "approval_level": 2,
  "execution_steps": ["pull_payroll_data", "validate", "ceo_review", "process"],
  "rollback": "Cancel before processing cutoff",
  "final_verification": "All staff paid, amounts match approved",
  "ceo_response_template": "Payroll [{store}] {period}: {staff_count} staff, tổng {total}. Anh duyệt để xử lý."
}
```

### T8 — Email / Gmail

```json
{
  "task_type": "email_draft",
  "required_fields": ["recipient", "subject", "body_intent"],
  "source_of_truth": "CEO instruction + prior context",
  "evidence_required": ["recipient_email", "draft_content"],
  "approval_required": true,
  "approval_level": 2,
  "execution_steps": ["draft_email", "ceo_review", "send"],
  "rollback": "Do not send if not approved",
  "final_verification": "Send receipt confirmed",
  "ceo_response_template": "Email cho [{recipient}] đã draft. Chủ đề: {subject}. Anh duyệt để gửi."
}
```

### T9 — WhatsApp / Viber Message

```json
{
  "task_type": "whatsapp_message",
  "required_fields": ["recipient", "message_content", "channel"],
  "source_of_truth": "CEO instruction",
  "evidence_required": ["recipient_number", "message_text"],
  "approval_required": true,
  "approval_level": 2,
  "execution_steps": ["draft_message", "ceo_review", "send_via_gateway"],
  "rollback": "Cancel send if not yet sent",
  "final_verification": "Delivery receipt from gateway",
  "ceo_response_template": "Tin nhắn cho [{recipient}] đã sẵn sàng. Anh duyệt để gửi."
}
```

### T10 — Voice COO Brief

```json
{
  "task_type": "coo_brief",
  "required_fields": ["brief_scope", "stores_included"],
  "source_of_truth": "Dashboard + memory.db + visibility sync",
  "evidence_required": ["data_freshness_check"],
  "approval_required": false,
  "approval_level": 1,
  "execution_steps": ["collect_data", "generate_brief", "send_to_ceo"],
  "rollback": "N/A — read-only",
  "final_verification": "Brief contains all requested scopes",
  "ceo_response_template": "COO Brief: {summary_line}. Đầy đủ: {full_brief}."
}
```

---

## Enforcement Mechanism

All workflows created by `coo-orchestrator` and `gstack/work-order-engine` validate:
1. `task_type` must be one of T1–T10
2. `store_entity` required for store-specific tasks
3. `approval_required=true` tasks blocked until CEO approves
4. `fabrication_rule` enforced: MISSING source → not fabricated

---

## Verdict

```
10/10 task types defined with complete templates
All approval requirements enforced by gate.ts Level 1/2/3
Fabrication blocked: finance_truth layer returns STALE/MISSING state
WORKFLOW_TEMPLATES_DEFINED — 2026-06-17
```
