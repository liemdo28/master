/**
 * SEO Control Center — Internal Link Engine + CTA Engine + Backlink
 * Management routes (spec §15, §16, §19).
 * Mounted separately from routes/seo.ts to avoid touching that file while
 * it's being worked on concurrently.
 */

import { Router, Request, Response } from 'express';
import { getSeoDb } from '../seo/seo-db';
import { recordEvidence } from '../seo/seo-evidence';
import { submitSeoAction } from '../seo/seo-approval-bridge';
import { getPagesForBrand } from '../seo/links/link-registry';
import { detectOrphanPages } from '../seo/links/orphan-detector';
import { runBrokenLinkCheck } from '../seo/links/broken-link-checker';
import { computeAnchorDiversity } from '../seo/links/anchor-diversity';
import {
  getBacklinksForBrand,
  submitBacklinkForReview,
  approveBacklink,
  rejectBacklink,
  getBacklinkById,
  type SubmitBacklinkInput,
} from '../seo/backlinks/backlink-store';
import { disabledReason, isSeoBacklinkWriteEnabled } from '../seo/seo-write-guards';
import { executeWithSeoApproval } from '../seo/seo-approved-executor';

function sendApprovedExecutionFailure(res: Response, executed: Awaited<ReturnType<typeof executeWithSeoApproval>>) {
  const { status, ok: _ok, ...body } = executed;
  return res.status(status || 500).json({ ok: false, ...body });
}

export const seoLinksRouter = Router();

// ── Internal Links ─────────────────────────────────────────────────────────

// GET /api/seo/internal-links?brand_id=
seoLinksRouter.get('/internal-links', (req: Request, res: Response) => {
  const brandId = req.query.brand_id as string | undefined;
  if (!brandId) return res.status(400).json({ ok: false, error: 'brand_id required' });

  const db = getSeoDb();
  const links = db.prepare('SELECT * FROM seo_internal_links WHERE brand_id = ? ORDER BY last_verified_at DESC')
    .all(brandId);
  const pages = getPagesForBrand(brandId);

  res.json({
    ok: true,
    brand_id: brandId,
    page_count: pages.length,
    link_count: links.length,
    pages,
    links,
  });
});

// POST /api/seo/internal-links/analyze  body: { brand_id }
seoLinksRouter.post('/internal-links/analyze', async (req: Request, res: Response) => {
  const brandId = req.body?.brand_id as string | undefined;
  if (!brandId) return res.status(400).json({ ok: false, error: 'brand_id required' });

  try {
    const orphanReport = detectOrphanPages(brandId);
    const brokenLinkReport = await runBrokenLinkCheck(brandId);
    const anchorReport = computeAnchorDiversity(brandId);

    const combined = {
      brand_id: brandId,
      analyzed_at: new Date().toISOString(),
      orphan_pages: orphanReport,
      broken_links: brokenLinkReport,
      anchor_diversity: anchorReport,
    };

    const evidence = recordEvidence({
      brand_id: brandId,
      category: 'update_internal_seo_database',
      summary: `Internal link analysis for ${brandId}: ${orphanReport.orphan_count} orphans, ` +
        `${brokenLinkReport.broken_count} broken links, ${anchorReport.flagged.length} anchor-diversity flags`,
      payload: combined,
    });

    res.json({ ok: true, ...combined, evidence_id: evidence.id });
  } catch (e: unknown) {
    const err = e as { message?: string };
    res.status(500).json({ ok: false, error: err?.message || 'analysis_failed' });
  }
});

// ── Backlinks ───────────────────────────────────────────────────────────────

// GET /api/seo/backlinks?brand_id=&status=
seoLinksRouter.get('/backlinks', (req: Request, res: Response) => {
  const brandId = req.query.brand_id as string | undefined;
  if (!brandId) return res.status(400).json({ ok: false, error: 'brand_id required' });
  const status = req.query.status as string | undefined;

  const backlinks = getBacklinksForBrand(brandId, status);
  res.json({ ok: true, brand_id: brandId, status_filter: status ?? null, total: backlinks.length, backlinks });
});

// POST /api/seo/backlinks/evaluate  body: SubmitBacklinkInput
seoLinksRouter.post('/backlinks/evaluate', (req: Request, res: Response) => {
  const body = (req.body || {}) as Partial<SubmitBacklinkInput>;
  const required: (keyof SubmitBacklinkInput)[] = ['brand_id', 'source_domain', 'source_url', 'destination_url'];
  const missing = required.filter(k => !body[k]);
  if (missing.length) {
    return res.status(400).json({ ok: false, error: `missing fields: ${missing.join(', ')}` });
  }

  try {
    const result = submitBacklinkForReview(body as SubmitBacklinkInput);
    res.json({ ok: true, ...result });
  } catch (e: unknown) {
    const err = e as { message?: string };
    res.status(500).json({ ok: false, error: err?.message || 'evaluation_failed' });
  }
});

// POST /api/seo/backlinks/:id/approve
// The HTTP call itself is treated as the human approval event (a CEO
// clicking "Approve" in the SEO Control Center) — it's recorded through
// submitSeoAction for the audit trail, then the backlink row is flipped to
// APPROVED. (backlink_approval stays REQUIRES_APPROVAL in seo-policy.yaml so
// programmatic/automated callers can never reach this without a human in the
// loop having triggered the request in the first place.)
seoLinksRouter.post('/backlinks/:id/approve', async (req: Request, res: Response) => {
  const existing = getBacklinkById(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'backlink_not_found' });
  if (!isSeoBacklinkWriteEnabled()) {
    return res.status(403).json({ ok: false, error: disabledReason('SEO_BACKLINK_WRITE_ENABLED') });
  }

  const actionOutcome = submitSeoAction({
    category: 'backlink_approval',
    brand_id: existing.brand_id,
    description: `Approval of backlink ${req.params.id}: ${existing.source_url} -> ${existing.destination_url}`,
    target: existing.source_url,
    idempotency_key: `backlink_approval:${req.params.id}:decision-approve`,
    before_state: JSON.stringify({ status: existing.status }),
    after_state: JSON.stringify({ status: 'APPROVED' }),
  });

  const executed = await executeWithSeoApproval(req, async () => ({ success: true, backlink: approveBacklink(req.params.id, req.body?.note) }));
  if (!executed.ok) return sendApprovedExecutionFailure(res, executed);
  const updated = (executed.result as { backlink: ReturnType<typeof approveBacklink> }).backlink;
  res.json({ ok: true, backlink: updated, action_outcome: actionOutcome.outcome });
});

// POST /api/seo/backlinks/:id/reject
seoLinksRouter.post('/backlinks/:id/reject', (req: Request, res: Response) => {
  const existing = getBacklinkById(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'backlink_not_found' });

  const updated = rejectBacklink(req.params.id, req.body?.reason);
  res.json({ ok: true, backlink: updated });
});
