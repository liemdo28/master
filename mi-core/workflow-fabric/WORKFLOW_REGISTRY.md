# Workflow Registry

Status: READY
Machine registry: `Mi/n8n/config/workflow-registry.json`
Human registry: `Mi/n8n/N8N_WORKFLOW_REGISTRY.md`

## Required Fields

`workflow_id`, `workflow_name`, `project`, `division`, `owner`, `trigger`, `schedule`, `risk`, `approval_required`, `status`, `last_run`, `next_run`

## Registered Machine Workflows

| workflow_id | project | division | trigger | schedule | approval_required | status |
|---|---|---|---|---|---|---|
| `mi-system-health-check` | system | engineering | schedule | `*/5 * * * *` | false | ACTIVE |
| `seo-daily-audit` | seo | marketing | schedule | `0 7 * * *` | true | ACTIVE |
| `seo-weekly-executive-report` | seo | marketing | schedule | `0 9 * * 1` | false | ACTIVE |
| `review-monitoring` | reviews | marketing | schedule | `0 * * * *` | true | ACTIVE |
| `food-safety-daily-reminder` | food-safety | operations | schedule | `0 6 * * *` | true | ACTIVE |
| `quickbooks-daily-sync` | quickbooks | finance | schedule | `0 5 * * *` | false | ACTIVE |
| `doordash-weekly-campaign-review` | doordash | marketing | schedule | `0 10 * * 1` | true | ACTIVE |

## Documented Workflows Not Yet Machine-Registered

None. The 15 previously documented-only workflows are now registered in `Mi/n8n/config/workflow-registry.json`.

Current machine registry total: 22 workflows.
