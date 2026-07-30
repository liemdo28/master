# BILINGUAL VOICEOVER SYSTEM — API REFERENCE

Base URL: `http://localhost:3010`

## Health

### GET /health
Returns service health.

```json
{ "status": "ok", "timestamp": "...", "service": "voiceover-service" }
```

### GET /ready
Returns engine readiness.

```json
{ "ready": true, "engines": [{ "id": "edge-tts", "health": { "available": true, "gpuUsed": false } }] }
```

### GET /metrics
Returns job statistics.

```json
{ "totalJobs": 10, "activeJobs": 2, "timestamp": "..." }
```

---

## Voiceover Jobs

### POST /api/voiceover/jobs
Create a new voiceover job.

Body:
```json
{
  "projectName": "Bakudan Training Video",
  "sourceLanguage": "en",
  "outputLanguages": ["en", "vi"],
  "originalScript": "Welcome to the opening procedure...",
  "speakingSpeed": 1.0,
  "emotion": "professional",
  "outputFormat": "both",
  "subtitleToggle": true,
  "sourceVideoPath": null,
  "backgroundVolume": 0.3,
  "voiceVolume": 1.0
}
```

Response: `VoiceoverJob` object

### GET /api/voiceover/jobs
List all jobs. Query: `?limit=50`

### GET /api/voiceover/jobs/:id
Get a specific job.

### PUT /api/voiceover/jobs/:id
Update job fields (scripts, settings).

### POST /api/voiceover/jobs/:id/generate
Start narration generation. Runs asynchronously.

### POST /api/voiceover/jobs/:id/translate
Translate source script to EN and/or VI using GPT.

### POST /api/voiceover/jobs/:id/normalize
Normalize script (numbers, dates, currency → spoken form).

Body: `{ "script": "...", "language": "vi" }`

### POST /api/voiceover/jobs/:id/preview
Generate a 10-second preview.

Body: `{ "text": "...", "language": "vi" }`

### POST /api/voiceover/jobs/:id/retry
Retry failed segments.

Body: `{ "segmentId": "..." }`

### GET /api/voiceover/jobs/:id/segments
List all segments for a job.

### GET /api/voiceover/jobs/:id/outputs
List output files (WAV, MP3, MP4).

### POST /api/voiceover/jobs/:id/approve
Admin approves the job.

### POST /api/voiceover/jobs/:id/cancel
Cancel the job.

### GET /api/voiceover/jobs/:id/report
Get QA report.

### GET /api/voiceover/jobs/:id/audit
Get audit trail.

---

## Voice Library

### GET /api/voiceover/voices
List all voice profiles.

### POST /api/voiceover/voices
Create or update a voice profile.

### DELETE /api/voiceover/voices/:id
Delete a voice profile.

---

## Pronunciation Dictionary

### GET /api/voiceover/pronunciations
List all pronunciation rules.

### POST /api/voiceover/pronunciations
Add or update a pronunciation rule.

```json
{
  "term": "Bakudan",
  "en": "bah-koo-dahn",
  "vi": "ba-ku-dan",
  "language": "both"
}
```

### DELETE /api/voiceover/pronunciations/:id
Delete a pronunciation rule.

---

## Job States

| State | Description |
|-------|-------------|
| draft | Job created, not started |
| script_processing | Normalizing + translating |
| awaiting_script_approval | Scripts ready for admin review |
| generating_en | Synthesizing English audio |
| generating_vi | Synthesizing Vietnamese audio |
| audio_qa | Running QA checks |
| mixing_video | Mixing narration into video |
| video_qa | Verifying final video |
| human_review_required | QA failed, needs human intervention |
| approved | Admin approved |
| completed | All done |
| failed | Unrecoverable error |
| cancelled | Cancelled by user |

## Segment States

| State | Description |
|-------|-------------|
| pending | Not yet generated |
| generating | TTS in progress |
| qa_passed | QA score >= 95% |
| qa_failed | QA score < 95% |
| retrying | Retrying after failure |
| human_review_required | Max retries reached |
| failed | Unrecoverable |
