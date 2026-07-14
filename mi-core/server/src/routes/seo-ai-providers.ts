import { Router, Request, Response } from 'express';
import { generateStructured, getSeoProviderStatus, healthCheck } from '../seo/ai-providers/provider-gateway';

export const seoAiProvidersRouter = Router();

seoAiProvidersRouter.get('/ai-providers/status', async (req: Request, res: Response) => {
  try {
    const includeBrowser = req.query.include_browser === '1' || req.query.include_browser === 'true';
    res.json({ ok: true, ...(await getSeoProviderStatus({ includeBrowser })) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

seoAiProvidersRouter.get('/ai-providers/health', async (_req: Request, res: Response) => {
  try {
    res.json({ ok: true, ...(await healthCheck()) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

seoAiProvidersRouter.post('/ai-providers/probe', async (_req: Request, res: Response) => {
  try {
    const testId = `seo-provider-probe-${Date.now()}`;
    const result = await generateStructured<{ test_id: string; ok: boolean }>(
      [
        {
          role: 'user',
          content: `Return only JSON with this exact shape and test_id: {"test_id":"${testId}","ok":true}`,
        },
      ],
      { required: { test_id: 'string', ok: 'boolean' } },
      { timeoutMs: Number(process.env.SEO_PROVIDER_PROBE_TIMEOUT_MS || 120_000), promptVersion: 'seo-provider-probe-v1' },
    );
    res.json({
      ok: result.ok,
      expected_test_id: testId,
      matched_test_id: result.parsed?.test_id === testId,
      provider: result.provider,
      provider_status: result.provider_status,
      model: result.model,
      latency_ms: result.latency_ms,
      checksum: result.checksum,
      fallback_used: result.fallback_used,
      error_category: result.error_category,
      error: result.error,
      parsed: result.parsed,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

