@echo off
REM Phase 8D — formalized boot-recovery entrypoint.
REM
REM Not wired into the actual Windows boot sequence by this repo. Today's
REM live registry Run key still points directly at pm2-windows-startup's own
REM pm2_resurrect.cmd (a third-party, non-git-tracked npm package). Pointing
REM it at this script instead is a deliberate, separate, manual production
REM step requiring its own explicit authorization — see
REM docs/architecture/PHASE8D_BOOT_RECOVERY_AUDIT.md and
REM docs/operations/PHASE8D_BOOT_RECOVERY_RUNBOOK.md.
REM
REM Runs the Phase 7A preflight validator first (advisory, logged, never
REM blocking), then always calls the same pm2 resurrect this machine already
REM performs today. See server/src/runtime-preflight/boot-cli.ts for the
REM implementation and server/src/__tests__/phase8d-boot-cli.test.ts for the
REM test proving resurrect always runs regardless of preflight outcome.

cd /d "%~dp0server"
npx tsx src\runtime-preflight\boot-cli.ts >> "%~dp0.local-agent-global\logs\boot-preflight-and-resurrect.log" 2>&1
