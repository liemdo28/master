# Task Verification Workflow
**Phase 11.9 — CEO Requirement**
**Date:** 2026-05-30

---

## Current Flow

```
Task → Complete
```

**Problem:** Not sufficient for compliance tasks (tax filings, payments).

---

## New Workflow

```
Task
  ↓ Submitted (assignee marks done)
  ↓ Verified (reviewer confirms submission)
  ↓ Accepted (system/authority confirms receipt)
  ↓ Financial Confirmed (funds withdrawn/deposited)
  ↓ Completed (fully closed)
```

---

## Example: Tax Filing

| Step | Actor | Action | Evidence |
|------|-------|--------|----------|
| 1 | Accountant | Submit tax return | Upload confirmation PDF |
| 2 | GM | Verify submission was made | Review screenshot |
| 3 | IRS/State | Acceptance received | Upload acceptance letter |
| 4 | Bank | Funds withdrawn | Bank statement screenshot |
| 5 | System | Mark complete | All steps verified |

---

## Schema Addition

```sql
ALTER TABLE tasks ADD COLUMN verification_type ENUM('none','simple','multi_step') DEFAULT 'none';
ALTER TABLE tasks ADD COLUMN verification_status ENUM('pending','submitted','verified','accepted','financial_confirmed','completed') DEFAULT NULL;

CREATE TABLE task_verification_steps (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    task_id     INT UNSIGNED NOT NULL,
    step_order  TINYINT NOT NULL,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    status      ENUM('pending','completed','skipped') DEFAULT 'pending',
    completed_by INT UNSIGNED DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,
    evidence_url VARCHAR(500) DEFAULT NULL,
    notes       TEXT,
    INDEX idx_tvs_task (task_id)
);

CREATE TABLE task_verification_log (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    task_id     INT UNSIGNED NOT NULL,
    step_id     INT UNSIGNED DEFAULT NULL,
    user_id     INT UNSIGNED NOT NULL,
    action      VARCHAR(50) NOT NULL,
    notes       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Requirements

- Task Checklist (multi-step verification)
- Task Evidence (file upload per step)
- Multi-user verification (different users per step)
- Approval chain (sequential, cannot skip)
- Audit trail (full log of who did what when)
- Reminder system (notify next verifier when previous step completes)

---

## Implementation Priority

Phase 12 module. Requires UI design for step-by-step verification flow.
