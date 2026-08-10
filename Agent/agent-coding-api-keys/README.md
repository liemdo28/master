# Antigravity AI Gateway — local key vault

`keys.json` (real provider API keys) is **not tracked in git** — see `.gitignore`. It
previously was tracked (removed 2026-08-10, see
`docs/security/PHASE5G_CREDENTIAL_REMEDIATION.md`); that historical exposure requires
manual rotation at each provider's own console (opusmax, antigravity, zai) — this has
not been done automatically. A placeholder-shaped template is at `keys.example.json`.
Copy it to `keys.json` and fill in real values to restore local functionality.

Start with `gateway-start.bat` (Windows) — it runs `node dist/server.js` from this
directory and restarts automatically if the health check at
`http://127.0.0.1:3456/health` fails.
