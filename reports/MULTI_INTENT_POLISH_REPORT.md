# Multi-Intent Polish Report
**Date:** 2026-06-15
**Phase:** DEV3 CEO_READY_V2 Closeout — C2
**Result:** MULTI_INTENT_POLISHED

---

## Problem

The multi-intent splitter was producing "filler" sub-intents from bare conjunction
words that survived the split but contained no actionable request.

**Example — before polish:**
```
Input: "Kiem tra Dashboard, coi QB, tao SEO Raw Sushi, roi gui Maria"

Fragments after split:
  1. "kiem tra dashboard"  ← real intent ✅
  2. "coi qb"              ← real intent ✅
  3. "tao seo raw sushi"   ← real intent ✅
  4. "roi"                 ← FILLER — bare conjunction only ❌
  5. "gui maria"           ← real intent (BLOCKED on 4)

"roi" as standalone fragment → routed to intent-router → unknown → wasted work order
```

This inflated work order counts and caused unnecessary "honest clarification"
messages for non-requests. The report suffix `"roi gui Maria"` was partially
extracted but the `"roi"` was left behind when the suffix pattern matched only
`"gui Maria"`.

---

## Fix Applied

**File:** `server/src/gstack/multi-intent-splitter.ts`

Added a filler filter after fragment splitting:

```typescript
// Bare conjunctions or filler words with no verb — discard, they carry no intent
const FILLER_ONLY = /^(roi|thi|va|cung|and|then|sau\s*do|xong|ok|okay|oke)$/i;

const rawFragments = workingN
  .split(/\s*__(?:SEQ|PAR)__\s*/)
  .map(f => f.trim())
  .filter(f => f.length > 0)
  .filter(f => !FILLER_ONLY.test(f));  // ← NEW: remove bare filler fragments
```

The filter runs on the normalized (diacritic-stripped) text, so Vietnamese forms
like "rồi" → "roi", "thì" → "thi", "và" → "va" are all caught.

---

## Behavior After Polish

**Same example — after polish:**
```
Input: "Kiem tra Dashboard, coi QB, tao SEO Raw Sushi, roi gui Maria"

Fragments after split + filler filter:
  1. "kiem tra dashboard"  ← real intent ✅
  2. "coi qb"              ← real intent ✅
  3. "tao seo raw sushi"   ← real intent ✅
  4. "gui maria"           ← real intent ✅ (no longer blocked by filler dep)

Work orders: 4 real tasks (was 5 including filler)
```

**Report suffix handling — "roi bao anh" example:**
```
Input: "Dashboard va QB roi bao anh"
→ suffix "roi bao anh" extracted in Step 1
→ "roi" no longer appears as leftover fragment
→ Fragments: ["dashboard", "qb"]
→ Report step: "roi bao anh" (depends on all)
→ Total: 3 sub-intents (clean, no filler)
```

---

## What the Filter Catches

| Filler | Normalized form | Discarded? |
|--------|----------------|-----------|
| rồi (standalone) | roi | ✅ |
| thì | thi | ✅ |
| và | va | ✅ |
| cùng | cung | ✅ |
| and | and | ✅ |
| then | then | ✅ |
| sau đó | sau do | ✅ |
| xong | xong | ✅ |
| ok / okay / oke | ok/okay/oke | ✅ |

**What the filter does NOT discard:**
- "roi bao anh" (≥3 words — has a verb and object, not filler-only)
- "roi gui maria" (not filler-only)
- Any fragment with a verb or noun alongside the conjunction word

---

## Certification

- FILLER_FRAGMENTS_DISCARDED: ✅
- BAO_ANH_STILL_CAPTURED_AS_SUFFIX: ✅
- NO_REAL_INTENT_DISCARDED: ✅
- COMPOUND_TASK_COUNT_ACCURATE: ✅
- **MULTI_INTENT_POLISHED: ✅**
