/**
 * SEO Control Center — Keyword Research / Topic Cluster / Business Fact routes.
 * New router file (kept separate from routes/seo.ts to avoid merge conflicts
 * with concurrent work there). Mount as `seoResearchRouter` under `/api/seo`.
 */

import { Router, Request, Response } from 'express';
import { getActiveBrands, getBrandById } from '../seo/brand-config';
import { submitSeoAction } from '../seo/seo-approval-bridge';
import { recordEvidence } from '../seo/seo-evidence';
import { seoId } from '../seo/seo-db';

import { discoverKeywords } from '../seo/keywords/keyword-discovery';
import { clusterByTokenOverlap } from '../seo/keywords/keyword-cluster-engine';
import { detectCannibalization } from '../seo/keywords/cannibalization-detector';
import { classifySearchIntent, type SearchIntent } from '../seo/keywords/search-intent-classifier';
import {
  listKeywords, getKeywordById, setKeywordStatus,
} from '../seo/keywords/keyword-store';

import { buildClusterMap, getClusterMap } from '../seo/clusters/cluster-builder';

import {
  createFact, listFacts, getFactById, setFactStatus,
} from '../seo/facts/fact-registry';
import { checkClaims } from '../seo/facts/claim-guard';

export const seoResearchRouter = Router();

// ── Keywords ────────────────────────────────────────────────────────────────

// GET /api/seo/keywords?brand_id=&status=
seoResearchRouter.get('/keywords', (req: Request, res: Response) => {
  const brandId = (req.query.brand_id as string | undefined) || undefined;
  const status = req.query.status as string | undefined;
  if (brandId && !getBrandById(brandId)) return res.status(404).json({ ok: false, error: 'brand_not_found' });
  const brandIds = brandId ? [brandId] : getActiveBrands().map(b => b.brand_id);
  const keywords = brandIds.flatMap(id => listKeywords(id, { status }));
  keywords.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  res.json({ ok: true, brand_id: brandId || null, total: keywords.length, keywords });
});

