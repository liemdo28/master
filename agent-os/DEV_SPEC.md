# Agent OS — Dev Spec v2

> Tài liệu kỹ thuật cho Dev team
> Phiên bản: 2.0 | Ngày: 2026-06-01
> Mục tiêu: CEO chat → Agent thực thi → Kết quả

---

## Tóm tắt yêu cầu

CEO mở `agent.company.local` (hoặc `localhost:3700`), gõ lệnh bằng tiếng Việt/Anh, Agent OS tự động:
1. Hiểu ý định (Intent Engine)
2. Tạo task có cấu trúc (Task Engine)
3. Xin duyệt nếu cần (Approval Engine)
4. Giao cho Worker thực thi (Worker Network)
5. Stream kết quả về chat real-time

---

## Kiến trúc tổng thể

```
[CEO Browser]
     │  WebSocket + HTTP
     ▼
[Control Plane — Port 3700]
  ├── Chat API          POST /api/chat/message
  ├── Intent Engine     parse natural language
  ├── Task API          CRUD /api/tasks
  ├── Worker API        /api/workers
  ├── Approval API      /api/approvals
  └── WebSocket         ws://localhost:3700
          │
     Tailscale VPN
          │
[Worker Network]
  ├── Build Worker      npm/tsc/vite
  ├── QA Worker         jest/vitest/playwright
  ├── Git Worker        git commands
  ├── Deploy Worker     pm2/docker
  ├── Cline Worker      cline CLI 2.0 (-y --json)
  └── Cloud Worker      Gmail/Drive/GitHub API
```

---

## 1. Chat Interface

### File: `agent-control/public/chat/index.html`

**Đã có prototype tại:** `agent-os/CEO_CHAT_UI/index.html`

### API endpoint mới cần thêm:

```typescript
// POST /api/chat/message
interface ChatMessageRequest {
  text: string;
  session_id: string;
}

interface ChatMessageResponse {
  message_id: string;
  intent: ParsedIntent;
  task?: TaskDraft;      // nếu parse được task
  reply: string;         // text trả lời cho CEO
  requires_confirm: boolean;
}
```

### WebSocket events cho Chat:

```typescript
// Server → Client
{ type: 'chat_reply',    message: string, task_id?: string }
{ type: 'task_created',  task: Task }
{ type: 'task_log',      task_id: string, level: string, message: string }
{ type: 'task_complete', task_id: string, summary: string }
{ type: 'task_failed',   task_id: string, error: string }
{ type: 'approval_req',  task_id: string, task: Task }

// Client → Server
{ type: 'chat_message',  text: string, session_id: string }
{ type: 'task_confirm',  task_id: string }
{ type: 'task_cancel',   task_id: string }
```

---

## 2. Intent Engine

### File: `agent-control/src/intent/intent-engine.ts`

```typescript
interface ParsedIntent {
  action: 'build' | 'audit' | 'qa' | 'deploy' | 'cline' | 'git' | 'open' | 'cloud' | 'unknown';
  project: string;
  raw_text: string;
  confidence: number;      // 0–1
  worker_suggestion: string;
  approval_required: boolean;
  extracted_params: Record<string, string>;
}

class IntentEngine {
  parse(text: string): ParsedIntent {
    // Phase 1: Rule-based keyword matching (đủ dùng cho MVP)
    // Phase 2: Claude API call cho complex intents
  }
}
```

### Keyword rules:

```typescript
const INTENT_RULES = [
  {
    pattern: /\b(build|tạo|làm|xây)\b/i,
    action: 'build',
    worker: 'cline-worker',
    approval: false,
  },
  {
    pattern: /\b(audit|kiểm tra|review|check|scan)\b/i,
    action: 'audit',
    worker: 'cline-worker',
    approval: false,
  },
  {
    pattern: /\b(qa|test|kiểm thử|unit test|e2e)\b/i,
    action: 'qa',
    worker: 'qa-worker',
    approval: false,
  },
  {
    pattern: /\b(deploy|triển khai|publish|release)\b/i,
    action: 'deploy',
    worker: 'deploy-worker',
    approval: true,
  },
  {
    pattern: /\b(fix|sửa|debug|lỗi)\b/i,
    action: 'cline',
    worker: 'cline-worker',
    approval: false,
  },
  {
    pattern: /\b(git|commit|push|pull|branch)\b/i,
    action: 'git',
    worker: 'git-worker',
    approval: false,
  },
  {
    pattern: /\b(open|mở|launch|start)\b/i,
    action: 'open',
    worker: 'pc-worker',
    approval: false,
  },
  {
    pattern: /\b(email|gmail|gửi|send|drive)\b/i,
    action: 'cloud',
    worker: 'cloud-worker',
    approval: true,
  },
];
```

