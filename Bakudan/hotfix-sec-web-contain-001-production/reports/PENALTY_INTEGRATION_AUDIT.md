# PENALTY INTEGRATION AUDIT
**Phase 13.3 — Operational Workflow & Control Validation**
**Generated:** 2026-06-10

---

## PENALTY SYSTEM — WHAT EXISTS TODAY

### Database Schema
**Migration:** `database/migrations/2026_04_27_penalty_system.sql` + `2026_05_09_penalty_system.sql`

```sql
-- Per-task penalty tracking columns on tasks table:
tasks.penalty_applied       TINYINT(1)   -- has penalty been applied?
tasks.penalty_amount        DECIMAL(12,2) -- amount of penalty
tasks.penalty_applied_at    DATETIME     -- when penalty was applied

-- Per-user penalty configuration:
penalty_config (
  id, penalty_amount DECIMAL(12,2), currency VARCHAR(10),
  updated_by INT, updated_at DATETIME
)

-- Penalty event log:
penalty_log (
  id, task_id, user_id, penalty_amount DECIMAL(12,2),
  currency, reason VARCHAR(255), created_at DATETIME,
  UNIQUE KEY on task_id  -- prevents duplicate penalties
)
```

### Model Capabilities (`models/Penalty.php`)
| Method | Function |
|--------|----------|
| `addUser($userId, $amount)` | Enroll user in penalty system with per-task amount |
| `updateAmount($userId, $amount)` | Update penalty rate for a user |
| `removeUser($userId)` | Soft-disable (history preserved) |
| `toggleUser($userId)` | Toggle active/inactive |
| `isUserPenalized($userId)` | Check if user has active penalty config |
| `getLateTasks($userId)` | All tasks where `is_completed=0 AND due_date < today` |
| `calculatePenalty($userId)` | Active users: count × amount; inactive: sum from penalty_log |
| `getUserDetail($userId)` | Full breakdown: config + each late task + days overdue + amount |
| `getAllSummaries()` | Admin overview: all penalized users with totals |

### Controller Routes (`controllers/PenaltyController.php`)
| Route | Action |
|-------|--------|
| `GET /admin/penalty` | Admin penalty management dashboard |
| `POST /admin/penalty/add` | Add user to penalty system |
| `POST /admin/penalty/update` | Update penalty amount |
| `POST /admin/penalty/remove` | Remove/disable user |
| `POST /admin/penalty/toggle` | Toggle active/inactive |
| `GET /admin/penalty/{id}` | User penalty detail |
| `GET /api/admin/penalty/summary` | Admin summary API |
| `GET /api/penalty/my-summary` | My own penalty summary (user-facing) |

---

## PENALTY TRIGGERS — CURRENT IMPLEMENTATION

### Trigger 1: Task Overdue
**STATUS: ✅ IMPLEMENTED**

- `Penalty::getLateTasks($userId)` queries: `is_completed=0 AND due_date < today AND assignee_id = $userId`
- Late days calculated: `DATEDIFF(NOW(), due_date) AS late_days`
- Penalty auto-calculated: `late_task_count × amount_per_late_task`
- Source: `models/Penalty.php::getLateTasks()`

### Trigger 2: Overdue Escalation Jobs
**STATUS: ✅ IMPLEMENTED**

- `jobs/SendOverdueEscalationJob.php` — email escalation for overdue tasks
- `jobs/SendOverdueTelegramRemindersJob.php` — Telegram overdue reminders
- Cron endpoints: `POST /api/email/jobs/overdue`, `POST /api/telegram/jobs/overdue`

---

## PENALTY TRIGGERS — GAPS (DO NOT CLAIM COMPLETE)

| Trigger | Required | Status | Gap Description |
|---------|----------|--------|-----------------|
| Task overdue | YES | ✅ Implemented | Based on due_date vs today |
| Verification missed | YES | ⚠️ PARTIAL | No penalty auto-applied when reviewer fails to act by deadline |
| Approval missed | YES | ⚠️ PARTIAL | No penalty auto-applied when approver fails to act by deadline |
| Payment not confirmed | YES | ⚠️ PARTIAL | Obligation missing_evidence widget flags it, but no auto-penalty fires |
| Compliance not completed | YES | ⚠️ PARTIAL | No direct penalty for compliance form not submitted by deadline |

### Gap Analysis

**Gap 1: Reviewer/Approver Inaction Penalty**
The penalty system currently targets **task assignees** (the worker). If a reviewer or approver fails to act within a deadline, no automatic penalty is applied to the reviewer/approver. This would require:
- A new `reviewer_deadline` and `approver_deadline` column on tasks
- A cron job checking `status = 'pending_review' AND submitted_at + X hours < NOW()` → apply penalty to reviewer
- Not yet implemented.

**Gap 2: Compliance Penalty**
Compliance forms (store checklists, tax filings) do not trigger a monetary penalty if missed. They trigger overdue notifications but not a `penalty_log` entry.

**Gap 3: Payment Confirmation Penalty**
If a payment is not confirmed (evidence missing), the system flags it via `widgetMissingEvidence()` but does not auto-penalize the responsible person.

---

## WHAT PENALTY SYSTEM DOES WELL (EVIDENCE)

1. **Per-user configurable penalty amounts** — different staff can have different penalty rates
2. **Historical preservation** — when user is removed from penalty system, penalty_log keeps the history
3. **Real-time calculation** — penalty calculated live from current overdue tasks, not a batch job
4. **Admin transparency** — CEO/Admin sees all penalized users and their breakdown
5. **User self-awareness** — `/api/penalty/my-summary` lets each user see their own exposure

---

## RECOMMENDATION

The penalty system is **foundation-complete** for task overdue penalties. To reach full CEO requirements, the following must be built:
1. Reviewer/approver deadline tracking (separate from task due_date)
2. Automatic penalty trigger when reviewer/approver misses their response deadline
3. Compliance form deadline penalty (checklist not submitted by shift end)
4. Integration with obligation evidence deadline

These are **not claimed as complete** in this audit.

---

*Evidence: models/Penalty.php, controllers/PenaltyController.php, database/migrations/2026_04_27_penalty_system.sql, database/migrations/2026_05_09_penalty_system.sql, jobs/SendOverdueEscalationJob.php*
