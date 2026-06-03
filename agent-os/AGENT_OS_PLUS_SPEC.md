# Agent OS+ — Full Specification v2.0

**Date:** 2026-06-01  
**Status:** SPEC DRAFT — PENDING CEO APPROVAL  
**Base:** Agent OS MVP (already built: `agent-control/`, `agent-worker/`, `shared/`)

---

## CEO Vision

> "Không phải Laptop điều khiển PC, mà là **CEO → Agent OS → Multi-Worker**"

```
CEO (MacBook/iPhone)
     │
     ▼
Agent OS Control Plane
     │
     ├── PC Worker (Windows PC)
     ├── Laptop Worker (MacBook)
     ├── VPS Worker (Future)
     └── NAS Worker (Future)
```

CEO chỉ cần nói:
```
"Build payroll"
"Audit dashboard"
"Start API proxy"
"Open Antigravity"
"Run QA"
```

Agent OS tự chọn worker phù hợp, ghi log, yêu cầu approval với task rủi ro cao, và rollback nếu cần.

---

## What's Already Built (MVP)

| Component | Location | Status |
|-----------|----------|--------|
| Control Plane API | `agent-control/` | ✅ Built |
| Worker Node | `agent-worker/` | ✅ Built |
| Task Queue | `agent-control/` | ✅ Built |
| WebSocket Streaming | `agent-control/` | ✅ Built |
| Permission Model (L1/L2/L3) | `PERMISSION_MODEL.md` | ✅ Spec'd |
| Capability Matrix | `WORKER_CAPABILITY_MATRIX.md` | ✅ Spec'd |
| Security Audit Log | `SECURITY_AUDIT_LOG.md` | ✅ Spec'd |
| Dashboard UI | `agent-control/public/` | ✅ Built |
| Worker Registry | `agent-control/` | ✅ Built |
| Heartbeat (5s) | `agent-worker/` | ✅ Built |
| Tailscale Integration | `agent-worker/` | ✅ Built |

---

## What's Missing (CEO's 4 Requirements)

| # | Feature | Status | Priority |
|---|---------|--------|----------|
| 1 | **Approval Engine** | ❌ NOT built | 🔴 HIGH |
| 2 | **Multiple Executors** | ⚠️ Generic handlers, not split | 🔴 HIGH |
| 3 | **Artifact Storage** | ⚠️ Schema exists, UI not built | 🟡 MEDIUM |
| 4 | **Emergency Kill Switch** | ❌ Not implemented | 🔴 HIGH |

---

# Feature 1: Approval Engine

## Concept

Thêm governance layer giữa Task và Execution:

```
Task → Risk Assessment → Approval Engine → Worker → Execute
```

## Task Risk Classification

| Task Type | Auto Run | Requires Approval |
|-----------|----------|-----------------|
| Git status | ✅ | ❌ |
| Audit source | ✅ | ❌ |
| Start API proxy | ✅ | ❌ |
| Open VSCode | ✅ | ❌ |
| Run QA | ✅ | ❌ |
| Build project | ✅ | ❌ |
| Git push | ❌ | CEO |
| Delete folder | ❌ | CEO |
| Deploy production | ❌ | CEO |
| Cloudflare DNS | ❌ | CEO |
| Send email | ❌ | CEO |
| Delete files | ❌ | CEO |

## Risk Levels

```typescript
enum RiskLevel {
  SAFE = 'safe',         // Auto run, log only
  ELEVATED = 'elevated', // Log + notify CEO
  DANGEROUS = 'dangerous', // CEO explicit approval required
  CRITICAL = 'critical'   // CEO + additional verification
}

interface TaskApproval {
  taskId: string;
  riskLevel: RiskLevel;
  requiresCEOApproval: boolean;
  approvalStatus: 'pending' | 'approved' | 'denied' | 'auto_approved';
  approvedBy?: string;      // 'ceo', 'system', 'worker-level'
  approvedAt?: Date;
  reason?: string;
  changedBy?: string;      // For elevated tasks
}
```

## Approval API

