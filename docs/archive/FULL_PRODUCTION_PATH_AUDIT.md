# Full Production Path Audit

Generated: 2026-06-16 05:40 Asia/Saigon

## Scope

Audited the live WhatsApp gateway to Mi-Core production path:

WhatsApp gateway -> `http://localhost:4001/api/whatsapp/mi` -> Mi-Core routing -> execution engine -> workflows -> approvals -> SEO draft/image evidence -> gateway reply.

## Live Runtime Evidence

- `mi-core`: PM2 online, port `4001`, PID matched listening process during audit.
- `whatsapp-ai-gateway`: PM2 online, port `3211`, PID matched listening process during audit.
- `ollama`: listening on `127.0.0.1:11434`.
- `GET /api/health`: `server=ok`, `python_ai_service=ok`, `ollama=ok`.
- Protected visibility API rejected unauthenticated access with `Unauthorized - login with PIN`.

## Production Route Findings

- `/api/router/test` forwards to `client_id=mi-core` with API key redacted in gateway logs.
- Mi-Core accepts authenticated gateway requests.
- Multi-intent WhatsApp route now executes the same deterministic executor used by `/api/chat`.
- Finance truth questions now resolve from QuickBooks runtime evidence instead of creating generic workflows.
- Dangerous commands block deterministically, including under rate-limit pressure.
- Obvious unknown requests return clarification instead of entering slow AI fallback.

## Result

Production execution path is functioning for gateway-style live requests.

Operational certification is withheld because connector truth still shows:

- Gmail stale in `data-freshness.json`.
- QuickBooks runtime degraded / not certified.
- Restart stability cannot be certified for 24h because planned audit restarts occurred.

