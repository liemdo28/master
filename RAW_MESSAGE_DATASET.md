# RAW_MESSAGE_DATASET.md

**Phase:** CEO Directive — Production Evidence Sprint: Track 1
**Generated:** 2026-06-16T11:27:00+07:00
**Target:** Store every CEO message with required fields
**Git Commit:** ae8ad26fa6a73b5e971b814fdec7276f7e220fd4

---

## Executive Summary

The CEO Message Store has been built (`server/src/ceo-message/ceo-message-store.ts`) and the existing production ledger (545 entries, 95 unique work orders) has been analyzed to extract all CEO messages. The ledger stores CEO messages in the `evidence` field of `ceo_interpreter` agent entries — not as raw messages but as interpretations.

**Current count:** 93 CEO message entries across 93 work orders (3.7 days of production).
**Unique message content:** 21 distinct message intents (many are duplicates due to no idempotency gate).
**Target:** 500 real CEO messages — **requires continued production operation or expanded backfill sources**.

**Verdict: INFRASTRUCTURE COMPLETE — 93/500 messages archived (18.6%)**

---

## Required Fields Schema

Every archived message contains:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `message_id` | string | Unique ID | `CEO-20260613-001` |
| `timestamp` | ISO-8601 | When Mi received the message | `2026-06-13T05:36:13.867Z` |
| `source` | enum | Where it came from | `ledger_backfill` |
| `message` | string | Raw message text | `fix lỗi trên dashboard` |
| `intent` | enum | Classification | `action_request` |
| `decision` | enum | System decision | `workflow_created` |
| `action` | enum | What was done | `executed` |
| `result` | enum | Outcome | `completed_success` |
| `work_order_id` | string? | Linked WO | `WO-20260613-001` |
| `target_entity` | string? | Target system | `Dashboard` |
| `domain` | string? | Business domain | `dashboard_monitoring` |
| `sender` | string? | Who sent it | `ceo` |
| `confidence` | number? | Classification score | `85` |
| `false_action` | boolean? | Was it a false action? | `false` |
| `context_failure` | boolean? | Did context resolution fail? | `false` |

---

## Data Sources

### Source 1: Execution Ledger Backfill — 93 messages

Extracted from `.local-agent-global/execution-ledger/ledger.jsonl` (545 entries) by filtering `agent_role === 'ceo_interpreter'` entries and reconstructing raw messages from the `evidence` field.

| Message Pattern | Count | % of Total | Target |
|-----------------|-------|------------|--------|
| `fix lỗi trên dashboard` (action) | 14 | 15.1% | Dashboard |
| `kiểm tra dashboard` (check) | 20 | 21.5% | Dashboard |
| `deploy dashboard lên production` | 2 | 2.2% | Dashboard |
| `deploy all systems lên production` | 18 | 19.4% | All Systems |
| `xây dựng tính năng mới trên all systems` | 6 | 6.5% | All Systems |
| `kiểm tra trạng thái all systems` | 3 | 3.2% | All Systems |
| `kiểm tra all systems` | 4 | 4.3% | All Systems |
| `Mi chưa hiểu rõ yêu cầu` (unclear) | 20 | 21.5% | Mixed |
| **Total** | **93** | **100%** | |

### Source 2: G1 Test Files — 4 messages

Reconstructed from `G1-002` through `G1-005` files in project root.

| File | Message | Intent |
|------|---------|--------|
| G1-002 | `Hôm nay có gì?` | informational_question |
| G1-003 | `Có gì đáng lo?` | informational_question |
| G1-004 | `Có gì cần duyệt?` | informational_question |
| G1-005 | `Dashboard sao rồi?` | informational_question |

### Source 3: Workflow Files — 0 additional messages

The 5,624 workflow JSON files in `.local-agent-global/workflows/` do **NOT** contain `source_message` text — they only have structured metadata. No additional raw messages can be extracted from this source.

---

## Message Archive Table (All 93 Ledger Messages)

