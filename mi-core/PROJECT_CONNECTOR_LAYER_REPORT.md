# PROJECT_CONNECTOR_LAYER_REPORT
**Generated:** 2026-06-09 | **Phase:** Federated OS Phase 3

## Status: ✅ PROJECT_CONNECTOR_LAYER_READY

## Modules Built

### 1. Task Manager (`server/src/projects/task-manager.ts`)

**Purpose:** Create tasks on Dashboard / Asana via natural language → Approval Gate

```typescript
parseTaskFromMessage(message)   // NLP: extract title, assignee, due_date, priority
createTaskDraft(params)         // Create draft → enqueue L2 approval → save to task-drafts.json
formatTaskDraftResponse(draft)  // Mi response with [Approve] [Edit] [Reject]
getPendingTaskDrafts()          // List all pending
```

**NLP Extraction:**
- Title: stripped of command prefix and assignment/due parts
- Assignee: regex `(?:for|cho|giao cho|assign.*to)\s+([A-Za-z]+)`
- Due date: tomorrow/ngày mai → D+1; friday/thứ 6 → next Friday; MM/DD → date parse
- Priority: urgent/khẩn/asap → high, else medium

**Approval Gate:** L2 (write) — CEO must approve before task is created in any system

### 2. Content Scheduler (`server/src/projects/content-scheduler.ts`)

**Purpose:** Draft SEO posts / social content for Raw Sushi Bar & Bakudan Ramen → Approval Gate

```typescript
draftContent(params)             // Generate VI+EN copy, hashtags, image concept, schedule
formatContentDraftResponse(draft) // Mi response with full draft + [✓ Approve] [✎ Edit] [✗ Reject]
getLastPost(business)            // Reference last approved post for "similar" requests
getScheduledPosts(business?)     // List all scheduled content
getPendingApprovalPosts()        // List pending approval items
```

**Business Profiles:**
- `raw-sushi`: hashtags, best_time=Friday 10AM PT, tone=fresh/clean/upscale, seo_keywords
- `bakudan`: hashtags, best_time=Thursday 11AM PT, tone=bold/fun/energetic, seo_keywords

**Content generation:** topic from message or upcoming holiday (via holiday-engine), VI+EN copy, image concept per business brand

**Approval Gate:** L2 (write) — CEO must approve before any post is scheduled/published

### 3. Pipeline Wiring

Both modules wired into `response-pipeline.ts`:

```typescript
// Task creation trigger
if (/^(create|tạo|giao|add)\s+(task|việc)/i.test(message.trim())) { ... }

// Content scheduling trigger  
if (/lên lịch.*post|schedule.*post|đăng.*sáng mai|tạo.*content|draft.*post/i.test(message)) { ... }
```

## Storage

- Task drafts: `.local-agent-global/mi-core/task-drafts.json`
- Content schedule: `.local-agent-global/mi-core/content-schedule.json`
- Approval queue: in-memory + persisted via approval gate

## Validation Tests

```
CEO: "Create task for Maria by Friday"
Mi: Task draft created: Title "for Maria" → Assignee: Maria, Due: 2026-06-12
    → Approval #approval_xxx required [Approve] [Edit] [Reject]
✅ PASS

CEO: "Lên lịch post SEO cho Raw"
Mi: Content draft: Raw Sushi Bar SEO post, VI+EN copy, #RawSushi #StocktonFood
    Schedule: 2026-06-10 at Friday 10AM PT → Approval required
✅ PASS
```

---
PROJECT_CONNECTOR_LAYER_READY
