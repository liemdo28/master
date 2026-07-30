# BILINGUAL VOICEOVER SYSTEM — ARCHITECTURE

## Overview

Production-ready bilingual (English + Vietnamese) voiceover and dubbing system integrated into the existing `ai-video-guide-system` monorepo.

## System Architecture

```
Mi / Admin
     |
     v
Voiceover Service (port 3010)  - NEW
     |  REST API: /api/voiceover/*
     |-- Script Manager (normalization + pronunciation)
     |-- Translation Manager (EN<->VI via OpenAI GPT)
     |-- TTS Router (primary/fallback per language)
     |      |-- Edge TTS Engine (baseline, always available)
     |      |-- Fish Speech Engine (GPU recommended)
     |      `-- OpenVoice Engine (voice cloning)
     |-- Audio QA Service (Whisper transcription + similarity scoring)
     |-- Video Mixer (FFmpeg)
     |-- Subtitle Exporter (SRT)
     `-- Reporter (QA reports + Mi workflow)
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Voiceover Service | 3010 | Job management, generation orchestration |
| API Server | 3001 | Existing backend (tRPC, SQLite) |
| Narration Service | 3004 | OpenAI GPT for translation |
| TTS Service | 3005 | Legacy Edge TTS (deprecated for bilingual work) |
| Remotion Renderer | 3003 | Video rendering (reused for final mux) |
| Admin Dashboard | 5173 | React frontend (extended with voiceover pages) |

## Data Flow

```
Admin Dashboard - API Server(3001) - Voiceover Service(3010)
                                        |
                                        |-- TTS Router - Edge TTS / Fish Speech / OpenVoice
                                        |-- Translation Service - OpenAI GPT
                                        |-- Audio QA - Whisper API
                                        |-- Video Mixer - Remotion/FFmpeg
                                        `-- Mi Workflow - CEO notification
```

## Job State Machine

```
draft - script_processing - awaiting_script_approval
  - generating_en - generating_vi - audio_qa
    - mixing_video - video_qa - approved - completed
                      | human_review_required
  - failed / cancelled
```

## Storage Layout

```
storage/voiceover/
|-- projects/{project_id}/
|   |-- source/
|   |-- scripts/
|   |-- reference-voices/
|   |-- segments/{en,vi}/
|   |-- subtitles/
|   |-- previews/
|   |-- outputs/
|   `-- reports/
|-- models/
|-- voices/
|-- pronunciation/
|-- cache/
|-- logs/
`-- temp/
```

## Engine Routing

Per-language routing config stored in environment variables:

```json
{
  "english": { "primary": "edge-tts", "fallback": "edge-tts" },
  "vietnamese": { "primary": "edge-tts", "fallback": "edge-tts" }
}
```

On GPU machines, Fish Speech becomes primary for higher quality.

## QA Loop

```
Generate segment - Transcribe - Compare - Score = 95%?
  YES - qa_passed - continue
  NO  - retry (up to MAX_RETRIES) - fallback engine - re-QA
  STILL FAIL - human_review_required - Mi workflow
```

## Mi Department Loop

```
CEO command - Mi receives - Creates voiceover job
  - Routes to Media/Video Department
  - Script extracted - EN + VI scripts prepared
  - TTS Router selects engines
  - Segments generated - QA runs
  - If score < 95% - fix/regenerate - loop
  - If score = 95% - Report - Mi - CEO
```
