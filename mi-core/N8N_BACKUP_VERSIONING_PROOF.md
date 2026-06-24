# N8N BACKUP & VERSIONING PROOF — Phase 27F
**Date:** 2026-06-24

## Backup Scripts Created

| Script | Purpose |
|--------|---------|
| `backup-n8n-workflows.bat` | Export all workflows + credential metadata |
| `verify-n8n-backup.bat` | Verify latest backup integrity |
| `restore-n8n-workflows.bat` | Restore guide (n8n v2.27 requires UI import) |

## First Backup — Executed 2026-06-24

```
Directory: E:\Project\Master\mi-core\backups\n8n\2026-06-24T000000\

workflows.json          23,631 bytes  (9 workflows)
credentials-metadata.json  23 bytes  (no credentials configured)
```

**9 workflows backed up:**
- seo-schema-validation
- seo-review-summary
- seo-content-opportunity-scan
- seo-dashboard-sync
- seo-daily-audit
- seo-technical-health-check
- seo-weekly-executive-report
- mi-failure-alert-handler
- mi-sandbox-failure-test

## Security Note

`credentials-metadata.json` contains names and types only — **no secrets exported**.  
n8n credential values are encrypted at rest and not accessible via API export.

## Versioning

Each backup is timestamped directory: `backups/n8n/YYYY-MM-DDTHHMMSS/`

Recommended: run `backup-n8n-workflows.bat` weekly via Windows Task Scheduler.

## Restore Limitation

n8n v2.27 Public API does not support workflow import (`POST /api/v1/workflows/import` not available). Restore requires:
1. Open http://localhost:5678
2. Workflows → Import from file → select `workflows.json`

## Final Status: `BACKUP_OPERATIONAL`
