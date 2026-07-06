# BILINGUAL VOICEOVER SYSTEM — QA REPORT FORMAT

## Overview

The QA Report is generated automatically by the Reporter service (`apps/voiceover-service/src/services/reporter.ts`) after each job completes. It contains segment-level QA scores, engine usage statistics, audit trail, and Mi workflow readiness.

## File Location

`storage/voiceover/projects/{job_id}/reports/{job_id}-qa-report.json`

## Report Schema

```json
{
  "jobId": "uuid",
  "projectName": "string",
  "state": "completed|failed|human_review_required|...",
  "qaScore": 0-100,
  "qaPassed": true|false,
  "threshold": 95,
  "segments": {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "humanReviewRequired": 0
  },
  "languages": {
    "en": { "segments": 0, "passed": 0, "failed": 0 },
    "vi": { "segments": 0, "passed": 0, "failed": 0 }
  },
  "engines": {
    "edge-tts": 0,
    "fish-speech": 0,
    "openvoice": 0
  },
  "qaChecks": [
    {
      "segmentId": "string",
      "language": "en|vi",
      "passed": true|false,
      "similarity": 0-100,
      "notes": "string",
      "engine": "edge-tts|fish-speech|openvoice",
      "attempt": 1-3
    }
  ],
  "auditTrail": [
    {
      "event": "translate|generate|qa_failed|...",
      "detail": "string",
      "engine": "edge-tts|fish-speech|openvoice|null",
      "timestamp": "ISO-8601"
    }
  ],
  "recommendations": ["string"],
  "miWorkflowReady": true|false,
  "generatedAt": "ISO-8601"
}
```

## QA Checks Performed

For each segment:

1. Empty audio detection (via ffprobe duration)
2. Duration plausibility (vs estimated from text length)
3. Clipping detection (heuristic)
4. Silence percentage (< 40% threshold)
5. Similarity score via Whisper transcription:
   - Token similarity (Jaccard)
   - Sequence similarity (Levenshtein)
   - Weighted blend: 0.4 * token + 0.6 * sequence
6. Language mismatch heuristic (VI diacritic check)
7. Combined pass/fail decision (all checks must pass + similarity >= 95%)

## Fallback Rules

When QA fails:
1. Retry primary engine up to MAX_RETRIES (default 3)
2. Switch to fallback engine
3. If still fails, mark segment as `human_review_required`
4. Notify Mi workflow

## Acceptance Criteria

A job passes overall when:
- Average QA score >= 95%
- No failed segments
- No human-review-required segments
- All outputs generated successfully
