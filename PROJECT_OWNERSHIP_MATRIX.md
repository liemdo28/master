# PROJECT_OWNERSHIP_MATRIX.md
> Project → Department → Brain → Tools → QA Owner
> No orphan projects. Every project owned.
> Updated: 2026-06-18

---

## Matrix

| Project | Department | Brain | Key Tools | QA Owner | Criticality |
|---------|-----------|-------|-----------|----------|-------------|
| mi-core | dispatch | qwen3:14b | GStack, Intent Router, Jarvis | qa (gemma3:12b) | CRITICAL |
| whatsapp-ai-gateway | executive-assistant | qwen3:8b | Baileys, mi-core webhook | qa | CRITICAL |
| accounting-engine | finance | qwen3:14b | Accounting Engine API, QuickBooks | qa | CRITICAL |
| mi-ceo-observer | executive-assistant | qwen3:8b | Baileys (headless), task-intelligence | qa | HIGH |
| mi-ai-service | dispatch | qwen3:14b | Ollama, uvicorn | qa | HIGH |
| mi-node-agent | technical-operations → infrastructure | qwen3:8b | nodes API, heartbeat | qa | MEDIUM |
| qb-ops-agent | finance | qwen3:14b | QuickBooks Desktop, qb-agent.db | qa | HIGH |
| food-safety-gateway | restaurant-intelligence | qwen3:8b | WhatsApp forms, Google Sheets, OCR | qa | HIGH |
| bakudan-integration-system | restaurant-intelligence | qwen3:8b | Toast Playwright, installer dist | qa | HIGH |
| doordash-agent | marketing | qwen3:8b | Playwright, DoorDash merchant | qa | MEDIUM |
| review-automation-system | marketing | gemma3:12b | FastAPI, PostgreSQL, Google/Yelp OAuth | qa | HIGH |
| bakudan-dashboard | report-center | qwen3:8b | mi-core /api/mi/snapshot | qa | MEDIUM |
| antigravity-gateway | engineering | qwen2.5-coder:7b | API key rotation, SSE streaming | qa | HIGH |
| bakudan-website | brand-creative | gemma3:12b | Cloudflare, static assets | qa | HIGH |
| rawsushi-website | brand-creative | gemma3:12b | Cloudflare, CDN assets | qa | MEDIUM |
| bakudan-releases | technical-operations → infrastructure | qwen3:8b | git, release artifacts | qa | LOW |
| mi-core-backups | infrastructure | qwen3:8b | file system, backup scripts | qa | MEDIUM |
| docs | library | qwen3:8b | knowledge-db | qa | LOW |
| reports | report-center | qwen3:8b | evidence-store | qa | LOW |
| agent-doordash-campaigns | marketing | qwen3:8b | Playwright, doordash-agent | qa | MEDIUM |
| agent-review-mcp | marketing | qwen3:8b | review-automation-system | qa | LOW |
| _archive | infrastructure | — | — | — | LOW |
| _transfer_packages | infrastructure | — | — | — | LOW |

---

## Orphan Check: NONE

Every project has a department owner. QA is always `qa` department (gemma3:12b — independent model).

---

## Infrastructure Department — Owns

Projects it monitors (not owns business logic):
- All PM2 services
- Docker services
- Port availability
- Log analysis
- Backup verification
- Tailscale connectivity

Routes CEO infrastracture questions:
- "Mi ơi sao Dashboard chết?" → infrastructure
- "Mi ơi sao WhatsApp down?" → infrastructure  
- "Mi ơi sao Mi-Core không trả lời?" → infrastructure
- "Sao accounting không trả lời?" → infrastructure + finance

---

## Department Load

| Department | Projects Owned | Services | Sources |
|------------|---------------|---------|---------|
| dispatch | mi-core, mi-ai-service | 2 | 0 |
| executive-assistant | whatsapp-ai-gateway, mi-ceo-observer | 2 | 4 |
| finance | accounting-engine, qb-ops-agent | 1 | 4 |
| restaurant-intelligence | food-safety-gateway, bakudan-integration-system | 0 | 3 |
| technical-operations / infrastructure | mi-node-agent, bakudan-releases, mi-core-backups | 1 | 0 |
| marketing | doordash-agent, review-automation-system, bakudan-dashboard, agent-doordash-campaigns, agent-review-mcp | 3 | 2 |
| brand-creative | bakudan-website, rawsushi-website | 0 | 0 |
| engineering | antigravity-gateway | 1 | 0 |
| library | docs | 0 | 1 |
| report-center | reports | 1 | 2 |
