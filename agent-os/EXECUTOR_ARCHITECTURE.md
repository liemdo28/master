# Agent Worker - Executor Architecture

## Overview

Agent Worker sử dụng kiến trúc Executor-based: mỗi loại task được xử lý bởi một Executor riêng biệt với permission scope và audit log riêng.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AGENT WORKER                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Worker Service                       │  │
│  │  ├── Registration (auto-register with Control Plane) │  │
│  │  ├── Heartbeat (every 5 seconds)                     │  │
│  │  ├── Task Receiver (WebSocket + HTTP polling)        │  │
│  │  └── Log Streamer (real-time to Control Plane)       │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 Executor Registry                     │  │
│  │                                                       │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │   File     │  │    Git     │  │   Build    │    │  │
│  │  │ Executor   │  │  Executor  │  │  Executor  │    │  │
│  │  └────────────┘  └────────────┘  └────────────┘    │  │
│  │                                                       │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │    QA      │  │    App     │  │  Script    │    │  │
│  │  │ Executor   │  │  Executor  │  │  Executor  │    │  │
│  │  └────────────┘  └────────────┘  └────────────┘    │  │
│  │                                                       │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │   Cline    │  │Antigravity │  │ API Proxy  │    │  │
│  │  │ Executor   │  │  Executor  │  │  Executor  │    │  │
│  │  └────────────┘  └────────────┘  └────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Shared Services                          │  │
│  │  ├── Permission Checker                              │  │
│  │  ├── Audit Logger                                    │  │
│  │  ├── Artifact Uploader                               │  │
│  │  └── Process Manager                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Executor Interface

```typescript
interface Executor {
  name: string;
  permissions: string[];
  
  execute(task: Task): Promise<ExecutionResult>;
  cancel(taskId: string): Promise<void>;
  getStatus(): ExecutorStatus;
}

interface ExecutionResult {
  success: boolean;
  exitCode: number;
  logs: string[];
  artifacts: Artifact[];
  duration: number;
  error?: string;
}
```

---

## Executor Details

### 1. File Executor

| Capability | Permission | Risk |
|------------|-----------|------|
| Read files | `filesystem:read` | GREEN |
| Write files (E:\Project\Master) | `filesystem:write` | GREEN |
| Write files (other) | `filesystem:write:strict` | YELLOW |
| Delete files | `filesystem:delete` | RED |
| List directories | `filesystem:read` | GREEN |
| Search files | `filesystem:read` | GREEN |

**Paths Accessible:**
```
E:\Project\Master (read/write)
D:\ (read only)
E:\ (read only)
F:\ (read only)
G:\My Drive (read only)
```

---

### 2. Git Executor

| Capability | Permission | Risk |
|------------|-----------|------|
| git status | `git:read` | GREEN |
| git log | `git:read` | GREEN |
| git diff | `git:read` | GREEN |
| git pull | `git:read` | GREEN |
| git fetch | `git:read` | GREEN |
| git add | `git:write` | GREEN |
| git commit | `git:write` | GREEN |
| git checkout | `git:write` | GREEN |
| git push | `git:push` | YELLOW |
| git push main | `git:push` | RED |

**Before Push:**
- Generate `CHANGE_SUMMARY.md`
- Validate no secrets in staged files
- Check branch protection rules

---

### 3. Build Executor

| Capability | Permission | Risk |
|------------|-----------|------|
| npm install | `build:run` | GREEN |
| npm run build | `build:run` | GREEN |
| npm test | `build:run` | GREEN |
| composer install | `build:run` | GREEN |
| pip install | `build:run` | GREEN |
| docker build | `build:run` | YELLOW |

**Build Steps:**
```
1. git pull (optional)
2. Install dependencies
3. Run tests (optional)
4. Run build
5. Capture logs + exit code
6. Upload artifacts
```

---

### 4. QA Executor

| Capability | Permission | Risk |
|------------|-----------|------|
| Playwright tests | `qa:run` | GREEN |
| Cypress tests | `qa:run` | GREEN |
| Unit tests | `qa:run` | GREEN |
| API tests | `qa:run` | GREEN |
| Smoke tests | `qa:run` | GREEN |
| Stress tests | `qa:run` | YELLOW |

**Output:**
```
- QA report (JSON)
- Screenshots
- Videos (if available)
- Test coverage
- Pass/fail summary
```

