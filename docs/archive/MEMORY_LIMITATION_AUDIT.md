# MEMORY LIMITATION AUDIT

**Date:** 2026-06-15
**Target:** Conversation Memory limitations

## Memory Systems Found

### 1. Chat Sessions (`server/src/routes/chat.ts`)

```typescript
const sessions = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();
```

| Property | Value | Evidence |
|----------|-------|---------|
| **Storage** | In-memory `Map` | `chat.ts` line 25 |
| **TTL** | **NONE** | No expiry logic found. Sessions grow indefinitely. |
| **Entity Count** | **Unbounded** | No max entries. Array grows with every message. |
| **Session Persistence** | **Dies on restart** | No file/DB write. PM2 restart = all chat history lost. |

### 2. Auth Sessions (`server/src/routes/auth.ts`)

```typescript
const sessions = new Set<string>();
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours
```

| Property | Value | Evidence |
|----------|-------|---------|
| **Storage** | In-memory `Set` | `auth.ts` line 15-16 |
| **TTL** | 8 hours | `setTimeout(() => sessions.delete(token), SESSION_TTL)` |
| **Entity Count** | Unbounded (but tokens are 64-char hex) | |
| **Session Persistence** | **Dies on restart** | All users logged out on PM2 restart. |

### 3. Executive Memory V2 (`server/src/memory/executive-memory.ts`)

```typescript
const FILES = {
  owner_profile: path.join(MEM_DIR, 'owner_profile.json'),
  preferences: path.join(MEM_DIR, 'preferences.json'),
  business: path.join(MEM_DIR, 'business_memory.json'),
  // ...
};
```

| Property | Value | Evidence |
|----------|-------|---------|
| **Storage** | File-based JSON | `.local-agent-global/executive-memory-v2/` |
| **TTL** | **NONE** | Files persist indefinitely. No cleanup. |
| **Entity Count** | Unbounded (JSON files grow) | |
| **Session Persistence** | **Survives restart** ✅ | File-based, loaded on boot. |

### 4. Context Memory (`server/src/intelligence/context-memory.ts`)

```typescript
const MEM_DIR = path.join(GLOBAL_DIR, 'connectors', 'whatsapp', 'context-memory');
```

| Property | Value | Evidence |
|----------|-------|---------|
| **Storage** | File-based JSON | `group_history.json`, `participants.json` |
| **TTL** | **NONE** | No expiry or cleanup logic. |
| **Entity Count** | Unbounded | |
| **Session Persistence** | **Survives restart** ✅ | |

### 5. AI Memory System (`agent-engine/ai-memory/AIMemorySystem.js`)

```javascript
const MEMORY_DIR = '/Users/liemdo/.super-agent-ai/memory';
this.semantic = new Map();  // In-memory
```

| Property | Value | Evidence |
|----------|-------|---------|
| **Storage** | In-memory Map + file backup | Reads/writes to disk but loads into Map |
| **TTL** | **NONE** | No expiry logic. `accessCount` tracked but not used for cleanup. |
| **Entity Count** | Unbounded | |
| **Session Persistence** | **Partially survives restart** | File backup exists but hardcoded path. |

## Measured TTL

| Memory System | TTL | Cleanup |
|--------------|-----|---------|
| Chat sessions | **NONE** | Never cleaned up. Memory leak risk. |
| Auth sessions | **8 hours** | `setTimeout` based, lost on restart |
| Executive memory | **NONE** | Indefinite |
| Context memory | **NONE** | Indefinite |
| AI memory | **NONE** | Indefinite |

## Measured Entity Count

| System | Limit | Risk |
|--------|-------|------|
| Chat sessions | **Unbounded** | OOM if many concurrent sessions |
| Auth tokens | **Unbounded** | Low risk (tokens are small) |
| Executive memory JSON | **Unbounded** | Disk growth, slow reads |
| Context memory JSON | **Unbounded** | Disk growth |

## Session Persistence Summary

| System | Survives Process Restart? | Survives PM2 Restart? | Survives Reboot? |
|--------|--------------------------|----------------------|-----------------|
| Chat sessions | ❌ No | ❌ No | ❌ No |
| Auth sessions | ❌ No | ❌ No | ❌ No |
| Executive memory | ✅ Yes (file) | ✅ Yes (file) | ✅ Yes (file) |
| Context memory | ✅ Yes (file) | ✅ Yes (file) | ✅ Yes (file) |

## Key Limitation

**Chat history is ephemeral.** The CEO's conversation history with Mi is stored only in memory. After any restart, PM2 restart, or crash, all conversation context is lost. This means:
- Multi-turn conversations break after restart
- Follow-up references ("that thing we discussed") fail
- Entity carryover between sessions is impossible

## Verdict: CONFIRMED

Conversation Memory has severe limitations:
- Chat sessions: **No TTL, no persistence, no entity limits** (memory leak risk)
- Auth sessions: 8-hour TTL but **not persisted** (lost on restart)
- Only executive memory and context memory survive restarts (file-based)
