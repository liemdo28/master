# Phase 5D-3 — component audit

Performed before any Phase 5D-3 code was written, against `origin/master` at
`686c182987e20eed4d432588e59fc040fbfaa72c` (merged Phase 5D-2), in a clean worktree at
`codex/phase5d3-daily-operating-loop`.

## Candidates and classification

| Area | Component | Classification | Why |
|---|---|---|---|
| Daily brief | `PersonalOsService.generateDailyBrief()` / `DailyBrief` (Phase 5B, `personal-os/service.ts`, `types.ts`) | **DEPRECATE (soft)** | Same date-keyed, facts/suggestions/unknowns/evidenceReferences shape the new brief should follow, but it lacks meetings/deadlines/focus-windows/project-health/service-health/knowledge-citations. Left running unmodified for its existing API/CLI/tests; the new `DailyOperatingBrief` is a richer, separate contract, not a wrapper around it. |
| Daily brief | `ExecutiveBriefing` (`executive-briefing/briefing-engine.ts`), `jarvis/daily-briefing-scheduler.ts` | **IGNORE** | Company-ops/CEO WhatsApp reporting on a different data plane (work orders, PM2, graph SPOFs), Vietnamese-formatted, cron-scheduled to WhatsApp. Wrong domain and wrong consumer for a personal operating loop. |
| Calendar/meetings/follow-ups/focus windows | `IntelligenceService.generateDailyAgenda()` / `DailyAgenda`, `computeFocusWindows` (Phase 5C, `intelligence/service.ts`, `analysis.ts`) | **KEEP, WRAP** | Already the canonical read-only Gmail/Calendar-derived agenda with `meetings`, `deadlines`, `followUps`, `availableFocusWindows`. `DailyOperatingBrief`/`DailyPlan` call this directly for those fields rather than re-deriving them. |
| Weekly review | `IntelligenceService.generateWeeklyReview()` / `WeeklyReview` (Phase 5C) | **KEEP, WRAP** | `WeeklyOperatingReview` (§11) is a strict superset of `WeeklyReview`'s fields (adds Task Runtime completion counts, approvals, project/service health, knowledge staleness/conflicts). Call `generateWeeklyReview` and layer the rest on top; do not re-derive `completedGoals`/`recurringIssues`/`lessons`. |
| Goal planning | `GoalPlan` (Phase 5B, per-goal, no date/focus-block concept) | **KEEP (input only)** | `proposedTasks`/`nextRecommendedAction` feed the daily planning algorithm as candidate work; goal planning itself is untouched. |
| Company objectives | `objective-engine/*` (Phase 25, CEO business objectives) | **IGNORE** | Company-wide revenue/SEO objective pipeline, unrelated domain. |
| Generic plan executor | `executive-intelligence/executive-planner.ts` (`ExecutionPlan`, `areDependenciesMet`) | **IGNORE** | LLM-intent step executor for the business/executive-intelligence layer; different types, different module. Not reused directly. |
| Task intelligence | `task-intelligence/task-data-collector.ts` (`OperationalSnapshot`, P0-P3 priority labels) | **IGNORE (data source)** | Reads the legacy file-based work-order/company-ops plane (`.local-agent-global/work-orders`), not Task Runtime's SQLite `TaskRecord`. Phase 5D-3's planning algorithm scores `TaskRecord`/`PriorityItem` directly — no existing module scores Task Runtime tasks by urgency/importance, so §6's ranking algorithm is new, deliberately bounded and deterministic. |
| Memory | `MemoryPack` / `PersonalOsStore.buildMemoryPack()` (Phase 5B) | **KEEP** | Canonical, called exactly as `generateDailyBrief` already calls it (`policy: 'PERSONAL_AND_PROJECT'`, bounded `maxRecords`/`maxBytes`). |
| Knowledge retrieval | `KnowledgeRetrievalService.buildKnowledgePack()` (Phase 5D-2) | **KEEP** | Canonical, unmodified. Brief uses `PERSONAL_AND_PROJECT`-equivalent scoping (bounded to active goals' projects); project-specific plan items use project-only scoping. |
| Reminders (generic) | `reminders/reminder-store.ts` (`setTimeout`-based, non-persistent) | **IGNORE** | Unrelated ephemeral system, no personal/goal linkage. |
| Follow-ups | `FollowUpCandidate` (Phase 5C, Gmail/Calendar-derived) | **KEEP** | Canonical "follow-up" concept; Daily Plan/EOD Review consume these directly rather than building a parallel system. |
| Owner memory | `memory/executive-memory.ts` (file-based CEO memory) | **IGNORE** | Parallel/legacy company-ops memory store; Personal OS `KnowledgeRecord`/`MemoryPack` remains the sole personal memory system. |
| Notification center | *(none found)* | **N/A** | No generic notification system exists; the brief is surfaced via API/CLI only, per §16-17's scope (no new delivery channel). |
| Company-os briefing | `company-os/report-center.ts`, `reporting-department.ts`, etc. | **IGNORE** | Business department reporting/deliverables, out of scope. |
| Scheduler/cron | `cron/sync-scheduler.ts`, `jarvis/daily-briefing-scheduler.ts` (both `setInterval`, both wired to WhatsApp/company-ops) | **IGNORE for registration** | Confirms the directive's on-demand design: Phase 5D-3 stays API/CLI-triggered (`generate`/`refresh`), never auto-registers with an existing cron path. |
| Pending approvals | `TaskStore.listTasks('WAITING_APPROVAL')` (Task Runtime) | **ADAPT** | Sole source for `PendingApprovalItem`; matches the directive's Task Runtime requirement exactly. |
| Pending approvals (legacy) | `intelligence/approval-center.ts` (`ApprovalItem`, WhatsApp/gate-based) | **IGNORE** | A separate, older gate/WhatsApp approval system unrelated to Task Runtime `TaskRecord.approvalState`. Not conflated with the new read model. |
| Service health | `company-os/self-healing-monitor.ts` — `getMonitoredServices()` (static registry, read-only) and `checkPm2Service`/`checkHttpService` (individual read-only probes) vs. `startSelfHealingMonitor()` (the loop, which auto-restarts) | **ADAPT (probes only)** | `ServiceHealth` calls the individual probe functions directly, never the monitor loop, so a brief/plan generation can never trigger a restart. |

## Canonical selections

| Role | Canonical implementation | Location |
|---|---|---|
| DailyOperatingLoop service | `DailyOperatingLoop` class | `server/src/personal-os/operating/loop.ts` (new) |
| Morning brief builder | `buildDailyOperatingBrief()` | `server/src/personal-os/operating/brief.ts` (new) |
| Daily planner | `buildDailyPlan()` + `rankCandidates()` | `server/src/personal-os/operating/plan.ts` (new) |
| End-of-day review builder | `buildEndOfDayReview()` | `server/src/personal-os/operating/review.ts` (new) |

No second planner stack is created: the daily planner is the *only* date-scoped, focus-block-aware planner in the codebase; goal planning (`GoalPlan`), business objective planning (`objective-engine`) and the executive-intelligence step executor remain untouched and are consumed only as read-only inputs (goal planning) or not at all (the other two).

## Data-plane boundary (must not cross)

Phase 5D-3 reads only from: Task Runtime (`TaskStore`), Personal OS (`PersonalOsStore` — goals, knowledge, memory), Phase 5C `IntelligenceService` (agenda, weekly review, follow-ups — read-only Gmail/Calendar), Phase 5D-2 `KnowledgeRetrievalService`, Project Registry (`ProjectRegistryService`), and SelfHeal's individual read-only probes. It never reads or writes the company-ops planes (`.local-agent-global/work-orders`, `executive-memory-v2`, `approval-center`'s gate/WhatsApp store) — those remain a separate, untouched system.
