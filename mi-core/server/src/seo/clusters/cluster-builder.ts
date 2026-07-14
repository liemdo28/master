/**
 * SEO Topic Cluster Map (spec §10).
 * Builds seo_topic_clusters + seo_cluster_nodes from a brand's real keyword
 * and page data. When a brand has no keyword data yet, falls back to a
 * starter set of clusters derived from its cuisine/locations in brand-config
 * — those are clearly marked health_status: 'seed' (vs 'derived' for
 * clusters built from actual seo_keywords rows) so nobody mistakes a seed
 * cluster for real coverage data.
 */

import { getSeoDb, nowIso, seoId } from '../seo-db';
import { getBrandById, getActiveLocationsForBrand, type BrandRecord, type LocationRecord } from '../brand-config';
import { clusterByTokenOverlap, type KeywordCluster } from '../keywords/keyword-cluster-engine';
import { normalizeKeyword } from '../keywords/keyword-normalizer';
import type { KeywordRecord } from '../keywords/keyword-store';

export type ClusterNodeType = 'pillar' | 'supporting_article' | 'location' | 'menu_category';

export interface ClusterNodeResult {
  id: string;
  node_type: ClusterNodeType;
  ref_id: string | null;
  label: string;
  status: string;
  // Only populated when read back from seo_cluster_nodes via getClusterMap()
  // (see persistClusters/insertNode below, which always writes 'unknown' for
  // both at generation time — cluster-builder has no link/ranking data source
  // wired up yet). Freshly-built-but-not-yet-persisted results from
  // buildDerivedClusters/buildSeedClusters never set these fields.
  link_status?: string;
  ranking_status?: string;
}

export interface TopicClusterResult {
  id: string;
  name: string;
  health_status: 'derived' | 'seed';
  nodes: ClusterNodeResult[];
}

export interface ClusterMapResult {
  brand_id: string;
  generated_at: string;
  clusters: TopicClusterResult[];
}

interface SitePageRow {
  id: string;
  brand_id: string;
  location_id: string | null;
  url: string;
  page_type: string;
  title: string | null;
}

interface ContentItemRow {
  id: string;
  brand_id: string;
  location_id: string | null;
  title: string | null;
  status: string;
  primary_keyword_id: string | null;
}

// Best-effort menu-category vocabulary. There is no dedicated menu-item data
// source wired up yet, so this is a heuristic keyword match, not a real menu
// feed — documented here and in the final report.
const MENU_CATEGORY_TERMS = [
  'sushi', 'ramen', 'appetizer', 'appetizers', 'dessert', 'desserts', 'lunch', 'dinner',
  'catering', 'sashimi', 'roll', 'rolls', 'bento', 'noodle', 'noodles', 'drink', 'drinks',
  'cocktail', 'cocktails', 'starter', 'starters', 'entree', 'entrees',
];

function fetchSitePages(brandId: string): SitePageRow[] {
  return getSeoDb().prepare(
    'SELECT id, brand_id, location_id, url, page_type, title FROM seo_site_pages WHERE brand_id = ? AND deleted_at IS NULL',
  ).all(brandId) as SitePageRow[];
}

function fetchContentItems(brandId: string): ContentItemRow[] {
  return getSeoDb().prepare(
    'SELECT id, brand_id, location_id, title, status, primary_keyword_id FROM seo_content_items WHERE brand_id = ? AND deleted_at IS NULL',
  ).all(brandId) as ContentItemRow[];
}

function fetchKeywords(brandId: string): KeywordRecord[] {
  return getSeoDb().prepare(
    'SELECT * FROM seo_keywords WHERE brand_id = ? AND deleted_at IS NULL',
  ).all(brandId) as KeywordRecord[];
}

/** Find a page/content item backing a given keyword, preferring an explicit
 *  assigned_content_id/target_url link over a fuzzy title match. */
