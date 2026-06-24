# FALSE FAILURE TRACE REPORT

Status: NOT FIXED - EXTERNAL LINKED SENDER CONFIRMED

Date: 2026-06-16

## Scope

Real phone message under investigation:

`Mi oi, tao bai SEO cho Raw`

Observed failure:

1. WhatsApp received a successful workflow response.
2. WhatsApp then received a second false failure bubble.

## Current Finding

The exact English string `Mi-Core is temporarily unavailable. Please try again later.` is not being sent by the currently running local PM2 `whatsapp-ai-gateway`.

Live isolation test:

- Stopped local PM2 `whatsapp-ai-gateway`.
- Sent from logged-in WhatsApp Web:
  `TEST-DEV5-009 Mi oi, ping isolate. Gateway local dang tat.`
- Result: LD Agent still replied:
  `Mi-Core is temporarily unavailable. Please try again later.`
- Therefore the false failure is coming from another linked device, old bot runtime, remote gateway, or external WhatsApp automation attached to the same LD Agent account.

Evidence screenshot:

`E:\Project\Master\mi-core\.local-agent-global\whatsapp-proof\TEST-DEV5-009-local-gateway-stopped-external-failure.png`

This means the remaining production blocker cannot be closed by only editing the current local gateway source.

## Live Evidence Before Patch

Gateway PM2 logs showed the real phone message was routed through:

- handler: `no_prefix_mi_forward`
- Mi-Core request: `/api/whatsapp/mi`
- result: `Forward success`
- outbound: workflow reply sent
- self echo: execution reply ignored

The screenshot supplied by the user showed an additional false failure bubble after the successful workflow response.

## Trace Instrumentation Added

New trace file:

`E:\Project\Master\whatsapp-ai-gateway\data\mi-core-forward-trace.jsonl`

Each live WhatsApp Mi forward now records:

- inbound WhatsApp message id
- gateway handler
- Mi-Core request id
- workflow id
- approval id
- outbound send or suppression event
- source of outbound message
- redacted reply preview

## Local Gateway Status After Isolation

Local PM2 gateway was restarted after the isolation test.

- `whatsapp-ai-gateway`: online, PID `32388`
- `mi-core`: online, PID `24200`
- Gateway health: `whatsapp_ready: true`
- Mi-Core health: `server: ok`

## Required Next Action

On the LD Agent WhatsApp account, unlink or stop every linked device/session except the production PM2 gateway session.

Then rerun live phone/Web smoke:

1. Send `Mi oi, tao bai SEO cho Raw`.
2. Verify exactly one response.
3. Verify no `Mi-Core is temporarily unavailable` bubble.
4. Verify approval ID and image evidence.
5. Only then run the 100-message regression.

## Verdict

NOT READY.

The 100-message test is blocked because an external linked sender is still producing false failure bubbles. Running the full regression now would create noisy evidence and false failures unrelated to the current local PM2 gateway code.
