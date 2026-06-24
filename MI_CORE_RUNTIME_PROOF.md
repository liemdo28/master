# MI_CORE_RUNTIME_PROOF.md
Generated: 2026-06-24T05:30:00Z

## Mi-Core Runtime Proof — All Endpoints Probed 2026-06-24T05:19–05:30 UTC

---

## B1 — Mi-Core Health

### GET /api/health
```json
{"server":"ok","python_ai_service":"ok","ollama":"ok","timestamp":"2026-06-24T05:19:21.803Z"}
```
**Result: ✅ Mi-Core is ONLINE**

---

### GET /api/executive-intelligence/health
```json
{
  "ok":true,
  "service":"executive-intelligence-layer",
  "version":"phase21",
  "model_routes":{
    "intent":"qwen3:14b","planner":"qwen3:14b","reasoner":"qwen3:14b",
    "decision":"qwen3:14b","reflection":"qwen3:14b","brief":"qwen3:14b",
    "tools":"qwen3:8b","embeddings":"nomic-embed-text","premium":"qwen3.6:27b"
  },
  "ollama":{"reachable":true,"model_count":6},
  "evidence_store":{"path":"E:\\Project\\Master\\mi-core\\data\\evidence"},
  "objective_runs":{"total":75,"path":".local-agent-global/executive-intelligence/runs"},
  "uptime":0,
  "timestamp":"2026-06-24T05:21:01.932Z"
}
```
**Result: ✅ Executive Intelligence is ONLINE with 75 objective runs**

---

## B1 — Company-OS Assets

### GET /api/company-os/assets
```json
{
  "departments":{"total":20,"active":11},
  "projects":{"total":24,"active":20,"critical":3},
  "services":{"total":13,"pm2":7,"docker":3,"windows":1,"external":2,"with_health_endpoints":9},
  "data_sources":{"total":18,"degraded":1,"healthy":15,"unknown":2,"write_capable":11,"missing_credentials":2},
  "summary":{
    "projects":"Project Registry — 24 total\n  ACTIVE: 20\n  ARCHIVED: 1\n  SHADOW: 2\n  UNKNOWN: 1\n  CRITICAL: 3\n  PM2-managed: 6",
    "services":"Service Registry — 13 total\n  pm2: 7\n  docker: 3\n  windows: 1\n  external: 2\n  With health endpoints: 9",
    "sources":"Data Source Registry — 18 total\n  degraded: 1\n  healthy: 15\n  unknown: 2\n  write-capable: 11\n  missing credentials: 2"
  }
}
```
**Result: ✅ Company-OS is OPERATIONAL — 20 departments, 24 projects, 13 services**

---

## B1 — Company-OS Health

### GET /api/company-os/health
```json
{
  "status":"OK",
  "version":"2.0.0",
  "phase":2,
  "departments":{"total":20,"active":11},
  "brains":{"configured":14},
  "pipeline":"WORKING_DEPARTMENTS_READY",
  "qa":"INDEPENDENT",
  "evidence":"SQLITE_WAL",
  "certification_target":"WORKING_DEPARTMENTS_READY"
}
```
**Result: ✅ Company-OS Phase 2 — WORKING_DEPARTMENTS_READY**

---

## B1 — Projects Scan

### GET /api/projects
```json
{"total":36,"projects":[...36 projects...]}
```
**Result: ✅ All 36 projects scanned and registered**

---

## B1 — Projects Health Board

### GET /api/projects/health
```json
{
  "board":"🔌 CONNECTOR HEALTH BOARD\n\nLOCAL CONNECTORS:\n  Raw Website:    ✓ synced\n  Bakudan Web:    ⚠ server down\n  Dashboard:      ✓ API live\n\nREMOTE CONNECTORS:\n  integration-system   ○ Remote agent not configured. Set INTEGRATION_SYSTEM_HOST in .env\n  whatsapp-api         ○ Remote agent not configured. Set WHATSAPP_API_HOST in .env",
  "remotes":[...]
}
```
**Result: ⚠️ 1 connector DOWN (bakudan-website), 2 remotes unconfigured**

