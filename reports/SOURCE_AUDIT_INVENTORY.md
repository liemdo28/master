# SOURCE_AUDIT_INVENTORY.md
> Mi Company OS — Source Inventory
> Date: 2026-06-18
> Scope: E:\Project\Master

---

## Project Inventory

| # | Project | Path | Port | PM2 Name | Status |
|---|---------|------|------|----------|--------|
| 1 | Mi-Core Server | mi-core/server | 4001 | mi-core | ACTIVE |
| 2 | WhatsApp AI Gateway | mi-core/services/whatsapp-ai-gateway | 3211 | whatsapp-ai-gateway | ACTIVE |
| 3 | Accounting Engine | mi-core/services/accounting-engine | 8844 | mi-accounting | ACTIVE (PM2 online, HTTP unreachable) |
| 4 | CEO Observer | mi-core/services/mi-ceo-observer | 3212 | mi-ceo-observer | INACTIVE (not in pm2 list) |
| 5 | QB Ops Agent | mi-core/services/qb-ops-agent | — | — | INACTIVE |
| 6 | Food Safety Gateway | mi-core/services/food-safety-gateway | — | — | INACTIVE |
| 7 | Mi AI Python Service | mi-core/ai-service | 4002 | mi-ai-service | INACTIVE (not in pm2 list) |
| 8 | Mi Node Agent | mi-core | — | mi-node-agent | INACTIVE (not in pm2 list) |
| 9 | Antigravity AI Gateway | Agent/agent-coding-api-keys | 3456 | antigravity-gateway | ACTIVE |
| 10 | DoorDash Campaign Agent | Agent/doordash-compaigns | — | — | UNKNOWN |
| 11 | Bakudan Dashboard | Bakudan/dashboard.bakudanramen.com | — (Cloudflare) | — | ACTIVE (external) |
| 12 | Bakudan Integration System | Bakudan/integration-system | — | — | ACTIVE (desktop app) |
| 13 | Bakudan Website | Bakudan/bakudanramen.com-current | — | — | ACTIVE (external) |
| 14 | Review Automation System | Bakudan/review-automation-system | 8000 | — (Docker) | INACTIVE |
| 15 | Raw Sushi Website | RawSushi/RawWebsite | — | — | ACTIVE (external) |
| 16 | Growth Dashboard | Bakudan/growth-dashboard | — | — | UNKNOWN |

---

## Detailed Project Cards

### 1 — Mi-Core Server
| Field | Value |
|-------|-------|
| Path | `E:\Project\Master\mi-core\server` |
| Git URL | (monorepo — see mi-core root) |
| Branch | `feature/mi-core-big-data-foundation` |
| Last Commit | `ae8ad26f feat(dev3-w5-w7-w9): COO workflow routing, error policy fix, live proof` |
| Runtime Port | 4001 |
| PM2 Name | mi-core |
| Build Command | `cd server && npx tsc` |
| Start Command | `pm2 start ecosystem.config.js --only mi-core` |
| Health Endpoint | `http://localhost:4001/api/health` |
| Status | ✅ ACTIVE |

### 2 — WhatsApp AI Gateway
| Field | Value |
|-------|-------|
| Path | `E:\Project\Master\mi-core\services\whatsapp-ai-gateway` |
| Branch | `feature/mi-core-big-data-foundation` (monorepo) |
| Last Commit | `ae8ad26f` |
| Runtime Port | 3211 |
| PM2 Name | whatsapp-ai-gateway |
| Build Command | N/A (plain JS) |
| Start Command | `pm2 start ecosystem.config.js --only whatsapp-ai-gateway` |
| Health Endpoint | `http://localhost:3211/health` |
| Status | ✅ ACTIVE |

### 3 — Accounting Engine
| Field | Value |
|-------|-------|
| Path | `E:\Project\Master\mi-core\services\accounting-engine` |
| Runtime Port | 8844 |
| PM2 Name | mi-accounting |
| Start Command | `pm2 start ecosystem.config.js --only mi-accounting` |
| Health Endpoint | `http://127.0.0.1:8844/health` |
| Status | ⚠️ PM2 online, HTTP health FAIL |

### 4 — CEO Observer
| Field | Value |
|-------|-------|
| Path | `E:\Project\Master\mi-core\services\mi-ceo-observer` |
| Runtime Port | 3212 |
| PM2 Name | mi-ceo-observer |
| Start Command | `pm2 start ecosystem.config.js --only mi-ceo-observer` |
| Status | ❌ INACTIVE (not in active PM2 list) |

### 5 — QB Ops Agent
| Field | Value |
|-------|-------|
| Path | `E:\Project\Master\mi-core\services\qb-ops-agent` |
| PM2 Name | (none active) |
| Status | ❌ INACTIVE |

### 6 — Food Safety Gateway
| Field | Value |
|-------|-------|
| Path | `E:\Project\Master\mi-core\services\food-safety-gateway` |
| Status | ❌ INACTIVE |

### 7 — Antigravity AI Gateway
| Field | Value |
|-------|-------|
| Path | `E:\Project\Master\Agent\agent-coding-api-keys` |
| Runtime Port | 3456 |
| PM2 Name | antigravity-gateway |
| Health Endpoint | `http://localhost:3456/health` |
| Status | ✅ ACTIVE |

### 8 — Bakudan Dashboard
| Field | Value |
|-------|-------|
| Path | `E:\Project\Master\Bakudan\dashboard.bakudanramen.com` |
| Git URL | https://github.com/liemdo28/dashboard.bakudanramen.com.git |
| Branch | main |
| Last Commit | `9eed617 fix: revert accountant from $_sbAdmin` |
| Host | dashboard.bakudanramen.com (Cloudflare) |
| Status | ✅ ACTIVE (external) |

### 9 — Review Automation System
| Field | Value |
|-------|-------|
| Path | `E:\Project\Master\Bakudan\review-automation-system` |
| Git URL | https://github.com/liemdo28/review-automation-system.git |
| Branch | master |
| Runtime Port | 8000 (Docker) |
| Status | ❌ INACTIVE (Docker not running) |

### 10 — Bakudan Integration System
| Field | Value |
|-------|-------|
| Path | `E:\Project\Master\Bakudan\integration-system` |
| Git URL | https://github.com/liemdo28/intergration-full.git |
| Branch | main |
| Last Commit | `72ad8c5 docs: add QB Activity Log Read-Only Audit section` |
| Status | ✅ ACTIVE (desktop app — Toast POS Manager) |

### 11 — Bakudan Website
| Field | Value |
|-------|-------|
| Path | `E:\Project\Master\Bakudan\bakudanramen.com-current` |
| Git URL | https://github.com/liemdo28/bakudanwebsite_sub.git |
| Branch | main |
| Status | ✅ ACTIVE (external, hosted) |

### 12 — Raw Sushi Website
| Field | Value |
|-------|-------|
| Path | `E:\Project\Master\RawSushi\RawWebsite` |
| Git URL | https://github.com/liemdo28/rawwebsite.git |
| Branch | master |
| Status | ✅ ACTIVE (external, hosted) |

### 13 — DoorDash Campaign Agent
| Field | Value |
|-------|-------|
| Path | `E:\Project\Master\Agent\doordash-compaigns` |
| Last Commit | `c88d5a4 fix-upload-error-handling` |
| Status | ❓ UNKNOWN (no PM2 entry) |