function resolveRefForKeyword(
  kw: KeywordRecord,
  pages: SitePageRow[],
  content: ContentItemRow[],
): { ref_id: string | null; status: string } {
  if (kw.assigned_content_id) {
    const item = content.find(c => c.id === kw.assigned_content_id);
    if (item) return { ref_id: item.id, status: item.status };
  }
  if (kw.target_url) {
    const page = pages.find(p => p.url === kw.target_url);
    if (page) return { ref_id: page.id, status: 'LINKED' };
    return { ref_id: null, status: 'MISSING' };
  }
  return { ref_id: null, status: 'MISSING' };
}

function pickPillar(keywords: KeywordRecord[]): KeywordRecord {
  return [...keywords].sort((a, b) => (b.business_relevance ?? 0) - (a.business_relevance ?? 0))[0];
}

function buildDerivedClusters(brandId: string, keywords: KeywordRecord[]): TopicClusterResult[] {
  const pages = fetchSitePages(brandId);
  const content = fetchContentItems(brandId);

  const grouped: KeywordCluster[] = clusterKeywordsSync(keywords);
  const results: TopicClusterResult[] = [];

  for (const group of grouped) {
    const groupKeywords = keywords.filter(k => group.keyword_ids.includes(k.id));
    if (groupKeywords.length === 0) continue;

    const pillarKw = pickPillar(groupKeywords);
    const nodes: ClusterNodeResult[] = [];

    const pillarRef = resolveRefForKeyword(pillarKw, pages, content);
    nodes.push({
      id: seoId('node'),
      node_type: 'pillar',
      ref_id: pillarRef.ref_id,
      label: pillarKw.keyword,
      status: pillarRef.status,
    });

    for (const kw of groupKeywords) {
      if (kw.id === pillarKw.id) continue;
      const ref = resolveRefForKeyword(kw, pages, content);
      nodes.push({
        id: seoId('node'),
        node_type: 'supporting_article',
        ref_id: ref.ref_id,
        label: kw.keyword,
        status: ref.status,
      });
    }

    const locationIds = Array.from(new Set(groupKeywords.map(k => k.location_id).filter((v): v is string => !!v)));
    for (const locId of locationIds) {
      const page = pages.find(p => p.location_id === locId && p.page_type === 'location');
      nodes.push({
        id: seoId('node'),
        node_type: 'location',
        ref_id: page ? page.id : null,
        label: `location:${locId}`,
        status: page ? 'LINKED' : 'MISSING',
      });
    }

    const menuTerms = new Set<string>();
    for (const kw of groupKeywords) {
      const tokens = normalizeKeyword(kw.keyword).split(' ');
      for (const term of MENU_CATEGORY_TERMS) {
        if (tokens.includes(term)) menuTerms.add(term);
      }
    }
    for (const term of menuTerms) {
      const page = pages.find(p => p.page_type === 'menu' && normalizeKeyword(p.title || p.url).includes(term));
      nodes.push({
        id: seoId('node'),
        node_type: 'menu_category',
        ref_id: page ? page.id : null,
        label: `menu:${term}`,
        status: page ? 'LINKED' : 'MISSING',
      });
    }

    results.push({
      id: seoId('cluster'),
      name: group.label,
      health_status: 'derived',
      nodes,
    });
  }

  return results;
}

/** cluster-builder always uses the deterministic token-overlap path (not the
 *  optional embedding path in keyword-cluster-engine) so it stays a plain
 *  synchronous call from an HTTP route. */
function clusterKeywordsSync(keywords: KeywordRecord[]): KeywordCluster[] {
  const items = keywords.map(k => ({ id: k.id, keyword: k.keyword }));
  return clusterByTokenOverlap(items);
}

