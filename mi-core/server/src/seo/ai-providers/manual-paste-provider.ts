/**
 * SEO Control Center — ManualPasteProvider (spec §3 fallback path).
 *
 * When the ChatGPT browser session can't run (no headless server access,
 * login expired and CEO hasn't re-authed yet, etc.) the CEO can still work
 * the old-fashioned way: copy the (redacted) prompt into chatgpt.com by
 * hand, paste the answer back into the SEO dashboard. This provider:
 *   - submit()               writes the job as `waiting_for_manual_paste`
 *                             and returns immediately — no browser involved.
 *   - submitManualResponse() is called by the dashboard route (owned by
 *                             another engineer) once the CEO pastes the
 *                             ChatGPT answer back in; marks the job
 *                             completed and stores the response.
 */

import { getSeoDb, nowIso, seoId } from '../seo-db';
import { recordEvidence } from '../seo-evidence';
import type { AIProvider, AIProviderRequest, AIProviderResult } from './ai-provider';
import { redactSecrets } from './redact';

export class ManualPasteProvider implements AIProvider {
  name = 'manual_paste';

  async submit(req: AIProviderRequest): Promise<AIProviderResult> {
    const db = getSeoDb();
    const redactedPrompt = redactSecrets(req.prompt);

    db.prepare(`
      UPDATE seo_ai_jobs
      SET status = 'waiting_for_manual_paste', updated_at = @updated_at, prompt = @prompt
      WHERE idempotency_key = @idempotency_key
    `).run({
      updated_at: nowIso(),
      prompt: redactedPrompt,
      idempotency_key: req.idempotency_key,
    });

    recordEvidence({
      brand_id: req.brand_id,
      category: 'seo_ai_manual_paste_requested',
      summary: `Manual paste requested for task ${req.task_id} (${req.template})`,
      payload: { task_id: req.task_id, template: req.template, idempotency_key: req.idempotency_key },
    });

    return { status: 'waiting_for_manual_paste' };
  }
}

export const manualPasteProvider = new ManualPasteProvider();

/**
 * Called by the SEO dashboard once the CEO pastes the ChatGPT answer back
 * in for a job that is sitting in `waiting_for_manual_paste`.
 *
 * Not part of the AIProvider interface — this is a human-triggered
 * completion callback, not something ai-router dispatches to.
 */
export function submitManualResponse(jobId: string, pastedText: string): { ok: boolean; error?: string } {
  const db = getSeoDb();
  const job = db.prepare('SELECT * FROM seo_ai_jobs WHERE id = ?').get(jobId) as
    | { id: string; status: string; brand_id?: string; task_id?: string; template?: string }
    | undefined;

  if (!job) return { ok: false, error: 'job_not_found' };
  if (job.status !== 'waiting_for_manual_paste' && job.status !== 'waiting_for_login') {
    return { ok: false, error: `job_not_awaiting_input (status=${job.status})` };
  }

  const redacted = redactSecrets(pastedText);

  db.prepare(`
    INSERT INTO seo_ai_responses (id, created_at, job_id, raw_response, parsed_json, validated)
    VALUES (@id, @created_at, @job_id, @raw_response, NULL, 0)
  `).run({
    id: seoId('air'),
    created_at: nowIso(),
    job_id: jobId,
    raw_response: redacted,
  });

  db.prepare(`
    UPDATE seo_ai_jobs SET status = 'completed', updated_at = @updated_at, error = NULL WHERE id = @id
  `).run({ updated_at: nowIso(), id: jobId });

  recordEvidence({
    action_id: jobId,
    brand_id: job.brand_id,
    category: 'seo_ai_manual_paste_completed',
    summary: `Manual ChatGPT response pasted for task ${job.task_id} (${job.template})`,
    payload: { job_id: jobId, response_length: redacted.length },
  });

  return { ok: true };
}
