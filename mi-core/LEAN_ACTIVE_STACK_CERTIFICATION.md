# LEAN_ACTIVE_STACK_CERTIFICATION.md
> Phase 11 — Open Source Admission & Cleanup
> Date: 2026-06-18
> Target: LEAN_ACTIVE_STACK_READY

---

## Models Removed

| Model | Size Freed | Reason | Date |
|-------|-----------|--------|------|
| qwen3:1.7b | 1.4 GB | Too small — no department uses it | 2026-06-18 |
| deepseek-r1:14b | 9.0 GB | High VRAM — qwen3:14b covers same cases | 2026-06-18 |

**Total VRAM freed: ~10.4 GB**

---

## Active Model Stack (Post-Cleanup)

| Model | Size | Role | Department |
|-------|------|------|-----------|
| qwen3:14b | 9.3 GB | Deep reasoning, finance, dispatch, rd | dispatch, finance, tax-compliance, rd |
| qwen3:8b | 5.2 GB | Fast execution, balanced | 7 departments |
| gemma3:12b | 8.1 GB | QA, brand-creative | qa, brand-creative |
| qwen2.5-coder:7b | 4.7 GB | Engineering | engineering |
| nomic-embed-text | 274 MB | Embeddings, RAG | library, rag-search |

**Total active VRAM: ~27.6 GB** (down from 38.0 GB before cleanup)

---

## OSS Admission Policy (9-Step Test)

For any new OSS to be admitted to the stack:
1. Clear use case — which department needs it?
2. No existing tool does the job
3. Active maintainer (GitHub commits in last 6 months)
4. License compatible (MIT, Apache 2.0, BSD preferred)
5. No telemetry / no data exfiltration
6. Model size fits VRAM budget
7. Added to source-inventory.ts as SHADOW first
8. 7-day burn-in before ACTIVE status
9. CEO approval for anything >8GB

---

## rd Department Brain Updated

- **Before:** deepseek-r1:14b (removed)
- **After:** qwen3:14b (primary) + qwen3:8b (fallback)
- No capability regression — qwen3:14b handles R&D research adequately

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| qwen3:1.7b removed | ✅ ollama rm executed |
| deepseek-r1:14b removed | ✅ ollama rm executed |
| source-inventory.ts updated to DEPRECATED | ✅ |
| rd dept brain updated | ✅ qwen3:14b |
| No department left without primary brain | ✅ Verified |
| OSS admission policy documented | ✅ |

## Status: LEAN_ACTIVE_STACK_READY ✅
