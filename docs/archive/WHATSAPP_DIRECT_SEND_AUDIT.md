# WhatsApp Direct Send Audit

## Ownership Response Contract

All handlers MUST return a routing result. Only the central router (`message-listener.js`) sends WhatsApp messages.

```ts
{
  owner: 'mi_core' | 'food_safety' | 'marketing_preview' | 'team_support' | 'unknown',
  confidence: number,
  shouldSend: boolean,
  responseType: 'text' | 'image' | 'none',
  text?: string,
  imagePath?: string,
  reason: string
}
```

## Direct Send Paths Audit

| Send Path | File | Lines | Still Allowed | Notes |
|---|---|---|---|---|
| `replyService.send()` | `message-listener.js` | 732, 750, 758, 781, 787, 820, 841, 869, 938, 951, 976 | YES | Central router only |
| `sendMediaFile()` | `message-listener.js` | 191 (inside sendMiForwardResult) | YES | Central router only |
| Food Safety pipeline | `message-listener.js` | 516-533 | YES | Image workflow owner |
| Template OCR | `message-listener.js` | 498-509 | YES | Active session owner |
| Form Photo Workflow | `message-listener.js` | 474-485 | YES | Active session owner |

## Fixed Collision Points

### Collision 1: isNoPrefix → non-CEO → fallthrough → GREETING
**Status**: FIXED ✅
**File**: `message-listener.js` line ~838
**Before**: `if (!isAdmin) { log.info(...); }` (no return → falls through to GREETING)
**After**: `if (!isAdmin) { log.info(...); return; }` (explicit silent drop)

### Collision 2: isNoPrefix → CEO → forwardToMi fails → error reply sent as fallback
**Status**: FIXED ✅
**File**: `message-listener.js` line ~865
**Before**: `if (!sent && !forwardResult.ok) { log.warn(...); }` (error reply used as fallback)
**After**: `if (forwardResult.ok && forwardResult.reply && !sent) { log.info(...); } else if (!forwardResult.ok) { log.warn(...); }` (no fallback sent)

### Collision 3: CEO → NLP GREETING → generic greeting for CEO
**Status**: FIXED ✅
**File**: `message-listener.js` line ~877
**Added**: CEO sender guard before GREETING block:
```js
if (miAccess.isCeoSender(phone)) {
  log.info('[MESSAGE_FLOW] ceo_sender_blocked_from_generic_ai', { ...runtimeTraceBase, route: 'ceo_generic_ai_blocked' });
  return; // CEO always routes to Mi. Never use generic AI or greeting.
}
```

## Verified: No Direct Handler Replies
- Food Safety pipeline: Returns `{ handled, reply }` to central router, router sends
- Template OCR: Returns `{ handled, reply }` to central router, router sends  
- Form Photo: Returns `{ handled, reply }` to central router, router sends
- mi-ceo-observer: Read-only, NEVER sends
