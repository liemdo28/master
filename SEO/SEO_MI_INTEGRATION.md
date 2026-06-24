# SEO MI Integration — Phase 6.6

**Updated:** 2026-06-24

## Integration Points

### Mi-Core Server → SEO Router
- Mount: `app.use('/api/seo', seoRouter)` in `server/src/index.ts` (line 234)
- Port: 4001 (main Mi-Core server)
- No auth middleware on SEO routes (internal)

### SEO Agents → Mi-Core Server
- Agent register: `POST /api/seo/agents/register`
- Agent health: `POST /api/seo/agents/:id/health`
- Agent status: `POST /api/seo/agents/:id/status`
- Agent reports: `POST /api/seo/agents/:id/reports`
- Dashboard update: `POST /api/seo/dashboard/:id`

### Agent Ports
| Agent | Port | Brand Support |
|-------|------|--------------|
| Crawler (connector hub) | 4011 | All brands via config |
| Technical Audit | 4012 | All brands via config |
| Schema Validator | 4014 | All brands via config |
| Content | 4015 | All brands via config |
| Executive Report | 4017 | All brands via config |
| GSC Connector | 4021 | All brands via config |
| GA4 Connector | 4022 | All brands via config |
| GBP Connector | 4023 | All brands via config |

### Orchestrator Integration
- Brand-scoped jobs: `POST /api/seo/orchestrator/run/:jobId?brand_id=all|bakudan|raw_sushi`
- Each job creates a record with: `job_id`, `brand_id`, `location_id`, `status`, `started_at`, `completed_at`, `records_processed`, `error`
- brand_id=all iterates through all active brands

### Config Files (Phase 6.6)
- `SEO/shared/config/brands.json` — brand definitions (bakudan, raw_sushi, test_brand_3)
- `SEO/shared/config/locations.json` — location definitions per brand
- `SEO/shared/config/credentials-map.json` — per-brand Google credential profiles
- `ecosystem.config.cjs` — PM2 process definitions (Mi-Core + WhatsApp + 7 SEO agents + orchestrator)

### Config Validators (Phase 6.6)
- `SEO/shared/base/validate-brand-config.js` — validates brands + locations JSON
- `SEO/shared/base/validate-google-credentials.js --brand=all` — validates credential readiness

### PM2 / Startup
```bash
# Start all services
pm2 start ecosystem.config.cjs
pm2 save
pm2 list

# Expected: 10 processes
# mi-core, mi-whatsapp-gateway, 7 seo-agent-*, seo-orchestrator
```

### Multi-Brand API Endpoints
```
GET /api/seo/brands                         → All brands
GET /api/seo/brands/:brandId                → Single brand detail
GET /api/seo/brands/:brandId/dashboard      → Brand dashboard
GET /api/seo/brands/:brandId/locations      → Brand locations
GET /api/seo/brands/:brandId/kpis           → Brand KPIs
GET /api/seo/brands/:brandId/issues         → Brand issues
GET /api/seo/brands/:brandId/opportunities  → Brand opportunities
GET /api/seo/brands/:brandId/connectors/status → Brand connectors
GET /api/seo/data-sources                   → All data sources by brand
GET /api/seo/kpis                           → Global KPIs
GET /api/seo/dashboard                      → Global dashboard
GET /api/seo/orchestrator/status            → Orchestrator status
POST /api/seo/orchestrator/run/:jobId       → Trigger job for brand(s)
POST /api/seo/config/reload                 → Reload config from disk
```
