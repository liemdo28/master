# Technology Open Source Evaluation

Status: PARTIAL

Governance rule: candidates below are not approved for install or pilot until Phase 0.5 records license verification, security review, maintenance score, owner division, rollback plan, and approval.

| category | candidates | initial_decision |
|---|---|---|
| Asset management | Snipe-IT, GLPI, NetBox, Ralph | DISCOVERY |
| Monitoring/observability | Uptime Kuma, Grafana, Prometheus, Netdata, OpenObserve | AUDIT |
| Secrets/passwords | Vault, Bitwarden, Infisical | SECURITY_REVIEW_REQUIRED |
| Project management | Plane, OpenProject, Focalboard | DISCOVERY |
| Workflow automation | n8n, Activepieces, Windmill, Node-RED, Temporal, Prefect, Dagster, Airflow, Kestra | AUDIT |

Recommendation:
- Do not add new tools until the current Mi source-of-truth and workflow dedup gates are merged.
- Treat n8n as current workflow surface, not a general permission bypass.
- Treat secrets tools as SECURITY risk until owner and rollback plan are approved.
