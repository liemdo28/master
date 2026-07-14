/**
 * SEO Control Center — Local SEO Engine: GBP Posts workflow (spec §4, posts only).
 *
 * Scope: Google Business Profile POSTS ONLY — never core info (address, phone,
 * hours, categories, website URL). Core-info edits are permanently routed to
 * the `modify_gbp_core_info` policy category, which is BLOCKED in
 * config/seo-policy.yaml, and nothing in this file calls or references that
 * category.
 *
 * Draft generation is template-based (no LLM call — this repo's convention
 * for deterministic, no-API-cost content per mi-core/CLAUDE.md rule 4 applies
 * equally well here: it keeps drafts free, fast, and fully explainable).
 * Every fact used in a draft comes from brand-config.ts's LocationRecord —
 * nothing is invented.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSeoDb, nowIso, seoId } from '../seo-db';
import { submitSeoAction, type SeoActionOutcome } from '../seo-approval-bridge';
import { recordEvidence, getEvidenceForAction } from '../seo-evidence';
import { getBrandById, getLocationById, type LocationRecord } from '../brand-config';
import { getById as getApprovalAction } from '../../approval/gate';
import { getStatus, listLocations, hasBizManageScope } from '../gbp-connector';
import { resolveCta, type CtaType, type ResolvedCta } from '../cta/cta-engine';
import { disabledReason, isSeoGbpWriteEnabled } from '../seo-write-guards';
import { GOOGLE_WRITE_DISABLED_ERROR, isGoogleConnectorWriteEnabled } from '../../visibility/connectors/google/google-auth';

// ── Draft generation ─────────────────────────────────────────────────────────

export interface GbpPostDraft {
  brand_id: string;
  location_id: string;
  topic: string;
  text: string;
  word_count: number;
  cta_type: CtaType;
  cta: ResolvedCta | null;
  generated_at: string;
}

const CLOSER_SENTENCES = [
  "Great food, genuine hospitality, and a warm atmosphere are what we're all about.",
  'Our team works hard every day to make sure every dish leaves the kitchen exactly right.',
  "Bring your friends and family — there's always a good reason to gather around great food.",
  'We appreciate every guest who walks through our doors, and we hope to see you again soon.',
  'From the first bite to the last, we want every visit to feel worth the trip.',
];

function countWords(sentences: string[]): number {
  return sentences.join(' ').split(/\s+/).filter(Boolean).length;
}

function buildBaseSentences(loc: LocationRecord, brandName: string, topic: string): string[] {
  const parts: string[] = [];
  const placeLabel = loc.short_name || loc.name;
  parts.push(`${brandName}${placeLabel ? ` at ${placeLabel}` : ''}: ${topic}.`);
  if (loc.address && loc.address !== 'needs_config') {
    parts.push(`Stop by our location at ${loc.address} to experience it for yourself.`);
  }
  if (loc.hours && loc.hours !== 'needs_config') {
    parts.push(`We're open ${loc.hours} — plan your visit and come hungry.`);
  }
  parts.push("Whether you're a regular or trying us for the first time, this is a great reason to swing by soon.");
  if (loc.menu_url && loc.menu_url !== 'needs_config') {
    parts.push('Check out the full menu online before you arrive so you know exactly what to order.');
  }
  return parts;
}

function inferCtaType(topic: string): CtaType {
  if (/order|delivery|takeout|to-go/i.test(topic)) return 'order_online';
  if (/menu|dish|special/i.test(topic)) return 'view_menu';
  if (/direction|address|find us|located/i.test(topic)) return 'get_directions';
  if (/call|phone/i.test(topic)) return 'call_restaurant';
  return 'view_menu';
}

/**
 * Produces a draft GBP post (80-250 words per spec §4). This never calls the
 * live GBP API — it is a draft object only, persisted via
 * submitGbpPostForApproval() before anything is sent to Google.
 */
export function generateGbpPostDraft(brandId: string, locationId: string, topic: string): GbpPostDraft {
  const brand = getBrandById(brandId);
  const location = getLocationById(brandId, locationId);
  if (!brand) throw new Error(`brand_not_found: ${brandId}`);
  if (!location) throw new Error(`location_not_found: ${locationId} for brand ${brandId}`);
  const cleanTopic = (topic || '').trim();
  if (!cleanTopic) throw new Error('topic is required');

  const sentences = buildBaseSentences(location, brand.name, cleanTopic);

  let i = 0;
  while (countWords(sentences) < 80 && i < CLOSER_SENTENCES.length) {
    sentences.push(CLOSER_SENTENCES[i]);
    i++;
  }
  while (countWords(sentences) > 250 && sentences.length > 1) {
    sentences.pop();
  }

  const text = sentences.join(' ');
  const wordCount = countWords(sentences);
  const ctaType = inferCtaType(cleanTopic);

  // resolveCta() (from ../cta/cta-engine.ts) never fabricates a homepage
  // fallback — it returns null if no location-specific URL/source exists,
  // and that null is preserved here rather than papered over.
  let cta: ResolvedCta | null = null;
  try {
    cta = resolveCta(brandId, locationId, ctaType);
  } catch {
    cta = null;
  }

  return {
    brand_id: brandId,
    location_id: locationId,
    topic: cleanTopic,
    text,
    word_count: wordCount,
    cta_type: ctaType,
    cta,
    generated_at: nowIso(),
  };
}

