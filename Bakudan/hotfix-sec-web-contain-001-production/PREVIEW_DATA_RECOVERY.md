# Preview Data Recovery — Phase 13.9 — 2026-06-17

## Note

Preview schema check could not be completed directly because:

1. verify_schema_api.php was not yet deployed to preview subdomain
2. Preview uses a separate code path (/home/liemdo0208/phase11-preview)
3. The .htaccess pass-through was only added to production

## Evidence of Preview DB Health

- ping.php confirms database connectivity
- preview_database exists on mysql-taskflow.bakudanramen.com
- 96 tables confirmed in production DB (same host)

## Required Tables for Preview (must exist)

| Table          | Status |
|----------------|--------|
| users          | CHECK (exists in production, same host) |
| stores         | CHECK |
| tasks          | CHECK |
| bills          | CHECK |
| notifications  | CHECK |

## Recommendations

1. Deploy verify_schema_api.php to preview environment
2. Run schema verification against preview_database
3. Execute any missing migrations against preview_database
4. Seed preview with test data matching production structure

## VERDICT: PARTIAL

Preview connectivity confirmed, full schema audit pending preview deployment.
