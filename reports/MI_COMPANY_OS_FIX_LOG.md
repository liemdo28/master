# MI_COMPANY_OS_FIX_LOG.md
> Mi Company OS — Bug Fix Log
> Session: 2026-06-18 (100% Certification Push)

---

## Fix #1 — QA Gate: `started_at` vs `created_at` field mismatch

| Field | Value |
|-------|-------|
| Bug | QA Check #10 (evidence_chain) always fails — every pipeline returns `qa_verdict: FAIL` |
| Root cause | `qa-gate.ts` line 201 checks `s.started_at` but `evidence-store.ts` stores field as `s.created_at`. `started_at` is always `undefined`, so every step fails the check |
| File changed | `server/src/company-os/qa-gate.ts` line 201 |
| Fix applied | Changed `!s.started_at` → `!s.created_at` |

**Before (line 201):**
```typescript
const incompleteSteps = steps.filter(s => !s.dept_id || !s.started_at);
```

**After:**
```typescript
const incompleteSteps = steps.filter(s => !s.dept_id || !s.created_at);
```

**Before evidence:**
```
{"qa_verdict":"FAIL","confidence":0.8,"ceo_message":"QA failed: 8 step(s) missing dept or timestamp"}
```

**After evidence:**
```
{"qa_verdict":"PASS","confidence":0.8,"ceo_message":"Confidence is 80% — Mi recommends review"}
```

**Risk:** None — read-only fix, no data migration required.  
**Retest result:** 8/8 WhatsApp UX prompts → `qa_verdict: PASS`. 5/5 cross-dept workflows → PASS or PENDING (correct behavior).

---

## Fix #2 — PM2 Daemon Instability (documented, not code-fixed)

| Field | Value |
|-------|-------|
| Bug | PM2 daemon dies between terminal sessions, all processes lost |
| Root cause | Git Bash POSIX shell terminates background PM2 daemon on shell exit |
| Fix applied | Run `node server/dist/index.js` directly in background for evidence sessions; add `pm2 save` + `pm2 startup` for persistent production use |
| Risk | Server must be restarted after each shell session in dev mode |
| Retest result | Direct node start: stable for evidence collection; PM2 production config: needs `pm2 startup` run once with admin privileges |

**Recommended action:** Run `pm2 startup` once in an elevated shell to register PM2 as a Windows service.

---

## Security Issue Found (not a code bug — action required by CEO)

| Issue | Severity | Status |
|-------|----------|--------|
| `Other/gdrive-tools/credentials.json` with real `client_secret` committed to git | CRITICAL | UNRESOLVED — CEO must revoke + git-purge |
| `Other/gdrive-tools/token.json` with real `refresh_token` committed to git | CRITICAL | UNRESOLVED — CEO must revoke + git-purge |
| `mi-core/server/client_secret_*.json` on disk (not in git) | HIGH | Excluded from exports — CEO must rotate |

**Action required:**
1. Revoke both OAuth credentials in Google Cloud Console immediately
2. Run `git filter-branch` or BFG Repo Cleaner to purge from git history
3. Add to `.gitignore`: `credentials.json`, `token*.json`, `client_secret*.json`
4. Force-push all affected branches (requires CEO authorization)
