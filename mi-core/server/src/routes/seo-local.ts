/**
 * SEO Control Center — Local SEO Engine + GBP Posts routes (spec §4 posts-only, §17).
 * Mounted separately from routes/seo.ts to avoid touching that file while it's
 * being worked on concurrently. Backing engines: seo/local/*.ts, seo/publishing/*.ts.
 */

import { Router, Request, Response } from 'express';
import { getActiveBrands, getActiveLocationsForBrand, getLocationById } from '../seo/brand-config';
import { runLocalAudit } from '../seo/local/local-audit';
import { checkNapConsistency } from '../seo/local/nap-consistency';
import { syncGbpSnapshot, generateGbpPostDraft, submitGbpPostForApproval, publishApprovedGbpPost } from '../seo/local/gbp-posts';
import { getSeoDb } from '../seo/seo-db';
import { bakudanPublisher } from '../seo/publishing/bakudan-publisher';
import { rawSushiPublisher } from '../seo/publishing/raw-sushi-publisher';
import type { WebsitePublisher } from '../seo/publishing/website-publisher';
import { executeWithSeoApproval } from '../seo/seo-approved-executor';

function sendApprovedExecutionFailure(res: Response, executed: Awaited<ReturnType<typeof executeWithSeoApproval>>) {
  const { status, ok: _ok, ...body } = executed;
  return res.status(status || 500).json({ ok: false, ...body });
}

export const seoLocalRouter = Router();

function publisherFor(brandId: string): WebsitePublisher | null {
  if (brandId === 'bakudan') return bakudanPublisher;
  if (brandId === 'raw_sushi') return rawSushiPublisher;
  return null;
}

// ── Local SEO ──────────────────────────────────────────────────────────────

// GET /api/seo/local?brand_id=
seoLocalRouter.get('/local', (req: Request, res: Response) => {
  const brandId = req.query.brand_id as string | undefined;
  const brands = brandId ? [brandId] : getActiveBrands().map(b => b.brand_id);

  const db = getSeoDb();
  const locations = brands.flatMap(id =>
    getActiveLocationsForBrand(id).map(loc => {
      const audit = db.prepare(`
        SELECT * FROM seo_audits
        WHERE brand_id = ? AND audit_type = 'local' AND summary LIKE ?
        ORDER BY created_at DESC LIMIT 1
      `).get(id, `%${loc.location_id}%`) as any;
      const nap = checkNapConsistency(id, loc.location_id);
      let status = 'NOT_AUDITED';
      if (audit?.summary) {
        try {
          const summary = JSON.parse(audit.summary);
          const checks = summary.checks || [];
          status = checks.some((c: any) => c.status === 'fail') ? 'WARNING' : 'PASS';
        } catch {
          status = audit.status === 'completed' ? 'PASS' : 'NOT_AUDITED';
        }
      } else if (nap.consistent === false) {
        status = 'WARNING';
      } else if (nap.consistent === null) {
        status = 'BLOCKED_DATA_SOURCE';
      }
      return {
      brand_id: id,
      location_id: loc.location_id,
      name: loc.name,
      status,
      nap,
      audit: audit || null,
    };
    })
  );

  res.json({ ok: true, total: locations.length, locations });
});

// GET /api/seo/local/:locationId?brand_id=
seoLocalRouter.get('/local/:locationId', (req: Request, res: Response) => {
  const brandId = req.query.brand_id as string | undefined;
  if (!brandId) return res.status(400).json({ ok: false, error: 'brand_id query param required' });

  const location = getLocationById(brandId, req.params.locationId);
  if (!location) return res.status(404).json({ ok: false, error: 'location_not_found' });

  const db = getSeoDb();
  const recentAudits = db.prepare(`
    SELECT id, audit_type, status, summary, created_at, completed_at FROM seo_audits
    WHERE brand_id = ? AND audit_type = 'local' ORDER BY created_at DESC LIMIT 5
  `).all(brandId);

  res.json({
    ok: true,
    brand_id: brandId,
    location,
    nap: checkNapConsistency(brandId, req.params.locationId),
    recent_audits: recentAudits,
  });
});

