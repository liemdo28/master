# BRAIN_ASSIGNMENT_REPORT.md
> Mi Company OS — Brain assignment per department.
> Source: `server/src/company-os/brain-registry.ts`
> Updated: 2026-06-18

---

## Assignment Table

| Department | Brain Name | Model | Temp | Tokens | Timeout |
|------------|-----------|-------|------|--------|---------|
| dispatch | qwen-deep | qwen3:14b | 0.4 | 2048 | 60s |
| executive-assistant | qwen-balanced | qwen3:8b | 0.4 | 1024 | 30s |
| report-center | qwen-balanced | qwen3:8b | 0.3 | 2048 | 45s |
| library | qwen-balanced | qwen3:8b | 0.3 | 1024 | 30s |
| qa | gemma-qa | gemma3:12b | 0.1 | 512 | 45s |
| finance | qwen-deep | qwen3:14b | 0.2 | 2048 | 60s |
| restaurant-intelligence | qwen-balanced | qwen3:8b | 0.3 | 1024 | 30s |
| engineering | qwen-coder | qwen2.5-coder:7b | 0.2 | 4096 | 90s |
| marketing | qwen-balanced | qwen3:8b | 0.6 | 2048 | 45s |
| brand-creative | gemma-qa | gemma3:12b | 0.7 | 1024 | 45s |
| technical-operations | qwen-balanced | qwen3:8b | 0.2 | 1024 | 30s |

---

## Brain Selection Rationale

### qwen3:14b (qwen-deep)
Assigned to: **dispatch**, **finance**
Why: Complex reasoning, cost justifiable for high-stakes decisions. Finance needs low hallucination rate (temp 0.2). Dispatch needs broad intent coverage (temp 0.4).

### qwen3:8b (qwen-balanced)
Assigned to: **executive-assistant**, **report-center**, **library**, **restaurant-intelligence**, **marketing**, **technical-operations**
Why: General-purpose fast model. Sufficient for data summarization, status reports, task queries. Lower VRAM than qwen3:14b.

### qwen2.5-coder:7b (qwen-coder)
Assigned to: **engineering**
Why: Specialized code model. Better at code review, bug detection, diff generation than general models.

### gemma3:12b (gemma-qa)
Assigned to: **qa**, **brand-creative**
Why: QA uses gemma3 to maintain independence from qwen-based exec depts. Brand creative uses it for visual concept evaluation (different model = different perspective).

---

## Override via ENV

Models can be overridden per environment:
```
OLLAMA_DEEP_MODEL=qwen3:14b
OLLAMA_FAST_MODEL=qwen3:8b
OLLAMA_CODER_MODEL=qwen2.5-coder:7b
OLLAMA_QA_MODEL=gemma3:12b
```

---

## Brain Health Check

`GET /api/company-os/brains/verify` — returns online status per dept.
`GET /api/company-os/departments/:id/health` — brain + tool readiness per dept.
