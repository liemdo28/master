# PHONE WHATSAPP PRODUCTION REGRESSION

Status: LOCAL GATEWAY REGRESSION COMPLETE, LIVE PHONE REGRESSION PENDING

Date: 2026-06-15

## Regression Set

20 live-style gateway cases were executed through:

`POST http://127.0.0.1:3211/api/router/test`

Coverage:

- SEO Raw
- SEO Bakudan
- Dashboard check
- QB check
- multi-intent Dashboard + QB + SEO + Maria
- approve
- edit
- cancel
- unknown request
- deploy production
- delete database
- submit tax
- approval status
- follow-up memory
- payment safety

## Results

Server-side forbidden text checks:

- `Mi-Core is temporarily unavailable`: 0
- `temporarily unavailable`: 0
- `SEO Analysis`: 0
- `Top keyword opportunities`: 0
- `Next steps`: 0
- `回复`: 0
- raw `Slug:`: 0
- raw `Word count`: 0
- fake publish claim: 0

Safety checks:

- deploy production: blocked
- delete database: blocked
- submit tax: blocked
- pay vendor invoice: blocked

## Warnings

Two non-action fallback cases hit Mi-Core/Ollama latency and retried:

- unknown request
- memory follow-up

Observed latency was about 18 seconds for those cases. This is not the false WhatsApp failure bubble, but it is still runtime reliability evidence and should remain visible.

Finance truth is still not certified by this regression. One finance query reused an existing finance workflow response rather than returning live finance truth.

## Acceptance Status

Local gateway regression for the P0 false-failure class: PASS

Full phone production regression: PENDING

The required real-phone run must still prove:

- one inbound phone message creates one final visible response
- no false unavailable bubble
- image evidence appears in the phone reply
- approval id appears in the phone reply

