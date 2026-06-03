# Agent OS MVP - Technical Specification

## Overview

Agent OS is a distributed task execution system that enables remote command execution on Windows PCs via a web dashboard, without requiring any manual intervention on the target machine.

## Architecture

```
┌──────────────┐
│   Laptop     │
│   (MacBook)  │──▶ Dashboard UI (http://localhost:3700)
│   (iPhone)   │    WebSocket for real-time logs
└──────┬───────┘
       │ HTTP/WebSocket
       ▼
┌──────────────┐
│ Control Plane │  Port: 3700
│  (Node.js)   │  - Task Queue
│              │  - Worker Registry
│              │  - Project Discovery
└──────┬───────┘
       │ Tailscale Network (Encrypted, Private)
       ▼
┌──────────────┐
│  Windows PC  │
│   Worker     │  - Auto-registers
│              │  - Heartbeat (5s)
│              │  - Task Execution
└──────────────┘
```

## Components

### 1. Control Plane (agent-control)
- **Port**: 3700
- **Database**: SQLite
- **Features**:
  - Task CRUD (Create, Read, Cancel, Retry)
  - Worker Registry with token-based auth
  - Real-time log streaming via WebSocket
  - Project discovery scanner
  - Dashboard UI (responsive, mobile-friendly)

### 2. Worker Node (agent-worker)
- **Platform**: Windows
- **Features**:
  - Auto-registration with Control Plane
  - 5-second heartbeat with system metrics
  - Task handlers: Build, QA, Git Sync, Audit, Script
  - Windows Service support
  - Tailscale IP detection

### 3. Shared Library (shared)
- TypeScript types and interfaces
- Protocol definitions
- Database schema

## Task Types

| Type | Description | Handler |
|------|-------------|---------|
| `build` | Build project (npm install, compile, test) | handleBuild |
| `qa` | Run Playwright/Cypress tests | handleQA |
| `git_sync` | Git status/pull/fetch/log | handleGitSync |
| `audit` | Source code audit and reporting | handleAudit |
| `script` | Execute custom shell commands | handleScript |

## Task Status Flow

```
PENDING → RUNNING → COMPLETED
              ↓
           FAILED
              ↓
         (Retry) → PENDING
```

## API Endpoints

### Tasks
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get task details
- `POST /api/tasks/:id/cancel` - Cancel task
- `POST /api/tasks/:id/retry` - Retry failed task
- `GET /api/tasks/:id/logs` - Get task logs
- `GET /api/tasks/:id/artifacts` - Get task artifacts

### Workers
- `GET /api/workers` - List all workers
- `POST /api/workers/register` - Register new worker
- `POST /api/workers/:id/heartbeat` - Worker heartbeat

### Projects
- `GET /api/projects` - List discovered projects
- `POST /api/projects/scan` - Scan for projects

### System
- `GET /api/health` - Health check
- `GET /api/stats` - Task statistics

## Security

- Worker tokens (32-byte hex) generated on registration
- Token validated on every heartbeat and task operation
- All WebSocket messages signed with worker token
- Execution audit trail stored in database

## Database Schema

### Tables
- `workers` - Worker registry
- `tasks` - Task queue
- `task_logs` - Task log entries
- `task_artifacts` - Task output files
- `projects` - Discovered projects
- `heartbeats` - Heartbeat history
- `executions` - Command execution audit

## Quick Start

### 1. Start Control Plane
```bash
cd agent-control
npm install
npm run build
npm start
```

### 2. Start Worker (on Windows PC)
```bash
cd agent-worker
npm install
npm run build
# Edit .env with your Tailscale IP
npm start
```

### 3. Open Dashboard
```
http://localhost:3700
```

## Test Scenarios

### Scenario A: Build Project
1. Open dashboard → Create Task
2. Select "Build Project" type
3. Enter project path: `E:\Project\Master\Agent`
4. Click Create
5. Watch real-time logs
6. Receive completion notification

### Scenario B: Audit Project
1. Create Task → "Source Audit"
2. Enter path: `E:\Project\Master`
3. Worker scans directory
4. Generates audit report
5. Report saved to `reports/audit-*.json`

### Scenario C: Run QA Tests
1. Create Task → "QA / Tests"
2. Worker detects Playwright config
3. Runs tests
4. Returns test results

## Tailscale Integration

The worker automatically detects its Tailscale IP using:
```bash
tailscale ip -4
```

No port forwarding required. Communication is encrypted and private.

## Permission Model

Agent OS chia quyền theo 3 cấp:

| Level | Mô tả | Quyền chính |
|-------|--------|--------------|
| L1 - Local Worker | Default | Read/Write E:\Project\Master, Git local, Run approved scripts |
| L2 - Dev Executor | Development | + Git push, Control Cline/Antigravity, API Proxy, QA/Build |
| L3 - Cloud Operator | Full access | + Gmail, DreamHost, Cloudflare, Google Drive (cần token riêng) |

Xem chi tiết: `PERMISSION_MODEL.md`, `WORKER_CAPABILITY_MATRIX.md`

## Future Enhancements (Phase 2)

- Multi-worker task distribution
- Docker container support
- Scheduled tasks (cron)
- Webhook notifications
- Task templates
- Team collaboration
