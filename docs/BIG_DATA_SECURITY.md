# Mi Big Data — Security Rules

## What Is NEVER Ingested

| Data Type | Example | Enforcement |
|---|---|---|
| API keys | `sk-...`, `sk-ant-...`, `ghp_...` | `secret-redactor.ts` pattern match |
| Passwords | `password=hunter2`, `POSTGRES_PASSWORD=...` | Key-name blocking + pattern match |
| OAuth tokens | `access_token`, `refresh_token` | Key-name blocking |
| Session cookies | `authorization: bearer ...` | Pattern match |
| Private keys | `-----BEGIN RSA PRIVATE KEY-----` | Block pattern |
| `.env` files | `.env`, `.env.local`, `.env.production` | Filename blocklist |
| Google tokens | `google-tokens.json`, `credentials.json` | Filename blocklist |
| Private keys files | `id_rsa`, `id_ed25519`, `*.pem` | Filename blocklist |
| Health data | `owner-profile/health_context.json` | Consent required |

## Secret Redactor (`secret-redactor.ts`)

All text content passes through the redactor before being stored in MinIO or indexed in Qdrant.

**Detection patterns:**
- `sk-[A-Za-z0-9-_]{20,}` — OpenAI key
- `sk-ant-[A-Za-z0-9-_]{40,}` — Anthropic key
- `ghp_[A-Za-z0-9]{36}` — GitHub PAT
- `xoxb-*`, `xoxp-*` — Slack tokens
- `AKIA[A-Z0-9]{16}` — AWS access key
- `sk_live_*`, `sk_test_*` — Stripe keys
- `password=`, `token=`, `api_key=` — Generic KV pairs
- `authorization: bearer ...` — Auth headers
- `-----BEGIN * PRIVATE KEY-----` — PEM blocks
- `.env` key-value patterns (DB_PASSWORD, JWT_SECRET, etc.)

**Object redaction:**
- JSON keys named `password`, `secret`, `private_key`, `access_token`, `refresh_token`, `api_key`, `client_secret` are blanked regardless of value.

**On secret detection:**
1. Value is replaced with `[REDACTED:type]`
2. Security warning is logged
3. Audit log entry created with `action: secret_redacted`
4. Original secret is NEVER stored

## Approval Requirements

| Action | Approval Level |
|---|---|
| Read/search bigdata | None |
| Ingest JSON (push) | None (automated connectors) |
| Ingest file (manual upload) | L1 (auto) |
| Browser evidence ingest | L2 (write) |
| Delete raw object | L3 (dangerous) |
| Export to external system | L2 |

## Audit Trail

Every ingestion, search, and registration is recorded in `audit_log`:
- `actor` — who triggered the action
- `action` — what happened
- `entity_type` + `entity_id` — what was affected
- `before_json` + `after_json` — state change

Audit log is append-only. No DELETE operations on `audit_log`.

## MinIO Access

- Buckets are private. No public read/write.
- Only Mi-Core server (via S3 client) can access.
- MinIO console (port 9001) is LAN/Tailscale only — never expose to internet.
- Credentials in `.env` only — never in git.

## PostgreSQL Access

- Password in `.env` only.
- Connection from localhost only.
- Never expose port 5432 to internet.
- No raw SQL from user input — all queries use parameterized `$1, $2` placeholders.