---

## B1 — Autonomous Scheduler

### GET /api/autonomous/tasks
```json
{
  "success":true,
  "data":[
    {"task_id":"auto-health-15m","task_type":"health_check","trigger":"scheduled","autonomy":{"level":"FULL_AUTO","category":"health_monitoring","can_run_now":true}},
    {"task_id":"auto-log-1h","task_type":"log_analysis","trigger":"scheduled","autonomy":{"level":"FULL_AUTO","category":"log_analysis","can_run_now":true}},
    {"task_id":"auto-memory-sync","task_type":"memory_sync","trigger":"scheduled","autonomy":{"level":"FULL_AUTO","category":"memory_sync","can_run_now":true}},
    {"task_id":"auto-graph-nightly","task_type":"graph_refresh","trigger":"scheduled","autonomy":{"level":"FULL_AUTO","category":"graph_refresh","can_run_now":true}},
    {"task_id":"auto-briefing-7am","task_type":"reporting","trigger":"scheduled","autonomy":{"level":"FULL_AUTO","category":"reporting","can_run_now":true}},
    {"task_id":"auto-qa-incident","task_type":"qa_regression","trigger":"incident","autonomy":{"level":"FULL_AUTO","category":"qa_regression","can_run_now":true}}
  ],
  "timestamp":"2026-06-24T05:19:58.405Z"
}
```
**Result: ✅ 6 autonomous tasks registered and runnable**

---

## B1 — n8n Health

### GET /api/n8n/health
```json
{"ok":true,"n8n_url":"http://localhost:5678","status":200}
```
**Result: ✅ n8n is ONLINE at port 5678**

---

## B1 — SEO Dashboard

### GET /api/seo/dashboard
```json
{
  "ok":true,"brand_count":3,"location_count":4,"brands_online":1,
  "agents_online":7,"agents_total":7,"all_agents_online":true,
  "brand_health_score":51,
  "seo_score_summary":{"overall":"operational","agents_reporting":7},
  "last_sync":"2026-06-24T05:21:20.282Z",
  "agents":[
    {"id":"seo-local-maps-agent","status":"online","health":"healthy","port":4011,"uptime_s":15732},
    {"id":"seo-technical-agent","status":"online","health":"healthy","port":4013,"uptime_s":15727},
    {"id":"seo-citation-agent","status":"online","health":"healthy","port":4016,"uptime_s":15727},
    {"id":"seo-schema-agent","status":"online","health":"healthy","port":4014,"uptime_s":15726},
    {"id":"seo-website-agent","status":"online","health":"healthy","port":4012,"uptime_s":15726},
    {"id":"seo-analytics-agent","status":"online","health":"healthy","port":4017,"uptime_s":15726},
    {"id":"seo-content-agent","status":"online","health":"healthy","port":4015,"uptime_s":15726}
  ]
}
```
**Result: ✅ All 7 SEO agents ONLINE and reporting**

---

## Summary

| Endpoint | Status | Response |
|----------|--------|---------|
| /api/health | ✅ OK | server, ollama, python_ai_service all ok |
| /api/executive-intelligence/health | ✅ OK | 75 objective runs, 6 models |
| /api/company-os/health | ✅ OK | Phase 2, 11 active depts |
| /api/company-os/assets | ✅ OK | 20 depts, 24 projects, 13 services |
| /api/projects | ✅ OK | 36 projects scanned |
| /api/projects/health | ⚠️ DEGRADED | bakudan-website DOWN |
| /api/autonomous/tasks | ✅ OK | 6 autonomous tasks |
| /api/n8n/health | ✅ OK | n8n running at port 5678 |
| /api/seo/dashboard | ✅ OK | 7 agents online |
