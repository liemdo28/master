# Provider Quota Rotation — Rollback Guide

## When to roll back

Roll back if, after deploying rotation:
- All requests are failing for both providers simultaneously
- Provider selection is wrong (logs show unexpected provider)
- Dashboard widget causes the page to crash or break
- Any degradation not present before deploy

---

## Option A — Quick Operator Override (No Restart)

Force a specific provider without restarting the gateway.

```bash
# Force Antigravity (old default)
curl -X POST http://localhost:PORT/api/runtime/provider/switch \
  -H "Content-Type: application/json" \
  -d '{"provider": "antigravity"}'

# This puts the system in "manual" mode — rotation is bypassed.
# Router will use antigravity unconditionally until you switch back.
```

To restore automatic rotation later:
```bash
curl -X POST http://localhost:PORT/api/runtime/provider/mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "assisted-auto"}'
```

**Use this when:** You want to stop rotation immediately without downtime.

---

## Option B — Revert to Previous Build (Full Rollback)

### Step 1 — Stop the gateway

```bash
pm2 stop antigravity-gateway
# or Ctrl+C
```

### Step 2 — Revert changed files

The rotation changes touched exactly 3 source files and compiled to 3 dist files.

```bash
# Revert source files (if using git):
git checkout HEAD~1 -- src/runtime/provider-router.ts
git checkout HEAD~1 -- src/server.ts
git checkout HEAD~1 -- src/dashboard/provider-runtime-panel/index.ts

# The new file (can just be removed or left — it won't be called):
# src/runtime/provider-rotation-service.ts  ← harmless to leave

# Rebuild:
node ./node_modules/typescript/bin/tsc
```

### Step 3 — Restore the old startup default

The old code called `providerControl.setDefault('antigravity')` at boot.
After rolling back source and rebuilding, this is automatically restored.

### Step 4 — Restart

```bash
pm2 start dist/server.js --name antigravity-gateway
```

### Step 5 — Verify

```bash
curl http://localhost:PORT/api/runtime/provider/active
# "activeProvider": "antigravity"
# "mode": "manual"
```

---

## Option C — Emergency: Force Antigravity via Environment

If you cannot reach the API (gateway won't start), add to `.env`:

```
# Force antigravity at startup — disables rotation
ROTATION_PROVIDERS=antigravity
```

Then restart. With only one provider in the list, rotation becomes a no-op and antigravity always wins.

---

## Post-Rollback Checklist

- [ ] `GET /api/runtime/provider/active` shows `antigravity`
- [ ] Test request succeeds and log shows `ACTIVE_PROVIDER: antigravity`
- [ ] No dashboard errors in browser console
- [ ] File incident report with failure details before next deploy attempt
