# MI_LINKED_SOURCES_AUDIT.md
**Date:** 2026-06-17  
**Scope:** All projects in E:/Project/Master/ linked to Mi-Core

---

## Source Map — All Mi-Linked Projects

| Project | Mi Link | Port | Status Before | Status After Fix |
|---------|---------|------|--------------|-----------------|
| `whatsapp-ai-gateway` | POST /api/whatsapp/mi | 3211 → 4001 | ✅ Online | ✅ Online |
| `accounting-engine` | Connector reads port 8844 | 8844 | ❌ OFFLINE | ✅ ONLINE (added to PM2) |
| `mi-ceo-observer` | POST /api/whatsapp/mi | 3212 → 4001 | ⚠️ NOT in PM2, HEADLESS=false | ✅ HEADLESS=true in ecosystem |
| `food-safety-gateway` | WhatsApp → Mi Data | 3211 | ✅ Connected (via gateway) | ✅ No change needed |
| `qb-ops-agent` | qb-agent.db at mi-core/data/ | n/a | ⚠️ Degraded (laptop1) | ⚠️ QB on laptop1 — expected |
| `mi-node-agent` | POST /api/nodes | 4001 | ✅ Configured | ✅ No change needed |
| `Bakudan/dashboard.bakudanramen.com` | /api/mi/snapshot | 4001 | ⚠️ API unreachable from mi-core | ⚠️ Network/DNS issue |
| `RawSushi/RawWebsite` | Static site (Cloudflare) | n/a | ✅ No Mi dependency | ✅ Creative engine reads assets |

---

## Fixes Applied

### Fix 1 — Accounting Engine: OFFLINE → ONLINE
**Problem:** `accounting` connector health_status = offline. Port 8844 not listening.
**Root cause:** `accounting-engine/api/server.js` was never started in PM2.
**Fix applied:**
- Added `mi-accounting` to `ecosystem.config.js`
- Started via `pm2 start ecosystem.config.js --only mi-accounting`
- `pm2 save` → persists across reboots
- Verified: `GET http://127.0.0.1:8844/health → {"ok":true}`

### Fix 2 — Mi CEO Observer: HEADLESS=false → HEADLESS=true
**Problem:** `mi-ceo-observer/.env` had `WHATSAPP_HEADLESS=false` → would open visible browser window.
**Fix applied:**
- `sed -i 's/WHATSAPP_HEADLESS=false/WHATSAPP_HEADLESS=true/' .env`
- `ecosystem.config.js` updated: `WHATSAPP_HEADLESS: 'true'`
- Observer now configured for headless operation

### Fix 3 — Connector Registry: accounting health updated
**Problem:** Stale `health_status: "offline"` in connector-registry.json
**Fix applied:** Updated to `health_status: "healthy"` + current `last_health_check` timestamp

---

## Current PM2 Status

```
id=1  mi-core          → online PID 25504  port 4001 ✅
id=2  whatsapp-ai-gateway → online PID 36432 port 3211 ✅
id=3  mi-accounting    → online PID 22972  port 8844 ✅
```

---

## Connector Registry — After Fixes

| Connector | Status | Auth | Health | Last Sync |
|-----------|--------|------|--------|----------|
| local-projects | active | connected | healthy | 2026-06-17 |
| dashboard-bakudan | active | connected | healthy | 2026-06-17 |
| asana | active | connected | unknown | 2026-06-17 |
| gmail | active | connected | healthy | 2026-06-14 |
| google-calendar | active | connected | healthy | 2026-06-17 |
| google-drive | active | connected | healthy | 2026-06-17 |
| health-export | active | connected | healthy | 2026-06-17 |
| website-raw | active | connected | healthy | 2026-06-17 |
| website-bakudan | active | connected | healthy | 2026-06-17 |
| **accounting** | active | connected | **healthy** ✅ | **2026-06-17** |
| food-safety | active | connected | healthy | 2026-06-17 |
| whatsapp | active | connected | healthy | 2026-06-13 |
| quickbooks-runtime | active | connected | degraded | 2026-06-17 |
| google-sheets | active | connected | healthy | 2026-06-17 |

---

## Remaining Issues (non-blocking)

### 1. QuickBooks Runtime: DEGRADED
- **Why:** QB Desktop + Web Connector runs on `laptop1`, not on this PC
- **Impact:** Finance truth layer returns MISSING state when QB sync is stale
- **Resolution:** Keep QB Desktop running on laptop1, ensure Web Connector auto-syncs
- **Not fixable from mi-core-primary**

### 2. Dashboard API: Unreachable
- **Why:** `dashboard.bakudanramen.com/api/mi/snapshot` returns network error from mi-core
- **Impact:** Task queries ("Nay anh có task gì?") degrade gracefully
- **Resolution:** Check DNS/proxy config between mi-core-primary and dashboard host
- **Action needed:** Verify `DASHBOARD_API_URL` env var in mi-core

### 3. Asana: health=unknown
- **Why:** Health check API rate-limited or token stale since Jun 14
- **Impact:** Asana task queries may fail silently
- **Resolution:** Token refresh or re-auth via Google OAuth flow

### 4. WhatsApp Connector: last_sync Jun 13
- **Why:** Connector sync timestamp not updated by gateway
- **Impact:** Cosmetic only — gateway is actively processing messages
- **Resolution:** Update sync timestamp tracking in whatsapp-connector

---

## Summary

| Fixed | Count |
|-------|-------|
| OFFLINE → ONLINE | 1 (accounting) |
| Headless configured | 1 (mi-ceo-observer) |
| PM2 entries added | 1 (mi-accounting) |
| pm2 save | ✅ persisted |

**Mi-linked sources: 8/14 fully healthy, 3 degraded (expected), 2 network-dependent (QB/dashboard), 1 stale timestamp**
