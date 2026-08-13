# Production F: Drive Runtime Hotfix — Runbook

Date: 2026-08-13

Branch: `codex/hotfix-production-f-drive-runtime` (separate from Phase 6F, which
remains on hold on PR #92 — not merged, not deployed by this hotfix).

## Incident

A D:→F: drive migration left every saved PM2 app definition pointing at
`D:\Project\Mi-core-system\Master\mi-core\...`, which no longer exists. All 8
apps in the production ecosystem were unable to resurrect after a reboot. See
the incident investigation report (session record) for the full read-only
root-cause audit: no OS-level auto-resurrect mechanism exists (no Windows
Service, no Scheduled Task), and the repository's own `ecosystem.config.js`
additionally contained hardcoded `E:/Project/Master/...` absolute paths for 3
apps (`mi-accounting`, `mi-ceo-observer`, `mi-whatsapp-gateway`), plus a
completely missing `qb-ops-agent` entry (present in the stale PM2 dump but
never added to the tracked ecosystem file).

## What this hotfix changes

`ecosystem.config.js`:

- `mi-accounting`, `mi-ceo-observer`, `mi-whatsapp-gateway`: `cwd` and every
  path-shaped `env`/`env_production`/`error_file`/`out_file` value now built
  from `__dirname` instead of a hardcoded `E:/Project/Master/...` prefix —
  matching the pattern `mi-core`, `mi-ai-service`, `mi-n8n`, and
  `mi-node-agent` already used. The file is now runnable unchanged from any
  checkout location.
- `qb-ops-agent`: added (was entirely absent). Entrypoint (`dist/index.js`) was
  independently verified by actually running `npm run build` in
  `services/qb-ops-agent` and confirming the file is produced — not assumed
  from `package.json` convention alone.

`server/src/__tests__/pm2-ecosystem-paths.test.ts` (new): asserts, for every
app in `ecosystem.config.js`: unique name, `cwd` exists, script/entrypoint
exists (after build), 0 stale `D:\`/`E:\` paths anywhere (source-text scan,
not just resolved-value scan), `mi-core` stays port 4001, `mi-ai-service`
stays port 4002 (embedded in its uvicorn `args`), `mi-core`/`mi-ai-service`
both have non-empty `env_production`.

## Known pre-existing gap (not fixed by this hotfix, out of scope)

`services/qb-ops-agent/src/soap/qbwc-server.ts` imports `express`, which is
**not declared** in `qb-ops-agent/package.json`'s dependencies. `tsc` still
emits `dist/soap/qbwc-server.js` (type errors don't block emission by
default), but requiring it at runtime would throw `Cannot find module
'express'`. This is **not** on the path required by `dist/index.js` (the main
heartbeat/workflow-polling entrypoint never `require`s the SOAP module), so
`qb-ops-agent` itself starts fine — but its QuickBooks Web Connector SOAP
listener does not. This exactly matches weeks of recurring
`[SelfHeal] ... QB Ops SOAP Port` down-alerts found in the historical
`mi-core-error.log` — a real, long-standing, pre-existing bug, unrelated to
the drive migration. Fixing it (declaring the `express` dependency, or
removing the dead SOAP code path) is a separate, focused change — not part of
this incident recovery, per the "no feature changes" boundary.

## How to run the regression test

```bash
cd server && npm run build
cd ../services/qb-ops-agent && npm ci && npm run build
cd ../.. && npx tsx server/src/__tests__/pm2-ecosystem-paths.test.ts
```

## Deployment note

This hotfix only changes `ecosystem.config.js` (a machine-local PM2
configuration file) and adds a regression test. `server/dist` application
code is unchanged in behavior — the same Phase 6E functional SHA
(`e766feb15dab24355ad84b63c8c4f3c7201a0f95`) remains the deployed application
logic. `MI_DEPLOYED_SOURCE_SHA` should be set to this hotfix's own merge SHA
only if/when the reviewed recovery deploy actually copies this hotfix's
reviewed source tree as the new deploy-owned snapshot (see the incident
recovery plan) — not because application behavior changed.
