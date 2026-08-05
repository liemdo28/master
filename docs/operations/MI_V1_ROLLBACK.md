# Mi V1 Rollback

Rollback restores the previous production `server\dist` without changing GitHub master or the dirty live checkout.

## When To Roll Back

Roll back if production verification fails after a deployment:

- `/api/health` fails.
- `/api/tools` fails.
- `mi-core` cannot stay online.
- Task runtime cannot create or recover harmless tasks.
- Project Registry cannot produce a fresh Mi Core map.
- Coding protected endpoints fail unexpectedly.
- Logs show uncaught startup errors tied to the new deployment.

## Backup Location

Backups live under:

`D:\mi-core-pm2-backups`

The v1 predeploy backup used for this release:

`D:\mi-core-pm2-backups\v1-predeploy-20260805-095014`

## Restore Procedure

1. Confirm the backup path is inside `D:\mi-core-pm2-backups`.
2. Confirm the live target is `D:\Project\Mi-core-system\Master\mi-core\server\dist`.
3. Copy the backup `dist` contents back into the live `dist`.
4. Restart only `mi-core`.
5. Verify `/api/health` and `/api/tools`.
6. Preserve logs and command output for the failed gate.

Do not run `git reset --hard`, `git clean`, destructive branch switching, or broad PM2 restarts as part of rollback.

## After Rollback

Do not revert GitHub master automatically. Open a focused follow-up PR only after the failed production gate has a reproduced cause and a targeted fix.
