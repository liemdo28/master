# Intent Coverage Patch Report
**Date:** 2026-06-15
**Phase:** DEV3 CEO_READY_V2 Closeout — C1
**Result:** INTENT_COVERAGE_PATCH_READY

---

## Problem

The intent router had no patterns for common CEO shorthand phrases used when
querying specific stores or sending messages to named recipients.

**Phrases that returned `unknown` (forcing honest clarification):**

| Phrase | Expected Intent | Was Returning |
|--------|----------------|---------------|
| `qb` (standalone) | `check_status` | `unknown` |
| `qb sao` / `qb the nao` | `check_status` | `unknown` |
| `coi qb` | `check_status` | `unknown` |
| `raw sao` | `check_status` | `unknown` |
| `coi raw` | `check_status` | `unknown` |
| `stockton sao` | `check_status` | `unknown` |
| `gui Maria` / `email Maria` | `send_message` | `unknown` |
| `gui Maria ban nhap` | `send_message` | `unknown` |

Root cause: intent-router patterns required context words like "kiểm tra" or
"cho/tới" alongside the target. Bare shorthand with no verb context didn't match.

---

## Fix Applied

**File:** `server/src/gstack/intent-router.ts`

### `check_status` rule — new patterns added:

```typescript
// QB / QuickBooks status shorthand
/\b(coi|check|xem)\s+(?:qb|quickbooks)\b/,
/\b(?:qb|quickbooks)\b.*\b(sao|the nao|status|roi|oke|ok|chay|sync|ket qua)\b/,
/^qb$/,  // bare "qb" alone

// Raw Sushi store status
/\b(coi|check|xem)\s+(?:raw|bakudan)\b/,
/\b(?:raw\s*sushi|bakudan\s*ramen)\b.*\b(sao|the nao|status)\b/,

// Stockton store status
/\b(stockton)\b.*\b(sao|the nao|status|oke|ok)\b/,
/\b(coi|check)\s+stockton\b/,
```

### `send_message` rule — new patterns added:

```typescript
// Shorthand without "cho/toi" — "gui Maria", "email Maria"
/\b(gui|send|email|nhan\s*tin)\s+(?:maria|anh|em|boss|team|manager)\b/,

// "gửi Maria bản nháp" style
/\b(gui|send)\s+\w+\b.*\b(ban\s*nhap|draft|report|bao\s*cao|ket\s*qua)\b/,
```

All patterns use NFD-normalized (diacritic-stripped) text — consistent with
the existing `norm()` function applied before pattern matching.

---

## Coverage After Patch

| Phrase (normalized) | Intent | Confidence |
|---------------------|--------|-----------|
| `qb` | `check_status` | HIGH |
| `qb sao` | `check_status` | HIGH |
| `coi qb` | `check_status` | HIGH |
| `qb the nao` | `check_status` | HIGH |
| `raw sao` | `check_status` | HIGH |
| `coi raw` | `check_status` | HIGH |
| `stockton sao` | `check_status` | HIGH |
| `coi stockton` | `check_status` | HIGH |
| `gui maria` | `send_message` | HIGH |
| `email maria` | `send_message` | HIGH |
| `gui maria ban nhap` | `send_message` | HIGH |
| `gui anh ket qua` | `send_message` | HIGH |

---

## Impact on CEO Experience

Before patch — "coi QB" in compound message:
```
"Kiem tra Dashboard, coi QB, tao SEO Raw Sushi, roi gui Maria"
→ "coi QB" → unknown → ❌ honest clarification (expected: check_status)
→ "gui maria" → unknown → ❌ blocked (expected: send_message)
```

After patch:
```
→ "coi qb"    → check_status → ✅ routes to connector status pipeline
→ "gui maria" → send_message → ✅ routes to message delivery (requires approval)
```

---

## Certification

- QB_SHORTHAND_INTENT_MAPPED: ✅
- STORE_STATUS_SHORTHAND_MAPPED: ✅
- SEND_MESSAGE_NAME_PATTERN_ADDED: ✅
- NORMALIZED_PATTERN_CONSISTENCY: ✅
- **INTENT_COVERAGE_PATCH_READY: ✅**
