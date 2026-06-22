# WhatsApp Group Mapping Live Audit

Date: 2026-06-04
Status: BLOCKED

## Target

Test WhatsApp group: `LD Agent-Log`

Required mapping:

- `store_id`: `test`
- `store_name`: `Test`
- `locked`: `true`
- `active`: `true`

Expected command result:

- Sending `/ldagent` in `LD Agent-Log` should start the agent session with `Store: Test`.

## What Was Verified

- Code supports the `test` store in `src/stores/store-registry.js`.
- `/ldagent` resolves mapped groups through `storeRegistry.resolveGroup(chatId)`.
- If the mapped group exists, `/ldagent` uses the mapped `store_name`, so a mapping to `test/Test` will produce `Store: Test`.
- Dashboard `Refresh Groups` button was fixed to call the live group discovery endpoint.
- Dashboard `Map Group to Store` posts active locked mappings through `/api/admin/store-groups`.

## Blocker

The live WhatsApp verification could not be completed from this environment:

- A process already owns dashboard port `3210`.
- That running process is not the patched code path for `/api/admin/whatsapp-groups`.
- I cannot send an inbound WhatsApp group message as a human participant from this terminal.

## Required Manual Closure

Run the patched gateway as the active process, then:

1. Open the dashboard.
2. Scan QR if needed.
3. Click `Refresh Groups`.
4. Confirm `LD Agent-Log` appears.
5. Map it to `Test`, with `locked=true` and `active=true`.
6. Send `/ldagent` inside `LD Agent-Log`.
7. Confirm the bot reply contains `Store: Test`.

## Result

BLOCKED pending live WhatsApp group discovery and inbound `/ldagent` message verification.
