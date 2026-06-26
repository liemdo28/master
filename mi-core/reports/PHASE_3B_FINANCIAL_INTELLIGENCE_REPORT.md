# Phase 3B Financial Intelligence Report

Final allowed status:

```text
PARTIAL
```

Runtime source:

- `server/src/financial-intelligence/source-health.ts`
- `server/src/financial-intelligence/revenue-engine.ts`
- `server/src/financial-intelligence/store-ranking.ts`
- `server/src/financial-intelligence/risk-engine.ts`
- `server/src/financial-intelligence/question-engine.ts`
- `tests/phase3b-financial-intelligence-runtime-test.mjs`

Command:

```powershell
.\node_modules\.bin\tsc.cmd -p server\tsconfig.phase3b.json
node tests\phase3b-financial-intelligence-runtime-test.mjs
```

Result:

```text
RESULTS: 22 passed, 0 failed
PHASE 3B FINANCIAL INTELLIGENCE: PARTIAL
FINAL_ALLOWED_STATUS: PARTIAL
```

Certified modules:

- Revenue Engine
- Store Ranking
- Source Health
- Risk Engine
- Question Engine

Observed source truth:

```text
QuickBooks Runtime: degraded
Certified: false
Last successful sync: 2026-06-14T15:04:32.890153+00:00
Risk: high
```

Truth boundary:

- Local governed ledger calculations work.
- Source-health/risk/question handling works.
- Live QuickBooks revenue is not claimed as fresh or certified.
- No mock live QB numbers were generated.
- No financial action was executed.

Reason status is not `OPERATIONAL`:

QuickBooks is degraded/not certified and the last successful sync is stale. Phase 3B can reason safely, but live financial truth is not green.
