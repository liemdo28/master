# OpenMetadata Ownership Graph
**Research Task:** DEV2 — Knowledge Universe V2  
**Date:** 2026-06-13  
**Status:** RESEARCH_COMPLETE  
**Analyst:** Mi Operating Backend

---

## 1. Purpose

Map the ownership landscape of Mi's software portfolio. Answer:
- Who owns what?
- Are there unowned projects?
- Are any owners overloaded?
- What are the blockers if the primary owner is unavailable?

---

## 2. OpenMetadata Ownership Model

OM enforces ownership at the entity level:

```
Organization
  └── Team (e.g., mi-ops, dev2, bakudan-team)
        └── User (e.g., hoang-le)
              └── owns Entity (project, service, connector)
```

**Ownership rules in OM:**
- Each entity has exactly one `owner` field (User or Team)
- Ownership is searchable: `owner:hoang-le` returns all owned entities
- Orphaned entities (no owner) are flagged in the OM UI
- Ownership transfer is via PATCH API

---

## 3. Current Mi Ownership Inventory

### Software Projects

| Project | Owner (current) | Type | Criticality |
|---------|----------------|------|-------------|
| mi-core | Hoang Le | Backend service | CRITICAL |
| whatsapp-ai-gateway | Hoang Le | Communication gateway | CRITICAL |
| antigravity-gateway | Hoang Le | API gateway | HIGH |
| bakudanramen-dashboard | Hoang Le | CEO dashboard | HIGH |
| agent-coding-api-keys | Hoang Le | AI key management | MEDIUM |
| knowledge-db | Hoang Le | Knowledge store | MEDIUM |
| visibility connectors | Hoang Le | Data connectors | MEDIUM |

### Owner Load Analysis

| Owner | Projects owned | Criticality burden |
|-------|--------------|-------------------|
| **Hoang Le** | **7 / 7 (100%)** | 2 CRITICAL + 2 HIGH + 3 MEDIUM |
| Other | 0 / 7 (0%) | — |

**Finding: 100% ownership concentration. Single point of knowledge failure.**

---

## 4. Ownership Graph (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Mi Ownership Graph                          │
└─────────────────────────────────────────────────────────────────┘

Organization: Mi Operating System
│
└── Team: mi-ops
      │
      └── User: Hoang Le [hoang.d.le@gmail.com]
            │
            ├── 🔴 CRITICAL: mi-core
            ├── 🔴 CRITICAL: whatsapp-ai-gateway
            ├── 🟠 HIGH: antigravity-gateway
            ├── 🟠 HIGH: bakudanramen-dashboard
            ├── 🟡 MEDIUM: agent-coding-api-keys
            ├── 🟡 MEDIUM: knowledge-db
            └── 🟡 MEDIUM: visibility-connectors

Team: dev2            → 0 owned projects
Team: bakudan-team    → 0 owned projects (inferred from dashboard domain)
Unowned projects      → 0 (all explicitly owned by Hoang Le)
```

---

## 5. OpenMetadata Representation

If OM were deployed, the ownership schema would be:

```json
// Team definition
{
  "name": "mi-ops",
  "displayName": "Mi Operations",
  "teamType": "Group",
  "users": ["hoang-le"]
}

// User definition
{
  "name": "hoang-le",
  "displayName": "Hoang Le",
  "email": "hoang.d.le@gmail.com",
  "teams": ["mi-ops"],
  "roles": ["DataOwner", "Admin"]
}

