# Mi Big Data — Setup Guide

## Prerequisites

- Docker Desktop running
- Node.js 20+
- Mi-Core server dependencies installed (`npm install` from mi-core root)

## Step 1 — Start Infrastructure

```bash
cd mi-core/infra/bigdata
cp .env.example .env
# Edit .env: change POSTGRES_PASSWORD and MINIO_ROOT_PASSWORD to strong values
docker-compose up -d
```

Expected output:
```
✅ mi-postgres    — healthy
✅ mi-minio       — healthy
✅ mi-qdrant      — healthy
```

## Step 2 — Create MinIO Buckets

```bash
docker exec mi-minio mc alias set local http://localhost:9000 mi_minio YOUR_PASSWORD
docker exec mi-minio mc mb local/mi-raw
docker exec mi-minio mc mb local/mi-reports
docker exec mi-minio mc mb local/mi-evidence
```

Or: open MinIO Console at http://localhost:9001 and create buckets manually.

## Step 3 — Configure Mi-Core .env

Add to `mi-core/server/.env`:
```
POSTGRES_HOST=localhost
POSTGRES_DB=mi_bigdata
POSTGRES_USER=mi_user
POSTGRES_PASSWORD=your_strong_password

MINIO_ENDPOINT=http://localhost:9000
MINIO_ROOT_USER=mi_minio
MINIO_ROOT_PASSWORD=your_strong_password

QDRANT_URL=http://localhost:6333

BIGDATA_ENABLED=true
```

## Step 4 — Start Mi-Core Server

The server auto-initializes MinIO buckets on startup:
```bash
cd mi-core/server && npm run dev
```

Look for:
```
[Mi] ✓ Big Data Foundation initialized
```

## Step 5 — Verify Health

```bash
npm run bigdata:health
# or
curl http://localhost:4001/api/bigdata/health
```

Expected:
```json
{"postgres":"ok","minio":"ok","qdrant":"ok","overall":"ok"}
```

## Step 6 — Ingest Sample Data

```bash
npm run bigdata:sample
```

## Step 7 — Run Quality Checks

```bash
npm run bigdata:quality
```

## Step 8 — Run Tests

```bash
npm run bigdata:test
```

## Troubleshooting

**PostgreSQL won't start:**
- Check: `docker logs mi-postgres`
- Common cause: port 5432 already in use — change `POSTGRES_PORT` in .env

**MinIO won't start:**
- Check: `docker logs mi-minio`
- Common cause: port 9000 in use

**npm run bigdata:health shows "down":**
- Ensure docker-compose is running: `docker-compose ps`
- Check POSTGRES_PASSWORD matches between docker-compose .env and server .env

**"Cannot find module 'pg'":**
- Run from mi-core root: `npm install pg @aws-sdk/client-s3 multer`
