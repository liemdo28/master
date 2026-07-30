# Mi Big Data Infrastructure

## Services

| Service | Port | Purpose |
|---|---|---|
| PostgreSQL | 5432 | Metadata, jobs, audit, normalized events |
| MinIO | 9000 / 9001 | Object storage (raw files, CSV, PDFs, screenshots) |
| Qdrant | 6333 | Vector memory, semantic search, RAG |

## Setup

```bash
# 1. Copy env file
cp .env.example .env
# Edit .env — change all passwords

# 2. Start all services
docker-compose up -d

# 3. Verify health
docker-compose ps
```

## First-time MinIO bucket setup

After `docker-compose up`:

```bash
# Install mc (minio client) if needed
# Or use the MinIO console at http://localhost:9001

# Create required buckets
docker exec mi-minio mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
docker exec mi-minio mc mb local/mi-raw
docker exec mi-minio mc mb local/mi-reports
docker exec mi-minio mc mb local/mi-evidence
```

## Data persistence

All data is stored in named Docker volumes:
- `postgres_data` — PostgreSQL tables
- `minio_data` — Object storage blobs
- `qdrant_data` — Vector index

## Stop / Reset

```bash
# Stop (keep data)
docker-compose stop

# Remove containers (keep volumes)
docker-compose down

# Full reset (DESTROYS ALL DATA)
docker-compose down -v
```

## npm scripts (from mi-core/server/)

```bash
npm run bigdata:up       # Start infrastructure
npm run bigdata:health   # Check all service health
npm run bigdata:sample   # Ingest sample data
npm run bigdata:quality  # Run data quality checks
npm run bigdata:search -- "query"  # Search data
```
