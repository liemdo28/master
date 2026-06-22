# P0-1 — Secret Inventory Report
**Generated:** 2026-06-15
**Classification:** INTERNAL — DO NOT COMMIT

---

## P0 Incident Summary

**Root Cause:** Knowledge base indexed a file containing the URL `https://dashboard.bakudanramen.com/deploy.php?key=deploy-p3-2026`. The LLM received this URL verbatim in its context window and returned it in a WhatsApp reply to the CEO.

**Confirmed Leak Vector:**
- Source: Knowledge base document containing deploy URL with `?key=` parameter
- Path: LLM context → LLM response → WhatsApp reply → CEO phone
- Pattern matched: `deploy_url_key` (added to scrubber in P0-2)

---

## Secret Registry

All secrets MUST be stored in server-side `.env` only. Never committed to git.

### Category 1 — Deployment Secrets
| Variable | Storage | Risk | Status |
|----------|---------|------|--------|
| `DEPLOY_KEY` | `.env` only | CRITICAL — confirmed P0 leak vector | ✅ Scrubbed by `deploy_key` pattern |
| `DEPLOY_TOKEN` | `.env` only | CRITICAL | ✅ Scrubbed by `mi_env_value` pattern |
| `MI_SNAPSHOT_SECRET` | `.env` only | CRITICAL | ✅ Scrubbed by `mi_env_value` pattern |
| Deploy URL `?key=` params | BLOCKED from KB | CRITICAL | ✅ Scrubbed by `deploy_url_key` pattern |

### Category 2 — AI Provider Keys
| Variable | Storage | Risk | Status |
|----------|---------|------|--------|
| `ANTHROPIC_API_KEY` | `.env` only | HIGH | ✅ Scrubbed by `dotenv_secret` + `anthropic_key` patterns |
| `OPENAI_API_KEY` | `.env` only | HIGH | ✅ Scrubbed by `dotenv_secret` + `openai_key` patterns |
| `SKYVERN_API_KEY` | `.env` only | MEDIUM | ✅ Scrubbed by `dotenv_secret` pattern |
| `AGENT_CODING_API_KEY` | `.env` only | MEDIUM | ✅ Scrubbed by `dotenv_secret` pattern |
| `OPENAI_COMPATIBLE_API_KEY` | `.env` only | MEDIUM | ✅ Scrubbed by `api_key_kv` pattern |

### Category 3 — Google / OAuth Tokens
| Variable | Storage | Risk | Status |
|----------|---------|------|--------|
| `GOOGLE_CLIENT_SECRET` | `.env` only | HIGH | ✅ Scrubbed by `dotenv_secret` + `secret_kv` patterns |
| `GOOGLE_REFRESH_TOKEN` | `.env` only | HIGH | ✅ Scrubbed by `dotenv_secret` + `google_refresh` patterns |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Local file path only | HIGH | ✅ `isBlockedFilename()` blocks service-account.json |
| `ASANA_TOKEN` | `.env` only | MEDIUM | ✅ Scrubbed by `dotenv_secret` + `token_kv` patterns |

### Category 4 — QuickBooks Credentials
| Variable | Storage | Risk | Status |
|----------|---------|------|--------|
| `QB_CLIENT_SECRET` | `.env` only | HIGH | ✅ Scrubbed by `qb_secret` pattern |
| `QB_REFRESH_TOKEN` | `.env` only | HIGH | ✅ Scrubbed by `qb_secret` pattern |
| `QB_REALM_ID` | `.env` only | MEDIUM | ✅ Scrubbed by `qb_secret` pattern |

### Category 5 — Database Passwords
| Variable | Storage | Risk | Status |
|----------|---------|------|--------|
| `POSTGRES_PASSWORD` | `.env` only | HIGH | ✅ Scrubbed by `dotenv_secret` + `password_kv` patterns |
| `MINIO_ROOT_PASSWORD` | `.env` only | HIGH | ✅ Scrubbed by `dotenv_secret` + `password_kv` patterns |

