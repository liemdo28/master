/**
 * SEO Control Center — Internal Link Engine: anchor-text diversity check (spec §15).
 * Flags a target URL when a single exact-match anchor text dominates its
 * inbound internal links, which is a classic over-optimization / manipulation
 * signal search engines penalize.
 */

import { getSeoDb } from '../seo-db';

// Threshold rationale: anchor-text audit guidance (Ahrefs/Moz-style) treats
// >50-60% exact-match concentration to a single target as a risk signal for
// over-optimization. 60% is chosen as the flag line — strict enough to catch
// genuine repetition, loose enough that a small link set with 2-3 natural
// phrasing variants (e.g. "our menu" used twice out of three links) doesn't
// trip a false positive.
export const ANCHOR_DIVERSITY_THRESHOLD = 0.6;

export interface AnchorDiversityEntry {
  target_url: string;
  total_links: number;
  dominant_anchor: string;
  dominant_count: number;
  dominant_share: number; // 0-1
  flagged: boolean;
}

export interface AnchorDiversityReport {
  brand_id: string;
  threshold: number;
  targets_checked: number;
  all_targets: AnchorDiversityEntry[];
  flagged: AnchorDiversityEntry[];
}

export function computeAnchorDiversity(brandId: string, threshold: number = ANCHOR_DIVERSITY_THRESHOLD): AnchorDiversityReport {
  const db = getSeoDb();
  const links = db.prepare(`
    SELECT target_url, anchor_text FROM seo_internal_links WHERE brand_id = ? AND status = 'active'
  `).all(brandId) as { target_url: string; anchor_text: string | null }[];

  const byTarget = new Map<string, Map<string, number>>();
  for (const link of links) {
    const anchor = (link.anchor_text || '').trim().toLowerCase();
    if (!anchor) continue;
    const anchorMap = byTarget.get(link.target_url) ?? new Map<string, number>();
    anchorMap.set(anchor, (anchorMap.get(anchor) ?? 0) + 1);
    byTarget.set(link.target_url, anchorMap);
  }

  const allTargets: AnchorDiversityEntry[] = [];
  for (const [target, anchorMap] of byTarget.entries()) {
    const total = Array.from(anchorMap.values()).reduce((a, b) => a + b, 0);
    if (total < 2) continue; // need at least 2 inbound links to assess "diversity"

    let dominantAnchor = '';
    let dominantCount = 0;
    for (const [anchor, count] of anchorMap.entries()) {
      if (count > dominantCount) {
        dominantAnchor = anchor;
        dominantCount = count;
      }
    }
    const share = dominantCount / total;
    allTargets.push({
      target_url: target,
      total_links: total,
      dominant_anchor: dominantAnchor,
      dominant_count: dominantCount,
      dominant_share: share,
      flagged: share > threshold,
    });
  }

  return {
    brand_id: brandId,
    threshold,
    targets_checked: allTargets.length,
    all_targets: allTargets,
    flagged: allTargets.filter(t => t.flagged),
  };
}
