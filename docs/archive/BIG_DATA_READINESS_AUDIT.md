# Mi-Core Big Data Readiness Audit
**Date:** 2026-06-10
**Branch:** feature/mi-core-big-data-foundation
**Auditor:** Automated codebase scan + manual analysis

---

## Executive Summary

Mi-Core has a rich but fragmented data landscape. Data lives in 6+ different formats across SQLite, JSON flat files, in-memory sessions, and remote APIs. No central warehouse exists. This audit establishes the baseline for the Big Data Foundation build.

---

## 1. Existing Data Infrastructure

### Databases
| File | Type | Purpose | Ingest Status |
|---|---|---|---|
| `.local-agent-global/knowledge-db/knowledge.db` | SQLite | Full-text knowledge search | Already ingested via knowledge-db module |
| `data/qb-agent.db` | SQLite | QuickBooks agent activity | **Ingest now** — QB connector |
| `server/data/qb-agent.db` | SQLite | Duplicate of above | **DUPLICATE — ingest once** |

### JSON Flat-File Stores
| Path | Content | Ingest Status |
|---|---|---|
| `.local-agent-global/company-memory/` | decisions, employees, incidents, lessons, processes, projects, vendors | **Ingest now** — high value for CEO query |
| `.local-agent-global/executive-memory-v2/` | business_memory, decision_memory, owner_profile, preferences, workflow | **Ingest now** — core memory |
| `.local-agent-global/knowledge-db/ingestion_log.json` | ingestion job history | **Index** |
| `owner-profile/*.json` | CEO health, preferences, relationships, work style | **SENSITIVE — ingest with consent flag** |
| `agent-engine/kb/sources/*.json` | Domain knowledge (accounting, HR, coding, etc.) | **Ingest now** |

### Reference Data
| Path | Content | Size | Status |
|---|---|---|---|
| `reference-brain/us-business-compliance/` | 743 markdown docs | 1.5GB | Already in compliance retrieval pipeline. Do NOT re-ingest raw into bigdata — too large, already indexed |
| `reference-brain/us-business-compliance/source_catalog.csv` | Source index | small | **Register as data_source only** |

---

## 2. Sources Ready to Ingest Immediately

| Source | Type | Priority | Notes |
|---|---|---|---|
| `data/qb-agent.db` | QuickBooks SQLite | HIGH | Deduplicate with server/data copy |
| `.local-agent-global/company-memory/` | JSON | HIGH | 7 domains, CEO-relevant |
| `server/data/sample_sales_raw.csv` | CSV | HIGH | Test data for data analyst |
| Review Automation system output | JSON | HIGH | `review-automation-system/data/` |
| Dashboard task snapshots | JSON | HIGH | `Bakudan/dashboard.bakudanramen.com/` |
| DoorDash agent data | JSON | MEDIUM | `data/doordash-agent/` |
| Agent-engine KB sources | JSON | MEDIUM | 10 domain files |

---

## 3. Sources Needing Dedicated Connectors

| Source | Connector Needed | Auth |
|---|---|---|
| DoorDash Merchant Portal | Browser automation + scraper | Session cookie (L2 approval) |
| UberEats Merchant Portal | Browser automation | Session cookie (L2 approval) |
| Yelp Business Dashboard | Browser automation | OAuth |
| Google My Business | REST API | OAuth2 |
| QuickBooks Online API | REST API | OAuth2 (QB developer app) |
| Gmail attachments | Gmail API | Google OAuth2 |
| Google Drive files | Drive API | Google OAuth2 |
| Asana projects | Asana REST API | ASANA_TOKEN |

---

## 4. Data Currently Scattered

| Data | Location | Problem |
|---|---|---|
| QB transactions | `data/qb-agent.db` + `server/data/qb-agent.db` | **DUPLICATE** — two copies diverging |
| Knowledge items | `knowledge-db/knowledge.db` + `agent-engine/kb/` | Two separate search indexes, not unified |
| Executive memory | `executive-memory-v2/` + `company-memory/` + `owner-profile/` | 3 separate JSON stores with overlapping concepts |
| Project data | `data/projects.json` + Asana (external) + Dashboard | No single source of truth for task status |
| Review data | review-automation-system + Yelp/Google external | No central review database |
| DoorDash data | `data/doordash-agent/` (partial) | Incomplete, no payout records |

---

## 5. Duplicate Risk

| Risk | Severity | Mitigation |
|---|---|---|
| `qb-agent.db` in two locations | HIGH | Ingest once from canonical path, register duplicate as alias |
| Company memory JSON overlaps with executive memory | MEDIUM | Dedup on content hash at ingest time |
| Compliance docs (1.5GB) if re-ingested | HIGH | Mark as excluded — already in retrieval pipeline |
| Review records if fetched from API + from local files | MEDIUM | Checksum dedup in `raw_objects` table handles this |

---

## 6. Sensitive Data — DO NOT INGEST RAW

| File | Why Blocked |
|---|---|
| `server/.env` | Contains all API keys and secrets |
| `infra/bigdata/.env` | DB passwords |
| `owner-profile/health_context.json` | Health data — requires explicit consent |
| `owner-profile/consent_log.json` | Access control log — internal only |
| `google-tokens.json` (wherever it exists) | OAuth refresh token |
| Any `*credentials*.json` | Service account keys |
| `id_rsa`, `*.pem` | Private keys |
| WhatsApp API key hash | Handled separately — never ingest to bigdata |

The `secret-redactor.ts` module enforces these rules automatically at ingest time.

---

## 7. Existing Agent Tools Compatible with Big Data

| Tool | Compatible? | Notes |
|---|---|---|
| `DataAnalystEngine.mjs` | YES (via file ingest) | Can analyze CSVs after they're ingested to MinIO |
| `knowledge-federation/` | PARTIAL | Separate index — should be unified with bigdata search long-term |
| `qdrant-client.ts` | YES | Points to same Qdrant — `mi_bigdata` collection added alongside existing |
| `data-analyst-handler.ts` | PARTIAL | Reads from `.local-agent-global/data-analyst/` — needs bigdata catalog integration |
| `universal-visibility/` connectors | YES | Their snapshots should push to bigdata via POST /api/bigdata/ingest/json |

---

## 8. Existing API Endpoints (22 routes, no bigdata before this build)

`/api/agent-engine`, `/api/approval`, `/api/auth`, `/api/brain`, `/api/browser`, `/api/chat`, `/api/data-analyst`, `/api/doordash-agent`, `/api/health`, `/api/knowledge`, `/api/memory`, `/api/models`, `/api/profile`, `/api/projects`, `/api/qb-agent`, `/api/reminders`, `/api/remote`, `/api/skills`, `/api/visibility`, `/api/whatsapp`, `/api/workspace`

**New:** `/api/bigdata` — added by this build.

---

## 9. Readiness Score

| Capability | Before | After This Build |
|---|---|---|
| Centralized raw storage | ❌ | ✅ MinIO |
| Structured metadata | ❌ | ✅ PostgreSQL |
| Semantic search | PARTIAL (Qdrant exists but no bigdata collection) | ✅ |
| Secret redaction at ingest | ❌ | ✅ |
| Duplicate detection | ❌ | ✅ (checksum) |
| Data quality checks | ❌ | ✅ 8 checks |
| CEO query layer | ❌ | ✅ 7 query patterns |
| Connector framework | ❌ | ✅ 5 connectors |
| Audit trail | PARTIAL | ✅ append-only audit_log |

---

**Verdict: READY TO BUILD — Big Data Foundation v1**
