# Safe Refactor Plan — Agent OS Reorganization

**Created:** 2026-06-01  
**Updated:** 2026-06-01  
**Status:** PENDING CEO APPROVAL  
**Risk Level:** LOW (Phase 1 & 2) | MEDIUM (Phase 3-7)  
**Author:** Automated Audit System

---

## Overview

This document outlines a safe, incremental plan to reorganize `E:\Project\Master` into an **Agent OS v2.0** architecture. The plan is designed to:

- ✅ Preserve all git history
- ✅ Never break production deploys
- ✅ Build Agent OS features incrementally (MVP already exists)
- ✅ Be fully reversible at every step
- ✅ Require explicit CEO approval before any medium/high-risk action

---

## Agent OS+ Status

**What's Already Built (MVP):**
- ✅ `agent-os/agent-control/` — Control Plane API (TypeScript)
- ✅ `agent-os/agent-worker/` — Worker Node (TypeScript)
- ✅ `agent-os/shared/` — Shared types (TypeScript)
- ✅ `agent-os/AGENT_OS_MVP.md` — MVP specification
- ✅ `agent-os/PERMISSION_MODEL.md` — L1/L2/L3 permission model
- ✅ `agent-os/WORKER_CAPABILITY_MATRIX.md` — Capability matrix
- ✅ `agent-os/SECURITY_AUDIT_LOG.md` — Audit log spec

**What's New (CEO's 4 Requirements):**
- ❌ Approval Engine — Risk assessment + CEO approval
- ❌ Executor Pool — 8 specialized executors
- ❌ Artifact Storage — Logs, screenshots, reports
- ❌ Emergency Kill Switch — Stop worker/executor/task

Full spec: `agent-os/AGENT_OS_PLUS_SPEC.md`

---

## Safety Rules (Non-Negotiable)

### MUST NEVER DO:
1. ❌ Delete any source code or project folder
2. ❌ Merge folders without full dependency analysis
3. ❌ Rewrite architecture without CEO approval
4. ❌ Change production deploy configurations
5. ❌ Remove `.env` files with credentials
6. ❌ Delete `.git` directories
7. ❌ Change database schemas without migration plan
8. ❌ Modify `_archive/` contents

### ALLOWED ACTIONS ONLY:
- ✅ Read files and folders
- ✅ Scan for keywords and dependencies
- ✅ Map project relationships
- ✅ Document findings
- ✅ Run safe tests (read-only)
- ✅ Create reports
- ✅ Create empty folder structure
- ✅ Implement new features in new folders
- ✅ Update existing MVP code (within scope)

---

## Phase-by-Phase Plan

### Phase 1: Create Folder Structure (ZERO RISK)

**Timeline:** Day 1  
**Risk:** NONE  
**Reversible:** YES (just delete empty folders)

```powershell
# Create Agent OS+ folders (no code moves)
mkdir E:\Project\Master\agent-os\executor-pool
mkdir E:\Project\Master\agent-os\executor-pool\src
mkdir E:\Project\Master\agent-os\executor-pool\tests
mkdir E:\Project\Master\agent-os\approval-engine
mkdir E:\Project\Master\agent-os\approval-engine\src
mkdir E:\Project\Master\agent-os\approval-engine\tests
mkdir E:\Project\Master\agent-os\artifact-storage
mkdir E:\Project\Master\agent-os\artifact-storage\src
mkdir E:\Project\Master\agent-os\artifact-storage\artifacts
mkdir E:\Project\Master\agent-os\kill-switch
mkdir E:\Project\Master\agent-os\kill-switch\src
mkdir E:\Project\Master\agent-os\kill-switch\tests
mkdir E:\Project\Master\agent-os\governance-dashboard
mkdir E:\Project\Master\agent-os\governance-dashboard\src
mkdir E:\Project\Master\agent-os\governance-dashboard\public
mkdir E:\Project\Master\apps
mkdir E:\Project\Master\shared
mkdir E:\Project\Master\infrastructure
mkdir E:\Project\Master\personal
mkdir E:\Project\Master\legacy
```

**Deliverable:** Empty folder structure created, sync script updated.

---

### Phase 2: Implement Executor Pool (CEO Feature #2) — MEDIUM RISK

