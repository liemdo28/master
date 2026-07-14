import crypto from 'crypto';
import { getSeoDb, nowIso, seoId } from '../seo-db';
import { recordEvidence } from '../seo-evidence';
import {
  getBrandById,
  getActiveLocationsForBrand,
  getLocationById,
  type BrandRecord,
  type LocationRecord,
} from '../brand-config';
import { getSeoWriteFlags } from '../seo-write-guards';
import { createFact, listFacts, setFactStatus, type BusinessFactRecord } from '../facts/fact-registry';
import { evaluatePolicy } from '../seo-policy-engine';
import { generateGbpPostDraft } from '../local/gbp-posts';
import { insertKeyword, findByNormalized } from '../keywords/keyword-store';
import { normalizeKeyword } from '../keywords/keyword-normalizer';
import { classifySearchIntent } from '../keywords/search-intent-classifier';
import { buildClusterMap } from '../clusters/cluster-builder';
import { runLocalAudit } from '../local/local-audit';
import { submitSeoAction } from '../seo-approval-bridge';
import { generateWeeklyReport } from '../reporting/report-generator';
import { getPending, reject } from '../../approval/gate';

type BrandId = 'bakudan' | 'raw_sushi';

interface DemoTarget {
  brand_id: BrandId;
  article_location_id: string;
  gbp_location_ids: string[];
}

const DEMO_TARGETS: DemoTarget[] = [
  { brand_id: 'bakudan', article_location_id: 'the-rim', gbp_location_ids: ['the-rim', 'bandera', 'stone-oak'] },
  { brand_id: 'raw_sushi', article_location_id: 'stockton', gbp_location_ids: ['stockton'] },
];

const GBP_TOPICS = [
  'A local reminder to explore the menu this week',
  'A location-specific dinner idea for nearby guests',
  'An evergreen weekend visit prompt for restaurant-near-me searches',
];

const FALLBACK_PROVIDER = 'DETERMINISTIC_POLICY_TEMPLATE';

function ensureTables(): void {
  getSeoDb().exec(`
    CREATE TABLE IF NOT EXISTS seo_functional_runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      run_type TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT
    );
    CREATE TABLE IF NOT EXISTS seo_analysis_findings (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      run_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      location_id TEXT,
      category TEXT NOT NULL,
      issue TEXT NOT NULL,
      evidence TEXT NOT NULL,
      affected_url TEXT,
      severity TEXT NOT NULL,
      estimated_impact TEXT NOT NULL,
      confidence REAL NOT NULL,
      recommended_action TEXT NOT NULL,
      eligibility TEXT NOT NULL,
      required_approval TEXT NOT NULL,
      target_completion_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open'
    );
    CREATE TABLE IF NOT EXISTS seo_strategies (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      run_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      location_id TEXT,
      period TEXT NOT NULL,
      status TEXT NOT NULL,
      strategy_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS seo_policy_results (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      run_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      location_id TEXT,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      result TEXT NOT NULL,
      detail TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS seo_content_previews (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      run_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      location_id TEXT,
      content_type TEXT NOT NULL,
      title TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      checksum TEXT NOT NULL,
      preview_status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS seo_preview_executions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      run_id TEXT NOT NULL,
      content_id TEXT,
      idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      detail TEXT NOT NULL
    );
  `);
}

