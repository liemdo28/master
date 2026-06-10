# Mi Big Data Architecture

## Overview

```
CEO
 │
 ▼
Mi Chat (port 4001)
 │
 ├─── /api/bigdata/query    ──► CEO Query Service (rule + search)
 ├─── /api/bigdata/search   ──► Hybrid Search (PG keywords + Qdrant semantic)
 ├─── /api/bigdata/events   ──► Normalized Events (PostgreSQL)
 ├─── /api/bigdata/ingest/* ──► Ingestion Service
 └─── /api/bigdata/health   ──► Infrastructure Health
          │
          ▼
   ┌──────────────────────────────────────────────────────┐
   │              INGESTION LAYER                          │
   │  Secret Redactor → Object Store → Normalizer         │
   │                   ↓                    ↓             │
   │              Memory Indexer      Audit Service        │
   └──────────────────────────────────────────────────────┘
          │              │              │
          ▼              ▼              ▼
      MinIO          PostgreSQL       Qdrant
   (raw blobs)     (metadata +    (vector memory
   mi-raw/          events +        semantic
   mi-reports/      audit log)      search)
   mi-evidence/
```

## Data Flow

### Ingest JSON
```
POST /api/bigdata/ingest/json
 → Secret Redactor (redact credentials)
 → MinIO: store raw JSON as blob
 → PostgreSQL: insert raw_objects record (checksum, key, metadata)
 → Normalizer: extract normalized_events (sale, task, review, etc.)
 → Memory Indexer: chunk text → embed → Qdrant upsert + memory_chunks
 → Audit Log: record action
```

### Ingest File (CSV/PDF/Image)
```
POST /api/bigdata/ingest/file (multipart)
 → Blocked filename check (.env, *.pem, etc.)
 → MinIO: store raw file
 → PostgreSQL: insert raw_objects
 → Text extraction (CSV only at v1)
 → Memory Indexer (text/CSV only)
 → Audit Log
```

### Search
```
GET /api/bigdata/search?q=...
 → Parallel:
   │── PostgreSQL keyword search (normalized_events title/description)
   └── Qdrant semantic search (embed query → cosine similarity)
 → Merge + deduplicate by id
 → Sort by score
 → Return unified results
```

### CEO Query
```
GET /api/bigdata/query?q=...
 → Intent matching (regex patterns)
 → Rule-based SQL query (fast, specific)
 → Fallback: hybrid search
 → Return structured answer
```

## Storage Layers

### PostgreSQL (Structured)
- `data_sources` — source registry
- `ingestion_jobs` — job tracking
- `raw_objects` — blob metadata + checksums
- `normalized_events` — queryable business events
- `memory_chunks` — text chunk index with Qdrant pointers
- `data_quality_checks` — check history
- `audit_log` — append-only audit trail

### MinIO (Object Storage)
- `mi-raw/` — all raw ingested blobs (JSON, CSV, PDF, images)
- `mi-reports/` — generated quality reports, exports
- `mi-evidence/` — browser automation screenshots, dispute evidence

### Qdrant (Vector)
- Collection: `mi_bigdata` — 768-dim (nomic-embed-text)
- Payload: source_id, chunk_type, title, store_id, tags, text preview

## Security

- Secret redaction runs on ALL text content before storage
- Blocked filenames: .env, google-tokens.json, *.pem, id_rsa, credentials.json
- Health data requires explicit consent flag
- Audit log is append-only (no DELETE on audit_log)
- MinIO buckets are private (no public access)
- PostgreSQL password in .env only, never committed

## Connectors

| Connector | Source | Method |
|---|---|---|
| dashboard | dashboard.bakudanramen.com | HTTP API + local files |
| quickbooks | qb-agent.db + QB API | SQLite read + REST |
| review-automation | review-automation-system | Local file scan |
| browser-evidence | Browser automation sessions | File scan |
| manual-upload | Staff uploads | Multipart HTTP |
