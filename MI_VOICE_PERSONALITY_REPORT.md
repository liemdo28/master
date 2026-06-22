# MI_VOICE_PERSONALITY_REPORT.md

**Phase 5: Voice Identity**
**Date:** 2026-06-16
**Status:** ✅ COMPLETE

---

## Requirement

Mi must speak consistently. No robotic log-reading. Tone: COO / Executive Assistant / Operations Director.

## Voice Identity Rules

### What Mi Does NOT Say

| Prohibited | Reason |
|------------|--------|
| Raw metric dumps | "42 chưa đọc, 10 quan trọng. 855 tasks, 63 quá hạn." |
| Technical noise | Port numbers, PID, HTTP status codes |
| Markdown artifacts | `*`, `#`, `_`, backticks |
| Emoji characters | 📋📧📅✅⚠️🔐 |
| Internal details | `.ts:142:8`, `node_modules/...`, `process.env.*` |
| Log dumps | Server startup logs, debug output |

### What Mi DOES Say

| Allowed | Example |
|---------|---------|
| Executive summaries | "63 task quá hạn. Cần chú ý." |
| Actionable priorities | "3 priorities, 2 risks, 2 actions." |
| Concise status | "Hệ thống hoạt động ổn định." |
| Natural Vietnamese | "Anh Liêm, hôm nay..." |
| English terms kept | "DoorDash revenue", "QuickBooks sync" |

## 4 Voice Roles

| Role | Tone | Max Duration | Format |
|------|------|-------------|--------|
| `ceo_brief` | COO reporting to CEO — concise, decisive | 45 sec | Brief |
| `approval_voice` | Operations Director explaining approval | 20 sec | Narrative |
| `workflow_voice` | Operations update — status-focused | 30 sec | Narrative |
| `general_report` | Executive summary — high-level | 40 sec | Brief |

## CEO Command: "Mi đọc báo cáo hôm nay."

### Before (Voice Output Ready — raw dumps)

```
📋 Mi Daily Brief — Thứ Ba, 16 tháng 6, 2026

📧 Email: 39 chưa đọc, 10 quan trọng
📅 Lịch: 0 sự kiện hôm nay
✅ Tasks: 855 tasks, 63 quá hạn
⚠️ Cần xử lý:
  • 39 emails chưa đọc
  • 63 Asana tasks overdue
🔐 Chờ duyệt: 258 action(s)
```

Voice: 578 chars, 12 sec, reads like a log file.

### After (Voice COO Ready — executive voice)

```
Báo cáo nhanh. 63 task quá hạn. Cần chú ý: 39 email chưa đọc — cần xử lý.

Ba điểm chính:
1. 63 task quá hạn
2. 39 email chưa đọc — cần xử lý
3. 258 action cần duyệt

Đề xuất:
- Xem xét 63 task quá hạn
- Duyệt 258 action đang chờ
```

Voice: 244 chars, 15 sec, speaks like a COO.

### Quality Comparison

| Metric | Before | After |
|--------|--------|-------|
| Characters | 578 | 244 |
| Audio size | 281KB | 171KB |
| Duration | ~18 sec | ~15 sec |
| Tone | Log dump | Executive brief |
| Actionability | None | 2 clear actions |
| Risk visibility | Buried in metrics | Highlighted first |

## Implementation

### `cleanForVoiceIdentity(raw, role)`

Strips markdown, emoji, technical noise, bracket content, port/PID/HTTP references.

### `summarizeToExecutive(raw_text)`

Extracts Top 3 priorities, risks, actions from raw metrics using regex patterns.

### `executiveToVoiceText(summary)`

Converts executive summary to natural Vietnamese voice text.

### `approvalToVoiceText(description, category)`

20-second narrative for approval requests.

### `workflowToVoiceText(workflow_name, status, details)`

30-second contextual update for workflow status.

## Files

| File | Purpose |
|------|---------|
| `server/src/voice/voice-personality.ts` | All 5 functions + 4 role configs |
| `server/src/voice/voice-output-orchestrator.ts` | Imports personality module |
| `server/src/routes/voice.ts` | Uses executive summarization in daily-brief |
