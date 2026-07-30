---
name: connectivity-review
version: 1.0.0
description: Review QuickBooks, Toast, DoorDash connector health and freshness.
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
  denied_actions:
    - modify_api_keys
    - write_financial_data
---

# Connectivity Review Skill

Use this skill when the CEO asks about business connectivity:
- How's the finance connectivity?
- Is QuickBooks connected?
- Can we read from Toast?

## Procedure

1. Probe each connector health endpoint
2. Check last successful data read timestamp
3. Verify OAuth tokens / API keys are valid
4. Identify which connectors are stale or broken
5. Prioritize fixes by business impact
