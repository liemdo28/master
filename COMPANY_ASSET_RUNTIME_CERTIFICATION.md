# COMPANY_ASSET_RUNTIME_CERTIFICATION.md
> Phase 6 — Company Asset Runtime Wiring
> Date: 2026-06-18
> Target: COMPANY_ASSET_RUNTIME_CERTIFIED

---

## 6 Test Message Categories Wired

| # | Query Type | Intent | Route | Endpoint |
|---|-----------|--------|-------|----------|
| 1 | Company projects query | query_asset | response-pipeline step 15b | /api/company-os/assets |
| 2 | Service down query | query_asset | response-pipeline step 15b | /api/company-os/services/health |
| 3 | Department ownership | query_asset | response-pipeline step 15b | /api/company-os/departments |
| 4 | Source health | query_asset | response-pipeline step 15b | /api/company-os/data-sources |
| 5 | Project ownership | query_asset | response-pipeline step 15b | /api/company-os/projects |
| 6 | Agent project | query_asset | response-pipeline step 15b | /api/company-os/assets |

---

## WhatsApp → Asset Registry Flow

```
CEO WhatsApp message
  ↓
whatsapp.ts → response-pipeline.runPipeline()
  ↓
classifyIntent() → domain: 'company_asset' OR regex match
  ↓
Step 15b: fetch /api/company-os/assets (5s timeout, non-blocking)
  ↓
Asset data injected into system prompt as [Company Asset Registry]
  ↓
LLM generates CEO-language answer with real asset data
  ↓
scrubReply() → remove any leaked IDs
  ↓
CEO receives answer in WhatsApp
```

---

## Intent Router Addition

New intent: `query_asset`
Patterns added:
- `company project` / `du an cong ty` / `danh sach project`
- `service.*down` / `service nao` / `which service`
- `department.*own` / `bo phan.*phu trach` / `ai phu trach`
- `source.*health` / `data source` / `nguon du lieu`
- `project.*owner` / `owner.*project`
- `agent project` / `mi.*project` / `company asset`
- `ds project` / `list project` / `liet ke project`

---

## Asset Endpoints Active

| Endpoint | Returns |
|----------|---------|
| GET /api/company-os/assets | Full company snapshot (depts/projects/services/sources) |
| GET /api/company-os/projects | All projects with owners |
| GET /api/company-os/services | All services with PM2 status |
| GET /api/company-os/services/health | Live health check all services |
| GET /api/company-os/departments | 14 departments with status |
| GET /api/company-os/data-sources | Data source registry + missing credentials |

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| query_asset intent added to intent-router | ✅ |
| WhatsApp pipeline wires to /api/company-os/assets | ✅ |
| Timeout: 5000ms, non-blocking | ✅ |
| Asset data injected into LLM context | ✅ |
| No raw internal IDs to CEO | ✅ (scrubReply runs after) |
| 6 query types covered | ✅ |

## Status: COMPANY_ASSET_RUNTIME_CERTIFIED ✅
