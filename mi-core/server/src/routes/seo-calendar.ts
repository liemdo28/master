/**
 * SEO Control Center — Content Calendar routes.
 * New router file (kept separate from routes/seo.ts and routes/seo-research.ts
 * to avoid merge conflicts with concurrent work there). Mount as
 * `seoCalendarRouter` under `/api/seo`.
 *
 * Reads/writes seo_content_items directly (no new tables/columns needed —
 * every field this router uses already exists in migration 0001). Article
 * pipeline status values (APPROVED_KEYWORD, CONTENT_BRIEF, ..., SCHEDULED,
 * PRODUCTION_READY, BLOCKED, REJECTED, FAILED, ROLLED_BACK) may or may not be
 * populated yet depending on whether server/src/seo/pipeline/article-pipeline.ts
 * has landed — this router doesn't assume any particular status exists; it
 * reads whatever rows are actually there. New rows created here start at
 * 'IDEA', which is the schema's own DEFAULT for seo_content_items.status, i.e.
 * the documented pre-pipeline state, not an invented one.
 */

import { Router, Request, Response } from 'express';
import { getSeoDb, nowIso, seoId } from '../seo/seo-db';
import { getActiveBrands, getBrandById } from '../seo/brand-config';
import { submitSeoAction } from '../seo/seo-approval-bridge';
import { recordEvidence } from '../seo/seo-evidence';
import { insertKeyword } from '../seo/keywords/keyword-store';
import { getById as getApprovalById } from '../approval/gate';

export const seoCalendarRouter = Router();

// ── Row shapes ───────────────────────────────────────────────────────────

interface ContentItemRow {
  id: string;
  created_at: string;
  updated_at: string;
  brand_id: string;
  location_id: string | null;
  title: string | null;
  slug: string | null;
  primary_keyword_id: string | null;
  search_intent: string | null;
  article_type: string | null;
  status: string;
  quality_score: number | null;
  ai_provider: string | null;
  scheduled_publish_at: string | null;
  published_at: string | null;
  approval_id: string | null;
  current_version_id: string | null;
  deleted_at: string | null;
  primary_keyword_text: string | null;
}

interface PublishSnapshotRow {
  id: string;
  created_at: string;
  brand_id: string;
  content_id: string | null;
  target: string;
  status: string;
}

