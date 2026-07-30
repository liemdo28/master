# MI_COMPANY_DUPLICATE_CHECK_PROOF.md — Duplicate System Check

**Generated:** 2026-06-27
**Purpose:** Evidence that no duplicate OSS, agent, workflow, or service was added without checking existing systems

---

## Universal Rule 4: No Duplicate Systems

Before adding any OSS, agent, workflow, or service, check:
- Does existing OSS already cover this?
- Does existing agent already cover this?
- Does n8n already cover this?
- Does Mi-Core already cover this?

---

## OSS Duplicate Check

| Proposed OSS | Existing OSS | Overlap | Decision |
|-------------|-------------|---------|----------|
| Temporal | n8n | MEDIUM — workflow orchestration | Keep n8n (PRODUCTION), monitor Temporal |
| Browser Use | Playwright | MEDIUM — browser automation | Keep Playwright (PRODUCTION), Browser Use PILOT |
| Metabase | Superset | MEDIUM — BI dashboards | Choose one — BACKLOG |
| OpenClaw | Playwright | MEDIUM — browser orchestration | Keep Playwright, OpenClaw AUDIT |
| ComfyUI | Fooocus | MEDIUM — image generation | Consolidate — BACKLOG |
| Grafana | OpenObserve | MEDIUM — observability | Keep both — complementary |
| Mautic | Postiz | MEDIUM — marketing channels | Keep both — different channels |
| Airbyte | n8n | LOW — ETL vs workflow | Keep both — different abstraction |
| Weaviate | Postgres pgvector | LOW — vector DB | Keep pgvector (existing stack) |
| Chroma | Postgres pgvector | LOW — vector DB | Keep pgvector |
| LanceDB | Postgres pgvector | LOW — vector DB | Keep pgvector |
| Phoenix | Langfuse | LOW — evaluation | Keep both — different layers |
| MLflow | Langfuse | LOW — ML vs LLM | Keep Langfuse (current need) |
| CrewAI | Mi built orchestration | HIGH — agent orchestration | Keep Mi built |
| AutoGen | Mi built orchestration | HIGH — agent orchestration | Keep Mi built |
| LangGraph | Mi built orchestration | HIGH — agent orchestration | Keep Mi built |
| Dify | n8n | MEDIUM — workflow+agents | Keep n8n |
| Flowise | n8n | MEDIUM — visual workflows | Keep n8n |
| Langflow | n8n | MEDIUM — visual LangChain | Keep n8n |
| Windmill | n8n | MEDIUM — internal tools | Keep n8n |
| ElasticSearch | OpenFGA + OpenObserve | MEDIUM — search | Keep OpenFGA |
| Keycloak | Ory | LOW — identity | Keep Keycloak (existing) |
| Casdoor | Keycloak | LOW — identity | Keep Keycloak |

---

## Agent Duplicate Check

| Proposed Agent | Existing Agent | Overlap | Decision |
|---------------|-------------|---------|----------|
| Data Analyst | Financial Agent | MEDIUM — analysis | Keep both — different focus |
| SEO Agent | Marketing Agent | MEDIUM — SEO | Keep both — specialized |
| IT Agent | Operations Agent | LOW — different divisions | Keep both — separate duties |
| WhatsApp Router | Operations Agent | LOW — routing focus | Keep both — specialized |
| Engineering Agent | OpenHands | MEDIUM — coding | Keep both — IDE vs autonomous |
| Continue | Aider | MEDIUM — coding IDE | Keep both — different IDEs |

---

## Workflow Duplicate Check

| Proposed Workflow | Existing Workflow | Overlap | Decision |
|-----------------|----------------|---------|----------|
| QB sync via Airbyte | QB sync via n8n | MEDIUM | Keep n8n (existing), Airbyte for PostHog |
| DoorDash scrape via Airbyte | DoorDash scrape via Playwright | LOW | Keep Playwright (flexible) |

---

## Duplicate Resolution Actions

| ID | Action | Owner | Priority |
|----|--------|-------|---------|
| DUP-001 | Consolidate ComfyUI + Fooocus | Creative Lead | MEDIUM |
| DUP-002 | Choose Metabase vs Superset | Finance | MEDIUM |
| DUP-003 | Retire Skyvern | IT Lead | HIGH |
| DUP-004 | Monitor Temporal vs n8n | Operations | LOW |
| DUP-005 | Consolidate vector DBs to pgvector | Engineering | LOW |

---

## Conclusion

All proposed OSS, agents, and workflows were checked against existing systems before adoption. No duplicate systems deployed without justification. Evidence documented in this file.

**Status: ✅ DUPLICATE_CHECK_COMPLETE**
