# Cline Fix Task — TaskFlow Dashboard

**Generated:** 2026-06-07T15:05:53.919Z
**Project:** TaskFlow Dashboard
**Path:** `e:\Project\Master\Bakudan\dashboard.bakudanramen.com`
**Severity:** P1
**Evidence Dir:** `e:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\qa-artifacts\2026-06-07T15-05-53-765Z`

## 🚨 QA Failure Summary

### build
- **Command:** `npm run build`
- **Exit Code:** 1
- **Duration:** 0.2s
- **Errors:** 0

### test
- **Command:** `npm test`
- **Exit Code:** 1
- **Duration:** 0.2s
- **Errors:** 0

### lint
- **Command:** `npm run lint`
- **Exit Code:** 1
- **Duration:** 0.4s
- **Errors:** 0

### smoke
- **Command:** `npm run live:smoke`
- **Exit Code:** 1
- **Duration:** 0.2s
- **Errors:** 1

## 🔍 Detailed Errors

### unknown (1)
- **unknown**: Command failed: npm run live:smoke
npm error Missing script: "live:smoke"
npm error
npm error To see a list of scripts, run:
npm error   npm run
npm error A complete log of this run can be found in: C:\Users\liemdo\AppData\Local\npm-cache\_logs\2026-06-07T15_05_53_709Z-debug-0.log


## 📁 Evidence Artifacts

### Logs
- `e:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\qa-artifacts\2026-06-07T15-05-53-765Z\build-output.log`
- `e:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\qa-artifacts\2026-06-07T15-05-53-765Z\test-output.log`
- `e:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\qa-artifacts\2026-06-07T15-05-53-765Z\lint-output.log`
- `e:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\qa-artifacts\2026-06-07T15-05-53-765Z\smoke-output.log`

## 🔁 QA Commands to Rerun After Fix

```bash
cd "e:\Project\Master\Bakudan\dashboard.bakudanramen.com"
npm run build
```

```bash
cd "e:\Project\Master\Bakudan\dashboard.bakudanramen.com"
npm test
```

```bash
cd "e:\Project\Master\Bakudan\dashboard.bakudanramen.com"
npm run lint
```

```bash
cd "e:\Project\Master\Bakudan\dashboard.bakudanramen.com"
npm run live:smoke
```

## 📋 Required Context for Cline

Read these files before starting:

- Project brain: `e:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\brain\onboarding.md`
- Latest QA report: `e:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\reports\qa-report-2026-06-04T10-17-13-384Z.json`
- Evidence index: `e:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\qa-artifacts\2026-06-07T15-05-53-765Z\evidence-index.json`

## ⚠️ Safety Rules

1. **NO production deploy without CEO approval**
2. **NO force-click or UI workarounds** — fix root cause
3. **Propose patches first** — never auto-apply
4. **Each patch must include rollback instructions**
5. **All edits must be unit-test covered or flagged**
6. **Update closed-loop task ledger** at `.local-agent/closed-loop/tasks.jsonl`
7. **Re-run QA commands** after fix to verify

## 🛑 Stop Conditions

- Same P0/P1 failure occurs 3 times → escalate
- Secret detected in code → stop immediately
- Destructive command required → CEO approval
- Production write required → CEO approval
