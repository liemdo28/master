# DOORDASH RECOVERY PROOF

> Live evidence from CTO HOLD execution
> Generated: 2026-06-24 21:57 Asia/Saigon
> Status: `SYSTEM_RECOVERY_OPERATIONAL` for runtime; `SYSTEM_RECOVERY_PARTIAL` for metrics

---

## Pre-Recovery State (Phase 32)

```
mi-doordash-agent: status=stopped, PID=0, uptime=—
```

## Action Taken

```bash
pm2 start e:\Project\Master\mi-core\services\doordash-agent\src\index.js --name mi-doordash-agent --interpreter node
```

## Post-Recovery State

```
mi-doordash-agent: PID=29412, status=online, uptime=17s, mem=124.8mb
```

## Health Check

```json
{"status":"ok","running":true,"last_run":"2026-06-24T14:56:16.195Z","last_error":null,"accounts":4,"has_cache":true}
```

## Scrape Result — ALL 4 ACCOUNTS AUTHENTICATED

| Account | Email | Phase 32 Status | Phase 33 Status |
|---------|-------|-----------------|-----------------|
| bakudan-1 | bakudanramen210@gmail.com | LOGIN_FAILED | ✅ AUTH OK |
| bakudan-2 | info@bakudanramen.com | LOGIN_FAILED | ✅ AUTH OK |
| bakudan-3 | gm@bakudanramen.com | LOGIN_FAILED | ✅ AUTH OK |
| raw-sushi | h.oang.d.le@gmail.com | LOGIN_FAILED | ✅ AUTH OK |

All 4 reached `https://merchant-portal.doordash.com/analytics` successfully.

## Remaining Issue: Metrics Parser

The scraper landed on the analytics page but `orders_today`, `revenue_today`, etc. came back as `null`. The page renders metrics via SVG/chart components that the regex parser can't read. **Connection is live — parser needs upgrade.**

---

## CTO HOLD Status

**P4 DoorDash Runtime Recovery: COMPLETE** (runtime healthy, auth working)
**Metrics extraction: blocked by Cloudflare anti-bot protection**

After parser upgrade to extract DOM data, confirmed the blocker:

```
"We're having trouble loading the page you requested. Try again later."
Client IP: 171.235.33.28
Ray ID: a10c9ed93f62f924
```

This is Cloudflare's bot detection blocking headless Playwright on the analytics page. Authentication succeeds (login flow works), but the analytics SPA triggers Cloudflare's WAF.

### Root Cause Classification

| Factor | Status |
|--------|--------|
| Credentials | VALID (auth succeeds) |
| Login Flow | WORKS (all 4 accounts reach portal) |
| Session Persistence | WORKS (cookie-based, 8h TTL) |
| Analytics Page | BLOCKED by Cloudflare WAF |
| Bot Detection | Triggered by headless Playwright |

### Resolution Options

1. **Reduce scraping frequency** — current 6h is fine; avoid rapid runs
2. **Use non-headless mode** — CEO manually opens portal, exports data
3. **DoorDash Ads API** (if available) — bypasses web scraping entirely
4. **Manual CSV export** — CEO exports weekly, Mi processes

Status: `SYSTEM_RECOVERY_PARTIAL` — runtime operational, data extraction blocked by Cloudflare.
