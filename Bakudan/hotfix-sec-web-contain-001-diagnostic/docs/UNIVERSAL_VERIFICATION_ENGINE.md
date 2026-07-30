# Universal Verification Workflow Engine

Status: Preview Version

This phase is not production enforcement. It ships the platform architecture, schema draft, service policy, preview dashboard APIs, and preview UI. Completion enforcement is disabled unless `VERIFICATION_ENGINE_ENFORCE=1` is explicitly set.

## Purpose

This is a platform-level workflow engine, not a task feature. It supports:

- Tasks
- Bills
- Payments
- Payroll
- Forms
- Audits
- Checklists

Every record is addressed as `(object_type, object_id)`. The engine must never create task-specific verification tables.

## Status Model

- `open`
- `in_progress`
- `submitted`
- `pending_verification`
- `verification_in_progress`
- `verification_rejected`
- `verified`
- `completed`
- `escalated`
- `cancelled`
- `overdue`

## Completion Rule

If verification is not required, the record may complete directly.

If verification is required, completion is blocked until every verification step is approved. No bypass and no auto-complete are allowed.

For tasks, `TaskCompletionService` now calls `UniversalVerificationEngine::canCompleteRecord('task', $taskId)` before toggling completion. In preview mode it logs a `TASK_COMPLETE_PREVIEW_BLOCK` event but still allows completion. Real blocking only happens when `VERIFICATION_ENGINE_ENFORCE=1`.

## Data Model

Runtime verification records live in:

- `record_verifications`
- `verification_steps`
- `verification_history`
- `verification_comments`
- `verification_evidence`
- `verification_reminders`
- `verification_escalations`

Configuration lives in:

- `verification_templates`
- `verification_rules`

## API Surface

Core service: `service/UniversalVerificationEngine.php`

Important methods:

- `submitForVerification(...)`
- `canCompleteRecord($objectType, $objectId)`
- `approveStep($stepId, $actorId, $comment, $evidenceUrl)`
- `rejectStep($stepId, $actorId, $reason)`
- `buildDashboardMetrics($role)`

## Current Limitation

This phase adds the reusable engine, schema draft, preview-safe completion check, preview UI/API, and QA tests. Full CRUD screens for rule/template management are documented in `reports/VERIFICATION_UI_DESIGN.md` and should be implemented after CEO approval of the preview.
