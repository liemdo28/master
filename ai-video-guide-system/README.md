# AI Video Guide Generation System

A production-ready system that automatically creates professional training and walkthrough videos for web applications using Playwright browser automation, AI narration, text-to-speech, and FFmpeg video rendering.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        AI Video Guide System                         │
├──────────────────┬───────────────────────────────────────────────────┤
│  Admin Dashboard │  React + Vite frontend for managing projects     │
│  (Port 5173)     │  and triggering record/render workflows          │
├──────────────────┼───────────────────────────────────────────────────┤
│  API Server      │  Express + tRPC + SQLite backend (Port 3001)      │
│                  │  Manages projects, steps, captures, render jobs  │
├──────────────────┼───────────────────────────────────────────────────┤
│  Playwright      │  Browser automation for workflow recording        │
│  Runner (3002)   │  Captures screenshots per step + privacy masking │
├──────────────────┼───────────────────────────────────────────────────┤
│  Narration       │  GPT-4 AI narration script generation (Port 3004)│
│  Service          │  Segments script per workflow step               │
├──────────────────┼───────────────────────────────────────────────────┤
│  TTS Service     │  Edge TTS voice synthesis (Port 3005)            │
│                  │  Converts narration to MP3 voiceover              │
├──────────────────┼───────────────────────────────────────────────────┤
│  Remotion        │  Video rendering pipeline (Port 3003)             │
│  Renderer         │  FFmpeg screenshots-to-video + audio mix          │
└──────────────────┴───────────────────────────────────────────────────┘
```

## Services

| Service           | Port  | Description                            |
|-------------------|-------|----------------------------------------|
| Admin Dashboard   | 5173  | React frontend                         |
| API Server       | 3001  | tRPC + SQLite backend                  |
| Playwright Runner| 3002  | Browser recording service               |
| Remotion Renderer| 3003  | FFmpeg video rendering                 |
| Narration Service| 3004  | OpenAI GPT narration generation        |
| TTS Service      | 3005  | Edge TTS voice synthesis               |

## Quick Start

### Prerequisites

- Node.js >= 20
- FFmpeg (`choco install ffmpeg` on Windows / `brew install ffmpeg` on macOS)
- Playwright browsers (`npx playwright install chromium`)
- edge-tts (`pip install edge-tts` or `npm install -g edge-tts`)

### Installation

```bash
cd ai-video-guide-system
npm install

# Install FFmpeg
# Windows: choco install ffmpeg
# macOS:   brew install ffmpeg
# Linux:   sudo apt install ffmpeg

# Install Playwright browsers
npx playwright install chromium --with-deps

# Install edge-tts
pip install edge-tts

# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Initialize database
npm run db:migrate
npm run db:seed

# Start all services
npm run dev
```

### Running Individual Services

```bash
# API Server only
npm run dev:api

# Dashboard only
npm run dev:dashboard

# Playwright Runner only
npm run dev:runner

# Remotion Renderer only
npm run dev:remotion

# Narration Service only
npm run dev:narration

# TTS Service only
npm run dev:tts
```

## Project Structure

```
ai-video-guide-system/
|-- apps/
|   |-- admin-dashboard/     # React frontend (Vite)
|   |-- api-server/          # Express + tRPC + SQLite
|   |-- playwright-runner/   # Browser recording service
|   |-- narration-service/   # OpenAI GPT narration
|   |-- tts-service/         # Edge TTS synthesis
|   `-- remotion-renderer/   # FFmpeg video rendering
|-- packages/
|   |-- shared-types/        # TypeScript + Zod schemas
|   |-- selector-registry/   # DOM selector management
|   |-- timeline-recorder/   # Event timeline capture
|   |-- privacy-masker/      # FFmpeg blur/redaction
|   `-- media-utils/         # FFmpeg utilities
|-- storage/                  # Generated videos, screenshots, audio
`-- docs/                     # Documentation
```

## Workflow

1. **Create Project** — Dashboard → New Project (name + target URL)
2. **Define Steps** — Add workflow steps (click, fill, navigate, etc.)
3. **Run Recording** — Playwright Runner captures screenshots per step
4. **Generate Narration** — GPT-4 creates AI narration script
5. **Synthesize Voice** — Edge TTS converts script to MP3
6. **Render Video** — FFmpeg combines screenshots + voiceover → MP4

## API (tRPC)

```
project.list                   GET  List all projects
project.byId                   GET  Get project by ID
project.create                 POST Create new project
project.update                PATCH Update project
project.delete                DELETE Remove project

step.listByProject            GET  List steps for project
step.byId                     GET  Get step by ID
step.create                   POST Create step
step.update                   PATCH Update step
step.delete                   DELETE Remove step
step.reorder                  POST Reorder steps

capture.listByStep            GET  List captures for step
capture.listByProject         GET  List captures for project
capture.byId                  GET  Get capture by ID
capture.create                POST Create capture

renderJob.listByProject       GET  List render jobs
renderJob.byId                GET  Get render job by ID
renderJob.create              POST Create render job
renderJob.updateStatus        PATCH Update render job status

selectorRegistry.listByProject GET  List selectors
selectorRegistry.activeByProject GET Active selectors
selectorRegistry.register     POST Register selector
selectorRegistry.toggleActive PATCH Toggle selector active
selectorRegistry.delete       DELETE Remove selector

health.check                  GET  Health check
```

## Environment Variables

See `.env.example` for all configuration options. Key variables:

| Variable              | Default                          | Description              |
|-----------------------|----------------------------------|--------------------------|
| `DATABASE_URL`        | `file:./data/video-guide.db`     | SQLite database path     |
| `PORT`                | `3001`                           | API server port          |
| `OPENAI_API_KEY`      | —                                | OpenAI API key          |
| `AI_MODEL`            | `gpt-4o`                         | GPT model for narration  |
| `EDGE_TTS_VOICE`      | `en-US-AriaNeural`               | TTS voice                |
| `STORAGE_BASE`        | `./storage`                      | Storage directory        |
| `FFMPEG_PATH`         | `ffmpeg`                         | FFmpeg binary path       |

## Docker

```bash
docker compose up
```

Or build individual services:

```bash
docker build -t ai-video-guide-api ./apps/api-server
docker build -t ai-video-guide-runner ./apps/playwright-runner
docker build -t ai-video-guide-renderer ./apps/remotion-renderer
```
