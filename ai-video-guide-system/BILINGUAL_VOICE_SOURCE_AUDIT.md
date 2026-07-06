# BILINGUAL VOICEOVER SYSTEM — SOURCE AUDIT

> Audit of the existing **Master** project (`ai-video-guide-system`) before integrating the
> bilingual (English / Vietnamese) voiceover & dubbing feature.

Date: 2026-07-06
Auditor: Dev (Bilingual Voice workstream)

---

## 1. Existing Project Architecture

The Master project is a **monorepo** (npm workspaces) that automatically creates training /
walkthrough videos from web apps using Playwright automation, AI narration, TTS, and FFmpeg.

```
ai-video-guide-system/
├── apps/
│   ├── admin-dashboard/      React + Vite admin UI         (port 5173)
│   ├── api-server/           Express + tRPC + SQLite       (port 3001)
│   ├── playwright-runner/    Browser recording service      (port 3002)
│   ├── remotion-renderer/    FFmpeg video rendering         (port 3003)
│   ├── narration-service/    OpenAI GPT narration           (port 3004)
│   └── tts-service/          Edge TTS synthesis             (port 3005)
├── packages/
│   ├── shared-types/         Zod schemas + TS types
│   ├── selector-registry/    DOM selector management
│   ├── timeline-recorder/    Event timeline capture
│   ├── privacy-masker/       FFmpeg blur/redaction
│   └── media-utils/          FFmpeg utilities (probe, mix, concat, subs)
├── storage/                  Generated videos / audio / screenshots
├── data/                     SQLite databases
└── docker-compose.yml        api-server, playwright-runner, remotion, redis
```

### Current data flow

```
Admin Dashboard (5173)
   │  tRPC
   ▼
API Server (3001) ──► Playwright Runner (3002)   [screenshots]
   │                   │
   │                   └─► Narration Service (3004)  [GPT script]
   │                          │
   │                          └─► TTS Service (3005)  [Edge TTS → mp3]
   │                                  │
   └─► Remotion Renderer (3003)  [FFmpeg screenshots + audio → mp4]
```

---

## 2. Existing Video-Generation Workflow

1. Create Project (name + target URL) — Dashboard
2. Define Steps (click, fill, navigate, screenshot…)
3. Run Recording — Playwright captures screenshots per step
4. Generate Narration — GPT-4 creates script, segmented per step
5. Synthesize Voice — Edge TTS → MP3
6. Render Video — FFmpeg combines screenshots + voiceover → MP4

---

## 3. Existing FFmpeg Integration

- **`packages/media-utils`** wraps FFmpeg/FFprobe:
  - `probeMedia`, `generateThumbnail`, `concatVideos`, `burnSubtitles`,
    `mixAudio`, `imagesToVideo`, `trimVideo`, `screenshotsToVideo`.
- Binary path resolved via `FFMPEG_PATH` / `FFPROBE_PATH` env (default `ffmpeg`).
- ⚠️ **FFmpeg is NOT currently on the Windows PATH** in this environment — it must be
  installed before any audio/video job can run (`choco install ffmpeg` or explicit path).

---

## 4. Existing AI Provider Gateway

- **Narration Service** instantiates `OpenAI` SDK directly (`OPENAI_API_KEY`,
  `OPENAI_BASE_URL`, `AI_MODEL=gpt-4o`). There is no shared "AI gateway" abstraction today.
- For bilingual voiceover, **translation** will reuse the same OpenAI client for
  `vi ↔ en` script translation (single source of AI providers).

---

## 5. Current Job Queue

- **None.** The system uses synchronous Express handlers and a `render_jobs` table that is
  updated in place. There is a **Redis** container in `docker-compose.yml` (port 6379) but it
  is not consumed by any service yet.
- The bilingual voiceover module **must** add a sequential job runner (in-process queue with
  Redis as optional backing store) to prevent model/VRAM contention and to enable the
  QA → retry loop.

---

## 6. Current Storage Paths

- `STORAGE_BASE` = `./storage` (tts-service, remotion-renderer).
- `STORAGE_BASE_PATH` = `./storage` (api-server).
- Audio: `storage/audio/*.mp3`.
- Render output: passed via `outputPath` to remotion-renderer.
- SQLite: `data/api-server.db` / `data/video-guide.db`.