**Timeline:** 1 week  
**Risk:** MEDIUM (adds new code, doesn't break existing MVP)  
**Reversible:** YES (delete folders, MVP still works)

**Implementation:**

```typescript
// agent-os/executor-pool/src/base.ts
interface Executor {
  name: string;
  capabilities: string[];
  maxConcurrency: number;
  timeout: number;
  canHandle(task: Task): boolean;
  execute(task: Task): Promise<TaskResult>;
  validate(task: Task): ValidationResult;
  kill(taskId: string): void;
}
```

**New files to create:**
| File | Purpose |
|------|---------|
| `executor-pool/src/base.ts` | Executor interface |
| `executor-pool/src/pool.ts` | ExecutorPool manager |
| `executor-pool/src/file.ts` | FileExecutor |
| `executor-pool/src/git.ts` | GitExecutor |
| `executor-pool/src/build.ts` | BuildExecutor |
| `executor-pool/src/qa.ts` | QAExecutor |
| `executor-pool/src/app.ts` | AppExecutor |
| `executor-pool/src/script.ts` | ScriptExecutor |
| `executor-pool/src/cloud.ts` | CloudExecutor |
| `executor-pool/src/deploy.ts` | DeployExecutor |

**Update existing MVP files:**
| File | Change |
|------|--------|
| `agent-control/src/task-router.ts` | Route to executor based on task type |
| `agent-worker/src/handlers.ts` | Replace with executor pool calls |
| `shared/src/types.ts` | Add Executor interface |

**Pre-flight checklist:**
- [ ] Full backup: `xcopy E:\Project\Master F:\Projects\Master-backup-YYYYMMDD /E /H /I`
- [ ] MVP tests passing: `npm test` in agent-control and agent-worker
- [ ] Git status clean

**Verification:**
```bash
cd agent-os/executor-pool
npm install
npm run build
npm test

# Integration test
cd agent-control
npm test  # Should still pass
```

---

### Phase 3: Implement Approval Engine (CEO Feature #1) — MEDIUM RISK

**Timeline:** 1 week  
**Risk:** MEDIUM (adds new approval workflow)  
**Reversible:** YES (delete folder, revert DB migration)

**New files to create:**
| File | Purpose |
|------|---------|
| `approval-engine/src/risk-classifier.ts` | Auto-classify task risk |
| `approval-engine/src/approval-api.ts` | Approval CRUD endpoints |
| `approval-engine/src/notification.ts` | Push notification |
| `approval-engine/src/push-protection.ts` | CHANGE_SUMMARY.md check |

**Database migration:**
```sql
-- Add to existing tasks table
ALTER TABLE tasks ADD COLUMN risk_level TEXT DEFAULT 'safe';
ALTER TABLE tasks ADD COLUMN approval_status TEXT;

-- New approvals table
CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  approved_by TEXT,
  denied_by TEXT,
  reason TEXT,
  created_at TEXT,
  resolved_at TEXT,
  change_summary TEXT
);
```

**Update existing MVP files:**
| File | Change |
|------|--------|
| `agent-control/src/api/tasks.ts` | Add approval endpoints |
| `agent-control/src/db/schema.ts` | Add approval tables |
| `agent-control/public/dashboard/` | Add approval UI panel |

**Verification:**
```bash
# Test approval flow
curl -X POST http://localhost:3700/api/tasks \
  -d '{"type":"git:push","project":"agent-coding"}'
# Should return approval_status: "pending"

curl -X POST http://localhost:3700/api/tasks/{id}/approve
# Should return approval_status: "approved"
```

---

### Phase 4: Implement Artifact Storage (CEO Feature #3) — LOW RISK

**Timeline:** 3 days  
**Risk:** LOW (adds new storage service)  
**Reversible:** YES (delete folder)

**New files to create:**
| File | Purpose |
|------|---------|
| `artifact-storage/src/storage.ts` | Artifact storage service |
| `artifact-storage/src/capture.ts` | Screenshot/video capture |
| `artifact-storage/src/retention.ts` | Cleanup policy (cron) |
| `artifact-storage/src/api.ts` | Artifact API |

**Directory structure:**
```
E:\Project\Master\agent-os\artifact-storage\artifacts\
├── audit-reports/
├── build-logs/
├── qa-results/
├── screenshots/
├── videos/
├── deploy-reports/
├── git-reports/
└── exports/
```

**Update existing MVP files:**
| File | Change |
|------|--------|
| `agent-worker/src/handlers.ts` | Save artifacts after task completion |
| `agent-control/src/api/tasks.ts` | Add artifact endpoints |

**Verification:**
```bash
# Run a task
curl -X POST http://localhost:3700/api/tasks \
  -d '{"type":"qa:playwright","project":"agent-os"}'

# Check artifacts
curl http://localhost:3700/api/tasks/{id}/artifacts
```

---

### Phase 5: Implement Emergency Kill Switch (CEO Feature #4) — MEDIUM RISK

**Timeline:** 1 week  
**Risk:** MEDIUM (adds force-stop capabilities)  
**Reversible:** YES (delete folder)

**New files to create:**
| File | Purpose |
|------|---------|
| `kill-switch/src/kill-api.ts` | Kill switch API |
| `kill-switch/src/graceful-stop.ts` | SIGTERM stop |
| `kill-switch/src/force-kill.ts` | SIGKILL / taskkill |
| `kill-switch/src/rollback.ts` | Deploy rollback |
| `kill-switch/src/confirmation.ts` | Kill confirmation modal |

**API endpoints:**
```
POST /api/workers/:id/stop
POST /api/workers/:id/executors/:name/stop
POST /api/tasks/:id/kill
POST /api/processes/:pid/kill
POST /api/deploy/:id/rollback
```

**Update existing MVP files:**
| File | Change |
|------|--------|
| `agent-worker/src/heartbeat.ts` | Add executor status |
| `agent-control/src/api/workers.ts` | Add kill endpoints |
| `agent-control/public/dashboard/` | Add kill panel UI |

**Security:** Only CEO MacBook + iPhone IPs can call kill endpoints.

**Verification:**
```bash
# Kill a running task
curl -X POST http://localhost:3700/api/tasks/{id}/kill

# Kill a worker
curl -X POST http://localhost:3700/api/workers/{id}/stop
```

---

### Phase 6: Move Personal Projects (ZERO RISK)

**Timeline:** Day 1  
**Risk:** NONE  
**Reversible:** YES (move back to `Other/`)

| # | Source | Destination | Reason |
|---|--------|-------------|--------|
| 1 | `Other/dau-tu/` | `personal/dau-tu/` | Personal, no deploy |
| 2 | `Other/tu-vi/` | `personal/tu-vi/` | Personal, no deploy |
| 3 | `Other/Tuya/` | `personal/tuya/` | Personal, no deploy |
| 4 | `Other/VC/` | `personal/vc/` | Personal, no deploy |
| 5 | `Other/gdrive-tools/` | `personal/gdrive-tools/` | Personal, no deploy |
| 6 | `Other/openclaw/` | `personal/openclaw/` | Personal, no deploy |
| 7 | `Other/It-Takes-Two-Inspired-Game/` | `personal/game/` | Personal, no deploy |
| 8 | `Other/phuyen-2026/` | `personal/phuyen-2026/` | Personal, no deploy |

**Verification:**
```powershell
# After each move, verify git status is clean
cd E:\Project\Master\personal
git status
```

---

### Phase 7: Move Product Apps (MEDIUM RISK)

**Timeline:** 1 week  
**Risk:** MEDIUM (deploy scripts may break)  
**Reversible:** YES (update deploy scripts, move back)

**Pre-flight checklist:**
- [ ] Full backup: `xcopy E:\Project\Master F:\Projects\Master-backup-YYYYMMDD /E /H /I`
- [ ] Git status clean for all repos
- [ ] DreamHost credentials verified
- [ ] Vercel credentials verified
- [ ] QA system tests passing

**Moves:**

| # | Source | Destination | Deploy Impact |
|---|--------|-------------|---------------|
| 1 | `Bakudan/review-automation-system/` | `apps/review-auto-system/` | ⚠️ Update DreamHost path |
| 2 | `Bakudan/bakudanramen.com-current/` | `apps/bakudan-website/` | ⚠️ Update DreamHost path |
| 3 | `Bakudan/dashboard.bakudanramen.com/` | `apps/dashboard/` | ⚠️ Update DreamHost path |
| 4 | `Bakudan/growth-dashboard/` | `apps/growth-dashboard/` | ⚠️ Check deploy |
| 5 | `Bakudan/integration-system/` | `apps/toast-qb/` | ⚠️ Check local deploy |
| 6 | `Bakudan/mobile_taskflow/` | `apps/mobile-taskflow/` | ⚠️ Check local deploy |
| 7 | `Bakudan/packing-list/` | `apps/packing-list/` | ⚠️ Check Telegram bot |
| 8 | `Other/LinkTreeHL/` | `apps/linktree-hl/` | ⚠️ Update Vercel path |
| 9 | `RawSushi/RawWebsite/` | `apps/raw-website/` | ⚠️ Update DreamHost path |

**After all moves, update:**
1. `QA/qa-system/config/projects.json` — all paths
2. `sync-master-to-portable.ps1` — all paths
3. DreamHost deploy scripts
4. Vercel project settings
5. GitHub Actions (if any)

---

## What to MOVE (Actionable Now)

### Safe to Move (Phase 6):
All `Other/personal/` projects listed above.

### Keep for Now (Wait for Phase 7):
- `agent-coding/` — Central brain, too many dependencies
- `agent-coding-api-keys/` — All AI tools depend on this
- `Bakudan/review-automation-system/` — Production on DreamHost
- `Bakudan/bakudanramen.com-current/` — Live website
- `Bakudan/dashboard.bakudanramen.com/` — Live dashboard
- `Bakudan/integration-system/` — Active Toast↔QB pipeline
- `Other/LinkTreeHL/` — Production on Vercel
- `RawSushi/RawWebsite/` — Live website

---

## What to ARCHIVE (Already Done ✅)

| Folder | Status |
|--------|--------|
| `_archive/agentai-agency-merged-20260601/` | ✅ Already archived |
| `_archive/Personal-agentai-agency-old/` | ✅ Already archived |
| `_archive/bakudanramen.com-old-20260601/` | ✅ Already archived |
| `_archive/BakudanWebsite_Sub2-20260601/` | ✅ Already archived |
| `_archive/integration-toasttab-old-20260601/` | ✅ Already archived |
| `_archive/Raw-old-20260601/` | ✅ Already archived |

---

## What Must NOT Be Touched

| Item | Reason |
|------|--------|
| Any `.env` file | Contains production credentials |
| Any `.git` directory | Contains all version history |
| `agent-os/agent-control/` (existing MVP code) | Control Plane API |
| `agent-os/agent-worker/` (existing MVP code) | Worker Node |
| `agent-os/shared/` (existing MVP code) | Shared types |
| `_archive/` contents | Preserved for history |

---

## Risk Assessment Matrix

| Phase | Action | Risk | Reversible? | Impact if Failed | Mitigation |
|-------|--------|------|-------------|-----------------|------------|
| 1 | Create folders | NONE | YES | None | Just delete empty folders |
| 2 | Executor Pool | MEDIUM | YES | Task routing breaks | Revert to old handlers |
| 3 | Approval Engine | MEDIUM | YES | Tasks can't run | Disable approval, revert DB |
| 4 | Artifact Storage | LOW | YES | Storage fills up | Delete artifacts, disable feature |
| 5 | Kill Switch | MEDIUM | YES | Worker can't stop | Disable endpoint |
| 6 | Move personal | NONE | YES | None | Move back to `Other/` |
| 7 | Move product apps | MEDIUM | YES | Deploy breaks | Update scripts, test each |

---

## Rollback Plan

### For Phase 1-5 (Code Changes):
```bash
# If any phase fails:
git checkout -- agent-os/executor-pool
git checkout -- agent-os/approval-engine
git checkout -- agent-os/artifact-storage
git checkout -- agent-os/kill-switch
git checkout -- agent-os/agent-control/src
git checkout -- agent-os/agent-worker/src

# Revert DB migration if needed
# (Keep backup of pre-migration DB)
```

### For Phase 6-7 (File Moves):
```powershell
# Remove folders
rmdir E:\Project\Master\apps
rmdir E:\Project\Master\personal

# Restore from backup
xcopy F:\Projects\Master-backup-YYYYMMDD E:\Project\Master /E /H /I /Y
```

---

## Execution Checklist

### Before Starting Any Phase:
- [ ] CEO approves this plan
- [ ] Full backup created
- [ ] `git status` clean
- [ ] MVP tests passing
- [ ] Deploy scripts documented

### After Each Phase:
- [ ] Verify MVP still works (`npm test`)
- [ ] Run integration tests
- [ ] Update documentation
- [ ] Document any issues found

### Before Proceeding to Next Phase:
- [ ] CEO reviews current phase results
- [ ] All issues resolved
- [ ] MVP tests passing
- [ ] CEO approves next phase

---

## Summary: Safe First Steps (CEO Can Approve Today)

1. **Phase 1** — Create folder structure (zero risk, immediate)
2. **Phase 2** — Implement Executor Pool (1 week, medium risk)
3. **Phase 3** — Implement Approval Engine (1 week, medium risk)
4. **Phase 4** — Implement Artifact Storage (3 days, low risk)
5. **Phase 5** — Implement Kill Switch (1 week, medium risk)
6. **Phase 6** — Move personal projects (zero risk, 1 hour)
7. **Phase 7** — Move product apps (medium risk, 1 week)

Full Agent OS v2.0 implementation time: **~5 weeks**

Full folder reorganization time: **~2 weeks** (after implementation)
