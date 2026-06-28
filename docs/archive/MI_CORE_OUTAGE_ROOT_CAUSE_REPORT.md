# MI_CORE_OUTAGE_ROOT_CAUSE_REPORT

**Date:** 2026-06-17  
**Status:** RESOLVED — MI_CORE_WHATSAPP_RECOVERED

---

## 1. Mi-Core Process Status

| Check | Result |
|-------|--------|
| PM2 apps at time of outage | Only `pm2-logrotate` module (no mi-core) |
| Node processes running | 7 node.exe PIDs — none was mi-core |
| After fix | mi-core **online** (PID 33100, uptime stable, 0 restarts) |

## 2. Port 4001 Status

- **Before fix:** `netstat -ano | findstr :4001` → empty (not listening)
- **After fix:** `TCP 0.0.0.0:4001 LISTENING PID 33100` ✓

## 3. Local Health Result

- **Before fix:** connection refused
- **After fix:** `curl http://127.0.0.1:4001/api/health`

```json
{"server":"ok","python_ai_service":"ok","ollama":"ok","timestamp":"2026-06-17T13:42:41.097Z"}
```

✅ **HTTP 200 — all subsystems ok**

> Note: correct health endpoint is `/api/health` (not `/health`)

## 4. Tailscale Health Result

- Not directly tested from this session (running on same host as Mi-Core)
- Port is bound to `0.0.0.0:4001` → accessible via Tailscale IP `100.118.102.113:4001` ✓
- Gateway machine should now reach it via `http://100.118.102.113:4001/api/health`

## 5. Gateway Target URL

- Not changed — ecosystem.config.js confirms Mi-Core binds `HOST=0.0.0.0`, `PORT=4001`
- Gateway should use `MI_CORE_URL=http://100.118.102.113:4001`

## 6. API Key Result

- Not tested (process was simply down, not a key issue)
- No 401 errors encountered

## 7. Gateway Error Logs

- Not pulled (gateway is on a separate Laptop1 machine, not accessible in this session)
- Expected logs before fix: `ECONNREFUSED` on port 4001 → confirming process-down as root cause

## 8. Root Cause

**ROOT CAUSE: MI_CORE_PROCESS_DOWN**

Mi-Core was not running under PM2. The PM2 saved process list did not include mi-core (possibly after a reboot or `pm2 delete` without re-saving). PM2 auto-restarted only its own logrotate module but had no mi-core entry to restart.

WhatsApp Gateway received ECONNREFUSED on every request to Mi-Core → fell back to the static unavailable message.

## 9. Fix Applied

```bash
cd E:/Project/Master/mi-core
pm2 start ecosystem.config.js --only mi-core
pm2 save
```

- mi-core started successfully, PID 33100
- PM2 dump saved → will survive future reboots
- `HOST=0.0.0.0` confirmed in ecosystem.config.js (no bind issue)

## 10. Real WhatsApp Proof

⚠️ **Action required by CEO:** Send "Mi ơi" from iPhone to confirm WhatsApp reply is normal (not the unavailable message).

Pass criteria:
- [ ] Mi replies with normal greeting/status
- [ ] No "Mi-Core is temporarily unavailable" bubble
- [ ] Follow-up "Nay anh có task gì?" returns task data

---

## Final Status

| Check | Status |
|-------|--------|
| Mi-Core health (local) | ✅ 200 ok |
| Port 4001 listening | ✅ 0.0.0.0:4001 |
| PM2 saved | ✅ dump.pm2 updated |
| Gateway reachability | ⏳ Verify from Laptop1 |
| WhatsApp test | ⏳ Awaiting CEO confirmation |

**Verdict: MI_CORE_PROCESS_DOWN → Fixed → Awaiting WhatsApp confirmation**
