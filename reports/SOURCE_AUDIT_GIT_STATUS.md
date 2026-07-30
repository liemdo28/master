# SOURCE_AUDIT_GIT_STATUS.md
> Mi Company OS — Git Cleanliness Audit
> Date: 2026-06-18

---

## Summary

| Category | Count |
|----------|-------|
| Repos with own remotes | 6 |
| Repos in monorepo (mi-core) | 6 |
| Clean repos (0 modified) | 1 |
| Dirty repos (modified files) | 5 |
| Repos with unpushed commits | 2 |
| Repos with untracked files | 4 |

---

## Repos with Independent Git Remotes

### dashboard.bakudanramen.com
| Field | Value |
|-------|-------|
| Remote | https://github.com/liemdo28/dashboard.bakudanramen.com.git |
| Branch | main |
| Last commit | `9eed617 fix: revert accountant from $_sbAdmin` |
| Unpushed | **1 commit ahead** |
| Status | `?? test-results/ui-audit/` (untracked test folder) |
| Assessment | ⚠️ DIRTY — 1 unpushed commit, untracked test folder |

### review-automation-system
| Field | Value |
|-------|-------|
| Remote | https://github.com/liemdo28/review-automation-system.git |
| Branch | master |
| Last commit | `17dc85e Add product blueprint and integration roadmap` |
| Unpushed | 0 (clean vs remote) |
| Status | Multiple modified files: .env.example, .gitignore, README.md, app/config.py, app/main.py, app/models/* |
| Assessment | ⚠️ DIRTY — local modifications not committed |

### integration-system (Bakudan)
| Field | Value |
|-------|-------|
| Remote | https://github.com/liemdo28/intergration-full.git |
| Branch | main |
| Last commit | `72ad8c5 docs: add QB Activity Log` |
| Unpushed | **5 commits ahead** |
| Status | Multiple modified files: .gitignore, desktop-app/*.py, desktop-app/build scripts |
| Assessment | ⚠️ DIRTY — 5 unpushed commits, multiple modified files |

### bakudanramen.com-current (Bakudan Website)
| Field | Value |
|-------|-------|
| Remote | https://github.com/liemdo28/bakudanwebsite_sub.git |
| Branch | main |
| Last commit | `2fcdff7 assets: import 14 unique images` |
| Unpushed | 0 |
| Status | Untracked: .local-agent/, blog-cms/, data/, integrations/, links-admin/, links-temp/, PROJECT_DNA.md |
| Assessment | ⚠️ DIRTY — several untracked folders (local dev artifacts) |

### RawWebsite
| Field | Value |
|-------|-------|
| Remote | https://github.com/liemdo28/rawwebsite.git |
| Branch | master |
| Last commit | `7b38923 SEO audit sync: 10 new blog posts` |
| Unpushed | 0 |
| Status | `?? rawwebsite/` (untracked subfolder) |
| Assessment | ⚠️ DIRTY — one untracked subfolder |

### growth-dashboard
| Field | Value |
|-------|-------|
| Branch | main |
| Last commit | `ecf503b Fix 500 on GET: stream branch data without re-encoding` |
| Unpushed | 0 |
| Status | Clean |
| Assessment | ✅ CLEAN |

---

## Monorepo (mi-core) Projects

All services inside `mi-core/` share the same git repo. Status:

| Project | Path | Committed with |
|---------|------|----------------|
| mi-core server | server/ | monorepo |
| whatsapp-ai-gateway | services/whatsapp-ai-gateway/ | monorepo |
| accounting-engine | services/accounting-engine/ | monorepo |
| qb-ops-agent | services/qb-ops-agent/ | monorepo |
| food-safety-gateway | services/food-safety-gateway/ | monorepo |
| mi-ceo-observer | services/mi-ceo-observer/ | monorepo |
| antigravity-gateway | Agent/agent-coding-api-keys/ | monorepo |

**Monorepo Branch:** `feature/mi-core-big-data-foundation`  
**Last Commit:** `ae8ad26f feat(dev3-w5-w7-w9): COO workflow routing, error policy fix, live proof`

**Modified files in monorepo (top 10):**
```
M ../.claude/launch.json
M ../.local-agent-global/knowledge-db/ingestion_log.json
M ../.local-agent-global/knowledge-db/knowledge.db
M ../.local-agent-global/mi-core/master-projects.json
M ../.local-agent-global/visibility/...
M ../Agent/agent-coding-api-keys/src/...
M agent-engine/bridge.mjs
M ecosystem.config.js
M local-agent/...
```

Most modifications are runtime data files (knowledge DB, log files, visibility snapshots) — not source code changes. Source code changes to `Agent/agent-coding-api-keys` and `agent-engine` are uncommitted.

---

## Unpushed Commits

| Repo | Commits Ahead | Action |
|------|--------------|--------|
| dashboard.bakudanramen.com | 1 | CEO approval needed before push |
| integration-system | 5 | CEO approval needed before push |

**Note:** Do not push without CEO approval. This report documents status only.

---

## Branch Mismatches

| Repo | Local Branch | Expected |
|------|-------------|---------|
| mi-core | `feature/mi-core-big-data-foundation` | main (feature branch active) |
| All others | main or master | ✅ Standard |
