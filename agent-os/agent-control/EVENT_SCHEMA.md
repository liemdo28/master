# Agent OS — Event Schema

All WebSocket messages follow this format:

```json
{
  "type": "<event_type>",
  "payload": { ... },
  "timestamp": "ISO-8601"
}
```

---

## Events: Control Plane → Worker

| Event | Description |
|-------|-------------|
| `task_assign` | Assign task to worker |
| `task_kill` | Kill a running task |
| `worker_stop` | Stop entire worker |
| `emergency_stop` | Stop all workers and tasks |

## Events: Worker → Control Plane

| Event | Description |
|-------|-------------|
| `log` | Real-time task log entry |
| `task_result` | Task completion/failure |
| `heartbeat` | Worker heartbeat |

## Events: Control Plane → Dashboard

| Event | Description |
|-------|-------------|
| `task_update` | Task status changed |
| `worker_update` | Worker status changed |
| `chat_message` | New chat message |
| `approval_pending` | New approval needed |
| `approval_resolved` | Approval approved/denied |

---

## Event Payloads

### task_assign
```json
{
  "id": "uuid",
  "type": "build|qa|git_sync|audit|script",
  "project": "path",
  "priority": "low|medium|high|critical",
  "payload": {}
}
```

### task_kill
```json
{
  "taskId": "uuid",
  "workerId": "uuid",
  "reason": "string"
}
```

### log
```json
{
  "taskId": "uuid",
  "level": "info|warn|error|debug",
  "message": "string",
  "data": {}
}
```

### task_result
```json
{
  "taskId": "uuid",
  "status": "completed|failed|cancelled",
  "result": {},
  "error": "string|null",
  "artifacts": []
}
```

### chat_message
```json
{
  "id": "uuid",
  "role": "user|system",
  "content": "string",
  "taskId": "uuid|null",
  "intent": {}
}
```

### approval_resolved
```json
{
  "taskId": "uuid",
  "status": "approved|denied"
}
```
