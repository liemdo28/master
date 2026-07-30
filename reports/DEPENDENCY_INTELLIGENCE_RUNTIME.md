# Dependency Intelligence Runtime
**Phase 14.3 — DependencyIntelligenceService**
**Status: PRODUCTION**

---

## Core Concepts

| Term | Definition |
|------|-----------|
| **Upstream** | What an entity depends ON (traverses `depends_on` outbound edges) |
| **Downstream** | Who depends ON this entity (traverses `depends_on` inbound edges) |
| **Impact** | All downstream entities that would fail if this entity goes down |
| **SPOF** | Entity with ≥2 high-weight (≥8) inbound `depends_on` edges — no alternative |
| **Blast radius** | Number of transitively impacted entities |

---

## Traversal Algorithm

### Upstream (what does X need?)

```
traverseUpstream(entityId):
  for each outbound depends_on edge:
    collect target entity
    recurse into target (depth ≤ 6, visited set prevents cycles)
  return flat list of DependencyNode
```

### Downstream (who needs X?)

```
traverseDownstream(entityId):
  for each inbound depends_on edge:
    collect source entity
    recurse into source (depth ≤ 6, visited set)
  return flat list of ImpactedEntity with full impact_path
```

---

## Public API

### `getDependencyTree(entityId): DependencyTree`

```typescript
{
  entity_id: string;
  entity_name: string;
  depends_on: DependencyNode[];       // upstream
  depended_on_by: ImpactedEntity[];   // downstream
}
```

### `analyzeImpact(entityId): ImpactAnalysis`

Computes:
- `directly_impacted` — first-hop downstream entities
- `transitively_impacted` — all further downstream
- `total_impacted` — deduplicated count
- `risk_score` — `min(100, total × 10 + maxWeight × 5)`
- `severity` — LOW / MEDIUM / HIGH / CRITICAL

### `findCriticalPaths(): CriticalPathResult[]`

Scans all non-owner entities. Sorts by `criticality_score = min(100, in_degree × 15 + avg_weight × 5)`.

**SPOF detection rule:** `is_spof = true` when `high_weight_inbound_deps >= 2` (weight ≥ 8).

---

## Acceptance Test Results

### Query 1 — "Dashboard"

| Fact | Value |
|------|-------|
| Depends on | Mi-Core (9), Visibility (6), PM2 (10), Review Automation (5) |
| Depended on by | 0 (leaf node — nothing downstream in current graph) |
| Critical deps | Mi-Core, PM2 |

### Critical Path Rankings

| Entity | Inbound deps | Avg weight | SPOF |
|--------|-------------|-----------|------|
| Mi-Core | 5 | 8.2 | ✓ |
| PM2 Process Manager | 2 | 10.0 | ✓ |
| Knowledge SQLite DB | 1 | 10.0 | — |

---

## Edge Weight Reference

| Weight | Meaning |
|--------|---------|
| 10 | Mission-critical — immediate failure if provider goes down |
| 8–9 | High — degraded or broken within seconds |
| 5–7 | Medium — reduced functionality |
| 1–4 | Low — optional integration |

Critical threshold for SPOF calculation: **weight ≥ 8**.
