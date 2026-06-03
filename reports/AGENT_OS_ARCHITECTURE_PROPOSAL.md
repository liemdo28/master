# Agent OS Architecture Proposal

**Date:** 2026-06-01  
**Author:** Automated Audit System  
**Status:** PENDING CEO APPROVAL  
**Version:** 2.0 — Agent OS+ (with Governance Layer)

---

## Executive Summary

Based on the full audit of `E:\Project\Master`, this document proposes reorganizing the workspace into an **Agent OS** architecture — a structured ecosystem where the Agent Core powers multiple product apps through shared services.

### Key Findings:
- **Agent Brain identified**: `agent-coding/apps/agency/` (Python FastAPI)
- **Provider Gateway**: `agent-coding-api-keys/` (Node.js)
- **Agent OS MVP already built**: `agent-control/`, `agent-worker/`, `shared/` (TypeScript, running)
- **10 active product apps** (mostly independent, share API keys only)
- **7 shared services** (QA, MCP, shared infra)
- **7 personal projects** (not business-critical)
- **7 archived projects** (clean, no action needed)

### Agent OS+ Vision (CEO's Request):

> **CEO → Agent OS → Multi-Worker**

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

CEO chỉ cần nói: "Build payroll", "Audit dashboard", "Start API proxy", "Open Antigravity", "Run QA" — Agent OS tự chọn worker phù hợp, ghi log, yêu cầu approval với task rủi ro cao và cho phép rollback.

### What's Already Built (MVP):

| Component | Location | Status |
|-----------|----------|--------|
| Control Plane API | `agent-os/agent-control/` | ✅ Built |
| Worker Node | `agent-os/agent-worker/` | ✅ Built |
| Task Queue + WebSocket | `agent-os/agent-control/` | ✅ Built |
| Dashboard UI | `agent-os/agent-control/public/` | ✅ Built |
| Permission Model (L1/L2/L3) | `agent-os/PERMISSION_MODEL.md` | ✅ Spec'd |
| Capability Matrix | `agent-os/WORKER_CAPABILITY_MATRIX.md` | ✅ Spec'd |
| Security Audit Log | `agent-os/SECURITY_AUDIT_LOG.md` | ✅ Spec'd |
| Tailscale Integration | `agent-os/agent-worker/` | ✅ Built |

### What's Missing (CEO's 4 Requirements):

| # | Feature | Priority | Timeline | Full Spec |
|---|---------|----------|----------|-----------|
| 1 | **Approval Engine** — Risk assessment + CEO approval workflow | 🔴 HIGH | 1 week | `AGENT_OS_PLUS_SPEC.md` |
| 2 | **Multiple Executors** — Split into File/Git/Build/QA/App/Script/Cloud/Deploy | 🔴 HIGH | 1 week | `AGENT_OS_PLUS_SPEC.md` |
| 3 | **Artifact Storage** — Logs, screenshots, videos, reports | 🟡 MEDIUM | 3 days | `AGENT_OS_PLUS_SPEC.md` |
| 4 | **Emergency Kill Switch** — Stop worker/executor/task from phone | 🔴 HIGH | 1 week | `AGENT_OS_PLUS_SPEC.md` |

### Proposed Architecture:
```
E:\Project\Master\
├── agent-os/          ← AI Brain + Agent OS Control Plane
│   ├── agent-core/           ← agent-coding/apps/agency (the AI brain)
│   ├── provider-gateway/    ← agent-coding-api-keys
│   ├── agent-control/       ← [EXISTING] Task queue + dashboard
│   ├── agent-worker/        ← [EXISTING] Worker node
│   ├── shared/              ← [EXISTING] Shared types
│   ├── executor-pool/       ← [NEW] File/Git/Build/QA/Script/Cloud/Deploy executors
│   ├── approval-engine/     ← [NEW] Risk classification + CEO approval
│   ├── artifact-storage/    ← [NEW] Logs, screenshots, reports
│   └── artifacts/            ← [NEW] Artifact files directory
├── apps/              ← All product apps
├── shared/            ← Future shared services
├── infrastructure/    ← Deploy configs + sync scripts
├── personal/          ← Personal projects
├── legacy/            ← Archived projects
└── reports/          ← Audit reports
```