function buildSeedClusters(brand: BrandRecord, locations: LocationRecord[]): TopicClusterResult[] {
  const results: TopicClusterResult[] = [];

  results.push({
    id: seoId('cluster'),
    name: `About ${brand.name}`,
    health_status: 'seed',
    nodes: [{ id: seoId('node'), node_type: 'pillar', ref_id: null, label: `${brand.name} home`, status: 'MISSING' }],
  });

  if (brand.cuisine) {
    results.push({
      id: seoId('cluster'),
      name: `${brand.cuisine} Menu`,
      health_status: 'seed',
      nodes: [
        { id: seoId('node'), node_type: 'pillar', ref_id: null, label: `${brand.cuisine} menu`, status: 'MISSING' },
        { id: seoId('node'), node_type: 'menu_category', ref_id: null, label: 'menu:general', status: 'MISSING' },
      ],
    });
  }

  for (const loc of locations) {
    results.push({
      id: seoId('cluster'),
      name: `${loc.name} Location`,
      health_status: 'seed',
      nodes: [
        { id: seoId('node'), node_type: 'pillar', ref_id: null, label: `${loc.name} location page`, status: 'MISSING' },
        { id: seoId('node'), node_type: 'location', ref_id: null, label: `location:${loc.location_id}`, status: 'MISSING' },
      ],
    });
  }

  return results;
}

function persistClusters(brandId: string, clusters: TopicClusterResult[]): void {
  const db = getSeoDb();
  const now = nowIso();

  const existing = db.prepare('SELECT id FROM seo_topic_clusters WHERE brand_id = ?').all(brandId) as { id: string }[];
  const deleteNodes = db.prepare('DELETE FROM seo_cluster_nodes WHERE cluster_id = ?');
  const deleteCluster = db.prepare('DELETE FROM seo_topic_clusters WHERE id = ?');
  const tx = db.transaction(() => {
    for (const row of existing) {
      deleteNodes.run(row.id);
      deleteCluster.run(row.id);
    }

    const insertCluster = db.prepare(`
      INSERT INTO seo_topic_clusters (id, created_at, updated_at, brand_id, name, pillar_content_id, health_status, deleted_at)
      VALUES (@id, @created_at, @updated_at, @brand_id, @name, NULL, @health_status, NULL)
    `);
    const insertNode = db.prepare(`
      INSERT INTO seo_cluster_nodes (id, created_at, cluster_id, node_type, ref_id, label, status, link_status, ranking_status)
      VALUES (@id, @created_at, @cluster_id, @node_type, @ref_id, @label, @status, 'unknown', 'unknown')
    `);

    for (const cluster of clusters) {
      insertCluster.run({
        id: cluster.id, created_at: now, updated_at: now, brand_id: brandId,
        name: cluster.name, health_status: cluster.health_status,
      });
      for (const node of cluster.nodes) {
        insertNode.run({
          id: node.id, created_at: now, cluster_id: cluster.id,
          node_type: node.node_type, ref_id: node.ref_id, label: node.label, status: node.status,
        });
      }
    }
  });
  tx();
}

/**
 * Regenerate the full topic-cluster map for a brand. Idempotent: clears any
 * previously-generated clusters for the brand and rebuilds from current
 * seo_keywords/seo_site_pages/seo_content_items data (or a seed set if the
 * brand has no keywords yet).
 */
export function buildClusterMap(brandId: string): ClusterMapResult {
  const brand = getBrandById(brandId);
  if (!brand) throw new Error(`brand not found: ${brandId}`);

  const keywords = fetchKeywords(brandId);
  const clusters = keywords.length > 0
    ? buildDerivedClusters(brandId, keywords)
    : buildSeedClusters(brand, getActiveLocationsForBrand(brandId));

  persistClusters(brandId, clusters);

  return { brand_id: brandId, generated_at: nowIso(), clusters };
}

export function getClusterMap(brandId: string): ClusterMapResult {
  const db = getSeoDb();
  const clusterRows = db.prepare(
    'SELECT id, name, health_status FROM seo_topic_clusters WHERE brand_id = ? AND deleted_at IS NULL ORDER BY name ASC',
  ).all(brandId) as { id: string; name: string; health_status: string }[];

  const clusters: TopicClusterResult[] = clusterRows.map(row => {
    const nodes = db.prepare(
      'SELECT id, node_type, ref_id, label, status, link_status, ranking_status FROM seo_cluster_nodes WHERE cluster_id = ?',
    ).all(row.id) as ClusterNodeResult[];
    return {
      id: row.id,
      name: row.name,
      health_status: (row.health_status === 'seed' ? 'seed' : 'derived'),
      nodes,
    };
  });

  return { brand_id: brandId, generated_at: nowIso(), clusters };
}
