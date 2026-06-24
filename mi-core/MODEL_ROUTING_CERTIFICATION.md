# MODEL_ROUTING_CERTIFICATION.md
> Phase 1 — Model Routing Certification
> Date: 2026-06-18

## Routing Logic

1. `getBrainForDept(deptId)` → exact map lookup → no fuzzy matching
2. `callBrain()` → tries primary model first → if timeout/error → tries fallback model
3. `used_fallback: true` logged in BrainResponse when fallback activates
4. All selections stored in evidence-store pipeline steps

## Available Models (Live)

| Model | Size | Role | Available |
|-------|------|------|-----------|
| qwen3:14b | 8.6GB | deep reasoning, finance, dispatch | ✅ |
| qwen3:8b | 4.9GB | fast exec, infra, reporting | ✅ |
| gemma3:12b | 7.6GB | QA, brand-creative | ✅ |
| qwen2.5-coder:7b | 4.4GB | engineering | ✅ |
| deepseek-r1:14b | 8.4GB | R&D research | ✅ |
| nomic-embed-text | 256MB | embeddings/RAG | ✅ |

## Status: MODEL_ROUTING_CERTIFIED ✅
