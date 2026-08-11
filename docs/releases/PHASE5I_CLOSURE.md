# Phase 5I Release Closure

Date: 2026-08-11

Functional deployed SHA: `ff51bcab13cf6dfca7d1a6259046b35b282d08dc`

PR: `#75` (`codex/phase5i-delegated-authority` -> `master`)

## Status

Phase 5I is closed as deployed.

Delegated Authority is present only as a bounded approval substitute over existing Phase 5F Controlled Actions. It does not introduce Gmail send, new external action types, financial actions, merge/deploy authority, shell/browser authority, voice authority, desktop control, or new OAuth scopes.

## Merge Evidence

- Local branch head before PR: `2b5692f1df1319ea6ffe9e64131b044824202bce`
- Phase 5H baseline before PR: `206ca71279574574d70b7708ea4eaaec652cd5ac`
- PR merge commit: `ff51bcab13cf6dfca7d1a6259046b35b282d08dc`
- CI on PR #75:
  - Repository scans: PASS
  - Server build and tests: PASS
  - GitGuardian Security Checks: PASS
  - External integration tests: SKIPPED by environment

## Final Master Gates

Fresh detached checkout at `ff51bcab13cf6dfca7d1a6259046b35b282d08dc`:

- `npm ci`, `npm --prefix server ci`, `npm --prefix command-center ci`: PASS
- `npm run build`: PASS
- `npm run test:ci`: PASS
- `npm --prefix server run phase5i:acceptance`: PASS
  - Security: PASS
  - Migration v9 -> v10: PASS
  - Restart: PASS
  - Concurrency: PASS
  - 200-scenario evaluator: 200/200, all bypass metrics zero
- `npm --prefix command-center run test:command-center`: PASS, 15/15
- `npm --prefix command-center run test:command-center-security`: PASS, 19/19
- `npm --prefix command-center run test:command-center-e2e`: PASS, 4/4, zero new fixture roots

## Production Deployment

Production source marker after deployment:

- `MI_DEPLOYED_SOURCE_SHA=ff51bcab13cf6dfca7d1a6259046b35b282d08dc`
- `MI_DEPLOYED_SOURCE_ROOT=D:\Project\Mi-core-system\Master\mi-core`

Deployment used the reviewed built artifacts from the fresh master checkout:

- `server/dist`
- `command-center/dist`

The production checkout itself was not used as source because it contains unrelated concurrent work.

Predeploy backup:

- `D:\mi-core-production-backups\phase5i-predeploy-20260811-125122`
- Backed up production `server/dist`, `command-center/dist`, and the Personal OS, Task Runtime, and Project Registry SQLite databases
- Backup DB integrity: all three copied databases returned `integrity_check=ok` and zero FK violations

## Production Migration

Before migration:

- Personal OS schema version: v9
- `PRAGMA integrity_check`: `ok`
- FK violations: `0`

Migration trigger:

- Production app route `GET /api/delegations` returned 200 with `{"delegations":[]}`

After migration:

- Personal OS schema version: v10
- Phase 5I migration rows: `1`
- `PRAGMA integrity_check`: `ok`
- FK violations: `0`
- Existing row preservation confirmed for goals, action proposals, action plans, and policy set rows

## Production-Safe Acceptance

Final production-safe acceptance project: `phase5i-prod-final-20260811055554`

Evidence IDs:

- Delegation: `delegation-2528c0bf-5657-4758-a66d-03b4b1b66813`
- Allowed proposal: `action-656d281c-0c41-4076-b419-0e3cebba0273`
- Wrong-target proposal: `action-c98053ae-7f6d-41e6-baad-88cb5961a941`
- Expired delegation: `delegation-e5612fb0-bc51-4e38-84e6-5b37f1688b9e`

Checks:

- Create -> submit -> human strong approve: PASS
- Wrong target denied with reason `recipient domain(s) not in allowedDomains: not-example.test`: PASS
- Delegated authorization without execution: PASS
- Approved proposal cancelled after proof: PASS
- Gmail SEND delegation rejected: PASS
- Expiry sweep: PASS
- Revoke: PASS
- Final accepted proposal execution count: `0`
- Final accepted proposal status: `CANCELLED`
- Final delegation status: `REVOKED`

One earlier exploratory production-safe probe completed a fixture-mode controlled action row while proving orchestration wiring:

- Proposal: `action-e487234b-ec01-4a12-8ff3-3c6784423f8c`
- Execution provider mode: `fixture`
- No live provider execution was recorded

## Runtime Health

After deployment and restart persistence check:

- `mi-core`: online under PM2
- `/api/health`: 200
- `/command-center/`: 200 and serves the app root
- Production Personal OS DB remained v10 with `integrity_check=ok` and zero FK violations

## External Sandbox

External sandbox acceptance remains `BLOCKED_EXTERNAL_ENVIRONMENT`. This closure does not claim live Gmail or Google Calendar sandbox writes passed.
