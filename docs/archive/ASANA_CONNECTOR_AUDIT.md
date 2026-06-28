# ASANA CONNECTOR AUDIT

Status: PASS
Target: DASHBOARD_RUNTIME_STATE_CERTIFIED
Generated: 2026-06-14

## Scope

Replace dashboard `Asana: unknown` with a real connector state based on runtime/cache evidence.

## Connector State

Current dashboard endpoint:

```text
GET /api/visibility/connectors
```

Current Asana summary:

```json
{
  "id": "asana",
  "auth": "connected",
  "health": "healthy",
  "last_sync": "2026-06-14T15:21:28.052Z"
}
```

## Cache Evidence

Asana cache path:

```text
E:\Project\Master\.local-agent-global\visibility\asana
```

Summary:

```json
{
  "my_tasks": 855,
  "overdue": 67,
  "projects": 7,
  "synced_at": "2026-06-14T15:21:28.052Z"
}
```

Errors:

```json
[]
```

## Audit Findings

- Connected: yes
- Authenticated: yes
- Syncing: yes, cache updated 2026-06-14
- Stale: no
- Offline: no
- Dashboard state: healthy

## Fix Applied

`connector-registry.getSummary()` now derives effective connector health from real cache evidence when registry state is still `unknown`.

Rules:

- Connected + cache exists + no errors: `healthy`
- Connected + cache exists + errors: `degraded`
- Connected + last sync but no cache visible: `healthy`
- Not connected: `offline`

This prevents dashboard `unknown` from appearing when real connector evidence exists.

## Acceptance Result

PASS.

Dashboard now shows Asana as `healthy` instead of `unknown`.

