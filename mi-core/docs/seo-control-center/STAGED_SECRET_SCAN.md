# SEO Control Center Staged Secret Scan

Scan date: 2026-07-13
Branch: `feature/seo-control-center-secured`

## Commands

```powershell
git diff --cached --no-ext-diff --unified=0 |
  Select-String -Pattern 'refresh_token|access_token|id_token|client_secret|cookie|set-cookie|password|passwd|BEGIN PRIVATE KEY|sk-[A-Za-z0-9_-]+|ghp_[A-Za-z0-9_]+|xox[baprs]-|AIza[0-9A-Za-z_-]+|ya29\.|\.db|chatgpt-browser-profile|auth-state|session\.json'

git diff --cached --name-only |
  Select-String -Pattern '\.(db|sqlite|sqlite3|png|jpg|jpeg|gif|webp|log|jsonl)$|chatgpt-browser-profile|reports/evidence|node_modules|\.env'
```

## Findings

File-name/runtime artifact findings: **0**

Content findings reviewed:

- Fake OpenAI, Anthropic, Google, GitHub, Slack, and password strings in
  `mi-core/server/src/seo/ai-providers/redact.ts` tests. These are synthetic
  redaction fixtures and are asserted not to survive redaction.
- Documentation comments mentioning browser cookies/profile behavior in
  `chatgpt-browser-provider.ts` and `chatgpt-manual-login.ts`. No cookie value,
  account identifier, profile directory contents, local storage, or browser data
  is committed.
- `.db` references in comments/tests describing isolated SQLite temp files and
  production DB paths. No SQLite database file is staged.
- `../../../etc/passwd` appears as a path-traversal test string in
  `security.mjs`; it is not a credential.

## Real Findings

None.

## Excluded From Commit

- `mi-core/reports/evidence/**`
- ChatGPT browser profile directories
- cookies/local storage/session state
- OAuth token files
- `.env`
- SQLite databases
- screenshots
- logs/temp files
- PM2 dumps

## Final Result

PASS
