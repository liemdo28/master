/**
 * SEO Control Center — LocalModelProvider (spec §3).
 *
 * Thin wrapper around the existing providerRouter.generateText() call,
 * pinned to the 'ollama' provider only. Per spec, this is for low-risk
 * classification/QA tasks (e.g. fact-check triage, tagging) — NOT for
 * primary article content generation. ChatGPTBrowserProvider is the
 * primary content provider; this exists as a fast, free, local fallback
 * for cheap auxiliary work.
 */

import { getSeoDb, nowIso, seoId } from '../seo-db';
import { recordEvidence } from '../seo-evidence';
import { providerRouter } from '../../providers/provider-router';
import type { AIProvider, AIProviderRequest, AIProviderResult } from './ai-provider';
import { redactSecrets } from './redact';

export class LocalModelProvider implements AIProvider {
  name = 'local_model';

  async submit(req: AIProviderRequest): Promise<AIProviderResult> {
    const db = getSeoDb();
    const redactedPrompt = redactSecrets(req.prompt);

    try {
      const result = await providerRouter.generateText(
        [{ role: 'user', content: redactedPrompt }],
        {
          providers: ['ollama'],
          model: process.env.SEO_LOCAL_MODEL || process.env.OLLAMA_SEO_MODEL || process.env.OLLAMA_FAST_MODEL || 'qwen2.5-coder:7b',
          timeoutMs: Number(process.env.SEO_LOCAL_PROVIDER_TIMEOUT_MS || 120_000),
        },
      );

      const jobRow = db.prepare('SELECT id FROM seo_ai_jobs WHERE idempotency_key = ?').get(req.idempotency_key) as
        | { id: string }
        | undefined;

      if (jobRow) {
        db.prepare(`
          INSERT INTO seo_ai_responses (id, created_at, job_id, raw_response, parsed_json, validated)
          VALUES (@id, @created_at, @job_id, @raw_response, NULL, 0)
        `).run({
          id: seoId('air'),
          created_at: nowIso(),
          job_id: jobRow.id,
          raw_response: result.text,
        });
      }

      recordEvidence({
        brand_id: req.brand_id,
        category: 'seo_ai_local_model_response',
        summary: `Local model (${result.model}) response for task ${req.task_id} (${req.template})`,
        payload: { task_id: req.task_id, template: req.template, model: result.model, response_length: result.text.length },
      });

      return { status: 'completed', raw_response: result.text };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordEvidence({
        brand_id: req.brand_id,
        category: 'seo_ai_local_model_failed',
        summary: `Local model failed for task ${req.task_id} (${req.template})`,
        payload: { task_id: req.task_id, template: req.template, error },
      });
      return { status: 'failed', error };
    }
  }
}

export const localModelProvider = new LocalModelProvider();
