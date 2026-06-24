---
name: business-triage
version: 1.0.0
description: Triage finance connectivity issues across QuickBooks, Toast, and DoorDash.
capabilities:
  - connector_health_read
  - finance_data_read
  - report_generate
requires:
  env:
    - OLLAMA_BASE_URL
policy:
  mode: read-only
  allowed_connectors:
    - quickbooks
    - toast
    - doordash
    - mi-core
  denied_actions:
    - write_financial_data
    - modify_quickbooks
    - modify_toast
---

# Business Triage Skill

Use this skill when the CEO asks about finance connectivity:
- How are our finance connections?
- Can we trust the numbers?
- What's blocking payroll/tax readiness?

## Procedure

1. Check each finance connector health (QBO, QBD bridge, Toast, DoorDash)
2. Verify data freshness — when was last successful read?
3. Identify missing credentials or stale connections
4. Rank blockers by business impact
5. Produce triage brief with concrete next steps
