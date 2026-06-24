# WhatsApp Session Context Audit — Phase 21.7

## Date: 2026-06-22

---

## Global Stores Found

| File | Variable/Store | Workflow Owner | Scope | Bug Risk | Fix Status |
|------|---------------|----------------|-------|----------|------------|
| sessions/agent-session-manager.js | `sessions` (Map) | ldagent/broth | chatId | LOW — legacy, still used for /ldagent sessions | COEXIST — kept as-is, new central manager owns cross-workflow |
| food-safety-gateway/session/SessionStore.js | `_sessions` (Map) | food_safety | chatId | MEDIUM — no CEO sender check | PARTIAL — now blocked at message-listener level |
| routing/message-router-owner.js | `dedupStore` | gateway_router | messageId | LOW — already handles dedup | COEXIST |
| routing/message-dedup-store.js | `_store` (Map) | gateway_router | messageId | LOW — 24h TTL | COEXIST |
| whatsapp/message-listener.js | `responseLocks` (Map) | mi_core | msg key | MEDIUM — stale locks cause lost responses | COEXIST — sendGuard adds second layer |
| whatsapp/message-listener.js | `recentMiSuccesses` (Map) | mi_core | chat+text | LOW — stale guard | COEXIST |
| whatsapp/message-listener.js | `latestInboundByChat` (Map) | mi_core | chatId | LOW — stale message suppression | COEXIST |
| **NEW: sessions/whatsapp-session-manager.js** | `_sessions` (Map) | ALL | chatId::senderPhone | N/A — new central manager | IMPLEMENTED |

## Contamination Sources Identified

### Source 1: No owner exclusivity
- Multiple handlers could respond to the same inbound message
- Food safety, marketing, approval all ran in parallel
- **FIX**: `centralSessionManager.setSession()` claims owner exclusively

### Source 2: Food Safety responding in CEO direct chat
- `handleImageMessage` had no CEO sender check
- "Mi is not available on this bot" text appeared from food-safety gateway
- **FIX**: `handleImageMessage` now checks `miAccess.isCeoSender(sender)` before processing

### Source 3: Marketing preview images sent alongside task responses
- `sendMiForwardResult` sent both text AND image for same message
- No single-send enforcement
- **FIX**: `sendGuard.beginMessage()` enforces one-send-per-message

### Source 4: Approval checklist appearing for CEO casual messages
- "lại nữa" matched no active session, fell through to approval check
- **FIX**: CEO no-prefix path now claims mi_core owner, closing other sessions
