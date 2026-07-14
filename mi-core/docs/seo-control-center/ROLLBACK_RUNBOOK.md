# SEO Control Center Rollback Runbook

Before production load:
1. Record current production Git SHA.
2. Record target PR or merge SHA.
3. Export PM2 process list.
4. Record listening ports and health endpoint responses.
5. Back up Mi-Core SQLite databases.
6. Back up environment configuration without printing secrets.
7. Back up Bakudan and Raw Sushi website roots.
8. Verify backup checksums.

Rollback restores:
- Previous code SHA.
- Previous database files.
- Previous PM2 ecosystem/config.
- Previous environment configuration.
- Previous website files.

Immediate rollback triggers:
- PM2 restart loop.
- Core Mi-Core routes fail.
- SEO auth bypass or Bearer enforcement failure.
- Migration error.
- Unexpected website file change.
- Unexpected GBP mutation.
- Scheduler write while read-only flags are false.

Approval finalization rollback:
- If an approval reaches `FINALIZATION_FAILED`, do not automatically retry.
- Inspect execution evidence, verify whether the side effect happened, and reconcile manually with CEO permission.
