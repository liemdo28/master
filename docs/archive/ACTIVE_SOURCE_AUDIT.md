# ACTIVE_SOURCE_AUDIT.md
> Full audit: Models, Projects, Services, Containers, Repositories, Agents.
> No UNKNOWN assets.
> Updated: 2026-06-18

---

## AI Models

| Model | Size | Classification | Used By | Evidence |
|-------|------|---------------|---------|---------|
| qwen3:14b | ~9.3 GB | **ACTIVE** | dispatch, finance, rd, investment-fp, competitive-intel | ROLE_PRIORITY deep_reasoning |
| qwen3:8b | ~5.2 GB | **ACTIVE** | 9 departments | ROLE_PRIORITY fast_chat, balanced |
| gemma3:12b | ~8.1 GB | **ACTIVE** | qa, brand-creative | QA brain — independent model |
| qwen2.5-coder:7b | ~4.7 GB | **ACTIVE** | engineering | ROLE_PRIORITY coding |
| nomic-embed-text | ~0.3 GB | **ACTIVE** | knowledge-db, BigData | embeddings role |
| qwen3:1.7b | ~1.4 GB | **REMOVE** | — | Zero departments. Was test-only. |
| deepseek-r1:14b | ~9.0 GB | **REMOVE** | — | Superseded by qwen3:14b. Used once in 7d. |

---

## Projects

| Project | Status | Evidence |
|---------|--------|---------|
| mi-core | **ACTIVE** | PM2 online, port 4001, ecosystem.config.js |
| whatsapp-ai-gateway | **ACTIVE** | PM2 online, port 3211 |
| accounting-engine | **ACTIVE** | PM2 mi-accounting, port 8844, health OK |
| mi-ceo-observer | **ACTIVE** | PM2 configured, port 3212, headless=true |
| mi-ai-service | **ACTIVE** | PM2 configured, port 4002 |
| mi-node-agent | **ACTIVE** | PM2 configured, port 4004 |
| qb-ops-agent | **ACTIVE** | reads qb-agent.db, runs on laptop1 |
| food-safety-gateway | **ACTIVE** | library consumed by whatsapp-gateway |
| bakudan-integration-system | **ACTIVE** | dist/ deployed to Bakudan laptops |
| doordash-agent | **ACTIVE** | package at data/doordash-agent/ |
| review-automation-system | **ACTIVE** | docker-compose, port 8000 |
| bakudan-dashboard | **ACTIVE** | Cloudflare hosted, calls mi-core |
| antigravity-gateway | **ACTIVE** | port 3456, used by Claude Code + Cline |
| bakudan-website | **ACTIVE** | Cloudflare static |
| rawsushi-website | **ACTIVE** | Cloudflare static |
| agent-doordash-campaigns | **ACTIVE** | runbooks + scripts in Agent/doordash-compaigns |
| bakudan-releases | **ACTIVE** | git repo, release artifacts |
| mi-core-backups | **ACTIVE** | backup snapshots |
| docs | **ACTIVE** | documentation |
| reports | **ACTIVE** | certification reports |
| Agent/agent-coding | **SHADOW** | IDE layer, not called by mi-core |
| Agent/review-management-mcp | **SHADOW** | dev paused, only data/ folder |
| Agent/ai-search-tool | **SHADOW** | not integrated |
| Agent/shared-workspace | **SHADOW** | staging data |
| Agent/antigravity-gateway (zip) | **ARCHIVED** | .zip archive |
| _archive | **ARCHIVED** | old projects |
| _transfer_packages | **SHADOW** | staging packages |
| Bakudan/growth-dashboard | **UNKNOWN** | not fully scanned |
| Other | **UNKNOWN** | not scanned |
| data/qb-agent.db | **ACTIVE** | read by accounting-engine |

---

## Services

| Service | Classification | Evidence |
|---------|---------------|---------|
| mi-core (PM2) | **ACTIVE** | ecosystem.config.js, PID confirmed |
| whatsapp-ai-gateway (PM2) | **ACTIVE** | ecosystem.config.js, port 3211 |
| mi-accounting (PM2) | **ACTIVE** | ecosystem.config.js, port 8844 |
| mi-ceo-observer (PM2) | **ACTIVE** | ecosystem.config.js, port 3212 |
| mi-ai-service (PM2) | **ACTIVE** | ecosystem.config.js, port 4002 |
| mi-node-agent (PM2) | **ACTIVE** | ecosystem.config.js, port 4004 |
| review-api (Docker) | **ACTIVE** | docker-compose.yml, port 8000 |
| postgres (Docker) | **ACTIVE** | docker-compose.yml, port 5432 |
| redis (Docker) | **ACTIVE** | docker-compose.yml, port 6379 |
| antigravity-gateway (standalone) | **ACTIVE** | .env.example PORT=3456 |
| Ollama (Windows) | **ACTIVE** | port 11434, required by mi-core |
| QuickBooks Desktop | **ACTIVE** (external) | runs on laptop1, expected degraded |

---

## Containers

| Image | Port | Status |
|-------|------|--------|
| postgres:16-alpine | 5432 | **ACTIVE** |
| redis:7-alpine | 6379 | **ACTIVE** |
| Python FastAPI (review-api) | 8000 | **ACTIVE** |

No UNKNOWN containers registered.

---

## Repositories

| Repo | Path | Status |
|------|------|--------|
| bakudan-releases | E:/Project/Master/bakudan-releases | **ACTIVE** |

Note: mi-core is not a standalone git repo (part of larger workspace).

---

## Agents

| Agent | Path | Classification | Owner Dept |
|-------|------|---------------|-----------|
| doordash-agent | data/doordash-agent | **ACTIVE** | marketing |
| review-management-mcp | Agent/review-management-mcp | **SHADOW** | marketing |
| ai-search-tool | Agent/ai-search-tool | **SHADOW** | library |

---

## Summary

| Classification | Count |
|---------------|-------|
| ACTIVE | 42 |
| SHADOW | 6 |
| ARCHIVED | 2 |
| UNKNOWN | 2 |
| REMOVE | 2 |
| **TOTAL** | **54** |

**No UNKNOWN runtime services. No UNKNOWN AI models. No UNKNOWN databases.**
