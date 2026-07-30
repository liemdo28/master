---
name: executive-audit
version: 1.0.0
description: Read-only executive audit of runtime, services, incidents, and evidence.
capabilities:
  - service_health_read
  - pm2_read
  - evidence_read
  - report_generate
requires:
  env:
    - OLLAMA_BASE_URL
  binaries:
    - pm2
policy:
  mode: read-only
  allowed_connectors:
    - mi-core
    - pm2
    - evidence-store
  denied_actions:
    - write_production_config
    - restart_all_services
    - install_packages
---

# Executive Audit Skill

Use this skill when the CEO asks broad operational questions such as:
- Are we okay?
- What should I focus on?
- Audit the Dashboard.
- Anything worrying today?

## Procedure

1. Start with health and incident evidence
2. Gather timestamped evidence from all services
3. Rank findings by impact
4. Surface assumptions and confidence levels
5. Generate executive brief

## Rules

- Always claim "healthy" only with evidence newer than 15 minutes
- Never fabricate service status — check real endpoints
- Include timestamp on every claim
- If evidence is stale, say so explicitly
