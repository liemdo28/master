/**
 * Inter-agent contracts. Each contract describes a typed message with a
 * source agent, target agent, event name, and shape. Contracts are documented
 * here in code AND in SEO_AGENT_CONTRACTS.md.
 */
const CONTRACTS = {
  'local-maps -> website': {
    event: 'location.data.updated',
    source: 'seo-local-maps-agent',
    target: 'seo-website-agent',
    fields: ['location_id', 'name', 'address', 'phone', 'website_url', 'menu_url', 'order_url', 'hours'],
  },
  'local-maps -> analytics': {
    event: 'reviews.snapshot',
    source: 'seo-local-maps-agent',
    target: 'seo-analytics-agent',
    fields: ['location_id', 'rating', 'review_count', 'new_reviews'],
  },
  'website -> schema': {
    event: 'pages.list',
    source: 'seo-website-agent',
    target: 'seo-schema-agent',
    fields: ['pages[]'],
  },
  'website -> technical': {
    event: 'pages.list',
    source: 'seo-website-agent',
    target: 'seo-technical-agent',
    fields: ['pages[]'],
  },
  'website -> content': {
    event: 'keyword.map',
    source: 'seo-website-agent',
    target: 'seo-content-agent',
    fields: ['keyword_map[]'],
  },
  'technical -> website': {
    event: 'technical.issues',
    source: 'seo-technical-agent',
    target: 'seo-website-agent',
    fields: ['issues[]'],
  },
  'technical -> schema': {
    event: 'schema.findings',
    source: 'seo-technical-agent',
    target: 'seo-schema-agent',
    fields: ['findings[]'],
  },
  'technical -> analytics': {
    event: 'kpi.technical',
    source: 'seo-technical-agent',
    target: 'seo-analytics-agent',
    fields: ['core_web_vitals', 'broken_links', 'mobile_score'],
  },
  'schema -> website': {
    event: 'schema.implementation_notes',
    source: 'seo-schema-agent',
    target: 'seo-website-agent',
    fields: ['notes[]'],
  },
  'schema -> technical': {
    event: 'schema.validation',
    source: 'seo-schema-agent',
    target: 'seo-technical-agent',
    fields: ['validation_results[]'],
  },
  'content -> website': {
    event: 'content.published',
    source: 'seo-content-agent',
    target: 'seo-website-agent',
    fields: ['url', 'title', 'target_keyword'],
  },
  'content -> analytics': {
    event: 'content.performance_request',
    source: 'seo-content-agent',
    target: 'seo-analytics-agent',
    fields: ['urls[]'],
  },
  'citation -> local-maps': {
    event: 'citation.canonical_request',
    source: 'seo-citation-agent',
    target: 'seo-local-maps-agent',
    fields: ['location_id'],
  },
  'citation -> analytics': {
    event: 'citation.status',
    source: 'seo-citation-agent',
    target: 'seo-analytics-agent',
    fields: ['nap_match_rate', 'directories_claimed'],
  },
  'analytics -> mi': {
    event: 'dashboard.payload',
    source: 'seo-analytics-agent',
    target: 'mi-core',
    fields: ['weekly_kpis', 'rankings', 'opportunities'],
  },
};

module.exports = { CONTRACTS };