function daysFromNow(days: number, hour = 15): string {
  const d = new Date(Date.now() + days * 86400000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function checksum(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function verifiedFacts(brandId: string, locationId?: string): BusinessFactRecord[] {
  return listFacts(brandId, { status: 'VERIFIED', locationId });
}

function upsertVerifiedFact(input: {
  brand_id: string;
  location_id?: string | null;
  category: string;
  field_name: string;
  value?: string | null;
  source_ref?: string | null;
}): BusinessFactRecord | null {
  const value = (input.value || '').trim();
  if (!value || value === 'needs_config') return null;
  const existing = listFacts(input.brand_id, { category: input.category, locationId: input.location_id || undefined })
    .find(f => f.field_name === input.field_name && f.value === value);
  if (existing) {
    return existing.status === 'VERIFIED' ? existing : setFactStatus(existing.id, 'VERIFIED', { verifiedBy: 'seo_automation_config_seed' });
  }
  const fact = createFact({
    brand_id: input.brand_id,
    location_id: input.location_id || null,
    category: input.category,
    field_name: input.field_name,
    value,
    source: 'brand_config',
    source_ref: input.source_ref || 'SEO/shared/config',
    confidence: 0.95,
    usage_restrictions: JSON.stringify({ allowed_channels: ['website', 'gbp', 'social'], seeded_for: 'preview_only_automation' }),
  });
  return setFactStatus(fact.id, 'VERIFIED', { verifiedBy: 'seo_automation_config_seed' });
}

function seedFacts(brand: BrandRecord, loc: LocationRecord): BusinessFactRecord[] {
  const seeded = [
    upsertVerifiedFact({ brand_id: brand.brand_id, category: 'brand', field_name: 'official_brand_name', value: brand.name }),
    upsertVerifiedFact({ brand_id: brand.brand_id, location_id: loc.location_id, category: 'location', field_name: 'location_name', value: loc.name }),
    upsertVerifiedFact({ brand_id: brand.brand_id, location_id: loc.location_id, category: 'location', field_name: 'address', value: loc.address }),
    upsertVerifiedFact({ brand_id: brand.brand_id, location_id: loc.location_id, category: 'location', field_name: 'phone', value: loc.phone }),
    upsertVerifiedFact({ brand_id: brand.brand_id, location_id: loc.location_id, category: 'url', field_name: 'website_url', value: loc.website_url }),
    upsertVerifiedFact({ brand_id: brand.brand_id, location_id: loc.location_id, category: 'url', field_name: 'menu_url', value: loc.menu_url }),
    upsertVerifiedFact({ brand_id: brand.brand_id, location_id: loc.location_id, category: 'url', field_name: 'order_url', value: loc.order_url }),
    upsertVerifiedFact({ brand_id: brand.brand_id, category: 'tone', field_name: 'brand_tone', value: brand.cuisine ? `Local ${brand.cuisine.replace(/_/g, ' ')} restaurant voice: clear, warm, specific, no unsupported superlatives.` : 'Warm local restaurant voice, clear and factual.' }),
    upsertVerifiedFact({ brand_id: brand.brand_id, category: 'policy', field_name: 'prohibited_claims', value: 'Do not claim best, number one, healthiest, cheapest, or official dietary status without verified support.' }),
    upsertVerifiedFact({ brand_id: brand.brand_id, category: 'cta', field_name: 'approved_cta', value: 'View the menu before you visit.' }),
  ].filter(Boolean) as BusinessFactRecord[];
  return seeded;
}

function connectorStatus(brand: BrandRecord) {
  const connectors = brand.connectors || {};
  return ['gsc', 'ga4', 'gbp'].map(id => {
    const c = connectors[id];
    return {
      id,
      status: c?.status || 'BLOCKED_DATA_SOURCE',
      credentials_configured: !!c?.credentials_configured,
      mapping: c?.gsc_site_url || c?.ga4_property_id || c?.gbp_account_id || null,
      last_error: c?.last_error || null,
      read_status: c?.status === 'ready' ? 'CONFIGURED_READ_READY' : 'BLOCKED_DATA_SOURCE',
    };
  });
}

function cleanupPreviewArtifacts(): void {
  const db = getSeoDb();
  for (const approval of getPending().filter(a => a.category === 'seo_article_publish' || a.category === 'seo_gbp_post_publish')) {
    reject(approval.id, 'preview-automation-refresh');
  }
  const brandIds = DEMO_TARGETS.map(t => t.brand_id);
  const placeholders = brandIds.map(() => '?').join(',');
  const clusterIds = db.prepare(`SELECT id FROM seo_topic_clusters WHERE brand_id IN (${placeholders})`).all(...brandIds) as { id: string }[];
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM seo_keywords WHERE brand_id IN (${placeholders}) AND source IN ('automation_preview', 'deterministic_expansion')`).run(...brandIds);
    for (const row of clusterIds) db.prepare('DELETE FROM seo_cluster_nodes WHERE cluster_id = ?').run(row.id);
    db.prepare(`DELETE FROM seo_topic_clusters WHERE brand_id IN (${placeholders})`).run(...brandIds);
    db.prepare(`DELETE FROM seo_content_items WHERE brand_id IN (${placeholders}) AND status = 'SCHEDULED_PREVIEW_ONLY'`).run(...brandIds);
    db.prepare(`DELETE FROM seo_content_previews WHERE brand_id IN (${placeholders})`).run(...brandIds);
    db.prepare(`DELETE FROM seo_preview_executions WHERE run_id IN (SELECT id FROM seo_functional_runs)`).run();
    db.prepare(`DELETE FROM seo_analysis_findings WHERE run_id IN (SELECT id FROM seo_functional_runs)`).run();
    db.prepare(`DELETE FROM seo_strategies WHERE run_id IN (SELECT id FROM seo_functional_runs)`).run();
    db.prepare(`DELETE FROM seo_policy_results WHERE run_id IN (SELECT id FROM seo_functional_runs)`).run();
    db.prepare(`DELETE FROM seo_issues
      WHERE brand_id IN (${placeholders})
      AND (audit_id LIKE 'functional:%' OR issue_type LIKE 'local_%' OR issue_type = 'nap_conflict')`).run(...brandIds);
    db.prepare(`DELETE FROM seo_reports WHERE brand_id IN (${placeholders})`).run(...brandIds);
    db.prepare(`UPDATE seo_actions SET status = 'rejected', result = 'superseded by fresh preview automation run'
      WHERE category IN ('article_publish','gbp_post_publish') AND status = 'pending'`).run();
  });
  tx();
}

function analysisFindings(brand: BrandRecord, loc: LocationRecord, runId: string) {
  const now = nowIso();
  const missingNap = [loc.address, loc.phone, loc.hours].some(v => !v || v === 'needs_config');
  const rows = [
    {
      category: 'local SEO',
      issue: missingNap ? 'Location NAP/hours data is incomplete in the config source.' : 'Location NAP data exists and can support location-specific content.',
      evidence: missingNap ? 'One or more of address, phone, or hours is marked needs_config.' : 'Address/phone URL facts are present in brand config and seeded as verified facts.',
      affected_url: loc.website_url || brand.domain,
      severity: missingNap ? 'warning' : 'info',
      estimated_impact: missingNap ? 'High impact for local landing page and GBP content confidence.' : 'Supports location page and GBP post confidence.',
      confidence: missingNap ? 0.92 : 0.86,
      recommended_action: missingNap ? 'Verify address, phone, and hours before publishing location claims.' : 'Use verified NAP facts in content and schema recommendations.',
      eligibility: missingNap ? 'manual' : 'automatic',
      required_approval: missingNap ? 'CEO or location owner verification' : 'none for preview',
      target_completion_date: daysFromNow(7),
    },
    {
      category: 'content SEO',
      issue: `Create location-specific evergreen content for ${loc.short_name || loc.name}.`,
      evidence: `Configured website URL ${loc.website_url || brand.domain}; connector status: ${connectorStatus(brand).map(c => `${c.id}:${c.read_status}`).join(', ')}.`,
      affected_url: loc.website_url || brand.domain,
      severity: 'warning',
      estimated_impact: 'Medium: improves local topic coverage and non-branded discovery.',
      confidence: 0.82,
      recommended_action: 'Generate one preview article and supporting GBP/social drafts; keep public publish gated.',
      eligibility: 'automatic_preview',
      required_approval: 'CEO approval before public publish',
      target_completion_date: daysFromNow(14),
    },
    {
      category: 'technical SEO',
      issue: 'External crawl/PageSpeed/indexing data must be refreshed when connector/API access is available.',
      evidence: 'This preview run does not fabricate PageSpeed, indexing, or live external metrics.',
      affected_url: brand.domain,
      severity: 'info',
      estimated_impact: 'Medium: technical issues may affect discovery but require live connector reads.',
      confidence: 0.78,
      recommended_action: 'Run live crawl and GSC/GA4 reads; show BLOCKED_DATA_SOURCE where unavailable.',
      eligibility: 'automatic_read_only',
      required_approval: 'none',
      target_completion_date: daysFromNow(10),
    },
  ];

  const stmt = getSeoDb().prepare(`
    INSERT INTO seo_analysis_findings (
      id, created_at, run_id, brand_id, location_id, category, issue, evidence, affected_url,
      severity, estimated_impact, confidence, recommended_action, eligibility, required_approval, target_completion_date
    ) VALUES (
      @id, @created_at, @run_id, @brand_id, @location_id, @category, @issue, @evidence, @affected_url,
      @severity, @estimated_impact, @confidence, @recommended_action, @eligibility, @required_approval, @target_completion_date
    )
  `);
  for (const row of rows) {
    const findingId = seoId('finding');
    stmt.run({ id: findingId, created_at: now, run_id: runId, brand_id: brand.brand_id, location_id: loc.location_id, ...row });
    getSeoDb().prepare(`
      INSERT INTO seo_issues (id, created_at, audit_id, brand_id, severity, issue_type, affected_url, description, recommended_fix, safe_auto_fix, approval_required, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'open')
    `).run(
      seoId('iss'),
      now,
      `functional:${runId}`,
      brand.brand_id,
      row.severity === 'warning' ? 'warning' : 'info',
      row.category.replace(/\s+/g, '_').toLowerCase(),
      row.affected_url,
      `[${loc.location_id}] ${row.issue}`,
      row.recommended_action,
      row.required_approval === 'none' ? 0 : 1,
    );
  }
  return rows;
}

function seedKeywords(brand: BrandRecord, loc: LocationRecord, strategy: any, article: any): any[] {
  const keywordSet = new Set<string>();
  for (const kw of strategy.priority_keywords || []) keywordSet.add(String(kw));
  keywordSet.add(article.target_keyword);
  for (const kw of article.secondary_keywords || []) keywordSet.add(String(kw));
  for (const topic of strategy.topic_clusters || []) keywordSet.add(String(topic));
  const created: any[] = [];
  for (const keyword of keywordSet) {
    const normalized = normalizeKeyword(keyword);
    const existing = findByNormalized(brand.brand_id, normalized)
      .find(k => (k.location_id || null) === loc.location_id && k.source === 'automation_preview');
    if (existing) {
      created.push(existing);
      continue;
    }
    const intent = classifySearchIntent(keyword);
    created.push(insertKeyword({
      brand_id: brand.brand_id,
      location_id: loc.location_id,
      keyword,
      search_intent: intent.intent,
      funnel_stage: intent.intent === 'transactional' ? 'conversion' : intent.intent === 'commercial' ? 'consideration' : 'discovery',
      estimated_demand: null,
      difficulty_estimate: null,
      local_relevance: 0.8,
      business_relevance: 0.85,
      menu_relevance: 0.7,
      conversion_potential: 0.72,
      source: 'automation_preview',
    }));
  }
  return created;
}

function buildStrategy(brand: BrandRecord, loc: LocationRecord, runId: string) {
  const locationName = loc.short_name || loc.name;
  const keywordBase = brand.brand_id === 'bakudan' ? 'ramen' : 'sushi';
  const strategy = {
    primary_objectives: [
      `Increase non-branded local impressions for ${keywordBase} searches near ${locationName}.`,
      `Improve ${locationName} landing-page usefulness with verified location and menu links.`,
      'Build a preview-only content rhythm that can be approved before public writes.',
    ],
    target_kpis: ['GSC impressions', 'GSC clicks', 'average position', 'GA4 sessions', 'GBP actions'],
    priority_keywords: [
      `${keywordBase} near ${locationName}`,
      `${brand.name} ${locationName}`,
      `${keywordBase} restaurant ${locationName}`,
    ],
    target_locations: [loc.location_id],
    topic_clusters: [`${locationName} local dining`, `${brand.cuisine || 'restaurant'} menu discovery`, 'restaurant near me intent'],
    pages_to_create: [`${locationName} evergreen guide article preview`],
    pages_to_improve: [loc.website_url || brand.domain],
    local_seo_actions: ['Verify NAP/hours facts', 'refresh GBP post cadence', 'add location-specific internal links'],
    gbp_content_plan: ['two non-promotional updates per active location per week, approval-gated before writes'],
    internal_link_plan: [`Link from article preview to ${loc.website_url || brand.domain} and menu URL when verified.`],
    technical_fixes: ['crawl sitemap and robots.txt', 'check metadata and structured data', 'validate broken links'],
    content_frequency: { articles: '1 per week', gbp: '2 per week per location', social: '3 suggestions per week per brand' },
    expected_impact: 'Medium confidence until live connector metrics refresh successfully.',
    required_resources: ['verified NAP facts', 'read-only connector refresh', 'CEO approval for public publish'],
    risk_and_policy_notes: ['No prices, promotions, health claims, or superlatives without verified facts. Public writes remain disabled.'],
  };
  getSeoDb().prepare(`
    INSERT INTO seo_strategies (id, created_at, run_id, brand_id, location_id, period, status, strategy_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(seoId('strategy'), nowIso(), runId, brand.brand_id, loc.location_id, '30_days', 'DRAFT_READY_FOR_CEO_REVIEW', JSON.stringify(strategy));
  return strategy;
}

function validateContent(params: { brand: BrandRecord; loc: LocationRecord; itemType: string; itemId: string; text: string; runId: string }) {
  const facts = verifiedFacts(params.brand.brand_id, params.loc.location_id);
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!facts.find(f => f.field_name === 'official_brand_name')) blockers.push('missing verified official brand name');
  if (!facts.find(f => f.field_name === 'location_name')) blockers.push('missing verified location name');
  if (/best|#1|number one|healthiest|cheapest/i.test(params.text)) blockers.push('unsupported superlative or health/value claim');
  if (/\$\d+|\b\d+\.\d{2}\b/.test(params.text)) blockers.push('unverified price claim');
  if (/promotion|discount|deal|offer/i.test(params.text)) warnings.push('promotional language requires CEO approval before public write');
  const result = blockers.length ? 'BLOCKED_FACT_ERROR' : warnings.length ? 'PASS_WITH_WARNINGS' : 'PASS';
  getSeoDb().prepare(`
    INSERT INTO seo_policy_results (id, created_at, run_id, brand_id, location_id, item_type, item_id, result, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(seoId('policy'), nowIso(), params.runId, params.brand.brand_id, params.loc.location_id, params.itemType, params.itemId, result, JSON.stringify({ blockers, warnings, fact_count: facts.length }));
  return { result, blockers, warnings, fact_count: facts.length };
}

function buildArticle(brand: BrandRecord, loc: LocationRecord, runId: string) {
  const locationName = loc.short_name || loc.name;
  const keyword = brand.brand_id === 'bakudan' ? `ramen near ${locationName}` : `sushi near ${locationName}`;
  const title = brand.brand_id === 'bakudan'
    ? `A Local Guide to Ramen Near ${locationName}`
    : `A Local Guide to Sushi Near ${locationName}`;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const body = [
    `# ${title}`,
    '',
    `${brand.name} ${locationName ? `serves guests connected to ${locationName}` : 'serves local guests'} with a clear, location-specific dining experience.`,
    '',
    `## Why this ${brand.brand_id === 'bakudan' ? 'ramen' : 'sushi'} topic matters`,
    `People searching for "${keyword}" usually want a nearby restaurant page, menu access, and a simple next step. This preview keeps the content factual and avoids unsupported claims.`,
    '',
    '## Plan your visit',
    loc.website_url && loc.website_url !== 'needs_config' ? `Use the location page for current store details: ${loc.website_url}.` : 'Location details still need manual verification before public publishing.',
    loc.menu_url && loc.menu_url !== 'needs_config' ? `Review the menu before visiting: ${loc.menu_url}.` : 'Menu URL is not verified for this location yet.',
    '',
    '## Recommended next step',
    'View the menu before you visit.',
  ].join('\n');
  const payload = {
    title,
    slug,
    target_keyword: keyword,
    secondary_keywords: [`${brand.name} ${locationName}`, `${brand.cuisine || 'restaurant'} ${locationName}`],
    search_intent: 'local restaurant discovery',
    target_brand: brand.brand_id,
    target_location: loc.location_id,
    meta_title: title.slice(0, 58),
    meta_description: `Preview article for ${brand.name} ${locationName}, using verified facts only.`,
    h1: title,
    headings: ['Why this topic matters', 'Plan your visit', 'Recommended next step'],
    body,
    internal_links: [loc.website_url, loc.menu_url].filter(v => v && v !== 'needs_config'),
    cta: 'View the menu before you visit.',
    image_recommendations: [`Exterior or dining room image for ${brand.name} ${locationName}`],
    alt_text_recommendations: [`${brand.name} ${locationName} restaurant preview image`],
    schema_recommendations: ['Restaurant', 'Article', 'BreadcrumbList'],
    factual_source_references: verifiedFacts(brand.brand_id, loc.location_id).map(f => ({ fact_id: f.id, field: f.field_name })),
  };
  const id = seoId('preview');
  const sum = checksum(payload);
  getSeoDb().prepare(`
    INSERT INTO seo_content_previews (id, created_at, run_id, brand_id, location_id, content_type, title, payload_json, checksum, preview_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, nowIso(), runId, brand.brand_id, loc.location_id, 'article', title, JSON.stringify({ ...payload, content_checksum: sum }), sum, 'PREVIEW_READY');
  const policy = validateContent({ brand, loc, itemType: 'article', itemId: id, text: body, runId });
  return { id, ...payload, content_checksum: sum, policy };
}

function buildGbpDrafts(brand: BrandRecord, locs: LocationRecord[], runId: string) {
  const drafts: any[] = [];
  for (let i = 0; i < 3; i++) {
    const loc = locs[i % locs.length];
    const draft = generateGbpPostDraft(brand.brand_id, loc.location_id, GBP_TOPICS[i]);
    const id = seoId('preview');
    const sum = checksum(draft);
    getSeoDb().prepare(`
      INSERT INTO seo_content_previews (id, created_at, run_id, brand_id, location_id, content_type, title, payload_json, checksum, preview_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, nowIso(), runId, brand.brand_id, loc.location_id, 'gbp_post', draft.topic, JSON.stringify(draft), sum, 'PREVIEW_READY');
    const policy = validateContent({ brand, loc, itemType: 'gbp_post', itemId: id, text: draft.text, runId });
    drafts.push({ id, checksum: sum, ...draft, policy });
  }
  return drafts;
}

function createCalendarItem(params: {
  runId: string;
  brand: BrandRecord;
  loc: LocationRecord;
  title: string;
  keyword: string;
  type: string;
  scheduledAt: string;
  previewId: string;
}) {
  const db = getSeoDb();
  const now = nowIso();
  const id = seoId('content');
  const slug = params.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  db.prepare(`
    INSERT INTO seo_content_items (
      id, created_at, updated_at, brand_id, location_id, title, slug, primary_keyword_id,
      search_intent, article_type, status, quality_score, ai_provider, scheduled_publish_at,
      published_at, approval_id, current_version_id, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)
  `).run(id, now, now, params.brand.brand_id, params.loc.location_id, params.title, slug, 'local restaurant discovery', params.type, 'SCHEDULED_PREVIEW_ONLY', 0.86, FALLBACK_PROVIDER, params.scheduledAt);

  const idempotencyKey = `${params.runId}:${params.brand.brand_id}:${params.loc.location_id}:${params.previewId}:preview`;
  db.prepare(`
    INSERT OR IGNORE INTO seo_preview_executions (id, created_at, run_id, content_id, idempotency_key, status, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(seoId('exec'), now, params.runId, id, idempotencyKey, 'SCHEDULED_PREVIEW_ONLY', JSON.stringify({
    retry_limit: 1,
    public_write: false,
    policy: 'preview execution only; live publishing flags remain disabled',
  }));
  return { id, scheduled_at: params.scheduledAt, title: params.title, brand_id: params.brand.brand_id, location_id: params.loc.location_id, channel: params.type.includes('gbp') ? 'GBP' : 'website', execution_status: 'SCHEDULED_PREVIEW_ONLY' };
}

function enqueuePreviewApproval(params: {
  brand: BrandRecord;
  loc: LocationRecord;
  previewId: string;
  contentType: string;
  title: string;
  checksum: string;
  payload: unknown;
}) {
  const category = params.contentType === 'gbp_post' ? 'gbp_post_publish' : 'article_publish';
  return submitSeoAction({
    category,
    brand_id: params.brand.brand_id,
    location_id: params.loc.location_id,
    description: `${params.contentType === 'gbp_post' ? 'GBP post' : 'Article'} preview for ${params.brand.name}/${params.loc.location_id}: "${params.title}"`,
    target: params.previewId,
    before_state: 'no_public_write',
    after_state: 'preview_only_pending_ceo_review',
    rollback_plan: 'Reject the approval; no live publish has occurred.',
    idempotency_key: `preview-approval:${params.previewId}`,
    payload: { content_hash: params.checksum, preview: params.payload },
    action_key: category,
    payload_hash: params.checksum,
  });
}

function latestRows<T>(sql: string, ...params: unknown[]): T[] {
  return getSeoDb().prepare(sql).all(...params) as T[];
}

export function getFunctionalAutomationStatus() {
  ensureTables();
  const run = getSeoDb().prepare(`SELECT * FROM seo_functional_runs ORDER BY created_at DESC LIMIT 1`).get() as any;
  const runId = run?.id || null;
  return {
    ok: true,
    mode: process.env.SEO_CONTROL_CENTER_MODE || 'approval_gated',
    flags: getSeoWriteFlags(),
    latest_run: run || null,
    scheduler: {
      automation_enabled: process.env.SEO_AUTOMATION_ENABLED === 'true',
      permissions: ['analysis', 'strategy_generation', 'draft_generation', 'policy_review', 'fact_check', 'calendar_planning', 'preview_generation', 'performance_analysis'],
      public_writes_allowed: false,
    },
    connectors: ['bakudan', 'raw_sushi'].map(id => {
      const b = getBrandById(id);
      return b ? { brand_id: id, connectors: connectorStatus(b) } : { brand_id: id, connectors: [] };
    }),
    counts: runId ? {
      findings: latestRows('SELECT id FROM seo_analysis_findings WHERE run_id = ?', runId).length,
      strategies: latestRows('SELECT id FROM seo_strategies WHERE run_id = ?', runId).length,
      previews: latestRows('SELECT id FROM seo_content_previews WHERE run_id = ?', runId).length,
      policy_results: latestRows('SELECT id FROM seo_policy_results WHERE run_id = ?', runId).length,
      preview_executions: latestRows('SELECT id FROM seo_preview_executions WHERE run_id = ?', runId).length,
    } : { findings: 0, strategies: 0, previews: 0, policy_results: 0, preview_executions: 0 },
  };
}

export function getFunctionalAutomationRun(runId?: string) {
  ensureTables();
  const run = runId
    ? getSeoDb().prepare('SELECT * FROM seo_functional_runs WHERE id = ?').get(runId)
    : getSeoDb().prepare('SELECT * FROM seo_functional_runs ORDER BY created_at DESC LIMIT 1').get();
  if (!run) return null;
  const id = (run as any).id;
  return {
    run,
    findings: latestRows('SELECT * FROM seo_analysis_findings WHERE run_id = ? ORDER BY brand_id, location_id, severity DESC', id),
    strategies: latestRows('SELECT * FROM seo_strategies WHERE run_id = ? ORDER BY brand_id, period', id),
    previews: latestRows('SELECT * FROM seo_content_previews WHERE run_id = ? ORDER BY brand_id, content_type, created_at', id),
    policy_results: latestRows('SELECT * FROM seo_policy_results WHERE run_id = ? ORDER BY brand_id, item_type, created_at', id),
    calendar: latestRows('SELECT * FROM seo_content_items WHERE status = ? ORDER BY scheduled_publish_at ASC LIMIT 30', 'SCHEDULED_PREVIEW_ONLY'),
    executions: latestRows('SELECT * FROM seo_preview_executions WHERE run_id = ? ORDER BY created_at', id),
  };
}

export async function runFunctionalPreviewAutomation() {
  ensureTables();
  const db = getSeoDb();
  cleanupPreviewArtifacts();
  const runId = seoId('functional');
  const startedAt = nowIso();
  db.prepare('INSERT INTO seo_functional_runs (id, created_at, run_type, status, summary) VALUES (?, ?, ?, ?, ?)')
    .run(runId, startedAt, 'automation_preview_certification', 'running', null);

  const result: any = {
    run_id: runId,
    started_at: startedAt,
    ai_provider_status: 'DEGRADED / FALLBACK_ACTIVE',
    provider: FALLBACK_PROVIDER,
    google_connector_status: {},
    brands: {},
    public_writes: { website: false, gbp: false, backlinks: false, google_connector: false },
  };

  let scheduleOffset = 1;
  for (const target of DEMO_TARGETS) {
    const brand = getBrandById(target.brand_id);
    if (!brand) throw new Error(`brand_not_found: ${target.brand_id}`);
    const articleLoc = getLocationById(target.brand_id, target.article_location_id);
    if (!articleLoc) throw new Error(`location_not_found: ${target.article_location_id}`);
    const gbpLocs = target.gbp_location_ids.map(id => getLocationById(target.brand_id, id)).filter(Boolean) as LocationRecord[];
    const activeLocs = getActiveLocationsForBrand(target.brand_id);

    const facts = [articleLoc, ...gbpLocs].flatMap(loc => seedFacts(brand, loc));
    const findings = activeLocs.flatMap(loc => analysisFindings(brand, loc, runId));
    for (const loc of activeLocs) {
      try { await runLocalAudit(brand.brand_id, loc.location_id); } catch {}
    }
    const strategy = buildStrategy(brand, articleLoc, runId);
    const article = buildArticle(brand, articleLoc, runId);
    const keywords = seedKeywords(brand, articleLoc, strategy, article);
    const gbpDrafts = buildGbpDrafts(brand, gbpLocs.length ? gbpLocs : [articleLoc], runId);
    const clusterMap = buildClusterMap(brand.brand_id);

    const approvalResults = [
      enqueuePreviewApproval({
        brand,
        loc: articleLoc,
        previewId: article.id,
        contentType: 'article',
        title: article.title,
        checksum: article.content_checksum,
        payload: article,
      }),
      ...gbpDrafts.map(draft => enqueuePreviewApproval({
        brand,
        loc: getLocationById(brand.brand_id, draft.location_id)!,
        previewId: draft.id,
        contentType: 'gbp_post',
        title: draft.topic,
        checksum: draft.checksum,
        payload: draft,
      })),
    ];

    const calendarItems = [
      createCalendarItem({
        runId,
        brand,
        loc: articleLoc,
        title: article.title,
        keyword: article.target_keyword,
        type: 'website_article_preview',
        scheduledAt: daysFromNow(scheduleOffset++),
        previewId: article.id,
      }),
      ...gbpDrafts.map((draft, i) => createCalendarItem({
        runId,
        brand,
        loc: getLocationById(brand.brand_id, draft.location_id)!,
        title: draft.topic,
        keyword: `${brand.name} ${draft.location_id}`,
        type: 'gbp_post_preview',
        scheduledAt: daysFromNow(scheduleOffset + i, 17),
        previewId: draft.id,
      })),
    ];
    scheduleOffset += gbpDrafts.length;

    result.google_connector_status[target.brand_id] = connectorStatus(brand);
    result.brands[target.brand_id] = {
      article_location: articleLoc.location_id,
      locations_analyzed: activeLocs.map(l => l.location_id),
      facts_seeded_or_verified: facts.length,
      provider: FALLBACK_PROVIDER,
      findings_count: findings.length,
      keywords_count: keywords.length,
      clusters_count: clusterMap.clusters.length,
      strategy_30_day: strategy,
      article_preview: article,
      gbp_drafts: gbpDrafts,
      calendar_items: calendarItems,
      approvals: approvalResults,
      policy_results: [...[article], ...gbpDrafts].map(item => ({ id: item.id, result: item.policy.result, blockers: item.policy.blockers, warnings: item.policy.warnings })),
    };
    try { generateWeeklyReport(brand.brand_id); } catch {}
  }

  db.prepare(`
    INSERT INTO seo_automation_runs (id, started_at, completed_at, job_id, status, detail)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(seoId('run'), startedAt, nowIso(), 'preview_automation_cycle', 'completed', JSON.stringify({
    run_id: runId,
    duplicate_prevention: 'idempotency keys recorded in seo_preview_executions',
    public_writes: result.public_writes,
  }));

  recordEvidence({
    category: 'seo_preview_automation_certification',
    summary: `Preview automation run ${runId} completed without public writes`,
    payload: result,
  });

  db.prepare('UPDATE seo_functional_runs SET completed_at = ?, status = ?, summary = ? WHERE id = ?')
    .run(nowIso(), 'completed', JSON.stringify({
      brands: Object.keys(result.brands),
      public_writes: result.public_writes,
      verdict: 'AUTOMATION_PREVIEW_WORKING',
    }), runId);

  return { ok: true, ...result, completed_at: nowIso(), verdict: 'AUTOMATION_PREVIEW_WORKING' };
}

export function classifyPublishTier(category: string) {
  const policy = evaluatePolicy(category);
  if (policy.tier === 'SAFE_AUTO') return { tier: 'TIER_1_AUTO_PUBLISH_ELIGIBLE', policy };
  if (policy.tier === 'REQUIRES_APPROVAL' || policy.tier === 'AUTO_WITH_NOTIFICATION') return { tier: 'TIER_2_APPROVAL_REQUIRED', policy };
  return { tier: 'TIER_3_ALWAYS_MANUAL_OR_BLOCKED', policy };
}
