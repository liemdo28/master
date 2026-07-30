# CLINE BRIDGE — Dashboard.bakudanramen.com
**Cline action bridge for engineering commands on Dashboard.**

---

## 1. Available Actions

| # | Action | Command | What it does | Log result |
|---|--------|---------|-------------|------------|
| 1 | **Audit Dashboard** | `Audit Dashboard` | Runs `preview_db_health.php`, `validate_preview_workflow.php`, `repair_preview.php` — prints health summary | YES |
| 2 | **Run QA** | `Run QA` | `npm run qa` — runs all Playwright tests | YES |
| 3 | **Git Status** | `Git Status` | `git status && git log -5 --oneline` — prints branch + recent commits | YES |
| 4 | **Scan Errors** | `Scan Errors` | `tail logs/errors/php-errors.log` — prints last 50 PHP errors | YES |
| 5 | **Show PHP Errors** | `Show PHP Errors` | Reads `logs/errors/php-errors.log`, groups by type, shows stack traces | YES |
| 6 | **Show Build Errors** | `Show Build Errors` | `powershell -File scripts/php-lint.ps1` — shows PHP lint failures | YES |
| 7 | **Show Latest Deploy** | `Show Latest Deploy` | `curl /deploy_preview.php?key=preview-deploy-2026` — shows deploy log | YES |
| 8 | **Run Playwright** | `Run Playwright` | `npm run qa` — runs Playwright suite | YES |
| 9 | **Open Cline Task** | `Open Cline Task` | Opens this repo in VS Code (`code .`) | YES |
| 10 | **Generate Dev Prompt** | `Generate Dev Prompt` | Prints active git state, PHP errors, QA status, deployment status | YES |

---

## 2. Action Log

**File:** `docs/AGENT_OS/CLINE_ACTION_LOG.json`

*New entries appended by this bridge. All fields required.*

```json
{
  "timestamp": "ISO 8601 datetime",
  "action": "Action name",
  "result": "pass|fail|warn",
  "duration_ms": 1234,
  "evidence": ["line1", "line2"]
}
```

---

## 3. Implementation

### Audit Dashboard
```bash
curl -s "https://preview.dashboard.bakudanramen.com/preview_db_health.php?token=PREVIEW_HEALTH_2026"
curl -s "https://preview.dashboard.bakudanramen.com/validate_preview_workflow.php"
```

### Run QA
```bash
cd E:\Project\Master\Bakudan\dashboard.bakudanramen.com
npm run qa
```

### Show PHP Errors
```bash
type logs\errors\php-errors.log 2>nul | more +0
```

### Scan Errors
```bash
powershell -Command "Get-Content logs\errors\php-errors.log -Tail 50"
```

### Show Latest Deploy
```bash
curl -s "https://preview.dashboard.bakudanramen.com/deploy_preview.php?key=preview-deploy-2026"
```

---

## 4. CLINE_ACTION_LOG.json Schema

```json
[
  {
    "id": "uuid",
    "timestamp": "2026-06-04T16:15:00+07:00",
    "action": "Audit Dashboard",
    "result": "pass",
    "duration_ms": 2341,
    "agent_version": "claude-opus-4.6",
    "commit_hash": "391be7d",
    "preview_health": "DEPLOY_OK",
    "qa_passed": 13,
    "qa_failed": 0,
    "evidence": ["preview_db_health: DEPLOY_OK", "validate_preview: PASS"]
  }
]
```

---

## 5. Quick Answers

> **"Run QA on Dashboard"**
> `npm run qa` in `E:\Project\Master\Bakudan\dashboard.bakudanramen.com`
> Or via Cline: `Run QA` action → logs to `CLINE_ACTION_LOG.json`

> **"Show Latest Deploy"**
> `curl /deploy_preview.php?key=preview-deploy-2026`
> Last deploy: `391be7d` (fix: route workflow command center)

> **"Audit Dashboard"**
> Run both:
> - `preview_db_health.php?token=PREVIEW_HEALTH_2026` → DEPLOY_OK
> - `validate_preview_workflow.php` → PASS