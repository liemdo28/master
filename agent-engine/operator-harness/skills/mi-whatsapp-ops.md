# mi-whatsapp-ops

Use for WhatsApp gateway, API key manager, message forwarding, runtime store, and approval flows.

1. Confirm the affected boundary: `server/src/routes/whatsapp.ts`, WhatsApp services, gateway project, or connector state.
2. Keep API keys and session material out of logs, reports, and UI payloads.
3. Treat outbound send/update actions as approval-gated unless explicitly configured as safe read-only status.
4. Verify route contract, key lookup, store behavior, error response, and audit path.
5. Include gateway online/offline behavior in evidence.

