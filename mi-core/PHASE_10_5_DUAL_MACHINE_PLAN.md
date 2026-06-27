# PHASE 10.5 — DUAL MACHINE OPERATIONAL CERTIFICATION

**Status:** IN PROGRESS
**Generated:** 2026-06-27
**Objective:** Prove Laptop1 (Field Node) ↔ Mi-Core PC (Command Center) operational loop

---

## Current Reality (from Phase 10.3)

| System | Status | Blocker |
|--------|--------|---------|
| Mi-Core Server | RUNNING | — |
| QB Agent (PC side) | RUNNING | — |
| QB Heartbeat (Laptop1) | STALE (9 days) | Dev1 must run runner on Laptop1 |
| DoorDash machine | STALE (2026-06-17) | Dev1 must re-checkin from Laptop1 |
| WhatsApp Gateway | ONLINE | API key not configured |
| Toast | BLOCKED | No API key |

---

## Machine Roles

| Machine | IP | Role | Owner |
|---------|----|------|-------|
| Laptop1 | 100.111.97.25 | Field Systems Node (QB, DoorDash, WhatsApp) | Dev1 |
| PC | 100.118.102.113 | Mi-Core Command Center | Dev2 |

---

## DEV1 ACTION (Laptop1)

### Step 1 — Run Phase 10.5 Runner
```powershell
# On Laptop1, open PowerShell as Admin
# Copy DEV1_LAPTOP1_PHASE10_5_RUNNER.ps1 to Laptop1, then:

.\DEV1_LAPTOP1_PHASE10_5_RUNNER.ps1 -MiCoreUrl "http://100.118.102.113:4001"
```

This script runs 5 tests and generates:
- `$env:TEMP\LAPTOP1_RUNTIME_CERTIFICATION.md`
- `$env:TEMP\laptop1-phase10-5-evidence.json`

### Step 2 — Copy cert to PC
Share `LAPTOP1_RUNTIME_CERTIFICATION.md` with Dev2 via:
- WhatsApp / email / shared drive

### Step 3 — Fix DoorDash port 3460 (if EACCES)
```powershell
# Check if port 3460 is bound
netstat -ano | findstr :3460

# If blocked by Windows Firewall:
netsh advfirewall firewall add rule name="Mi DoorDash Agent" dir=in action=allow protocol=TCP localport=3460

# Then start doordash-agent:
cd C:\Users\hoang\Downloads\source\setup-all\Bakudan\integration-system\desktop-app
# or wherever the doordash-agent is
npm start
```

---

## DEV2 ACTION (Mi-Core PC)

### Step 1 — Verify Mi-Core is running
```bash
# Check PM2 processes
pm2 list

# Mi-Core must be on port 4001
curl http://localhost:4001/api/qb-agent/ping
```

### Step 2 — Run Phase 10.5 verifier (after Dev1 completes)
```bash
cd D:/Project/Master/mi-core
node phase10-5-micore-verify.mjs
# OR with Laptop1 cert:
node phase10-5-micore-verify.mjs --laptop1-cert "path/to/LAPTOP1_RUNTIME_CERTIFICATION.md"
```

### Step 3 — Configure WhatsApp API key
```bash
curl -X POST http://localhost:4001/api/whatsapp/mi/setup \
  -H "Content-Type: application/json" \
  -H "x-api-key: 2c6b56891f788f3836e3c6529624610f1bcce878dd556617b03b4ce690edebec" \
  -d '{"api_key": "YOUR_WHATSAPP_API_KEY"}'
```

---

## 5 Tests Description

| # | Test | Laptop1 Action | Mi-Core Expected |
|---|------|----------------|-----------------|
| 1 | QB Heartbeat | Detect QBW.EXE, POST /api/qb-agent/heartbeat | Store in qb-agent.db, update machine status |
| 2 | DoorDash Checkin | POST /api/doordash-agent/machines/checkin | Store machine sync, note agent_running status |
| 3 | WhatsApp Routing | Check gateway health, POST /api/whatsapp/status | Gateway online confirmed, API key needed for full routing |
| 4 | Failure Simulation | POST /api/qb-agent/events QB_OFFLINE event | Store event, (future) create auto-task |
| 5 | Revenue Objective | POST /api/qb-agent/events REVENUE_OBJECTIVE_REQUEST | Mi-Core creates task in financial-intelligence division |

---

## Certification Requirements

### DUAL_MACHINE_OPERATIONAL (all 5 pass):
- ✅ QB heartbeat received (age < 30 min)
- ✅ DoorDash checkin received from Laptop1
- ✅ WhatsApp gateway online (API key config optional for this phase)
- ✅ QB_OFFLINE failure event received
- ✅ REVENUE_OBJECTIVE_REQUEST event + Mi-Core task created

### DUAL_MACHINE_PARTIAL (3+ pass):
- Remaining blockers documented
- Connectivity proven for available systems

---

## Files Created by Phase 10.5

| File | Created By | Purpose |
|------|-----------|---------|
| `DEV1_LAPTOP1_PHASE10_5_RUNNER.ps1` | Dev2 (this file) | Dev1 runs on Laptop1 |
| `phase10-5-micore-verify.mjs` | Dev2 | Dev2 runs on PC after Dev1 completes |
| `$TEMP\LAPTOP1_RUNTIME_CERTIFICATION.md` | Dev1 (auto-generated) | Laptop1 proof |
| `DUAL_MACHINE_OPERATIONAL_CERTIFICATION.md` | Dev2 (auto-generated) | Final certification |
| `MI_CORE_RUNTIME_CERTIFICATION.md` | Dev2 (auto-generated) | PC proof |
| `reports/evidence/phase10-5-dual-machine/` | Dev2 | All evidence JSON |

---

## Current Mi-Core Endpoint Status (2026-06-27)

```
GET  /api/qb-agent/ping             → 200 OK (no auth)
POST /api/qb-agent/heartbeat        → 200 OK (x-api-key: QB_API_KEY)
POST /api/qb-agent/events           → 200 OK (x-api-key: QB_API_KEY)
GET  /api/qb-agent/machines         → 200 OK (x-api-key: MI_CORE_API_KEY)
POST /api/doordash-agent/machines/checkin → 200 OK (no auth)
GET  /api/doordash-agent/machines   → 200 OK (Bearer MI_CORE_API_KEY)
GET  /api/whatsapp/health           → 200 OK {endpoint: online, api_key_configured: false}
```

---

## QB_API_KEY (for Laptop1 runner)
`b149c4783a1109ff46d01498d91766e7`

(Used in POST /api/qb-agent/heartbeat and /api/qb-agent/events)
