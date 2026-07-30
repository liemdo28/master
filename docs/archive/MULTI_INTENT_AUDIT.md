# MULTI-INTENT AUDIT

**Date:** 2026-06-15
**Target:** Verify multi-intent support

## Test: Single message containing Dashboard + QB + SEO + Email

**Test Input:**
```
"Hôm nay Dashboard sao rồi? Kiểm tra QB luôn. Tạo bài SEO cho Raw Sushi. Soạn email cho Maria."
```

**Expected (Human):**
1. Dashboard status check
2. QB sync status check
3. SEO article creation for Raw Sushi
4. Email draft for Maria

## Architecture Evidence

### Intent Classifier (`server/src/brain/intent-classifier.ts`)

```typescript
export interface ClassifiedIntent {
  domain: IntentDomain;  // SINGLE domain, not array
  brain: BrainName;      // SINGLE brain
  confidence: number;
  // ...
}
```

**Key finding:** The return type is `ClassifiedIntent` (singular), not `ClassifiedIntent[]`. One message → one domain → one brain → one response.

### Pipeline (`server/src/pipeline/response-pipeline.ts`)

```typescript
const classifiedIntent = classifyIntent(message);
const brainConfig = selectBrainConfig(classifiedIntent);
```

**Key finding:** Single intent classification, single brain selection. No task decomposition, no command splitting.

### DEV4 Evidence (`DEV4_WHATSAPP_QA_REPORT.md`)

- "dash sao roi" → matched DoorDash (not Dashboard)
- "raw sushi seo" → worked (single intent)
- Multi-turn entity carryover failed for "post website" after "Raw Sushi"
- No test in DEV4 attempted a multi-intent message

### MULTI_INTENT_REPORT.md (Red Team Report)

Already documented:
- "Single-intent system operating in a multi-intent world"
- Multi-intent score: 1/10
- No command splitting, no parallel execution, no sequential chaining

## What Actually Happens with Multi-Intent Messages

**Input:** `"Dashboard sao rồi? Kiểm tra QB luôn. Tạo bài SEO cho Raw Sushi. Soán email cho Maria."`

**Predicted behavior:**
1. `classifyIntent()` matches FIRST keyword → likely `briefing` or `project_status`
2. Pipeline routes to ONE brain
3. Three of four tasks are **silently dropped**
4. CEO receives response for ONE task only

## Evidence from Source Code

1. **`intent-classifier.ts`** — Returns single `ClassifiedIntent`, not array
2. **`response-pipeline.ts`** — Calls `classifyIntent()` once, routes once
3. **`chat.ts`** — `processMessage()` calls pipeline once per message
4. **`whatsapp.ts`** — Same pattern: single pipeline call per message
5. **Search result:** `multi.*intent|split.*command|task.*decomposition` → **ZERO matches**

## Verdict: CONFIRMED

**Multi-intent support does not exist.** The architecture is single-intent:
- One classifier → one brain → one response per message
- No task decomposition or command splitting
- Multiple requests in a single message result in silent data loss
- CEO will experience Mi as "ignoring" part of their request