### Project extraction:

```typescript
const KNOWN_PROJECTS = [
  'Payroll', 'Dashboard', 'ReviewAuto', 'Master',
  'Agent', 'QA', 'RawSushi', 'Bakudan', 'APIProxy'
];

function extractProject(text: string): string {
  for (const p of KNOWN_PROJECTS) {
    if (text.toLowerCase().includes(p.toLowerCase())) return p;
  }
  // Fallback: last capitalized word
  const match = text.match(/\b[A-Z][a-zA-Z]+\b/g);
  return match?.[match.length - 1] ?? 'Master';
}
```

---

## 3. Cline Worker (QUAN TRỌNG NHẤT)

### File: `agent-worker/src/handlers/cline.handler.ts`

### Yêu cầu môi trường:

```bash
# Cài Cline CLI 2.0
npm install -g @cline/cli

# Verify
cline --version   # phải >= 2.0.0

# Set API key
ANTHROPIC_API_KEY=sk-ant-...
```

### Handler code:

```typescript
import { spawn } from 'child_process';
import path from 'path';

export interface ClineTaskPayload {
  prompt: string;
  projectPath: string;
  model?: string;
  context_files?: string[];
  autonomy?: 'full' | 'ask';
}

export async function handleClineTask(
  task: Task,
  streamLog: (level: string, msg: string) => void
): Promise<TaskResult> {

  const payload = task.payload as ClineTaskPayload;

  const args: string[] = [
    '-y',                          // headless (no UI prompts)
    '--json',                      // machine-readable output
    '--project', payload.projectPath,
    '--model',   payload.model ?? process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
  ];

  if (payload.context_files?.length) {
    for (const f of payload.context_files) {
      args.push('--context', path.resolve(payload.projectPath, f));
    }
  }

  args.push(payload.prompt);

  streamLog('info', `cline ${args.filter(a => !a.startsWith('sk-')).join(' ')}`);

  const proc = spawn('cline', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    },
    cwd: payload.projectPath,
  });

  const events: any[] = [];
  let completeEvent: any = null;

  proc.stdout.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      try {
        const ev = JSON.parse(line);
        events.push(ev);

        switch (ev.type) {
          case 'tool_call':
            streamLog('info', `[tool] ${ev.tool}: ${ev.path ?? ev.command ?? ''}`);
            break;
          case 'log':
            streamLog(ev.level ?? 'info', ev.message);
            break;
          case 'complete':
            completeEvent = ev;
            streamLog('ok', `Hoàn thành: ${ev.summary}`);
            break;
          case 'error':
            streamLog('error', ev.message);
            break;
        }
      } catch {
        // Raw text line — stream as-is
        if (line.trim()) streamLog('raw', line);
      }
    }
  });

  proc.stderr.on('data', (chunk: Buffer) => {
    streamLog('warn', chunk.toString().trim());
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(`Cline task timeout after ${task.timeout}s`));
    }, (task.timeout ?? 3600) * 1000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0 && completeEvent?.success) {
        resolve({
          success: true,
          summary: completeEvent.summary,
          files_changed: completeEvent.files_changed ?? 0,
          events,
        });
      } else {
        reject(new Error(`Cline exited ${code}: ${completeEvent?.error ?? 'no complete event'}`));
      }
    });
  });
}
```

---

## 4. Approval Engine

### File: `agent-control/src/approval/approval-engine.ts`

```typescript
class ApprovalEngine {
  // Task cần duyệt → push về CEO chat qua WebSocket
  async requestApproval(task: Task): Promise<'approved' | 'cancelled'> {
    // 1. Set task.status = 'waiting_approval'
    // 2. Broadcast approval_req event qua WebSocket
    // 3. Wait for CEO response (timeout: 30 min)
    // 4. Return result

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.cancelTask(task.id);
        resolve('cancelled');
      }, 30 * 60 * 1000);

      this.pendingApprovals.set(task.id, {
        resolve: (decision: string) => {
          clearTimeout(timeout);
          resolve(decision as any);
        }
      });
    });
  }

  handleCEODecision(task_id: string, decision: 'approved' | 'cancelled') {
    const pending = this.pendingApprovals.get(task_id);
    if (pending) {
      pending.resolve(decision);
      this.pendingApprovals.delete(task_id);
    }
  }
}
```

