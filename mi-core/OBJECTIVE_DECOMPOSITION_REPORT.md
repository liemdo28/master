# OBJECTIVE DECOMPOSITION REPORT — Phase 20

**Date:** 2026-06-20
**Engine:** objective-decomposer.ts

---

## How Decomposition Works

When CEO sends an objective, the decomposer:

1. **Normalizes** the text (lowercase, trim)
2. **Matches** against known patterns (dashboard audit, service health, default)
3. **Infers departments** from keyword routing map
4. **Generates task tree** with IDs, descriptions, and dependencies
5. **Returns** structured `ObjectiveDecomposition` for the execution engine

## Pattern Matching

### Dashboard Audit Pattern
Trigger: `dashboard` + (`audit` | `check` | `attention`)

| # | Task | Department | Est. Time |
|---|------|-----------|-----------|
| 1 | Investigate dashboard routes and structure | engineering | 5min |
| 2 | Check PM2 process status | infrastructure | 3min |
| 3 | Audit Mi-Core health endpoints | engineering | 5min |
| 4 | Scan for dead code and unused modules | engineering | 8min |
| 5 | Check for failing tests | qa | 10min |
| 6 | Identify missing health checks | engineering | 5min |
| 7 | Configuration audit | engineering | 5min |
| 8 | QA validation of all findings | qa | 5min |
| 9 | Generate executive report | reporting | 3min |

**Total estimated:** 49 minutes
**Departments involved:** 4 (engineering, infrastructure, qa, reporting)

### Service Health Pattern
Trigger: `service` + (`health` | `status`)

| # | Task | Department |
|---|------|-----------|
| 1 | Check PM2 process status | infrastructure |
| 2 | Audit Mi-Core health endpoints | engineering |
| 3 | Configuration audit | engineering |
| 4 | QA validation | qa |
| 5 | Generate health report | reporting |

### Default Pattern (any other objective)

| # | Task | Department |
|---|------|-----------|
| 1 | Investigate: {objective} | engineering |
| 2 | Execute: {objective} | engineering |
| 3 | QA review | qa |
| 4 | Generate report | reporting |

## Keyword Routing Map

The decomposer maintains a 30+ keyword routing table that maps objective text to departments:

```
'dashboard'    → engineering, qa, reporting
'login'        → engineering, qa
'auth'         → engineering, qa
'fix'          → engineering, qa
'pm2'          → infrastructure, engineering
'service'      → infrastructure
'restaurant'   → restaurant-intelligence, reporting
'finance'      → finance, reporting
'connectivity' → infrastructure, finance
'audit'        → engineering, qa, reporting
'brief'        → executive-assistant, reporting
```

## Evidence Generated

Each decomposition produces:
- `decomposition-id` — unique identifier
- `task-count` — number of tasks generated
- `department-list` — departments assigned
- `estimated-total-minutes` — sum of task estimates

## Decomposition Quality

| Metric | Value |
|--------|-------|
| Patterns supported | 3 |
| Keywords mapped | 30+ |
| Departments available | 7 |
| Max tasks per decomposition | 9 |
| Min tasks per decomposition | 4 |

---

*Objective Decomposer — Phase 20*
