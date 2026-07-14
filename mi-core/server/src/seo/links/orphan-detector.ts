/**
 * SEO Control Center — Internal Link Engine: orphan page detector (spec §15).
 * A page is "orphan" if it has zero active inbound internal links, excluding
 * the homepage (page_type === 'home'), which is always reachable through
 * primary nav / logo and is not expected to accumulate seo_internal_links rows.
 */

import { getSeoDb } from '../seo-db';
import { getPagesForBrand, setPageOrphanFlag, type SitePage } from './link-registry';

export interface OrphanReport {
  brand_id: string;
  checked_at: string;
  total_pages: number;
  orphan_pages: SitePage[];
  orphan_count: number;
}

export function getInboundLinkCount(brandId: string, url: string): number {
  const row = getSeoDb().prepare(`
    SELECT COUNT(*) as cnt FROM seo_internal_links WHERE brand_id = ? AND target_url = ? AND status = 'active'
  `).get(brandId, url) as { cnt: number } | undefined;
  return row?.cnt ?? 0;
}

/**
 * Recomputes inbound-link counts for every non-home page of a brand, flags
 * orphans, and persists is_orphan back onto seo_site_pages so other engines
 * (e.g. link-recommender) can read the flag cheaply without re-scanning links.
 */
export function detectOrphanPages(brandId: string): OrphanReport {
  const db = getSeoDb();
  const pages = getPagesForBrand(brandId).filter(p => p.page_type !== 'home');

  const inboundCounts = db.prepare(`
    SELECT target_url, COUNT(*) as cnt
    FROM seo_internal_links
    WHERE brand_id = ? AND status = 'active'
    GROUP BY target_url
  `).all(brandId) as { target_url: string; cnt: number }[];

  const inboundMap = new Map(inboundCounts.map(r => [r.target_url, r.cnt]));

  const orphans: SitePage[] = [];
  const nonOrphans: SitePage[] = [];
  for (const page of pages) {
    const count = inboundMap.get(page.url) ?? 0;
    if (count > 0) nonOrphans.push(page);
    else orphans.push(page);
  }

  for (const p of orphans) setPageOrphanFlag(p.id, true);
  for (const p of nonOrphans) setPageOrphanFlag(p.id, false);

  return {
    brand_id: brandId,
    checked_at: new Date().toISOString(),
    total_pages: pages.length,
    orphan_pages: orphans,
    orphan_count: orphans.length,
  };
}
