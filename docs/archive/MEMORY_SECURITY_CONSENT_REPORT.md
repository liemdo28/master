# MEMORY_SECURITY_CONSENT_REPORT
**Generated:** 2026-06-09

## MemoryConsentLog Module

### Location: `local-agent/federated-memory/MemoryConsentLog.mjs`

```javascript
// Consent categories
CATEGORIES = {
  health: "Health & biometric data",
  financial: "Financial records & transactions",
  location: "Location tracking",
  contacts: "External contact data",
  behavioral: "Behavioral patterns & habits"
}
```

### Consent Storage: `.local-agent-global/executive-memory-v2/consent_log.json`
```json
{
  "consents": {
    "health": { "granted": false, "granted_at": null, "notes": "" },
    "financial": { "granted": false },
    "contacts": { "granted": true, "granted_at": "2026-06-09", "notes": "CEO approved contact saving" }
  }
}
```

## Consent Rules Enforced

| Data Type | Consent Required | Behavior Without Consent |
|---|---|---|
| Health data | Yes | `requireConsent()` → ask CEO first |
| Financial records | Yes | Block + ask CEO |
| Location data | Yes | Block + ask CEO |
| External contacts | Yes (first time) | Ask once, remember |
| People memory (team) | No | Auto-store (work data only) |
| Store configs | No | Built-in constants |
| Decision log | No | CEO decision = implicit consent |

## requireConsent() Behavior
```javascript
// When health data action requested
const consent = await MemoryConsentLog.requireConsent('health', 
  'Mi muốn lưu dữ liệu sức khỏe để gợi nhắc wellness. Cho phép không?');

if (!consent.granted) {
  return "Cần CEO cho phép trước khi lưu dữ liệu sức khỏe.";
}
```

## Memory Security Rules

### What Mi Stores
✅ Store profiles (built-in, no personal data)
✅ Team member roles/contacts (work context only)
✅ CEO decisions (with date/context)
✅ Project registry (project names, statuses)
✅ Contact emails when CEO explicitly provides

### What Mi Never Stores
❌ Passwords, tokens, API keys (never in memory modules)
❌ Health metrics without explicit consent
❌ Financial data without explicit consent
❌ Personal messages content
❌ Google OAuth tokens (handled by google-auth module, separate)

## Encryption Note
All memory files are local-only (`E:/Project/Master` / `.local-agent-global`).
No memory data transmitted externally.
Google tokens stored in separate `google-tokens.json`, excluded from memory modules.

## GDPR/Privacy Alignment
- Consent-based data collection
- CEO can revoke consent: `revokeConsent('health')`
- CEO can view all stored data: `getAll()`
- No data processed outside local environment

---
MEMORY_SECURITY_CONSENT_COMPLETE
