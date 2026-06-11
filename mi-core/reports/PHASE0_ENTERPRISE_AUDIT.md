# Phase 0 Enterprise Audit

## Scope
Audited Mi-Core repository on 2026-06-11 for databases, memory systems, vector stores, queues, providers, agents, browser automations, connectors, APIs, dashboards, and deployments.

## Inventory
- Databases: PostgreSQL big-data schema, SQLite knowledge DB, SQLite QB agent DB, file-backed local-agent JSON stores.
- Object storage: MinIO buckets `mi-raw`, `mi-reports`, `mi-evidence`.
- Vector store: Qdrant collection `mi_bigdata`.
- Memory systems: `server/src/memory`, `server/src/memory2`, local federated memory, knowledge DB, Qdrant chunks.
- Providers: Ollama, Anthropic direct path, OpenAI-compatible planned; no complete provider boundary existed before this phase.
- Agents: agent-engine bridge, operator harness, local-agent, remote-agent proxy, browser-agent, data analyst.
- Browser automation: browser-use bridge; Skyvern not yet deployed.
- Connectors: dashboard, QuickBooks, review automation, browser evidence, Gmail, Drive, Calendar, Asana, projects, DoorDash.
- APIs: Express server on port 4001, agent-engine bridge on 4003, Python AI service on 4002.
- Dashboards/UI: `ui/index.html`, `ui/brain.html`, `ui/mobile.html`, `ui/liveboard.html`.
- Deployment systems: local batch scripts, Docker Compose for Postgres/MinIO/Qdrant, no production deployment pipeline found.

## Findings
- Duplicate memory exists across SQLite knowledge DB, local JSON memory, and Qdrant-backed memory chunks.
- Browser execution existed only through browser-use; no production/POC router boundary was present.
- Direct provider calls existed in AI client and embedding/search code paths.
- Heavy operations were tracked by ingestion jobs but were not consistently backpressured by a queue.
- Approval gate existed but was in-memory and did not cover all production mutation classes.
- Audit logs existed for big-data operations but not for provider selection or permission decisions.
- Hidden/local file stores remain under `.local-agent-global` and should be migrated or formalized as cache-only.

## Immediate Remediation
- Add Superpowers governance templates.
- Add ECC governance.
- Add provider router, queue schema, memory router, browser router, permission audit, and enterprise health surface.
