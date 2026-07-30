# JARVIS OMEGA ACCEPTANCE TEST

Recorded: 2026-06-13
Status: CERTIFICATION_CRITERIA_RECORDED

## Test Prompt

```text
Mi, dieu gi la quan trong nhat hom nay?
```

## Required Response Domains

Mi must answer from live operational data across:

| Domain | Required Evidence |
|---|---|
| Health | CEO health, sleep, HRV, heart rate, or current health signals when available |
| Business | Revenue, labor, profit, store health, reviews, or finance signals |
| Projects | Work Orders, project risks, blockers, owners, dependencies |
| Risks | P0/P1 risks, operational degradation, anomalies, critical path issues |
| Approvals | Pending approval queue and urgency |
| Forecasts | Predicted failures, improvements, revenue/labor/review/infrastructure outlook |
| Recommendations | Prioritized next actions for CEO |

## Acceptance Rule

The answer must be:

- Current
- Source-backed
- Prioritized
- Executive concise
- Actionable

## Failure Conditions

The acceptance test fails if Mi:

- Gives generic motivational advice only
- Omits risk or approval state
- Does not include live operational data
- Cannot distinguish health, business, project, and forecast domains
- Recommends action without evidence or approval awareness

## Certification Target

```text
JARVIS_OMEGA_CERTIFIED
```
