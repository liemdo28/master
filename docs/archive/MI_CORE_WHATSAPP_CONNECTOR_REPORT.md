# MI Core WhatsApp Connector Report

## Status: ✅ PASS

## Architecture

```
WhatsApp Account
→ whatsapp-api (owns WhatsApp session)
→ /mi command router
→ Mi-Core WhatsApp endpoint (POST /api/whatsapp/mi)
→ Mi Executive Pipeline (runPipeline)
→ response
→ whatsapp-api
→ WhatsApp reply
```

## Key Principles
- whatsapp-api is the **source of truth** for WhatsApp session
- Mi-Core **does not own** WhatsApp session
- Mi-Core only receives routed `/mi` requests and returns replies

## Files Created

| File | Purpose |
|------|---------|
| `server/src/services/whatsapp-key-manager.ts` | API key hashing, validation, rotation, rate limiting |
| `server/src/services/whatsapp-store.ts` | Message/group/approval persistence layer |
| `server/src/routes/whatsapp.ts` | All WhatsApp endpoints |
| `.local-agent-global/mi-core/whatsapp-client.json` | Config with hashed API key |

## Integration Points

- Uses existing `runPipeline` from `pipeline/response-pipeline.ts` — **no separate WhatsApp brain**
- Uses existing `approval/gate.ts` for approval workflow
- Messages are stored in `.local-agent-global/connectors/whatsapp/`

## Security
- API key stored as SHA-256 hash only, never raw
- Replay protection by message_id
- Rate limiting per client
- client_id validation
- Audit logging for all auth events
