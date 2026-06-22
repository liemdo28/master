# WhatsApp Agent/MI Router Debug Report

Date: 2026-06-10

## Verdict

Status: PARTIAL PASS / BLOCKED

- `/mi hello`: PASS through gateway to Mi-Core.
- `/agent hello`: BLOCKED because no Agent-Coding WhatsApp endpoint is running at `http://localhost:3100/api/whatsapp/agent`.

## Root Cause

1. Group WhatsApp messages for `/mi` and `/agent` were routed through the legacy command path first.
2. In group quiet mode, unknown slash commands were silently dropped before reaching the Agent/MI router.
3. `MI_CORE_URL` was configured as `http://localhost:3200`, while the running Mi-Core service is on `http://localhost:4001`.
4. Mi-Core requires a non-empty `message_id` and expects `/mi ...` to remain in the forwarded `text` field.
5. Gateway client registry had no `agent-coding` or `mi-core` rows even though env keys were configured.

## Fix Applied

- Moved Agent/MI command handling ahead of group quiet mode in the WhatsApp message listener.
- Added generated/preserved `message_id` for Agent/MI forwarded payloads.
- Preserved `/mi ...` text for Mi-Core while adding `command_text` for the stripped command text.
- Changed Mi-Core default URL from `http://localhost:3200` to `http://localhost:4001`.
- Seeded gateway client registry from configured env keys without exposing raw keys.
- Added diagnostics APIs:
  - `GET /api/router/status`
  - `GET /api/clients`
  - `GET /api/audit/messages`
  - `POST /api/router/test`
- Improved forwarder failure audit records so failed responses include status/body details when available.

## Runtime Evidence

Router status:

- router enabled: true
- agent handler loaded: true
- mi handler loaded: true
- forwarder loaded: true
- `AGENT_CODING_URL`: `http://localhost:3100`
- `MI_CORE_URL`: `http://localhost:4001`
- Agent-Coding reachable: false
- Mi-Core reachable: true

Client status:

- `agent-coding`: exists, active, env key configured
- `mi-core`: exists, active, env key configured

Test result:

- `POST /api/router/test` with `/mi hello`
  - target: `http://localhost:4001/api/whatsapp/mi`
  - result: ok true
  - reply: `Em chao anh! ...`
  - audit: `ROUTE_SENT`

- `POST /api/router/test` with `/agent hello`
  - target: `http://localhost:3100/api/whatsapp/agent`
  - result: ok false
  - reason: Agent-Coding service not reachable
  - audit: `ROUTE_FAILED`

## Validation

- `node --check src/commands/agent-mi-router.js`: PASS
- `node --check src/forwarding/agent-mi-forwarder.js`: PASS
- `node --check src/whatsapp/message-listener.js`: PASS
- `node --check src/api/server.js`: PASS
- `npm test`: PASS

## Remaining Blocker

`/agent` cannot pass until an Agent-Coding service exposes:

```text
POST /api/whatsapp/agent
```

at the configured `AGENT_CODING_URL`, or `AGENT_CODING_URL` is pointed to a service that implements that route.

