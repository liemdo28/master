# OSS Reality Audit

Generated: 2026-06-27T03:30:00Z

Audit result: `COMPLETE_WITH_ACTIONS`

## Selected OSS Reality Matrix

| Area | Tool | Installed | Used | Owner | Business Value | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| Engineering | Qwen Coder | No command found | Referenced/evaluated | Engineering | Coding model candidate | Pilot only |
| Engineering | DeepSeek | No command found | Referenced/evaluated | Engineering | Coding model candidate | Pilot only |
| Engineering | Kimi | No command found | Referenced/evaluated | Engineering | Coding model candidate | Pilot only |
| Operator | Playwright | Yes | DoorDash/operator evidence path | Operator | Browser automation | Production support with approval gates |
| Operator | Browser Use | Yes | Operator experiments | Operator | Browser fallback | Pilot |
| Operator | OpenClaw | No command found | Not proven | Operator | Browser/computer control candidate | Retire until installed |
| Workflow | n8n | Yes | `mi-n8n` PM2 process and execution bus | Workflow Fabric | Workflow automation | Production support |
| Workflow | Temporal | No command found | Not proven | Workflow Fabric | Durable workflow candidate | Pilot backlog |
| Data | DuckDB | No command found | Not proven | Data Platform | Local analytics | Pilot backlog |
| Data | dbt | No command found | Not proven | Data Platform | Transform governance | Pilot backlog |
| Data | Metabase | No command found | Not proven | Data Platform | BI dashboard | Pilot backlog |
| Marketing | PostHog | No command found | Not proven | Marketing | Product analytics | Pilot backlog |
| Marketing | Mautic | No command found | Not proven | Marketing | Marketing automation | Pilot backlog |
| Marketing | Postiz | No command found | Not proven | Marketing | Social scheduling | Pilot backlog |
| Creative | FFmpeg | No command found | Not proven | Creative | Media processing | Install if needed |
| Creative | Penpot | No command found | Not proven | Creative | Design collaboration | Pilot backlog |
| Creative | ComfyUI | No command found | Not proven | Creative | Image generation workflow | Pilot backlog |
| IT | Uptime Kuma | No command found | Not proven | IT | Monitoring | Pilot backlog |
| IT | Kopia | No command found | Not proven | IT | Backup | Pilot backlog |
| IT | OpenObserve | No command found | Not proven | IT | Logs/observability | Pilot backlog |

## Production Rules

- Installed does not mean production.
- Referenced does not mean used.
- Pilot tools must not be counted as operational capabilities.
- Production tools need owner, health, runbook, and evidence.

## Decision

OSS audit is complete, but most selected OSS remains pilot/backlog. Only Playwright and n8n have current local production-support evidence.