```
POST   /api/tasks/:id/approve      — CEO approves task
POST   /api/tasks/:id/deny         — CEO denies task
GET    /api/tasks/:id/approval     — Get approval status
GET    /api/approvals/pending      — List pending approvals
POST   /api/approvals/bulk-approve  — Bulk approve (for batch tasks)
```

## Dashboard Approval UI

```
┌─────────────────────────────────────────────────────────┐
│ 🔴 PENDING APPROVALS (3)                                │
├─────────────────────────────────────────────────────────┤
│ ⚠️ git push → main (agent-coding)     [APPROVE] [DENY] │
│ ⚠️ Deploy production (review-auto)  [APPROVE] [DENY] │
│ ⚠️ Delete _archive/temp/             [APPROVE] [DENY] │
│                                                          │
│ ✅ Auto-approved (last 24h): 47 tasks                  │
└─────────────────────────────────────────────────────────┘
```

## Push-to-Main Protection

Git push to `main` branch requires:
1. `CHANGE_SUMMARY.md` exists in repo
2. CEO approval
3. At least 1 passing CI check

---

# Feature 2: Multiple Executors (Executor Pool)

## Concept

Tách Worker thành nhiều specialized executors:

```
Agent Worker
│
├── File Executor     — Read/Write/Delete files
├── Git Executor      — Git operations
├── Build Executor    — npm, python, docker builds
├── QA Executor       — Playwright, pytest, tests
├── App Executor      — Open/close applications
├── Script Executor   — Run .ps1, .bat, .sh scripts
├── Cloud Executor    — DreamHost, Cloudflare, GitHub API
└── Deploy Executor   — Staging/production deploys
```

## Why Split?

1. **Dễ debug** — Mỗi executor có log riêng
2. **Dễ cấp quyền** — Executor có capability riêng
3. **Dễ mở rộng** — Thêm executor mới không ảnh hưởng others
4. **Dễ disable** — Kill switch có thể stop từng executor

## Executor Architecture

```typescript
interface Executor {
  name: string;
  capabilities: string[];      // e.g., ['filesystem:*', 'git:read']
  maxConcurrency: number;     // Max parallel tasks
  timeout: number;             // Default timeout (ms)
  handlers: Map<string, TaskHandler>;
  
  // Core methods
  canHandle(task: Task): boolean;
  execute(task: Task): Promise<TaskResult>;
  validate(task: Task): ValidationResult;
  kill(taskId: string): void;
}

// Executor Registry
class ExecutorPool {
  executors: Map<string, Executor>;
  
  getExecutorForTask(task: Task): Executor;
  getAllExecutors(): Executor[];
  getExecutorStatus(): ExecutorStatus[];
  enableExecutor(name: string): void;
  disableExecutor(name: string): void;  // Kill switch per executor
}
```

## Executor Details

### File Executor
```
Capabilities: filesystem:read, filesystem:write
Handlers: read_file, write_file, list_dir, search_files
Max concurrency: 5
Timeout: 30000ms
```

### Git Executor
```
Capabilities: git:read, git:write, git:push
Handlers: git_status, git_pull, git_commit, git_push, git_diff
Max concurrency: 2
Timeout: 60000ms
Pre-flight: Check CHANGE_SUMMARY.md for push
```

### Build Executor
```
Capabilities: build:run, deploy:staging
Handlers: npm_build, python_build, docker_build, deploy_staging
Max concurrency: 2
Timeout: 300000ms (5 min)
```

### QA Executor
```
Capabilities: qa:run
Handlers: playwright_test, pytest_run, jest_test, cypress_test
Max concurrency: 3
Timeout: 600000ms (10 min)
```

### App Executor
```
Capabilities: apps:open, apps:close
Handlers: open_app, close_app, list_apps
Max concurrency: 10
Timeout: 5000ms
Whitelist: APPROVED_APPS list
```

### Script Executor
```
Capabilities: scripts:run
Handlers: run_ps1, run_bat, run_sh
Max concurrency: 5
Timeout: 300000ms
Security: Pattern matching for dangerous commands
```

### Cloud Executor
```
Capabilities: cloud:*
Handlers: dreamhost_*, cloudflare_*, gdrive_*, github_*
Max concurrency: 2
Timeout: 120000ms
Security: Token validation, rate limiting
```

