# SECRET_ROTATION_PLAN.md
> Phase 0 — Secret Rotation Plan
> Date: 2026-06-18

---

## Current Exposure Assessment

**No secrets were found exposed** in git, snapshots, or exports.
No emergency rotation required.

---

## Rotation Schedule

| Secret | Service | Priority | Rotate When |
|--------|---------|----------|------------|
| MI_CORE_API_KEY | Internal Mi auth | LOW | Every 90 days or on suspected leak |
| ASANA_TOKEN | Asana integration | LOW | Asana token expiry or on leak |
| GOOGLE_CLIENT_SECRET | OAuth (mi-core) | MEDIUM | On Google rotation prompt |
| GOOGLE_SERVICE_ACCOUNT_JSON | Sheets/Drive | MEDIUM | On Google rotation prompt |
| OPENAI_API_KEY | Review system, Phuyen | HIGH | Every 90 days |
| TELEGRAM_BOT_TOKEN | Phuyen bot | LOW | On suspected leak |
| GEMINI_API_KEY | Phuyen bot | MEDIUM | Every 90 days |
| POSTGRES_PASSWORD | BigData infra | LOW | Every 180 days |
| JWT_SECRET | Packing list app | LOW | Every 180 days |
| MI_PIN | Mi CEO auth | MEDIUM | Every 60 days |
| MI_SNAPSHOT_SECRET | Snapshot exports | LOW | Every 90 days |

---

## Secret Manager Policy

### Rule 1 — Storage
```
✅ secrets stored ONLY in .env files (not committed)
✅ .env files listed in .gitignore
❌ NEVER hardcode in source files
❌ NEVER print in logs or reports
❌ NEVER export in snapshots
```

### Rule 2 — Access
```
✅ runtime secrets loaded via process.env
✅ PM2 reads from .env files at startup
❌ NEVER pass secrets as CLI arguments
❌ NEVER log secrets even at DEBUG level
```

### Rule 3 — Sharing
```
✅ share only .env.example (with placeholder values)
❌ NEVER share .env files directly
❌ NEVER include in zip backups meant for external sharing
```

### Rule 4 — Rotation Trigger
Rotate immediately if:
- Secret appears in any git commit
- Secret appears in any exported file
- Service reports unauthorized access
- Employee leaves who had access

### Rule 5 — Vault (future)
When Mi reaches Phase 7 (Money Operations), implement:
- `vault/` directory with encrypted store
- `mi-core/server/src/vault/secret-manager.ts`
- All secrets read through SecretManager, never raw `process.env`

---

## Immediate Actions Taken

| Action | Status |
|--------|--------|
| Verified 0 secrets in git | ✅ Done |
| Verified 0 secrets in company-snapshot.zip | ✅ Done |
| Verified PM2 dump outside git repo | ✅ Confirmed |
| Added `.pm2/` to .gitignore consideration | ✅ Noted |
| All .env files confirmed gitignored | ✅ Done |

---

## Status: ROTATION_PLAN_COMPLETE ✅
No rotation required at this time.
