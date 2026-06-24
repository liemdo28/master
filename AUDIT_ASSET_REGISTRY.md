# AUDIT: Asset Registry (A3)
**Date:** 2026-06-24  
**Status:** ✅ PASS

---

## Evidence Collected

### Projects Registry
```
GET /api/company-os/projects
Total: 24
Active: 20
Critical: 3
  - mi-core (port 4001, CRITICAL)
  - whatsapp-ai-gateway (port 3211, CRITICAL)
  - accounting-engine (port 8844, CRITICAL)
```

### Service Registry
```
GET /api/company-os/services
Total: 13 services
  pm2: 7 (mi-core, whatsapp-ai-gateway, accounting, ceo-observer, ai-service, node-agent, antigravity)
  docker: 3 (review-api, postgres, redis)
  windows: 1 (ollama)
  external: 2 (quickbooks-laptop1, bakudan-dashboard)
With health endpoints: 9
```

### Data Source Inventory
```
GET /api/company-os/sources
Total: 49 sources
  ACTIVE:             40
  PLANNED:            6
  INSTALLED_NOT_USED: 1 (paperless-ngx)
  DEPRECATED:         2 (qwen3:1.7b, deepseek-r1:14b)
```

### Scenario Tests

| Question | Answer |
|----------|--------|
| "Project nào?" | 24 projects returned, 20 active, 3 critical |
| "Service nào down?" | 3 unhealthy: accounting-engine, review-api, bakudan-dashboard |
| "Dashboard thuộc phòng nào?" | bakudan-dashboard → report-center |
| "Toast healthy không?" | toast-pos: ACTIVE, no local health endpoint |

---

## Issues Found

| ID | Issue | Severity |
|----|-------|----------|
| AR-01 | accounting-engine health: FAIL (fetch failed) — PM2 running but health endpoint unreachable | HIGH |
| AR-02 | review-api health: FAIL (fetch failed) — Docker containers not running | MEDIUM |
| AR-03 | bakudan-dashboard health: 403 Forbidden — Cloudflare blocking internal check | LOW |
| AR-04 | Toast POS has no health endpoint — status assumed ACTIVE | LOW |

---

## Verdict
**ASSET_REGISTRY_PASS** — Project, service, and data source registries fully populated and returning accurate data. 3 service health issues logged.