### Deploy Executor
```
Capabilities: deploy:staging, deploy:production
Handlers: deploy_staging, deploy_production, rollback
Max concurrency: 1
Timeout: 600000ms
Security: Requires approval for production
```

## Task → Executor Mapping

```typescript
const TASK_EXECUTOR_MAP: Record<string, string> = {
  'git:status': 'git',
  'git:pull': 'git',
  'git:commit': 'git',
  'git:push': 'git',
  'build:npm': 'build',
  'build:python': 'build',
  'build:docker': 'build',
  'qa:playwright': 'qa',
  'qa:pytest': 'qa',
  'file:read': 'file',
  'file:write': 'file',
  'file:delete': 'file',
  'app:open': 'app',
  'app:close': 'app',
  'script:run': 'script',
  'cloud:dreamhost': 'cloud',
  'cloud:cloudflare': 'cloud',
  'deploy:staging': 'deploy',
  'deploy:production': 'deploy',
};
```

---

# Feature 3: Artifact Storage

## Concept

Mọi thứ Agent tạo ra được lưu lại với full context:

```
artifacts/
├── audit-reports/     # Source audit outputs
├── build-logs/        # Build output logs
├── qa-results/        # Test results (JSON + screenshots)
├── screenshots/      # Visual evidence
├── videos/            # Recording of task execution
├── deploy-reports/    # Deploy logs
├── git-reports/       # Git operation reports
└── exports/           # Data exports
```

## Artifact Schema

```typescript
interface Artifact {
  id: string;
  taskId: string;
  type: ArtifactType;
  filename: string;
  path: string;          // Relative to artifacts/
  size: number;          // bytes
  mimeType: string;
  checksum: string;      // SHA256
  createdAt: Date;
  metadata: Record<string, any>;
}

enum ArtifactType {
  REPORT = 'report',      // Markdown/HTML reports
  LOG = 'log',           // .log, .txt files
  JSON = 'json',         // Structured data
  IMAGE = 'image',       // Screenshots
  VIDEO = 'video',       // Recording
  ARCHIVE = 'archive',   // .zip, .tar.gz
  BUILD_OUTPUT = 'build', // Build artifacts
  TEST_RESULT = 'test',  // Test results
}
```

## Task Context View

When CEO views Task #421:

```
┌─────────────────────────────────────────────────────────┐
│ Task #421 — Build payroll app                          │
│ Worker: office-pc-1  │  Status: COMPLETED  │  Duration: 2m │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📄 Report      📋 Logs      📁 Files     🖼️ Screenshots │
│ 🎬 Video      📊 Results   📦 Exports                   │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ BUILD LOG                                          │ │
│ │ $ npm run build                                    │ │
│ │ > payroll-app@1.0.0 build                         │ │
│ │ > tsc && webpack --mode production                │ │
│ │ ✓ Compiled successfully in 1.8s                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Files: build.zip (2.3MB)  screenshot.png  report.md   │
└─────────────────────────────────────────────────────────┘
```

## Artifact API

```
GET  /api/tasks/:id/artifacts          — List all artifacts
GET  /api/artifacts/:id                — Get artifact metadata
GET  /api/artifacts/:id/download        — Download artifact
GET  /api/artifacts/:id/preview         — Preview (images, markdown)
POST /api/artifacts/:id/tag             — Add tags
GET  /api/artifacts/search              — Search artifacts
```

## Storage Configuration

```typescript
interface ArtifactStorage {
  basePath: string;        // 'E:\\Project\\Master\\agent-os\\artifacts'
  maxSizePerTask: number;  // 500MB default
  retention: {
    report: 90,    // days
    log: 30,
    image: 14,
    video: 7,
  };
  compression: boolean;    // Gzip for logs
  backupPath?: string;     // Optional F:\\ backup
}
```

---

# Feature 4: Emergency Kill Switch

## Concept

CEO có thể stop bất kỳ operation nào từ MacBook/iPhone trong 1 click:

