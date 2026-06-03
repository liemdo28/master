# Provider Quota Rotation — Deployment Guide

## Overview

This release adds **15-minute time-based provider rotation** to the Antigravity Gateway.

**Before:** Antigravity was always primary. OpusMax only used on failure.  
**After:** Primary rotates every 15 minutes between Antigravity and OpusMax.

```
Window 0  xx:00–xx:14   Primary: Antigravity   Fallback: OpusMax
Window 1  xx:15–xx:29   Primary: OpusMax        Fallback: Antigravity
Window 2  xx:30–xx:44   Primary: Antigravity   Fallback: OpusMax
Window 3  xx:45–xx:59   Primary: OpusMax        Fallback: Antigravity
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/runtime/provider-rotation-service.ts` | NEW — time-based rotation service |
| `src/router/provider-router.ts` | Uses rotation service for provider selection |
| `src/server.ts` | Exposes `/api/runtime/window` endpoint; SSE includes window data |
| `src/dashboard/provider-runtime-panel/index.ts` | Added rotation clock widget |
| `tests/stress-rotation.mjs` | NEW — 66-test stress suite (all passing) |

---

## Pre-Deployment Checklist

- [ ] TypeScript compiles clean: `node ./node_modules/typescript/bin/tsc --noEmit`
- [ ] Stress test passes: `node tests/stress-rotation.mjs`
- [ ] Review `keys.json` — confirm `antigravity` and `opusmax` are in `activeProviders`
- [ ] Backup current `data/orchestrator-state.json`

---

## Deployment Steps

### 1. Build

```bash
node ./node_modules/typescript/bin/tsc
```

Or if `tsc` is on PATH:
```bash
npm run build
```

### 2. Verify compiled output

```bash
ls dist/runtime/provider-rotation-service.js   # must exist
```

### 3. Stop current gateway

```bash
# If running via PM2:
pm2 stop antigravity-gateway

# If running directly:
# Ctrl+C or kill the process
```

### 4. Start new gateway

```bash
node dist/server.js

# Or via PM2:
pm2 start dist/server.js --name antigravity-gateway
```

### 5. Verify rotation is active

```bash
# Check current window
curl http://localhost:PORT/api/runtime/window

# Expected response:
# {
#   "windowId": 0-3,
#   "windowLabel": "10:15 - 10:29",
#   "primaryProvider": "opusmax",
#   "fallbackProvider": "antigravity",
#   "remainingMs": 420000,
#   ...
# }
```

### 6. Verify dashboard

Open `http://localhost:PORT/runtime` — the **15-Min Rotation Window** panel should appear at the top with:
- Animated arc dial showing % time remaining
- Primary provider name (large)
- Fallback provider
- Live countdown timer

### 7. Send a test request and check logs

```bash
curl -X POST http://localhost:PORT/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: any" \
  -d '{"model":"claude-opus-4-7","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```

Check console for:
```
[router] ▶  antigravity  model=claude-opus-4  stream=false  window="10:00 - 10:14"  primary=antigravity  fallback=opusmax
```

---

## Optional: Future Provider Expansion

To add a 3rd provider (e.g. OpenRouter) to rotation:

```bash
# In .env or .env.gateway:
ROTATION_PROVIDERS=antigravity,opusmax,openrouter
```

Then restart the gateway. No code changes needed.

With 3 providers, each gets a 15-minute slot per 45 minutes:
```
Window 0  xx:00–xx:14   Primary: Antigravity
Window 1  xx:15–xx:29   Primary: OpusMax
Window 2  xx:30–xx:44   Primary: OpenRouter
Window 3  xx:45–xx:59   Primary: Antigravity  (wraps)
```

---

## Monitoring

After deploy, watch these endpoints:

| Endpoint | What to watch |
|----------|---------------|
| `GET /api/runtime/window` | Current window, primary, remaining time |
| `GET /api/runtime/rotation` | Full rotation metrics |
| `GET /api/runtime/stream` (SSE) | Live updates every 2s |
| `GET /api/logs` | Per-request `rotation` field in each log entry |

Key log fields per request:
```json
{
  "rotation": {
    "windowId": 1,
    "windowLabel": "10:15 - 10:29",
    "primaryProvider": "opusmax",
    "fallbackProvider": "antigravity",
    "selectedProvider": "opusmax",
    "finalProvider": "opusmax"
  }
}
```

If `finalProvider !== selectedProvider` → fallback was used.
