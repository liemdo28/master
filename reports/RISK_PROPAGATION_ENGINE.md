# Risk Propagation Engine
**Phase 14.5 — RiskPropagationEngine**
**Status: PRODUCTION**

---

## Overview

The Risk Propagation Engine simulates cascade failures through the dependency graph. Given an entity and a failure severity, it computes which entities are affected, at what severity level, and whether CEO intervention is required.

---

## Severity Levels

| Input Severity | Description |
|---------------|-------------|
| `OFFLINE` | Entity completely unreachable |
| `DEGRADED` | Entity responding slowly or partially |
| `OVERLOADED` | Entity under load, partial failures |

---

## Propagation Rules

| Triggering edge weight | Effect on downstream |
|----------------------|----------------------|
| ≥ 9 (critical) | Full severity propagation to consumer |
| ≥ 7 (high) | One severity level down (OFFLINE → DEGRADED) |
| < 7 (medium/low) | DEGRADED regardless of input severity |

Propagation recurses up to depth 6. Visited set prevents cycles.

---

## Risk Chain Output

```typescript
interface RiskChain {
  source_entity_id: string;
  source_entity_name: string;
  failure_severity: string;
  affected_entities: AffectedEntity[];    // full cascade list
  blast_radius: number;                   // count of affected entities
  overall_risk_score: number;             // 0-100
  ceo_alert_required: boolean;            // true if blast_radius ≥ 3 or score ≥ 70
  estimated_recovery_time_min: number;
  remediation_steps: string[];
}
```

---

## CEO Alert Logic

`ceo_alert_required = true` when:
- `blast_radius >= 3`, OR
- `overall_risk_score >= 70`, OR
- Any affected entity has severity `CRITICAL`

---

## System Risk Report

`generateSystemRiskReport()` scans all non-owner entities and:
1. Simulates `OFFLINE` failure for each
2. Collects top 5 highest-risk chains
3. Identifies all SPOFs (from `findCriticalPaths()`)
4. Returns a system-wide risk summary

```typescript
interface SystemRiskReport {
  generated_at: string;
  total_entities_scanned: number;
  top_risk_chains: RiskChain[];
  spof_entities: CriticalPathResult[];
  overall_system_health: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
}
```

---

## Acceptance Test Results

### Query 2 — "If Review Automation fails"

| Metric | Value |
|--------|-------|
| Direct downstream | Dashboard (weight 5) |
| Cascade downstream | 0 additional (Dashboard is a leaf) |
| Blast radius | 1 |
| Risk severity | LOW (score: 15/100) |
| CEO alert | Not required |
| Owner | Hoang Le (CEO) |

### Mi-Core Failure Scenario (from system report)

| Metric | Value |
|--------|-------|
| Direct downstream | Dashboard, WhatsApp Gateway, Review Automation, Jarvis, Antigravity (5 projects) |
| Cascade downstream | Additional services depending on those projects |
| Blast radius | 5+ |
| Risk severity | CRITICAL |
| CEO alert | Required |

---

## REST Endpoint

```
GET /api/graph/risks/:id?severity=OFFLINE
GET /api/graph/system-risk
```
