# Environment Recovery Report — Phase 13.9 — 2026-06-17

## Production Environment

| Property       | Value |
|----------------|-------|
| DB_HOST        | mysql-taskflow.bakudanramen.com |
| DB_PORT        | 3306 |
| DB_NAME        | taskflow_db |
| DB_USER        | liemdo |
| DB_PASS        | configured (from .env) |
| DB_CHARSET     | utf8mb4 |
| Connection     | PASS (verified via verify_schema_api.php) |
| MySQL Version  | 8.0.41-0ubuntu0.24.04.1 |
| Total tables   | 96 |

## Preview Environment

| Property       | Value |
|----------------|-------|
| DB_HOST        | mysql-taskflow.bakudanramen.com |
| DB_PORT        | 3306 |
| DB_NAME        | preview_database |
| DB_USER        | liemdo |
| DB_PASS        | configured (from .env.preview) |
| DB_CHARSET     | utf8mb4 |
| Connection     | PASS (verified via ping.php endpoint response) |
| Note           | verify_schema_api.php not yet deployed to preview (separate deployment path) |

## Key Findings

1. Production DB connection is healthy — 96 tables exist
2. Preview DB connection is healthy (ping.php confirms DB access)
3. Both environments use the same MySQL host
4. Schema drift is the root cause — migrations exist but were never applied
5. .env file was missing locally — recreated for CLI verification
6. .env.preview is quarantined — needs restoration for preview operations

## VERDICT: PASS

Database connections are functional.
