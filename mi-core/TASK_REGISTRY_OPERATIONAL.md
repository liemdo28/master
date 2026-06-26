# TASK_REGISTRY_OPERATIONAL.md
**Status:** OPERATIONAL | **Phase:** 0C | **Engine:** `src/executive-coordination/task-registry.ts`

## Schema
Task with fields: id, objectiveId, title, description, source, division, owner, assignee, status, priority, severity, dueDate, createdAt, updatedAt, startedAt, completedAt, blockedReason, dependencyIds, duplicateOf, conflictWith, evidenceIds, approvalId, executionLog, resultSummary, evidenceRequired, approvalRequired.

## Task ID Prefixes
ENG=Engineering, OPS=Computer Operator, FIN=Finance, MKT=Marketing, IT=IT Operations, CRT=Creative, EXE=Executive, REV=Review, SEO=SEO, QB=QuickBooks, DD=DoorDash

## Status Values
NEW → TRIAGED → ASSIGNED → IN_PROGRESS → WAITING_APPROVAL / WAITING_DEPENDENCY → DONE / FAILED / CANCELLED

## API Proof
POST/GET /api/coordination/tasks | GET /api/coordination/tasks/:id | PATCH /api/coordination/tasks/:id | POST /api/coordination/tasks/:id/assign | POST /api/coordination/tasks/:id/block | POST /api/coordination/tasks/:id/complete

## State Machine Rules
- Cannot move to IN_PROGRESS without owner
- Cannot move to DONE without evidence if evidence_required=true
- Cannot block without blocked_reason
- Execution log records every transition

## Certification Test
POST 3 tasks: MKT(SEO), ENG(code change), FIN(revenue validation) → all stored centrally, all linked to objective, all have owners, no orphans.
