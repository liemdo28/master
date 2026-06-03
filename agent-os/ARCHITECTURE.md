# Agent OS - Architecture

## System Overview

Agent OS is a distributed task execution system with a client-server architecture designed for remote work automation.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   MacBook   │  │   iPhone    │  │   iPad      │        │
│  │  Dashboard  │  │  Dashboard  │  │  Dashboard  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │ HTTP/WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    CONTROL PLANE LAYER                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Agent Control (Port 3700)               │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │ Task API   │  │ Worker API │  │Project API │    │  │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘    │  │
│  │        └────────────────┼────────────────┘         │  │
│  │                         ▼                            │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │              Task Queue Service               │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │        │                          │                 │  │
│  │        ▼                          ▼                 │  │
│  │  ┌──────────────┐        ┌──────────────┐          │  │
│  │  │  SQLite DB   │        │  WebSocket   │          │  │
│  │  │  (Persistent)│        │  (Real-time) │          │  │
│  │  └──────────────┘        └──────────────┘          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                    Tailscale Network
                    (Encrypted Tunnel)
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      WORKER LAYER                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Worker Node                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │  │
│  │  │ Registration │  │  Heartbeat    │  │  WebSocket│  │  │
│  │  │   Service    │  │  (5s)        │  │  Client   │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │  │
│  │         └─────────────────┼────────────────┘        │  │
│  │                           ▼                          │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │             Task Executor                     │   │  │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐ │   │  │
│  │  │  │ Build  │ │   QA   │ │  Git   │ │Audit │ │   │  │
│  │  │  │Handler │ │Handler │ │ Handler│ │Handler│ │   │  │
│  │  │  └────────┘ └────────┘ └────────┘ └──────┘ │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### Control Plane

**Responsibilities:**
- Task queue management
- Worker registration and heartbeat monitoring
- Real-time log distribution
- Project discovery
- API gateway

**Technology Stack:**
- Express.js (HTTP API)
- WebSocket (ws library)
- SQLite (better-sqlite3)
- TypeScript

**Ports:**
- 3700 (HTTP + WebSocket)

### Worker Node

**Responsibilities:**
- Self-registration with Control Plane
- Periodic heartbeat with system metrics
- Task execution
- Log streaming back to Control Plane

**Technology Stack:**
- Node.js
- systeminformation (system metrics)
- ws (WebSocket client)
- TypeScript

**Auto-Start Options:**
- Windows Service (via SC command)
- PM2 process manager
- Direct Node.js process

### Communication Protocol

**Registration Flow:**
```
1. Worker starts → Calls POST /api/workers/register
2. Control Plane → Generates token, stores worker
3. Worker → Receives ID and token
4. Worker → Saves config.json for reconnection
```

**Heartbeat Flow:**
```
1. Worker → Sends POST /api/workers/:id/heartbeat every 5s
2. Control Plane → Updates last_heartbeat, status
3. Control Plane → Broadcasts worker update via WebSocket
```

**Task Execution Flow:**
```
1. User → Creates task via Dashboard
2. Control Plane → Stores task (status: pending)
3. Control Plane → Assigns to available worker
4. Control Plane → Broadcasts task_assign via WebSocket
5. Worker → Receives task, executes handler
6. Worker → Streams logs via WebSocket
7. Worker → Reports completion via API
8. Control Plane → Updates task status, broadcasts update
```

### Database Schema

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   workers   │────▶│    tasks    │◀────│ task_logs   │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id          │     │ id          │     │ id          │
│ name        │     │ type        │     │ task_id     │
│ hostname    │     │ status      │     │ timestamp   │
│ tailscale_ip│     │ priority    │     │ level       │
│ token       │     │ project     │     │ message     │
│ status      │     │ worker_id   │◀────│ data        │
│ registered  │     │ created_at  │     └─────────────┘
│ heartbeat   │     │ started_at  │
└─────────────┘     │ completed_at│
                    └─────────────┘
```

### Task Lifecycle

```
     ┌─────────┐
     │ PENDING │
     └────┬────┘
          │ Worker assigned
          ▼
     ┌─────────┐
     │ RUNNING │
     └────┬────┘
          │
    ┌─────┴─────┐
    ▼           ▼
┌────────┐  ┌────────┐
│COMPLETE│  │ FAILED │
└────────┘  └────┬───┘
                │ User retries
                ▼
           ┌─────────┐
           │ PENDING │
           └─────────┘
```

### Security Model

1. **Worker Authentication**: 32-byte hex tokens
2. **Token Validation**: Every API call validates token
3. **Encrypted Transport**: Tailscale wireguard encryption
4. **Audit Trail**: All executions logged to database

### Scalability Considerations

**Current (MVP):**
- Single Control Plane
- Single Worker per PC
- SQLite database

**Future (Phase 2):**
- Redis for task queue
- Multiple workers per PC
- Worker pools with capabilities
- PostgreSQL for multi-instance
- Load balancer for Control Plane
