# MI_COMPANY_OS_BASELINE_ROLLBACK_RUNBOOK.md
> Mi Company OS — Rollback Runbook
> Baseline: `mi-company-os-runtime-certified-20260618` / commit `ae8ad26f`
> Date: 2026-06-18

---

## When to Use This Runbook

Use this runbook when a post-baseline change breaks the system and you need to restore Mi Company OS to the certified baseline state.

**Do NOT run rollback for:**
- Individual service restarts (use PM2 restart)
- Configuration changes (just revert the file)
- Database corruption (restore from SQLite backup)

**DO run rollback when:**
- Server fails to start after a code change
- Multiple services broken simultaneously
- Unknown breakage introduced after baseline freeze date

---

## Step 1 — Kill All Running Processes

```powershell
# Kill node processes on port 4001
Get-NetTCPConnection -LocalPort 4001 -State Listen | Select -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

# Kill all node processes (if needed)
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Stop PM2 daemon
pm2 kill
```

---

## Step 2 — Checkout Baseline Commit

```bash
cd E:/Project/Master

# Verify the tag exists
git tag -l | grep mi-company-os

# Checkout the baseline
git checkout mi-company-os-runtime-certified-20260618

# OR by commit hash directly:
git checkout ae8ad26f
```

> **Note:** This puts the repo in detached HEAD state. To return to development, run `git checkout feature/mi-core-big-data-foundation`

---

## Step 3 — Restore from Rollback ZIP (if git checkout not sufficient)

The rollback ZIP is at: `E:\Project\Exports\MI_COMPANY_OS_BASELINE_20260618\`  
Or compressed: `E:\Project\Exports\MI_COMPANY_OS_BASELINE_20260618.zip`

```powershell
# Extract to a clean directory
Expand-Archive -Path "E:\Project\Exports\MI_COMPANY_OS_BASELINE_20260618.zip" -DestinationPath "E:\Project\Rollback\mi-core-baseline"

# Compare with current server directory
Compare-Object (Get-ChildItem "E:\Project\Master\mi-core\server\src" -Recurse) `
              (Get-ChildItem "E:\Project\Rollback\mi-core-baseline\server\src" -Recurse)
```

---

## Step 4 — Recompile Server

```bash
cd E:/Project/Master/mi-core/server
npx tsc

# Verify zero errors
echo "TypeScript compile complete"
```

---

## Step 5 — Restore Runtime Databases (if corrupted)

The evidence DB and knowledge DB can be recreated from scratch:

```powershell
# Evidence DB — safe to delete (recreates on server start)
Remove-Item "E:\Project\Master\.local-agent-global\company-os\evidence.db" -Force
Remove-Item "E:\Project\Master\.local-agent-global\company-os\evidence.db-wal" -Force
Remove-Item "E:\Project\Master\.local-agent-global\company-os\evidence.db-shm" -Force

# Knowledge DB — only delete if confirmed corrupted
# Remove-Item "E:\Project\Master\.local-agent-global\knowledge-db\knowledge.db" -Force
```

---

## Step 6 — Start Server

```bash
cd E:/Project/Master/mi-core

# Start directly (reliable, not PM2-dependent)
node server/dist/index.js &

# Verify running
curl http://localhost:4001/api/company-os/health
```

Expected response:
```json
{
  "status": "ok",
  "departments": { "total": 20, "active": 11 },
  "brains": { "configured": 14 },
  "pipeline": "WORKING_DEPARTMENTS_READY"
}
```

---

## Step 7 — Verify Brains Online

```bash
curl http://localhost:4001/api/company-os/brains/verify
```

Expected: `{"all_online":true}` — if any brain is offline, Ollama may need restart:
```bash
# On Windows: restart Ollama from system tray or
# ollama serve &
```

---

## Step 8 — Run Smoke Test

```bash
cd E:/Project/Master/mi-core

# Write test payload
cat > /tmp/smoke_test.json << 'EOF'
{"text": "bao cao tong quan he thong"}
EOF

# Run smoke test command
curl -s -X POST http://localhost:4001/api/company-os/command \
     -H "Content-Type: application/json" \
     -d @/tmp/smoke_test.json | python -m json.tool
```

Expected: pipeline response with `qa_verdict: PASS`

---

## Step 9 — PM2 Restart (Production Only)

If PM2 is registered as a Windows service:
```bash
pm2 restart ecosystem.config.js
pm2 status
```

If PM2 daemon died (Git Bash issue):
```bash
pm2 resurrect
pm2 status
```

---

## Rollback Checklist

- [ ] All node processes on port 4001 killed
- [ ] PM2 daemon stopped
- [ ] Git checked out to `mi-company-os-runtime-certified-20260618`
- [ ] TypeScript compiled with zero errors
- [ ] Server started on port 4001
- [ ] `/api/company-os/health` returns `status: ok`
- [ ] `/api/company-os/brains/verify` returns `all_online: true`
- [ ] Smoke test pipeline returns `qa_verdict: PASS`
- [ ] PM2 restarted (if production)

---

## Known Issues After Rollback

| Issue | Workaround |
|-------|-----------|
| PM2 daemon dies in Git Bash | Run `node server/dist/index.js` directly |
| Port 4001 already in use | `Get-NetTCPConnection -LocalPort 4001 | Stop-Process -Force` |
| Ollama models not loaded | `ollama run qwen3:8b` to preload |
| WhatsApp Gateway not running | Start separately on port 3211 |

---

## Contact / Escalation

- CEO: Liem Do (Liem)
- System: Mi-Core Primary (Windows 11)
- Emergency: Check `mi-core/reports/` for all certification and fix documentation