// ── Approval submission ──────────────────────────────────────────────────────

export interface GbpPostSubmission {
  outcome: SeoActionOutcome;
  action_id: string | null;
}

/**
 * Submits a draft for approval via seo-approval-bridge.ts under the
 * `gbp_post_publish` category (REQUIRES_APPROVAL in config/seo-policy.yaml).
 * Never auto-publishes — the draft only reaches Google after
 * publishApprovedGbpPost() confirms an 'approved' status on the linked
 * approval-gate action.
 */
export function submitGbpPostForApproval(brandId: string, locationId: string, draftPost: GbpPostDraft): GbpPostSubmission {
  const idempotencyKey = seoId('gbppost');
  const outcome = submitSeoAction({
    category: 'gbp_post_publish',
    brand_id: brandId,
    description: `GBP post draft for ${brandId}/${locationId}: "${draftPost.topic}" (${draftPost.word_count} words)`,
    target: locationId,
    after_state: JSON.stringify(draftPost),
    rollback_plan: 'Reject the pending approval — no live publish has occurred yet, the draft is simply discarded.',
    idempotency_key: idempotencyKey,
    payload: draftPost,
  });

  let actionId: string | null = null;
  if (outcome.outcome === 'duplicate') {
    actionId = outcome.existing_action_id;
  } else {
    const row = getSeoDb().prepare('SELECT id FROM seo_actions WHERE idempotency_key = ?').get(idempotencyKey) as { id: string } | undefined;
    actionId = row?.id ?? null;
  }

  return { outcome, action_id: actionId };
}

// ── Publish (post-approval) ──────────────────────────────────────────────────

export interface GbpPostPublishResult {
  success: boolean;
  error?: string;
  gbp_post_id?: string;
}

interface SeoActionRow {
  id: string;
  brand_id: string | null;
  category: string;
  approval_id: string | null;
  status: string;
}

/**
 * Only callable after the linked approval-gate action is 'approved'. Because
 * gbp-connector.ts does not currently export any post-creation capability
 * (only listLocations/getDailyMetrics/storeDailySnapshot read paths), this
 * function deliberately does NOT fabricate a successful publish — it marks
 * the seo_actions row 'failed' with an honest, specific error instead.
 */
export async function publishApprovedGbpPost(actionId: string): Promise<GbpPostPublishResult> {
  const db = getSeoDb();
  const action = db.prepare('SELECT id, brand_id, category, approval_id, status FROM seo_actions WHERE id = ?')
    .get(actionId) as SeoActionRow | undefined;

  if (!action) {
    return { success: false, error: `seo_actions row not found for id ${actionId}` };
  }
  if (!isSeoGbpWriteEnabled()) {
    const errorMsg = GOOGLE_WRITE_DISABLED_ERROR;
    db.prepare(`UPDATE seo_actions SET status = 'failed', result = ? WHERE id = ?`).run(errorMsg, actionId);
    recordEvidence({
      action_id: actionId,
      brand_id: action.brand_id ?? undefined,
      category: 'gbp_post_publish',
      summary: `Publish refused: ${errorMsg}`,
      payload: { has_biz_manage_scope: hasBizManageScope() },
    });
    return { success: false, error: errorMsg };
  }
  if (!isGoogleConnectorWriteEnabled()) {
    const errorMsg = GOOGLE_WRITE_DISABLED_ERROR;
    db.prepare(`UPDATE seo_actions SET status = 'failed', result = ? WHERE id = ?`).run(errorMsg, actionId);
    recordEvidence({
      action_id: actionId,
      brand_id: action.brand_id ?? undefined,
      category: 'gbp_post_publish',
      summary: `Publish refused: ${errorMsg}`,
      payload: { has_biz_manage_scope: hasBizManageScope() },
    });
    return { success: false, error: errorMsg };
  }
  if (action.category !== 'gbp_post_publish') {
    return { success: false, error: `action ${actionId} is category "${action.category}", not gbp_post_publish` };
  }
  if (!action.approval_id) {
    return { success: false, error: `action ${actionId} was never routed through the approval gate (no approval_id)` };
  }

  const approval = getApprovalAction(action.approval_id);
  if (!approval || approval.status !== 'approved') {
    return { success: false, error: `approval ${action.approval_id} is not approved (status=${approval?.status ?? 'not_found'})` };
  }

  const evidenceRows = getEvidenceForAction(actionId);
  const draftEvidence = evidenceRows.find(e => e.category === 'gbp_post_publish');
  let draft: unknown = null;
  try {
    draft = draftEvidence?.payload ? (JSON.parse(draftEvidence.payload) as { request?: { payload?: unknown } }).request?.payload ?? null : null;
  } catch {
    draft = null;
  }

  const errorMsg = 'GBP posts API capability not available in gbp-connector.ts';
  db.prepare(`UPDATE seo_actions SET status = 'failed', result = ? WHERE id = ?`).run(errorMsg, actionId);
  recordEvidence({
    action_id: actionId,
    brand_id: action.brand_id ?? undefined,
    category: 'gbp_post_publish',
    summary: `Publish attempt failed: ${errorMsg}`,
    payload: { draft, has_biz_manage_scope: hasBizManageScope() },
  });

  return { success: false, error: errorMsg };
}

