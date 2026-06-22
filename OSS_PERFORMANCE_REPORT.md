# OSS Wave A Performance Report

Generated: 2026-06-14

Status: `OSS_WAVE_A_CERTIFIED`

## Summary

Wave A uses bounded adapters and cache reuse. No long-running OSS service, duplicate database, or background graph engine was introduced.

## Measurements

| Metric | Result | Notes |
| --- | ---: | --- |
| Codegraph cold sync | 28,881 ms | Forced scan of 350 source files with TypeScript AST parsing |
| Codegraph cached sync | 0 ms | Fresh cache reused from `.local-agent-global/graph/codegraph-summary.json` |
| Dashboard impact query latency | 8 ms | `getDashboardImpactFiles(20)` after cache warm |
| OpenHuman sync time | 3 ms | Reads existing verified health cache |
| Enterprise Brain module load | 1,122 ms | `require('./server/dist/enterprise-v6/enterprise-brain-v4.js')` |
| Memory RSS delta | 27.8 MB | One-shot adapter process delta |
| Heap used after adapter query | 22 MB | Node process heap after codegraph + OpenHuman calls |

## Codegraph Output

`CODEGRAPH_READY`

Current bounded scan:

- repositories: 1
- files: 350
- classes: 80
- functions: 2,054
- APIs: 119
- dependencies: 345

Cache:

- `E:/Project/Master/mi-core/.local-agent-global/graph/codegraph-summary.json`

Performance controls:

- `CODEGRAPH_MAX_FILES`, default `350`
- `CODEGRAPH_CACHE_TTL_MS`, default `600000`
- `CODEGRAPH_FORCE_SYNC=1` for deliberate cold rescan

## OpenHuman Output

`OPENHUMAN_READY`

Current normalized source:

- `E:/Project/Master/.local-agent-global/visibility/health/data.json`

Mapped values:

- sleep average: 7.1h
- average HRV: 41.7 ms
- average steps: 8,721
- workouts: 3
- recovery signal: `LOW`

Cache:

- `E:/Project/Master/.local-agent-global/visibility/health/openhuman-normalized.json`

## Regression Verification

Commands run:

- `npm --workspace server run build`
- `node tests/phase14-acceptance-test.mjs`

Results:

- TypeScript build: pass
- Phase 14 graph acceptance: 15/15 pass

## Performance Decision

Pass.

The only expensive operation is a deliberate cold codegraph scan. Normal Enterprise Brain query paths use the cache and stay sub-second for the measured Wave A questions. OpenHuman is effectively a lightweight normalization pass over existing Health Intelligence data.
