# Phase 4 — Mi Jarvis Lite

**Status:** COMPLETE  
**Date:** 2026-06-11

## Deliverables

| File | Purpose |
|------|---------|
| `server/src/jarvis/ceo-preference-store.ts` | JSON-backed preferences: language, alert_level, mutes, watches |
| `server/src/jarvis/risk-engine.ts` | Live risk evaluation across BigData, WhatsApp, connectors, nodes |
| `server/src/jarvis/suggestion-engine.ts` | Generate actionable suggestions from risk signals |
| `server/src/jarvis/proactive-monitor.ts` | Periodic risk checks; fires alerts via callback; respects mutes |
| `server/src/jarvis/approval-conversation.ts` | WhatsApp approval dialog manager with 30-min TTL |
| `server/src/jarvis/autonomous-task-runner.ts` | Execute L1/approved tasks; command allowlist; full audit log |
| `server/src/routes/jarvis.ts` | 14 endpoints: risk, monitor, alerts, suggestions, approvals, prefs |

## Alert Flow
```
Monitor cycle → evaluateSystemRisk() → generateSuggestions() 
→ fire alert → onAlert callback → WebSocket broadcast + WhatsApp (if critical)
```

## Integration
- Jarvis monitor starts with Mi-Core server (configurable interval via JARVIS_MONITOR_INTERVAL_MIN)
- Alerts broadcast via WebSocket (`jarvis_alert` event)
- CEO controls: `/mi mute warning 4` or `/mi approve [id]`