---

### 5. App Executor

| Capability | Permission | Risk |
|------------|-----------|------|
| Open VS Code | `apps:open` | GREEN |
| Open Cursor | `apps:open` | GREEN |
| Open Chrome | `apps:open` | GREEN |
| Open Docker Desktop | `apps:open` | GREEN |
| Open GitHub Desktop | `apps:open` | GREEN |
| Open Terminal | `apps:open` | GREEN |
| Open WhatsApp | BLOCKED | BLACK |
| Open Viber | BLOCKED | BLACK |
| Open Zalo | BLOCKED | BLACK |

---

### 6. Script Executor

| Capability | Permission | Risk |
|------------|-----------|------|
| Run *.build.bat | `scripts:run` | GREEN |
| Run *.test.ps1 | `scripts:run` | GREEN |
| Run start-proxy*.bat | `scripts:run` | GREEN |
| Run unknown script | `scripts:run` | YELLOW |
| Run destructive script | BLOCKED | BLACK |

**Safety Checks:**
- Validate script path is in approved list
- Check for destructive patterns (rm -rf, del /s, format)
- Capture all output
- Enforce timeout (default: 5 minutes)

---

### 7. Cline Executor

| Capability | Permission | Risk |
|------------|-----------|------|
| Open Cline | `cline:control` | GREEN |
| Inject prompt | `cline:control` | YELLOW |
| Read output | `cline:control` | GREEN |
| Monitor status | `cline:control` | GREEN |

---

### 8. Antigravity Executor

| Capability | Permission | Risk |
|------------|-----------|------|
| Open Antigravity | `cline:control` | GREEN |
| Open with project | `cline:control` | GREEN |
| Inject task | `cline:control` | YELLOW |
| Monitor output | `cline:control` | GREEN |

---

### 9. API Proxy Executor

| Capability | Permission | Risk |
|------------|-----------|------|
| Start proxy | `api:proxy` | GREEN |
| Stop proxy | `api:proxy` | GREEN |
| Check status | `api:proxy` | GREEN |
| Restart proxy | `api:proxy` | GREEN |

**Proxy Script:**
```
E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-win.bat
```

---

## Task Routing

```typescript
function routeTask(task: Task): Executor {
  switch (task.type) {
    case 'audit':
    case 'file_read':
    case 'file_write':
      return executors.file;
      
    case 'git_sync':
    case 'git_status':
    case 'git_push':
      return executors.git;
      
    case 'build':
      return executors.build;
      
    case 'qa':
    case 'playwright':
    case 'regression':
      return executors.qa;
      
    case 'app_launch':
    case 'app_open':
      return executors.app;
      
    case 'script':
      return executors.script;
      
    case 'cline_control':
      return executors.cline;
      
    case 'antigravity_control':
      return executors.antigravity;
      
    case 'api_proxy':
      return executors.apiProxy;
      
    default:
      throw new Error(`Unknown task type: ${task.type}`);
  }
}
```

---

## Execution Flow

```
Task Received
     │
     ▼
Permission Check
     │
     ├── Denied → Log + Return Error
     │
     ▼
Route to Executor
     │
     ▼
Execute
     │
     ├── Stream logs (real-time)
     ├── Capture stdout/stderr
     ├── Track duration
     │
     ▼
Complete
     │
     ├── Upload logs
     ├── Upload artifacts
     ├── Report result
     └── Audit log
```

---

## Process Management

```typescript
class ProcessManager {
  private processes: Map<string, ChildProcess> = new Map();
  
  async spawn(taskId: string, command: string, cwd: string): Promise<ExecResult> {
    const child = spawn(command, { shell: true, cwd });
    this.processes.set(taskId, child);
    
    // Stream output
    child.stdout.on('data', (data) => this.streamLog(taskId, 'info', data));
    child.stderr.on('data', (data) => this.streamLog(taskId, 'error', data));
    
    return new Promise((resolve) => {
      child.on('close', (code) => {
        this.processes.delete(taskId);
        resolve({ exitCode: code });
      });
    });
  }
  
  async kill(taskId: string): Promise<void> {
    const proc = this.processes.get(taskId);
    if (proc) {
      proc.kill('SIGTERM');
      this.processes.delete(taskId);
    }
  }
}
```
