/**
 * SEO Control Center — Backlink Management: risk scorer (spec §19).
 *
 * IMPLEMENTED: rule-based scoring logic given a structured backlink data
 * object. Every field this function reads (domain_authority, spam_score,
 * topical_relevance, local_relevance, link_type, sponsorship, plus a handful
 * of reviewer/crawler-supplied risk flags) is an input the caller supplies —
 * nothing here calls out to a live backlink index.
 *
 * NOT_IMPLEMENTED: live backlink discovery/crawling (i.e. actually finding
 * new backlinks and populating domain_authority/spam_score/etc from a
 * third-party index like Ahrefs/Moz/Majestic). No such API is configured in
 * this environment; that data must be supplied by the caller (a future
 * connector, or manual entry) as BacklinkScoringInput.
 *
 * Per spec, this NEVER approves a link "because DA is high" — domain_authority
 * is recorded for visibility only and is explicitly excluded from the score
 * calculation. Risk is driven by spam/relevance/category/pattern signals.
 */

import { getBrandById } from '../brand-config';

export type SiteCategory = 'adult' | 'gambling' | 'drugs' | 'weapons' | 'malware' | 'link_farm' | 'pbn';

const AUTO_REJECT_CATEGORIES: ReadonlySet<string> = new Set<SiteCategory>([
  'adult', 'gambling', 'drugs', 'weapons', 'malware', 'link_farm', 'pbn',
]);

export interface BacklinkScoringInput {
  brand_id: string;
  source_domain: string;
  source_url: string;
  destination_url: string;
  anchor_text?: string;
  domain_authority?: number;        // 0-100 — informational only, never used to reduce risk
  page_authority?: number;          // 0-100 — informational only
  spam_score?: number;              // 0-100, higher = worse (Moz-style convention)
  topical_relevance?: number;       // 0-1
  local_relevance?: number;         // 0-1
  link_type?: 'dofollow' | 'nofollow';
  sponsorship?: 'sponsored' | 'ugc' | 'none';
  outbound_link_density?: number;   // 0-1 — fraction of the source page that is outbound links
  site_category?: string[];         // reviewer/crawler-supplied category tags, e.g. ['adult']
  is_deindexed?: boolean;
  is_pbn_suspected?: boolean;
  looks_hacked?: boolean;
}

export interface BacklinkScoringResult {
  risk_score: number; // 0-100, higher = riskier
  decision: 'APPROVE' | 'MANUAL_REVIEW' | 'REJECT';
  reasons: string[];
}

function brandRelevanceTerms(brandId: string): string[] {
  const brand = getBrandById(brandId);
  if (!brand) return [];
  const terms = [brand.name, brand.cuisine, brand.industry].filter((t): t is string => !!t);
  return terms.flatMap(t => t.toLowerCase().split(/\W+/)).filter(w => w.length > 2);
}

export function scoreBacklink(input: BacklinkScoringInput): BacklinkScoringResult {
  const reasons: string[] = [];
  let riskScore = 0;
  let hardReject = false;

  // ── Auto-reject categories (spec: adult, gambling, drugs, weapons, malware, link farms, PBN) ──
  const categories = (input.site_category || []).map(c => c.toLowerCase());
  const badCategory = categories.find(c => AUTO_REJECT_CATEGORIES.has(c));
  if (badCategory) {
    hardReject = true;
    riskScore += 100;
    reasons.push(`prohibited site category: ${badCategory}`);
  }

  if (input.is_pbn_suspected) {
    hardReject = true;
    riskScore += 90;
    reasons.push('PBN (private blog network) pattern suspected');
  }

  if (input.looks_hacked) {
    hardReject = true;
    riskScore += 90;
    reasons.push('source site shows signs of being hacked/compromised');
  }

  if (input.is_deindexed) {
    hardReject = true;
    riskScore += 80;
    reasons.push('source page appears deindexed');
  }

  if (typeof input.outbound_link_density === 'number' && input.outbound_link_density > 0.5) {
    hardReject = true;
    riskScore += 70;
    reasons.push(`excessive outbound link density (${Math.round(input.outbound_link_density * 100)}%) — likely link farm`);
  }

  // ── Misleading anchor text: keyword overlap between anchor text and brand/cuisine terms ──
  if (input.anchor_text) {
    const terms = brandRelevanceTerms(input.brand_id);
    if (terms.length > 0) {
      const anchorLower = input.anchor_text.toLowerCase();
      const overlaps = terms.some(t => anchorLower.includes(t));
      if (!overlaps) {
        riskScore += 25;
        reasons.push('anchor text has no keyword overlap with brand/cuisine terms — possible misleading anchor');
      }
    }
  }

  // ── Spam score (Moz-style 0-100, higher = worse) ──
  if (typeof input.spam_score === 'number') {
    if (input.spam_score >= 30) {
      hardReject = true;
      riskScore += 60;
      reasons.push(`spam score too high (${input.spam_score})`);
    } else if (input.spam_score >= 15) {
      riskScore += 20;
      reasons.push(`elevated spam score (${input.spam_score})`);
    }
  } else {
    riskScore += 10;
    reasons.push('spam_score not provided — cannot rule out spam risk');
  }

  // ── Relevance — low relevance is a risk signal REGARDLESS of domain authority ──
  if (typeof input.topical_relevance === 'number' && input.topical_relevance < 0.3) {
    riskScore += 20;
    reasons.push(`low topical relevance (${input.topical_relevance})`);
  }
  if (
    typeof input.local_relevance === 'number' && input.local_relevance < 0.2 &&
    typeof input.topical_relevance === 'number' && input.topical_relevance < 0.3
  ) {
    riskScore += 10;
    reasons.push('low local relevance compounding low topical relevance');
  }

  if (input.sponsorship === 'sponsored' && input.link_type === 'dofollow') {
    riskScore += 15;
    reasons.push('sponsored dofollow link without disclosed rel="sponsored" attribute risks a link-scheme penalty');
  }

  // domain_authority / page_authority are recorded for visibility ONLY.
  // Spec explicitly forbids "approve because DA is high" — a high DA never
  // offsets or reduces riskScore anywhere in this function.
  if (typeof input.domain_authority === 'number') {
    reasons.push(`domain_authority=${input.domain_authority} (informational only — does not reduce risk score)`);
  }

  riskScore = Math.min(100, riskScore);

  let decision: BacklinkScoringResult['decision'];
  if (hardReject || riskScore >= 60) decision = 'REJECT';
  else if (riskScore >= 25) decision = 'MANUAL_REVIEW';
  else decision = 'APPROVE';

  if (reasons.length === 0) reasons.push('no risk signals detected in provided data');

  return { risk_score: riskScore, decision, reasons };
}
