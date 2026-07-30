# Cline Fix Task — TaskFlow Dashboard

**Generated:** 2026-06-05T09:30:20.050Z
**Project:** TaskFlow Dashboard
**Path:** `E:\Project\Master\Bakudan\dashboard.bakudanramen.com`
**Severity:** P1
**Evidence Dir:** `E:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\qa-artifacts\2026-06-05T09-30-20-025Z`

## 🚨 QA Failure Summary

### build
- **Command:** `npm run build`
- **Exit Code:** 1
- **Duration:** 0.5s
- **Errors:** 0

### test
- **Command:** `npm test`
- **Exit Code:** 1
- **Duration:** 0.4s
- **Errors:** 0

### lint
- **Command:** `npm run lint`
- **Exit Code:** 1
- **Duration:** 0.5s
- **Errors:** 0

### smoke
- **Command:** `npm run live:smoke`
- **Exit Code:** 1
- **Duration:** 0.3s
- **Errors:** 1

## 🔍 Detailed Errors

### unknown (1)
- **unknown**: Command failed: npm run live:smoke
npm error Missing script: "live:smoke"
npm error
npm error To see a list of scripts, run:
npm error   npm run
npm error A complete log of this run can be found in: C:\Users\liemdo\AppData\Local\npm-cache\_logs\2026-06-05T09_30_19_960Z-debug-0.log


## 📁 Evidence Artifacts

### Logs
- `E:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\qa-artifacts\2026-06-05T09-30-20-025Z\build-output.log`
- `E:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\qa-artifacts\2026-06-05T09-30-20-025Z\test-output.log`
- `E:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\qa-artifacts\2026-06-05T09-30-20-025Z\lint-output.log`
- `E:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\qa-artifacts\2026-06-05T09-30-20-025Z\smoke-output.log`

## 🔁 QA Commands to Rerun After Fix

```bash
cd "E:\Project\Master\Bakudan\dashboard.bakudanramen.com"
npm run build
```

```bash
cd "E:\Project\Master\Bakudan\dashboard.bakudanramen.com"
npm test
```

```bash
cd "E:\Project\Master\Bakudan\dashboard.bakudanramen.com"
npm run lint
```

```bash
cd "E:\Project\Master\Bakudan\dashboard.bakudanramen.com"
npm run live:smoke
```

## 📋 Required Context for Cline

Read these files before starting:

- Project brain: `E:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\brain\onboarding.md`
- Latest QA report: `E:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\reports\qa-report-2026-06-04T10-17-13-384Z.json`
- Evidence index: `E:\Project\Master\Bakudan\dashboard.bakudanramen.com\.local-agent\qa-artifacts\2026-06-05T09-30-20-025Z\evidence-index.json`

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
