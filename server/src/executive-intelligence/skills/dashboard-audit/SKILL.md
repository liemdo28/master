---
name: dashboard-audit
version: 1.0.0
description: Audit dashboard routes, health coverage, and UI consistency.
capabilities:
  - route_read
  - health_read
  - report_generate
requires:
  env:
    - OLLAMA_BASE_URL
policy:
  mode: read-only
  allowed_connectors:
    - mi-core
    - dashboard
  denied_actions:
    - modify_routes
    - deploy_changes
---

# Dashboard Audit Skill

Use this skill when the CEO asks about the dashboard:
- Audit the Dashboard.
- Are all routes working?
- Dashboard health check.

## Procedure

1. Enumerate all registered dashboard routes
2. Check health endpoint coverage
3. Verify static assets are served correctly
4. Test WebSocket connectivity
5. Report coverage gaps
