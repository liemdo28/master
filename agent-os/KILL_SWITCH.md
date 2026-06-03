# Agent OS - Kill Switch

## Overview

Kill Switch cho phép CEO dừng ngay lập tức bất kỳ task, worker, hoặc process nào đang chạy.

## Kill Switch Types

| Type | Scope | Action |
|------|-------|--------|
| WORKER | Toàn bộ worker | Dừng worker, ngắt kết nối |
| TASK | Một task cụ thể | Hủy task, terminate process |
| BUILD | Build process | Kill build process |
| DEPLOY | Deploy process | Hủy deploy |
| SCRIPT | Script process | Kill script |
| CLOUD | Cloud operation | Hủy cloud action |
| CLINE | Cline/Antigravity | Stop AI job |

## Kill Switch API

### Kill Worker
```
POST /api/kill/worker/:workerId
```

### Kill Task
```
POST /api/kill/task/:taskId
```

### Kill Process
```
POST /api/kill/process
{
  "pid": 12345,
  "type": "build"
}
```

### Emergency Stop All
```
POST /api/kill/all
{
  "reason": "Emergency stop by CEO"
}
```

## Kill Switch Events

```typescript
interface KillSwitchEvent {
  id: string;
  timestamp: string;
  type: KillSwitchType;
  targetId: string;
  targetName: string;
  reason: string;
  initiatedBy: string;
  result: 'success' | 'failed' | 'partial';
  processesKilled: number;
  artifactsPreserved: boolean;
  logsArchived: boolean;
}
```

## Implementation

```typescript
class KillSwitch {
  async killWorker(workerId: string, reason: string): Promise<KillResult> {
    const worker = await this.db.workers.findById(workerId);
    
    // 1. Cancel any running task
    if (worker.currentTaskId) {
      await this.cancelTask(worker.currentTaskId);
    }
    
    // 2. Close WebSocket connection
    const ws = this.workerConnections.get(workerId);
    if (ws) {
      ws.close(1000, 'Killed by CEO');
    }
    
    // 3. Log kill event
    await this.logKillEvent({
      type: 'WORKER',
      targetId: workerId,
      targetName: worker.name,
      reason,
    });
    
    return { success: true };
  }
  
  async killTask(taskId: string, reason: string): Promise<KillResult> {
    const task = await this.db.tasks.findById(taskId);
    
    if (!task) {
      return { success: false, error: 'Task not found' };
    }
    
    // 1. Mark task as cancelled
    await this.db.tasks.update(taskId, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledReason: reason,
    });
    
    // 2. Kill associated processes
    const processesKilled = await this.killTaskProcesses(taskId);
    
    // 3. Preserve logs
    await this.archiveLogs(taskId);
    
    // 4. Preserve partial artifacts
    await this.preserveArtifacts(taskId);
    
    // 5. Free worker
    if (task.workerId) {
      await this.db.workers.update(task.workerId, {
        status: 'online',
        currentTaskId: null,
      });
    }
    
    // 6. Notify via WebSocket
    this.wsManager.broadcast({
      type: 'task_killed',
      taskId,
      reason,
    });
    
    // 7. Log kill event
    await this.logKillEvent({
      type: 'TASK',
      targetId: taskId,
      targetName: `${task.type} - ${task.project}`,
      reason,
      processesKilled,
      artifactsPreserved: true,
      logsArchived: true,
    });
    
    return { success: true, processesKilled };
  }
  
  async killProcess(pid: number, type: string): Promise<KillResult> {
    try {
      // Windows kill process
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      
      await this.logKillEvent({
        type: type.toUpperCase() as KillSwitchType,
        targetId: String(pid),
        targetName: `Process ${pid}`,
        reason: 'Manual kill',
        processesKilled: 1,
      });
      
      return { success: true, processesKilled: 1 };
    } catch {
      return { success: false, error: 'Process not found or already terminated' };
    }
  }
  
  async emergencyStopAll(reason: string): Promise<void> {
    // 1. Get all workers
    const workers = await this.db.workers.findAll();
    
    // 2. Kill all running tasks
    const runningTasks = await this.db.tasks.findAll('running');
    for (const task of runningTasks) {
      await this.killTask(task.id, reason);
    }
    
    // 3. Kill all workers
    for (const worker of workers) {
      await this.killWorker(worker.id, reason);
    }
    
    // 4. Log emergency event
    await this.logKillEvent({
      type: 'EMERGENCY',
      targetId: 'all',
      targetName: 'All Workers & Tasks',
      reason,
      result: 'success',
      processesKilled: runningTasks.length,
    });
  }
  
  private async killTaskProcesses(taskId: string): Promise<number> {
    let killed = 0;
    
    // Find processes by task ID
    const processes = await this.processManager.findByTaskId(taskId);
    
    for (const proc of processes) {
      try {
        execSync(`taskkill /PID ${proc.pid} /F`, { stdio: 'ignore' });
        killed++;
      } catch {}
    }
    
    return killed;
  }
}
```

## Dashboard Kill Switch UI

```
┌─────────────────────────────────────────────────────────┐
│ 🔴 KILL SWITCH                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ACTIVE TASKS                                          │
│  ├─ build: agent-coding       [🔴 KILL]              │
│  ├─ qa: review-system        [🔴 KILL]              │
│  └─ audit: E:\Project\Master [🔴 KILL]               │
│                                                         │
│  WORKERS                                               │
│  ├─ office-pc-1 (online)     [🔴 KILL WORKER]       │
│  └─ laptop-worker (online)    [🔴 KILL WORKER]        │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 🔴 EMERGENCY STOP ALL                            │  │
│  │     Kills all tasks and disconnects all workers  │  │
│  │     [CONFIRM AND STOP]                          │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Kill Confirmation

Emergency Stop yêu cầu xác nhận:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ CONFIRM EMERGENCY STOP                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  This will:                                           │
│  • Cancel all running tasks                           │
│  • Disconnect all workers                             │
│  • Kill all running processes                         │
│                                                         │
│  Reason: [Emergency maintenance required___________]   │
│                                                         │
│  Type "STOP" to confirm: [_______]                    │
│                                                         │
│  [CANCEL]              [CONFIRM STOP]               │
└─────────────────────────────────────────────────────────┘
```

## Kill Switch Audit

Mọi kill event đều được log:

```json
{
  "id": "kill-123",
  "timestamp": "2026-06-01T17:00:00Z",
  "type": "TASK",
  "targetId": "task-456",
  "targetName": "build: agent-coding",
  "reason": "CEO manual kill",
  "initiatedBy": "ceo@company.com",
  "result": "success",
  "processesKilled": 3,
  "artifactsPreserved": true,
  "logsArchived": true
}
```

## Notification

Khi kill switch được kích hoạt:

1. WebSocket push to all clients
2. Dashboard alert banner
3. Task status changes to "cancelled"
4. Worker status changes accordingly
5. Email notification (if configured)

## Process Preservation

Sau khi kill:

- ✅ Logs are archived
- ✅ Partial artifacts preserved
- ✅ Task record preserved
- ❌ Process terminated
- ❌ Task cannot resume (must retry)
