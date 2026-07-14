/**
 * SEO Control Center — Backlink Management: store (spec §19).
 * CRUD over seo_backlinks / seo_backlink_checks.
 *
 * submitBacklinkForReview() runs the rule-based scorer (backlink-scorer.ts)
 * and ALWAYS routes the candidate through submitSeoAction() with category
 * 'backlink_approval' (REQUIRES_APPROVAL in config/seo-policy.yaml) — per
 * spec, "All backlink acquisition or exchange actions require approval," so
 * even a scorer recommendation of APPROVE is never auto-executed. The
 * scorer only produces a recommendation; a human still has to approve it
 * via POST /api/seo/backlinks/:id/approve before status flips to APPROVED.
 */

import { getSeoDb, nowIso, seoId } from '../seo-db';
import { recordEvidence } from '../seo-evidence';
import { submitSeoAction } from '../seo-approval-bridge';
import { scoreBacklink, type BacklinkScoringInput, type BacklinkScoringResult } from './backlink-scorer';

export interface BacklinkRecord {
  id: string;
  created_at: string;
  updated_at: string;
  brand_id: string;
  source_domain: string;
  source_url: string;
  destination_url: string;
  anchor_text: string | null;
  domain_authority: number | null;
  page_authority: number | null;
  spam_score: number | null;
  topical_relevance: number | null;
  local_relevance: number | null;
  link_type: string | null;
  sponsorship: string | null;
  first_seen_at: string | null;
  last_checked_at: string | null;
  status: string; // PENDING | APPROVED | REJECTED
  risk_score: number | null;
  estimated_value: number | null;
  evidence_id: string | null;
}

export interface SubmitBacklinkInput extends BacklinkScoringInput {
  estimated_value?: number;
}

export interface SubmitBacklinkResult {
  backlink: BacklinkRecord;
  scoring: BacklinkScoringResult;
  action_outcome: string;
}

export function submitBacklinkForReview(input: SubmitBacklinkInput): SubmitBacklinkResult {
  const db = getSeoDb();
  const scoring = scoreBacklink(input);
  const now = nowIso();
  const id = seoId('bl');

  const record: BacklinkRecord = {
    id,
    created_at: now,
    updated_at: now,
    brand_id: input.brand_id,
    source_domain: input.source_domain,
    source_url: input.source_url,
    destination_url: input.destination_url,
    anchor_text: input.anchor_text ?? null,
    domain_authority: input.domain_authority ?? null,
    page_authority: input.page_authority ?? null,
    spam_score: input.spam_score ?? null,
    topical_relevance: input.topical_relevance ?? null,
    local_relevance: input.local_relevance ?? null,
    link_type: input.link_type ?? null,
    sponsorship: input.sponsorship ?? null,
    first_seen_at: now,
    last_checked_at: now,
    status: 'PENDING', // final status only changes via approveBacklink/rejectBacklink (human decision)
    risk_score: scoring.risk_score,
    estimated_value: input.estimated_value ?? null,
    evidence_id: null,
  };

  db.prepare(`
    INSERT INTO seo_backlinks
      (id, created_at, updated_at, brand_id, source_domain, source_url, destination_url, anchor_text,
       domain_authority, page_authority, spam_score, topical_relevance, local_relevance, link_type,
       sponsorship, first_seen_at, last_checked_at, status, risk_score, estimated_value, evidence_id)
    VALUES
      (@id, @created_at, @updated_at, @brand_id, @source_domain, @source_url, @destination_url, @anchor_text,
       @domain_authority, @page_authority, @spam_score, @topical_relevance, @local_relevance, @link_type,
       @sponsorship, @first_seen_at, @last_checked_at, @status, @risk_score, @estimated_value, @evidence_id)
  `).run(record);

  const actionOutcome = submitSeoAction({
    category: 'backlink_approval',
    brand_id: input.brand_id,
    description: `Backlink candidate for review: ${input.source_url} -> ${input.destination_url} ` +
      `(scorer recommendation: ${scoring.decision}, risk_score=${scoring.risk_score})`,
    target: input.source_url,
    idempotency_key: `backlink_approval:${id}`,
    before_state: JSON.stringify({ status: 'PENDING' }),
    after_state: JSON.stringify({ scorer_decision: scoring.decision, risk_score: scoring.risk_score }),
  });

  const evidence = recordEvidence({
    brand_id: input.brand_id,
    category: 'backlink_evaluation_scan',
    summary: `Scored backlink ${input.source_url} -> ${input.destination_url}: ${scoring.decision} (risk ${scoring.risk_score})`,
    payload: { input, scoring, action_outcome: actionOutcome },
  });

  db.prepare('UPDATE seo_backlinks SET evidence_id = ? WHERE id = ?').run(evidence.id, id);

  const finalRecord = getBacklinkById(id) as BacklinkRecord;
  return { backlink: finalRecord, scoring, action_outcome: actionOutcome.outcome };
}

