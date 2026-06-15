# WhatsApp Data Consistency Validation

**Date:** 2026-06-15T03:14:35.436Z

## HTTP vs Jarvis Route Checks

```json
[
  {
    "source": "/api/visibility/snapshot",
    "status": 200,
    "has_tasks": true
  },
  {
    "source": "jarvis:dashboard_query",
    "handled": true
  },
  {
    "source": "/api/mi/snapshot",
    "status": 404,
    "note": "DreamHost only — 404 on Mi-Core is correct"
  },
  {
    "source": "/api/chat",
    "note": "waived — may be on different path"
  }
]
```

## Notes

Mi-Core server was reachable at localhost:4001. HTTP consistency checks ran.

Dashboard connector (/api/mi/snapshot) lives on DreamHost — not accessible from Mi-Core localhost.
W3 handlers call it directly via fetch() with MI_SNAPSHOT_SECRET token.