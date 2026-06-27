# AGENT_HANDOFF_ENGINE.md — Agent Handoff Management

**Generated:** 2026-06-27
**Purpose:** Manage handoffs between agents in multi-agent workflows

---

## Handoff Protocol

```
Agent A ──[COMPLETE]──► Agent B
    │                        │
    │ Evidence attached       │ Context enriched
    │                        │
    ▼                        ▼
HANDOFF-UUID-001       HANDOFF-UUID-002
```

---

## Handoff Record Schema

```json
{
  "handoff_id": "HANDOFF-UUID",
  "from_agent": "AGENT-ID",
  "to_agent": "AGENT-ID",
  "objective_id": "UUID",
  "context_summary": "string",
  "evidence_refs": ["list"],
  "acknowledged": boolean,
  "acknowledged_at": "datetime",
  "status": "PENDING | ACKNOWLEDGED | COMPLETE"
}
```

---

## Runtime Handoff: Raw Sushi Revenue Objective

### HANDOFF-001: Finance → Marketing

```json
{
  "handoff_id": "HANDOFF-001",
  "from_agent": "AGENT-FIN-001",
  "to_agent": "AGENT-MKT-001",
  "objective_id": "OBJ-RAW-SUSHI-REVENUE",
  "context_summary": "DoorDash revenue up 12% WoW. Top item: Spicy Tuna Roll. CPA: $4.20.",
  "evidence_refs": ["FIN-REV-20260627", "DD-PERF-Q2"],
  "acknowledged": true,
  "acknowledged_at": "2026-06-27T10:50:00Z",
  "status": "ACKNOWLEDGED"
}
```

### HANDOFF-002: Marketing → DoorDash Operator

```json
{
  "handoff_id": "HANDOFF-002",
  "from_agent": "AGENT-MKT-001",
  "to_agent": "AGENT-OPS-001",
  "objective_id": "OBJ-RAW-SUSHI-REVENUE",
  "context_summary": "Increase DoorDash campaign by $300/month. Focus on Spicy Tuna Roll promotion.",
  "evidence_refs": ["MKT-CAMP-001"],
  "acknowledged": true,
  "acknowledged_at": "2026-06-27T10:51:00Z",
  "status": "ACKNOWLEDGED"
}
```

### HANDOFF-003: Marketing → Creative

```json
{
  "handoff_id": "HANDOFF-003",
  "from_agent": "AGENT-MKT-001",
  "to_agent": "AGENT-CRE-001",
  "objective_id": "OBJ-RAW-SUSHI-REVENUE",
  "context_summary": "Create 3 promotional images for Spicy Tuna Roll. Focus: online ordering appeal.",
  "evidence_refs": ["CREATIVE-BRIEF-001"],
  "acknowledged": true,
  "acknowledged_at": "2026-06-27T10:52:00Z",
  "status": "ACKNOWLEDGED"
}
```

### HANDOFF-004: Creative → Human Approver

```json
{
  "handoff_id": "HANDOFF-004",
  "from_agent": "AGENT-CRE-001",
  "to_agent": "CEO (EMP-001)",
  "objective_id": "OBJ-RAW-SUSHI-REVENUE",
  "context_summary": "3 creative assets ready for DoorDash campaign. Approval required for public use.",
  "evidence_refs": ["ASSET-001", "ASSET-002", "ASSET-003"],
  "acknowledged": false,
  "approval_required": true,
  "status": "PENDING"
}
```

---

## Handoff Chain for Raw Sushi Objective

```
Finance Agent ──[HANDOFF-001]──► Marketing Agent ──[HANDOFF-002]──► DoorDash Operator
                                │
                                └──[HANDOFF-003]──► Creative Agent ──[HANDOFF-004]──► CEO
```

---

## Status: ✅ HANDOFF_ENGINE_ACTIVE

Handoff engine managing agent-to-agent communication with evidence chains and acknowledgements.
