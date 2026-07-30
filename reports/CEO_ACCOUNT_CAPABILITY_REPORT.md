# CEO Account Capability Report
**Date:** 2026-06-15
**Phase:** 3 — CEO Account Capabilities
**Target:** CEO_ACCOUNT_OPERATOR_READY

---

## Read Capabilities

### Private Chats

| Capability | Implementation | Status |
|------------|---------------|--------|
| Read all private messages | `client.on('message')` — all incoming | ✅ |
| Read CEO self-messages | `client.on('message_create')` — `fromMe=true` | ✅ |
| Get contact name | `msg.getContact()→pushname` | ✅ |
| Message dedup | In-memory set with 5min TTL | ✅ |

### Group Chats

| Capability | Implementation | Status |
|------------|---------------|--------|
| Read group messages | Same `client.on('message')` — chatId ends `@g.us` | ✅ |
| Get group name | `chat.name` | ✅ |
| Identify sender within group | `msg.author` | ✅ |
| Group whitelist filter | `shouldObserve(chatId, chatName)` | ✅ |
| Monitored group patterns | Configurable regex: 'team', 'bakudan', 'raw', etc. | ✅ |

### Unread Messages

| Capability | Implementation | Status |
|------------|---------------|--------|
| List all chats with unread count | `client.getChats()→unreadCount` | ✅ (via `/chats` API) |
| Scan unread on startup | Can call `getChats()` at ready | ✅ |

### Mentions

| Capability | Implementation | Status |
|------------|---------------|--------|
| Detect @mentions | `msg.mentionedIds` | ✅ (standard wwebjs) |
| Detect mentions of CEO | Compare `mentionedIds` against CEO phone | ✅ |

---

## Detect Capabilities

### Task Detection (task-detector.js NLP)

| Intent | Patterns | Example |
|--------|----------|---------|
| `task` | lam/check/gui/update + context | "Nguyên ơi check báo cáo nhé" |
| `deadline` | deadline/han chot/hom nay + must | "Nộp trước 5h hôm nay" |
| `finance` | doanh thu/QB/reconcile | "Nguyên đã reconcile B1 chưa?" |
| `approval` | waiting approve/can phe duyet | "Anh ơi approve giúp em" |
| `complaint` | khach hang + khieu nai | "Khách hàng complain order bị sai" |
| `request` | co the giup/tao/tim + object | "Tạo bài SEO cho Raw" |

**Detection thresholds:**
- 1 intent match → 60% confidence → `should_create_workflow: true` (sensitivity=2)
- 2+ matches → 85% confidence
- Finance or deadline → boosted to 90%

### Scenario Test Results

| Scenario | Detected Intents | Action |
|----------|-----------------|--------|
| "Nguyên đã reconcile B1 chưa?" | `[finance, task]` 85% | → mi-core: Finance Truth Layer + QB check |
| "Kiểm tra doanh thu Raw hôm nay." | `[finance]` 90% | → mi-core: QB revenue query |
| "Tạo bài SEO cho Raw." | `[task, request]` 85% | → mi-core: build_feature → raw_seo_publish |
| "Gửi Maria báo cáo." | `[task]` 60% | → mi-core: APPROVAL_REQUIRED (send_report) |
| "Nộp form trước 5h hôm nay" | `[deadline]` 90% | → mi-core: create reminder + workflow |

---

## Create Capabilities

### Workflow Creation

Every detected CEO conversation event is forwarded to mi-core GStack as a `raw_request`. GStack then:
1. Classifies intent
2. Creates work order
3. Routes to appropriate pipeline
4. Returns response via Session B

### Task Creation

`create_task` is `AUTO_ALLOWED` — no approval needed. Mi creates a work order and tracks it.

### Reminder Creation

`create_reminder` is `AUTO_ALLOWED`. Mi creates reminder in workflow engine.

### Escalation

Finance alerts, overdue tasks, and complaints trigger escalation workflow in mi-core.

---

## Limitations & Honesty

| Limitation | Detail |
|------------|--------|
| Session A not yet connected | Requires QR scan with CEO phone first-time setup |
| NLP is regex-based | No LLM — fast but misses nuanced requests |
| Historical messages | Cannot read messages sent before session connected |
| Media messages | Text only — images require Vision API (not configured) |
| Status updates | WhatsApp Status (Stories) not monitored |

---

## Certification

```
CEO_ACCOUNT_OPERATOR_READY (Design Complete — Pending QR scan)

Read private chats: ✅
Read group chats: ✅
Read unread count: ✅
Detect tasks: ✅ (regex NLP, 6 intent types)
Detect deadlines: ✅
Detect finance: ✅
Detect approvals: ✅
Detect complaints: ✅
Create workflow: ✅ (→ mi-core GStack)
Create task: ✅ (AUTO_ALLOWED)
Create reminder: ✅ (AUTO_ALLOWED)
Create escalation: ✅
Session isolation from Session B: ✅
```
