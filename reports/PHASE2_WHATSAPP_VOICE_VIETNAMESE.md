# Phase 2 — WhatsApp Voice Vietnamese Mode

**Status:** COMPLETE  
**Date:** 2026-06-11

## Deliverables

| File | Purpose |
|------|---------|
| `server/src/voice/audio-store.ts` | Save voice notes to local disk + MinIO; PG table `voice_audio` |
| `server/src/voice/transcription-service.ts` | faster-whisper via Python subprocess; model=medium, lang=vi |
| `server/src/voice/vietnamese-intent-parser.ts` | Pattern-based intent detection (9 intents + free_text fallback) |
| `server/src/voice/tts-service.ts` | TTS stub (disabled; Kokoro/XTTS planned) |
| `server/src/voice/whatsapp-voice-handler.ts` | Full pipeline: detect → download → MinIO → transcribe → intent → reply |
| `server/src/routes/voice.ts` | GET /health, POST /transcribe, POST /test |

## Pipeline
```
WhatsApp voice note → download → MinIO storage → faster-whisper transcription
→ Vietnamese intent parser → Mi pipeline → WhatsApp reply
```

## Intent Types
`store_health`, `daily_briefing`, `system_status`, `task_list`, `approvals_check`, `review_check`, `bigdata_health`, `node_status`, `create_task`, `free_text`

## Requirements
- `pip install faster-whisper` on Mi-Core PC
- PYTHON_BIN env var (defaults to `python` on Windows)
- WHISPER_MODEL env var (default: `medium`)