function slugify(title: string, fallbackId: string): string {
  const base = (title || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return base || fallbackId;
}

function withinRange(dateStr: string | null, from?: string, to?: string): boolean {
  if (!dateStr) return false;
  if (from && dateStr < from) return false;
  // Allow "to" to be a bare date (YYYY-MM-DD) by comparing against the
  // end-of-day equivalent so items scheduled on the "to" day are included.
  if (to) {
    const toBound = to.length <= 10 ? `${to}T23:59:59.999Z` : to;
    if (dateStr > toBound) return false;
  }
  return true;
}

function fetchLatestPreview(contentIds: string[]): Map<string, PublishSnapshotRow> {
  const result = new Map<string, PublishSnapshotRow>();
  if (contentIds.length === 0) return result;
  const db = getSeoDb();
  const placeholders = contentIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT id, created_at, brand_id, content_id, target, status FROM seo_publish_snapshots
     WHERE content_id IN (${placeholders}) ORDER BY created_at DESC`,
  ).all(...contentIds) as PublishSnapshotRow[];
  for (const row of rows) {
    if (row.content_id && !result.has(row.content_id)) result.set(row.content_id, row);
  }
  return result;
}

function serializeItem(row: ContentItemRow, preview: PublishSnapshotRow | undefined) {
  let approval: { id: string; status: string; category: string; description: string } | null = null;
  if (row.approval_id) {
    const a = getApprovalById(row.approval_id);
    if (a) approval = { id: a.id, status: a.status, category: a.category, description: a.description };
  }

  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    brand_id: row.brand_id,
    location_id: row.location_id,
    title: row.title,
    slug: row.slug,
    primary_keyword_id: row.primary_keyword_id,
    primary_keyword: row.primary_keyword_text,
    search_intent: row.search_intent,
    article_type: row.article_type,
    status: row.status,
    quality_score: row.quality_score,
    ai_provider: row.ai_provider,
    scheduled_publish_at: row.scheduled_publish_at,
    published_at: row.published_at,
    effective_date: row.scheduled_publish_at || row.created_at,
    approval_id: row.approval_id,
    approval,
    preview: preview
      ? { exists: true, target: preview.target, status: preview.status, created_at: preview.created_at }
      : { exists: false },
    // No per-item GSC index-status connector is wired up yet — this is an
    // honest placeholder, not a fabricated indexed/not-indexed signal.
    indexing_state: 'not_yet_indexed',
  };
}

// ── GET /api/seo/calendar?brand_id=&location_id=&from=&to=&view= ─────────

seoCalendarRouter.get('/calendar', (req: Request, res: Response) => {
  const brandId = (req.query.brand_id as string | undefined) || undefined;
  if (brandId) {
    const brand = getBrandById(brandId);
    if (!brand) return res.status(404).json({ ok: false, error: 'brand_not_found' });
  }

  const locationId = req.query.location_id as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const view = (req.query.view as string) || 'month';

  try {
    const db = getSeoDb();
    const clauses = ['ci.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (brandId) {
      clauses.push('ci.brand_id = ?');
      params.push(brandId);
    } else {
      const activeBrandIds = getActiveBrands().map(b => b.brand_id);
      if (activeBrandIds.length === 0) {
        return res.json({
          ok: true,
          brand_id: null,
          location_id: locationId || null,
          from: from || null,
          to: to || null,
          view,
          total: 0,
          scheduled: [],
          unscheduled: [],
        });
      }
      clauses.push(`ci.brand_id IN (${activeBrandIds.map(() => '?').join(',')})`);
      params.push(...activeBrandIds);
    }
    if (locationId) { clauses.push('ci.location_id = ?'); params.push(locationId); }

    const rows = db.prepare(`
      SELECT ci.*, kw.keyword AS primary_keyword_text
      FROM seo_content_items ci
      LEFT JOIN seo_keywords kw ON kw.id = ci.primary_keyword_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY COALESCE(ci.scheduled_publish_at, ci.created_at) ASC
    `).all(...params) as ContentItemRow[];

    const previews = fetchLatestPreview(rows.map(r => r.id));

    const scheduled: ReturnType<typeof serializeItem>[] = [];
    const unscheduled: ReturnType<typeof serializeItem>[] = [];

    for (const row of rows) {
      const serialized = serializeItem(row, previews.get(row.id));
      if (row.scheduled_publish_at) {
        if (!from && !to) { scheduled.push(serialized); continue; }
        if (withinRange(row.scheduled_publish_at, from, to)) scheduled.push(serialized);
      } else {
        // Unscheduled bucket: fall back to created_at for range filtering so
        // ancient stray drafts don't flood a narrow "this month" view, but
        // the item is never silently hidden — it always lands somewhere.
        if (!from && !to) { unscheduled.push(serialized); continue; }
        if (withinRange(row.created_at, from, to)) unscheduled.push(serialized);
      }
    }

    res.json({
      ok: true,
      brand_id: brandId || null,
      location_id: locationId || null,
      from: from || null,
      to: to || null,
      view,
      total: scheduled.length + unscheduled.length,
      scheduled,
      unscheduled,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

// ── POST /api/seo/calendar/items ──────────────────────────────────────────
// Lightweight pre-pipeline row: title + optional keyword text + brand +
// location + date. Starts at status 'IDEA' (the schema default).

seoCalendarRouter.post('/calendar/items', (req: Request, res: Response) => {
  const { brand_id, location_id, title, keyword, date, search_intent, article_type } = req.body || {};
  if (!brand_id || !title) return res.status(400).json({ ok: false, error: 'brand_id and title are required' });
  const brand = getBrandById(brand_id);
  if (!brand) return res.status(404).json({ ok: false, error: 'brand_not_found' });

  try {
    const db = getSeoDb();
    const now = nowIso();
    const id = seoId('content');

    let primaryKeywordId: string | null = null;
    if (keyword && String(keyword).trim()) {
      const kw = insertKeyword({
        brand_id,
        keyword: String(keyword).trim(),
        location_id: location_id || null,
        source: 'calendar_manual',
      });
      primaryKeywordId = kw.id;
    }

    const row = {
      id,
      created_at: now,
      updated_at: now,
      brand_id,
      location_id: location_id || null,
      title: String(title),
      slug: slugify(String(title), id),
      primary_keyword_id: primaryKeywordId,
      search_intent: search_intent || null,
      article_type: article_type || null,
      status: 'IDEA',
      quality_score: null,
      ai_provider: null,
      scheduled_publish_at: date || null,
      published_at: null,
      approval_id: null,
      current_version_id: null,
      deleted_at: null,
    };

    db.prepare(`
      INSERT INTO seo_content_items (
        id, created_at, updated_at, brand_id, location_id, title, slug,
        primary_keyword_id, search_intent, article_type, status, quality_score,
        ai_provider, scheduled_publish_at, published_at, approval_id, current_version_id, deleted_at
      ) VALUES (
        @id, @created_at, @updated_at, @brand_id, @location_id, @title, @slug,
        @primary_keyword_id, @search_intent, @article_type, @status, @quality_score,
        @ai_provider, @scheduled_publish_at, @published_at, @approval_id, @current_version_id, @deleted_at
      )
    `).run(row);

    recordEvidence({
      brand_id,
      category: 'create_calendar_item',
      summary: `Calendar item created: "${row.title}"`,
      payload: { content_id: id, keyword: keyword || null, date: date || null },
    });

    const full = db.prepare(`
      SELECT ci.*, kw.keyword AS primary_keyword_text
      FROM seo_content_items ci LEFT JOIN seo_keywords kw ON kw.id = ci.primary_keyword_id
      WHERE ci.id = ?
    `).get(id) as ContentItemRow;

    res.status(201).json({ ok: true, item: serializeItem(full, undefined) });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

// ── PATCH /api/seo/calendar/items/:id ─────────────────────────────────────
// Supports { scheduled_publish_at } for drag-and-drop rescheduling and
// { status } for pause/reject/other pre-pipeline transitions.

seoCalendarRouter.patch('/calendar/items/:id', (req: Request, res: Response) => {
  const db = getSeoDb();
  const existing = db.prepare('SELECT * FROM seo_content_items WHERE id = ? AND deleted_at IS NULL').get(req.params.id) as ContentItemRow | undefined;
  if (!existing) return res.status(404).json({ ok: false, error: 'content_item_not_found' });

  const body = req.body || {};
  const hasReschedule = Object.prototype.hasOwnProperty.call(body, 'scheduled_publish_at');
  const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status');
  if (!hasReschedule && !hasStatus) {
    return res.status(400).json({ ok: false, error: 'provide scheduled_publish_at and/or status to update' });
  }

  const actions: unknown[] = [];

  try {
    if (hasReschedule) {
      const newDate: string | null = body.scheduled_publish_at || null;
      const outcome = submitSeoAction({
        category: 'reschedule_content',
        brand_id: existing.brand_id,
        description: `Reschedule "${existing.title || existing.id}" from ${existing.scheduled_publish_at || 'unscheduled'} to ${newDate || 'unscheduled'}`,
        target: existing.id,
        before_state: existing.scheduled_publish_at || undefined,
        after_state: newDate || undefined,
        idempotency_key: seoId('resched'),
        payload: { content_id: existing.id, from: existing.scheduled_publish_at, to: newDate },
      });
      actions.push({ type: 'reschedule', outcome });

      if (outcome.outcome === 'auto_executed' || outcome.outcome === 'auto_executed_with_notification') {
        db.prepare('UPDATE seo_content_items SET scheduled_publish_at = ?, updated_at = ? WHERE id = ?')
          .run(newDate, nowIso(), existing.id);
      }
      // BLOCKED / pending_approval / duplicate: leave DB untouched; the
      // outcome above tells the caller why the date did not change.
    }

    if (hasStatus) {
      const newStatus: string = String(body.status);
      const riskyTransition = newStatus === 'PAUSED' || newStatus === 'REJECTED';

      if (riskyTransition) {
        const category = newStatus === 'PAUSED' ? 'pause_content' : 'reject_content';
        const outcome = submitSeoAction({
          category,
          brand_id: existing.brand_id,
          description: `${newStatus === 'PAUSED' ? 'Pause' : 'Reject'} "${existing.title || existing.id}" (${existing.status} -> ${newStatus})`,
          target: existing.id,
          before_state: existing.status,
          after_state: newStatus,
          idempotency_key: seoId(newStatus === 'PAUSED' ? 'pause' : 'reject'),
          payload: { content_id: existing.id, from: existing.status, to: newStatus },
        });
        actions.push({ type: 'status', outcome });

        if (outcome.outcome === 'auto_executed' || outcome.outcome === 'auto_executed_with_notification') {
          db.prepare('UPDATE seo_content_items SET status = ?, updated_at = ? WHERE id = ?')
            .run(newStatus, nowIso(), existing.id);
        }
        // pause_content/reject_content are not in seo-policy.yaml, so they
        // fail-safe to REQUIRES_APPROVAL — outcome will be 'pending_approval'
        // and status intentionally stays unchanged until a human approves it
        // via the existing /api/approval/:id/approve endpoint (same pattern
        // as verify_business_fact in seo-research.ts).
      } else {
        db.prepare('UPDATE seo_content_items SET status = ?, updated_at = ? WHERE id = ?')
          .run(newStatus, nowIso(), existing.id);
        recordEvidence({
          brand_id: existing.brand_id,
          category: 'calendar_item_status_change',
          summary: `"${existing.title || existing.id}" status ${existing.status} -> ${newStatus}`,
          payload: { content_id: existing.id, from: existing.status, to: newStatus },
        });
        actions.push({ type: 'status', outcome: { outcome: 'auto_executed_direct' } });
      }
    }

    const full = db.prepare(`
      SELECT ci.*, kw.keyword AS primary_keyword_text
      FROM seo_content_items ci LEFT JOIN seo_keywords kw ON kw.id = ci.primary_keyword_id
      WHERE ci.id = ?
    `).get(existing.id) as ContentItemRow;
    const previews = fetchLatestPreview([existing.id]);

    res.json({ ok: true, item: serializeItem(full, previews.get(existing.id)), actions });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});
