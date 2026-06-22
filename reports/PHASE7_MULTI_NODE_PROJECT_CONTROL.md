# Phase 7 — Multi-Node Project Control + Leader Lock

**Status:** COMPLETE  
**Date:** 2026-06-11

## Deliverables

| File | Purpose |
|------|---------|
| `server/src/nodes/project-registry.ts` | Track which projects run on which nodes with roles |
| `server/src/nodes/leader-lock.ts` | Integration-system leader lock; heartbeat; failover detection |

## Leader Lock Design

```
integration-system:
  laptop1 → ACTIVE (can write to production)
  laptop2 → PASSIVE/STANDBY (read-only)

Only one node may hold the active lock at a time.
Promotion/demotion requires L3 CEO approval (double approval).
```

## Dangerous Actions (L3 — double WhatsApp approval required)
- Promote passive node to active
- Demote active node
- Stop active integration-system
- git push to production from any node
- Deploy to production

## Heartbeat & Failover
- Leader must heartbeat every 5 minutes via `POST /api/nodes/:id/heartbeat`
- If missed for 5+ minutes → `checkLeaderHealth()` returns `auto_failover: true`
- Jarvis monitors this via risk engine and alerts CEO
- CEO must manually approve promotion of new leader

## WhatsApp Commands
- `/mi nodes` — show all nodes and leader lock status
- `/mi laptop1` — live status of laptop 1
- `/mi laptop2` — live status of laptop 2
- `/mi approve [id]` — approve promotion/demotion request