---

## 5. Database — Thêm bảng mới

```sql
-- Chat messages
CREATE TABLE chat_messages (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  role        TEXT NOT NULL,  -- 'ceo' | 'agent'
  content     TEXT NOT NULL,
  task_id     TEXT,           -- nếu message liên quan đến task
  created_at  TEXT NOT NULL
);

-- Approvals
CREATE TABLE approvals (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL,
  status      TEXT NOT NULL,  -- 'pending' | 'approved' | 'cancelled'
  requested_at TEXT NOT NULL,
  decided_at  TEXT,
  decided_by  TEXT
);
```

---

## 6. Checklist tích hợp Cline

Dev cần verify các điều sau TRƯỚC khi bắt đầu code:

```bash
# 1. Cline CLI installed?
cline --version

# 2. Headless mode works?
cline -y --json --project "E:\Project\Master" "echo hello" 2>&1

# 3. JSON output parseable?
echo '{"type":"test"}' | node -e "process.stdin.on('data',d=>JSON.parse(d))"

# 4. API key set?
echo $ANTHROPIC_API_KEY | cut -c1-10

# 5. Antigravity headless?
# (check nội bộ — xem file CLINE_API_RESEARCH.md phần Antigravity)
```

---

## 7. Thứ tự implementation

```
Week 1
  [x] Control Plane (đã có)
  [x] Worker Node (đã có)
  [ ] Cline Worker handler
  [ ] Intent Engine (rule-based)
  [ ] Chat API endpoint

Week 2
  [ ] Chat UI (prototype đã có tại CEO_CHAT_UI/index.html)
  [ ] WebSocket events cho chat
  [ ] Approval flow

Week 3
  [ ] Antigravity integration (pending API check)
  [ ] Cloud Worker
  [ ] Intent Engine v2 (Claude API)

Week 4
  [ ] Production hardening
  [ ] Error recovery
  [ ] CEO training
```

---

## 8. Files cần tạo mới

```
agent-control/src/
  ├── chat/
  │   ├── chat.routes.ts       # POST /api/chat/message
  │   ├── chat.service.ts      # business logic
  │   └── chat.ws.ts           # WebSocket handlers
  ├── intent/
  │   └── intent-engine.ts     # parse CEO commands
  └── approval/
      └── approval-engine.ts   # approval flow

agent-worker/src/handlers/
  └── cline.handler.ts         # Cline CLI 2.0 integration

agent-control/public/
  └── chat/
      └── index.html           # copy từ CEO_CHAT_UI/index.html
```

---

## 9. Environment Variables

```env
# Control Plane
CONTROL_PORT=3700
DB_PATH=./data/agent-os.db
JWT_SECRET=...

# Worker
CONTROL_URL=http://100.x.x.x:3700
WORKER_NAME=pc-main
WORKER_LEVEL=L2

# Cline Worker
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6
CLINE_TIMEOUT=3600

# Cloud Worker (L3 only)
GMAIL_CREDENTIALS_PATH=./secrets/gmail.json
GITHUB_TOKEN=...
```

---

## 10. Phụ lục — Câu hỏi cần hỏi Dev

1. Antigravity có `--headless` hoặc `--cli` mode không?
2. Antigravity có HTTP/WebSocket API không? Port nào?
3. Antigravity có config file không? (để inject model/key)
4. Cline CLI 2.0 đã cài trên PC chưa?
5. Node version trên PC là bao nhiêu? (Cline CLI cần Node 20+)
6. Tailscale IP của PC là gì?
7. Muốn deploy Chat UI ở port nào? (đề xuất: 3700 chung hoặc 3701 riêng)

---

*Xem thêm:*
- [CLINE_API_RESEARCH.md](./CLINE_API_RESEARCH.md) — chi tiết Cline CLI 2.0 API
- [WORKER_NETWORK_SCHEMA.md](./WORKER_NETWORK_SCHEMA.md) — schema đầy đủ
- [CEO_CHAT_UI/index.html](./CEO_CHAT_UI/index.html) — prototype Chat UI
- [ARCHITECTURE.md](./ARCHITECTURE.md) — kiến trúc tổng thể
