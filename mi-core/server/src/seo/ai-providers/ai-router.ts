/**
 * SEO Control Center — AI job dispatcher (spec §3/§5).
 *
 * submitAiJob() is the single entry point other SEO engines should call to
 * get AI-generated content. It:
 *   1. Checks seo_ai_jobs for an existing completed job with the same
 *      idempotency_key and returns the cached response if found.
 *   2. Creates/updates the seo_ai_jobs row (queued -> running).
 *   3. Dispatches to the requested provider (default: chatgpt_browser, the
 *      spec's primary provider).
 *   4. Persists the final job status and records evidence.
 */

import { getSeoDb, nowIso, seoId } from '../seo-db';
import { recordEvidence } from '../seo-evidence';
import type { AIProvider, AIProviderRequest, AIProviderResult } from './ai-provider';
import { redactSecrets } from './redact';
import { chatGptBrowserProvider } from './chatgpt-browser-provider';
import { manualPasteProvider } from './manual-paste-provider';
import { localModelProvider } from './local-model-provider';

export type AiProviderChoice = 'chatgpt_browser' | 'manual_paste' | 'local_model';

interface JobRow {
  id: string;
  status: string;
  provider: string;
}

function resolveProvider(name: AiProviderChoice): AIProvider {
  switch (name) {
    case 'manual_paste': return manualPasteProvider;
    case 'local_model': return localModelProvider;
    case 'chatgpt_browser':
    default: return chatGptBrowserProvider;
  }
}

export async function submitAiJob(
  req: AIProviderRequest,
  providerName: AiProviderChoice = 'chatgpt_browser',
): Promise<AIProviderResult> {
  const db = getSeoDb();
  const redactedPrompt = redactSecrets(req.prompt);
  const now = nowIso();

  const existing = db.prepare('SELECT id, status, provider FROM seo_ai_jobs WHERE idempotency_key = ?')
    .get(req.idempotency_key) as JobRow | undefined;

  // Idempotency short-circuit: a previously completed job returns its cached response.
  if (existing && existing.status === 'completed') {
    const cached = db.prepare(
      'SELECT raw_response FROM seo_ai_responses WHERE job_id = ? ORDER BY created_at DESC LIMIT 1',
    ).get(existing.id) as { raw_response: string } | undefined;
    if (cached) {
      return { status: 'completed', raw_response: cached.raw_response };
    }
  }

  if (existing) {
    db.prepare(`
      UPDATE seo_ai_jobs
      SET status = 'running', provider = @provider, template = @template, prompt = @prompt, error = NULL, updated_at = @updated_at
      WHERE id = @id
    `).run({
      provider: providerName,
      template: req.template,
      prompt: redactedPrompt,
      updated_at: now,
      id: existing.id,
    });
  } else {
    db.prepare(`
      INSERT INTO seo_ai_jobs
        (id, created_at, updated_at, task_id, brand_id, location_id, article_id, provider, template, idempotency_key, status, prompt, error)
      VALUES
        (@id, @created_at, @updated_at, @task_id, @brand_id, @location_id, @article_id, @provider, @template, @idempotency_key, 'running', @prompt, NULL)
    `).run({
      id: seoId('aij'),
      created_at: now,
      updated_at: now,
      task_id: req.task_id,
      brand_id: req.brand_id,
      location_id: req.location_id || null,
      article_id: req.article_id || null,
      provider: providerName,
      template: req.template,
      idempotency_key: req.idempotency_key,
      prompt: redactedPrompt,
    });
  }

  recordEvidence({
    brand_id: req.brand_id,
    category: 'seo_ai_job_started',
    summary: `AI job started: ${req.template} via ${providerName} (task ${req.task_id})`,
    payload: { task_id: req.task_id, template: req.template, provider: providerName, idempotency_key: req.idempotency_key },
  });

  const provider = resolveProvider(providerName);
  let result: AIProviderResult;
  try {
    result = await provider.submit({ ...req, prompt: redactedPrompt });
  } catch (e) {
    result = { status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }

  db.prepare(`
    UPDATE seo_ai_jobs SET status = @status, error = @error, updated_at = @updated_at WHERE idempotency_key = @idempotency_key
  `).run({
    status: result.status,
    error: result.error || null,
    updated_at: nowIso(),
    idempotency_key: req.idempotency_key,
  });

  recordEvidence({
    brand_id: req.brand_id,
    category: 'seo_ai_job_finished',
    summary: `AI job ${result.status}: ${req.template} via ${providerName} (task ${req.task_id})`,
    payload: {
      task_id: req.task_id,
      template: req.template,
      provider: providerName,
      idempotency_key: req.idempotency_key,
      status: result.status,
      error: result.error,
      response_length: result.raw_response?.length,
    },
  });

  return result;
}
