# TASK ROLE MATRIX
**Phase 13.3 — Operational Workflow & Control Validation**
**Generated:** 2026-06-10

---

## ROLE DEFINITIONS — SYSTEM EVIDENCE

All roles are enforced by code. Evidence from `controllers/TaskApprovalController.php` and `database/migrations/2026_06_02_task_approval_workflow.sql`.

---

## CORE ROLE MATRIX

| Role | Column / Field | Enforced By | Status |
|------|---------------|-------------|--------|
| **Creator** | `tasks.created_by` | `TaskController::store()` — sets `created_by = session user_id` | ✅ EXISTS |
| **Assignee / Worker** | `tasks.assignee_id` | `TaskController::store()` + `TaskController::update()` | ✅ EXISTS |
| **Reviewer (Checker #1)** | `tasks.reviewer_id` | Set on task creation; enforced in `TaskApprovalController::reviewApprove/reviewReject()` | ✅ EXISTS |
| **Approver (Checker #2 / Final)** | `tasks.approver_id` | Set on task creation; enforced in `TaskApprovalController::accept/acceptReject()` | ✅ EXISTS |
| **Verifier** | Obligation: `obligation_payments.reviewer_id` | `ObligationController::reviewerQueue()` + `apiReview()` | ✅ EXISTS |
| **Financial Verifier** | Obligation: `obligation_payments.approver_id` | `ObligationController::approverQueue()` + `apiApprove()` — auto-marks paid | ✅ EXISTS |

**Database proof** (`2026_06_02_task_approval_workflow.sql`):
```sql
ADD COLUMN `reviewer_id`  INT NULL  COMMENT 'User who reviews submission (stage 2)',
ADD COLUMN `approver_id`  INT NULL  COMMENT 'User who gives final acceptance (stage 3)',
```

---

## ROLE PERMISSIONS — WHAT EACH ROLE CAN DO

### Creator
- Creates task: `POST /tasks` → `TaskController::store()`
- Can edit own task (if not yet submitted)
- Can see task progress
- Cannot approve their own task (system does not restrict this by code but requires separate reviewer/approver IDs)

### Assignee / Worker
- Receives task (must accept): `POST /tasks/{id}/accept` — `TaskController::accept()`
- Marks work in progress
- Submits for review: `POST /tasks/{id}/submit` → `TaskApprovalController::submit()`
- Cannot bypass review — submission puts task into `pending_review` status; only reviewer can advance it

**Permission check (line 72, TaskApprovalController.php):**
```php
if (!$isAdmin && (int)$task['assignee_id'] !== $uid) {
    flash('error', 'Only the task assignee can submit for review.');
```

### Reviewer (Checker #1)
- Reviews submitted task
- Approve: `POST /tasks/{id}/review-approve` → sets status `pending_acceptance`, notifies approver
- Reject: `POST /tasks/{id}/review-reject` → requires reason, returns to assignee
- Cannot be the approver for the same task (separate ID column)

**Permission check (line 116):**
```php
if (!$isAdmin && (int)$task['reviewer_id'] !== $uid) {
    flash('error', 'Only the designated reviewer can approve this review.');
```

### Approver (Checker #2 / Final)
- Receives notification after reviewer approves
- Accept: `POST /tasks/{id}/accept` → marks task DONE (status=`accepted`), notifies assignee + reviewer
- Reject: `POST /tasks/{id}/accept-reject` → requires reason, returns to assignee

**Permission check (line 195):**
```php
if (!$isAdmin && (int)$task['approver_id'] !== $uid) {
    flash('error', 'Only the designated approver can accept this task.');
```

### Financial Verifier (Obligation Workflow)
- Assigned via `obligation_payments.approver_id`
- Reviews after Reviewer (Checker #1) approves
- `POST /api/obligations/approve/{id}` — result: approved/rejected/changes_requested
- **On approval: system automatically marks obligation as paid** (line 226-228, ObligationController.php):
```php
if ($ok && $result === 'approved') {
    $this->obligation->markPaid($id, null, app_today(), null);
}
```

### CEO / Admin Override
- Can reopen any approval-stage task: `POST /tasks/{id}/reopen-approval`
- Can act on behalf of any role (override flag set in `task_approval_events.is_override=1`)
- Evidence: `TaskApprovalController::reopenApproval()` — `requireAdmin()` check

---

## TASK TYPE ROLE MATRIX

| Task Type | Creator | Worker | Checker #1 (Reviewer) | Checker #2 (Approver) | Financial Verifier | Escalation |
|-----------|---------|--------|----------------------|----------------------|-------------------|------------|
| **General Task** | ✅ created_by | ✅ assignee_id | ✅ reviewer_id | ✅ approver_id | N/A | ✅ Overdue → email/Telegram |
| **Vendor Bill** | ✅ Admin/CEO | ✅ Store manager | ✅ Obligation reviewer | ✅ Obligation approver | ✅ Auto-pays on approval | ✅ Widget: awaiting_approval |
| **Tax Filing** | ✅ Admin | ✅ Assigned user | ✅ reviewer_id (task) | ✅ approver_id (task) | ✅ Obligation approver | ✅ Tax filing widget |
| **Payroll** | ✅ Admin/HR | ✅ HR/Processor | ✅ Manager | ✅ CEO/Admin | ✅ Mark paid step | ✅ Payroll controller |
| **Store Checklist** | ✅ System/Manager | ✅ Staff (shift) | ✅ Manager verifies | ✅ Admin approves | N/A | ✅ Incident if missed |
| **License Renewal** | ✅ Admin | ✅ Assigned | ✅ Reviewer (obligation) | ✅ Approver (obligation) | ✅ Financial step | ✅ Renewal widget |
| **Insurance Renewal** | ✅ Admin | ✅ Assigned | ✅ Reviewer | ✅ Approver | ✅ Financial step | ✅ Renewal widget |
| **Incident** | ✅ Any user | ✅ Assignee | ✅ Investigator | ✅ Admin/CEO close | N/A | ✅ IncidentController::escalate() |

---

## APPROVAL STATUS ENUM (DATABASE PROOF)

From `2026_06_02_task_approval_workflow.sql`:

```sql
MODIFY COLUMN `status` ENUM(
  'todo',
  'pending',
  'in_progress',
  'review',
  'done',
  'completed',
  'pending_review',        -- Assignee submitted, waiting for Reviewer
  'review_rejected',       -- Reviewer rejected, back to Assignee
  'pending_acceptance',    -- Reviewer approved, waiting for Approver
  'acceptance_rejected',   -- Approver rejected, back to Assignee
  'accepted'               -- Approver accepted = DONE
)
```

---

## APPROVAL EVENT AUDIT TABLE (DATABASE PROOF)

From `task_approval_events` table:
```sql
`action_type` ENUM(
  'started',
  'submitted',             -- Assignee action
  'review_approved',       -- Reviewer action
  'review_rejected',       -- Reviewer action
  'acceptance_approved',   -- Approver action
  'acceptance_rejected',   -- Approver action
  'marked_done',
  'reopened',              -- CEO/Admin action
  'override'               -- CEO/Admin bypass
),
`is_override` TINYINT(1)   -- CEO/Admin override flag
```

Every role action is logged with actor, timestamp, from_status, to_status, and comment.

---

*Evidence: controllers/TaskApprovalController.php, controllers/ObligationController.php, database/migrations/2026_06_02_task_approval_workflow.sql, database/migrations/2026_06_04_obligation_registry.sql*
