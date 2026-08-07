# Phase 5D-3 — acceptance evidence

## Fixture-day acceptance (§22)

`server/src/personal-os/operating/phase5d3-acceptance.ts`
(`npm run phase5d3:acceptance`) drives a single deterministic fixture day (2 meetings, 1
deadline due that day, 3 active goals, 6 tasks spanning completed/failed/blocked/2×
waiting-approval/ready, 1 stale document, 1 knowledge conflict, 1 degraded second
project, real SelfHeal service-health probes, 2 email follow-ups) through the full
morning -> plan -> midday -> evening -> restart lifecycle.

Result: **30/30 checks pass**, deterministically (rerun twice with identical outcomes).
Covers: brief correctness (meeting/deadline/goal/approval/conflict/project-health/
service-health counts and bounds), plan correctness (DRAFT status, ≤10 tasks, BLOCKED/
WAITING_APPROVAL exclusion, FIXED/FLEXIBLE/OPTIONAL separation), midday refresh
(detecting a real task completion and a real meeting cancellation, idempotent on re-call),
evening review (Task Runtime–evidenced completion, failed task never self-awarded,
idempotent on re-call), and restart persistence (brief/plan survive a fresh store
reopen; no task was ever auto-executed across the whole run).

## Real operating-day acceptance (§23)

`server/src/personal-os/operating/real-day-acceptance.ts` ran read-only against the
actual live Mi production state: a consistent SQLite online-backup copy of the three live
databases (personal-os, task-runtime, project-registry) was taken into a disposable
directory (live files opened `readonly`), migrated to v6 there, and the
`DailyOperatingLoop` was run against that copy using the real, read-only Google token.

```
Google connector status:  READY
date: 2026-08-07  timezone: UTC
meetings: 0  deadlines: 2  followUps: 2
activeGoals: 2  priorityTasks: 11  pendingApprovals: 10
projectHealth: mi-core=ATTENTION
serviceHealth: 8 healthy, 2 unhealthy (Mi Core HTTP, Evidence DB, Knowledge DB probes —
  reported honestly, not tuned)
relevantKnowledge: 0  knowledgeCitations: 0  conflicts: 1
focusWindows: 1  blockers: 0  risks: 4  confirmationRequests: 0  unknowns: 1
plan: DRAFT, 10 selected tasks, 2 selected goals, kinds = FIXED + FLEXIBLE
live personal-os.db schema version before=5 after=5 (unchanged)
```

The live database's own `schema_migrations` was re-read after the run and confirmed
still v5 — **production was not modified.** No task was transitioned; no field in the
generated brief carries an external-write shape. Evidence above is sanitized to counts
and categories; no real email/calendar content is reproduced.

## 20-fixture-day quality evaluation (§27)

`server/src/personal-os/operating/__tests__/operating-evaluation.test.ts`
(`npm run test:daily-operating-evaluation`) runs 20 independent, isolated fixture days —
baseline, no-meetings, heavy-meetings, deadline-heavy, blocked-project, many-approvals,
stale-knowledge, conflict-heavy, no-gmail-content, no-calendar-content,
connector-unavailable, all-failed, all-completed, no-goals, no-tasks, two-projects,
mixed-load, max-goals, connector-unavailable-with-heavy-load, and a fully quiet day —
each through `morning()` + `plan()`, scored against the directive's hard targets.

| metric | target | measured |
|---|---|---|
| factual correctness | ≥95% | **100.0%** (120/120 checkable facts across 20 days) |
| missed critical item rate | 0 | **0** |
| unsupported fact rate | 0 | **0** |
| citation coverage (knowledge-derived facts) | 100% | **100%** |
| plan-bound violations | 0 | **0** |
| duplicate task suggestion rate | 0 | **0** |
| deterministic repeatability | 100% | **100%** (all 20 days: identical brief/plan id on rerun) |
| p95 morning-brief latency | reported honestly | **~2.4s** (dominated by SQLite store construction per isolated fixture day; not tuned to any threshold) |

No check in this suite is keyed to a specific fixture id — every assertion is a general
property (a WAITING_APPROVAL task always appears in `pendingApprovals`, a plan never
selects a BLOCKED task, every knowledge FACT carries a citation, and so on) that must
hold for any day the harness generates.

## Migration proof (§19, cross-referenced)

Both the standalone `operating-migration.test.ts` proof and the real operating-day
acceptance above exercised the v5 -> v6 upgrade against real/production-shaped data,
including a regression added during this closure for a chaining gap: `OperatingStore`
opened directly against a pre-v5 database now correctly passes through 5D-2's own
migration first (`applyPhase5d2Migration`) before creating the v6 tables, rather than
creating only the v6 tables in isolation. See `docs/architecture/PHASE5D3_DAILY_OPERATING_LOOP.md#migration-19`.

## What was not attempted

Voice, desktop control, email sending, calendar writes, autonomous push/merge/deploy,
autonomous browsing, multi-agent orchestration, and Phase 5E are all NOT STARTED —
no code path for any of them exists anywhere in this phase's diff.
