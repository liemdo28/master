# Agent OS — Worker API Contract

**Version:** 1.0  
**Base URL:** `http://<control-plane-ip>:3700`  
**Protocol:** HTTP + WebSocket  
**Auth:** Token-based (32-byte hex)

---

## Worker Registration

```
POST /api/workers/register
```

**Request:**
```json
{
  "name": "office-pc-1",
  "hostname": "DESKTOP-ABC123",
  "tailscaleIp": "100.x.x.x",
  "token": "<generated-32-byte-hex>"
}
```

**Response:**
```json
{
  "worker": {
    "id": "uuid",
    "name": "office-pc-1",
    "hostname": "DESKTOP-ABC123",
    "tailscaleIp": "100.x.x.x",
    "status": "online",
    "token": "<token>",
    "registeredAt": "2026-06-01T12:00:00Z"
  }
}
```

---

## Heartbeat

```
POST /api/workers/:id/heartbeat
```

**Request:**
```json
{
  "token": "<worker-token>",
  "status": "online|busy|error",
  "systemInfo": {
    "cpuUsage": 45.2,
    "memoryTotal": 32000000000,
    "memoryUsed": 18000000000,
    "diskTotal": 500000000000,
    "diskUsed": 250000000000,
    "platform": "win32",
    "arch": "x64",
    "nodeVersion": "v20.11.0",
    "uptime": 86400
  },
  "currentTaskId": "task-uuid-or-null"
}
```

**Frequency:** Every 5 seconds

---

## Task Assignment (WebSocket)

Worker receives task via WebSocket:

```json
{
  "type": "task_assign",
  "payload": {
    "id": "task-uuid",
    "type": "build|qa|git_sync|audit|script",
    "project": "E:\\Project\\Master\\Bakudan\\review-automation-system",
    "priority": "low|medium|high|critical",
    "payload": {
      "command": "Build dashboard",
      "parsedAction": "build",
      "gitAction": "push"
    }
  },
  "timestamp": "2026-06-01T12:00:00Z"
}
```

---

## Task Result

```
POST /api/tasks/:id/result
```

**Request:**
```json
{
  "token": "<worker-token>",
  "status": "completed|failed",
  "result": {
    "exitCode": 0,
    "stdout": "Build successful",
    "duration": 12500
  },
  "error": null,
  "artifacts": [
    {
      "name": "build-log.txt",
      "path": "artifacts/build-logs/task-uuid.txt",
      "size": 4096,
      "mimeType": "text/plain"
    }
  ]
}
```

---

## Task Log Streaming (WebSocket)

Worker sends logs in real-time:

```json
{
  "type": "log",
  "payload": {
    "taskId": "task-uuid",
    "level": "info|warn|error|debug",
    "message": "npm install completed",
    "data": { "packages": 142 }
  },
  "timestamp": "2026-06-01T12:00:05Z"
}
```

---

## Kill Signal (WebSocket)

Worker receives kill signal:

```json
{
  "type": "task_kill",
  "payload": {
    "taskId": "task-uuid",
    "workerId": "worker-uuid",
    "reason": "CEO kill switch"
  },
  "timestamp": "2026-06-01T12:00:00Z"
}
```

Worker MUST:
1. Stop the running process (SIGTERM first, SIGKILL after 5s)
2. Send task result with status `cancelled`
3. Resume heartbeat

---

## Worker Stop Signal (WebSocket)

```json
{
  "type": "worker_stop",
  "payload": {
    "workerId": "worker-uuid",
    "reason": "CEO kill switch"
  },
  "timestamp": "2026-06-01T12:00:00Z"
}
```

Worker MUST:
1. Stop all running tasks
2. Send final heartbeat with status `stopped`
3. Gracefully shutdown

---

## Emergency Stop (WebSocket)

```json
{
  "type": "emergency_stop",
  "payload": {
    "killedTasks": 3,
    "stoppedWorkers": 2,
    "reason": "CEO emergency stop"
  },
  "timestamp": "2026-06-01T12:00:00Z"
}
```

---

## Task Types

| Type | Description | Handler Required |
|------|-------------|-----------------|
| `build` | Build project (npm/python/docker) | `handleBuild` |
| `qa` | Run tests (Playwright/pytest/jest) | `handleQA` |
| `git_sync` | Git operations (status/pull/push) | `handleGitSync` |
| `audit` | Source code audit | `handleAudit` |
| `script` | Execute shell command | `handleScript` |

---

## Task Statuses

```
pending → running → completed
                  → failed
                  → cancelled (via kill)
waiting_approval → pending (after CEO approves)
                 → cancelled (after CEO denies)
```

---

## WebSocket Connection

```
ws://<control-plane-ip>:3700/ws
```

Worker must:
1. Connect on startup
2. Reconnect on disconnect (3s delay)
3. Listen for `task_assign`, `task_kill`, `worker_stop`, `emergency_stop`
4. Send `log` messages during task execution
