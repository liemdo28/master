# Phase 5A Runbook

Phase 5A adds local personal context, goal planning, approval-gated child tasks, and daily briefs. It does not execute external actions.

## Validate

From `server/`:

```text
npm ci
npm run build
npm run test:ci
npm run test:task-runtime
npm run test:project-registry
npm run test:coding
npm run test:personal-context
npm run test:goals
npm run test:daily-brief
npm run test:phase5a-closure
npm run phase5a:acceptance
npm run agentic-coding:acceptance
```

Also run repository hygiene checks for whitespace, conflict markers, changed-file secrets, and local machine paths.

## Runtime Boundary

Personal APIs are mounted under `/api` and require the existing strict API-key pattern. Localhost is not trusted by itself.

The supported Phase 5A APIs are:

- `/api/personal/preferences`
- `/api/goals`
- `/api/daily-brief`
- `/api/personal/integrity`

## Data Policy

The Personal OS database is outside source control. It stores visible preference, goal, plan, priority, daily brief, event, and plan-operation records only.

Do not store raw credentials, `.env` contents, private keys, connection strings, or hidden chain-of-thought. Daily brief summaries sanitize untrusted instructions and redact credential-shaped values.

Default production database locations:

- `.local-agent-global/personal-os/personal-os.db`
- `.local-agent-global/task-runtime/tasks.db`
- `.local-agent-global/project-registry/projects.db`

## Planning Policy

Planning validates registered project IDs. Repeated planning returns the existing plan and child task IDs. If child task staging is interrupted, retry reuses already staged child tasks and completes the same bounded plan.

All planned child tasks start at `WAITING_APPROVAL`. Goal activation and pause do not execute child tasks.

## Daily Brief Policy

Daily briefs separate facts, suggestions, and unknowns. Calendar and email facts remain unknown unless connectors are configured. Same-date generation returns the existing brief.

## Production Deploy

Build from a clean worktree at the final master SHA. Back up the current live `server/dist` under `D:\mi-core-pm2-backups` before copying the clean build. Restart only the `mi-core` PM2 process and verify health, tools, task runtime, project registry, coding, and Phase 5A API acceptance.

Known limitations:

- no semantic personal knowledge memory yet
- no calendar/email intelligence
- no voice
- no unrestricted desktop control
- no autonomous push/merge/deploy
- no autonomous external actions
