# Phase 12.4 Environment Audit

Generated: 2026-05-31 15:40 Asia/Ho_Chi_Minh

Evidence:
- `reports/phase12_4/logs/server_audit_20260531_152101.txt`
- `reports/phase12_4/screenshots/preview/anonymous_overview.png`
- `reports/phase12_4/logs/browser_preview_sidebar_retest_2026-05-31T08-27-09-617Z.json`

## Database Separation

| Environment | DB Host | DB Name | MySQL Backend |
|---|---|---|---|
| Production | mysql-taskflow.bakudanramen.com | taskflow_db | pdx1-mysql-a7-2b |
| Preview | mysql.bakudanramen.com | preview_database | pdx1-mysql-a7-2b |

Status: PASS. Database names are different.

## Preview Security

| Check | Expected | Result |
|---|---|---|
| Anonymous `/overview` | Redirect login | PASS |
| CEO/Admin login | Access granted | PASS |
| Manager login | Access granted | PASS |
| Member login | Access granted | PASS |

Finding fixed: `PREVIEW_QA_BYPASS=1` was present and has been changed to `PREVIEW_QA_BYPASS=0`.

## Sessions

The app uses standard PHP sessions via `session_start()` and does not define a custom shared `session_save_path` in the repo or `.env` evidence. Production and preview run on separate hostnames, so browser session cookies are host-scoped.

Status: PASS by hostname isolation. Residual note: no custom per-environment server-side session path is configured.

## Files / Uploads

| Environment | Webroot |
|---|---|
| Production | `/home/liemdo0208/releases/dashboard-a40f8e7` via `/home/liemdo0208/dashboard.bakudanramen.com` symlink |
| Preview | `/home/liemdo0208/phase11-preview` |

Status: PASS. Upload paths are relative to each application root, so production and preview file trees are isolated.

## Telegram

Telegram config is env-driven in `config/telegram.php`. No Telegram bot values were printed in evidence to avoid leaking secrets.

Status: Documented, secret values not exposed.

## Email

Default config:
- Driver: SMTP
- Host: `smtp.gmail.com`
- Sender: `noreply@dashboard.bakudanramen.com`

Preview behaviour: no preview-specific SMTP override was found in `.env` evidence. Treat preview email as not isolated until an explicit staging sender/disabled email flag is configured.

Status: WARNING.
