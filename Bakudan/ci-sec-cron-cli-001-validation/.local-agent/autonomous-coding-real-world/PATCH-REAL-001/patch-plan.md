# Patch Plan — PATCH-REAL-001

## Project
- Name: dashboard.bakudanramen.com
- Canonical Path: E:\Project\Master\Bakudan\dashboard.bakudanramen.com
- Repository: https://github.com/liemdo28/dashboard.bakudanramen.com.git
- Branch: main
- Commit: ebc53db1c0b4a7ec8f114b703bad5e79b2110118
- Fingerprint: c729c64f415d62d7c560fbc46452cd65835946699131c19da691f80775ce832a

## Identifiers
- Workflow ID: WORKFLOW-REAL-DASHBOARD-001
- Task ID: TASK-REAL-DASHBOARD-001
- Patch ID: PATCH-REAL-001

## Selected Patch
- **Type**: Add QA-safe `data-testid` attribute for Playwright selector stability
- **Target File**: `apps/agency/apps/web/src/pages/DevPanel.jsx`
- **Target Element**: Dev Agent "Run" submit button
- **Change**: Add `data-testid="dev-agent-run-btn"` to the Run `<button>` element

## Reason Patch Is Safe
- UI/test attribute only — no logic change
- No database migration
- No credential or env change
- No production deployment
- No auth/payment/approval logic touched
- Only 1 source file changed
- Improves Playwright selector stability for the Dev Agent task creation flow

## Before State
```jsx
<button
  className="btn btn-primary"
  onClick={handleRun}
  disabled={running || !projectId}
>
  {running ? 'Running...' : 'Run'}
</button>
```

## After State
```jsx
<button
  className="btn btn-primary"
  onClick={handleRun}
  disabled={running || !projectId}
  data-testid="dev-agent-run-btn"
>
  {running ? 'Running...' : 'Run'}
</button>
```

## Stop Conditions Check
- [x] canonical source unambiguous — CONFIRMED
- [x] no .env touched — CONFIRMED
- [x] no credentials touched — CONFIRMED
- [x] no production deploy files touched — CONFIRMED
- [x] no migration files touched — CONFIRMED
- [x] no auth/payment/approval logic touched — CONFIRMED
- [x] no git push required — CONFIRMED
- [x] fewer than 3 files changed — CONFIRMED (1 file)