---

## Agent OS+ Architecture (Agent OS v2.0)

```
┌─────────────────────────────────────────────────────────────────┐
│                      CEO INTERFACE                               │
│   MacBook Dashboard (http://localhost:3700)                      │
│   iPhone Emergency Panel                                        │
│   Approval notifications, Task creation, Kill switch              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CONTROL PLANE (agent-control)                   │
│   Port 3700 • SQLite • WebSocket                                │
│   ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐   │
│   │ Task API     │  │ Approval API  │  │ Kill Switch API │   │
│   │ Queue        │  │ Risk Engine   │  │ Emergency Stop  │   │
│   └──────┬───────┘  └───────┬───────┘  └─────────────────┘   │
│          │                   │                                  │
│          ▼                   ▼                                  │
│   ┌──────────────────────────────────────────────────────┐     │
│   │           Executor Pool Manager                        │     │
│   │  File │ Git │ Build │ QA │ App │ Script │ Cloud │ Deploy │
│   └──────────────────────────────────────────────────────┘     │
│          │                                                    │
│          ▼                                                    │
│   ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐   │
│   │ Artifact Store│  │ Audit Logger  │  │ Worker Registry │   │
│   └──────────────┘  └───────────────┘  └─────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ Tailscale Network
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WORKER LAYER                                  │
│                                                                  │
│   ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐   │
│   │ PC Worker    │  │ Laptop Worker │  │ Future Workers  │   │
│   │ (Windows)   │  │ (MacBook)    │  │ (VPS, NAS)     │   │
│   └──────────────┘  └───────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Task Execution Flow (v2.0)

```
1. CEO → Create Task via Dashboard
2. Control Plane → Risk Assessment (auto-classify: safe/elevated/dangerous/critical)
3. IF dangerous/critical → Send to Approval Engine (pause task)
4. CEO → Approve/Deny via dashboard or phone
5. Control Plane → Select best Worker (by capability, load, network)
6. Control Plane → Route to appropriate Executor (File/Git/Build/QA/etc.)
7. Executor → Execute task with permission checks
8. Executor → Stream logs → Artifact Storage
9. Executor → Save artifacts (logs, screenshots, reports)
10. Control Plane → Update task status, notify CEO
11. ALL ACTIONS → Logged to Audit Trail
```

---

## Executor Pool (CEO Feature #2)

### 8 Specialized Executors

| Executor | Capabilities | Max Concurrency | Timeout |
|----------|-------------|----------------|---------|
| **File Executor** | filesystem:read/write | 5 | 30s |
| **Git Executor** | git:read/write/push | 2 | 60s |
| **Build Executor** | build:run, deploy:staging | 2 | 5 min |
| **QA Executor** | qa:run | 3 | 10 min |
| **App Executor** | apps:open/close | 10 | 5s |
| **Script Executor** | scripts:run | 5 | 5 min |
| **Cloud Executor** | cloud:* | 2 | 2 min |
| **Deploy Executor** | deploy:* | 1 | 10 min |

### Why Split?

1. **Dễ debug** — Mỗi executor có log riêng, trace riêng
2. **Dễ cấp quyền** — Executor có capability riêng, L1/L2/L3 kiểm soát
3. **Dễ mở rộng** — Thêm executor mới không ảnh hưởng executor khác
4. **Dễ disable** — Kill switch có thể stop từng executor riêng biệt
5. **Dễ test** — Mỗi executor có unit tests riêng

---

## Approval Engine (CEO Feature #1)

### Risk Classification

| Risk Level | Example Tasks | Auto Run | Approval |
|------------|--------------|----------|----------|
| **SAFE** | Git status, Audit, Open VSCode, Run QA | ✅ | ❌ |
| **ELEVATED** | Git push, Deploy staging, Run script | ❌ | Notify CEO |
| **DANGEROUS** | Deploy production, Delete files, Send email | ❌ | CEO explicit |
| **CRITICAL** | DNS change, Production DB change | ❌ | CEO + verify |

### Approval API

```
POST /api/tasks/:id/approve   — CEO approves
POST /api/tasks/:id/deny      — CEO denies
GET  /api/approvals/pending  — List pending
POST /api/approvals/bulk     — Bulk approve
```

### Push-to-Main Protection

Git push to `main` branch requires ALL of:
1. `CHANGE_SUMMARY.md` exists in repo
2. CEO approval via dashboard
3. At least 1 passing CI check

---

## Artifact Storage (CEO Feature #3)

### Directory Structure

```
E:\Project\Master\agent-os\artifacts\
├── audit-reports/     # Source audit outputs
├── build-logs/        # Build output logs
├── qa-results/        # Test results + screenshots
├── screenshots/       # Visual evidence
├── videos/            # Execution recordings
├── deploy-reports/    # Deploy logs
├── git-reports/       # Git operation reports
└── exports/           # Data exports
```

### Artifact Schema

| Field | Description |
|-------|-------------|
| id | UUID |
| taskId | Parent task ID |
| type | report/log/json/image/video/archive/build/test |
| filename | Original filename |
| path | Relative path |
| size | Bytes |
| checksum | SHA256 |
| metadata | JSON (duration, exit code, etc.) |

### Retention Policy

| Type | Retention |
|------|-----------|
| Report | 90 days |
| Log | 30 days |
| Image | 14 days |
| Video | 7 days |

---

## Emergency Kill Switch (CEO Feature #4)

CEO có thể stop bất kỳ operation nào từ MacBook/iPhone trong 1 click:

```
┌─────────────────────────────┐
│  🛑 EMERGENCY KILL         │
├─────────────────────────────┤
│  ⏹ Stop All Workers        │
│  [🔴 STOP EVERYTHING]      │
│                             │
│  ⏹ office-pc-1             │
│    Executor: [Build ⚠️]     │
│    Task: #421 (running)     │
│    [STOP] [KILL PROCESS]    │
│                             │
│  🔄 Rollback Last Deploy    │
│    review-auto-system        │
│    v1.2.3 → v1.2.2          │
│    [ROLLBACK NOW]           │
└─────────────────────────────┘
```

### Kill Targets

| Target | Action | Speed |
|--------|--------|-------|
| Worker | Stop all executors gracefully | 5s |
| Executor | Stop specific executor only | 1s |
| Task | Cancel running task | 1s |
| Process | Force kill by PID (taskkill /F) | 0s |
| Deploy | Rollback to previous version | 30s |

### Kill Switch Security

- Allowed users: CEO MacBook + iPhone only
- Require re-auth for critical kills
- Require confirmation modal
- 30s cooldown between critical kills
- All kills logged to audit trail

---

## Proposed Folder Structure (v2.0)

```
E:\Project\Master
├── agent-os/
│   ├── agent-core/           ← agent-coding/apps/agency (Python FastAPI brain)
│   │   ├── src/
│   │   │   ├── agents/      # Router, TaskPlanner, Specialists, LeaderReviewer
│   │   │   ├── llm/         # Anthropic, OpenAI, Ollama providers
│   │   │   ├── ceo/         # Brain module
│   │   │   ├── scoring/     # Score engine
│   │   │   └── policies/     # Inter-department policies
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── .env.example
│   │
│   ├── provider-gateway/    ← agent-coding-api-keys
│   │   ├── src/
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── agent-control/       ← [EXISTING] Control Plane (TypeScript)
│   │   ├── src/            # API routes, WebSocket, Task queue
│   │   ├── public/         # Dashboard UI
│   │   └── package.json
│   │
│   ├── agent-worker/        ← [EXISTING] Worker Node (TypeScript)
│   │   ├── src/            # Heartbeat, Task handlers
│   │   └── package.json
│   │
│   ├── shared/              ← [EXISTING] Shared types (TypeScript)
│   │
│   ├── executor-pool/       ← [NEW] Executor implementations
│   │   ├── src/
│   │   │   ├── base.ts      # Executor interface
│   │   │   ├── file.ts      # FileExecutor
│   │   │   ├── git.ts       # GitExecutor
│   │   │   ├── build.ts     # BuildExecutor
│   │   │   ├── qa.ts        # QAExecutor
│   │   │   ├── app.ts       # AppExecutor
│   │   │   ├── script.ts    # ScriptExecutor
│   │   │   ├── cloud.ts     # CloudExecutor
│   │   │   ├── deploy.ts    # DeployExecutor
│   │   │   └── pool.ts      # ExecutorPool manager
│   │   └── tests/
│   │
│   ├── approval-engine/     ← [NEW] Approval workflow
│   │   ├── src/
│   │   │   ├── risk-classifier.ts
│   │   │   ├── approval-api.ts
│   │   │   └── notification.ts
│   │   └── tests/
│   │
│   ├── artifact-storage/    ← [NEW] Artifact management
│   │   ├── src/
│   │   │   ├── storage.ts
│   │   │   ├── capture.ts   # Screenshot/video
│   │   │   └── retention.ts # Cleanup policy
│   │   └── artifacts/       # Artifact files
│   │
│   ├── kill-switch/         ← [NEW] Emergency controls
│   │   ├── src/
│   │   │   ├── kill-api.ts
│   │   │   ├── graceful-stop.ts
│   │   │   └── rollback.ts
│   │   └── tests/
│   │
│   ├── governance-dashboard/ ← [NEW] CEO dashboard panel
│   │   ├── src/
│   │   │   ├── approvals.ts
│   │   │   ├── kill-panel.ts
│   │   │   └── alerts.ts
│   │   └── public/
│   │
│   ├── AGENT_OS_MVP.md
│   ├── AGENT_OS_PLUS_SPEC.md ← Full spec v2.0
│   ├── ARCHITECTURE.md
│   ├── PERMISSION_MODEL.md
│   ├── WORKER_CAPABILITY_MATRIX.md
│   └── SECURITY_AUDIT_LOG.md
│
├── apps/
│   ├── dashboard/           ← Bakudan/dashboard.bakudanramen.com
│   ├── review-auto-system/ ← Bakudan/review-automation-system
│   ├── toast-qb/           ← Bakudan/integration-system
│   ├── bakudan-website/    ← Bakudan/bakudanramen.com-current
│   ├── growth-dashboard/   ← Bakudan/growth-dashboard
│   ├── mobile-taskflow/    ← Bakudan/mobile_taskflow
│   ├── packing-list/       ← Bakudan/packing-list
│   ├── linktree-hl/        ← Other/LinkTreeHL
│   └── raw-website/        ← RawSushi/RawWebsite
│
├── shared/                  ← Future shared services
├── infrastructure/          ← Deploy configs + sync scripts
├── personal/               ← Personal projects
├── legacy/                 ← Archived projects (_archive/)
└── reports/               ← Audit reports
```

---

## Implementation Roadmap

### Phase 1: Folder Structure (No Code Moves)
**Risk:** NONE  
**Time:** 1 day  
**Deliverables:**
- [ ] Create `agent-os/executor-pool/` folder
- [ ] Create `agent-os/approval-engine/` folder
- [ ] Create `agent-os/artifact-storage/` folder
- [ ] Create `agent-os/kill-switch/` folder
- [ ] Create `agent-os/governance-dashboard/` folder

### Phase 2: Executor Pool (CEO Feature #2)
**Risk:** MEDIUM  
**Time:** 1 week  
**Deliverables:**
- [ ] `Executor` base interface in `shared/`
- [ ] `ExecutorPool` manager
- [ ] FileExecutor implementation
- [ ] GitExecutor implementation (with CHANGE_SUMMARY check)
- [ ] BuildExecutor implementation
- [ ] QAExecutor implementation
- [ ] AppExecutor implementation (with whitelist)
- [ ] ScriptExecutor implementation (with pattern blocking)
- [ ] CloudExecutor implementation
- [ ] DeployExecutor implementation
- [ ] Executor selection in task routing

### Phase 3: Approval Engine (CEO Feature #1)
**Risk:** MEDIUM  
**Time:** 1 week  
**Deliverables:**
- [ ] Risk classifier (safe/elevated/dangerous/critical)
- [ ] Approval database table
- [ ] Approval API endpoints
- [ ] Push-to-main protection
- [ ] Approval dashboard UI
- [ ] Notification system (email/Slack/push)

### Phase 4: Artifact Storage (CEO Feature #3)
**Risk:** LOW  
**Time:** 3 days  
**Deliverables:**
- [ ] Artifact storage service
- [ ] Artifact API
- [ ] Artifact viewer UI
- [ ] Screenshot capture integration
- [ ] Log aggregation
- [ ] Retention policy cleanup job

### Phase 5: Emergency Kill Switch (CEO Feature #4)
**Risk:** MEDIUM  
**Time:** 1 week  
**Deliverables:**
- [ ] Kill switch API endpoints
- [ ] Graceful stop (SIGTERM)
- [ ] Force kill (SIGKILL / taskkill)
- [ ] Kill dashboard panel (mobile-friendly)
- [ ] Rollback engine
- [ ] Kill confirmation modal
- [ ] Cooldown enforcement

### Phase 6: Personal Projects (No Risk)
**Risk:** NONE  
**Time:** 1 day  
**Deliverables:**
- [ ] Move personal projects to `personal/`
- [ ] Update sync scripts

### Phase 7: Product Apps (Medium Risk)
**Risk:** MEDIUM  
**Time:** 1 week  
**Deliverables:**
- [ ] Move all apps to `apps/`
- [ ] Update deploy scripts
- [ ] Update QA config
- [ ] Regression testing

---

## Current vs Proposed Comparison

| Aspect | Current | Proposed (v2.0) |
|--------|---------|------------------|
| Task Execution | Single generic worker | 8 specialized executors |
| Permission Check | Manual per task | Automatic via executor capability |
| Approval | None | Risk-based CEO approval |
| Artifact Storage | None | Full logs, screenshots, videos |
| Kill Switch | None | Worker/Executor/Task/Process |
| Multi-Worker | Not supported | Full multi-worker support |
| Agent Core | Inside `agent-coding/` | Isolated in `agent-os/agent-core/` |
| Product Apps | Scattered | Consolidated in `apps/` |
| Personal Projects | Mixed in `Other/` | Isolated in `personal/` |
| Archive | In `_archive/` | In `legacy/` |

---

## Success Criteria

Agent OS v2.0 is successful when:
1. ✅ CEO can approve/deny dangerous tasks from iPhone
2. ✅ Each executor has isolated logs and can be killed independently
3. ✅ Every task output is saved as artifact with full context
4. ✅ CEO can stop any operation in 1 click from phone
5. ✅ Multi-worker support works (PC + MacBook simultaneously)
6. ✅ Rollback works for any failed deploy
7. ✅ All actions logged to audit trail

---

## Next Steps

1. **CEO reviews and approves** this proposal + `AGENT_OS_PLUS_SPEC.md`
2. Phase 1: Create folder structure (1 day, zero risk)
3. Phase 2: Executor Pool (1 week, medium risk)
4. Phase 3: Approval Engine (1 week, medium risk)
5. Phase 4: Artifact Storage (3 days, low risk)
6. Phase 5: Kill Switch (1 week, medium risk)
7. Phase 6: Move personal projects (1 day, zero risk)
8. Phase 7: Move product apps (1 week, medium risk)