The voiceover module will add a **controlled** subtree:

```
storage/voiceover/
├── projects/{project_id}/{source,scripts,reference-voices,segments/{en,vi},
│                         subtitles,previews,outputs,reports}/
├── models/  voices/  pronunciation/  cache/  logs/  temp/
```

This **reuses** the existing `STORAGE_BASE` root (no new root mount) and the existing
`media-utils` FFmpeg helpers.

---

## 7. Current Admin / Dashboard

- React + Vite SPA (`apps/admin-dashboard`) with pages:
  - `ProjectList.tsx`, `ProjectDetail.tsx`.
- tRPC client at `src/trpc.ts`.
- The bilingual voiceover module adds **new admin pages/screens** for:
  Voiceover Jobs, Voice Library, Pronunciation Dictionary, QA Reports —
  keeping the no-code requirement (no Python / JSON / env editing by admin).

---

## 8. Current Approval Workflow

- **None.** `render_jobs.status` only has `pending | rendering | done | failed`.
- The bilingual module adds the full **job-state machine** (Draft → Script Processing →
  Awaiting Script Approval → Generating EN/VI → Audio QA → Mixing → Video QA →
  Human Review → Approved → Completed/Failed/Cancelled) and an approval gate.

---

## 9. Current Report Workflow

- **None.** There is no report service or QA scoring today.
- The bilingual module adds `reporter` + `audio-qa-service` producing QA reports
  and feeding Mi's department loop.

---

## 10. Environment — Hardware & Toolchain (measured)

| Item | Detected value | Notes |
|------|----------------|-------|
| Operating system | Windows 11 (x64) | Current shell `cmd.exe` |
| Node.js | v24.14.1 | Required ≥ 20 ✅ |
| npm | 11.11.0 | ✅ |
| Python | 3.13.12 (default) / 3.14.3 | Fish Speech requires 3.9–3.12 ⚠️ |
| pip | 26.1.2 | ✅ |
| Torch | 2.12.1 **+cpu**, `cuda False` | **No CUDA / no GPU** |
| nvidia-smi | not recognised | **No NVIDIA GPU** |
| nvcc | not recognised | No CUDA toolkit |
| FFmpeg on PATH | **not found** | Must be installed / path set |
| Python `edge-tts` | (used by tts-service) | installed at runtime |

**GPU / VRAM:** This machine is **CPU-only**. Fish Speech and OpenVoice *can* run on CPU
but are 10–50× slower; production GPU is strongly recommended. Model-size selection and
fallback rules below are written for both CPU and GPU.

---

## 11. Existing Ports & Services

| Service | Port | Status |
|---------|------|--------|
| Admin Dashboard | 5173 | existing |
| API Server | 3001 | existing |
| Playwright Runner | 3002 | existing |
| Remotion Renderer | 3003 | existing |
| Narration Service | 3004 | existing |
| TTS Service | 3005 | existing |
| Redis | 6379 | existing (container) |

**Available ports for the voiceover module:** **3010** (Voiceover API / job runner) and
**3011** (TTS Router / engine gateway) — chosen to avoid collisions and to keep the heavy
TTS engines isolated from the lightweight existing TTS service.

---

## 12. WHERE THE MODULE SHOULD BE INSTALLED

```
apps/voiceover-service/        NEW — owns the bilingual voiceover feature
   ├── src/
   │   ├── index.ts            Express app (port 3010): /api/voiceover/* + health/ready/metrics
   │   ├── config.ts           env + routing config
   │   ├── db.ts               voiceover tables (reuses better-sqlite3)
   │   ├── job-runner.ts       sequential queue, retries, fallback, QA loop
   │   ├── services/
   │   │   ├── script-service.ts
   │   │   ├── translation-service.ts      (reuses OpenAI client)
   │   │   ├── normalization-service.ts    (vi + en text normalization)
   │   │   ├── pronunciation-service.ts    (shared dictionary)
   │   │   ├── tts-router.ts               (engine A/B + fallback)
   │   │   ├── voice-profile-service.ts    (voice library + consent)
   │   │   ├── audio-qa-service.ts         (transcribe→compare→score)
   │   │   ├── video-mixer.ts             (FFmpeg, reuses media-utils)
   │   │   ├── subtitle-exporter.ts       (SRT en/vi)
   │   │   └── reporter.ts
   │   └── engines/
   │       ├── edge-tts-engine.ts   (baseline, always available)
   │       ├── fish-speech-engine.ts (optional, GPU recommended)
   │       └── openvoice-engine.ts   (optional, voice-cloning)
packages/voiceover-core/       NEW — shared types, normalization, routing config
storage/voiceover/             NEW — controlled storage subtree (see §6)
```