export function getBacklinkById(id: string): BacklinkRecord | undefined {
  return getSeoDb().prepare('SELECT * FROM seo_backlinks WHERE id = ?').get(id) as BacklinkRecord | undefined;
}

export function getBacklinksForBrand(brandId: string, status?: string): BacklinkRecord[] {
  const db = getSeoDb();
  if (status) {
    return db.prepare('SELECT * FROM seo_backlinks WHERE brand_id = ? AND status = ? ORDER BY created_at DESC')
      .all(brandId, status) as BacklinkRecord[];
  }
  return db.prepare('SELECT * FROM seo_backlinks WHERE brand_id = ? ORDER BY created_at DESC').all(brandId) as BacklinkRecord[];
}

/**
 * Marks a pending backlink APPROVED. This function is the terminal write —
 * the route layer (routes/seo-links.ts) is responsible for treating the
 * incoming HTTP request itself as the human approval event (a CEO clicking
 * "Approve" in the SEO Control Center) and for recording that decision via
 * submitSeoAction before calling this.
 */
export function approveBacklink(id: string, note?: string): BacklinkRecord | undefined {
  const db = getSeoDb();
  const existing = getBacklinkById(id);
  if (!existing) return undefined;
  db.prepare(`UPDATE seo_backlinks SET status = 'APPROVED', updated_at = ? WHERE id = ?`).run(nowIso(), id);
  recordEvidence({
    brand_id: existing.brand_id,
    category: 'backlink_approval',
    summary: `Backlink ${id} approved${note ? `: ${note}` : ''}`,
    payload: { backlink_id: id, note },
  });
  return getBacklinkById(id);
}

export function rejectBacklink(id: string, reason?: string): BacklinkRecord | undefined {
  const db = getSeoDb();
  const existing = getBacklinkById(id);
  if (!existing) return undefined;
  db.prepare(`UPDATE seo_backlinks SET status = 'REJECTED', updated_at = ? WHERE id = ?`).run(nowIso(), id);
  recordEvidence({
    brand_id: existing.brand_id,
    category: 'backlink_approval',
    summary: `Backlink ${id} rejected${reason ? `: ${reason}` : ''}`,
    payload: { backlink_id: id, reason },
  });
  return getBacklinkById(id);
}

export function recordBacklinkCheck(backlinkId: string, result: unknown): void {
  const db = getSeoDb();
  db.prepare('INSERT INTO seo_backlink_checks (id, backlink_id, checked_at, result) VALUES (?, ?, ?, ?)')
    .run(seoId('blc'), backlinkId, nowIso(), JSON.stringify(result));
  db.prepare('UPDATE seo_backlinks SET last_checked_at = ? WHERE id = ?').run(nowIso(), backlinkId);
}

export function getChecksForBacklink(backlinkId: string): { id: string; backlink_id: string; checked_at: string; result: string }[] {
  return getSeoDb().prepare('SELECT * FROM seo_backlink_checks WHERE backlink_id = ? ORDER BY checked_at DESC')
    .all(backlinkId) as { id: string; backlink_id: string; checked_at: string; result: string }[];
}
