# Agent & AI Keyword Scan Report

**Scan Date:** 2026-06-01  
**Scan Root:** `E:\Project\Master`  
**Keywords Searched:** agent, ai, openai, anthropic, claude, codex, prompt, workflow, worker, queue, review, qa, automation, scheduler, orchestrator, provider, key, gateway

---

## Summary

This scan identified **13 distinct locations** containing agent/AI-related keywords across the workspace. Of these:

- **3 HIGH risk** — Core infrastructure that most other projects depend on
- **1 MEDIUM risk** — Production app with direct OpenAI integration
- **7 LOW risk** — QA tooling, archived duplicates, personal projects, utility services
- **2 NONE** — False positives (browser user-agent strings)

The critical dependency chain is:  
`agent-coding` (brain) → `agent-coding-api-keys` (gateway) → all AI-powered apps

---

## Findings by Risk Level

### HIGH Risk

| Path | Matched Keywords | Purpose | Module Classification | Risk Level |
|------|-----------------|---------|----------------------|------------|
| `agent-coding/` | agent, ai, openai, anthropic, claude, prompt, workflow, worker, orchestrator, provider, gateway | Local Engineering OS — the main "brain" monorepo (Node.js + Python) | AGENT_CORE | HIGH |
| `agent-coding/apps/agency/` | agent, ai, openai, anthropic, claude, llm, prompt, workflow, worker, orchestrator, provider | AI Agency Platform — multi-department agents, LLM router, task planner, specialists, scoring engine | AGENT_CORE (sub-app) | HIGH |
| `Agent/agent-coding-api-keys/` | api_key, openai, anthropic, provider, gateway | Universal AI provider proxy/gateway for Claude Code / Cursor / Cline | PROVIDER_GATEWAY | HIGH |

### MEDIUM Risk

| Path | Matched Keywords | Purpose | Module Classification | Risk Level |
|------|-----------------|---------|----------------------|------------|
| `Bakudan/review-automation-system/` | openai, ai, review, automation, worker, queue, scheduler, prompt | Automated review collection + AI reply generation for restaurants (GPT-4o-mini) | PRODUCT_APP | MEDIUM |

### LOW Risk

| Path | Matched Keywords | Purpose | Module Classification | Risk Level |
|------|-----------------|---------|----------------------|------------|
| `QA/qa-system/` | qa, automation, orchestrator | QA orchestration system | SHARED_SERVICE | LOW |
| `QA/Tester-QA/` | qa, provider, openai, anthropic, automation | Internal QA/testing framework with provider failure simulation | SHARED_SERVICE | LOW |
| `Agent/review-management-mcp/` | review, agent | MCP server for review management | SHARED_SERVICE | LOW |
| `Agent/shared-workspace/` | agent, shared | Shared infrastructure workspace | SHARED_SERVICE | LOW |
| `Bakudan/packing-list/` | anthropic, ai | Packing list app with Telegram bot using Anthropic | PRODUCT_APP | LOW |
| `Other/phuyen-2026/` | openai, anthropic, ai | Personal project (travel planning bot) | OTHER | LOW |
| `_archive/agentai-agency-merged-20260601/` | agent, ai, openai, anthropic, claude, llm, orchestrator, workflow, worker, prompt, provider | ARCHIVED — original standalone agency repo (merged into agent-coding/apps/agency) | LEGACY_DUPLICATE | LOW |
| `_archive/Personal-agentai-agency-old/` | Same as above | ARCHIVED — old personal copy | LEGACY_DUPLICATE | LOW |

### FALSE POSITIVES (Excluded)

| Path | Matched Keywords | Reason for Exclusion |
|------|-----------------|---------------------|
| `Other/LinkTreeHL/` | user-agent | Browser detection only — not AI agent |
| `_archive/Raw-old-20260601/RawWebsite/AIStylistApp/node_modules/` | worker, queue, scheduler, provider | Vendor dependencies (React, Vite internals) — not project code |

---

## Key Observations

1. **Single Brain**: The `agent-coding/apps/agency/` sub-app is the definitive Agent Core — it contains the LLM router, orchestrator, task planner, department specialists, leader reviewer, and scoring engine.

2. **Provider Gateway**: `agent-coding-api-keys/` acts as a universal proxy that all AI development tools (Claude Code, Cursor, Cline) route through. Breaking this breaks the entire dev workflow.

3. **Shared API Keys**: The same `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` appear in multiple `.env` files across projects (agent-coding, review-automation-system, packing-list). This is a credential management risk.

4. **No Direct Inter-Project API Calls**: Despite sharing keywords and credentials, the product apps (review-automation-system, packing-list) do NOT call agent-coding APIs directly. They use AI providers independently.

5. **Legacy Cleanup Done**: The `agentai-agency` project has been properly archived and merged into `agent-coding/apps/agency/`. The root `agentai-agency/` folder is a Windows-locked remnant pending deletion.

---

## Recommendations

1. Centralize API key management through `agent-coding-api-keys/` for ALL projects
2. Do NOT modify `agent-coding/` or `agent-coding-api-keys/` without full impact analysis
3. The archived copies in `_archive/` are safe to ignore — they contain no active references
4. `review-automation-system` is the only production app with direct AI dependency — handle with care