// ── GBP snapshot sync ─────────────────────────────────────────────────────────

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const GOOGLE_TOKENS_PATH = path.join(GLOBAL_DIR, 'visibility', 'google-tokens.json');

export interface GbpSyncResult {
  status: 'NOT_CONNECTED' | 'NO_MATCH' | 'SNAPSHOT_STORED' | 'ERROR';
  detail: string;
  snapshot_id?: string;
  /** Honest per-capability status — account discovery/metrics may still be quota-limited. */
  capability: 'MOCK' | 'CONFIGURED' | 'CONNECTED' | 'LIVE_VERIFIED';
}

/**
 * Pulls current GBP data via the existing gbp-connector.ts and writes a row
 * to seo_gbp_snapshots. IMPORTANT honesty note: gbp-connector.ts's location
 * list is mapped from canonical SEO config + explicit GBP location IDs because
 * Business Profile account/location discovery is quota-limited in this
 * environment. This function therefore reports 'CONNECTED' rather than
 * 'LIVE_VERIFIED' for the NAP fields it stores.
 */
export async function syncGbpSnapshot(brandId: string, locationId: string): Promise<GbpSyncResult> {
  const location = getLocationById(brandId, locationId);
  if (!location) {
    return { status: 'ERROR', detail: `location_not_found: ${locationId} for brand ${brandId}`, capability: 'MOCK' };
  }

  if (!fs.existsSync(GOOGLE_TOKENS_PATH)) {
    return {
      status: 'NOT_CONNECTED',
      detail: `No Google tokens file at ${GOOGLE_TOKENS_PATH} — CEO must authorize via http://localhost:4001/api/auth/google/start`,
      capability: 'MOCK',
    };
  }

  const connectorStatus = getStatus();
  if (!connectorStatus.configured) {
    return {
      status: 'NOT_CONNECTED',
      detail: `${connectorStatus.status}${connectorStatus.next_step ? `: ${connectorStatus.next_step}` : ''}`,
      capability: 'CONFIGURED',
    };
  }

  let locResult: {
    error?: string;
    locations?: Array<{
      location_id: string;
      brand_id?: string;
      seo_location_id?: string;
      location_name: string;
      address: string;
      website_uri: string;
      phone: string;
    }>;
  };
  try {
    locResult = await listLocations();
  } catch (e) {
    return { status: 'ERROR', detail: `listLocations() threw: ${(e as Error).message}`, capability: 'CONFIGURED' };
  }
  if (locResult.error) {
    return { status: 'ERROR', detail: locResult.error, capability: 'CONFIGURED' };
  }

  const candidates = locResult.locations || [];
  const exactMatch = candidates.find(l =>
    l.brand_id === brandId &&
    l.seo_location_id === locationId
  );
  const firstWord = (location.name || '').toLowerCase().split(' ')[0];
  const legacyNameMatch = candidates.find(l =>
    (location.gbp_place_id && l.location_id === location.gbp_place_id) ||
    (firstWord && l.location_name?.toLowerCase().includes(firstWord))
  );
  const match = exactMatch || legacyNameMatch;

  if (!match) {
    return { status: 'NO_MATCH', detail: `No GBP location returned by gbp-connector.listLocations() to match ${locationId}`, capability: 'CONNECTED' };
  }

  const payload = {
    gbp_location_id: match.location_id,
    location_name: match.location_name,
    address: match.address,
    phone: match.phone,
    website_uri: match.website_uri,
    source: 'gbp_connector.listLocations (env_configured from canonical SEO location config + explicit GBP location IDs; Business Profile discovery/metrics may be quota-limited)',
    synced_at: nowIso(),
  };

  const id = seoId('gbps');
  getSeoDb().prepare(`
    INSERT INTO seo_gbp_snapshots (id, captured_at, brand_id, location_id, raw_payload, nap_conflicts)
    VALUES (?, ?, ?, ?, ?, NULL)
  `).run(id, nowIso(), brandId, locationId, JSON.stringify(payload));

  submitSeoAction({
    category: 'collect_gbp_snapshot',
    brand_id: brandId,
    description: `GBP snapshot sync for ${brandId}/${locationId}`,
    target: locationId,
    idempotency_key: `collect_gbp_snapshot:${brandId}:${locationId}:${new Date().toISOString().slice(0, 13)}`,
    payload: { snapshot_id: id, matched_gbp_location_id: match.location_id },
  });

  return {
    status: 'SNAPSHOT_STORED',
    detail: 'Stored GBP snapshot from gbp-connector.ts (OAuth token + business.manage scope verified real; location identity comes from canonical SEO config plus explicit GBP location IDs; Business Information discovery/metrics remain quota-limited — see capability field)',
    snapshot_id: id,
    capability: 'CONNECTED',
  };
}
