# EXECUTIVE MEMORY LAYER — Phase 21E

## Purpose
Maintain long-term company context that survives reboot and session restart.

## Persistence
All data stored as JSON files in `.local-agent-global/executive-intelligence-memory/`:
- `incidents.json` — active and historical incidents
- `recurring_failures.json` — patterns that repeat
- `ceo_priorities.json` — CEO's current focus areas
- `business_goals.json` — targets and progress
- `operational_risks.json` — identified risks and mitigations
- `department_scores.json` — department performance over time
- `reasoning_history.json` — what Mi decided and why
- `context_snapshots.json` — periodic company state snapshots

## Data Types

### Incidents
- Severity: critical / high / medium / low
- Track: affected systems, root cause, resolution
- Status: active → resolved

### Recurring Failures
- Pattern detection: same failure repeating
- Occurrence counter
- Resolution history tracking
- Status: active → monitoring → resolved

### CEO Priorities
- Priority with category and urgency
- Auto-defers previous priorities in same category
- Status: active → completed / deferred

### Business Goals
- Target date and progress (0-100%)
- Status tracking: on_track / at_risk / behind / completed

### Operational Risks
- Probability × Impact matrix
- Mitigation tracking
- Status: open → mitigated / accepted / closed

### Department Scores
- Score 0-100 per department
- Trend detection: improving / stable / declining

### Context Snapshots
- Periodic full-state captures
- Overall status: healthy / warning / critical

## API
Full CRUD operations for all data types. API available via `executiveIntelligenceMemory` object.

## Files
- `server/src/executive-intelligence/executive-memory-layer.ts`

## Status: IMPLEMENTED ✅
