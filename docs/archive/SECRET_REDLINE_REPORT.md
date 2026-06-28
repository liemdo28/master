# SECRET_REDLINE_REPORT.md
> Phase 0 — Secret Redline Report
> Date: 2026-06-18

---

## Redline Policy

Any file that is exported, snapshotted, or sent outside the local machine MUST be redacted of:
- API keys (any provider)
- OAuth tokens and refresh tokens
- Passwords and DB credentials
- JWT secrets
- Webhook secrets
- Service account JSON content

---

## Files Redacted / Clean

### company-snapshot.zip ✅ CLEAN
All 9 files confirmed clean. No secrets. `master-tree.txt` false positive was path strings only.

### DEPARTMENT_RUNTIME_REPORT.md ✅ CLEAN
Contains pipeline IDs, UUIDs, model names — no secrets.

### DEPARTMENT_EXECUTION_CERTIFICATION.md ✅ CLEAN
Contains test results and pipeline metadata only.

### COMPANY_ASSET_REGISTRY_CERTIFICATION.md ✅ CLEAN
Registry metadata only, no credentials.

### pm2-list.json (in snapshot) ✅ CLEAN
Generated with env keys REDACTED — only process names, PIDs, paths exported.

---

## Active Secrets Map (for rotation tracking)

| Secret ID | Location | Last Rotated | Rotation Needed |
|-----------|----------|-------------|-----------------|
| ASANA_TOKEN | mi-core/server/.env | Unknown | No (functional) |
| GOOGLE_CLIENT_SECRET (mi-core) | mi-core/server/.env | Unknown | No |
| MI_CORE_API_KEY | server/.env + observer/.env + gateway/.env | Unknown | No |
| MI_PIN | mi-core/server/.env | Unknown | No |
| MI_SNAPSHOT_SECRET | mi-core/server/.env | Unknown | No |
| RAWWEBSITE_ADMIN_SECRET | mi-core/server/.env | Unknown | No |
| OPENAI_API_KEY (review) | Bakudan/review-automation-system/.env | Unknown | No |
| OPENAI_API_KEY (phuyen) | Other/phuyen-2026/.env | Unknown | No |
| TELEGRAM_BOT_TOKEN | Other/phuyen-2026/.env | Unknown | No |
| GEMINI_API_KEY | Other/phuyen-2026/.env | Unknown | No |
| POSTGRES_PASSWORD (bigdata) | mi-core/infra/bigdata/.env | 2026-06-18 | No |
| DB_PASS (packing-list) | Bakudan/.../v2-react/server/.env | Unknown | No |
| JWT_SECRET (packing-list) | Bakudan/.../v2-react/server/.env | Unknown | No |
| NEXTAUTH_SECRET | Other/LinkTreeHL/.env | Unknown | No |
| GOOGLE_SERVICE_ACCOUNT_JSON | gateway/.env | Unknown | Monitor |
| AGENT_CODING_API_KEY | gateway/.env | Unknown | No |

**Exposed secrets requiring rotation: 0**

---

## Redaction Rules for Future Exports

When generating any report/snapshot/export:

```
NEVER include: actual token values, passwords, API keys
ALWAYS use: [REDACTED], [SET_IN_ENV], or omit the field
EXCEPTION: non-sensitive configs (ports, URLs, model names) may be included
```

---

## Status: REDLINE_COMPLETE ✅