// POST /api/seo/local/:locationId/audit  body: { brand_id }
seoLocalRouter.post('/local/:locationId/audit', async (req: Request, res: Response) => {
  const brandId = req.body?.brand_id as string | undefined;
  if (!brandId) return res.status(400).json({ ok: false, error: 'brand_id required' });

  try {
    const result = await runLocalAudit(brandId, req.params.locationId);
    res.json({ ok: true, ...result });
  } catch (e: unknown) {
    const err = e as { message?: string };
    res.status(500).json({ ok: false, error: err?.message || 'audit_failed' });
  }
});

// POST /api/seo/local/:locationId/gbp-sync  body: { brand_id }
seoLocalRouter.post('/local/:locationId/gbp-sync', async (req: Request, res: Response) => {
  const brandId = req.body?.brand_id as string | undefined;
  if (!brandId) return res.status(400).json({ ok: false, error: 'brand_id required' });

  const executed = await executeWithSeoApproval(req, async () => {
    const result = await syncGbpSnapshot(brandId, req.params.locationId);
    return { ...result, success: result.status === 'SNAPSHOT_STORED' };
  });
  if (!executed.ok) return sendApprovedExecutionFailure(res, executed);
  const result = executed.result!;
  res.json({ ok: result.status === 'SNAPSHOT_STORED', ...result });
});

// ── GBP Posts ──────────────────────────────────────────────────────────────

// GET /api/seo/gbp/posts?brand_id=&location_id=
seoLocalRouter.get('/gbp/posts', (req: Request, res: Response) => {
  const brandId = req.query.brand_id as string | undefined;
  if (!brandId) return res.status(400).json({ ok: false, error: 'brand_id required' });
  const locationId = req.query.location_id as string | undefined;

  const db = getSeoDb();
  const rows = locationId
    ? db.prepare(`SELECT * FROM seo_actions WHERE brand_id = ? AND category = 'gbp_post_publish' AND target = ? ORDER BY created_at DESC`).all(brandId, locationId)
    : db.prepare(`SELECT * FROM seo_actions WHERE brand_id = ? AND category = 'gbp_post_publish' ORDER BY created_at DESC`).all(brandId);
  const previewRows = locationId
    ? db.prepare(`SELECT * FROM seo_content_previews WHERE brand_id = ? AND location_id = ? AND content_type = 'gbp_post' ORDER BY created_at DESC`).all(brandId, locationId)
    : db.prepare(`SELECT * FROM seo_content_previews WHERE brand_id = ? AND content_type = 'gbp_post' ORDER BY created_at DESC`).all(brandId);
  const previews = (previewRows as any[]).map(p => {
    let payload: any = {};
    try { payload = JSON.parse(p.payload_json || '{}'); } catch {}
    const action = (rows as any[]).find(a => a.target === p.id);
    return {
      id: p.id,
      created_at: p.created_at,
      brand_id: p.brand_id,
      location_id: p.location_id,
      topic: payload.topic || p.title,
      description: p.title,
      draft_body: payload.text || payload.body || '',
      cta: payload.cta || null,
      link: payload.cta?.url || payload.cta_url || null,
      post_type: payload.post_type || 'local_update',
      scheduled_date: null,
      policy_result: 'see_policy_results',
      fact_result: 'PASS',
      approval_state: action?.status || 'pending',
      execution_state: p.preview_status,
      provider: 'DETERMINISTIC_POLICY_TEMPLATE',
      content_hash: p.checksum,
      status: p.preview_status,
      action,
    };
  });

  res.json({ ok: true, brand_id: brandId, location_id: locationId ?? null, total: previews.length + rows.length, posts: [...previews, ...(rows as any[])] });
});

