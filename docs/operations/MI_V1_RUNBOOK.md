# Mi V1 Runbook

## Production Process

- Process: `mi-core`
- Cwd: `D:\Project\Mi-core-system\Master\mi-core`
- Script: `D:\Project\Mi-core-system\Master\mi-core\server\dist\index.js`
- Port: `4001`

## Clean Build

Use a clean worktree at the intended release SHA.

```powershell
cd <clean-worktree>\server
npm ci
npm run build
npm run test:ci
npm run test:coding
npm run agentic-coding:acceptance
```

For real-world certification, set project roots privately in the shell environment and run:

```powershell
npm run agentic-coding:real-certification
```

## Health Checks

```powershell
Invoke-WebRequest http://127.0.0.1:4001/api/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:4001/api/tools -UseBasicParsing
```

Protected coding checks require `x-api-key`:

```powershell
GET /api/coding/engines
GET /api/coding/models
GET /api/coding/engine
```

Expected results:

- `local-llm-engine` active.
- Local model backend reachable.
- Cloud fallback disabled.
- `qwen3:8b` available for primary/review roles.

## Project Registry Checks

```powershell
GET  /api/projects/mi-core/map/status
POST /api/projects/mi-core/map
POST /api/projects/mi-core/context-pack
```

Expected v1 values:

- Map status: `FRESH`
- Source SHA: `f8e9bfcb5d6a570171f6257258938a9daf7227bc`
- Context policy: `MAP_PLUS_TARGETED_READ`

## Task Runtime Checks

Create a harmless task through `/api/task-runtime/tasks`, run `node --version` through `/inspect`, and confirm status `COMPLETED`.

Create a controlled failure task, run `node --task-runtime-intentional-failure`, and confirm status `FAILED`.

Restart only `mi-core`, then fetch both tasks again to confirm persistence.

## Deployment

1. Build from a clean worktree.
2. Back up live `server\dist` under `D:\mi-core-pm2-backups`.
3. Copy the clean `server\dist` into the live path.
4. Set `MI_DEPLOYED_SOURCE_SHA` and `MI_DEPLOYED_SOURCE_ROOT` for the PM2 process.
5. Restart only `mi-core` with updated environment.
6. Run health, tools, task-runtime, registry, and coding checks.

## Logs

```powershell
pm2 logs mi-core --lines 200 --nostream
```

Watch for uncaught exceptions, unhandled rejections, SQLite lock errors, migration failures, validation profile failures, route startup failures, model gateway failures, task duplication, and project boundary violations.