// POST /api/seo/keywords/discover  { brand_id, seed_terms?: string[] }
seoResearchRouter.post('/keywords/discover', (req: Request, res: Response) => {
  const { brand_id, seed_terms } = req.body || {};
  if (!brand_id) return res.status(400).json({ ok: false, error: 'brand_id is required' });
  const brand = getBrandById(brand_id);
  if (!brand) return res.status(404).json({ ok: false, error: 'brand_not_found' });

  try {
    const result = discoverKeywords(brand_id, Array.isArray(seed_terms) ? seed_terms : []);

    const outcome = submitSeoAction({
      category: 'keyword_discovery',
      brand_id,
      description: `Keyword discovery for ${brand.name}: ${result.created.length} new candidates`,
      target: brand_id,
      idempotency_key: seoId('kwdisc'),
      payload: { seed_terms, candidates_generated: result.candidates_generated, created: result.created.length, skipped_existing: result.skipped_existing },
    });

    res.json({ ok: true, brand_id, result, action: outcome });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

// POST /api/seo/keywords/cluster  { brand_id }
// Runs the pure grouping algorithm over the brand's current keyword rows and
// returns clusters WITHOUT persisting them — use /clusters/generate to
// persist into seo_topic_clusters/seo_cluster_nodes.
seoResearchRouter.post('/keywords/cluster', (req: Request, res: Response) => {
  const { brand_id } = req.body || {};
  if (!brand_id) return res.status(400).json({ ok: false, error: 'brand_id is required' });
  const brand = getBrandById(brand_id);
  if (!brand) return res.status(404).json({ ok: false, error: 'brand_not_found' });

  const keywords = listKeywords(brand_id);
  const clusters = clusterByTokenOverlap(keywords.map(k => ({ id: k.id, keyword: k.keyword })));

  const outcome = submitSeoAction({
    category: 'keyword_clustering',
    brand_id,
    description: `Keyword clustering for ${brand.name}: ${clusters.length} clusters from ${keywords.length} keywords`,
    target: brand_id,
    idempotency_key: seoId('kwcluster'),
    payload: { cluster_count: clusters.length, keyword_count: keywords.length },
  });

  res.json({ ok: true, brand_id, clusters, action: outcome });
});

// POST /api/seo/keywords/:id/approve
seoResearchRouter.post('/keywords/:id/approve', (req: Request, res: Response) => {
  const existing = getKeywordById(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'keyword_not_found' });

  try {
    // DISCOVERED -> REVIEWED on first approve call, REVIEWED -> APPROVED on
    // the next. Callers that want a keyword fully APPROVED from DISCOVERED
    // call this endpoint twice (matches the review-then-approve workflow).
    const nextStatus = existing.status === 'REVIEWED' ? 'APPROVED' : 'REVIEWED';
    const updated = setKeywordStatus(existing.id, nextStatus, { markReviewed: true });
    recordEvidence({
      brand_id: existing.brand_id,
      category: 'keyword_approval',
      summary: `Keyword "${existing.keyword}" moved ${existing.status} -> ${updated.status}`,
      payload: { keyword_id: existing.id, from: existing.status, to: updated.status },
    });
    res.json({ ok: true, keyword: updated });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

// GET or POST /api/seo/cannibalization?brand_id=&keyword=
function runCannibalizationCheck(req: Request, res: Response) {
  const brandId = (req.query.brand_id as string) || req.body?.brand_id;
  const keyword = (req.query.keyword as string) || req.body?.keyword;
  const locationId = (req.query.location_id as string) || req.body?.location_id || null;
  const intent = (req.query.intent as SearchIntent) || req.body?.intent;

  if (!brandId || !keyword) {
    return res.status(400).json({ ok: false, error: 'brand_id and keyword are required' });
  }

  const result = detectCannibalization({
    brand_id: brandId,
    keyword,
    intent: intent || undefined,
    location_id: locationId,
  });

  res.json({ ok: true, brand_id: brandId, keyword, ...result });
}
seoResearchRouter.get('/cannibalization', runCannibalizationCheck);
seoResearchRouter.post('/cannibalization', runCannibalizationCheck);

// ── Topic clusters ─────────────────────────────────────────────────────────

// GET /api/seo/clusters?brand_id=
seoResearchRouter.get('/clusters', (req: Request, res: Response) => {
  const brandId = req.query.brand_id as string | undefined;
  if (!brandId) return res.status(400).json({ ok: false, error: 'brand_id is required' });
  const brand = getBrandById(brandId);
  if (!brand) return res.status(404).json({ ok: false, error: 'brand_not_found' });
  res.json({ ok: true, ...getClusterMap(brandId) });
});

// POST /api/seo/clusters/generate  { brand_id }
seoResearchRouter.post('/clusters/generate', (req: Request, res: Response) => {
  const { brand_id } = req.body || {};
  if (!brand_id) return res.status(400).json({ ok: false, error: 'brand_id is required' });
  const brand = getBrandById(brand_id);
  if (!brand) return res.status(404).json({ ok: false, error: 'brand_not_found' });

  try {
    const map = buildClusterMap(brand_id);
    const outcome = submitSeoAction({
      category: 'update_internal_seo_database',
      brand_id,
      description: `Topic cluster map regenerated for ${brand.name}: ${map.clusters.length} clusters`,
      target: brand_id,
      idempotency_key: seoId('clustergen'),
      payload: { cluster_count: map.clusters.length },
    });
    res.json({ ok: true, ...map, action: outcome });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

// ── Business facts ─────────────────────────────────────────────────────────

// GET /api/seo/facts?brand_id=&status=
seoResearchRouter.get('/facts', (req: Request, res: Response) => {
  const brandId = req.query.brand_id as string | undefined;
  if (!brandId) return res.status(400).json({ ok: false, error: 'brand_id is required' });
  const status = req.query.status as string | undefined;
  const facts = listFacts(brandId, { status });
  res.json({ ok: true, brand_id: brandId, total: facts.length, facts });
});

// POST /api/seo/facts  — status is always forced to UNVERIFIED regardless of input
seoResearchRouter.post('/facts', (req: Request, res: Response) => {
  const { brand_id, location_id, category, field_name, value, source, source_ref, expiration_date, confidence, usage_restrictions } = req.body || {};
  if (!brand_id || !category || !field_name || !value || !source) {
    return res.status(400).json({ ok: false, error: 'brand_id, category, field_name, value, source are required' });
  }
  const brand = getBrandById(brand_id);
  if (!brand) return res.status(404).json({ ok: false, error: 'brand_not_found' });

  const fact = createFact({ brand_id, location_id, category, field_name, value, source, source_ref, expiration_date, confidence, usage_restrictions });
  recordEvidence({ brand_id, category: 'create_business_fact', summary: `Fact created: ${field_name} = ${value}`, payload: { fact_id: fact.id } });
  res.json({ ok: true, fact });
});

// POST /api/seo/facts/:id/verify  { verified_by }
seoResearchRouter.post('/facts/:id/verify', (req: Request, res: Response) => {
  const fact = getFactById(req.params.id);
  if (!fact) return res.status(404).json({ ok: false, error: 'fact_not_found' });
  const verifiedBy = req.body?.verified_by;
  if (!verifiedBy) return res.status(400).json({ ok: false, error: 'verified_by is required' });
  if (fact.status !== 'UNVERIFIED') {
    return res.status(409).json({ ok: false, error: `fact is not UNVERIFIED (current status: ${fact.status})` });
  }

  const outcome = submitSeoAction({
    category: 'verify_business_fact',
    brand_id: fact.brand_id,
    description: `Verify business fact "${fact.field_name} = ${fact.value}" (brand ${fact.brand_id})`,
    target: fact.id,
    idempotency_key: seoId('factverify'),
    payload: { fact_id: fact.id, verified_by: verifiedBy },
  });

  // Only flip UNVERIFIED -> VERIFIED here if policy actually cleared this
  // action for immediate execution. verify_business_fact is REQUIRES_APPROVAL
  // by default, so in practice this queues into the approval gate and the
  // fact stays UNVERIFIED until a human approves it elsewhere.
  if (outcome.outcome === 'auto_executed' || outcome.outcome === 'auto_executed_with_notification') {
    const updated = setFactStatus(fact.id, 'VERIFIED', { verifiedBy });
    return res.json({ ok: true, fact: updated, action: outcome });
  }

  res.json({ ok: true, fact, action: outcome, note: 'verification is policy-gated — fact remains UNVERIFIED until approved' });
});

// ── Claim guard (used by the content-QA pipeline; also exposed for manual checks) ──

// POST /api/seo/facts/check-claims  { brand_id, text, location_id? }
seoResearchRouter.post('/facts/check-claims', (req: Request, res: Response) => {
  const { brand_id, text, location_id } = req.body || {};
  if (!brand_id || !text) return res.status(400).json({ ok: false, error: 'brand_id and text are required' });
  const results = checkClaims(brand_id, text, location_id);
  res.json({
    ok: true,
    brand_id,
    total_claims_found: results.length,
    blocked: results.filter(r => r.status === 'BLOCKED_UNVERIFIED').length,
    results,
  });
});

// Utility used by other engineers wiring content QA — not part of the spec's
// route list but a natural companion to keyword discovery.
seoResearchRouter.get('/keywords/classify-intent', (req: Request, res: Response) => {
  const keyword = req.query.keyword as string | undefined;
  if (!keyword) return res.status(400).json({ ok: false, error: 'keyword is required' });
  res.json({ ok: true, keyword, ...classifySearchIntent(keyword) });
});
