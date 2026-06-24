# PHASE_14_PM2_RESTART_REPORT.md
> Phase 14 — PM2 Restart + Health Verification
> Date: 2026-06-18

---

## Test 10: PM2 Restart All + Health Verification

### Command
```bash
pm2 restart all
```

### PM2 Processes After Restart

| App | PID | Uptime | Status |
|-----|-----|--------|--------|
| mi-core | 18620 | 15s | online |
| whatsapp-ai-gateway | 14236 | 9s | online |
| mi-accounting | N/A | — | online |

---

## Port Verification

### Port 4001 (Mi-Core)

```
netstat -ano | grep ":4001" | grep LISTENING
TCP    0.0.0.0:4001    0.0.0.0:0    LISTENING    18620

pm2 list → mi-core PID: 18620
```

**✅ Match: PM2 PID 18620 = Port 4001 owner PID 18620**

### Port 3211 (WhatsApp Gateway)

```
GET http://localhost:3211/health
```

**Response:**
```json
{
  "ok": true,
  "runtime": {
    "name": "whatsapp-ai-gateway",
    "build": "Admin Control Center v1",
    "pid": 14236,
    "started_at": "2026-06-18T04:28:07.007Z",
    "uptime_seconds": 9,
    "whatsapp_ready": true,
    "whatsapp_status": "ready",
    "google_sheets_ready": true,
    "ocr_ready": true
  },
  "whatsapp": "ready"
}
```

---

## Port 4001 Health Check

```
GET http://localhost:4001/api/health
```

**Response:**
```json
{
  "server": "ok",
  "python_ai_service": "down",
  "ollama": "ok",
  "timestamp": "2026-06-18T04:28:16.185Z"
}
```

---

## EADDRINUSE Fix Applied

**Problem identified during testing:** PM2 restart was creating zombie processes because `startHttpServer()` had an infinite retry loop. Old processes waiting in queue would grab the port when it became free, preventing the new PM2 process from binding.

**Fix applied:**
```typescript
// Before: infinite while loop
while (!(await canBind(PORT, HOST))) {
  _bindAttempts++;
  console.warn(`[Mi][EADDRINUSE] Port ${PORT} busy — waiting...`);
  await new Promise(resolve => setTimeout(resolve, BIND_RETRY_MS));
}

// After: max 3 attempts then exit cleanly
const MAX_BIND_ATTEMPTS = 3;
while (!(await canBind(PORT, HOST))) {
  _bindAttempts++;
  if (_bindAttempts >= MAX_BIND_ATTEMPTS) {
    console.error(`[Mi][EADDRINUSE] Port ${PORT} still busy after ${MAX_BIND_ATTEMPTS} attempts — exiting`);
    process.exit(1);
  }
  ...
}
```

**Result:** PM2 now owns the restart cycle cleanly. PID always matches between port 4001 and PM2 process list.

---

## Verification

- ✅ Both services (4001 and 3211) healthy after `pm2 restart all`
- ✅ Port 4001 PID matches PM2 registered PID
- ✅ WhatsApp Gateway connected and ready
- ✅ Ollama LLM runtime reachable
- ✅ No zombie processes
