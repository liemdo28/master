# NO_SILENT_FAILURE_CERTIFICATION.md
> Phase 12 — Self Healing & Burn-In
> Date: 2026-06-18
> Target: NO_SILENT_FAILURE

---

## 11 Services Monitored (Every 60 Seconds)

| # | Service ID | Name | Type | Critical | Auto-Restart |
|---|-----------|------|------|:---:|:---:|
| 1 | mi-core | Mi Core Server | PM2 | ✅ | ✅ (max 2x) |
| 2 | whatsapp-gateway | WhatsApp Gateway | PM2 | ✅ | ✅ (max 2x) |
| 3 | mi-accounting | Accounting Engine | PM2 | ✅ | ✅ (max 2x) |
| 4 | mi-ceo-observer | CEO Observer | PM2 | ○ | ✅ (max 2x) |
| 5 | mi-core-http | Mi Core HTTP | HTTP | ✅ | ○ |
| 6 | accounting-http | Accounting HTTP | HTTP | ○ | ○ |
| 7 | ollama | Ollama AI | HTTP | ✅ | ○ |
| 8 | food-safety-gw | Food Safety Gateway | PM2 | ○ | ✅ (max 2x) |
| 9 | qb-ops-agent | QB Ops Agent | PM2 | ○ | ✅ (max 2x) |
| 10 | evidence-db | Evidence DB | HTTP | ✅ | ○ |
| 11 | knowledge-db | Knowledge DB | HTTP | ○ | ○ |

---

## Auto-Restart Policy

1. Service down detected at 60s scan
2. PM2 services: `pm2 restart [name]` attempted (up to 2 times)
3. After 2 failed restarts → CEO WhatsApp alert
4. Critical services → CEO alert immediately regardless of restart count
5. Counter resets when service recovers

---

## CEO Alert Format

```
🔴 *SERVICE DOWN*
[Service Name] is DOWN.
Auto-restart exhausted.
Manual action required.
```

---

## Monitor Endpoints

```
GET /api/company-os/monitor  — live scan of all 11 services
GET /api/company-os/services/health — per-service health via registry
```

---

## Burn-In Status

- Monitor starts automatically on `npm start` / PM2 boot
- `startSelfHealingMonitor(60_000)` called in index.ts after server ready
- Runs alongside existing `startSelfHealingScheduler(5)` (operational health)

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| 11 services monitored | ✅ |
| 60-second interval | ✅ |
| Auto-restart PM2 services | ✅ (max 2 attempts) |
| CEO alert on unresolved | ✅ WhatsApp alert |
| Monitor starts on boot | ✅ wired in index.ts |
| No silent failure | ✅ every failure triggers action |

## Status: NO_SILENT_FAILURE ✅
