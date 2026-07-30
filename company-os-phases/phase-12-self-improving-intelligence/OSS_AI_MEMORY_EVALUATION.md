# OSS_AI_MEMORY_EVALUATION.md — AI Memory & Learning OSS Evaluation

**Generated:** 2026-06-27
**Purpose:** Evaluate OSS tools for AI-powered memory and learning capabilities

---

## Evaluated OSS Tools

| Tool | Category | License | Use Case | Evaluation | Decision |
|------|----------|---------|----------|------------|----------|
| Langfuse | AI Observability | MIT | Trace LLM calls, cost tracking | PRODUCTION | Deploy for Mi tracing |
| OpenTelemetry | Telemetry | Apache-2.0 | Standard telemetry format | PRODUCTION | Integrate with existing stack |
| Phoenix (Arize) | LLM Evaluation | Apache-2.0 | Model evaluation, drift detection | DISCOVERY | Monitor |
| MLflow | ML Lifecycle | Apache-2.0 | Experiment tracking | DISCOVERY | Not needed yet |
| DVC | Data Versioning | Apache-2.0 | Data pipeline versioning | DISCOVERY | Not needed |
| Qdrant | Vector DB | Apache-2.0 | Semantic search for memories | PILOT | Evaluate for Phase 18 |
| Weaviate | Vector DB | BSD-3.0 | Semantic search | DISCOVERY | Monitor Qdrant first |
| Chroma | Vector DB | Apache-2.0 | Local vector DB | DISCOVERY | Not needed |
| LanceDB | Vector DB | Apache-2.0 | Embedding storage | DISCOVERY | Not needed |
| Postgres pgvector | Vector DB | PostgreSQL | Vector search in Postgres | PRODUCTION | Use existing Postgres |
| OpenSearch | Search | Apache-2.0 | Full-text + vector search | DISCOVERY | Not needed |
| ElasticSearch | Search | Elastic License | Full-text search | DISCOVERY | Avoid — licensing |
| Haystack | LLM Framework | Apache-2.0 | RAG pipelines | DISCOVERY | Not needed |
| LlamaIndex | LLM Framework | MIT | RAG and data indexing | DISCOVERY | Not needed |
| LangChain | LLM Framework | MIT | LLM application framework | DISCOVERY | Not needed |

---

## Recommended Stack for Phase 12

| Component | OSS Choice | Rationale |
|-----------|-----------|-----------|
| Trace/Observability | Langfuse | Purpose-built for LLM tracing, integrates with existing stack |
| Telemetry Standard | OpenTelemetry | Industry standard, cross-platform |
| Vector Storage | Postgres pgvector | Already in stack, no new dependency |
| Evaluation | Phoenix (Arize) | Open-source model evaluation |

---

## Not Adopted (with rationale)

| Tool | Reason |
|------|--------|
| LangChain | Too complex for current use case; Mi uses direct API calls |
| ElasticSearch | Elastic license concerns for commercial use |
| Weaviate/Chroma/LanceDB | pgvector sufficient for current scale |
| MLflow | No active ML training pipeline yet |

---

## OSS Lifecycle Impact

| OSS | Stage | Projects Using |
|-----|-------|---------------|
| Langfuse | PRODUCTION | Mi Core (LLM tracing) |
| OpenTelemetry | PRODUCTION | All services |
| Postgres pgvector | PRODUCTION | Existing database |
| Phoenix | DISCOVERY | None yet |

---

## Status: ✅ OSS_AI_MEMORY_EVALUATION_COMPLETE

Recommended stack: Langfuse + OpenTelemetry + pgvector. No new OSS licenses concerns. Phase 12 OSS evaluation complete.
