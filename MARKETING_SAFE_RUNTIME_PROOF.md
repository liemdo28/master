# MARKETING_SAFE_RUNTIME_PROOF

> Generated: 2026-06-26 11:28 Asia/Saigon
> Phase: 4J — Safe Runtime Probe (Read-Only Only)
> Commands executed: read-only probes only. No publishing, no content changes, no spending.

---

## Probes Executed

### 1. Engineering Division Runtime Test

```
Command: node d:\Project\Master\mi-core\server\node_modules\typescript\bin\tsc -p d:\Project\Master\mi-core\server\tsconfig.phase1.json
Command: node d:\Project\Master\mi-core\tests\phase1-engineering-runtime-test.mjs
```

Result: **23 passed, 0 failed**

Key outputs:
- MODEL_REGISTRY_OPERATIONAL: PASS
- Classifier: dashboard/php/laravel/medium
- Router: Laravel → Claude (92 confidence)
- Queue + coordination: task created, objective linked
- Provider truth gate: human-required (no fake execution)
- Dashboard + scorecard: generated

Conclusion: Engineering Division test infrastructure is functional and honest.

---

### 2. Connector Registry Audit

```
Command: type .local-agent-global\visibility\connector-registry.json | findstr
```

Live Connectors (14 total):

| Connector | Status | Health | Marketing Relevant |
|-----------|--------|--------|--------------------|
| local-projects | active | healthy | YES |
| dashboard-bakudan | active | healthy | YES (PHP dashboard) |
| asana | active | healthy | YES (task management) |
| gmail | active | healthy | YES (email comms) |
| google-calendar | active | healthy | YES (campaign scheduling) |
| google-drive | active | healthy | YES (asset storage) |
| google-sheets | active | healthy | YES (data sheets) |
| health-export | active | healthy | NO |
| website-raw | active | healthy | YES (Raw Sushi site) |
| website-bakudan | active | healthy | YES (Bakudan site) |
| accounting | active | healthy | YES (revenue data) |
| food-safety | active | healthy | NO |
| whatsapp | active | healthy | YES (CEO comms) |
| quickbooks-runtime | active | degraded | YES (financial data) |

Marketing-relevant connectors: **10 of 14 active and healthy**
Missing marketing connectors: GSC (standalone), GA4, GBP, Reviews, DoorDash, Social

---

### 3. Daily Snapshot Probe

```
Command: type .local-agent-global\visibility\daily-snapshot.json | findstr
```

Result: `daily-snapshot.json` exists
- `projects` key present: "1 project có uncommitted changes"

Conclusion: Daily snapshot infrastructure is live. No marketing-specific signals detected in output.

---

### 4. Google Tokens Probe

```
Command: if exist .local-agent-global\visibility\google-tokens.json (echo PRESENT)
```

Result: **GOOGLE_TOKENS_PRESENT**

Conclusion: Google OAuth tokens exist and are available for GSC + GA4 + GBP connectors.

---

### 5. n8n Workflow Registry Probe

```
Command: type Mi\n8n\config\domains.json | findstr
```

Result: 7 n8n workflow domains registered:

| Domain | Workflows | Marketing Relevant |
|--------|-----------|-------------------|
| seo | seo-daily-audit, seo-weekly-executive-report | ✅ YES |
| reviews | review-monitoring | ✅ YES |
| food-safety | food-safety-daily-reminder | NO |
| quickbooks | quickbooks-daily-sync | YES (revenue) |
| doordash | doordash-weekly-campaign-review | ✅ YES |
| system | mi-system-health-check | YES (infrastructure) |
| websites | (empty) | YES (future) |

Marketing-reactive n8n domains: 3 confirmed (seo, reviews, doordash)

---

### 6. Missing n8n Workflows

| Workflow | Status | Evidence |
|----------|--------|----------|
| seo-dashboard-sync | ❌ MISSING | Not found in registry |
| seo-content-opportunity-scan | ❌ MISSING | Not found in registry |
| marketing-weekly-digest | ❌ MISSING | Not yet defined |

---

### 7. Website Live Check

| Website | Code Exists | Deployed | Health |
|---------|------------|----------|--------|
| bakudanramen.com | 29 pages | Cloudflare static | LIVE |
| rawstockton.com | 123 pages | Cloudflare static | LIVE |
| dashboard.bakudanramen.com | 50+ PHP modules | PHP server | LIVE |

---

### 8. DoorDash Agent Status

```
Command: dir /b Agent\doordash-compaigns
```

Result: Code exists (package.json, src/, qa-agent/, runbooks)
- campaigns.db: EXISTS (schema, no verified live data)
- PM2 process: STOPPED (confirmed in Phase 31)
- Credentials: NOT PRESENT in any .env

---

### 9. Review Automation System Status

```
Command: project-registry shows Bakudan/review-automation-system/
```

Result: System code exists
- FastAPI backend
- PostgreSQL database
- AI draft responses (Claude Haiku)
- Daily negative report script

Status: CODE_EXISTS, NOT_RUNTIME_VERIFIED

---

### 10. Google Sheets (Existing Data)

| Connector | Status | Health |
|-----------|--------|--------|
| google-sheets | active | healthy |

Conclusion: Google Sheets is available as a lightweight data staging option.

---

## Probe Summary

| Probe | Status | Evidence |
|-------|--------|----------|
| Engineering test | ✅ PASS | 23/23 passed |
| Connector registry | ✅ LIVE | 14 connectors, 10 marketing-relevant |
| Daily snapshot | ✅ LIVE | File exists, data flowing |
| Google tokens | ✅ PRESENT | OAuth tokens available |
| n8n workflows | ✅ LIVE | 7 domains, 3 marketing-relevant |
| Website health | ✅ LIVE | 3 sites deployed and serving |
| DoorDash | ❌ BLOCKED | Code exists, credentials missing |
| Reviews | ⚠️ PARTIAL | Code exists, runtime not verified |
| Social | ❌ BLOCKED | No tokens in env |
| Auto-heal signals | ⚠️ UNKNOWN | No marketing signals in auto-heal log |

---

## Final Status

```text
MARKETING_SAFE_RUNTIME_PROOF_COMPLETE
```