```
Emergency Panel (Dashboard)
│
├── ⏹ Stop Worker        — Stop entire worker
├── ⏹ Stop Executor      — Stop specific executor
│     ├── File Executor
│     ├── Git Executor
│     ├── Build Executor
│     ├── QA Executor
│     ├── App Executor
│     ├── Script Executor
│     ├── Cloud Executor
│     └── Deploy Executor
├── ⏹ Stop Task          — Stop specific task
├── ⛔ Kill Process       — Force kill process on PC
└── 🔄 Rollback           — Rollback last deploy
```

## Kill Switch API

```
POST /api/workers/:id/stop              — Stop entire worker
POST /api/workers/:id/executors/:name/stop  — Stop specific executor
POST /api/tasks/:id/kill                — Kill running task
POST /api/processes/:pid/kill           — Force kill process
POST /api/deploy/:id/rollback           — Rollback deploy
```

## Mobile-Friendly Kill Panel

```
┌─────────────────────────────┐
│  🛑 EMERGENCY KILL         │
├─────────────────────────────┤
│                             │
│  ⏹ Stop All Workers        │
│  [RED — STOP EVERYTHING]    │
│                             │
│  ⏹ office-pc-1             │
│    Executor: [Build ⚠️]     │
│    Task: #421 (running)     │
│    [STOP] [KILL PROCESS]    │
│                             │
│  ⏹ macbook-worker           │
│    Executor: [Git]          │
│    Task: idle               │
│    [DISABLE EXECUTOR ▼]     │
│                             │
│  🔄 Rollback Last Deploy    │
│    review-auto-system        │
│    v1.2.3 → v1.2.2          │
│    [ROLLBACK NOW]           │
│                             │
└─────────────────────────────┘
```

## Kill Switch Security

```typescript
interface KillSwitchConfig {
  // Who can trigger kill switch
  allowedUsers: string[];      // ['ceo-macbook', 'ceo-iphone']
  requireReAuth: boolean;       // Require password for critical kills
  requireConfirmation: boolean; // Confirm before execution
  
  // What can be killed
  canKillWorker: boolean;      // Stop entire worker
  canKillExecutor: boolean;     // Stop specific executor
  canKillTask: boolean;         // Stop task
  canKillProcess: boolean;      // Force kill process
  canRollback: boolean;         // Rollback deploy
  
  // Cooldowns
  killCooldown: number;         // ms between kills (prevent spam)
  criticalKillCooldown: number; // ms for critical kills (30s)
}
```

## Kill Confirmation Flow

```
1. CEO clicks "Stop All Workers"
2. Modal: "Are you sure? This will stop all running tasks."
3. CEO confirms
4. Control Plane → Sends STOP signal to all workers
5. Workers → Stop all executors gracefully
6. Workers → Send STOP_ACK to Control Plane
7. Control Plane → Update all task statuses to KILLED
8. CEO receives notification: "All workers stopped"
```

## Graceful vs Force Kill

| Method | Signal | Use Case |
|--------|--------|----------|
| Graceful Stop | SIGTERM | Normal task cancellation |
| Force Kill | SIGKILL | Task doesn't respond to SIGTERM |
| Process Kill | taskkill /F | Force kill by PID |
| Worker Stop | WebSocket | Stop entire worker node |

---

# Feature 5: Multi-Worker Support

## Concept

CEO có thể điều khiển nhiều workers:

```
┌──────────────────────────────────────────────────────────────┐
│ Agent OS Dashboard — Workers                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  🖥️ office-pc-1 (Windows)         ● ONLINE  [ACTIVE]        │
│     IP: 100.x.x.x (Tailscale)    Uptime: 3d 14h             │
│     Executors: 7/7 active        Tasks: 127 done            │
│                                                              │
│  💻 macbook-worker (macOS)        ● ONLINE  [ACTIVE]        │
│     IP: 100.x.x.x (Tailscale)    Uptime: 1d 2h             │
│     Executors: 5/7 active        Tasks: 43 done             │
│                                                              │
│  ☁️ vps-worker-1 (Ubuntu)         ○ OFFLINE                 │
│     IP: —                        Last seen: 2h ago           │
│                                                              │
│  � NAS-worker (Synology)          ○ OFFLINE                 │
│     IP: —                        Last seen: 5d ago           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Worker Selection Strategy

```typescript
interface WorkerSelector {
  // Pick best worker for task
  selectWorker(task: Task, workers: Worker[]): Worker;
  
