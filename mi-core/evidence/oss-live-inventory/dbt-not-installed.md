# Evidence: dbt Not Installed

**Date:** 2026-06-28
**OSS:** dbt (data build tool)
**Expected Status:** `CONFIGURED_NOT_INSTALLED`

## Verification

`dbt --version` was not found in PATH.

## Business Role

- Data transformation
- SQL-based analytics pipelines

## Replacement

In-engine data transformation handles all current dbt use cases.
The CFO dashboard and financial analytics use DuckDB as the primary data engine.
dbt CLI is not required for current operations.

## Fallback Status

`FALLBACK_READY` - In-engine data transformation is active.
