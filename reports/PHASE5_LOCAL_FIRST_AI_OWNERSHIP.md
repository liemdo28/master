# Phase 5 — Local-First AI Ownership

**Status:** COMPLETE  
**Date:** 2026-06-11

## Deliverables

| File | Purpose |
|------|---------|
| `server/src/models/model-registry.ts` | 8-model registry; local=6, cloud=2 (disabled) |
| `server/src/models/local-model-router.ts` | Selects local model first; logs every routing decision |
| `server/src/models/model-health.ts` | Pings Ollama /api/tags; updates health per model |
| `server/src/models/model-benchmark.ts` | Latency probe via fixed prompt; runAllBenchmarks() |
| `server/src/models/model-policy.ts` | 95% local / 5% cloud policy enforcement |
| `server/src/routes/models-registry.ts` | /api/models/registry/* — list, health, benchmark, policy |

## Local Models
| ID | Name | Role |
|----|------|------|
| ollama-qwen3-1.7b | qwen3:1.7b | fast/chat |
| ollama-qwen3-8b | qwen3:8b | chat/reason |
| ollama-qwen3-14b | qwen3:14b | deep/reason |
| ollama-qwen25-coder | qwen2.5-coder:7b | code |
| ollama-nomic-embed | nomic-embed-text | embed |
| whisper-medium | faster-whisper/medium | stt |

## Cloud Models (disabled by default)
- claude-sonnet-4-6: requires ALLOW_CLOUD_AI=1
- gpt-4o: requires ALLOW_CLOUD_AI=1

## Policy
`ALLOW_CLOUD_AI=1` → full cloud access  
`ALLOW_CLOUD_FALLBACK=1` → cloud only when local fails  
Default: 100% local, cloud disabled
