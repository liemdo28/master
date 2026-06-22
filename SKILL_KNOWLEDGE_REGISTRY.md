# SKILL_KNOWLEDGE_REGISTRY

Generated: 2026-06-13
Owner: Dev2

## Purpose

Skill Knowledge Registry maps a Work Order to the skills Dev3 should invoke.

## API

```http
GET /api/skills/recommend?input=dashboard_audit
```

## Registered Operational Skills

| Skill | Category | Use |
|---|---|---|
| Dashboard Skill | project | Dashboard connector, status, QA workflow |
| Review Skill | project | Review Automation dependency and blockers |
| GitHub Skill | source-control | Repository inspection, branch/history/PR evidence |
| QA Skill | quality | Smoke, regression, audit, connector tests |
| Report Skill | executive | CEO-ready findings and evidence |
| QuickBooks Skill | finance | Finance/accounting dependency checks |
| Health Skill | observability | Runtime health, incidents, service state |
| Gmail Skill | communication | Email-backed evidence when requested |
| Calendar Skill | schedule | Meeting/schedule context when relevant |

## Dashboard Example

Input:

```text
dashboard_audit
```

Output:

```text
Dashboard Skill
Review Skill
GitHub Skill
QA Skill
Report Skill
```

## Rule Summary

| Signal | Skills |
|---|---|
| `dashboard` | Dashboard, Review, GitHub, QA, Report |
| `review` | Review, QA, Report |
| `repo`, `code`, `source`, `fix`, `audit` | GitHub, QA, Report |
| `health`, `incident`, `runtime`, `blocker` | Health, QA, Report |
| `quickbooks`, `qb`, `payroll`, `finance` | QuickBooks, Report |
| `gmail`, `email` | Gmail, Report |
| `calendar`, `meeting`, `schedule` | Calendar, Report |
