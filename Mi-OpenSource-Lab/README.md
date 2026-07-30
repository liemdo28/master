# Mi Open-Source Extension Lab

**Version:** 1.0.0
**Date:** 2026-06-26
**Status:** Active Lab — NO PRODUCTION INTEGRATION

---

## Purpose

Evaluate and integrate selected open-source AI tools into Mi Company OS to extend Mi capabilities in:

1. **Visual workflow builder** → Mi Workflow Studio
2. **AI video generation** → Mi Training Video Agent
3. **AI voice / TTS engine** → Mi Voice Engine
4. **Browser-side local LLM** → Mi Browser Local Assistant
5. **Browser automation lab** → Mi Browser Automation Lab
6. **3D digital twin** → Mi Digital Twin Lab

---

## Critical Rules

- ✅ NO direct production integration before audit
- ✅ NO replacement of existing working Mi-Core modules
- ✅ NO modification of Mi/n8n production workflows
- ✅ NO modification of WhatsApp gateway
- ✅ NO storing API keys inside repo
- ✅ NO commit of node_modules, venv, models, videos, or generated audio
- ✅ All work must be done in isolated branches / lab modules first

---

## Connected Mi Systems

| System | Path | Role |
|--------|------|------|
| Mi-Core | `D:\Project\Master\mi-core\` | Brain — decision, approval, audit |
| N8N | `D:\Project\Master\Mi\n8n\` | Automation Fabric — workflow execution |
| Agent-Engine | `D:\Project\Master\mi-core\agent-engine\` | Autonomous task execution |
| N8N Contract | `Mi\n8n\N8N_MI_CORE_CONTRACT.md` | API contract between n8n and Mi-Core |

---

## Mi-Core API Endpoints (Used by Adapters)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/mi/intake/event` | Register inbound event |
| POST | `/api/mi/decision/request` | Request decision from Mi-Core |
| POST | `/api/mi/approval/request` | Request approval for action |
| POST | `/api/mi/tasks/dispatch` | Dispatch task to Mi agent |
| POST | `/api/mi/tasks/complete` | Mark task complete |
| POST | `/api/mi/workflows/log` | Log workflow execution |
| GET | `/api/mi/workflows/status` | Read workflow status |
| GET | `/api/mi/automation/dashboard` | Dashboard overview |

**Base URL:** `http://127.0.0.1:4001`
**Auth:** `Authorization: Bearer <MI_API_KEY>`

---

## Lab Structure

```
Mi-OpenSource-Lab/
├── 01-open-agent-builder/    # Visual workflow builder
├── 02-openmontage/           # AI video generation
├── 03-tts-audio-suite/       # TTS voice engine
├── 04-webllm/                # Browser-side local LLM
├── 05-obscura-browser/       # Browser automation lab
├── 06-map3d/                 # Digital twin lab
├── docs/                     # Architecture specs
├── reports/                  # Phase reports
├── pocs/                     # Proof of concepts
└── scripts/                  # Automation scripts
```

---

## Phase Roadmap

| Phase | Name | Status |
|-------|------|--------|
| Phase 0 | Project Setup | 🔄 Active |
| Phase 1 | Open-Source Audit | ⬜ Pending |
| Phase 2 | Lab Install | ⬜ Pending |
| Phase 3 | Mi Mapping | ⬜ Pending |
| Phase 4 | Adapter Architecture | ⬜ Pending |
| Phase 5 | POC: Workflow Studio | ⬜ Pending |
| Phase 6 | POC: Video Agent | ⬜ Pending |
| Phase 7 | POC: Voice Engine | ⬜ Pending |
| Phase 8 | POC: WebLLM | ⬜ Pending |
| Phase 9 | POC: Obscura Lab | ⬜ Pending |
| Phase 10 | POC: Map3D Lab | ⬜ Pending |
| Phase 11 | Security + License Review | ⬜ Pending |
| Phase 12 | Final Recommendation | ⬜ Pending |

---

## Pass/Fail Criteria

### PASS
- All projects audited
- At least 3 projects installed in lab
- At least 2 POCs completed
- No production system modified
- No secret leaked
- No unsafe license embedded into Mi-Core
- Clear roadmap created

### PARTIAL PASS
- Audit complete
- Install blocked for some projects
- At least one POC works
- Clear reason documented

### FAIL
- Production system modified accidentally
- Secrets committed
- License risk ignored
- No audit report
- No Mi mapping
- No final recommendation

---

## Quick Commands

```powershell
# Check lab status
Get-ChildItem D:\Project\Master\Mi-OpenSource-Lab\ -Recurse -File | Measure-Object

# Run health check
.\scripts\run-health-check.ps1

# Audit all repos
.\scripts\audit-repos.ps1

# Generate final report
.\scripts\generate-final-report.ps1
