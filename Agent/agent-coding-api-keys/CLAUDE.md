# ⚠️ PROTECTED PROJECT — API Gateway & Key Management

## Canonical Path
`E:\Project\Master\Agent\agent-coding-api-keys`

## Protection Rules

**This project manages live API keys and a running production gateway on port 3456.**

### FORBIDDEN — Never do these unless working DIRECTLY in this project:
- Edit `keys.json`, `data/*.db`, `data/*.json`
- Stop, restart, or modify the running gateway process
- Change any source files in `src/`
- Add, remove, or rotate API keys
- Modify `.env` or any credential files

### ALLOWED from other projects:
- Read `CLAUDE.md` (this file) for context
- Call the gateway API at `http://127.0.0.1:3456` (read-only health checks)

### To make changes:
1. Open this project **directly**: `claude` from `E:\Project\Master\Agent\agent-coding-api-keys`
2. Or be explicitly told: *"fix the api-key project"* / *"update keys.json"*

### Why this matters:
- Gateway runs 24/7 serving all AI requests for the team
- Wrong edits = all AI tools go down immediately
- Keys are live credentials — exposure = account compromise

## Architecture (read-only reference)
- **Port**: 3456
- **Providers**: antigravity (NKQ), opusmax, anthropic, openrouter, ollama
- **Key storage**: SQLite DB at `data/provider-keys.db` (source of truth) + `keys.json` (fallback)
- **Dashboard**: http://127.0.0.1:3456
- **Runtime ops**: http://127.0.0.1:3456/runtime
