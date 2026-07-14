/**
 * Article pipeline — persistence helpers over seo_pipeline_steps /
 * seo_pipeline_state (migration 0002_pipeline_state.ts).
 *
 * Everything the state machine (article-pipeline.ts) needs to survive a
 * process restart lives here: the per-step audit log and the small mutable
 * counters/blobs the machine carries between steps. Nothing in this module
 * holds pipeline state in memory — every read goes back to SQLite, which is
 * what makes `advancePipeline()` resumable after a restart (see
 * __pipeline_tests__/resume-after-restart.mjs).
 */

import { getSeoDb, nowIso, seoId } from '../seo-db';

export type PipelineStepStatus = 'running' | 'ok' | 'failed' | 'blocked' | 'waiting';

export interface PipelineStepRow {
  id: string;
  created_at: string;
  content_id: string;
  step: string;
  attempt_number: number;
  started_at: string;
  completed_at: string | null;
  status: PipelineStepStatus;
  error: string | null;
  blocked_reason: string | null;
  evidence_id: string | null;
}

export interface PipelineStateRow {
  content_id: string;
  created_at: string;
  updated_at: string;
  keyword_id: string | null;
  repair_loop_count: number;
  generation_attempt: number;
  last_qa_failure_reasons: string | null;
  content_brief_json: string | null;
  outline_json: string | null;
  draft_path: string | null;
  target_path: string | null;
  preview_path: string | null;
  preview_build_success: number | null;
  snapshot_id: string | null;
  approval_action_id: string | null;
}

export function ensurePipelineState(contentId: string, keywordId?: string | null): PipelineStateRow {
  const db = getSeoDb();
  const existing = db.prepare('SELECT * FROM seo_pipeline_state WHERE content_id = ?').get(contentId) as PipelineStateRow | undefined;
  if (existing) return existing;
  const now = nowIso();
  db.prepare(`
    INSERT INTO seo_pipeline_state (content_id, created_at, updated_at, keyword_id, repair_loop_count, generation_attempt)
    VALUES (@content_id, @created_at, @updated_at, @keyword_id, 0, 0)
  `).run({ content_id: contentId, created_at: now, updated_at: now, keyword_id: keywordId ?? null });
  return db.prepare('SELECT * FROM seo_pipeline_state WHERE content_id = ?').get(contentId) as PipelineStateRow;
}

export function getPipelineState(contentId: string): PipelineStateRow | undefined {
  return getSeoDb().prepare('SELECT * FROM seo_pipeline_state WHERE content_id = ?').get(contentId) as PipelineStateRow | undefined;
}

export function updatePipelineState(contentId: string, patch: Partial<Omit<PipelineStateRow, 'content_id' | 'created_at'>>): PipelineStateRow {
  ensurePipelineState(contentId);
  const db = getSeoDb();
  const fields = Object.keys(patch);
  if (fields.length > 0) {
    const setClause = fields.map(f => `${f} = @${f}`).join(', ');
    db.prepare(`UPDATE seo_pipeline_state SET ${setClause}, updated_at = @updated_at WHERE content_id = @content_id`)
      .run({ ...patch, updated_at: nowIso(), content_id: contentId });
  } else {
    db.prepare('UPDATE seo_pipeline_state SET updated_at = @updated_at WHERE content_id = @content_id')
      .run({ updated_at: nowIso(), content_id: contentId });
  }
  return getPipelineState(contentId)!;
}

/** Increments repair_loop_count and returns the new value. */
export function incrementRepairLoop(contentId: string): number {
  ensurePipelineState(contentId);
  const db = getSeoDb();
  db.prepare('UPDATE seo_pipeline_state SET repair_loop_count = repair_loop_count + 1, updated_at = ? WHERE content_id = ?')
    .run(nowIso(), contentId);
  return getPipelineState(contentId)!.repair_loop_count;
}

export function resetRepairLoop(contentId: string): void {
  updatePipelineState(contentId, { repair_loop_count: 0 });
}

export function getLatestAttemptNumber(contentId: string, step: string): number {
  const db = getSeoDb();
  const row = db.prepare(
    'SELECT MAX(attempt_number) as maxAttempt FROM seo_pipeline_steps WHERE content_id = ? AND step = ?',
  ).get(contentId, step) as { maxAttempt: number | null };
  return row.maxAttempt ?? 0;
}

/** Starts (records) a new step attempt row. Returns its id for use with recordStepEnd(). */
export function recordStepStart(contentId: string, step: string): { id: string; attemptNumber: number } {
  const db = getSeoDb();
  const attemptNumber = getLatestAttemptNumber(contentId, step) + 1;
  const id = seoId('pstep');
  const now = nowIso();
  db.prepare(`
    INSERT INTO seo_pipeline_steps (id, created_at, content_id, step, attempt_number, started_at, completed_at, status, error, blocked_reason, evidence_id)
    VALUES (@id, @created_at, @content_id, @step, @attempt_number, @started_at, NULL, 'running', NULL, NULL, NULL)
  `).run({ id, created_at: now, content_id: contentId, step, attempt_number: attemptNumber, started_at: now });
  return { id, attemptNumber };
}

export function recordStepEnd(
  stepRowId: string,
  status: Exclude<PipelineStepStatus, 'running'>,
  opts: { error?: string; blocked_reason?: string; evidence_id?: string } = {},
): void {
  getSeoDb().prepare(`
    UPDATE seo_pipeline_steps
    SET status = @status, completed_at = @completed_at, error = @error, blocked_reason = @blocked_reason, evidence_id = @evidence_id
    WHERE id = @id
  `).run({
    id: stepRowId,
    status,
    completed_at: nowIso(),
    error: opts.error ?? null,
    blocked_reason: opts.blocked_reason ?? null,
    evidence_id: opts.evidence_id ?? null,
  });
}

export function getStepHistory(contentId: string): PipelineStepRow[] {
  return getSeoDb().prepare(
    'SELECT * FROM seo_pipeline_steps WHERE content_id = ? ORDER BY created_at ASC',
  ).all(contentId) as PipelineStepRow[];
}
