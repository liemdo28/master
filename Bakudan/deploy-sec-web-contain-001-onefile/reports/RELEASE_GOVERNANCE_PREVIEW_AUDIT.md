# Release Governance Preview Audit

**Date:** 2026-06-02  
**Status:** BLOCKED  
**Reason:** Preview DB unavailable, so schema verification cannot run against preview yet.

## Tables To Verify

| Table | Purpose |
|-------|---------|
| `releases` | Base release records |
| `release_reviews` | Review/comments/approval trail |
| `release_audit_log` | Release audit history |
| `release_drafts` | Draft metadata |
| `release_versions` | Version snapshots |
| `release_approvals` | Approval records |
| `release_schedule` | Scheduled production publish jobs |
| `release_archive` | Archive and retention |
| `rollback_points` | Rollback markers |

## Verification Script

Added:

```bash
php scripts/release-governance-schema-audit.php
```

Run against preview:

```bash
APP_ENV_FILE=/path/to/.env.preview php scripts/release-governance-schema-audit.php
```

## Migration Source

```text
database/migrations/2026_06_02_release_governance.sql
```

## Gate

Release governance cannot be approved until:

- Preview DB health: PASS
- Release governance schema audit: PASS
- No production DB is used by preview
- QA can open `/admin/releases` on preview