### Category 6 — MI-Core Internal Tokens
| Variable | Storage | Risk | Status |
|----------|---------|------|--------|
| `MI_PIN` | `.env` only | HIGH | ✅ Scrubbed by `mi_env_value` + `dotenv_secret` patterns |
| `MI_PIN_HASH` | `.env` only | MEDIUM | ✅ Value scrubbed by `dotenv_secret` |
| `MI_REMOTE_TOKEN` | `.env` only | HIGH | ✅ Scrubbed by `mi_env_value` + `dotenv_secret` patterns |
| `REVIEW_SYSTEM_INTERNAL_TOKEN` | `.env` only | HIGH | ✅ Scrubbed by `mi_env_value` pattern |
| `REVIEW_APPROVAL_INTERNAL_TOKEN` | `.env` only | HIGH | ✅ Scrubbed by `mi_env_value` pattern |

### Category 7 — WhatsApp / CEO Identity
| Variable | Storage | Risk | Status |
|----------|---------|------|--------|
| `CEO_WHATSAPP_NUMBER` | `.env` only | HIGH — PII | ⚠️ Not in scrubber (no pattern match risk) |
| `CEO_WHATSAPP_ALLOWED_NUMBERS` | `.env` only | HIGH — PII | ⚠️ Not in scrubber (no pattern match risk) |
| `MI_CEO_WHATSAPP_IDS` | `.env` only | HIGH — PII | ⚠️ Not in scrubber (no pattern match risk) |
| WhatsApp API key | Runtime-only (memory) | HIGH | ✅ Scrubbed by `api_key_kv` pattern |

---

## Secret Storage Policy

All secrets listed above MUST follow these rules:

1. **`.env` only** — Never committed to git. Listed in `.gitignore`.
2. **Never in knowledge base** — Knowledge base indexer MUST skip `.env` files (enforced by `isBlockedFilename()`).
3. **Never in code** — No hardcoded values. Use `process.env.VAR_NAME`.
4. **Never in logs** — PM2 logs must not contain secret values. `redactSecrets()` applied at response exits.
5. **Never sent to LLM** — `scrubReply()` applied to system prompt and user message before every `askAiWithBrain()` call.
6. **Never to WhatsApp** — `responseScrubberMiddleware` mounted on `whatsappRouter` — intercepts every `res.json()`.

---

## Files Containing Secret References (by name only, not by value)

These files reference secret variable NAMES as part of their logic — this is expected and safe:

| File | Purpose |
|------|---------|
| `mi-core/.env.example` | Template — empty values only |
| `mi-core/server/src/bigdata/secret-redactor.ts` | Scrubber — pattern definitions |
| `mi-core/server/src/middleware/response-scrubber.ts` | Response gate |
| `mi-core/server/src/routes/whatsapp.ts` | Reads `CEO_WHATSAPP_NUMBER` etc from process.env |
| `mi-core/server/src/services/whatsapp-key-manager.ts` | WhatsApp API key management |

---

## Git History Note

If `MI_SNAPSHOT_SECRET` or any other secret was ever committed as a raw value in git history:
1. Rotate the secret immediately
2. Run `git filter-repo` or BFG to scrub the history
3. Force-push after team approval
4. Invalidate any cached copies

**Current status:** `.env` is in `.gitignore` — secrets should NOT be in history. Verify with `git log -S 'deploy-p3'`.

---

## P0 Remediation Status

| Phase | Task | Status |
|-------|------|--------|
| P0-1 | Secret inventory | ✅ COMPLETE (this document) |
| P0-2 | Response gate — `secret-redactor.ts` new patterns | ✅ COMPLETE |
| P0-2 | Response gate — `chat.ts` wired | ✅ COMPLETE |
| P0-2 | Response gate — `whatsapp.ts` wired (middleware) | ✅ COMPLETE |
| P0-3 | Pre-LLM gate — `response-pipeline.ts` system prompt scrubbed | ✅ COMPLETE |
| P0-3 | Pre-LLM gate — user message scrubbed before LLM | ✅ COMPLETE |
| P0-4 | Security regression — `security-regression.mjs` | ✅ WRITTEN (run to certify) |

**Target:** `P0_SECURITY_CERTIFIED` (achieved when `security-regression.mjs` reports 0 leaks)
