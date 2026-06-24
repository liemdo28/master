---
name: incident-review
version: 1.0.0
description: Review and classify active incidents, assess impact, recommend response.
capabilities:
  - incident_read
  - pm2_read
  - evidence_read
  - report_generate
requires:
  env:
    - OLLAMA_BASE_URL
policy:
  mode: read-only
  allowed_connectors:
    - mi-core
    - pm2
    - evidence-store
  denied_actions:
    - restart_services
    - modify_config
---

# Incident Review Skill

Use this skill when the CEO asks about incidents or problems:
- What happened overnight?
- Review the incident
- What's broken right now?

## Procedure

1. Pull active incidents from executive memory
2. Check PM2 restart counts and error logs
3. Classify severity and business impact
4. Identify root cause patterns
5. Recommend immediate actions
