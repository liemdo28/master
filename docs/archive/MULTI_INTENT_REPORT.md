# 🔴 MULTI-INTENT REPORT — Track R4

**Date:** 2026-06-15
**Target:** Mi-Core (mi-core)
**Red Team Status:** HIGH — MULTI-INTENT HANDLING PROVES INADEQUATE

---

## Executive Summary

Mi-Core processes messages through a **single-intent pipeline**. The intent classifier assigns ONE domain, ONE intent, ONE brain per message. There is no command splitting, no multi-action planning, and no parallel task execution. A CEO message containing multiple intents will have most intents silently dropped.

---

## EVIDENCE

### Single-Intent Architecture

**File:** `server/src/brain/intent-classifier.ts`

```typescript
export interface ClassifiedIntent {
  domain: string;
  intent: string;
  brain: BrainName;
  confidence: number;
  raw: string;
  entities: string[];
  language: string;
}
```

One message → One `ClassifiedIntent` → One brain → One response. No array of intents, no task decomposition.

**Search results:** Pattern `multi.*intent|multi.*command|split.*command|parse.*commands` returned **ZERO matches** in the entire codebase.

---

## MULTI-INTENT ATTACK SCENARIOS

### Scenario 1: The CEO Morning Message

**Input:**
```
"Hôm nay anh có gì? À kiểm tra QB luôn rồi tạo bài SEO cho Raw Sushi rồi gửi Maria."
```

**Expected (human):**
1. Check QB status
2. Create SEO article for Raw Sushi
3. Send to Maria

**What Mi does:** The intent classifier picks ONE intent based on first-match regex. Likely picks "QB status" (first keyword match). The SEO article request and Maria email are **silently ignored**.

---

### Scenario 2: Multi-Action Business Request

**Input:**
```
"Check dashboard health, then draft a Gmail about Q3 targets, and also update the Asana board for Stone Oak."
```

**What Mi does:** Classifies as ONE of:
- `dashboard_status` (if "dashboard" matches first)
- `gmail_draft` (if "gmail" matches first)  
- `asana_task` (if "asana" matches first)

The other two requests are lost.

---

### Scenario 3: Compound Vietnamese Command

**Input:**
```
"Tạo bài SEO cho Raw Sushi, so sánh doanh thu với Stone Oak, rồi gửi email tóm tắt cho Maria."
```

**Translation:** "Create SEO article for Raw Sushi, compare revenue with Stone Oak, then send summary email to Maria."

**What Mi does:** One intent classified. Two of three tasks dropped.

---

### Scenario 4: The "While You're At It" Pattern

**Input:**
```
"QB sao rồi? À顺便检查一下website SEO." (QB status? Oh also check website SEO.)
```

**What Mi does:** The Chinese/Vietnamese mixed language may cause the classifier to fail entirely, returning a fallback "general" response that addresses neither task.

---

### Scenario 5: Approval Chain Request

**Input:**
```
"Approve the Stone Oak invoice and reject the Raw Sushi order, then tell me why."
```

**What Mi does:** The approval handler (`approve APP-xxx` or `reject APP-xxx`) uses regex matching. It may detect "approve" or "reject" but not both. The "tell me why" meta-question is completely lost.

---

### Scenario 6: Delegation Pattern

**Input:**
```
"Assign the QB monthly report to John, schedule a meeting with Maria about Raw Sushi expansion, and update the project board."
```

**What Mi does:** No delegation/scheduling system exists in the intent classifier. This entire message likely falls to the "general conversation" fallback.

---

### Scenario 7: Sequential Dependency

**Input:**
```
"First check if the QuickBooks data is ready, then generate the monthly report, then email it to the team."
```

**What Mi does:** No sequential task chaining exists. Even if all three intents were detected, there's no DAG/dependency system to execute them in order.

---

### Scenario 8: Conditional Request

**Input:**
```
"If QB revenue is above 50k, draft a celebration email. If below, draft a warning email."
```

**What Mi does:** No conditional logic exists in the intent pipeline. The message is classified as a single "QB status" or "general" intent.

---

## WHAT EXISTS vs WHAT'S NEEDED

| Capability | Current State | Required for CEO |
|-----------|---------------|-----------------|
| Multi-intent detection | ❌ Single intent per message | ✅ Detect 2-5 intents per message |
| Command splitting | ❌ Not implemented | ✅ Split "A then B then C" into tasks |
| Sequential execution | ❌ Not implemented | ✅ Execute A → B → C with dependencies |
| Parallel execution | ❌ Not implemented | ✅ Execute independent tasks simultaneously |
| Conditional logic | ❌ Not implemented | ✅ "If X then Y else Z" |
| Task decomposition | ❌ Not implemented | ✅ Break complex requests into subtasks |
| Confirmation of scope | ❌ Not implemented | ✅ "I'll do 3 things: X, Y, Z. Proceed?" |

---

## VERDICT

**Multi-Intent Score: 1/10**

Mi-Core is a **single-intent system** operating in a **multi-intent world**. A CEO's natural communication style involves 2-4 simultaneous requests per message. Mi silently drops all but one, with no acknowledgment that tasks were lost.

**User experience:** The CEO will think Mi is "dumb" or "not listening" because it only handles one thing at a time and ignores the rest.