// Ownership on entity (example: mi-core)
PATCH /api/v1/services/mi-core
{
  "owner": { "type": "user", "name": "hoang-le" }
}
```

**OM orphan detection:**
```
GET /api/v1/services?owner=null
→ Returns: [] (no orphans — all owned by Hoang Le)
```

**OM overload detection (custom query):**
```
GET /api/v1/search/query?q=owner:hoang-le&index=service_search_index
→ Returns: 7 entities — all services owned by one user
```

---

## 6. Ownership Risk Assessment

### Risk 1: Single Owner Concentration

| Risk | Score | Impact |
|------|-------|--------|
| Owner unavailability | CRITICAL | All 7 services have no secondary contact |
| Knowledge concentration | HIGH | Build/deploy knowledge held by 1 person |
| Escalation path | HIGH | No team member to escalate to |
| Vendor lock-in (person) | MEDIUM | If owner changes role, services are at risk |

**Mitigation options:**
1. Add secondary owner (Team-level ownership) to at least CRITICAL services
2. Automate runbooks so services can be operated without owner knowledge
3. Designate a `mi-ops` team with documented on-call procedures

### Risk 2: No Formal Team Structure

Mi has one team in practice (`mi-ops`) but no formal team definition in any system of record. If a team member is added:
- They have no way to discover what they're responsible for
- There's no documented escalation path
- There's no defined scope of responsibility

**OM would solve this** — team membership + owned entities are browsable in the OM UI.

---

## 7. Ownership Transfer Scenarios

### Scenario A: Hoang Le is unavailable for 1 week

| Service | Risk | Recovery path |
|---------|------|--------------|
| mi-core | CRITICAL — service breaks aren't fixable | No documented runbook; pm2 restart only |
| whatsapp-ai-gateway | HIGH — CEO loses AI communication | Fallback to raw WhatsApp without AI |
| bakudanramen-dashboard | HIGH — CEO dashboard goes dark | Dashboard is read-only; tolerable for 1 week |
| antigravity-gateway | HIGH — API routing breaks | Dependent services fail; no alternative |

### Scenario B: New team member joins

Without OM or equivalent:
- New member has no system-of-record to discover owned services
- Must ask Hoang Le to enumerate projects (human bottleneck)
- No way to see which services are critical vs medium

With OM:
- Team member browses OM → sees all services, their owners, criticality tags
- Can immediately identify CRITICAL services and their dependencies
- Ownership transfer is a single API call

---

## 8. Recommended Ownership Model (OM-native)

```
Organization: Mi System
│
├── Team: mi-ops (operational)
│     Responsible for: mi-core, whatsapp-ai-gateway, antigravity-gateway
│     Primary: Hoang Le
│     Secondary: [to be defined]
│
├── Team: mi-dev (development)
│     Responsible for: agent-coding-api-keys, knowledge-db
│     Primary: Hoang Le
│     Secondary: [to be defined]
│
└── Team: bakudan-team (product)
      Responsible for: bakudanramen-dashboard, visibility-connectors
      Primary: Hoang Le
      Secondary: [to be defined]
```

This distributes ownership conceptually even if the primary is the same person — it documents intent and makes team-based assignment easy when the team grows.

---

## 9. Mi-Native Ownership (Without OM)

The same ownership model can be implemented in `master-projects.json` with a schema extension:

```json
{
  "name": "mi-core",
  "owner": {
    "primary": "hoang.d.le@gmail.com",
    "secondary": null,
    "team": "mi-ops"
  },
  "criticality": "CRITICAL",
  "runbook_path": "mi-core/docs/runbook.md"
}
```

A simple Node.js script can then answer ownership queries without OM:
```javascript
// Who owns CRITICAL services?
projects.filter(p => p.criticality === 'CRITICAL').map(p => p.owner.primary)

// Unowned projects?
projects.filter(p => !p.owner?.primary)

// Overloaded owners?
groupBy(projects, p => p.owner.primary)
```

---

## 10. Findings Summary

| Finding | Severity | OM Needed? |
|---------|---------|-----------|
| 100% ownership concentration | HIGH | No — schema fix in master-projects.json |
| No secondary owners on CRITICAL services | HIGH | No — add to JSON schema |
| No formal team structure | MEDIUM | Optional — OM helps; not required |
| No runbooks for ownership transfer | HIGH | No — documentation task |
| No orphaned projects | ✅ Good | N/A |

**Conclusion:** The ownership problems are structural (no secondary owners, no runbooks) — not tooling problems. OpenMetadata would make ownership browsable and formal, but the core issue is that no secondary owners exist, which OM cannot solve by itself.

See `OPENMETADATA_RECOMMENDATION.md` for the final decision.
