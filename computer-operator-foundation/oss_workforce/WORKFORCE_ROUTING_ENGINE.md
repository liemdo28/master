# WORKFORCE_ROUTING_ENGINE.md — Task Routing to Correct Workforce Layer

**Generated:** 2026-06-27  
**Purpose:** Route every task to the right worker (Human, AI Agent, or OSS)  
**Governed by:** Mi-Core Workforce Router

---

## Routing Decision Tree

```
Task Received
     │
     ▼
┌─────────────────────────┐
│ Does task require human │  ── YES ──→ Layer 1: Human Workforce
│ judgment / creativity?  │              (CEO, Manager, Developer, Designer)
└───────────┬─────────────┘
            │ NO
            ▼
     ┌──────────────────┐
     │ Is task repetitive│  ── YES ──→ Layer 3: OSS Workforce
     │ or automatable?   │              (n8n, Playwright, DuckDB, etc.)
     └────────┬─────────┘
              │ NO
              ▼
     ┌──────────────────┐
     │ Does task require│  ── YES ──→ Layer 2: AI Workforce
     │ reasoning / LLM? │              (Engineering Agent, Financial Agent, etc.)
     └────────┬─────────┘
              │ NO
              ▼
     ┌──────────────────┐
     │  Fallback: Human │  → Layer 1
     └──────────────────┘
```

---

## Task Type → Worker Mapping

| Task Type | Example | Primary Worker | Layer | Fallback |
|-----------|---------|---------------|-------|---------|
| SEO automation | GSC data fetch, sitemap check | n8n | OSS | Playwright |
| Browser scraping | DoorDash menu monitoring | Playwright | OSS | Browser Use |
| Financial analysis | Revenue by store | DuckDB | OSS | dbt |
| Data transformation | SQL joins, dbt models | dbt | OSS | DuckDB |
| Reporting | CFO dashboard questions | Metabase | OSS | PostHog |
| Code generation | Write function, review PR | Engineering Agent | AI | OpenHands |
| Revenue tracking | Store ranking, QB sync | Financial Agent | AI | DuckDB |
| Marketing campaign | SEO report, content plan | Marketing Agent | AI | PostHog |
| Image generation | Brand assets, thumbnails | Creative Agent | AI | ComfyUI |
| Monitoring | Uptime checks, alerts | IT Agent | AI | Uptime Kuma |
| Strategic decision | Pricing, expansion | CEO | Human | Manager |
| Performance review | Quarterly review | Manager | Human | CEO |
| Design work | Brand identity, UI | Designer | Human | Creative Agent |
| Software architecture | System design | Developer | Human | Engineering Agent |

---

## Routing Rules

### Rule 1: OSS First

If a task can be handled by an OSS tool already in PRODUCTION, route to OSS first.

### Rule 2: Agent When OSS is Insufficient

If OSS cannot handle the task (requires reasoning, context, or creativity), escalate to AI Agent.

### Rule 3: Human for Strategic Decisions

If the task involves strategic decisions, budget allocation, or human judgment, route to Human.

### Rule 4: Parallel Routing for Complex Tasks

For multi-step tasks, route to the appropriate worker at each step:

```
DoorDash Revenue Task
  → Playwright (scrape) → Browser Use (parse) → n8n (orchestrate) → DuckDB (store) → Metabase (report) → CEO (decide)
```

---

## Workforce Utilization

| Worker | Current Load | Max Capacity | Utilization % | Status |
|--------|-------------|-------------|--------------|--------|
| n8n | 4 workflows | 10 | 40% | 🟢 |
| Playwright | 3 scripts | 5 | 60% | 🟢 |
| DuckDB | 2 databases | 5 | 40% | 🟢 |
| Engineering Agent | 0 tasks | 10 | 0% | 🔴 |
| Financial Agent | 0 tasks | 10 | 0% | 🔴 |
| Marketing Agent | 0 tasks | 10 | 0% | 🔴 |
| Operations Agent | 0 tasks | 10 | 0% | 🔴 |
| IT Agent | 0 tasks | 10 | 0% | 🔴 |
| Creative Agent | 0 tasks | 10 | 0% | 🔴 |

---

## Next Actions

1. Implement routing engine in Mi-Core (Phase 11.1)
2. Set up task queue per worker layer
3. Monitor utilization and alert on over/under-utilization
4. Create routing dashboard in CEO dashboard
