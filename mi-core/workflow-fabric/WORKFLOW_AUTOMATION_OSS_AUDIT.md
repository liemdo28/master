# Workflow Automation OSS Audit

Status: READY

Governance rule: every OSS candidate is `LICENSE_UNVERIFIED` until Phase 0.5 license verification records evidence. No install, pilot, or promotion is allowed without security review, maintenance score, business value, technical fit, owner division, rollback plan, and approval.

| candidate | use_case | owner_division | business_fit | technical_fit | risk | lifecycle_status |
|---|---|---|---:|---:|---|---|
| n8n | visual automation fabric | Engineering | 95 | 90 | medium | AUDIT |
| Activepieces | alternative workflow automation | Engineering | 80 | 76 | unknown | DISCOVERY |
| Windmill | script/workflow runner | Engineering | 82 | 82 | unknown | DISCOVERY |
| Node-RED | event/IoT-style flow orchestration | Engineering | 70 | 74 | medium | DISCOVERY |
| Temporal | durable workflow engine | Engineering | 78 | 88 | medium | DISCOVERY |
| Prefect | data workflow orchestration | Data/Finance | 74 | 78 | unknown | DISCOVERY |
| Dagster | data asset orchestration | Data/Finance | 74 | 78 | unknown | DISCOVERY |
| Airflow | batch/data DAG orchestration | Data/Finance | 72 | 76 | medium | DISCOVERY |
| Kestra | declarative workflow orchestration | Engineering | 76 | 80 | unknown | DISCOVERY |

Recommendation:
- Keep n8n as current control surface, but govern it through Mi workflow-fabric.
- Do not add a second automation engine until dedup, registry, ownership, and evidence are enforced.
- Temporal/Kestra/Windmill can be reevaluated only after Phase 0.7 reaches READY.