### Which current service owns it

- The **new `apps/voiceover-service`** owns the feature. It is a sibling of the existing
  `tts-service` / `narration-service` and is invoked by the API server and the Admin
  dashboard, exactly like `remotion-renderer` is today.

### Which data flow it connects to

```
Admin Dashboard ──(tRPC/REST)──► API Server (3001)
                                    │
                                    ├──► voiceover-service (3010)   ← NEW
                                    │        ├── TTS Router (3011)  ← NEW (engines)
                                    │        ├── Narration/Translation (reuse 3004 client)
                                    │        └── Remotion Renderer (3003) for final mux
                                    └──► Mi workflow (ChatMi) consumes job events
```

---

## 13. FOLDERS — REUSE vs OBSOLETE

| Folder | Action | Reason |
|--------|--------|--------|
| `packages/media-utils` | **REUSE** | FFmpeg helpers (mix, concat, subs, probe) |
| `packages/shared-types` | **REUSE + EXTEND** | add voiceover enums/schemas |
| `apps/narration-service` | **REUSE** | translation reuses its OpenAI client pattern |
| `apps/tts-service` | **DEPRECATE for voiceover** | replaced by voiceover TTS Router (3011); keep for legacy single-voice MVP |
| `apps/remotion-renderer` | **REUSE** | final video mux / subtitle embedding |
| `storage/` root | **REUSE** | new `storage/voiceover/` subtree |
| `data/` | **REUSE** | new `voiceover.db` (or tables in existing db) |
| `apps/playwright-runner` | **UNAFFECTED** | not part of voiceover flow |

No existing folder becomes **obsolete**; only `apps/tts-service` is **de-emphasised** for
new bilingual work (kept for backward compatibility).

---

## 14. MODEL SIZES THAT FIT THE HARDWARE

| Hardware tier | Fish Speech | OpenVoice | Edge TTS (baseline) | Recommendation |
|---------------|-------------|-----------|---------------------|----------------|
| **CPU-only (this machine)** | fish-1.5-small (CPU, ~2 GB RAM, very slow) | v2 toneconverter (CPU, ~1.5 GB) | ✅ always | **Edge TTS primary**; Fish/OpenVoice optional, preview-only |
| GPU 8 GB VRAM | fish-1.5-small | v2 converter | ✅ | Fish primary EN+VI, OpenVoice clone layer |
| GPU 12–16 GB VRAM | fish-1.5-medium | v2 converter | ✅ | Fish primary both languages; load-on-demand |
| GPU ≥ 24 GB VRAM | fish-1.5-large | v2 + custom | ✅ | Fish primary + OpenVoice clone, both loaded |

Because the audited machine is **CPU-only**, the **engine selection (see
`BILINGUAL_TTS_BENCHMARK.md`) defaults to Edge TTS as the always-available baseline**,
with Fish Speech / OpenVoice as opt-in GPU engines. The architecture supports all options
and routes per language per the routing config.

---

## 15. AUDIT CONCLUSION

| Question | Answer |
|----------|--------|
| Where should the module be installed? | `apps/voiceover-service` (+ `packages/voiceover-core`) |
| Which current service owns it? | new `voiceover-service` (port 3010); TTS engines on port 3011 |
| Which data flow does it connect to? | Admin → API(3001) → voiceover(3010) → Router(3011) + Narration(3004) + Remotion(3003) → Mi |
| Which folders are reused? | `media-utils`, `shared-types`, `narration-service`, `remotion-renderer`, `storage/`, `data/` |
| Which folders are obsolete? | None (`tts-service` deprecated for new bilingual work only) |
| Which ports are available? | **3010**, **3011** |
| Which model sizes fit the hardware? | CPU-only → Edge TTS baseline + Fish/OpenVoice CPU (preview). See §14. |

**The feature is integrated into the existing Media/Video pipeline, not a duplicate project.**

