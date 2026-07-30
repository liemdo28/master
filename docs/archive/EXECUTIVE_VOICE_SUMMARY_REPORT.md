# EXECUTIVE_VOICE_SUMMARY_REPORT.md

**Phase 2: Executive Summarization**
**Date:** 2026-06-16
**Status:** ✅ COMPLETE

---

## Problem

Raw daily brief contained metrics dumps:
```
📧 Email: 39 chưa đọc, 10 quan trọng
📅 Lịch: 0 sự kiện hôm nay
✅ Tasks: 855 tasks, 63 quá hạn
🔐 Chờ duyệt: 258 action(s)
```

CEO wants: **Top 3 priorities, Top 3 risks, Top 3 actions.**

## Solution

`voice-personality.ts` → `summarizeToExecutive(raw_text)` → `executiveToVoiceText(summary)`

### Raw → Executive Transformation

**Before (raw dump):** 578 characters, reads like a log
**After (executive):** 244 characters, speaks like a COO

| Raw Metric | Executive Summary |
|------------|-------------------|
| "39 chưa đọc" | `39 email chưa đọc — cần xử lý` (risk) |
| "855 tasks, 63 quá hạn" | `63 task quá hạn` (risk) + `Xem xét 63 task quá hạn` (action) |
| "258 action cần duyệt" | `258 action cần duyệt` (priority) + `Duyệt 258 action đang chờ` (action) |

### Actual Voice Output

```
Báo cáo nhanh. 63 task quá hạn. Cần chú ý: 39 email chưa đọc — cần xử lý.

Ba điểm chính:
1. 63 task quá hạn
2. 39 email chưa đọc — cần xử lý
3. 258 action cần duyệt

Đề xuất:
- Xem xét 63 task quá hạn
- Duyet 258 action đang chờ
```

### Synthesis Result

| Metric | Value |
|--------|-------|
| Characters | 244 |
| Audio size | 171,504 bytes |
| Synthesis time | 13,038ms |
| Voice | vi-VN-HoaiMyNeural |
| Duration (est.) | ~15 seconds |

### API Evidence

```bash
curl -X POST http://localhost:4001/api/voice/output/daily-brief \
  -H "Content-Type: application/json" \
  -d '{"is_ceo": true}'
```

Response:
```json
{
  "ok": true,
  "workflow_id": "daily-brief-1781571878385",
  "text_length": 244,
  "tts": { "available": true, "file_size_bytes": 171504 }
}
```

### Top 3 Extraction Logic

| Priority | Source | Example |
|----------|--------|---------|
| 1 | Overdue tasks | `63 task quá hạn` |
| 2 | Unread emails | `39 email chưa đọc — cần xử lý` |
| 3 | Pending approvals | `258 action cần duyệt` |

| Risk | Source | Example |
|------|--------|---------|
| 1 | High email volume | `39 email chưa đọc — cần xử lý` |
| 2 | Overdue tasks | `63 task quá hạn` |
| 3 | Backlog | (derived from approvals) |

| Action | Source | Example |
|--------|--------|---------|
| 1 | Overdue review | `Xem xét 63 task quá hạn` |
| 2 | Approval queue | `Duyet 258 action đang chờ` |

## Files

| File | Purpose |
|------|---------|
| `server/src/voice/voice-personality.ts` | `summarizeToExecutive()`, `executiveToVoiceText()` |
| `server/src/routes/voice.ts` | `/api/voice/output/daily-brief` — uses executive summary |