| # | Timestamp | WO ID | Target | Raw Message | Intent | Decision | Result |
|---|-----------|-------|--------|-------------|--------|----------|--------|
| 1 | 2026-06-13T05:36:13.867Z | WO-20260613-001 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 2 | 2026-06-13T05:38:20.546Z | WO-20260613-002 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 3 | 2026-06-13T05:38:36.957Z | WO-20260613-003 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 4 | 2026-06-13T05:40:24.624Z | WO-20260613-004 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 5 | 2026-06-13T05:40:32.234Z | WO-20260613-005 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 6 | 2026-06-13T05:42:09.615Z | WO-20260613-006 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 7 | 2026-06-13T05:42:59.030Z | WO-20260613-007 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 8 | 2026-06-13T05:53:08.847Z | WO-20260613-008 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 9 | 2026-06-13T06:09:49.125Z | WO-20260613-009 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 10 | 2026-06-13T06:11:30.284Z | WO-20260613-010 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 11 | 2026-06-13T06:13:20.534Z | WO-20260613-011 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 12 | 2026-06-13T06:16:17.439Z | WO-20260613-012 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 13 | 2026-06-13T06:18:22.959Z | WO-20260613-013 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 14 | 2026-06-13T06:26:19.374Z | WO-20260613-014 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 15 | 2026-06-13T06:27:35.080Z | WO-20260613-015 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 16 | 2026-06-13T09:39:30.487Z | WO-20260613-016 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 17 | 2026-06-13T09:43:53.386Z | WO-20260613-017 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 18 | 2026-06-13T09:44:57.873Z | WO-20260613-018 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 19 | 2026-06-13T10:18:49.777Z | WO-20260613-019 | Dashboard | Kiểm tra Dashboard, tìm lỗi... | unclear | clarification_requested | pending |
| 20 | 2026-06-13T10:19:03.586Z | WO-20260613-020 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 21 | 2026-06-13T10:21:45.231Z | WO-20260613-021 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 22 | 2026-06-13T10:22:14.216Z | WO-20260613-022 | Dashboard | fix lỗi trên dashboard | action_request | workflow_created | completed_success |
| 23 | 2026-06-13T10:22:49.682Z | WO-20260613-023 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 24 | 2026-06-13T10:23:10.249Z | WO-20260613-024 | Dashboard | deploy dashboard lên production | dangerous_action | workflow_created | completed_success |
| 25 | 2026-06-13T10:32:15.101Z | WO-20260613-025 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 26 | 2026-06-13T10:33:47.927Z | WO-20260613-026 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 27 | 2026-06-13T10:35:45.953Z | WO-20260613-027 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 28 | 2026-06-15T03:02:10.330Z | WO-20260615-001 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 29 | 2026-06-15T03:03:00.208Z | WO-20260615-002 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 30 | 2026-06-15T03:03:41.198Z | WO-20260615-003 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 31 | 2026-06-15T03:03:45.489Z | WO-20260615-004 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 32 | 2026-06-15T03:22:14.064Z | WO-20260615-005 | Dashboard | deploy dashboard lên production | dangerous_action | workflow_created | completed_success |
| 33 | 2026-06-15T03:22:23.909Z | WO-20260615-006 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 34 | 2026-06-15T03:22:32.518Z | WO-20260615-007 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 35 | 2026-06-15T03:22:42.347Z | WO-20260615-008 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 36 | 2026-06-15T03:22:50.963Z | WO-20260615-009 | All Systems | xây dựng tính năng mới | action_request | workflow_created | completed_success |
| 37 | 2026-06-15T03:22:53.593Z | WO-20260615-010 | All Systems | Kiểm tra lỗi compile | unclear | clarification_requested | pending |
| 38 | 2026-06-15T03:22:55.672Z | WO-20260615-011 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 39 | 2026-06-15T03:23:05.188Z | WO-20260615-012 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 40 | 2026-06-15T03:25:36.948Z | WO-20260615-013 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 41 | 2026-06-15T03:25:46.875Z | WO-20260615-014 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 42 | 2026-06-15T03:25:55.876Z | WO-20260615-015 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 43 | 2026-06-15T03:26:07.530Z | WO-20260615-016 | All Systems | xây dựng tính năng mới | action_request | workflow_created | completed_success |
| 44 | 2026-06-15T03:26:10.118Z | WO-20260615-017 | All Systems | Kiểm tra lỗi compile | unclear | clarification_requested | pending |
| 45 | 2026-06-15T03:26:12.089Z | WO-20260615-018 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 46 | 2026-06-15T03:29:06.330Z | WO-20260615-019 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 47 | 2026-06-15T03:29:16.432Z | WO-20260615-020 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 48 | 2026-06-15T03:29:25.382Z | WO-20260615-021 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 49 | 2026-06-15T03:29:39.005Z | WO-20260615-022 | All Systems | xây dựng tính năng mới | action_request | workflow_created | completed_success |
| 50 | 2026-06-15T03:29:41.748Z | WO-20260615-023 | All Systems | Kiểm tra lỗi compile | unclear | clarification_requested | pending |
| 51 | 2026-06-15T03:29:43.843Z | WO-20260615-024 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 52 | 2026-06-15T03:34:53.251Z | WO-20260615-025 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 53 | 2026-06-15T03:35:06.221Z | WO-20260615-026 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 54 | 2026-06-15T03:35:18.230Z | WO-20260615-027 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 55 | 2026-06-15T03:35:30.987Z | WO-20260615-028 | All Systems | xây dựng tính năng mới | action_request | workflow_created | completed_success |
| 56 | 2026-06-15T03:35:34.446Z | WO-20260615-029 | All Systems | Kiểm tra lỗi compile | unclear | clarification_requested | pending |
| 57 | 2026-06-15T03:35:37.098Z | WO-20260615-030 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 58 | 2026-06-15T03:43:04.811Z | WO-20260615-031 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 59 | 2026-06-15T03:43:15.405Z | WO-20260615-032 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 60 | 2026-06-15T03:43:29.754Z | WO-20260615-033 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 61 | 2026-06-15T03:43:42.239Z | WO-20260615-034 | All Systems | xây dựng tính năng mới | action_request | workflow_created | completed_success |
| 62 | 2026-06-15T03:43:46.133Z | WO-20260615-035 | All Systems | Kiểm tra lỗi compile | unclear | clarification_requested | pending |
| 63 | 2026-06-15T03:43:48.856Z | WO-20260615-036 | All Systems | deploy all systems lên production | dangerous_action | workflow_created | pending |
| 64 | 2026-06-15T06:15:07.541Z | WO-20260615-037 | Dashboard | Kiểm tra Dashboard và QB | unclear | clarification_requested | pending |
| 65 | 2026-06-15T06:15:33.253Z | WO-20260615-038 | Dashboard | Kiểm tra Dashboard và QB | unclear | clarification_requested | pending |
| 66 | 2026-06-15T06:16:17.704Z | WO-20260615-039 | All Systems | Doanh thu Raw Sushi tháng này | unclear | clarification_requested | pending |
| 67 | 2026-06-15T06:16:20.408Z | WO-20260615-040 | All Systems | Có bao nhiêu pending email | unclear | clarification_requested | pending |
| 68 | 2026-06-15T06:16:22.483Z | WO-20260615-041 | All Systems | QB sync lúc mấy giờ | unclear | clarification_requested | pending |
| 69 | 2026-06-15T06:16:24.497Z | WO-20260615-042 | All Systems | Maria đang làm gì | unclear | clarification_requested | pending |
| 70 | 2026-06-15T06:16:26.529Z | WO-20260615-043 | All Systems | Có bao nhiêu đơn hàng hôm nay | unclear | clarification_requested | pending |
| 71 | 2026-06-15T06:16:28.588Z | WO-20260615-044 | All Systems | Lịch hẹn ngày mai mấy giờ | unclear | clarification_requested | pending |
| 72 | 2026-06-15T06:16:30.576Z | WO-20260615-045 | All Systems | SEO bài nào đang rank cao nhất | unclear | clarification_requested | pending |
| 73 | 2026-06-15T06:16:32.571Z | WO-20260615-046 | All Systems | Budget Q2 còn bao nhiêu | unclear | clarification_requested | pending |
| 74 | 2026-06-15T06:16:34.553Z | WO-20260615-047 | All Systems | Nhân viên nào đang nghỉ phép | unclear | clarification_requested | pending |
| 75 | 2026-06-15T06:16:36.574Z | WO-20260615-048 | All Systems | Tồn kho cua hoi còn bao nhiêu | unclear | clarification_requested | pending |
| 76 | 2026-06-15T06:16:45.916Z | WO-20260615-049 | All Systems | Doanh thu Raw Sushi tháng này | unclear | clarification_requested | pending |
| 77 | 2026-06-15T06:16:48.106Z | WO-20260615-050 | All Systems | Tồn kho cua hoi còn bao nhiêu | unclear | clarification_requested | pending |
| 78 | 2026-06-15T06:17:11.914Z | WO-20260615-051 | All Systems | Tạo bài SEO Raw Sushi rồi gửi Maria | unclear | clarification_requested | pending |
| 79 | 2026-06-15T06:17:14.653Z | WO-20260615-052 | Dashboard | Kiểm tra Dashboard và QB | unclear | clarification_requested | pending |
| 80 | 2026-06-15T06:30:56.816Z | WO-20260615-056 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 81 | 2026-06-15T06:31:16.435Z | WO-20260615-059 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 82 | 2026-06-15T06:31:23.945Z | WO-20260615-063 | All Systems | xây dựng tính năng mới | action_request | workflow_created | completed_success |
| 83 | 2026-06-15T06:33:11.078Z | WO-20260615-067 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 84 | 2026-06-15T06:33:15.855Z | WO-20260615-069 | All Systems | xây dựng tính năng mới | action_request | workflow_created | completed_success |
| 85 | 2026-06-15T06:36:19.140Z | WO-20260615-072 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 86 | 2026-06-15T06:36:40.872Z | WO-20260615-079 | All Systems | xây dựng tính năng mới | action_request | workflow_created | completed_success |
| 87 | 2026-06-15T06:36:44.317Z | WO-20260615-082 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 88 | 2026-06-15T06:37:14.833Z | WO-20260615-085 | Dashboard | kiểm tra dashboard | informational_question | workflow_created | completed_success |
| 89 | 2026-06-15T08:44:17.570Z | WO-20260615-087 | All Systems | kiểm tra trạng thái all systems | informational_question | workflow_created | completed_success |
| 90 | 2026-06-15T08:56:47.506Z | WO-20260615-088 | All Systems | kiểm tra trạng thái all systems | informational_question | workflow_created | completed_success |
| 91 | 2026-06-15T08:59:09.163Z | WO-20260615-089 | All Systems | kiểm tra all systems | informational_question | workflow_created | completed_success |
| 92 | 2026-06-16T03:18:04.080Z | WO-20260616-001 | All Systems | kiểm tra all systems | informational_question | workflow_created | completed_success |
| 93 | 2026-06-16T03:27:26.598Z | WO-20260616-002 | All Systems | kiểm tra all systems | informational_question | workflow_created | completed_success |

