# Phase 5 Data Foundation

## Canonical Storage
- PostgreSQL: metadata, normalized events, jobs, audits.
- MinIO: raw files, reports, browser evidence.
- Qdrant: vector search and semantic memory pointers.

## Findings
The canonical foundation exists under `infra/bigdata` and `server/src/bigdata`.

## Required Hardening
- Treat `.local-agent-global` data as cache or migration input only.
- Move QB SQLite activity into Postgres-backed normalized events.
- Block new hidden databases unless explicitly registered as connector caches.
