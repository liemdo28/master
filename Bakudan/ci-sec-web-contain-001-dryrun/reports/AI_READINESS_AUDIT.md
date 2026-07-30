# AI READINESS AUDIT
**Phase 13.3 — Operational Workflow & Control Validation**
**Generated:** 2026-06-10

---

## PURPOSE

Before building an AI Copilot, verify whether AI will have reliable access to:
- Task status
- Reviewer status
- Approval status
- Verification status
- Financial confirmation status

If AI cannot read these states reliably, its recommendations will be unreliable.

---

## API SURFACE AUDIT — WHAT AI CAN READ TODAY

### API v1 (Bearer Token Auth) — Machine-Readable JSON

| Endpoint | AI-Accessible Data | Status |
|----------|-------------------|--------|
| `GET /api/v1/tasks` | Full task list: status, assignee_id, reviewer_id, approver_id, approval_required, due_date | ✅ |
| `GET /api/v1/tasks/{id}` | Task detail including approval chain state | ✅ |
| `GET /api/v1/me/tasks` | My task queue with statuses | ✅ |
| `GET /api/v1/me/tasks/new` | New unaccepted tasks | ✅ |
| `GET /api/v1/focus` | Compact decision feed: decisions, risk, activity, approvals | ✅ |
| `GET /api/v1/focus/approvals` | All pending approvals requiring action | ✅ |
| `POST /api/v1/focus/approvals/{id}/resolve` | AI can trigger resolution | ✅ |
| `GET /api/v1/dashboard/summary` | Dashboard KPIs | ✅ |
| `GET /api/v1/calendar/day/{date}` | Tasks due on a specific day | ✅ |

### Session-Auth API — Workflow State

| Endpoint | AI-Accessible Data | Status |
|----------|-------------------|--------|
| `GET /api/workflow/my-work` | Current user's pending work items | ✅ |
| `GET /api/workflow/reviewer-queue` | All items awaiting reviewer action | ✅ |
| `GET /api/workflow/approver-queue` | All items awaiting approver action | ✅ |
| `GET /api/workflow/command-center` | Full command center state | ✅ |
| `GET /api/obligations/kpis` | Obligation KPIs: overdue count, awaiting approval, missing evidence | ✅ |
| `GET /api/obligations/widgets/awaiting_approval` | Items blocked at approval stage | ✅ |
| `GET /api/obligations/widgets/missing_evidence` | Items with incomplete evidence | ✅ |
| `GET /api/obligations/widgets/overdue` | Overdue obligations | ✅ |
| `GET /api/penalty/my-summary` | User penalty status | ✅ |
| `GET /api/verification/summary` | Verification status summary | ✅ |
| `GET /api/accounting/verification/summary` | Accounting verification summary | ✅ |

---

## AI DATA ACCESS — STATUS FIELDS AVAILABLE

### Task Status
**STATUS: ✅ FULLY READABLE**

Task status ENUM (readable via API):
```
todo → pending → in_progress → pending_review → review_rejected →
pending_acceptance → acceptance_rejected → accepted → done/completed
```
AI can determine exactly where a task is stuck in the approval chain.

### Reviewer Status
**STATUS: ✅ FULLY READABLE**

From task object:
- `reviewer_id` — who the reviewer is
- `status = 'pending_review'` — task is waiting for reviewer action
- `status = 'review_rejected'` — reviewer rejected, task sent back
- `task_approval_events` — full history of reviewer actions with timestamps

AI can detect: "Task has been in `pending_review` for 3 days — reviewer has not acted."

### Approval Status
**STATUS: ✅ FULLY READABLE**

From task object:
- `approver_id` — who the approver is
- `status = 'pending_acceptance'` — waiting for approver
- `status = 'acceptance_rejected'` — approver rejected
- `status = 'accepted'` — approved and done

From obligation_payments:
- `reviewer_result` — approved/rejected/changes_requested
- `reviewer_result_at` — timestamp
- `approver_result` — approved/rejected/changes_requested
- `approver_result_at` — timestamp

### Verification Status
**STATUS: ✅ FULLY READABLE**

- `GET /api/verification/summary` — `VerificationController::apiSummary()`
- Obligation evidence flags: `evidence_invoice`, `evidence_receipt`, `evidence_bank_proof`, `evidence_payment_confirm`, `evidence_other`
- `GET /api/obligations/widgets/missing_evidence` — AI can identify what's missing

### Financial Confirmation Status
**STATUS: ✅ FULLY READABLE**

- `obligation_payments.status` ENUM: `pending`, `review`, `approved`, `rejected`, `paid`, `skipped`
- `obligation_payments.paid_date`, `paid_amount`, `payment_reference`
- `obligation_payments.approver_result` + `approver_result_at`
- `bills.status` ENUM: `pending`, `paid`, `overdue`, `archived`
- `payments` table: full payment history per bill

---

## AI INFRASTRUCTURE — ALREADY IN PLACE

### OpenAI Integration
- `service/OpenAIService.php` — OpenAI API client already implemented
- `controllers/AiTaskController.php` — AI-powered task import and bill analysis
- `models/AIDecisionSupport.php` — AI decision support model

### AI Router
- `models/AiRouter.php` — Routes AI requests to appropriate handlers

### Telegram AI Tools
- `models/TelegramAiTools.php` — AI tools surfaced through Telegram bot
- `service/TelegramIntentClassifier.php` — NL intent classification already implemented
- `service/NLSearchService.php` — Natural language search over tasks/bills/obligations

### Intelligence Engines
These models expose structured data ideal for AI consumption:
- `models/SmartEngine.php` — Smart recommendations
- `models/PredictionEngine.php` — Predictive analytics
- `models/RecommendationEngine.php` — Action recommendations
- `models/WorkflowEngine.php` — Workflow automation
- `models/ComplianceEngine.php` — Compliance state
- `models/KpiEngine.php` — KPI calculations
- `models/FinanceIntelligenceEngine.php` — Financial intelligence

---

## AI READINESS SCORE

| Capability | Status | Notes |
|------------|--------|-------|
| Read task status | ✅ Ready | Full ENUM + API v1 |
| Read reviewer status | ✅ Ready | reviewer_id + status + events log |
| Read approval status | ✅ Ready | approver_id + status + obligation_payments |
| Read verification status | ✅ Ready | 5-flag evidence system + verification summary API |
| Read financial confirmation | ✅ Ready | payments table + obligation paid status |
| Read penalty state | ✅ Ready | /api/penalty/my-summary |
| Read overdue items | ✅ Ready | Multiple widgets + due date comparison |
| Act on approvals (API) | ✅ Ready | /api/v1/focus/approvals/{id}/resolve |
| NL query support | ✅ Ready | NLSearchService + TelegramIntentClassifier |
| AI infrastructure | ✅ Ready | OpenAIService + AiRouter + AIDecisionSupport |

**Overall AI Readiness: READY for Phase 13 AI Operations Platform**

The platform exposes all required state through JSON APIs. AI recommendations will be grounded in real system data, not estimates.

---

## ONE GAP

| Gap | Impact |
|-----|--------|
| Reviewer/Approver response-time SLA is not tracked | AI cannot proactively alert "reviewer is 24h past expected response time" because there is no `reviewer_deadline` field. AI can detect staleness via event timestamps, but cannot compare against a defined SLA. |

This gap does not block AI from reading current state — it limits predictive/proactive alerting.

---

*Evidence: controllers/api/v1/\*.php, controllers/WorkflowExecutionApiController.php, service/OpenAIService.php, models/AIDecisionSupport.php, models/AiRouter.php, service/NLSearchService.php*
