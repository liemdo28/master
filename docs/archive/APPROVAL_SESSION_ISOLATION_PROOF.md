# Approval Session Isolation Proof — Phase 21.7

## Date: 2026-06-22

---

## Problem

CEO sends "lại nữa" → receives approval checklist instead of Mi-Core response.

## Root Cause

When no active session matched, the message fell through to the approval gate
which checked `getPending()` and returned a list of pending approvals.

## Fix Applied

### 1. CEO Priority Lock (message-listener.js)

CEO messages now claim `mi_core` owner via `centralSessionManager.setSession()`.
This closes any other active owner (food_safety, marketing_preview, approval).

### 2. CEO Generic AI Block

After the no-prefix handler, CEO senders hit:
```js
if (miAccess.isCeoSender(phone)) {
  return; // CEO always routes to Mi. Never use generic AI or greeting.
}
```

This blocks ALL non-Mi-Core responses for CEO.

### 3. Owner Lock Enforcement

The `assertOwner()` API prevents any handler from responding if a different
owner is already active for that chat+sender.

## Isolation Rules

| Message | Active Owner | Result |
|---------|-------------|--------|
| "lại nữa" from CEO | mi_core (locked) | Mi-Core contextual response |
| "approve APP-123" from CEO | approval (explicit) | Only if approval session active |
| "task anh hôm nay có gì" from CEO | mi_core (locked) | Task response via Mi-Core |

## No Approval Checklist Unless Explicit

Approval checklist only appears when:
1. An approval workflow was explicitly started by Mi-Core
2. The message contains approval keywords AND an active approval session exists
3. The sender is responding to an approval request from Mi-Core

For CEO casual messages like "lại nữa", none of these conditions are met.
