# SEO_CONTROL_DISCOVERY.md
Generated: 2026-06-24T05:29:00Z

## SEO Control Status: SEO_CONTROLLED

All 7 SEO agents are ONLINE and healthy.
All 7 agents report to Mi-Core via /api/seo routes.
Orchestrator routes are implemented in Mi-Core.
n8n SEO workflows exist and have been executed today.

---

## SEO Agent Inventory

### Agent Matrix (live runtime data from /api/seo/dashboard)

| Agent | Port | Status | Health | Uptime (s) | Tasks Done | Tasks Pending |
|-------|------|--------|--------|------------|------------|---------------|
| seo-local-maps-agent | 4011 | online | healthy | 15732 | 0 | 0 |
| seo-technical-agent | 4013 | online | healthy | 15727 | 0 | 0 |
| seo-citation-agent | 4016 | online | healthy | 15727 | 0 | 0 |
| seo-schema-agent | 4014 | online | healthy | 15726 | 0 | 0 |
| seo-website-agent | 4012 | online | healthy | 15726 | 0 | 0 |
| seo-analytics-agent | 4017 | online | healthy | 15726 | 0 | 0 |
| seo-content-agent | 4015 | online | healthy | 15726 | 0 | 0 |

**Uptime note:** 15,732s = ~4.37 hours. Agents started ~08:00 AM ICT today.

---

## Brand Support

| Brand | Domain | Status | Health Score | Locations |
|-------|--------|--------|-------------|-----------|
| bakudan | https://bakudanramen.com | active | 76 (degraded) | 3 |
| raw_sushi | https://rawsushibar.com | needs_config | 46 (critical) | 1 |
| test_brand_3 | https://example.com | inactive | 30 (critical) | 0 |

---

## Evidence Output

| Endpoint | Available | Last Data |
|----------|-----------|-----------|
| /api/seo/dashboard | ✅ YES | 2026-06-24T05:21:20Z |
| /api/seo/brands | ✅ YES | Brand configs loaded |
| /api/seo/connectors/status | ✅ YES | GSC/GA4/GBP missing_credentials |
| /api/seo/reports/latest | ✅ YES | Agents reporting |
| /api/seo/issues | ✅ YES | 0 issues |
| /api/seo/opportunities | ✅ YES | 0 opportunities |
| /api/seo/orchestrator/status | ✅ YES | orchestratorJobs populated |
| /api/seo/orchestrator/run/:jobId | ✅ YES | Route implemented |

---

## n8n SEO Workflows

| Workflow | File | Schedule | Mi Required | Ran Today? |
|----------|------|----------|-------------|-------------|
| seo-daily-audit | Mi/n8n/workflows/seo/seo-daily-audit.json | 0 7 * * * | yes | ✅ YES (01:50 UTC) |
| seo-weekly-executive-report | Mi/n8n/workflows/seo/seo-weekly-executive-report.json | 0 9 * * 1 | yes | ❌ NOT YET (scheduled Monday) |

**Evidence log entry:**
```json
{"log_id":"log_017d7512-9f35-4749-b878-7a4d4f737a95",
 "workflow_id":"seo-daily-audit","domain":"seo","source":"n8n",
 "brand_id":"bakudan","location_id":"all","status":"completed",
 "started_at":"2026-06-24T01:50:00Z","completed_at":"2026-06-24T01:50:05Z"}
```

---

## Mi ↔ SEO Control

| Capability | Status | Evidence |
|-----------|--------|---------|
| Mi can trigger SEO audit? | YES | /api/seo/orchestrator/run/:jobId |
| Mi can read SEO status? | YES | /api/seo/dashboard |
| Mi can assign task to SEO agent? | YES | /api/seo/tasks POST |
| Mi can collect SEO evidence? | YES | /api/seo/reports/latest |
| Mi can run SEO connectors? | YES | /api/seo/connectors/run |
| SEO agents register with Mi? | YES | /api/seo/agents/register |
| SEO agents report health to Mi? | YES | /api/seo/agents/:id/health |
| SEO agents send reports to Mi? | YES | /api/seo/agents/:id/reports |

---

## Missing / Degraded

| Issue | Impact | Fix Required |
|-------|--------|--------------|
| GSC credentials missing | SEO score incomplete | Configure GSC API |
| GA4 credentials missing | Analytics data unavailable | Configure GA4 API |
| GBP credentials missing | Local SEO blind spot | Configure GBP API |
| raw_sushi status = needs_config | SEO not active | Add brand config |
| 0 real data records | All brands have seeded data only | Connect real data sources |
| test_brand_3 inactive | Waste of agent capacity | Remove or activate |
| SEO agents tasks_completed = 0 | No manual tasks ever run | Manually trigger / test |

---

## Final Assessment

**SEO_CONTROLLED**
- All 7 agents online ✅
- n8n SEO workflows exist ✅
- seo-daily-audit ran today ✅
- Mi can trigger all SEO workflows ✅
- Brand config system active ✅
- Data quality: DEGRADED (missing credentials, seeded data only) ⚠️
