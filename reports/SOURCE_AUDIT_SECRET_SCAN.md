# SOURCE_AUDIT_SECRET_SCAN.md
> Mi Company OS — Secret Exposure Audit
> Date: 2026-06-18
> Rule: No full secret values printed. All values masked.

---

## Scan Methodology

1. `git ls-files` — checked all git-tracked files for .env patterns
2. Grep for key names in .env files (values NOT printed)
3. Checked for .pem, .key, .p12, credentials JSON, OAuth tokens, PM2 dump
4. Checked WhatsApp session dirs

---

## Git-Tracked Secrets

### Monorepo (mi-core)
```
git ls-files | grep "\.env$" (excl. examples)

Result:
  Agent/agent-coding-api-keys/._.env   — macOS AppleDouble resource fork (NO SECRETS)
  Agent/agent-coding-api-keys/._keys.env — macOS AppleDouble resource fork (NO SECRETS)
```

**Verdict:** ✅ No real .env files tracked in git.

### Individual Repos
| Repo | .env in git? | Risk |
|------|-------------|------|
| dashboard.bakudanramen.com | ❌ NO | None |
| review-automation-system | ❌ NO | None |
| integration-system | ❌ NO | None |
| bakudanramen.com-current | ❌ NO | None |
| RawWebsite | ❌ NO | None |
| growth-dashboard | ❌ NO | None |

---

## Local .env Files (Not in Git, Not for Export)

### mi-core/server/.env
| Key Name | Risk Level | Action for Export |
|----------|-----------|-------------------|
| MI_PORT | LOW | Safe (port number) |
| AI_SERVICE_URL | LOW | Safe (localhost URL) |
| OLLAMA_URL | LOW | Safe (localhost URL) |
| OLLAMA_FAST_MODEL | LOW | Safe (model name) |
| OLLAMA_DEEP_MODEL | LOW | Safe (model name) |
| MASTER_ROOT | LOW | Safe (file path) |
| ALLOWED_ORIGINS | LOW | Safe (domain list) |
| ASANA_TOKEN | **HIGH** | **EXCLUDE from export** — API token |
| MI_PIN | **HIGH** | **EXCLUDE from export** — CEO PIN |
| GOOGLE_CLIENT_ID | **HIGH** | **EXCLUDE from export** — OAuth credential |
| GOOGLE_CLIENT_SECRET | **HIGH** | **EXCLUDE from export** — OAuth secret |
| GOOGLE_REDIRECT_URI | LOW | Safe (URL) |
| DASHBOARD_API_URL | LOW | Safe (URL) |
| MI_SNAPSHOT_SECRET | **HIGH** | **EXCLUDE from export** — API secret |
| MI_CORE_API_KEY | **HIGH** | **EXCLUDE from export** — API key |
| VOICE_TTS_ENABLED | LOW | Safe (boolean) |
| VIETTS_VOICE | LOW | Safe (voice name) |
| RAWWEBSITE_ADMIN_SECRET | **HIGH** | **EXCLUDE from export** — Admin secret |
| RAWWEBSITE_API_BASE | LOW | Safe (URL) |

### mi-core/services/whatsapp-ai-gateway/.env
| Key Name | Risk Level | Action for Export |
|----------|-----------|-------------------|
| TELEGRAM_BOT_TOKEN | **HIGH** | **EXCLUDE** — Bot token |
| TELEGRAM_CHAT_ID | MEDIUM | **EXCLUDE** — Chat ID |
| WHATSAPP_ENABLED | LOW | Safe |
| AI_ENABLED | LOW | Safe |
| DASHBOARD_PORT | LOW | Safe |
| WHATSAPP_SESSION_ROOT | LOW | Safe (path) |
| SESSION_DIR | LOW | Safe (path) |
| WHATSAPP_CLIENT_ID | MEDIUM | **EXCLUDE** — Session identifier |
| MI_CEO_WHATSAPP_IDS | **HIGH** | **EXCLUDE** — CEO phone numbers |

---

## Certificate/Key Files

| File Pattern | Found? | Location | Risk |
|--------------|--------|----------|------|
| *.pem | ❌ None | — | None |
| *.key | ❌ None | — | None |
| *.p12 | ❌ None | — | None |
| Google service_account.json | ❌ None | — | None |
| credentials.json | ❌ None | — | None |
| token.json | ❌ None | — | None |

---

## WhatsApp Session Data

WhatsApp session data (auth tokens, QR sessions) stored in:
- `mi-core/services/whatsapp-ai-gateway/` session directories

**Export Rule:** Session dirs EXCLUDED from ZIP. WhatsApp re-authenticates on new deployment.

---

## PM2 Dump / Snapshots

| File | Risk | Action |
|------|------|--------|
| `dump.pm2` | LOW | Excluded from ZIP (runtime state) |
| `*.sqlite-wal` | LOW | Excluded from ZIP |
| `*.sqlite-shm` | LOW | Excluded from ZIP |

---

## ZIP Pass Condition

| Check | Status |
|-------|--------|
| No .env in export | ✅ WILL EXCLUDE |
| No API keys/tokens | ✅ WILL EXCLUDE |
| No OAuth credentials | ✅ WILL EXCLUDE |
| No WhatsApp session | ✅ WILL EXCLUDE |
| No PM2 dump | ✅ WILL EXCLUDE |
| No .pem/.key/.p12 | ✅ NONE FOUND |
| No credentials JSON | ✅ NONE FOUND |
| .env.example only | ✅ WILL INCLUDE |

**Status: SECRETS_SECURED — No secrets will be in export ZIP**
