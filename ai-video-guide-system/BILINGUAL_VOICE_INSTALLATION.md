# BILINGUAL VOICEOVER SYSTEM — INSTALLATION GUIDE

## Prerequisites

- Node.js >= 20 (tested: v24.14.1)
- Python >= 3.9 (tested: 3.13.12)
- FFmpeg (Windows: `choco install ffmpeg`; macOS: `brew install ffmpeg`)
- OpenAI API key (set `OPENAI_API_KEY` in `.env`)

## Quick Start

\`\`\`bash
# Install dependencies
npm install
cd apps/voiceover-service && npm install && cd ../..

# Install Edge TTS (baseline engine — always needed)
pip install edge-tts

# Install Python engines (optional, GPU recommended)
pip install fish-speech openvoice  # or just edge-tts for CPU-only

# Initialize voiceover database
npm run db:migrate:voiceover

# Start all services including voiceover
npm run dev:all
\`\`\`

## Docker

\`\`\`bash
docker compose up
\`\`\`

The `docker-compose.yml` already includes the voiceover-service (add the Dockerfile path when creating it).

## Configuration (.env)

\`\`\`env
# Voiceover Service
VOICEOVER_PORT=3010
VOICEOVER_DB=./data/voiceover.db
STORAGE_BASE=./storage

# TTS Routing (CPU baseline — change to fish-speech on GPU)
TTS_EN_PRIMARY=edge-tts
TTS_VI_PRIMARY=edge-tts
TTS_EN_FALLBACK=edge-tts
TTS_VI_FALLBACK=edge-tts

# AI / Translation
OPENAI_API_KEY=your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o

# FFmpeg
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe

# QA
VOICEOVER_Q=95
VOICEOVER_MAX_RETRIES=3
\`\`\`

## Engine Installation

### Edge TTS (always required)

\`\`\`bash
pip install edge-tts
edge-tts --list-voices  # list available voices
\`\`\`

### Fish Speech (GPU recommended)

\`\`\`bash
# Requires Python 3.9-3.12, CUDA 11.8+ or CUDA 12+
pip install fish-speech
\`\`\`

### OpenVoice (voice cloning)

\`\`\`bash
pip install openvoice
\`\`\`

## Verify Installation

\`\`\`bash
# Check voiceover service
curl http://localhost:3010/health

# Check engine readiness
curl http://localhost:3010/ready

# Check metrics
curl http://localhost:3010/metrics
\`\`\`

## Updating Routing Config

Edit `.env` to change which engine handles English vs Vietnamese:

\`\`\`env
# GPU machine example
TTS_EN_PRIMARY=fish-speech
TTS_VI_PRIMARY=fish-speech
TTS_EN_FALLBACK=edge-tts
TTS_VI_FALLBACK=edge-tts
\`\`\`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| edge-tts not found | `pip install edge-tts` |
| FFmpeg not found | `choco install ffmpeg` |
| CUDA not available | Use edge-tts (CPU mode) |
| Whisper transcription fails | Set `OPENAI_API_KEY` |
| Port 3010 in use | Change `VOICEOVER_PORT` in `.env` |
