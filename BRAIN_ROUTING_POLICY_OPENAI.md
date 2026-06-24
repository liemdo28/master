# BRAIN_ROUTING_POLICY_OPENAI.md

> Phase 24 — Brain Routing Policy with OpenAI Integration
> Date: 2026-06-24
> Status: ACTIVE

---

## Purpose

Define how Mi-Core routes tasks between local models (Ollama) and OpenAI cloud models. This policy governs every AI inference call in the system.

---

## Routing Table

| Task Category | Primary Provider | Model | Fallback | Safety |
|--------------|-----------------|-------|----------|--------|
| Executive reasoning | OpenAI | gpt-4.1 | ollama:qwen3:14b | REQUIRES_APPROVAL |
| SEO strategy | OpenAI | gpt-4.1 | ollama:qwen3:8b | FULL_AUTO |
| SEO content writing | OpenAI | gpt-4.1 | ollama:qwen3:8b | REQUIRES_APPROVAL |
| Content generation (blogs, meta) | OpenAI | gpt-4.1 | ollama:qwen3:8b | REQUIRES_APPROVAL |
| Creative copy (ads, social) | OpenAI | gpt-4.1-mini | ollama:qwen3:8b | FULL_AUTO |
| Complex analysis | OpenAI | gpt-4.1 | ollama:qwen3:14b | FULL_AUTO |
| Fast ops (classification, routing) | Ollama | qwen3:8b | openai:gpt-4.1-mini | FULL_AUTO |
| Engineering audit / coding | Ollama | qwen2.5-coder:7b | qwen3:14b | REQUIRES_APPROVAL |
| Company memory queries | Ollama | qwen3:8b | — | FULL_AUTO |
| Task routing / intent | Ollama | qwen3:8b | — | FULL_AUTO |
| QA validation | Ollama | gemma3:12b | qwen3:14b | FULL_AUTO |
| Sensitive company data | LOCAL ONLY | qwen3:8b / qwen3:14b | — | BLOCKED_FROM_CLOUD |
| Financial data (QB, payroll) | LOCAL ONLY | qwen3:14b | — | BLOCKED_FROM_CLOUD |
| Employee PII | LOCAL ONLY | qwen3:8b | — | BLOCKED_FROM_CLOUD |
| Customer PII | LOCAL ONLY | qwen3:8b | — | BLOCKED_FROM_CLOUD |
| Auth tokens / API keys | LOCAL ONLY | — | — | NEVER_SENT |

---

## Routing Decision Flow

```
Incoming Task
    ↓
1. Is data sensitive? (PII, financial, auth, keys)
   ├── YES → LOCAL ONLY (qwen3:8b or qwen3:14b)
   └── NO → continue
    ↓
2. Does task need deep reasoning or content quality?
   ├── YES → Is OpenAI enabled? (OPENAI_API_KEY set?)
   │         ├── YES → openai:gpt-4.1
   │         └── NO → ollama:qwen3:14b
   └── NO → continue
    ↓
3. Is task fast/routine? (classification, simple query)
   ├── YES → ollama:qwen3:8b
   └── NO → ollama:qwen3:8b (default)
```

---

## Department → Brain Mapping (Updated)

| Department | Old Primary | New Primary | Reason |
|-----------|-------------|-------------|--------|
| dispatch | qwen3:14b | qwen3:14b | Unchanged — fast local routing |
| executive-assistant | qwen3:8b | openai:gpt-4.1 | Executive reasoning benefits from stronger model |
| report-center | qwen3:8b | openai:gpt-4.1-mini | Report quality improved with OpenAI |
| library | qwen3:8b | qwen3:8b | Unchanged — knowledge retrieval stays local |
| qa | gemma3:12b | gemma3:12b | Unchanged — validation stays local |
| finance | qwen3:14b | qwen3:14b | Unchanged — LOCAL ONLY, never cloud |
| tax-compliance | qwen3:14b | qwen3:14b | Unchanged — LOCAL ONLY |
| restaurant-intelligence | qwen3:8b | openai:gpt-4.1-mini | Better analysis for brand intelligence |
| engineering | qwen2.5-coder:7b | qwen2.5-coder:7b | Unchanged — coding stays local |
| infrastructure | qwen3:8b | qwen3:8b | Unchanged — ops stays local |
| marketing | qwen3:8b | openai:gpt-4.1 | Content + strategy benefit from OpenAI |
| brand-creative | gemma3:12b | openai:gpt-4.1 | Creative copy benefits from stronger model |
| technical-operations | qwen3:8b | qwen3:8b | Unchanged — ops stays local |
| rd | deepseek-r1:14b | deepseek-r1:14b | Unchanged — research stays local |

---

## SEO-Specific Routing

| SEO Task | Provider | Model | Rationale |
|----------|----------|-------|-----------|
| Crawl + technical audit | Local (SEO agents) | N/A (Node.js) | Data collection stays local |
| Schema validation | Local (SEO agents) | N/A (Node.js) | Structural validation |
| Keyword strategy | OpenAI | gpt-4.1 | Strategic thinking needs strong reasoning |
| Content opportunity analysis | OpenAI | gpt-4.1 | Multi-factor analysis |
| Blog post writing | OpenAI | gpt-4.1 | Content quality matters |
| Meta description writing | OpenAI | gpt-4.1-mini | Quick generation |
| Title tag optimization | OpenAI | gpt-4.1-mini | Quick generation |
| Competitor analysis | OpenAI | gpt-4.1 | Complex analysis |
| Technical SEO fix recommendations | Local | qwen3:8b | Engineering stays local |
| 404 analysis + fix planning | Local | qwen3:8b | Code-level analysis |
| Executive SEO report | OpenAI | gpt-4.1-mini | Summary generation |

---

## Override Rules

1. **CEO can override any routing** via WhatsApp command
2. **Cost emergency** — if daily budget exceeded, ALL tasks fall back to local
3. **API outage** — if OpenAI unreachable, automatic fallback to local models
4. **Sensitive data** — ALWAYS local unless CEO explicitly approves cloud send

---

## Evidence

Every routing decision is logged:
```json
{
  "timestamp": "2026-06-24T00:00:00Z",
  "task_id": "...",
  "task_category": "seo_strategy",
  "selected_provider": "openai",
  "selected_model": "gpt-4.1",
  "fallback_provider": "ollama",
  "fallback_model": "qwen3:8b",
  "safety_policy": "FULL_AUTO",
  "data_sensitive": false,
  "reason": "SEO strategy requires deep reasoning"
}
```

---

## Certification

| Check | Status |
|-------|--------|
| All 14 departments mapped | ✅ 14/14 |
| Sensitive data → local only | ✅ enforced |
| OpenAI routing defined | ✅ for reasoning + content + SEO |
| Fallback to local defined | ✅ for all OpenAI tasks |
| Cost override defined | ✅ budget exceeded → local fallback |
| Evidence logging defined | ✅ all decisions logged |

**Status: BRAIN_ROUTING_OPENAI_ACTIVE ✅**
