# Mi Big Data — Roadmap

## v1 (This Build) — Foundation

- ✅ PostgreSQL (metadata, events, audit)
- ✅ MinIO (raw blobs, files, evidence)
- ✅ Qdrant (vector memory, semantic search)
- ✅ Secret redaction at all ingest points
- ✅ 5 connectors (dashboard, QB, review, browser, manual)
- ✅ 8 data quality checks
- ✅ CEO query service (7 patterns)
- ✅ Hybrid search (keyword + semantic)
- ✅ Full audit trail
- ✅ Docker-compose infra

## v2 — Live Connectors

- [ ] Google OAuth2 flow → Gmail + Drive + Calendar ingestion
- [ ] Asana token → real task sync
- [ ] QuickBooks Online API → live transaction pull
- [ ] DoorDash via browser automation (evidence + payouts)
- [ ] UberEats connector (new — not in v1)
- [ ] Yelp connector (new — not in v1)
- [ ] Scheduled ingestion (cron per source)
- [ ] Webhook endpoints for push sources

## v3 — Analytics Layer

- [ ] Apache Iceberg — table format for time-series data
- [ ] dbt Core — transformations, data models
- [ ] Superset or Metabase — CEO dashboard with real charts
- [ ] Revenue trend analysis (week-over-week, month-over-month)
- [ ] Staff performance metrics
- [ ] Store comparison dashboard

## v4 — AI Memory Integration

- [ ] Unified memory: bigdata Qdrant collection + existing mi_memory
- [ ] Auto-summarize daily events → memory snippets
- [ ] CEO query via natural language → Mi answers from bigdata
- [ ] Context injection: bigdata results → Mi chat pipeline

## v5 — Platform (Future)

- [ ] Dagster — orchestration, DAGs, backfills
- [ ] Trino — federated SQL across MinIO + PostgreSQL
- [ ] DataHub / OpenMetadata — data catalog, lineage
- [ ] Data contracts — schema enforcement per source
- [ ] Multi-location support (expand beyond 2 stores)

---

**Principle:** Don't build v2 until v1 is fully operational and ingesting real data.
