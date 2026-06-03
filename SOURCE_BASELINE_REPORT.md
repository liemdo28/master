# SOURCE BASELINE REPORT

Generated: 2026-06-01 20:02:34 +0700

## Scope

Canonical source baseline was run through Agent OS for:

- `Bakudan\bakudanramen.com-current`
- `Bakudan\dashboard.bakudanramen.com`
- `Bakudan\packing-list`
- `Bakudan\review-automation-system`
- `RawSushi\RawWebsite`
- `Agent\agent-coding`

## Final Result Summary

| Project | Audit | QA | Current status | Artifact |
|---|---|---|---|---|
| `Bakudan\bakudanramen.com-current` | completed | completed after fix | PASS | `qa-platform\artifacts\bakudanramen.com-current` |
| `Bakudan\dashboard.bakudanramen.com` | completed | completed | PASS | `qa-platform\artifacts\dashboard.bakudanramen.com` |
| `Bakudan\packing-list` | completed | completed | PASS | `qa-platform\artifacts\packing-list` |
| `Bakudan\review-automation-system` | completed | completed | PASS | `qa-platform\artifacts\review-automation-system` |
| `RawSushi\RawWebsite` | completed | completed | PASS | `qa-platform\artifacts\RawWebsite` |
| `Agent\agent-coding` | completed | completed after fix | PASS | `qa-platform\artifacts\agent-coding` |

## Source Fixes Applied

### `Agent\agent-coding`

Problem: root `npm test` pointed at missing files under `tests/` and missing support scripts.

Fix:

- Added `Agent\agent-coding\tests\source-baseline.test.js`.
- Updated root `package.json` test script to run the current source-baseline test.

Verification:

- Local `npm test`: PASS.
- Agent OS QA rerun task `4967fd7d-bace-4ae2-be48-9e163e02acb8`: completed.

### `Bakudan\bakudanramen.com-current`

Problem: `server/test.js` expected a running API server and inherited `PORT=5181`, which was occupied. The test output said `localhost:3000`, but runtime attempted the inherited port.

Fix:

- `server/test.js` now self-starts `server/server.js` if the API is not already running.
- Test port now defaults to `3000` unless `TEST_PORT` is explicitly set.
- The spawned test server is stopped after the smoke run.

Verification:

- Local `npm test`: 16 passed, 0 failed.
- Agent OS QA rerun task `14dc1250-9761-4d12-8dc3-8cdd09b81ab0`: completed.

## Operational Cleanup

- Cancelled broad root `Audit Master` tasks because they occupied the worker and were outside this source baseline scope.
- Denied `Deploy production` because no production deploy was requested.
- Cancelled an out-of-scope `Build dashboard` task.
- There are currently no pending or running tasks.

## Next Source Work

- Migrate `Other\LinkTreeHL` into Bakudan website ownership as a separate approved task after snapshot strategy is settled.
- Archive nested duplicate `Bakudan\packing-list\packing-list` only after an approved snapshot/rollback point.
- Implement `agent-os\KNOWLEDGE_GRAPH.md` and connect journal/artifact indexes to it.

## LinkTreeHL Migration Update

`Other\LinkTreeHL` has been copied into `Bakudan\bakudanramen.com-current\integrations\linktreehl-next` as a non-runtime source integration. See `LINKTREEHL_MIGRATION_REPORT.md`.
