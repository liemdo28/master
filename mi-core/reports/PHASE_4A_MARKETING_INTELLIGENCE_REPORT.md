# Phase 4A Marketing Intelligence Report

Status: `PARTIAL`

Runtime source:

- `server/src/marketing-intelligence`
- `tests/phase4a-marketing-intelligence-runtime-test.mjs`

Command:

```powershell
.\node_modules\.bin\tsc.cmd -p server\tsconfig.phase4a.json
node tests\phase4a-marketing-intelligence-runtime-test.mjs
```

Result:

```text
RESULTS: 17 passed, 0 failed
PHASE 4A MARKETING INTELLIGENCE: PARTIAL
FINAL_ALLOWED_STATUS: PARTIAL
```

Certified capabilities:

- Builds channel health from the existing brand connector registry.
- Generates scored marketing opportunities from local brand/content evidence.
- Generates campaign recommendations without launching blocked campaigns.
- Answers marketing opportunity and launch-readiness questions with warnings.
- Preserves `noFakeMetrics` and keeps the dashboard `PARTIAL` while blockers remain.

Observed source truth:

- Active brands: `bakudan`, `raw_sushi`.
- Ready/configured planning channels exist for crawler, GSC, GA4, and citation scan.
- GBP remains `missing_credentials` for active brands.
- Campaign recommendations are preparation-only and approval-gated.

Blockers:

- GBP credentials are missing for active brands.
- Campaign launch requires approval.
- Live publishing and live performance metrics are not certified.

Final allowed status:

```text
PARTIAL
```
