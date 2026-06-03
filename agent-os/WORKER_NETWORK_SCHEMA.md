# Worker Network Schema v2

> Agent OS — Cập nhật: 2026-06-01
> Bổ sung: Cline Worker, Intent Engine, Chat Interface layer

---

## Tổng quan kiến trúc

```
CEO
 │
 ▼  (HTTPS / WebSocket)
┌─────────────────────────────────────────────────────────┐
│                   Chat Interface                        │
│         agent.company.local / localhost:3700/chat       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   Intent Engine                         │
│   Parse natural language → structured TaskRequest      │
│   "Build Payroll" → { type: "build", project: "Payroll" }│
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   Task Engine                           │
│   Validate · Prioritize · Queue · Assign Worker        │
└───────┬───────────────┬──────────────────┬─────────────┘
        │               │                  │
        ▼               ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                  Approval Engine                        │
│   Requires Approval? → Wait CEO confirm                 │
│   No Approval? → Execute immediately                   │
└───────┬───────────────┬──────────────────┬─────────────┘
        │               │                  │
        ▼               ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                  Worker Network                         │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ Build Worker│  │  QA Worker  │  │  Git Worker     │ │
│  │ (Cline CLI) │  │ (Jest/Vitest│  │ (git commands)  │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │Deploy Worker│  │ Cline Worker│  │  Cloud Worker   │ │
│  │ (staging)   │  │ (CLI 2.0)   │  │ (Gmail/Drive)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Worker Definitions

### 1. Build Worker

```typescript
interface BuildWorker {
  id: 'build-worker';
  capabilities: ['build', 'compile', 'bundle'];
  tools: ['npm', 'yarn', 'tsc', 'vite', 'webpack'];
  level: 'L1';
  approval_required: false;
  timeout_default: 600; // seconds
}

// Task example
{
  type: 'build',
  project: 'Payroll',
  payload: {
    command: 'npm run build',
    cwd: 'E:\\Project\\Master\\Agent\\agent-coding',
    env: { NODE_ENV: 'production' }
  }
}
```

### 2. QA Worker

```typescript
interface QAWorker {
  id: 'qa-worker';
  capabilities: ['test', 'lint', 'type-check', 'e2e'];
  tools: ['jest', 'vitest', 'playwright', 'eslint', 'tsc'];
  level: 'L1';
  approval_required: false;
  timeout_default: 300;
}

// Task example
{
  type: 'qa',
  project: 'Dashboard',
  payload: {
    suite: 'unit',         // unit | e2e | lint | all
    report: true,
    failOnError: true
  }
}
```

### 3. Git Worker

```typescript
interface GitWorker {
  id: 'git-worker';
  capabilities: ['git-read', 'git-write', 'git-push'];
  tools: ['git'];
  level: 'L2';
  approval_required: false; // push cần review
  timeout_default: 60;
}

// Task example
{
  type: 'git',
  project: 'Master',
  payload: {
    action: 'status',      // status | commit | push | pull | diff
    message: 'feat: add payroll API',
    branch: 'main'
  }
}
```

### 4. Deploy Worker

```typescript
interface DeployWorker {
  id: 'deploy-worker';
  capabilities: ['deploy-staging', 'deploy-production'];
  tools: ['pm2', 'docker', 'ssh'];
  level: 'L3';
  approval_required: true;  // luôn cần CEO duyệt
  timeout_default: 900;
}

// Task example
{
  type: 'deploy',
  project: 'ReviewAuto',
  payload: {
    target: 'staging',     // staging | production
    version: '1.2.0',
    rollback: true
  }
}
```

### 5. Cline Worker ⭐ (Mới — CLI 2.0)

```typescript
interface ClineWorker {
  id: 'cline-worker';
  capabilities: [
    'code-generation',
    'code-review',
    'architecture-audit',
    'bug-fix',
    'refactor',
    'documentation'
  ];
  runtime: 'cline-cli-2.0';
  mode: 'headless';          // -y flag
  output: 'json-stream';     // --json flag
  level: 'L2';
  approval_required: false;
  timeout_default: 3600;
  max_concurrent: 3;
}

// Task example
{
  type: 'cline',
  project: 'Payroll',
  payload: {
    prompt: 'Build a REST API for payroll module with CRUD endpoints',
    projectPath: 'E:\\Project\\Master\\Agent\\agent-coding',
    model: 'claude-sonnet-4-6',
    autonomy: 'full',
    context_files: ['src/types.ts', 'ARCHITECTURE.md']
  }
}
```

**Cách Cline Worker thực thi:**

```typescript
// worker/handlers/cline.handler.ts
import { spawn } from 'child_process';

