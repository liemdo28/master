# Phase 5D-3 — Daily Operating Loop runbook

## Normal use

```
personal-os -- today              # morning brief; idempotent per day
personal-os -- today generate     # explicit form of the above
personal-os -- today refresh      # midday refresh — detects changes only
personal-os -- today plan         # DRAFT plan for today; requires a brief to exist
personal-os -- today approve-plan <planId>
personal-os -- today review       # end-of-day review
personal-os -- week               # weekly operating review
personal-os -- approvals          # unified WAITING_APPROVAL + NEEDS_CONFIRMATION view
personal-os -- project-health [projectId]
personal-os -- service-health
```

The pre-existing `personal-os -- brief` (Phase 5B's `PersonalOsService.generateDailyBrief`)
is untouched and still works under its own name — `today` now points at the new loop
instead.

Equivalent HTTP surface, all under `/api/operating/*`, behind the same `x-api-key` +
rate-limit + IP-guard chain as every other Personal OS route:

```
GET  /operating/today                  GET  /operating/today/plan
POST /operating/today/generate         POST /operating/today/plan
POST /operating/today/refresh          POST /operating/today/plan/approve
GET  /operating/today/review           POST /operating/today/plan/cancel
POST /operating/today/review/generate  GET  /operating/week
GET  /operating/approvals              POST /operating/week/generate
GET  /operating/project-health         GET  /operating/service-health
```

## What "approve" actually does

`POST /operating/today/plan/approve` moves a `DailyPlan.status` from `DRAFT` to
`APPROVED` — a status column, nothing else. It never transitions the Task Runtime tasks
the plan references. Starting the actual work still goes through the existing Task
Runtime approval flow (`WAITING_APPROVAL` -> `READY`), unchanged by this phase.

## Reading a brief that looks wrong

Every field in `DailyOperatingBrief` traces to a specific live source:
`meetings`/`deadlines`/`followUps`/`focusWindows` from `IntelligenceService.
generateDailyAgenda` (Phase 5C, cached per date — a stale-looking meeting list usually
means the agenda was already generated earlier that day; `today refresh` layers in what
changed since, it does not regenerate the agenda). `projectHealth`/`serviceHealth` are
always a fresh read at brief-generation time (never cached). `relevantKnowledge`/
`knowledgeCitations`/knowledge `conflicts` come from Phase 5D-2's `KnowledgePack`, scoped
to the project ids of today's active goals only — no active goal with a project means an
explicit `unknowns` entry, not silence.

## Restart recovery

Nothing here holds state outside SQLite. Restarting `mi-core` loses no brief, plan,
refresh, or review — the next `today`/`today plan`/`today review` call for a date that
already has a row returns that row unchanged (§17 idempotency), and a call for a new date
generates fresh. No manual recovery step exists or is needed.

## Diagnosing "no deadline showed up"

Deadline detection requires an explicit `by/due/deadline/before YYYY-MM-DD` pattern
in an email subject or body (`intelligence/analysis.ts`, `DEADLINE_PATTERNS`) — a deadline
phrased only in natural language ("next Friday") is correctly reported as absent, not
inferred. Check `brief.unknowns` for a note about connector unavailability or an
unlinked-project-weakly warning before assuming a bug.

## Diagnosing "the plan doesn't include my task"

Three structural reasons a task never appears in `DailyPlan.selectedTasks`:

1. Its status is `BLOCKED`, `WAITING_APPROVAL`, `CANCELLED`, or `COMPLETED`
   (`NEVER_EXECUTABLE_STATUSES` in `plan.ts`) — by design, never selected as active work.
2. The plan already hit its 10-task bound and lower-ranked candidates were dropped —
   check `plan.selectedTasks.length` against `OPERATING_BOUNDS.maxPlanTasks`.
3. The task was created after the brief for that date was already generated — run
   `today refresh` to surface the change, or regenerate tomorrow's plan once the brief
   reflects it.

## Health signals

`service-health`/`brief.serviceHealth` calls SelfHeal's individual probe functions
directly (`checkPm2Service`/`checkHttpService`) — never the auto-restart monitor loop.
An `UNHEALTHY` entry here is informational only; it never triggers a restart from this
phase. `project-health`/`brief.projectHealth` is derived from Task Runtime + Phase 5D-2's
conflict/staleness tables + Project Registry map status, never from task success alone —
a project with zero failed tasks can still read `ATTENTION` because of stale knowledge or
an open conflict.
