# AGENT_TEAM_REGISTRY.md — Multi-Agent Team Registry

**Generated:** 2026-06-27
**Purpose:** Register all agent teams, roles, and capabilities for multi-agent coordination

---

## Agent Team Architecture

```
MI EXECUTIVE ORCHESTRATOR
         │
         ├── Finance Team
         │     ├── Financial Agent (AGENT-FIN-001)
         │     └── Data Analyst Agent (AGENT-FIN-002)
         │
         ├── Marketing Team
         │     ├── Marketing Agent (AGENT-MKT-001)
         │     ├── SEO Agent (AGENT-MKT-002)
         │     └── Creative Agent (AGENT-CRE-001)
         │
         ├── Operations Team
         │     ├── DoorDash Operator (AGENT-OPS-001)
         │     ├── WhatsApp Router (AGENT-OPS-002)
         │     └── IT Agent (AGENT-IT-001)
         │
         └── Human Approvers
               ├── CEO (EMP-001)
               └── Store Manager (EMP-002)
```

---

## Agent Registry

| Agent ID | Name | Division | Role | Status | Capabilities |
|----------|------|----------|------|--------|-------------|
| AGENT-FIN-001 | Financial Agent | Finance | Revenue tracking, store ranking, QB sync | ACTIVE | DuckDB, dbt, Metabase |
| AGENT-FIN-002 | Data Analyst Agent | Finance | Ad-hoc analysis, CFO questions | ACTIVE | DuckDB, SQL |
| AGENT-MKT-001 | Marketing Agent | Marketing | Campaign management, content planning | ACTIVE | PostHog, n8n |
| AGENT-MKT-002 | SEO Agent | Marketing | SEO optimization, GSC analysis | ACTIVE | Playwright, n8n |
| AGENT-CRE-001 | Creative Agent | Creative | Image generation, video processing | ACTIVE | ComfyUI, FFmpeg |
| AGENT-OPS-001 | DoorDash Operator | Operations | DoorDash menu, campaigns, monitoring | ACTIVE | Playwright, n8n |
| AGENT-OPS-002 | WhatsApp Router | Operations | Message routing, department assignment | ACTIVE | WhatsApp MCP |
| AGENT-IT-001 | IT Agent | IT | Monitoring, backup, credential management | ACTIVE | OpenObserve, Uptime Kuma |

---

## Team Composition for Raw Sushi Revenue Objective

### Team: Raw Sushi Online Revenue Improvement

| Role | Agent | Responsibility | Handoff To |
|------|-------|---------------|------------|
| Finance Lead | AGENT-FIN-001 | Revenue analysis, DoorDash performance | Marketing Lead |
| Marketing Lead | AGENT-MKT-001 | Campaign optimization, budget allocation | Creative Lead |
| SEO Specialist | AGENT-MKT-002 | Organic traffic improvement | Marketing Lead |
| DoorDash Operator | AGENT-OPS-001 | DoorDash menu and campaign management | Marketing Lead |
| Creative Lead | AGENT-CRE-001 | Campaign creative assets | Human Approver |
| Human Approver | CEO (EMP-001) | Final approval for budget and public changes | — |

---

## Agent Communication Protocol

```
Standard Message Format:
{
  "from": "AGENT-ID",
  "to": "AGENT-ID | HUMAN",
  "type": "REQUEST | RESPONSE | HANDOFF | ALERT",
  "objective_id": "UUID",
  "payload": {...},
  "evidence": ["list of evidence refs"],
  "approval_required": boolean,
  "timestamp": "ISO8601"
}
```

---

## Status: ✅ AGENT_TEAM_REGISTRY_COMPLETE

All agent teams registered with roles, capabilities, and handoff protocols.
