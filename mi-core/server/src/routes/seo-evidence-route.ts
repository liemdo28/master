/**
 * SEO Control Center — small companion routes not covered elsewhere:
 *  - GET /api/seo/evidence?brand_id=&limit=  (backed by seo/seo-evidence.ts)
 *  - GET /api/seo/policy                     (read-only view of config/seo-policy.yaml)
 * Mounted separately from routes/seo.ts to avoid touching that file while it's
 * being worked on concurrently.
 */

import { Router, Request, Response } from 'express';
import { getEvidenceForBrand } from '../seo/seo-evidence';
import { getSeoDb } from '../seo/seo-db';
import { getRawPolicy } from '../seo/seo-policy-engine';

export const seoEvidenceRouteRouter = Router();

// GET /api/seo/evidence?brand_id=&limit=
// brand_id is optional here (unlike getEvidenceForBrand's required param) so the
// dashboard's Evidence tab can show recent evidence across all brands too.
seoEvidenceRouteRouter.get('/evidence', (req: Request, res: Response) => {
  const brandId = req.query.brand_id as string | undefined;
  const limit = Math.min(parseInt((req.query.limit as string) || '100', 10) || 100, 500);

  try {
    if (brandId) {
      const evidence = getEvidenceForBrand(brandId, limit);
      return res.json({ ok: true, brand_id: brandId, total: evidence.length, evidence });
    }
    const rows = getSeoDb().prepare('SELECT * FROM seo_evidence ORDER BY created_at DESC LIMIT ?').all(limit);
    res.json({ ok: true, brand_id: null, total: (rows as unknown[]).length, evidence: rows });
  } catch (e: unknown) {
    const err = e as { message?: string };
    res.status(500).json({ ok: false, error: err?.message || 'evidence_query_failed' });
  }
});

// GET /api/seo/policy — read-only rendering of config/seo-policy.yaml
seoEvidenceRouteRouter.get('/policy', (_req: Request, res: Response) => {
  try {
    const policy = getRawPolicy();
    res.json({ ok: true, policy });
  } catch (e: unknown) {
    const err = e as { message?: string };
    res.status(500).json({ ok: false, error: err?.message || 'policy_load_failed' });
  }
});
