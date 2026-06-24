# OPENAI_SECURITY_AND_COST_GUARD.md

> Phase 24 — Security and Cost Guard for OpenAI Integration
> Date: 2026-06-24
> Status: ENFORCED

---

## Purpose

Prevent data leakage, control costs, and enforce safety when using OpenAI API through Mi-Core. Every OpenAI call MUST pass through these guards.

---

## 1. Cost Controls

### Daily Token Limit

```bash
OPENAI_DAILY_TOKEN_LIMIT=500000        # 500K tokens per day
OPENAI_MONTHLY_COST_LIMIT=50.00        # $50/month hard cap
OPENAI_PER_REQUEST_MAX_TOKENS=8192     # Max tokens per single request
OPENAI_ALERT_THRESHOLD_PCT=80          # Alert at 80% of daily limit
```

### Cost Tracking

Every OpenAI call logs:
```json
{
  "timestamp": "2026-06-24T10:00:00Z",
  "model": "gpt-4.1",
  "input_tokens": 2500,
  "output_tokens": 1800,
  "estimated_cost_usd": 0.045,
  "daily_cumulative_tokens": 45200,
  "daily_cumulative_cost_usd": 0.89,
  "monthly_cumulative_cost_usd": 12.34,
  "task_category": "seo_strategy",
  "department": "marketing"
}
```

### Cost Limits Enforcement

| Level | Threshold | Action |
|-------|-----------|--------|
| Normal | < 80% daily | Allow all OpenAI calls |
| Warning | 80% daily | Log warning, notify CEO |
| Throttle | 95% daily | Route all tasks to local models |
| Blocked | 100% daily | ALL tasks use local models only |
| Monthly cap | 100% monthly | BLOCK all OpenAI calls until next month |

### Estimated Model Costs (as of June 2026)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| gpt-4.1 | $2.00 | $8.00 |
| gpt-4.1-mini | $0.40 | $1.60 |
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |

---

## 2. Data Security — NEVER SEND LIST

The following data is **ABSOLUTELY PROHIBITED** from being sent to OpenAI or any cloud provider:

### Financial Data
- ❌ API keys (OpenAI, Google, Asana, etc.)
- ❌ OAuth tokens / refresh tokens
- ❌ Bank account numbers
- ❌ Credit card numbers
- ❌ QuickBooks raw sensitive records (invoices with payment details)
- ❌ Payroll data (employee SSN, salary, bank routing)
- ❌ Tax filing data
- ❌ Financial account credentials

### Personal Data
- ❌ Employee private data (SSN, DOB, home address, medical)
- ❌ Customer private data (phone, email, payment info)
- ❌ WhatsApp message content (conversations with CEO)
- ❌ Authentication credentials (passwords, PINs)
- ❌ Session tokens / cookies

### Company Secrets
- ❌ Internal API keys and secrets
- ❌ Database credentials
- ❌ Server configuration secrets
- ❌ Proprietary business logic / algorithms
- ❌ Employee performance data
- ❌ Internal communications

### What CAN Be Sent (Non-Sensitive)

- ✅ Website page content (public HTML)
- ✅ SEO keyword lists (non-personal)
- ✅ Page titles and meta descriptions
- ✅ Public business info (name, address, hours)
- ✅ Content briefs and outlines
- ✅ SEO audit results (technical, not financial)
- ✅ Competitor public website data
- ✅ Public review text
- ✅ Blog post drafts

---

## 3. Allowed Departments

Only specific departments are authorized to use OpenAI:

| Department | OpenAI Access | Justification |
|-----------|--------------|---------------|
| marketing | ✅ Allowed | Content strategy, SEO, creative copy |
| brand-creative | ✅ Allowed | Creative content generation |
| executive-assistant | ✅ Allowed | Executive reasoning, strategy |
| report-center | ✅ Allowed | Report generation, summaries |
| restaurant-intelligence | ✅ Allowed | Brand intelligence analysis |
| dispatch | ❌ Denied | Fast routing stays local |
| finance | ❌ DENIED | Financial data never leaves local |
| tax-compliance | ❌ DENIED | Tax data never leaves local |
| engineering | ❌ Denied | Code stays local |
| infrastructure | ❌ Denied | Infrastructure data stays local |
| technical-operations | ❌ Denied | Ops data stays local |
| qa | ❌ Denied | Validation stays local |
| library | ❌ Denied | Knowledge retrieval stays local |
| rd | ❌ Denied | Research stays local |

---

## 4. Redaction Pipeline

Before any data is sent to OpenAI, it MUST pass through the redaction pipeline:

```javascript
function redactSensitiveData(payload) {
  let sanitized = JSON.stringify(payload);
  
  // API Keys
  sanitized = sanitized.replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED_API_KEY]');
  sanitized = sanitized.replace(/eyJ[a-zA-Z0-9._-]+/g, '[REDACTED_TOKEN]');
  
  // Financial
  sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_CARD]');
  sanitized = sanitized.replace(/\b\d{9,}\b/g, '[REDACTED_ACCOUNT]');
  
  // PII
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
  sanitized = sanitized.replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/g, '[REDACTED_EMAIL]');
  sanitized = sanitized.replace(/\+?\d{10,14}/g, '[REDACTED_PHONE]');
  
  // Credentials
  sanitized = sanitized.replace(/password["\s:=]+["']?[^"',\s]+/gi, 'password: [REDACTED]');
  sanitized = sanitized.replace(/token["\s:=]+["']?[^"',\s]+/gi, 'token: [REDACTED]');
  
  return JSON.parse(sanitized);
}
```

---

## 5. Approval Required

The following OpenAI uses REQUIRE CEO approval before execution:

| Use Case | Why |
|----------|-----|
| Sending any data containing business metrics | Competitive sensitivity |
| Content that will be published publicly | Brand reputation |
| Strategy documents that affect multiple departments | Cross-functional impact |
| Any call exceeding $1.00 estimated cost | Cost control |

---

## 6. Audit Trail

Every OpenAI call generates an audit record:

```json
{
  "call_id": "oai_call_20260624_001",
  "timestamp": "2026-06-24T10:00:00Z",
  "department": "marketing",
  "task_category": "seo_strategy",
  "model": "gpt-4.1",
  "redaction_applied": true,
  "redaction_fields": ["api_key", "email"],
  "approval_required": false,
  "approval_granted": null,
  "input_tokens": 2500,
  "output_tokens": 1800,
  "estimated_cost_usd": 0.045,
  "response_quality": "pending_review",
  "data_classification": "non_sensitive",
  "evidence_path": ".local-agent-global/evidence/openai/call_20260624_001.json"
}
```

---

## 7. Emergency Procedures

### If API Key Compromised
1. Immediately rotate OpenAI API key
2. Set `OPENAI_API_KEY=` (empty) in `.env`
3. All tasks fall back to local models
4. Review last 24h of OpenAI calls for data exposure
5. Notify CEO via WhatsApp

### If Cost Spike Detected
1. Set daily limit to 0 (immediate block)
2. Review recent calls for anomalies
3. Adjust limits after investigation
4. CEO approval required to re-enable

---

## Certification

| Check | Status |
|-------|--------|
| Daily token limit defined | ✅ 500K tokens/day |
| Monthly cost limit defined | ✅ $50/month |
| NEVER SEND list defined | ✅ API keys, PII, financial, auth |
| Allowed departments defined | ✅ 5 of 14 allowed |
| Redaction pipeline defined | ✅ regex-based redaction |
| Approval required for sensitive | ✅ defined |
| Audit trail defined | ✅ every call logged |
| Emergency procedures defined | ✅ key compromise + cost spike |

**Status: OPENAI_SECURITY_GUARD_ENFORCED ✅**
