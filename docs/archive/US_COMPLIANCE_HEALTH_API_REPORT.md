# US COMPLIANCE HEALTH API REPORT

**Date:** 2026-06-10
**Directive:** US Compliance DB Integration Part 2 — Phase 1 (API Integration)
**Prerequisite:** US_COMPLIANCE_PATH_RESOLVER_READY ✅

---

## Scope

Expose US Compliance Reference Brain health/status through the Mi-Core API,
using the canonical `reference-brain-path` resolver only — no duplicated path
logic anywhere.

---

## Endpoints

| Method | Route | Source | Purpose |
|--------|-------|--------|---------|
| GET | `/api/knowledge/us-compliance/status` | `getComplianceDBStatus()` | Full health + READY/PARTIAL/MISSING/ERROR status |
| GET | `/api/knowledge/us-compliance/health` | `checkUSComplianceDBHealth()` | Canonical health shape (CEO directive schema) |
| GET | `/api/brain/status` | `getComplianceDBStatus()` | Federated brain status (see Brain Status report) |

Both knowledge endpoints are registered in `server/src/routes/knowledge.ts`
and mounted under `/api/knowledge` in `server/src/index.ts`.

---

## Response Schema

`GET /api/knowledge/us-compliance/status` returns the full health payload plus
status fields:

```json
{
  "exists": true,
  "resolved_path": "e:/Project/Master/mi-core/.local-agent-global/reference-brain/us-business-compliance",
  "checked_paths": [ "...mi-core/.local-agent-global/...", "...workspace/.local-agent-global/..." ],
  "raw_size_mb": 559.13,
  "document_count": 743,
  "chunk_count": 515935,
  "source_count": 736,
  "jurisdictions": ["california","federal","san-antonio","stockton","texas"],
  "domains": ["accounting","food-safety","labor-law","payroll","permits","restaurant-operations","tax"],
  "catalog_exists": true,
  "manifest_exists": true,
  "last_indexed": "2026-06-10T07:03:09Z",
  "searchable": true,
  "errors": [],
  "status": "READY",
  "resolved_from": "resolver",
  "raw_size_bytes": 586300231
}
```

`GET /api/knowledge/us-compliance/health` returns the same payload **without**
the status/derived fields — exactly the CEO directive schema keys:
`exists, resolved_path, checked_paths, raw_size_mb, document_count,
chunk_count, source_count, jurisdictions, domains, catalog_exists,
manifest_exists, last_indexed, searchable, errors`.

---

## Data Sources (Real, Not Hardcoded)

All values are read live at request time:

| Field | Source |
|-------|--------|
| `raw_size_mb`, `document_count`, `chunk_count`, `source_count`, `jurisdictions`, `last_indexed` | `<db>/reports/db_stats.json` |
| `domains` | top-level directory scan of resolved DB path |
| `catalog_exists` | `<db>/source-catalog/source_catalog.json` |
| `manifest_exists` | `<db>/source-catalog/MI_INTEGRATION_MANIFEST.json` |
| `resolved_path`, `checked_paths` | `reference-brain-path` resolver |

If `db_stats.json` is missing, the resolver falls back to a filesystem
jurisdiction scan and records the fallback in `errors[]`.

---

## Rules Compliance

- ✅ Uses `reference-brain-path` resolver only (`getComplianceDBStatus`,
  `checkUSComplianceDBHealth`, `getUSComplianceDBPath`).
- ✅ No duplicated path logic — `compliance-path.ts` is a re-export shim.
- ✅ When DB is missing, `checked_paths` is populated and `errors[]` carries
  the reason; `exists=false`, `status=MISSING`.

---

## Validation

In-process Express harness mounted `knowledgeRouter` + `brainRouter` and hit
the endpoints. Results:

```
GET /api/knowledge/us-compliance/status → 200
  exists=true, status=READY
  resolved_path → mi-core/.local-agent-global/reference-brain/us-business-compliance
  document_count=743, chunk_count=515935, source_count=736
  jurisdictions=5, domains=7, catalog=true, manifest=true, searchable=true
GET /api/knowledge/us-compliance/health → 200 (all 14 directive keys present)
```

TypeScript build (`tsc -p server/tsconfig.json`): **PASS** (zero errors).

---

## Verdict

**US_COMPLIANCE_HEALTH_API: READY** — real, non-zero counts served from the
canonical resolver; no fake zeros; no hardcoded paths.
