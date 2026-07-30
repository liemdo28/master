# AUDIT: Self Healing (A9)
**Date:** 2026-06-24  
**Status:** ⚠️ PARTIAL — Health scan works, auto-restart not verified

---

## Evidence Collected

### Services Health Scan
```
GET /api/company-os/services/health
Total: 9 checked
Healthy: 6
Unhealthy: 3

HEALTHY:
  svc-mi-core           → 200 OK
  svc-whatsapp-gateway  → 200 OK
  svc-ceo-observer      → 200 OK
  svc-ai-service        → 200 OK
  svc-antigravity-gateway → 200 OK
  svc-ollama            → 200 OK

UNHEALTHY:
  svc-accounting  → fetch failed (port 8844 not responding)
  svc-review-api  → fetch failed (Docker container down)
  svc-dashboard   → 403 Forbidden (Cloudflare block)
```

### PM2 Status (Runtime)
```
pm2 list (captured at session start):
  mi-accounting          ONLINE  uptime:6m  restarts:0
  mi-ai-service          ONLINE  uptime:6m  restarts:0
  mi-ceo-observer        ONLINE  uptime:6m  restarts:0
  mi-core                ONLINE  uptime:6m  restarts:0
  mi-node-agent          ONLINE  uptime:6m  restarts:0
  mi-whatsapp-gateway    ONLINE  uptime:6m  restarts:0
  pm2-logrotate          ONLINE
```
**Discrepancy:** `mi-accounting` shows ONLINE in PM2 but health endpoint fails. Process runs but Express server on port 8844 is not responding.

### Self-Healing Monitor Source
```typescript
// company-os/self-healing-monitor.ts
runHealthScan() — checks all services via getMonitoredServices()
```
The monitor runs via autonomous scheduler `auto-health-15m`.

### Kill Test
PM2 processes all show 0 restarts. Could not perform live kill test without risk to production. PM2 auto-restart is configured by default (`max_restarts: unlimited`).

---

## Issues Found

| ID | Issue | Severity |
|----|-------|----------|
| SH-01 | accounting-engine health FAIL — PM2 online but port 8844 not listening | HIGH |
| SH-02 | review-api health FAIL — Docker containers not running | MEDIUM |
| SH-03 | No auto-restart trigger visible from API (scheduler runs but no restart action confirmed) | MEDIUM |
| SH-04 | No alerting when service goes unhealthy (WhatsApp paused) | MEDIUM |
| SH-05 | `/api/company-os/self-healing` route missing (correct path requires services/health) | LOW |

---

## Verdict
**SELF_HEALING_PARTIAL** — Health scanning works. PM2 auto-restart configured. 2 real service failures detected (accounting-engine, review-api). No alert delivery due to WhatsApp being paused. accounting-engine discrepancy (PM2 online but port dead) is the critical finding.
