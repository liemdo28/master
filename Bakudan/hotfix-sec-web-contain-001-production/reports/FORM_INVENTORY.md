# FORM INVENTORY REPORT
**Phase 13.3 — Operational Workflow & Control Validation**
**Generated:** 2026-06-10
**Auditor:** Claude Code (automated codebase analysis)

---

## SUMMARY

| Metric | Count |
|--------|-------|
| Total Forms Identified | 22 |
| Active Forms | 18 |
| With Approval Workflow | 12 |
| With Evidence Upload | 9 |
| Store-Assigned | 11 |

---

## SECTION 1 — BILL & PAYMENT FORMS

| # | Name | Route | Database Table | Status | Store Assignment | Required Fields | Evidence Upload | Approval Workflow |
|---|------|-------|---------------|--------|-----------------|-----------------|-----------------|-------------------|
| 1 | Create Bill | `POST /bills/create` | `bills` | Active | YES (per store) | title, store_id, due_date, amount, category | YES (.pdf,.jpg,.png,.docx, 10MB) | NO (direct payment) |
| 2 | Edit Bill | `POST /bills/{id}/update` | `bills` | Active | YES | title, due_date, amount, vendor_id | YES | NO |
| 3 | Record Payment | `POST /bills/{id}/pay` | `bills`, `payments` | Active | YES | amount, payment_date, payment_method | YES (receipt upload) | NO |
| 4 | Bill Template | `POST /bills/templates` | `bills` (is_template=1) | Active | YES | title, repeat_type, store_id, amount | YES | NO |
| 5 | Mark Bill Paid | `POST /bills/{id}/paid` | `bills` | Active | YES | paid_date | YES | NO |

**Source Evidence:**
- `controllers/BillController.php` — `createBill()`, `updateBill()`, `recordPayment()`, `markPaid()`
- `models/Bill.php` — `create()`, `update()`, `markPaid()`
- `database/migrations/2026_03_05_tracking_bills.sql`

---

## SECTION 2 — TASK / WORKFLOW FORMS

| # | Name | Route | Database Table | Status | Store Assignment | Required Fields | Evidence Upload | Approval Workflow |
|---|------|-------|---------------|--------|-----------------|-----------------|-----------------|-------------------|
| 6 | Create Task | `POST /tasks` | `tasks` | Active | Optional (via project) | title, assignee_id, due_date | YES (attachments) | YES (if approval_required=1) |
| 7 | Submit Task for Review | `POST /tasks/{id}/submit` | `tasks`, `task_approval_events` | Active | Inherited | note (optional) | Inherited from task | YES — Stage 1 |
| 8 | Review Approve / Reject | `POST /tasks/{id}/review-approve` | `tasks`, `task_approval_events` | Active | Inherited | note/reason | Inherited from task | YES — Stage 2 |
| 9 | Accept / Reject Task | `POST /tasks/{id}/accept` | `tasks`, `task_approval_events` | Active | Inherited | note/reason | Inherited from task | YES — Stage 3 |
| 10 | Deadline Extension Request | `POST /api/tasks/{id}/extend` | `deadline_extensions` | Active | NO | reason, days | NO | YES (manager approval) |

**Source Evidence:**
- `controllers/TaskApprovalController.php` — full 3-stage flow
- `database/migrations/2026_06_02_task_approval_workflow.sql`
- `database/migrations/deadline_extensions.sql`

---

## SECTION 3 — OBLIGATION / COMPLIANCE FORMS

