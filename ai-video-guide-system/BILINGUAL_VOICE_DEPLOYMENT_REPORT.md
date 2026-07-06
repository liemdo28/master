# BILINGUAL VOICEOVER SYSTEM — DEPLOYMENT REPORT

## Deployment Topology

```
Internet
   │
   ▼
[Reverse Proxy / LB]
   │
   ├── Admin Dashboard (port 5173) — React + Vite
   │
   ├── API Server (port 3001) — Express + tRPC + SQLite
   │
   ├── Voiceover Service (port 3010) — NEW bilingual service
   │   └── TTS Engines: Edge TTS, Fish Speech (GPU), OpenVoice (GPU)
   │
   ├── Playwright Runner (port 3002)
   │
   ├── Remotion Renderer (port 3003)
   │
   ├── Narration Service (port 3004) — OpenAI GPT
   │
   └── TTS Service (port 3005) — legacy Edge TTS
```

## Storage

- `/storage/voiceover/projects/{job_id}/` — controlled job storage
- `/storage/voiceover/projects/{job_id}/segments/{en,vi}/` — segment audio
- `/storage/voiceover/projects/{job_id}/outputs/` — final WAV/MP3/MP4
- `/storage/voiceover/projects/{job_id}/subtitles/` — SRT files
- `/data/voiceover.db` — SQLite database (jobs, segments, profiles)

## Configuration (Production)

```env
NODE_ENV=production
VOICEOVER_PORT=3010
STORAGE_BASE=/var/lib/voiceover/storage
DATABASE_URL=/var/lib/voiceover/data/voiceover.db
OPENAI_API_KEY=***
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
TTS_EN_PRIMARY=fish-speech
TTS_VI_PRIMARY=fish-speech
TTS_EN_FALLBACK=edge-tts
TTS_VI_FALLBACK=edge-tts
VOICEOVER_Q=95
VOICEOVER_MAX_RETRIES=3
```

## Docker Image

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip ffmpeg
WORKDIR /app
COPY package.json ./
COPY apps/voiceover-service ./apps/voiceover-service
COPY packages/voiceover-core ./packages/voiceover-core
RUN npm install --workspaces
RUN pip install edge-tts
RUN npm run db:migrate:voiceover
EXPOSE 3010
CMD ["npm", "run", "start", "-w", "apps/voiceover-service"]
```

## Health Checks

- `GET /health` — basic liveness
- `GET /ready` — engine readiness
- `GET /metrics` — job statistics

## Database Migration

```bash
cd apps/voiceover-service && npx tsx src/db-migrate.ts
```

## Production Checklist

- [x] Database schema migrated
- [x] Storage directories created
- [x] Edge TTS installed as baseline
- [ ] Fish Speech installed on GPU workers
- [ ] OpenVoice installed on GPU workers
- [ ] QA reports configured
- [ ] Mi workflow integration tested
