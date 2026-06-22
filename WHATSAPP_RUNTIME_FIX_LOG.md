# WhatsApp Runtime Fix Log

**Date**: 2026-06-18  
**Status**: FIXES APPLIED — AWAITING LIVE VALIDATION

---

## Bug #1: WhatsApp Gateway Not in PM2 Ecosystem

| Field | Value |
|---|---|
| Bug | WhatsApp AI Gateway (port 3211) has no process manager |
| Root Cause | `ecosystem.config.js` did not include the gateway process |
| Files Changed | `ecosystem.config.js` |
| Fix Applied | Added `mi-whatsapp-gateway` app entry with `WHATSAPP_HEADLESS: 'true'`, `AUTO_RECONNECT: 'true'`, `autorestart: true`, `max_restarts: 20` |
| Retest | Requires `pm2 start ecosystem.config.js` then verify gateway connects |

---

## Bug #2: Gateway Timeout Too Short (15s)

| Field | Value |
|---|---|
| Bug | Gateway → Mi-Core HTTP timeout was 15,000ms; Mi-Core chat-queue allows up to 90,000ms |
| Root Cause | `TIMEOUT_MS = 15000` in `agent-mi-forwarder.js` — any Ollama-backed response taking >15s causes silent failure |
| Files Changed | `services/whatsapp-ai-gateway/src/forwarding/agent-mi-forwarder.js` |
| Fix Applied | Changed `TIMEOUT_MS` from `15000` to `95000` (95s, slightly above chat-queue's 90s max) |
| Retest | Send complex query via WhatsApp, verify no premature timeout |

---

## Bug #3: start.bat Does Not Start WhatsApp Gateway

| Field | Value |
|---|---|
| Bug | `start.bat` (Windows autostart) launches Mi-Core, AI Service, Agent Engine — but NOT WhatsApp Gateway |
| Root Cause | Historical: gateway was added later and never integrated into the startup script |
| Files Changed | `start.bat` |
| Fix Applied | Replaced individual `start "title" cmd /c` commands with `pm2 start ecosystem.config.js && pm2 save` — all processes including gateway now start via PM2 |
| Retest | Run `start.bat` or reboot → verify `pm2 list` shows all processes including `mi-whatsapp-gateway` |

---

## Bug #4: Headless Mode Not Default

| Field | Value |
|---|---|
| Bug | `WHATSAPP_HEADLESS` defaults to `'false'` in session-manager.js — requires visible Chrome window |
| Root Cause | Conservative default during development |
| Files Changed | `ecosystem.config.js` (env config) |
| Fix Applied | Set `WHATSAPP_HEADLESS: 'true'` in the PM2 environment for `mi-whatsapp-gateway` |
| Retest | Start gateway via PM2, verify no Chrome window appears, verify WhatsApp connects |

---

## Bug #5: PM2 Startup Persistence Not Configured

| Field | Value |
|---|---|
| Bug | PM2 process list is empty after reboot because `pm2 save` and `pm2 startup` were never executed |
| Root Cause | `start.bat` used raw `start` commands instead of PM2 |
| Files Changed | `start.bat` (now includes `pm2 save`) |
| Fix Applied | Added `pm2 save` after `pm2 start ecosystem.config.js` in start.bat. User must also run `pm2 startup` once manually. |
| Retest | After running start.bat, kill terminal, verify `pm2 list` still shows processes |

---

## Summary of Changes

| File | Change |
|---|---|
| `ecosystem.config.js` | Added `mi-whatsapp-gateway` app (headless, autorestart, port 3211) |
| `services/whatsapp-ai-gateway/src/forwarding/agent-mi-forwarder.js` | `TIMEOUT_MS`: 15000 → 95000 |
| `start.bat` | Replaced manual process launches with `pm2 start ecosystem.config.js && pm2 save` |

---

## Remaining Manual Steps Required

1. **Run once**: `pm2 startup` (generates Windows service for PM2 resurrection)
2. **Start system**: `pm2 start ecosystem.config.js && pm2 save`
3. **Verify**: `pm2 list` shows `mi-whatsapp-gateway` as `online`
4. **Test**: Send WhatsApp message "Mi ơi" — verify response received
5. **Reboot test**: Restart PC, wait 60s, send WhatsApp message — verify response
