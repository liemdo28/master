# Phase 6A Release Closure

Date: 2026-08-11

PR: `#78` (`codex/phase6a-canonical-control-plane` -> `master`)

Reviewed PR head: `440884e676cd0060d1b58104ea9075dd50b9a0c5`

Merge commit / deployed runtime SHA: `1979a432717064c189afc761a25263d71feaba18`

## Result

Phase 6A is closed as deployed.

The Authority Control Plane is present as an inventory, classifier, startup assertion,
read-only API, and Command Center view. It does not add new external-action authority.

## Marker Convention

The canonical production marker names are:

- `MI_DEPLOYED_SOURCE_SHA`
- `MI_DEPLOYED_SOURCE_ROOT`

No `DEPLOYED_SOURCE_SHA` or `DEPLOYED_SOURCE_ROOT` alias is used by runtime code.

Production was updated to:

- `MI_DEPLOYED_SOURCE_SHA=1979a432717064c189afc761a25263d71feaba18`
- `MI_DEPLOYED_SOURCE_ROOT=D:\Project\Mi-core-system\Master\mi-core`

## Backup

Pre-deploy backup:

- `D:\mi-core-production-backups\phase6a-predeploy-20260811-144542`

Backup contents include:

- root `.env`
- PM2 process JSON
- pre-deploy `server/dist`
- pre-deploy `command-center/dist`
- 16 SQLite online backups under `.local-agent-global`
- pre-Phase-6A production `server/src` preserved under `source/server-src`
- pre-Phase-6A production `server/package.json`

All 16 SQLite backup copies passed `integrity_check`.

## Source Tree Reconciliation

The production checkout contained unrelated local source files before deployment. The
first Phase 6A restart correctly refused to start because the Authority Control Plane
startup assertion detected unregistered mutating source surfaces in that dirty
production `server/src`.

To preserve the assertion and deploy the reviewed source, the old production
`server/src` was moved into the Phase 6A backup and replaced with the reviewed master
`server/src` from `1979a432717064c189afc761a25263d71feaba18`. The deployed `server/dist`,
`server/authority-manifest.json`, `server/package.json`, and `command-center/dist` are
from the same reviewed merge commit.

## Gates

Pre-merge gates on PR head `440884e676cd0060d1b58104ea9075dd50b9a0c5`:

- GitHub CI: server build/tests PASS; repository scans PASS; GitGuardian PASS
- `npm ci`: root, server, command-center PASS
- `npm run build`: PASS
- server no-emit type check: PASS
- Command Center no-emit type check: PASS
- `npm run test:ci`: PASS
- Phase 5 acceptance: 5A PASS, 5B PASS, 5C PASS 29/29 fixture, 5D2 PASS 14/14, 5D3 PASS 30/30, 5F PASS, 5G PASS, 5H PASS, 5I PASS
- Agentic Coding acceptance: PASS 5/5 fixtures
- Command Center tests: screen PASS 16/16, security PASS 19/19, E2E PASS 4/4
- Phase 6A tests: authority-control-plane PASS, security PASS, manifest check PASS, acceptance PASS, 200-case evaluation PASS

Post-merge gates on `1979a432717064c189afc761a25263d71feaba18`:

- `npm ci`: root, server, command-center PASS
- `npm run build`: PASS
- `npm run test:ci`: PASS
- `npm run phase6a:acceptance`: PASS
- `npm --prefix server run authority:manifest:check`: PASS after Windows line-ending/stat normalization

## Production Acceptance

Production restart:

- Restarted only `mi-core`
- `mi-ai-service` remained online and was not restarted
- Final `mi-core` status: online

Live checks:

- `/api/health`: HTTP 200, server `ok`, Python AI service `ok`, Ollama `ok`
- `/api/tools` unauthenticated: HTTP 401
- `/api/tools` authenticated: HTTP 200
- `/api/authority/status` unauthenticated: HTTP 401
- `/api/authority/status` authenticated: HTTP 200
- `/api/authority/manifest` authenticated: HTTP 200
- `/command-center/authority`: HTTP 200
- Live database integrity: 16 databases checked, 0 bad, 0 foreign-key violations

Live Authority Control Plane counts:

- total surfaces: `1023`
- mutations: `394`
- quarantined: `155`
- unknown mutations: `0`
- `/api/browser/write`: `LEGACY_QUARANTINED`
- `/api/voice/output/send`: `LEGACY_QUARANTINED`

Startup log confirmed:

- `Authority Control Plane validated (1023 surfaces, 394 mutations, 67ms)`
- `Mi-Core Central Command - ONLINE`

Expected environment warnings remain:

- WhatsApp approval channel not configured
- Review callback token not configured
- MinIO not available
- Google Sheets not configured

## Frozen Boundary

Phase 5 remains frozen. Phase 6A did not add:

- Gmail send
- financial action execution
- autonomous merge/deploy
- shell authority
- desktop-control authority
- voice output expansion
- broad browser-control authority
- new OAuth scopes
- schema migrations

Legacy authority surfaces are classified, adapted, or quarantined. Phase 6B is not
started by this closure.
