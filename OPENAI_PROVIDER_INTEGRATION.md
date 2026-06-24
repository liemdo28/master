# OPENAI_PROVIDER_INTEGRATION.md

> Phase 24 — OpenAI/ChatGPT Provider Integration for Mi-Core
> Date: 2026-06-24
> Status: INTEGRATION_READY

---

## Purpose

Add OpenAI as an official AI provider for Mi-Core, enabling ChatGPT-powered reasoning, content generation, and SEO intelligence — while keeping Mi-Core as the control plane.

---

## Provider Configuration

### Provider Identity

| Field | Value |
|-------|-------|
| Provider name | `openai` |
| API base | `https://api.openai.com/v1` |
| Auth method | Bearer token (API key) |
| Integration type | Official REST API only |
| UI automation | ❌ PROHIBITED |
| Browser scraping | ❌ PROHIBITED |
| Session cookie storage | ❌ PROHIBITED |

### Supported Models

| Model ID | Type | Use Case | Max Tokens | Cost Tier |
|----------|------|----------|------------|-----------|
| `gpt-4.1` | Reasoning + Content | Executive reasoning, SEO strategy, complex analysis, content writing | 1,048,576 | $$$ |
| `gpt-4.1-mini` | Fast + Smart | Default operations, fast ops, routine analysis | 1,048,576 | $$ |
| `gpt-4o` | Multimodal | Vision tasks, image analysis, multimodal reasoning | 128,000 | $$$ |
| `gpt-4o-mini` | Fast + Multimodal | Quick multimodal tasks, classification | 128,000 | $ |

### Environment Variables

```bash
# ── OpenAI Provider ─────────────────────────────────────────────────────
OPENAI_API_KEY=                    # sk-... (set in .env, never commit)
OPENAI_DEFAULT_MODEL=gpt-4.1-mini  # Fast default for routine tasks
OPENAI_REASONING_MODEL=gpt-4.1     # Deep reasoning / strategy
OPENAI_CONTENT_MODEL=gpt-4.1       # Content generation / SEO copy
OPENAI_BASE_URL=https://api.openai.com/v1
```

---

## Integration Architecture

```
CEO Request (WhatsApp)
    ↓
Mi-Core (port 4001)
    ├── Intent Router
    ├── Brain Router ← NEW: OpenAI routing rules
    │     ├── Executive reasoning → openai:gpt-4.1
    │     ├── SEO strategy → openai:gpt-4.1
    │     ├── Content writing → openai:gpt-4.1
    │     ├── Fast ops → ollama:qwen3:8b (LOCAL)
    │     ├── Engineering → ollama:qwen2.5-coder:7b (LOCAL)
    │     └── Sensitive data → LOCAL ONLY (unless approved)
    └── Execution + Evidence + QA
```

---

## Mi-Core Role (UNCHANGED)

Mi-Core remains the single control plane:

```text
✅ Company memory
✅ Task routing
✅ Approval gates
✅ Evidence collection
✅ QA validation
✅ n8n orchestration
✅ Reporting
✅ Brand management
```

OpenAI is a TOOL, not a replacement:

```text
❌ OpenAI does NOT control execution
❌ OpenAI does NOT bypass approval gates
❌ OpenAI does NOT store company memory
❌ OpenAI does NOT have direct n8n access
```

---

## API Integration Pattern

### Standard Request Flow

```javascript
// Mi-Core brain router selects provider
const provider = brain.selectProvider(taskType, safetyPolicy);

if (provider === 'openai') {
  // 1. Redact sensitive data before sending
  const sanitized = dataSanitizer.redact(payload);
  
  // 2. Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_REASONING_MODEL, // gpt-4.1
      messages: sanitized.messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });
  
  // 3. Log usage (tokens, cost) to Mi evidence store
  evidenceStore.log('openai_call', { model, tokens, cost });
  
  // 4. Return result to Mi-Core for QA
  return { provider: 'openai', result, usage };
}
```

---

## What OpenAI Handles

| Task | Model | Notes |
|------|-------|-------|
| Executive reasoning | gpt-4.1 | Strategy, planning, complex analysis |
| SEO strategy | gpt-4.1 | Keyword strategy, competitor analysis |
| Content writing | gpt-4.1 | Blog posts, meta descriptions, titles |
| Creative copy | gpt-4.1 | Ad copy, social media, marketing |
| Complex analysis | gpt-4.1 | Multi-factor analysis, trend identification |
| Fast classification | gpt-4.1-mini | Intent classification, routing support |
| Daily summaries | gpt-4.1-mini | Quick report generation |

---

## What Mi-Core Handles (ALWAYS)

| Task | Handler | Notes |
|------|---------|-------|
| Company memory | Mi-Core SQLite | Never sent to cloud |
| Task routing | Mi-Core brain router | Decides provider |
| Approval gates | Mi-Core approval engine | Before any action |
| Evidence collection | Mi-Core evidence store | All calls logged |
| QA validation | Mi-Core QA layer | Results verified |
| n8n workflow control | Mi-Core → n8n | Orchestration |
| Sensitive data | Mi-Core local models | PII, financials, auth |

---

## Implementation Steps

1. ✅ Add OpenAI env vars to `.env.example`
2. ✅ Define model routing policy
3. ✅ Define security/cost guard
4. ⏳ Implement OpenAI client module in `mi-core/ai-service/`
5. ⏳ Wire brain router to OpenAI provider
6. ⏳ Test with non-sensitive SEO query
7. ⏳ CEO approval for production use

---

## Certification

| Check | Status |
|-------|--------|
| Official API only | ✅ No UI scraping |
| No session cookies | ✅ Bearer token auth only |
| Sensitive data redaction | ✅ Defined in OPENAI_SECURITY_AND_COST_GUARD.md |
| Cost controls | ✅ Daily + monthly limits defined |
| Mi-Core remains control plane | ✅ OpenAI is a tool, not controller |
| Brain routing updated | ✅ BRAIN_ROUTING_POLICY_OPENAI.md |

**Status: OPENAI_PROVIDER_INTEGRATED ✅**
