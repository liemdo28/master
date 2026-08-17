/**
 * Mi AI Platform Routes — Phase 34
 * POST /api/ai/workflow        — full 10-stage pipeline
 * POST /api/ai/chat            — route prompt to best provider
 * GET  /api/ai/providers       — list configured providers
 * POST /api/ai/rag/search      — RAG search
 * POST /api/ai/rag/ingest      — add doc to vector store
 * POST /api/ai/vision/analyze  — image analysis / OCR
 * POST /api/ai/vision/qa       — screenshot QA
 * POST /api/ai/voice/stt       — speech to text (base64 audio)
 * POST /api/ai/voice/tts       — text to speech
 * POST /api/ai/voice/classify  — classify voice command
 * POST /api/ai/browser/run     — browser automation task
 * POST /api/ai/browser/smoke   — smoke test a URL
 * POST /api/ai/benchmark       — benchmark task across models
 */

import { Router, Request, Response } from 'express';
import { runWorkflow, benchmark }     from '../engineering/workflow/workflow-engine';
import { routeToProvider, listProviders } from '../engineering/providers/provider-router';
import { search, ingest }             from '../engineering/rag/rag-engine';
import { analyzeImage, screenshotQA } from '../engineering/vision/vision-engine';
import { transcribe, synthesize, classifyVoiceCommand } from '../engineering/voice/voice-engine';
import { runBrowserTask, smokeTest }  from '../engineering/browser/browser-agent';
import { validateTargetUrl } from '../security/ssrf-policy';

export const aiPlatformRouter = Router();

// Phase 8A: browser actions that mutate the target page (click/fill) or run
// arbitrary in-page JS (evaluate) are write-shaped — this endpoint stays
// read-only (navigate/wait/screenshot only) until a governed Controlled
// Action adapter exists for browser writes, matching the same boundary
// `routes/browser-agent.ts`'s `/write` route already enforces.
const WRITE_SHAPED_ACTION_TYPES = new Set(['click', 'fill', 'evaluate']);

// ── Workflow ──────────────────────────────────────────────────────────────────
aiPlatformRouter.post('/workflow', async (req: Request, res: Response) => {
  const { input, project, auto_approve } = req.body || {};
  if (!input) return res.status(400).json({ error: 'input required' });
  try {
    const result = await runWorkflow(input, project || 'mi-core', !!auto_approve);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── AI Chat ───────────────────────────────────────────────────────────────────
aiPlatformRouter.post('/chat', async (req: Request, res: Response) => {
  const { prompt, tier, model, context, max_tokens, temperature } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  try {
    const result = await routeToProvider({ tier: tier || 'ceo-brain', prompt, model, context, max_tokens, temperature });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Providers ─────────────────────────────────────────────────────────────────
aiPlatformRouter.get('/providers', (_req: Request, res: Response) => {
  res.json({ providers: listProviders() });
});

// ── RAG ───────────────────────────────────────────────────────────────────────
aiPlatformRouter.post('/rag/search', async (req: Request, res: Response) => {
  const { query, top_k } = req.body || {};
  if (!query) return res.status(400).json({ error: 'query required' });
  const result = await search(query, top_k || 5);
  res.json(result);
});

aiPlatformRouter.post('/rag/ingest', async (req: Request, res: Response) => {
  const { text, source, metadata } = req.body || {};
  if (!text || !source) return res.status(400).json({ error: 'text and source required' });
  const ok = await ingest(text, source, metadata);
  res.json({ success: ok });
});

// ── Vision ────────────────────────────────────────────────────────────────────
aiPlatformRouter.post('/vision/analyze', async (req: Request, res: Response) => {
  const { image_b64, prompt, type } = req.body || {};
  if (!image_b64) return res.status(400).json({ error: 'image_b64 required' });
  const result = await analyzeImage(image_b64, prompt, type);
  res.json(result);
});

aiPlatformRouter.post('/vision/qa', async (req: Request, res: Response) => {
  const { image_b64, expectation } = req.body || {};
  if (!image_b64 || !expectation) return res.status(400).json({ error: 'image_b64 and expectation required' });
  const result = await screenshotQA(image_b64, expectation);
  res.json(result);
});

// ── Voice ─────────────────────────────────────────────────────────────────────
aiPlatformRouter.post('/voice/stt', async (req: Request, res: Response) => {
  const { audio_b64, filename } = req.body || {};
  if (!audio_b64) return res.status(400).json({ error: 'audio_b64 required' });
  const buffer = Buffer.from(audio_b64, 'base64');
  const result = await transcribe(buffer, filename);
  res.json(result);
});

aiPlatformRouter.post('/voice/tts', async (req: Request, res: Response) => {
  const { text, voice } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  const result = await synthesize(text, voice || 'nova');
  res.json(result);
});

aiPlatformRouter.post('/voice/classify', (req: Request, res: Response) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  res.json(classifyVoiceCommand(text));
});

// ── Browser ───────────────────────────────────────────────────────────────────
aiPlatformRouter.post('/browser/run', async (req: Request, res: Response) => {
  const { url, actions, screenshot, task_id } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url required' });
  const requestedActions = Array.isArray(actions) ? actions : [];
  const writeShaped = requestedActions.find((a: { type?: string }) => a && WRITE_SHAPED_ACTION_TYPES.has(a.type || ''));
  if (writeShaped) {
    return res.status(403).json({
      error: 'Browser write actions (click/fill/evaluate) are quarantined — this endpoint is read-only (navigate/wait/screenshot).',
      rejected_action_type: writeShaped.type,
    });
  }
  const policy = await validateTargetUrl(url);
  if (!policy.safe) {
    return res.status(400).json({ error: 'Target URL rejected by SSRF-safe target policy.', reason: policy.reason, detail: policy.detail });
  }
  const result = await runBrowserTask({ url, actions: requestedActions, screenshot: !!screenshot, task_id });
  res.json(result);
});

aiPlatformRouter.post('/browser/smoke', async (req: Request, res: Response) => {
  const { url, task_id } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url required' });
  const policy = await validateTargetUrl(url);
  if (!policy.safe) {
    return res.status(400).json({ error: 'Target URL rejected by SSRF-safe target policy.', reason: policy.reason, detail: policy.detail });
  }
  const result = await smokeTest(url, task_id);
  res.json(result);
});

// ── Benchmark ─────────────────────────────────────────────────────────────────
aiPlatformRouter.post('/benchmark', async (req: Request, res: Response) => {
  const { input } = req.body || {};
  if (!input) return res.status(400).json({ error: 'input required' });
  const result = await benchmark(input);
  res.json(result);
});