  // Selection strategies
  strategies: {
    // Pick worker with matching capabilities
    byCapability: boolean;
    // Pick least busy worker
    byLoad: boolean;
    // Pick worker in same network
    byNetwork: boolean;
    // Prefer specific OS
    byOS: 'windows' | 'macos' | 'linux';
  };
}
```

## Worker Capability Declaration

```typescript
interface WorkerCapabilities {
  workerId: string;
  os: 'windows' | 'macos' | 'linux';
  executors: string[];           // ['file', 'git', 'build', 'qa', 'app', 'script', 'cloud', 'deploy']
  maxConcurrency: number;
  resources: {
    cpuCores: number;
    memoryGB: number;
    diskGB: number;
  };
  network: {
    hasTailscale: boolean;
    hasSSH: boolean;
  };
  approved: boolean;             // CEO approved
  level: 'L1' | 'L2' | 'L3';
}
```

---

# Feature 6: Governance Dashboard

## Overview

Một dashboard tổng hợp cho CEO:

```
┌──────────────────────────────────────────────────────────────┐
│ 🏛️ Agent OS — Governance                                    │
├─────────────────┬──────────────────────────────────────────┤
│                  │                                           │
│ 📊 Overview      │  🔴 PENDING APPROVALS (2)                │
│ 👥 Workers       │                                           │
│ ⏱️ Tasks         │  ⚠️ git push → main (agent-coding)       │
│ 📁 Artifacts     │     Worker: office-pc-1                  │
│ 🛑 Kill Switch   │     [APPROVE] [DENY] [VIEW DIFF]         │
│ 📋 Audit Log     │                                           │
│ ⚙️ Settings      │  ⚠️ Deploy production (review-auto)     │
│                  │     Worker: office-pc-1                  │
│                  │     [APPROVE] [DENY]                     │
│                  │                                           │
│                  ├──────────────────────────────────────────┤
│                  │  📊 LAST 24 HOURS                        │
│                  │  Tasks: 127  │  Approved: 125  │  Failed: 2 │
│                  │  Workers: 2  │  Executors: 16   │  Artifacts: 47 │
│                  │                                           │
│                  ├──────────────────────────────────────────┤
│                  │  ⚠️ ALERTS                               │
│                  │  • Worker macbook-worker lost heartbeat   │
│                  │  • Task #445 failed (pytest)            │
│                  │  • New worker detected: nas-worker       │
│                  │                                           │
└──────────────────┴──────────────────────────────────────────┘
```

---

# Implementation Roadmap

## Phase 1: Core Kill Switch + Approval Engine
**Timeline:** 1 week  
**Deliverables:**
- [ ] Kill switch API endpoints
- [ ] Kill switch dashboard panel
- [ ] Approval engine (risk classification)
- [ ] Approval UI (pending list)
- [ ] Push-to-main protection

## Phase 2: Executor Split
**Timeline:** 1 week  
**Deliverables:**
- [ ] Executor interface (abstract)
- [ ] FileExecutor implementation
- [ ] GitExecutor implementation
- [ ] BuildExecutor implementation
- [ ] QAExecutor implementation
- [ ] AppExecutor implementation
- [ ] ScriptExecutor implementation
- [ ] CloudExecutor implementation
- [ ] DeployExecutor implementation
- [ ] ExecutorPool registry

## Phase 3: Artifact Storage
**Timeline:** 3 days  
**Deliverables:**
- [ ] Artifact storage service
- [ ] Artifact API
- [ ] Artifact viewer UI
- [ ] Screenshot capture
- [ ] Log aggregation

## Phase 4: Multi-Worker
**Timeline:** 1 week  
**Deliverables:**
- [ ] Worker capability declaration
- [ ] Worker selector
- [ ] Multi-worker dashboard
- [ ] Worker-specific task assignment

## Phase 5: Rollback Engine
**Timeline:** 3 days  
**Deliverables:**
- [ ] Deploy snapshot before deploy
- [ ] Rollback API
- [ ] Rollback UI
- [ ] Rollback verification

---

# API Summary (Full)

```
# Control Plane
GET    /api/health
GET    /api/stats

