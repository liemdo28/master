# n8n Credentials Directory

## Rule: NEVER STORE SECRETS IN THIS DIRECTORY

This directory is for **credential metadata only** — for example, a list of which integrations require credentials, the credential type, and who owns the credential. Actual secret values live in:

1. The `.env` file (for n8n configuration secrets)
2. The Mi-Core secret manager (for third-party API keys)
3. The PM2 ecosystem file (only for development)

## What Goes Here

- `README.md` (this file)
- `credential-inventory.json` — metadata about each credential (type, purpose, owner, rotation date)
- NEVER raw passwords, API keys, OAuth tokens, or session cookies.

## Credential Inventory Template

```json
{
  "credentials": [
    {
      "id": "mi-core-api-key",
      "type": "api_key",
      "purpose": "Authenticate n8n → Mi-Core contract calls",
      "owner": "platform-team",
      "rotation_days": 90,
      "last_rotated": "2026-06-24",
      "stored_in": "Mi-Core .env (MI_CORE_API_KEY) + n8n .env (MI_API_KEY)",
      "n8n_credential_id": null,
      "notes": "Same value must exist in both n8n and Mi-Core .env files."
    },
    {
      "id": "google-search-console",
      "type": "oauth2",
      "purpose": "SEO domain verification",
      "owner": "seo-team",
      "rotation_days": 180,
      "last_rotated": "2026-01-15",
      "stored_in": "n8n credentials DB (encrypted)",
      "n8n_credential_id": "TBD-on-import",
      "notes": "Import via n8n UI after first workflow import."
    }
  ]
}
```

## Audit Trail

All credential reads and writes are logged to `Mi-Core` at `/api/mi/workflows/log` with `domain: "credentials"`. n8n never reads/writes secrets without logging.
