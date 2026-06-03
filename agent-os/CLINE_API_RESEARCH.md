# Cline & Antigravity API Research

> Cập nhật: 2026-06-01 | Mục đích: Xác nhận khả năng tích hợp Agent OS

---

## Kết luận nhanh

| Câu hỏi | Trả lời |
|---------|---------|
| Cline có API không? | ✅ **Có** — CLI 2.0 gRPC + Node.js SDK |
| Có CLI mode không? | ✅ **Có** — `cline` command từ terminal |
| Có headless mode không? | ✅ **Có** — flag `-y` (full autonomy, no UI) |
| Có JSON output không? | ✅ **Có** — flag `--json` stream structured output |
| Có thể pipe/chain không? | ✅ **Có** — stdin/stdout đầy đủ |
| Cline có thể là Worker không? | ✅ **Có** — spawn process, đọc output |
| Multi-agent support? | ✅ **Có** — coordinator + specialist agents |
| Antigravity có API không? | ⚠️ **Chưa xác nhận** — cần kiểm tra nội bộ |

---

## Cline CLI 2.0 — Released 2026-02-13

### Cách chạy headless

```bash
# Headless hoàn toàn, không cần UI
cline -y "Build the payroll REST API"

# JSON output để Agent đọc
cline -y --json "Run QA on dashboard"

# Pipe input
echo "Audit architecture" | cline -y --json

# Dùng trong CI/CD
cline -y --json "Fix failing tests" 2>&1 | tee output.log
```

### Flags quan trọng

| Flag | Mô tả |
|------|-------|
| `-y` | Full autonomy — không hỏi approval, chạy thẳng |
| `--json` | Stream structured JSON output (machine-readable) |
| `--acp` | ACP protocol mode (cho editors) |
| `--project <path>` | Chỉ định project directory |
| `--model <id>` | Chọn model (claude-sonnet-4-6, etc.) |

### JSON Output Format

```json
{
  "type": "tool_call",
  "tool": "write_file",
  "path": "src/payroll/api.ts",
  "timestamp": "2026-06-01T10:00:00Z"
}

{
  "type": "log",
  "level": "info",
  "message": "Created REST endpoint /api/payroll",
  "timestamp": "2026-06-01T10:00:05Z"
}

{
  "type": "complete",
  "success": true,
  "summary": "Built payroll API with 5 endpoints",
  "files_changed": 8,
  "timestamp": "2026-06-01T10:02:30Z"
}
```

### Node.js SDK

```typescript
import { ClineAgent } from '@cline/sdk';

const agent = new ClineAgent({
  model: 'claude-sonnet-4-6',
  project: 'E:\\Project\\Master\\Agent\\agent-coding',
  autonomy: 'full',  // -y equivalent
});

const result = await agent.run('Build payroll REST API');
console.log(result.summary);
console.log(result.filesChanged);
```

### gRPC API

```
Endpoint: localhost:50051
Service: ClineService

Methods:
  RunTask(TaskRequest) → stream TaskEvent
  GetStatus(Empty) → StatusResponse
  CancelTask(TaskId) → CancelResponse
```

---

## Kiến trúc Cline Worker (Đề xuất)

### Option A — CLI Spawn (Đơn giản nhất, làm ngay)

```typescript
// Trong Worker Node
import { spawn } from 'child_process';

async function runClineTask(prompt: string, projectPath: string) {
  return new Promise((resolve, reject) => {
    const proc = spawn('cline', [
      '-y',
      '--json',
      '--project', projectPath,
      prompt
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    const events: any[] = [];

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          events.push(event);
          // Stream to Control Plane via WebSocket
          streamToControlPlane(event);
        } catch {}
      }
    });

    proc.on('close', (code) => {
      const lastEvent = events.findLast(e => e.type === 'complete');
      if (code === 0 && lastEvent?.success) {
        resolve(lastEvent);
      } else {
        reject(new Error(`Cline exited with code ${code}`));
      }
    });
  });
}
```

### Option B — Node.js SDK (Clean, production-ready)

```typescript
import { ClineAgent } from '@cline/sdk';

async function runClineTask(task: AgentTask) {
  const agent = new ClineAgent({
    model: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
    project: task.payload.project,
    autonomy: 'full',
    onEvent: (event) => streamToControlPlane(event),
  });

  return await agent.run(task.payload.prompt);
}
```

### Option C — gRPC (Nâng cao, cho multi-agent)

```typescript
import * as grpc from '@grpc/grpc-js';

// Kết nối gRPC server của Cline
const client = new ClineServiceClient('localhost:50051', grpc.credentials.createInsecure());

const stream = client.RunTask({ prompt, projectPath });
stream.on('data', (event) => streamToControlPlane(event));
stream.on('end', () => resolve());
```

**Khuyến nghị: Bắt đầu Option A (CLI Spawn), migrate sang Option B khi stable.**

---

## Antigravity

### Cần kiểm tra từ Dev:

```bash
# Test 1: Có CLI mode không?
antigravity --help
antigravity --version

# Test 2: Có headless flag không?
antigravity --headless --project "E:\Project\Master"

# Test 3: Có accept stdin không?
echo "Build payroll" | antigravity --stdin

# Test 4: Có JSON output không?
antigravity --json "Audit dashboard"

# Test 5: Có HTTP API không?
curl http://localhost:PORT/api/status

# Test 6: Có config file không?
ls ~/.antigravity/
ls C:\Users\<user>\AppData\Roaming\Antigravity\
```

### Fallback nếu không có API

Nếu Antigravity không có API, dùng UI Automation:

```typescript
import { keyboard, mouse } from '@nut-tree/nut-js';
import robot from 'robotjs';

async function injectPromptViaUI(prompt: string) {
  // 1. Focus Antigravity window
  await focusWindow('Antigravity');

  // 2. Click chat input
  await mouse.click(Button.LEFT);

  // 3. Paste prompt
  await keyboard.type(prompt);

  // 4. Press Enter
  await keyboard.pressKey(Key.Return);
}
```

Libraries: `@nut-tree/nut-js`, `robotjs`, `node-windows`

---

## Multi-Agent Flow (Cline CLI 2.0 native)

```bash
# Coordinator agent tự động spawn sub-agents
cline -y --json \
  --team "build-specialist,qa-specialist,deploy-specialist" \
  "Build, test, and deploy payroll module"
```

---

## Sources

- [Cline CLI 2.0 — DevOps.com](https://devops.com/cline-cli-2-0-turns-your-terminal-into-an-ai-agent-control-plane/)
- [Cline API Programmatic — Morph](https://www.morphllm.com/cline-api)
- [GitHub cline/cline](https://github.com/cline/cline)
- [Cline Bot](https://cline.bot/cli)
