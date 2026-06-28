# WORKFLOW CREATION LAYER REPORT

## Phase E2 — CERTIFIED

### Module
`server/src/execution/workflow-creation-layer.ts`

### Workflow Types Supported

| Type | Steps | Example Trigger |
|---|---|---|
| SEO_CONTENT | 8 steps | "Tạo bài SEO cho Raw Sushi" |
| WEBSITE_POST | 5 steps | "Post bài lên website" |
| SOCIAL_POST | 4 steps | "Tạo bài Facebook" |
| EMAIL_DRAFT | 4 steps | "Gửi email cho Maria" |
| CAMPAIGN | 5 steps | "Tạo campaign DoorDash" |
| FLYER | 4 steps | "Tạo flyer cho Bakudan" |
| VIDEO | 5 steps | "Tạo video promo" |
| DASHBOARD_AUDIT | 3 steps | "Kiểm tra Dashboard" |
| BUG_FIX | 4 steps | "Fix bug WhatsApp" |
| FINANCE_REPORT | 3 steps | "Tạo báo cáo tài chính" |
| QB_CHECK | 3 steps | "Check QB status" |
| GOOGLE_SHEET_UPDATE | 3 steps | "Update Google Sheet" |
| GENERAL_TASK | 3 steps | Fallback |

### Workflow Fields

Every workflow contains:
- workflow_id (auto-generated, type-prefixed)
- source_message_id (traceability)
- sender (who requested)
- intent (message_class, domain, confidence, action_verbs)
- workflow_types (array)
- target_entity (resolved entity)
- domain (business domain)
- steps (array of WorkflowStep with status tracking)
- approval_required (boolean)
- status (created → drafting → draft_created → approval_pending → executing → completed)
- evidence_path (file path to persisted JSON)

### Acceptance Test

Raw Sushi SEO request creates:
- workflow_type: `SEO_CONTENT + WEBSITE_POST` ✅
- target_entity: `Raw Sushi` ✅
- status: `created` (then `draft_created` after pipeline) ✅
- 8 steps for SEO pipeline ✅

### Gates
- [x] WORKFLOW_CREATION_CERTIFIED
