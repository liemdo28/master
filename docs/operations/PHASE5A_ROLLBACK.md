# Phase 5A Rollback

Rollback is limited to the deployed server build and PM2 process. Do not reset or clean the dirty live checkout during rollback.

## Immediate Rollback

1. Stop new acceptance activity.
2. Restore the previous backed-up `server/dist` from the timestamped `D:\mi-core-pm2-backups\phase5a-predeploy-*` folder.
3. Restart only the `mi-core` PM2 process with the previous deployed source SHA environment.
4. Verify `/api/health`, `/api/tools`, task-runtime health, project-registry health, and coding health.

## Data Handling

Phase 5A databases live outside source control. Do not delete them during a dist rollback unless the owner explicitly requests data removal.

If a migration issue is suspected, first run SQLite `integrity_check` and `foreign_key_check` against the Personal OS, Task Runtime, and Project Registry databases. Preserve database copies before any manual repair.

## Known Safe States

- Child tasks created by Phase 5A remain approval-gated at `WAITING_APPROVAL`.
- Goal activation does not execute child tasks.
- Daily brief records are read-side summaries and can remain in place after dist rollback.

## Escalation

Rollback is required if production acceptance shows route startup failure, uncaught runtime errors, database corruption, auth bypass, duplicate child tasks from repeated planning, or any automatic execution of child tasks or external actions.
