# AUTONOMOUS_EXECUTION_ENGINE — Phase 20
**Target:** AUTONOMOUS_READY ✅

## What It Does
Classifies every task into an autonomy level before Mi acts.
Prevents unsafe automation; logs everything for CEO visibility.

## Autonomy Levels

| Level | Meaning | Examples |
|-------|---------|---------|
| `FULL_AUTO` | Mi executes immediately, no notification | health_monitoring, log_analysis, audit_read, qa_regression, documentation, reporting, knowledge_search, memory_sync, graph_refresh |
| `NOTIFY_AFTER` | Mi executes, notifies CEO after | auto_fix_safe, skill_execution, certification |
| `REQUIRES_APPROVAL` | Mi pauses, asks CEO | Default for unknown task types |
| `BLOCKED` | Mi refuses, explains why | production_deploy, data_delete, payment, credential_change, customer_reply, db_mutation |

## Classification Logic
```typescript
classifyAutonomy({ task_type: string, description: string }): AutonomyDecision
```
1. Check BLOCKED_PATTERNS first — hard stop on dangerous categories
2. Check FULL_AUTO_PATTERNS — pre-approved safe operations
3. Check NOTIFY_AFTER_PATTERNS — execute then inform
4. Default → REQUIRES_APPROVAL

## Pre-Scheduled Autonomous Tasks (6)
Tasks Mi runs on its own clock without CEO prompt:
1. Daily briefing assembly (06:55)
2. Graph refresh (02:00)
3. Memory sync (03:00)
4. QA regression scan (04:00)
5. Log analysis (05:00)
6. Health monitoring (every 15 min)

## API Routes
```
GET  /api/autonomous/tasks       — list all scheduled autonomous tasks
POST /api/autonomous/classify    — classify a task type
GET  /api/autonomous/boundary    — full boundary definition (safe vs blocked)
```
