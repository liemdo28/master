# Phase 5D-3 — the Daily Operating Loop

Converts Mi's existing state (Task Runtime, Personal OS goals/knowledge/memory, Phase 5C
read-only Gmail/Calendar intelligence, Phase 5D-2 KnowledgePack, Project Registry,
SelfHeal read-only probes) into four read-model outputs — a morning brief, a draft plan,
a midday refresh, and an end-of-day review — plus a weekly rollup. Nothing here writes to
an external system, executes a task, or activates work; see
`docs/security/PHASE5D3_OPERATING_SECURITY.md` for the enforcement of that boundary.
See `docs/architecture/PHASE5D3_COMPONENT_AUDIT.md` for which existing components this
phase reuses (KEEP+WRAP) versus deliberately does not touch (IGNORE/DEPRECATE).

## The canonical orchestrator

`DailyOperatingLoop` (`server/src/personal-os/operating/loop.ts`) is the single entry
point for all five operations: `morning()`, `midday()`, `plan()`, `evening()`, `weekly()`.
Each delegates to exactly one builder module — `brief.ts`, `plan.ts`, `refresh.ts`,
`review.ts`, `weekly.ts` — and records an `operating_loop_runs` audit row keyed by
phase/date/operationId. There is no second code path that can produce any of these five
result types.

## Truth priority (§4)

```
LIVE_SYSTEM_STATE > LIVE_PROJECT_TASK_STATE > EXPLICIT_RECENT_USER_DECISION >
CONFIRMED_KNOWLEDGE > CONFIRMED_MEMORY > INFERRED_KNOWLEDGE > SUGGESTION
```

Enforced structurally, not by a runtime merge step (`types.ts`, `TRUTH_PRIORITY`).
`ServiceHealth` and `ProjectHealth` are always computed fresh from live probes
(`health.ts`) directly into their own `DailyOperatingBrief` fields; a knowledge- or
memory-derived statement is never written into those fields — it stays in
`relevantKnowledge`/`relevantMemory`. Two knowledge sources that disagree surface through
`conflicts` (Phase 5D-2's conflict engine, reused unmodified); nothing here silently picks
a winner between two facts.

## DailyOperatingBrief (§3)

Built by `buildDailyOperatingBrief` (`brief.ts`), idempotent per date
(`OperatingStore.latestBriefForDate`). Sourced from `IntelligenceService.generateDailyAgenda`
(Phase 5C, cached per date already) for meetings/deadlines/followUps/focusWindows;
`PersonalOsStore.listGoals`/`buildMemoryPack` for goals and memory; Task Runtime for
`priorityTasks`/`pendingApprovals`; `computeProjectHealth`/`computeServiceHealth` for
health; `KnowledgeRetrievalService.buildKnowledgePack` (Phase 5D-2, reused unmodified,
bounded to `KNOWLEDGE_QUERY_LIMITS.maxProjectIds`) for `relevantKnowledge`/
`knowledgeCitations`/knowledge `conflicts`. Bounded throughout by `OPERATING_BOUNDS`
(max 10 priorities, 5 recommended actions, 5 blockers, 5 confirmation requests).

## DailyPlan (§5-6)

Built by `buildDailyPlan` (`plan.ts`), idempotent per date. A bounded, deterministic
ranking runs before any further reasoning could touch the result — every candidate is
scored from data already on hand:

- **FIXED** (tier `high`): every meeting and deadline from the brief, never reordered,
  never skipped.
- **FLEXIBLE**: executable tasks (`NEVER_EXECUTABLE_STATUSES = {BLOCKED, WAITING_APPROVAL,
  CANCELLED, COMPLETED}` are filtered out before ranking even starts) and active-goal
  contributions.
- **OPTIONAL** (tier `low`): follow-up candidates, capped at 5.

Candidates are sorted by rank and sliced to `OPERATING_BOUNDS.maxPlanTasks` (10) /
`maxPlanGoals` (5). A `DailyPlan` is created `DRAFT` and can only ever move between
`DRAFT`/`APPROVED`/`ACTIVE`/`COMPLETED`/`CANCELLED` — a status column change, nothing
else. `setPlanStatus` never touches a Task Runtime task.

## Midday refresh (§8)

`buildDailyRefresh` (`refresh.ts`) diffs **live** state against the brief's snapshot —
task status changes, approval set changes, live `ServiceHealth`/`ProjectHealth`
recomputation, and a live (uncached) `intelligence.calendarEvents()` call for meeting
cancellations/additions. Deduplicated by content hash
(`OperatingStore.saveRefreshIfNew`) so a no-op re-call produces no duplicate row. A
refresh never creates a second brief and never activates a plan.

## End-of-day review (§9-10)

`buildEndOfDayReview` (`review.ts`) is scoped to the day's `DailyPlan.selectedTasks`
(`sourceType === 'TASK'`): a task counts as completed only if Task Runtime itself reports
`status: 'COMPLETED'` with a `completedAt` on that date — never self-awarded. Failed and
blocked tasks stay failed/blocked in the review regardless of what else happened that
day. `extractKnowledgeCandidates` derives bounded, deduplicated `KnowledgeCandidate`
entries (max 10) from failure reasons and recurring blockers — every candidate starts
`needsConfirmation: true` and rejects path-shaped, stack-trace-shaped, hash-shaped, or
too-generic (<15 char) text before it is ever offered.

## Weekly operating review (§11)

`buildWeeklyOperatingReview` (`weekly.ts`) wraps `IntelligenceService.generateWeeklyReview`
(Phase 5C, unmodified) and layers Task Runtime completion/failure/blocked counts,
`listPendingApprovals`, and `computeProjectHealth`/`computeServiceHealth` on top.

## Idempotency and restart recovery (§17-18)

Every result type is uniquely keyed in `OperatingStore` — `daily_operating_briefs` and
`daily_plans` by `date` (UNIQUE), `daily_refreshes` by `date + contentHash`,
`end_of_day_reviews` by `date`, `weekly_operating_reviews` by `weekStart`. A second call
to any loop method on the same date/week returns the existing row rather than creating a
new one. Because every result is a durable SQLite row, a process restart loses nothing:
reopening `OperatingStore` against the same database file makes every prior brief, plan,
refresh, and review immediately readable again with no recomputation.

## Migration (§19)

`applyPhase5d3Migration` (`store.ts`, `PHASE5D3_SCHEMA_VERSION = 6`) adds the six tables
above via `CREATE TABLE IF NOT EXISTS` — purely additive, transactional, idempotent.
Proven against a production-copy backup: all pre-existing table row counts preserved,
`schema_migrations` gains exactly the v6 row, a second run is a no-op, and the live
database's own version is confirmed unchanged afterward. See
`server/src/personal-os/operating/__tests__/operating-migration.test.ts`.

## API and CLI (§20-21)

14 routes under `/api/operating/*` (`router.ts`) behind the same auth chain as every
other Personal OS router (`taskRuntimeJsonErrorHandler`, `rateLimiter`, `applyIpGuard`,
`requireTaskRuntimeAuth`). 10 CLI subcommands under `personal-os -- today|week|approvals|
project-health|service-health` (`cli.ts`); the pre-existing `personal-os -- brief` verb
(Phase 5B's `PersonalOsService.generateDailyBrief`) is left untouched under its own name.