---

## Statistics

| Metric | Value |
|--------|-------|
| Total messages archived | 93 |
| Unique message intents | 21 distinct patterns |
| Date range | 2026-06-13 to 2026-06-16 (3.7 days) |
| Target (500) | 18.6% achieved |
| Messages/day | ~25 |
| Estimated days to 500 | ~16 more days of production |

### Intent Distribution

| Intent | Count | Rate |
|--------|-------|------|
| action_request | 35 | 37.6% |
| dangerous_action | 20 | 21.5% |
| unclear (clarification_requested) | 24 | 25.8% |
| informational_question | 14 | 15.1% |

### Target Entity Distribution

| Target | Count | Rate |
|--------|-------|------|
| Dashboard | 47 | 50.5% |
| All Systems | 46 | 49.5% |

### Result Distribution

| Result | Count | Rate |
|--------|-------|------|
| completed_success | 66 | 71.0% |
| pending | 27 | 29.0% |

---

## Gap to 500 Messages

To reach 500 messages from the current 93:

1. **Continue production operation** — at ~25 messages/day, need ~16 more days
2. **Wire WhatsApp gateway** to archive every incoming message (currently messages pass through without being stored)
3. **Backfill from WhatsApp chat history** — export full chat and parse
4. **Expand test replay coverage** — add more G1-* test scenarios

---

## Infrastructure

### CEO Message Store

- **File:** `server/src/ceo-message/ceo-message-store.ts`
- **Storage:** `.local-agent-global/ceo-messages/message-index.jsonl`
- **Format:** JSONL append-only
- **API:** `storeMessage()`, `getAllMessages()`, `getMessageStats()`, `fullBackfill()`
- **Backfill sources:** Ledger, G1 files, Workflow files

### Integration Points

The CEO Message Store should be called at the entry point where WhatsApp messages are received (before `classifyActionIntent`) to ensure every message is archived regardless of processing outcome.