| # | Name | Route | Database Table | Status | Store Assignment | Required Fields | Evidence Upload | Approval Workflow |
|---|------|-------|---------------|--------|-----------------|-----------------|-----------------|-------------------|
| 11 | Create Obligation | `POST /obligations` | `obligations` | Active | YES (store_id) | name, category_id, frequency, due_day | NO | YES (reviewer + approver) |
| 12 | Record Obligation Payment | `POST /api/obligations/payment/{id}` | `obligation_payments` | Active | Inherited | amount, paid_date, payment_reference | YES (5 evidence flags) | YES (reviewer → approver chain) |
| 13 | Reviewer Result | `POST /api/obligations/review/{id}` | `obligation_payments` | Active | Inherited | result (approved/rejected/changes_requested) | YES | YES — Reviewer Stage |
| 14 | Approver Result | `POST /api/obligations/approve/{id}` | `obligation_payments` | Active | Inherited | result | YES | YES — Approver Stage |

**Source Evidence:**
- `controllers/ObligationController.php` — reviewer/approver queues
- `database/migrations/2026_06_04_obligation_registry.sql`
- `obligation_payments` table: `evidence_invoice`, `evidence_receipt`, `evidence_bank_proof`, `evidence_payment_confirm`, `evidence_other`

---

## SECTION 4 — PAYROLL FORMS

| # | Name | Route | Database Table | Status | Store Assignment | Required Fields | Evidence Upload | Approval Workflow |
|---|------|-------|---------------|--------|-----------------|-----------------|-----------------|-------------------|
| 15 | Create Payroll | `POST /admin/payroll` | `payroll` | Active | YES | period, store_id, employees | NO | YES (approve → pay → verify) |
| 16 | Process Payroll | `POST /admin/payroll/{id}/process` | `payroll` | Active | YES | — | YES | YES |
| 17 | Mark Payroll Paid | `POST /admin/payroll/{id}/mark-paid` | `payroll` | Active | YES | paid_date, amount | YES | YES |

**Source Evidence:**
- `controllers/PayrollController.php` — `create()`, `process()`, `complete()`, `markPaid()`

---

## SECTION 5 — STORE OPERATIONAL FORMS

| # | Name | Route | Database Table | Status | Store Assignment | Required Fields | Evidence Upload | Approval Workflow |
|---|------|-------|---------------|--------|-----------------|-----------------|-----------------|-------------------|
| 18 | Store Opening Checklist | `POST /store/checklist/open` | `opening_checklists` | Active | YES (required) | store_id, shift_date, completed_items[] | NO | YES (verify) |
| 19 | Store Closing Checklist | `POST /store/checklist/close` | `closing_checklists` | Active | YES (required) | store_id, shift_date, completed_items[] | NO | YES (verify) |
| 20 | Incident Report | `POST /admin/incidents` | `incidents` | Active | YES | title, store_id, severity | YES | YES (escalate path) |
| 21 | Deadline Extension | `POST /api/tasks/{id}/extend` | `deadline_extensions` | Active | NO | days, reason | NO | YES (manager approve/reject) |
| 22 | Penalty Configuration | `POST /admin/penalty/add` | `penalty_config` | Active | NO | user_id, amount_per_task | NO | NO (admin-only) |

**Source Evidence:**
- `controllers/StoreChecklistController.php`
- `controllers/IncidentController.php`
- `database/migrations/phase11_store_checklists.sql`

---

## GAPS IDENTIFIED

| Gap | Description | Severity |
|-----|-------------|----------|
| Tax Filing Form | No dedicated multi-step Tax Filing form exists. Tax obligations are tracked via Obligation Registry (category=Tax), but there is no step-by-step: Submit → Verify Submission → Verify Accepted → Verify Money Withdrawn | MEDIUM |
| IRS Work Form | No IRS-specific form. Must use Obligation Registry + generic evidence fields | MEDIUM |
| Vendor Payment Form | Vendor payments handled through Bill workflow, not a standalone Vendor Payment form | LOW |
| Credit Card Bill Form | Bills exist (category=banking/credit), but no dedicated CC bill reconciliation form | LOW |

---

*Report generated from: controllers/BillController.php, controllers/TaskApprovalController.php, controllers/ObligationController.php, controllers/PayrollController.php, controllers/StoreChecklistController.php, database/migrations/\*.sql*
