/**
 * SEO Control Center — Internal Link Engine: page registry (spec §15).
 * CRUD over seo_site_pages. Classifies page_type from URL shape so a crawler
 * (or manual seed) can register a URL without knowing brand-specific rules.
 */

import { getSeoDb, nowIso, seoId } from '../seo-db';

export type PageType = 'money' | 'location' | 'menu' | 'blog' | 'home' | 'other';

export interface SitePage {
  id: string;
  created_at: string;
  updated_at: string;
  brand_id: string;
  location_id: string | null;
  url: string;
  page_type: PageType;
  title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical: string | null;
  is_orphan: number;
  last_crawled_at: string | null;
  deleted_at: string | null;
}

export interface RegisterPageInput {
  brand_id: string;
  location_id?: string | null;
  url: string;
  page_type?: PageType; // if omitted, classified from the URL
  title?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical?: string | null;
}

/**
 * Classify a page_type from URL shape, based on the real routing patterns of
 * the two live brand sites this system manages:
 *  - Bakudan Ramen (bakudanramen.com): "/locations/*" -> location,
 *    "/menu*" -> menu, "/blog-*" or any path containing "blog-cms" -> blog,
 *    ordering/reservation platform links (Toast, OpenTable, DoorDash, etc.)
 *    or "/order*"/"/reserve*" paths -> money, "/" -> home.
 *  - Raw Sushi Bar (rawsushibar.com): "/stockton/" and "/modesto/" (its two
 *    physical locations) -> location, "/menu/*" -> menu,
 *    "/content/posts/*" -> blog.
 * Anything that doesn't match a known pattern falls back to 'other' rather
 * than guessing.
 */
export function classifyPageType(url: string): PageType {
  let pathname: string;
  let host: string;
  try {
    const u = new URL(url);
    pathname = u.pathname.toLowerCase();
    host = u.hostname.toLowerCase();
  } catch {
    // Not a fully-qualified URL (e.g. a bare path) — treat the whole string as the path.
    pathname = url.toLowerCase();
    host = '';
  }

  if (pathname === '' || pathname === '/') return 'home';

  const MONEY_HOSTS = ['toasttab.com', 'opentable.com', 'doordash.com', 'ubereats.com', 'grubhub.com', 'clover.com'];
  if (MONEY_HOSTS.some(h => host.includes(h))) return 'money';
  if (/\/(order|ordering|reserve|reservation)s?(\/|$)/.test(pathname)) return 'money';

  if (/^\/locations\//.test(pathname)) return 'location';
  if (/^\/(stockton|modesto)\/?/.test(pathname)) return 'location';

  if (/^\/menu\/?/.test(pathname)) return 'menu';

  if (/^\/blog-/.test(pathname) || pathname.includes('blog-cms') || /^\/content\/posts\//.test(pathname)) return 'blog';

  return 'other';
}

/**
 * Insert or update a page row keyed on (brand_id, url) — matches the
 * seo_site_pages unique index. Re-registering an existing URL updates its
 * metadata in place rather than creating a duplicate row.
 */
export function registerPage(input: RegisterPageInput): SitePage {
  const db = getSeoDb();
  const pageType = input.page_type ?? classifyPageType(input.url);
  const now = nowIso();

  const existing = db.prepare('SELECT * FROM seo_site_pages WHERE brand_id = ? AND url = ?')
    .get(input.brand_id, input.url) as SitePage | undefined;

  if (existing) {
    db.prepare(`
      UPDATE seo_site_pages
      SET updated_at = @updated_at, location_id = @location_id, page_type = @page_type,
          title = @title, meta_title = @meta_title, meta_description = @meta_description, canonical = @canonical
      WHERE id = @id
    `).run({
      id: existing.id,
      updated_at: now,
      location_id: input.location_id ?? existing.location_id ?? null,
      page_type: pageType,
      title: input.title ?? existing.title ?? null,
      meta_title: input.meta_title ?? existing.meta_title ?? null,
      meta_description: input.meta_description ?? existing.meta_description ?? null,
      canonical: input.canonical ?? existing.canonical ?? null,
    });
    return db.prepare('SELECT * FROM seo_site_pages WHERE id = ?').get(existing.id) as SitePage;
  }

  const record: SitePage = {
    id: seoId('page'),
    created_at: now,
    updated_at: now,
    brand_id: input.brand_id,
    location_id: input.location_id ?? null,
    url: input.url,
    page_type: pageType,
    title: input.title ?? null,
    meta_title: input.meta_title ?? null,
    meta_description: input.meta_description ?? null,
    canonical: input.canonical ?? null,
    is_orphan: 0,
    last_crawled_at: null,
    deleted_at: null,
  };

  db.prepare(`
    INSERT INTO seo_site_pages
      (id, created_at, updated_at, brand_id, location_id, url, page_type, title, meta_title, meta_description, canonical, is_orphan, last_crawled_at, deleted_at)
    VALUES
      (@id, @created_at, @updated_at, @brand_id, @location_id, @url, @page_type, @title, @meta_title, @meta_description, @canonical, @is_orphan, @last_crawled_at, @deleted_at)
  `).run(record);

  return record;
}

export function getPagesForBrand(brandId: string, pageType?: PageType): SitePage[] {
  const db = getSeoDb();
  if (pageType) {
    return db.prepare('SELECT * FROM seo_site_pages WHERE brand_id = ? AND page_type = ? AND deleted_at IS NULL ORDER BY url')
      .all(brandId, pageType) as SitePage[];
  }
  return db.prepare('SELECT * FROM seo_site_pages WHERE brand_id = ? AND deleted_at IS NULL ORDER BY url')
    .all(brandId) as SitePage[];
}

export function getPageByUrl(brandId: string, url: string): SitePage | undefined {
  return getSeoDb().prepare('SELECT * FROM seo_site_pages WHERE brand_id = ? AND url = ?').get(brandId, url) as SitePage | undefined;
}

export function getPageById(id: string): SitePage | undefined {
  return getSeoDb().prepare('SELECT * FROM seo_site_pages WHERE id = ?').get(id) as SitePage | undefined;
}

export function setPageOrphanFlag(pageId: string, isOrphan: boolean): void {
  getSeoDb().prepare('UPDATE seo_site_pages SET is_orphan = ?, updated_at = ? WHERE id = ?').run(isOrphan ? 1 : 0, nowIso(), pageId);
}

export function markPageCrawled(pageId: string): void {
  const now = nowIso();
  getSeoDb().prepare('UPDATE seo_site_pages SET last_crawled_at = ?, updated_at = ? WHERE id = ?').run(now, now, pageId);
}

export function softDeletePage(pageId: string): void {
  getSeoDb().prepare('UPDATE seo_site_pages SET deleted_at = ?, updated_at = ? WHERE id = ?').run(nowIso(), nowIso(), pageId);
}
