# WHATSAPP ROUTING COLLISION FINAL REPORT
> Phase 21.6 CEO Directive P0 | Generated: 2026-06-22

## Executive Summary

**Incident:** P0 — CEO Channel Failure
**Observed:** Single CEO message produced TWO responses:
1. "Mi is not available on this bot."
2. Marketing preview image.

**Root Cause:** Multiple handlers processed the same WhatsApp message without ownership arbitration. No single owner was enforced. Both food_safety and marketing_preview handlers sent replies independently.

**Status:** WHATSAPP_ROUTING_NOT_CERTIFIED

---

## Incident Timeline

| Time | Event |
|------|-------|
| CEO sends "nay anh có task gì" | Message received by gateway |
| Handler A processes message | No active session → "Mi is not available..." sent |
| Handler B processes same message | Marketing session → preview image sent |
| CEO receives TWO replies | COLLISION CONFIRMED |

---

## Root Cause Analysis

**The problem is architectural, not a single bug.**

Multiple code paths can respond to the same message:

1. `handleTextMessage()` (line 539+) — checks for sessions, falls through to AI reply
2. `operating-model-router.js` — separate routing path for images and text
3. `templateOcrWorkflow` — active session handler
4. `formPhotoWorkflow` — active session handler
5. Each workflow calls `replyService.send()` directly

**No single owner enforcement.** Each handler independently decides to reply.

---

## What's Been Built

### New Infrastructure (Phase 21.6)

| File | Purpose | Status |
|------|---------|--------|
| `whatsapp-ownership-router.ts` | Unified TypeScript router | ✅ CREATED |
| `routing/message-dedup-store.js` | 24h TTL dedup store | ✅ EXISTS |
| `routing/message-router-owner.js` | Existing JS router | ✅ EXISTS |
| `WHATSAPP_ROUTING_INVENTORY.md` | Full handler audit | ✅ CREATED |
| `WHATSAPP_OWNERSHIP_ROUTER.md` | Router spec | ✅ CREATED |
| `WHATSAPP_DEDUP_CERTIFICATION.md` | Dedup certification | ✅ CREATED |
| `WHATSAPP_SESSION_ISOLATION.md` | Session isolation | ✅ CREATED |
| `WHATSAPP_ROUTING_TRACE.md` | Trace spec | ✅ CREATED |
| `WHATSAPP_ROUTING_REAL_WORLD_TEST.md` | Test plan | ✅ CREATED |

---

## What's Still Required

### Critical (blocks certification)

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Add dedup.claim() to handleImageMessage() | DEV | PENDING |
| 2 | Install outbound send guard on all client instances | DEV | PENDING |
| 3 | Register mi_core handler in new router | DEV | PENDING |
| 4 | Register food_safety handler in new router | DEV | PENDING |
| 5 | Wire new router into message-listener.js | DEV | PENDING |
| 6 | Remove direct replyService.send() from handlers | DEV | PENDING |
| 7 | Run real-world WhatsApp tests | OPERATOR | PENDING |
| 8 | Validate routing-trace.jsonl shows 0 collisions | OPERATOR | PENDING |

### Marketing Preview (not implemented)
No marketing_preview session or handler exists in the codebase. This owner type needs implementation before it can be certified.

---

## Certification Gate

| Criterion | Current | Required |
|-----------|---------|----------|
| Real WhatsApp test: "Mi ơi" → 1 response | ❌ NOT RUN | ✅ |
| Real WhatsApp test: CEO message → 0 collisions | ❌ NOT RUN | ✅ |
| routing-trace.jsonl: 0 duplicate message_ids | ❌ NOT RUN | ✅ |
| marketing_preview owner implemented | ❌ MISSING | ✅ |
| Direct sends removed from all handlers | ❌ INCOMPLETE | ✅ |

**Certification Status:** WHATSAPP_ROUTING_NOT_CERTIFIED

**Path to Certification:**
1. Implement items 1-6 above
2. Deploy to production
3. Run Tests 1-8 from WHATSAPP_ROUTING_REAL_WORLD_TEST.md
4. Validate routing-trace.jsonl shows zero collisions
5. Mark: WHATSAPP_ROUTING_COLLISION_FIXED

---

## Appended Evidence

The full handler audit is in `WHATSAPP_ROUTING_INVENTORY.md`.
The router spec is in `WHATSAPP_OWNERSHIP_ROUTER.md`.
The dedup store is at `services/whatsapp-ai-gateway/src/routing/message-dedup-store.js`.
The new router is at `services/whatsapp-ai-gateway/src/routing/whatsapp-ownership-router.ts`.
