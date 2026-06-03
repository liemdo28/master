# Agent OS - Security Audit Log

## Overview

Mọi action của Agent Worker đều được audit log để đảm bảo security và compliance.

## Log Format

```json
{
  "id": "audit-123",
  "timestamp": "2026-06-01T17:00:00.000Z",
  "workerId": "worker-abc123",
  "workerName": "office-pc-1",
  "workerLevel": "L2",
  "taskId": "task-xyz789",
  "type": "git:push",
  "action": "git push origin feature/new-feature",
  "project": "E:\\Project\\Master\\Agent",
  "permission": "git:push",
  "status": "success",
  "result": {
    "filesChanged": 5,
    "commit": "abc1234",
    "branch": "feature/new-feature"
  },
  "ip": "100.x.x.x",
  "userAgent": "Agent-Worker/1.0"
}
```

## Logged Events

### Filesystem Events

| Event | Permission | Logged |
|-------|------------|--------|
| Read file | filesystem:read | ✅ |
| Write file | filesystem:write | ✅ |
| Delete file | filesystem:delete | ✅ (always denied) |
| List directory | filesystem:read | ✅ |

### Git Events

| Event | Permission | Logged |
|-------|------------|--------|
| git status | git:read | ✅ |
| git pull | git:read | ✅ |
| git add | git:write | ✅ |
| git commit | git:write | ✅ |
| git push | git:push | ✅ |
| git push --force | git:push | ✅ (denied) |

### App Events

| Event | Permission | Logged |
|-------|------------|--------|
| Open app | apps:open | ✅ |
| Blocked app attempt | apps:open | ✅ |
| Close app | apps:open | ✅ |

### Script Events

| Event | Permission | Logged |
|-------|------------|--------|
| Run approved script | scripts:run | ✅ |
| Run blocked script | scripts:run | ✅ (denied) |
| Script output | scripts:run | ✅ |

### Dangerous Actions

| Event | Permission | Logged |
|-------|------------|--------|
| git push to main | git:push | ✅ |
| Delete file | filesystem:delete | ✅ |
| Deploy production | deploy:production | ✅ |
| DNS change | dns:change | ✅ |
| Email send | cloud:email | ✅ |

## Database Schema

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  worker_name TEXT,
  worker_level TEXT,
  task_id TEXT,
  type TEXT NOT NULL,
  action TEXT NOT NULL,
  project TEXT,
  permission TEXT,
  status TEXT NOT NULL,
  result TEXT,
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_worker ON audit_logs(worker_id);
CREATE INDEX idx_audit_type ON audit_logs(type);
CREATE INDEX idx_audit_status ON audit_logs(status);
```

## Query Examples

### Get all denied actions
```sql
SELECT * FROM audit_logs WHERE status = 'denied' ORDER BY timestamp DESC;
```

### Get all git pushes
```sql
SELECT * FROM audit_logs WHERE type LIKE 'git:%' ORDER BY timestamp DESC;
```

### Get worker activity
```sql
SELECT * FROM audit_logs WHERE worker_id = 'worker-123' ORDER BY timestamp DESC;
```

### Get dangerous actions
```sql
SELECT * FROM audit_logs WHERE type IN ('filesystem:delete', 'deploy:production', 'dns:change') ORDER BY timestamp DESC;
```

## Implementation

```typescript
// Audit logger
class AuditLogger {
  async log(event: AuditEvent): Promise<void> {
    const entry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...event,
    };
    
    // Store in database
    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, worker_id, worker_name, worker_level, task_id, type, action, project, permission, status, result)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.timestamp,
      entry.workerId,
      entry.workerName,
      entry.workerLevel,
      entry.taskId,
      entry.type,
      entry.action,
      entry.project,
      entry.permission,
      entry.status,
      JSON.stringify(entry.result)
    );
    
    // Also log to file
    console.log(`[AUDIT] ${entry.type} ${entry.status} - ${entry.action}`);
  }
  
  async query(filter: AuditFilter): Promise<AuditEvent[]> {
    // Query implementation
  }
}

// Usage in handlers
async function handleGitPush(task: any) {
  if (!hasPermission('git:push', task.workerLevel)) {
    await audit.log({
      workerId: task.workerId,
      taskId: task.id,
      type: 'git:push',
      action: `git push ${task.payload.remote} ${task.payload.branch}`,
      project: task.project,
      permission: 'git:push',
      status: 'denied',
      result: { reason: 'Requires L2 permission' },
    });
    throw new Error('Permission denied');
  }
  
  // ... execute push ...
  
  await audit.log({
    workerId: task.workerId,
    taskId: task.id,
    type: 'git:push',
    action: `git push ${task.payload.remote} ${task.payload.branch}`,
    project: task.project,
    permission: 'git:push',
    status: 'success',
    result: { commit: 'abc123', filesChanged: 5 },
  });
}
```

## Retention Policy

- Last 7 days: Full logs
- 7-30 days: Aggregated by hour
- 30+ days: Archived to cold storage

## Alert Conditions

Trigger alert if:
- ❌ Failed git push attempts > 5/hour
- ❌ Blocked app attempts > 10/hour
- ❌ Delete file attempts (any)
- ❌ Production deploy attempts (any)
- ❌ DNS change attempts (any)
