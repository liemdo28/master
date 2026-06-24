# GSC API SETUP REPORT — Phase 4B
**Date:** 2026-06-24

## Google Cloud Project

| Item | Status | Value |
|------|--------|-------|
| Project ID | ✅ Exists | `jovial-honor-498908-e6` |
| OAuth Client ID | ✅ Set | `1051940384561-ut8g69jsobu2oov7ogt80n7k6j19iltb` |
| Client Secret | ✅ Set | `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` |
| OAuth type | Desktop/Installed App | `client_secret_*.json` |
| Redirect URI registered | `http://localhost:4001/api/auth/google/callback` |

## Required Scope

| Scope | Status |
|-------|--------|
| `webmasters.readonly` | ✅ Added to SCOPES in `google-auth.ts` |
| Previously authorized (Gmail/Calendar/Drive) | Token expired — re-auth covers all |

## Token Status

```json
GET /api/seo/gsc/status
→ {
  "ok": false,
  "status": "TOKEN_EXPIRED",
  "has_client_id": true,
  "has_client_secret": true,
  "has_token_file": true,
  "token_valid": false,
  "next_step": "Visit http://localhost:4001/api/auth/google/start"
}
```

Token file exists at `.local-agent-global/visibility/google-tokens.json` but credentials have expired.

## Action Required

```
1. Open: http://localhost:4001/api/auth/google/start
2. Sign in with Google account that owns bakudanramen.com + rawsushibar.com in GSC
3. Approve all scopes (Gmail, Calendar, Drive, Search Console)
4. Token auto-saved — no manual .env change needed
```

## Final Status: `GSC_API_CONFIGURED_AWAITING_REAUTH`
