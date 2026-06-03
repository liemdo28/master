# MASTER PROJECT INDEX

**Last updated:** 2026-06-01 (updated: agent-coding + agentai-agency merged)

---

## Active Projects

### Bakudan Ramen

| Project | Folder | Domain / Target | Git Remote | Notes |
|---------|--------|----------------|-----------|-------|
| Main Website | `bakudanramen.com-current/` | `bakudanramen.com` (DreamHost SFTP) | `heoventure/BakudanWebsite.git` | Static HTML. Deploy via `scripts/_deploy_static_pages.py` |
| Dashboard | `dashboard.bakudanramen.com/` | `dashboard.bakudanramen.com` | DreamHost git remote | Separate stack |

### AI / Agent

| Project | Folder | Git Remote | Notes |
|---------|--------|-----------|-------|
| Agent Coding (monorepo) | `agent-coding/` | `liemdo28/agent-coding.git` | Node.js Engineering OS. Launch: `npm start` |
| → Agency sub-app | `agent-coding/apps/agency/` | (merged from `agentai-agency`) | Python FastAPI agency platform. Launch: `start-agency.bat` |
| Agent API Keys | `agent-coding-api-keys/` | — | Credential management, no remote |
| Review Automation | `review-automation-system/` | `liemdo28/review-automation-system.git` | |
| Integration System | `integration-system/` | `liemdo28/intergration-full.git` | |

### QA

| Project | Folder | Notes |
|---------|--------|-------|
| QA System | `qa-system/` | `liemdo28/qa-system.git`. Stress tests under `stress-tests/` |
| QA Runner | `qa_runner/` | Shared Playwright runner (node_modules). Referenced by all bkdn QA scripts. |
| Bakudan QA scripts | `bakudanramen.com-current/qa/scripts/` | Playwright scripts for bakudanramen.com |
| Bakudan QA artifacts | `bakudanramen.com-current/qa/artifacts/` | Screenshots + videos |

### Other Active

| Project | Folder | Git Remote |
|---------|--------|-----------|
| LinkTree HL | `LinkTreeHL/` | `liemdo28/LinkTreeHL.git` |
| Raw Website | `RawWebsite/` | `liemdo28/rawwebsite.git` |
| Growth Dashboard | `growth-dashboard/` | `liemdo28/growth-dashboard.git` |
| Mobile Taskflow | `mobile_taskflow/` | — |
| Packing List | `packing-list/` | — |

---

## Archive

| Folder | Reason | Original Git |
|--------|--------|-------------|
| `_archive/bakudanramen.com-old-20260601/` | WordPress site (old). Replaced by static `bakudanramen.com-current/` | `liemdo28/bakudanramen.com.git` |
| `_archive/BakudanWebsite_Sub2-20260601/` | Old branch/experiment, superseded | `liemdo28/bakudanwebsite_sub2.git` |
| `_archive/scripts-old/_deploy.py` | WP plugin deploy (co-located with WP archive) | — |
| `_archive/review-automation-system.zip` | Backup ZIP | — |
| `_archive/agentai-agency-merged-20260601/` | Merged into `agent-coding/apps/agency/` | `liemdo28/AgentAi-Angency.git` |

---

## Deploy Reference

### bakudanramen.com (static site)

```
Source:  bakudanramen.com-current/
Server:  pdx1-shared-a3-05.dreamhost.com
User:    hoale24new
Remote:  /home/hoale24new/bakudanramen.com/

Scripts:
  bakudanramen.com-current/scripts/_deploy_static_pages.py   ← deploy all pages
  bakudanramen.com-current/scripts/_deploy_links_temp.py     ← deploy /links-temp only
```

### dashboard.bakudanramen.com

```
Remote: ssh://liemdo0208@pdx1-shared-a3-05.dreamhost.com/home/liemdo0208/repo/dashboard.git
```