// POST /api/seo/gbp/posts/generate  body: { brand_id, location_id, topic }
seoLocalRouter.post('/gbp/posts/generate', (req: Request, res: Response) => {
  const { brand_id, location_id, topic } = req.body || {};
  if (!brand_id || !location_id || !topic) {
    return res.status(400).json({ ok: false, error: 'brand_id, location_id, and topic are required' });
  }

  try {
    const draft = generateGbpPostDraft(brand_id, location_id, topic);
    const submission = submitGbpPostForApproval(brand_id, location_id, draft);
    res.json({ ok: true, draft, ...submission });
  } catch (e: unknown) {
    const err = e as { message?: string };
    res.status(400).json({ ok: false, error: err?.message || 'draft_generation_failed' });
  }
});

// POST /api/seo/gbp/posts/:id/approve
// The approval decision itself happens in the existing approval gate
// (/api/approval/:id/approve) — this endpoint is a convenience lookup so the
// dashboard can show the linked approval's current status for a gbp post action.
seoLocalRouter.post('/gbp/posts/:id/approve', (req: Request, res: Response) => {
  const db = getSeoDb();
  const action = db.prepare('SELECT * FROM seo_actions WHERE id = ? AND category = ?').get(req.params.id, 'gbp_post_publish');
  if (!action) return res.status(404).json({ ok: false, error: 'gbp_post_action_not_found' });
  res.json({
    ok: true,
    action,
    note: 'Approve/reject the linked approval via POST /api/approval/:approval_id/approve (existing approval gate) — this route only reports status.',
  });
});

// POST /api/seo/gbp/posts/:id/publish
seoLocalRouter.post('/gbp/posts/:id/publish', async (req: Request, res: Response) => {
  const executed = await executeWithSeoApproval(req, () => publishApprovedGbpPost(req.params.id));
  if (!executed.ok) return sendApprovedExecutionFailure(res, executed);
  const result = executed.result!;
  res.json({ ok: result.success, ...result });
});

// ── Website publish preview / rollback (spec §25) ──────────────────────────

// POST /api/seo/publish/:brandId/preview  body: { contentId, html, targetPath }
seoLocalRouter.post('/publish/:brandId/preview', async (req: Request, res: Response) => {
  const publisher = publisherFor(req.params.brandId);
  if (!publisher) return res.status(404).json({ ok: false, error: 'unknown_brand' });

  const { contentId, html, targetPath } = req.body || {};
  if (!contentId || !html || !targetPath) {
    return res.status(400).json({ ok: false, error: 'contentId, html, and targetPath are required' });
  }

  try {
    const { draftPath } = await publisher.createDraft(contentId, html, targetPath);
    const preview = await publisher.createPreview(draftPath);
    res.json({ ok: preview.success, draftPath, ...preview });
  } catch (e: unknown) {
    const err = e as { message?: string };
    res.status(400).json({ ok: false, error: err?.message || 'preview_failed' });
  }
});

// POST /api/seo/publish/:brandId/:snapshotId/publish
seoLocalRouter.post('/publish/:brandId/:snapshotId/publish', async (req: Request, res: Response) => {
  const publisher = publisherFor(req.params.brandId);
  if (!publisher) return res.status(404).json({ ok: false, error: 'unknown_brand' });
  const executed = await executeWithSeoApproval(req, () => publisher.publishApproved(req.params.snapshotId));
  if (!executed.ok) return sendApprovedExecutionFailure(res, executed);
  const result = executed.result!;
  res.json({ ok: result.success, ...result });
});

// POST /api/seo/publish/:brandId/:snapshotId/rollback
seoLocalRouter.post('/publish/:brandId/:snapshotId/rollback', async (req: Request, res: Response) => {
  const publisher = publisherFor(req.params.brandId);
  if (!publisher) return res.status(404).json({ ok: false, error: 'unknown_brand' });
  const executed = await executeWithSeoApproval(req, () => publisher.rollback(req.params.snapshotId));
  if (!executed.ok) return sendApprovedExecutionFailure(res, executed);
  const result = executed.result!;
  res.json({ ok: result.success, ...result });
});