export async function executeClineTask(task: ClineTask): Promise<TaskResult> {
  const args = [
    '-y',                           // headless, no approval prompts
    '--json',                       // structured output
    '--project', task.payload.projectPath,
    '--model', task.payload.model ?? 'claude-sonnet-4-6',
  ];

  if (task.payload.context_files?.length) {
    args.push('--context', task.payload.context_files.join(','));
  }

  args.push(task.payload.prompt);

  const proc = spawn('cline', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }
  });

  const events: ClineEvent[] = [];
  let lastComplete: any = null;

  proc.stdout.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      try {
        const event = JSON.parse(line) as ClineEvent;
        events.push(event);

        // Stream to Control Plane in real-time
        streamLog(task.id, event.type, event.message ?? JSON.stringify(event));

        if (event.type === 'complete') lastComplete = event;
      } catch {
        streamLog(task.id, 'raw', line);
      }
    }
  });

  return new Promise((resolve, reject) => {
    proc.on('close', (code) => {
      if (code === 0 && lastComplete?.success) {
        resolve({
          success: true,
          summary: lastComplete.summary,
          filesChanged: lastComplete.files_changed,
          events,
        });
      } else {
        reject(new Error(`Cline exited ${code}: ${lastComplete?.error ?? 'unknown'}`));
      }
    });
  });
}
```

### 6. Cloud Worker

```typescript
interface CloudWorker {
  id: 'cloud-worker';
  capabilities: ['gmail', 'google-drive', 'github-api', 'cloudflare', 'dreamhost'];
  level: 'L3';
  approval_required: true;
  requires_separate_token: true;
  timeout_default: 120;
}
```

---

## Task Request Schema

```typescript
interface TaskRequest {
  // Identity
  id: string;           // auto-generated: task-{timestamp}-{random}
  type: TaskType;
  status: TaskStatus;

  // Routing
  worker_id?: string;   // explicit worker, or auto-assigned
  priority: 1 | 2 | 3; // 1 = urgent, 2 = normal, 3 = low

  // Content
  project: string;
  payload: Record<string, any>;  // worker-specific

  // Control
  approval_required: boolean;
  approved_by?: string;
  approved_at?: string;
  timeout: number;       // seconds

  // Lifecycle
  created_at: string;
  started_at?: string;
  completed_at?: string;
  created_by: 'ceo' | 'agent' | 'scheduler';
}

type TaskType =
  | 'build' | 'qa' | 'git' | 'deploy'
  | 'cline' | 'cloud' | 'launch' | 'audit';

type TaskStatus =
  | 'pending' | 'waiting_approval'
  | 'running' | 'complete' | 'failed' | 'cancelled';
```

---

## Intent → Task Mapping

| CEO nói | Intent | Task Type | Worker | Approval |
|---------|--------|-----------|--------|----------|
| "Build Payroll" | build | build + cline | Cline Worker | Không |
| "Audit Dashboard" | audit | cline | Cline Worker | Không |
| "Run QA" | qa | qa | QA Worker | Không |
| "Deploy Review Auto" | deploy | deploy | Deploy Worker | **Có** |
| "Fix Dashboard bug" | fix | cline | Cline Worker | Không |
| "Open Antigravity" | open | launch | PC Worker | Không |
| "Git status all" | git | git | Git Worker | Không |
| "Push to main" | git-push | git | Git Worker | **Có** |
| "Send email to client" | cloud | cloud | Cloud Worker | **Có** |

---

## Approval Flow

```
Task Created
     │
     ▼
approval_required?
     │
  NO ─────────────────────────────▶ Execute Immediately
     │
  YES
     │
     ▼
WebSocket → CEO Chat: "Xác nhận task #XXX không?"
     │
     ▼
CEO responds
     │
  CONFIRM ──────────────────────▶ Execute
  CANCEL ───────────────────────▶ Mark cancelled
  (no response 30min) ──────────▶ Auto-cancel + notify
```

---

## Worker Registration

```typescript
// Worker tự đăng ký khi khởi động
POST /api/workers/register
{
  "name": "cline-worker",
  "hostname": "PC-MAIN",
  "capabilities": ["cline", "build", "qa"],
  "level": "L2",
  "tailscale_ip": "100.x.x.x",
  "version": "2.0.0"
}

// Response
{
  "worker_id": "wk_abc123",
  "token": "tok_...",
  "heartbeat_interval": 5000
}
```

---

## Scaling Path

```
Phase 1 (Now)          Phase 2                Phase 3
─────────────          ────────────────────   ─────────────────────
1 PC                   Multiple PCs           Cloud + On-prem
SQLite                 Redis Queue            PostgreSQL
Single worker          Worker pools           Auto-scaling
Manual deploy          Staging auto-deploy    Full CI/CD pipeline
```
