# Agent OS - README

**Distributed Task Execution System for Windows PC Automation**

---

## What is Agent OS?

Agent OS cho phép CEO điều khiển PC từ laptop/iPhone mà không cần:
- ❌ AnyDesk
- ❌ TeamViewer
- ❌ Chrome Remote Desktop
- ❌ Windows Remote Desktop
- ❌ Chạm vào PC

---

## Quick Start

### 1. Start Control Plane (trên laptop)
```bash
cd e:\Project\Master\agent-os\agent-control
npm install
npm run build
npm start
```

### 2. Start Worker (trên PC)
```bash
cd e:\Project\Master\agent-os\agent-worker
npm install
npm run build
npm start
```

### 3. Mở Dashboard
```
http://localhost:3700
```

---

## Architecture

```
┌──────────────┐
│   Laptop     │
│   (CEO)      │───▶ Dashboard UI
└──────┬───────┘
       │ HTTP/WebSocket
       ▼
┌──────────────┐
│ Control Plane│  Port: 3700
└──────┬───────┘
       │ Tailscale (Encrypted)
       ▼
┌──────────────┐
│  PC Worker   │
│  (Windows)   │
└──────────────┘
```

---

## Available Tasks

| Task | Description |
|------|-------------|
| `audit` | Scan và audit source code |
| `build` | Build project (git pull, npm install, build) |
| `qa` | Run Playwright/Cypress tests |
| `git_sync` | Git status/pull/push |
| `script` | Run custom scripts |
| `app_launch` | Open approved applications |
| `api_proxy` | Start/stop API proxy |

---

## Permission Levels

| Level | Mô tả |
|-------|--------|
| **L1** | Local Worker - Read/Write E:\Project\Master |
| **L2** | Dev Executor - + Git push, Cline control |
| **L3** | Cloud Operator - + Gmail, DreamHost, Cloudflare |

---

## Demo Flow

1. Open dashboard → See PC worker online
2. Create task → "Audit E:\Project\Master"
3. Watch logs live → Real-time streaming
4. Download artifact → Audit report JSON
5. Use Kill Switch → Emergency stop if needed

---

## File Structure

```
agent-os/
├── AGENT_OS_MVP.md           # Technical specification
├── ARCHITECTURE.md           # System architecture
├── PERMISSION_MODEL.md       # Permission levels
├── APPROVAL_ENGINE.md       # Risk assessment
├── WORKER_EXECUTORS.md      # Executor details
├── ARTIFACT_STORAGE.md      # Artifact management
├── KILL_SWITCH.md           # Emergency stop
├── CONTROL_PLANE_SETUP.md    # Server setup
├── WORKER_SETUP_WINDOWS.md  # PC setup
├── SECURITY_AUDIT_LOG.md    # Security logging
│
├── agent-control/           # Control Plane source
├── agent-worker/            # Worker source
└── shared/                  # Shared types
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [AGENT_OS_MVP.md](AGENT_OS_MVP.md) | Technical specification |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture diagram |
| [PERMISSION_MODEL.md](PERMISSION_MODEL.md) | 3-level permission system |
| [APPROVAL_ENGINE.md](APPROVAL_ENGINE.md) | Risk assessment & approvals |
| [WORKER_EXECUTORS.md](WORKER_EXECUTORS.md) | Task executors |
| [ARTIFACT_STORAGE.md](ARTIFACT_STORAGE.md) | Output storage |
| [KILL_SWITCH.md](KILL_SWITCH.md) | Emergency stop |
| [INSTALL_GUIDE.md](INSTALL_GUIDE.md) | Installation guide |
| [TEST_RESULTS.md](TEST_RESULTS.md) | Test documentation |

---

## Test Scenarios

### Scenario A: Build Project
```
1. Create task: Build Project
2. Project: E:\Project\Master\Agent
3. Watch logs live
4. Get completion notification
```

### Scenario B: Audit Source
```
1. Create task: Source Audit
2. Project: E:\Project\Master
3. Worker scans directory
4. Generates report artifact
```

### Scenario C: Run QA
```
1. Create task: QA Tests
2. Worker detects Playwright
3. Runs tests
4. Returns test results
```

---

## Security

- ✅ Worker tokens (32-byte hex)
- ✅ Permission levels
- ✅ Audit logging
- ✅ Approval requirements
- ✅ Kill switch
- ✅ No credentials hardcoded

---

## Hard Constraints

- ❌ Do not delete files (unless approved)
- ❌ Do not push Git without approval
- ❌ Do not deploy production without approval
- ❌ Do not use remote desktop
- ❌ No cloud access without CEO approval

---

## Status

**MVP COMPLETE** ✅

Ready for 6-hour CEO demo.

---

## License

Internal use only. © 2026
