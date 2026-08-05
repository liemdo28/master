# Phase 5 Personal OS Roadmap

Phase 5 turns the v1 engineering foundation into a personal operating assistant. It must extend the existing task runtime, Project Registry, evidence timeline, approval policy, and local-first model stack.

## Phase 5A Scope

Phase 5A is the only approved first slice:

- Personal context.
- Durable user preferences.
- Goals.
- Priority items.
- Daily briefing.
- Bounded goal planner.
- Approval-preserving child task creation.
- Restart recovery for preferences, goals, plans, and briefs.

## Non-Goals For Phase 5A

- Voice interface.
- Wake-word listening.
- Always-on microphone.
- Unrestricted desktop automation.
- Email sending.
- Calendar writes.
- Google Business posting.
- QuickBooks posting.
- Job auto-apply.
- Autonomous Git push.
- Autonomous PR merge.
- Autonomous production deployment.
- Financial or legal actions.
- Multi-agent swarm.
- Self-modifying core code.

## Canonical Records Proposed For Phase 5A

### UserPreference

Fields: `id`, `category`, `key`, `value`, `confidence`, `source`, `scope`, `createdAt`, `updatedAt`, `lastConfirmedAt`, `status`.

Statuses: `ACTIVE`, `NEEDS_CONFIRMATION`, `SUPERSEDED`, `DELETED`.

### Goal

Fields: `id`, `title`, `description`, `category`, `priority`, `status`, `targetDate`, `projectIds`, `parentGoalId`, `successCriteria`, `constraints`, `approvalPolicy`, `createdAt`, `updatedAt`.

Statuses: `DRAFT`, `ACTIVE`, `PAUSED`, `BLOCKED`, `COMPLETED`, `CANCELLED`.

### PriorityItem

Fields: `id`, `goalId`, `taskId`, `reason`, `urgency`, `importance`, `dueAt`, `status`.

### DailyBrief

Fields: `id`, `date`, `generatedAt`, `activeGoals`, `activeProjects`, `pendingTasks`, `pendingApprovals`, `recentFailures`, `recentSuccesses`, `systemAlerts`, `recommendedNextActions`, `evidenceReferences`.

## Truth Priority

1. Live system, project, and task state.
2. Explicit recent user statement.
3. Confirmed durable memory.
4. Inferred memory.
5. Model suggestion.

## First Acceptance Goal

Use this safe goal:

`Prepare and organize the next development work for Mi without modifying production.`

Required behavior:

- Create one goal.
- Associate Mi Core.
- Retrieve tagged v1.0 state.
- Inspect active tasks and recent evidence.
- Generate no more than five milestones.
- Create draft child tasks only.
- Require approval before execution.
- Generate a daily brief.
- Restart Mi and retrieve the same goal, plan, brief, and pending approvals.
- Do not run coding tasks automatically.
- Do not push, merge, deploy, email, publish, or perform external actions.

## Git Strategy

Create Phase 5A from the `v1.0.0` tag on a clean worktree:

`codex/phase5a-personal-context`

Open one PR after all Phase 5A gates pass. Do not merge automatically.
