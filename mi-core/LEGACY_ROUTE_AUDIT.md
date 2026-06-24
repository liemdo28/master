# Legacy Route Audit

Audit timestamp: 2026-06-15 21:38 Asia/Saigon

## Legacy Behavior Found

Search terms checked:

- `SEO Analysis`
- `Top keyword opportunities`
- `Next steps`
- `Raw Sushi Bar`
- `marketing_request`
- `seo analyzer`
- `gstack fallback`
- `knowledge response`
- `old chatbot response`

Confirmed legacy responder:

- File: `server/src/skills/skill-registry.ts`
- Skill: `seo-analyzer`
- Output starts with `[SEO Analysis — Raw Sushi Bar (Stockton, CA)]`
- Output includes `Top keyword opportunities` and `Next steps`
- It requires no approval and creates no workflow.

## Production Risk

Before this audit fix, `server/src/routes/whatsapp.ts` could call:

```text
findSkill(normalized) -> seo-analyzer -> SEO advice
```

That meant the action request `"Mi oi, tao bai SEO cho Raw"` could be answered as informational SEO analysis instead of creating a workflow/draft/approval.

## Kill Switch / Containment

Implemented containment:

- `POST /api/whatsapp/mi` now classifies action requests before `findSkill()`.
- If `classifyActionIntent()` returns `action_request` and `needsWorkflow()`, Mi-Core calls `processCEORequest()`.
- Legacy `seo-analyzer` remains available only for non-action fallback paths. It no longer owns the production action-request path.

Known remaining non-production test path:

- `POST /api/whatsapp/send-test` still calls `runPipeline()` directly.
- It is not the real gateway route and timed out during this audit.
- It must not be used as proof that real WhatsApp is wired.

## Verdict

Legacy SEO analyzer was reachable from the production action path before the fix.

After the fix, Mi-Core production `/api/whatsapp/mi` action requests route to Execution Engine first.
