# WhatsApp To Execution Trace

Audit timestamp: 2026-06-15 21:38 Asia/Saigon

## Required Trace Fields

| Field | Evidence |
|---|---|
| Inbound message id | `audit-forward-1781534053949` for gateway forward probe; direct engine proof `audit-direct-raw-*` |
| Gateway file/function | `whatsapp-ai-gateway/src/whatsapp/message-listener.js` no-prefix CEO path |
| Gateway router | `agent-mi-router.handleMiMessage()` |
| Gateway forwarder | `agent-mi-forwarder.forwardToMi()` |
| Mi-Core endpoint called | `POST http://localhost:4001/api/whatsapp/mi` |
| Route handler | `server/src/routes/whatsapp.ts` `whatsappRouter.post('/mi')` |
| Intent classifier result | `action_request`, `seo_content`, target `Raw Sushi` |
| Router decision | Use execution engine before legacy skill/pipeline |
| Execution engine called | Yes in Mi-Core route after fix: `processCEORequest()` |
| Workflow id | Direct engine proof: `SEO-CONTENT-20260615-994` |
| Approval id | Direct engine proof: `APPR-mqfbe0wb-526` |
| Evidence path | `.local-agent-global/workflows/SEO-CONTENT-20260615-994.json` |
| Draft path | `.local-agent-global/seo-drafts/seo-preview-SEO-CONTENT-20260615-994.md` |
| Final WhatsApp response | Not available end-to-end: gateway forward blocked by `401 MISSING_API_KEY` |

## Direct Execution Engine Proof

Command executed locally against compiled runtime:

```js
processCEORequest({
  message: 'Mi oi, tao bai SEO cho Raw',
  sender: 'direct-engine-audit-raw',
  message_id: 'audit-direct-raw-*'
})
```

Observed result:

```json
{
  "action": "workflow_created",
  "message_class": "action_request",
  "domain": "seo_content",
  "target_entity": "Raw Sushi",
  "workflow_id": "SEO-CONTENT-20260615-994",
  "workflow_target": "Raw Sushi",
  "approval_id": "APPR-mqfbe0wb-526",
  "evidence_path": ".local-agent-global/workflows/SEO-CONTENT-20260615-994.json"
}
```

## Gateway Forward Probe

Observed gateway forward result:

```json
{
  "ok": false,
  "error": "HTTP 401",
  "statusCode": 401,
  "response_body": {
    "ok": false,
    "error": "MISSING_API_KEY"
  }
}
```

## Trace Verdict

Mi-Core route: **PASS after source fix**.

Real WhatsApp to Mi-Core: **FAIL/BLOCKED** because the gateway runtime lacks a Mi-Core API key.
