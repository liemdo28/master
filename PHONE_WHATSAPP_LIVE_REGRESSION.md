# Phone WhatsApp Live Regression

Date: 2026-06-16

## Status

GATEWAY LIVE-STYLE PASS.

REAL PHONE SCREENSHOT PENDING.

## Test Method

Tests were sent through:

`POST http://127.0.0.1:3211/api/router/test`

This exercises:

- WhatsApp gateway router
- Gateway Mi-Core forwarder
- `X-API-Key` authentication path
- Mi-Core `/api/whatsapp/mi`
- Execution engine
- Approval engine
- Evidence metadata

## Results

| Test | Input | Result |
|---|---|---|
| T1 | SEO Raw | PASS: workflow `SEO-CONTENT-20260616-064`, approval created, image evidence exists |
| T2 | SEO Bakudan | PASS: workflow `SEO-CONTENT-20260616-065`, approval created, image evidence exists |
| T3 | QB correction | PASS: correction router, no approval, no new finance workflow |
| T4 | Payroll correction | PASS: correction router, no approval |
| T5 | Task query | PASS: no false unavailable, no legacy fallback |
| T6 | Image follow-up | PASS: image evidence path returned and exists |
| T7 | Multi-intent | PASS: 4/4 child workflows, 0 dropped |
| T8 | Dangerous action | PASS: blocked, no execution |
| T9 | Unknown `Ha?` | PASS: clarification reply, no dashboard hijack |
| T10 | APPROVE | PASS: approval resolved, no raw ID dump in reply |

## Negative Checks

Across all 10 replies:

- 0 false unavailable messages
- 0 legacy SEO advice responses
- 0 `/ldagent` CEO-chat fallbacks
- 0 Chinese artifacts
- 0 raw `Approval ID:` labels
- 0 raw `Reference:` labels
- 0 fake image-ready claims without evidence path

## Runtime Evidence

- `mi-core` PID `7400`, port `4001`, PM2 online.
- `whatsapp-ai-gateway` PID `32676`, port `3211`, PM2 online.
- Gateway `MI_CORE_API_KEY` configured and Mi-Core reachable from router status.

## Verdict

Gateway and Mi-Core production path pass live-style regression.

Final phone certification must wait for a real phone screenshot after sending:

`Mi oi, tao bai SEO cho Raw`
