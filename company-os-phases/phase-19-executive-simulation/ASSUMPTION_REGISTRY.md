# ASSUMPTION_REGISTRY.md — Simulation Assumption Registry

**Generated:** 2026-06-27
Purpose: Track assumptions for all simulations

---

## Assumption Schema

```json
{
  "assumption_id": "ASSUME-UUID",
  "scenario_id": "SCENARIO-UUID",
  "assumption": "string",
  "source": "historical_data | expert_judgment | external",
  "confidence": 0.0-1.0,
  "last_updated": "datetime"
}
```

---

## Status: ✅ ASSUMPTION_REGISTRY_DEFINED
