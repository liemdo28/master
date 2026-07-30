# 🔴 WORKFLOW REALITY REPORT — Track R7

**Date:** 2026-06-15
**Target:** Mi-Core (mi-core)
**Red Team Status:** HIGH — GAP BETWEEN WHAT MI SAYS AND WHAT MI DOES

---

## Executive Summary

When Mi says "I'll do it" or "Để mình xử lý", the actual execution depends on which pipeline handles the message. Many "actions" are **LLM-generated text responses that sound like actions** but don't create any workflow, work order, approval, or task. The gap between Mi's verbal commitment and actual system state changes is significant.

---

## ACTION FLOW ANALYSIS

### What "I'll do it" Actually Means

**Path 1: Action Router (Real Action)**
```
User: "Gửi email cho Maria" 
→ intent: gmail_send (Level 3)
→ action-router.ts → enqueue()
→ approval gate → pending approval
→ User approves → gmail-adapter → actually sends
```
✅ **Real workflow created.** But requires explicit "approve APP-xxx" to execute.

**Path 2: LLM Response (Fake Action)**
```
User: "Tạo plan marketing cho Raw Sushi"
→ intent: general conversation
→ LLM generates a marketing plan in natural language
→ Mi says: "Đây là plan marketing cho Raw Sushi: ..."
```
❌ **No task created. No workflow. No approval. Just text.**

**Path 3: Deterministic CEO Command (Partial Action)**
```
User: "QB status"
→ routeCeoCommand() → direct SQL query
→ Returns formatted data
→ Mi says: "QB tháng này: $45,231..."
```
✅ **Real data retrieved.** But no "task" or "work order" created.

---

## GAP MATRIX

| Mi Says | Actually Happens | Workflow Created? | Task Created? | Approval Created? |
|---------|-----------------|-------------------|---------------|-------------------|
| "Mình sẽ gửi email cho Maria" | Enqueued for approval | ✅ | ⚠️ In-memory only | ✅ In-memory |
| "Mình sẽ kiểm tra dashboard" | LLM generates text response | ❌ | ❌ | ❌ |
| "Để mình tạo bài SEO" | LLM writes SEO content in response | ❌ | ❌ | ❌ |
| "Mình sẽ update Asana" | No Asana write API call | ❌ | ❌ | ❌ |
| "OK đã xử lý xong" | May be just acknowledgment text | ❌ | ❌ | ❌ |
| "Mình sẽ phân tích dữ liệu" | LLM generates analysis text | ❌ | ❌ | ❌ |
| "Đang tạo report..." | May be streaming LLM response | ❌ | ❌ | ❌ |

---

## CRITICAL GAPS

### Gap 1: No Work Order System

The codebase has:
- `approval/gate.ts` — In-memory approval queue for actions
- `autonomous-execution-engine.ts` — Autonomous task classification
- No persistent work order table
- No task tracking database
- No task history

When Mi says "I'll create a task for that", there is **no task creation API**. The approval gate only handles Gmail/Drive/File actions.

### Gap 2: No Workflow Persistence

The approval queue is entirely in-memory:
```typescript
const queue = new Map<string, ApprovalAction>();
```
Server restart = all pending "workflows" vanish. Mi may have promised to do something, but the promise evaporates.

### Gap 3: No Completion Tracking

There's no system to track:
- Was the promised action actually completed?
- Was the email actually sent?
- Was the report actually generated?
- Was the Asana task actually created?

Mi says "done" but there's no verification that anything actually happened.

### Gap 4: Skill Execution Without Confirmation

The skill registry (`gstack/skills/skill-registry.ts`) can execute skills, but:
- Skills are registered in-memory
- Skill execution results are not persisted
- No audit trail of what skills ran and what they produced

### Gap 5: LLM Response ≠ Action

The most dangerous gap: when Mi responds with natural language describing an action it will take, the CEO reasonably assumes the action was taken. But often, the LLM is just generating a helpful-sounding text response without any side effects.

**Example:**
```
CEO: "Tạo bài SEO cho Raw Sushi"
Mi: "Đã tạo bài SEO cho Raw Sushi với các từ khóa chính: [list]. 
     Bài viết bao gồm: [content]. Đã lưu vào Drive."
     
Reality: No file was created. No Drive upload happened. Mi just described 
what it WOULD create if it had the capability.
```

---

## AUTONOMOUS EXECUTION BOUNDARY

The autonomous execution engine defines these categories:

**FULL_AUTO (no approval):** Health monitoring, log analysis, audit reads, QA, docs, reporting, knowledge search, memory sync, graph refresh

**NOTIFY_AFTER:** Safe auto-fix, skill execution, certification

**BLOCKED:** Production deploy, data delete, payment, credential change, customer reply, DB mutation

**The gap:** The BLOCKED list is enforced by `classifyTask()` returning a category, but there's no actual code that prevents execution. It's advisory-only. If a message bypasses the autonomous router and goes through the action router directly, the BLOCKED classification is never checked.

---

## EVIDENCE: WHAT CREATES WHAT

| System | Creates | Persists? | Auditable? |
|--------|---------|-----------|-----------|
| Action Router | ApprovalAction (in-memory) | ❌ No | ❌ No |
| Autonomous Engine | TaskClassification (in-memory) | ❌ No | ❌ No |
| Conversation Store | ConversationSession (in-memory) | ❌ No | ❌ No |
| Memory API | JSON files on disk | ✅ Yes | ⚠️ Partial |
| QB Connector | Read-only DB queries | N/A | ⚠️ Via logs |

**Zero persistent workflow artifacts are created by Mi during normal conversation.**

---

## VERDICT

**Workflow Reality Score: 2/10**

Mi-Core has a significant gap between what it says and what it does. The LLM generates confident, action-oriented responses ("I'll do it", "Đã xử lý", "Để mình tạo") but the underlying system often:
1. Creates no workflow/work order
2. Creates no persistent task
3. Creates no approval record
4. Tracks no completion status
5. Has no audit trail

**A CEO relying on Mi's verbal commitments will believe tasks are being done when they are not.**