# Workers
GET    /api/workers
POST   /api/workers/register
GET    /api/workers/:id
POST   /api/workers/:id/heartbeat
POST   /api/workers/:id/stop              ← NEW: Kill worker
POST   /api/workers/:id/executors/:name/stop  ← NEW: Kill executor

# Tasks
GET    /api/tasks
POST   /api/tasks
GET    /api/tasks/:id
POST   /api/tasks/:id/cancel
POST   /api/tasks/:id/retry
POST   /api/tasks/:id/kill               ← NEW: Kill task
GET    /api/tasks/:id/logs
GET    /api/tasks/:id/artifacts
GET    /api/tasks/:id/artifacts/:aid/preview

# Approval Engine
GET    /api/approvals/pending             ← NEW
POST   /api/tasks/:id/approve            ← NEW
POST   /api/tasks/:id/deny               ← NEW
GET    /api/tasks/:id/approval           ← NEW

# Artifacts
GET    /api/artifacts
GET    /api/artifacts/search
GET    /api/artifacts/:id
GET    /api/artifacts/:id/download
GET    /api/artifacts/:id/preview
POST   /api/artifacts/:id/tag

# Audit Log
GET    /api/audit
GET    /api/audit/search

# Rollback
POST   /api/deploy/:id/rollback          ← NEW
GET    /api/deploy/history

# Process
POST   /api/processes/:pid/kill          ← NEW

# WebSocket Events
task:created, task:updated, task:completed, task:failed, task:killed
worker:registered, worker:heartbeat, worker:offline, worker:stopped
approval:pending, approval:resolved
executor:started, executor:stopped, executor:error
```

---

# Database Schema (Extended)

```sql
-- Workers
CREATE TABLE workers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hostname TEXT,
  os TEXT,
  tailscale_ip TEXT,
  token TEXT NOT NULL,
  level TEXT DEFAULT 'L1',
  status TEXT DEFAULT 'offline',
  executors TEXT,              -- JSON: ['file', 'git', 'build', ...]
  registered_at TEXT,
  last_heartbeat TEXT,
  stopped_at TEXT
);

-- Tasks (extended)
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  project TEXT,
  worker_id TEXT,
  executor TEXT,               -- NEW: which executor handles it
  payload TEXT,                -- JSON
  result TEXT,                 -- JSON
  risk_level TEXT DEFAULT 'safe',
  approval_status TEXT,         -- NEW: pending/approved/denied/auto_approved
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  error TEXT
);

-- Approvals (NEW)
CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  requested_by TEXT,
  approved_by TEXT,
  denied_by TEXT,
  reason TEXT,
  created_at TEXT,
  resolved_at TEXT,
  change_summary TEXT          -- For git push
);

-- Artifacts (NEW)
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  type TEXT NOT NULL,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  size INTEGER,
  mime_type TEXT,
  checksum TEXT,
  metadata TEXT,               -- JSON
  created_at TEXT
);

-- Executor Status (NEW)
CREATE TABLE executor_status (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  executor TEXT NOT NULL,
  status TEXT DEFAULT 'idle',
  current_task_id TEXT,
  started_at TEXT,
  error TEXT,
  FOREIGN KEY (worker_id) REFERENCES workers(id)
);

-- Deploy History (NEW)
CREATE TABLE deploy_history (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  version TEXT NOT NULL,
  snapshot_path TEXT,
  deployed_by TEXT,
  deployed_at TEXT,
  status TEXT,
  rolled_back_at TEXT,
  rolled_back_to TEXT
);

-- Audit Logs (extended)
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  worker_id TEXT,
  worker_name TEXT,
  worker_level TEXT,
  task_id TEXT,
  executor TEXT,               -- NEW
  type TEXT NOT NULL,
  action TEXT NOT NULL,
  project TEXT,
  permission TEXT,
  status TEXT NOT NULL,
  result TEXT,
  risk_level TEXT,             -- NEW
  approval_id TEXT,             -- NEW
  ip TEXT,
  user_agent TEXT
);
```
