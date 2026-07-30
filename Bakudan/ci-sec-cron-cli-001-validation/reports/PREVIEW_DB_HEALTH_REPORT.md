# Preview DB Health Report

**Date:** 2026-06-02  
**URL:** `https://preview.dashboard.bakudanramen.com/`  
**Status:** BLOCKED  
**Symptom:** Preview shows `Service Unavailable / Database connection failed`.

## Result

Local health probe with `.env.preview`:

```json
{
  "status": "FAIL",
  "env": {
    "loaded_file": ".env.preview",
    "app_env": "staging",
    "app_url": "https://preview.dashboard.bakudanramen.com"
  },
  "database": {
    "host": "preview-db",
    "port": 3306,
    "name": "bakudan_preview",
    "uses_preview_db": true,
    "uses_production_db": false
  },
  "db_connection": "FAIL: getaddrinfo for preview-db failed"
}
```

## Interpretation

`.env.preview` is loaded and points to the correct preview database name:

```text
DB_NAME=bakudan_preview
```

It does **not** point to production:

```text
DB_NAME != taskflow_db
```

The current blocker is DB host reachability:

```text
DB_HOST=preview-db
```

`preview-db` is valid only inside the Docker Compose network. If `preview.dashboard.bakudanramen.com` is running on DreamHost/shared hosting instead of inside the Compose network, that hostname will not resolve and the app will show `Database connection failed`.

## Fixes Added

- `preview_db_health.php`
  - Token-protected web health probe.
  - CLI-safe for deploy scripts.
  - Shows env file, APP_ENV, DB host/name/port, production DB guard, connection status, and key table status without exposing passwords.

- `config/database.php`
  - Keeps `.env.preview` loading for preview/draft/staging hosts.
  - Process env now wins over file env, so server-injected preview DB settings are not overwritten by stale `.env.preview`.

- `scripts/staging_deploy.sh`
  - Now verifies `.env.preview`, not `.env`.
  - Requires `DB_NAME=bakudan_preview`.
  - Runs preview health before migrations/seed.

- `scripts/db-safety-check.php`
  - Supports `APP_ENV_FILE` and preview env loading.

## Required Production/Preview Action

Run:

```bash
APP_ENV_FILE=/home/liemdo0208/preview.dashboard.bakudanramen.com/.env.preview php preview_db_health.php
```

If preview is Docker-based:

```bash
docker compose -f docker-compose.preview.yml ps
docker compose -f docker-compose.preview.yml up -d preview-db preview-web
```

If preview is shared-host based:

```text
DB_HOST must be changed from preview-db to a real reachable MySQL host.
DB_NAME must remain bakudan_preview.
```

## Gate

Do not deploy production until:

- Preview DB connection: PASS
- `DB_NAME=bakudan_preview`: PASS
- `uses_production_db=false`: PASS
- `/login`: PASS
- `/tasks/19737`: PASS
