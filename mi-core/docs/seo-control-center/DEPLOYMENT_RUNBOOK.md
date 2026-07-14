# SEO Control Center Deployment Runbook

Status: PR-only. No production deployment has been performed from this branch.

Prerequisites:
- PR checks pass on the exact head SHA.
- GitGuardian incidents are resolved or formally dismissed.
- `npm audit --audit-level=high` passes or every high advisory has an accepted exception.
- Google read connectors are either verified or explicitly separated as post-merge credential work.
- Backup and rollback steps in `ROLLBACK_RUNBOOK.md` are completed.

Read-only environment:
- `SEO_CONTROL_CENTER_MODE=read_only`
- `SEO_AUTOMATION_ENABLED=false`
- `SEO_PRODUCTION_PUBLISH_ENABLED=false`
- `SEO_GBP_WRITE_ENABLED=false`
- `SEO_WEBSITE_WRITE_ENABLED=false`
- `SEO_BACKLINK_WRITE_ENABLED=false`
- `GOOGLE_CONNECTOR_WRITE_ENABLED=false`
- `MI_AUTH_DEFAULT_USER` must reference a server-side user in `MI_AUTH_USER_MAP_JSON`.

Load sequence after merge:
1. Pull the exact merged SHA into the production Mi-Core checkout.
2. Install dependencies with `npm ci` from `mi-core/server`.
3. Run `npx tsc --noEmit`.
4. Run migrations through normal Mi-Core startup or the migration runner.
5. Verify all SEO write flags are false.
6. Restart only the canonical Mi-Core PM2 process.
7. Verify health, auth, Bearer-only SEO routes, dashboard load, migration state, and connector status.

Do not deploy websites, publish articles, publish GBP posts, or enable write flags during read-only load.
