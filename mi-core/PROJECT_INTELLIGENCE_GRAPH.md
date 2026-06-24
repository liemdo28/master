# PROJECT_INTELLIGENCE_GRAPH

Generated: 2026-06-13
Owner: Dev2

## Purpose

Project Intelligence Graph gives Dev3 an operational relationship map:

```text
Project
-> Repository
-> Services
-> Dependencies
-> Known Risks
-> Owners
-> Reports
```

## API

```http
GET /api/projects/intelligence
GET /api/projects/intelligence?project=dashboard
```

## Seeded Critical Projects

| Project | Repository / Location | Services | Dependencies | Owners |
|---|---|---|---|---|
| Dashboard | `E:/Project/Master/Bakudan/dashboard.bakudanramen.com` | Dashboard web app, connector, QA walkthroughs | Mi-Core API, Review Automation, Visibility cache | Liem Do, Dev3, QA agent |
| Mi-Core | `E:/Project/Master/mi-core` | Express API, Knowledge Universe, GStack, Jarvis | BigData, Qdrant, WhatsApp Gateway, Visibility connectors | Liem Do, Dev2, Dev3 |
| Review Automation | `E:/Project/Master/Bakudan/Agent-Coding` | Review ops proxy, workflow integrations | Laptop1, Dashboard, Agent-Coding stack | Liem Do, QA agent |
| WhatsApp AI Gateway | `E:/Project/Master/whatsapp-ai-gateway` | WhatsApp relay, CEO command router | Mi-Core, WhatsApp session, API key manager | Liem Do, Dev3 |

## Dashboard Relationship

```text
Dashboard
-> E:/Project/Master/Bakudan/dashboard.bakudanramen.com
-> Dashboard connector + QA walkthroughs
-> Mi-Core API
-> Visibility cache
-> Review Automation dependency
-> Dashboard connector sync and QA reports
```

## Runtime Sources

The graph combines:

| Source | Role |
|---|---|
| Project scanner | Current project path, framework, branch, dirty status |
| Knowledge graph | Existing project/store/node relationships |
| Knowledge search | Audit, deployment, QA, blocker evidence |
| Operational seed | Stable critical project relationships |

## Dev3 Usage

Use this API before routing project-specific commands. It prevents Dev3 from executing against an unknown repo, missing dependency, or stale project location.
