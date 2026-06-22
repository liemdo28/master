# BRAIN_REGISTRY_REPORT.md
> Phase 1 — Brain Registry
> Date: 2026-06-18
> Target: BRAIN_REGISTRY_READY

---

## Brain Assignment Table

| Department | Brain Name | Primary Model | Fallback Model | Max Latency | Safety Policy |
|-----------|-----------|--------------|---------------|------------|--------------|
| dispatch | qwen-deep | qwen3:14b | qwen3:8b | 60s | FULL_AUTO |
| executive-assistant | qwen-balanced | qwen3:8b | qwen3:14b | 90s | FULL_AUTO |
| report-center | qwen-balanced | qwen3:8b | qwen3:14b | 90s | FULL_AUTO |
| library | qwen-balanced | qwen3:8b | qwen3:14b | 60s | FULL_AUTO |
| qa | gemma-qa | gemma3:12b | qwen3:14b | 90s | FULL_AUTO |
| finance | qwen-deep | qwen3:14b | qwen3:8b | 120s | REQUIRES_APPROVAL |
| tax-compliance | qwen-deep | qwen3:14b | qwen3:8b | 120s | REQUIRES_APPROVAL |
| restaurant-intelligence | qwen-balanced | qwen3:8b | qwen3:14b | 90s | FULL_AUTO |
| engineering | qwen-coder | qwen2.5-coder:7b | qwen3:14b | 120s | REQUIRES_APPROVAL |
| infrastructure | qwen-balanced | qwen3:8b | qwen3:14b | 90s | FULL_AUTO |
| marketing | qwen-balanced | qwen3:8b | qwen3:14b | 90s | REQUIRES_APPROVAL |
| brand-creative | gemma-qa | gemma3:12b | qwen3:8b | 90s | REQUIRES_APPROVAL |
| technical-operations | qwen-balanced | qwen3:8b | qwen3:14b | 90s | FULL_AUTO |
| rd | deepseek-research | deepseek-r1:14b | qwen3:14b | 180s | FULL_AUTO |

**Total: 14 departments assigned. 0 using qwen3:1.7b. 0 fuzzy match.**

---

## Acceptance Criteria

| Check | Status |
|-------|--------|
| 100% departments have assigned brain | ✅ 14/14 |
| No fuzzy model match | ✅ All exact model IDs |
| No qwen3:1.7b selected | ✅ None |
| Fallback model defined | ✅ All 14 |
| Model selection logged | ✅ via evidence-store |
| Evidence required flag set | ✅ All departments |

## Status: BRAIN_REGISTRY_READY ✅
