require('dotenv').config({ path: require('path').join(__dirname, '.env') });
/**
 * SEO Schema Agent
 * Generates and validates JSON-LD structured data for restaurants, locations,
 * menus, breadcrumbs, FAQs, and aggregate ratings.
 */
const { createAgent } = require('../shared/base/base-agent');
const config = require('../shared/config');

const AGENT_ID = 'seo-schema-agent';
const VERSION = '1.0.0';
const PORT = parseInt(process.env.PORT || '4014', 10);

function buildLocalBusinessSchema(loc) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: loc.name,
    address: { '@type': 'PostalAddress', streetAddress: loc.address },
    telephone: loc.phone,
    url: loc.website_url,
    menu: loc.menu_url,
    acceptsReservations: 'True',
    servesCuisine: loc.cuisine,
    priceRange: loc.price_range,
    geo: { '@type': 'GeoCoordinates', latitude: loc.geo.lat, longitude: loc.geo.lng },
    openingHours: loc.hours,
    potentialAction: {
      '@type': 'OrderAction',
      target: loc.order_url,
    },
    sameAs: [],
  };
}

function buildBreadcrumb(page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://bakudanramen.com/' },
      { '@type': 'ListItem', position: 2, name: page.type, item: page.url },
    ],
  };
}

function buildFAQ() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Do you offer vegetarian ramen?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, vegetarian ramen is available at all locations.' } },
      { '@type': 'Question', name: 'Do you take reservations?', acceptedAnswer: { '@type': 'Answer', text: 'Walk-ins welcome, online ordering available.' } },
    ],
  };
}

function validate(schema) {
  const issues = [];
  if (!schema['@context']) issues.push('missing @context');
  if (!schema['@type']) issues.push('missing @type');
  if (schema['@type'] === 'Restaurant' && !schema.name) issues.push('missing name');
  return { valid: issues.length === 0, issues };
}

async function runAudit({ db, logger, bus, saveReport }) {
  const locations = config.locations.locations;
  const generated = [];

  for (const loc of locations) {
    const schema = buildLocalBusinessSchema(loc);
    const validation = validate(schema);
    const item = {
      id: `schema:${loc.id}:restaurant`,
      location_id: loc.id,
      type: 'Restaurant',
      schema,
      validation,
    };
    db.upsert('schema_items', item);
    generated.push(item);
  }

  for (const page of config.pages.pages) {
    const bc = buildBreadcrumb(page);
    db.upsert('schema_items', { id: `schema:${page.id}:breadcrumb`, page_id: page.id, type: 'BreadcrumbList', schema: bc, validation: validate(bc) });
  }

  const faq = buildFAQ();
  db.upsert('schema_items', { id: 'schema:global:faq', type: 'FAQPage', schema: faq, validation: validate(faq) });

  bus.publish({ from: AGENT_ID, to: 'seo-website-agent', type: 'schema.implementation_notes', payload: { notes: generated.map(g => ({ location_id: g.location_id, place: 'inject in <head>' })) }, db });
  bus.publish({ from: AGENT_ID, to: 'seo-technical-agent', type: 'schema.validation', payload: { validation_results: generated.map(g => g.validation) }, db });

  const report = {
    summary: `Generated ${generated.length} restaurant schemas + ${config.pages.pages.length} breadcrumbs + 1 FAQ`,
    schema_items_count: db.count('schema_items'),
    validation_overview: generated.map(g => ({ location_id: g.location_id, valid: g.validation.valid, issues: g.validation.issues })),
  };
  saveReport({ agentId: AGENT_ID, type: 'schema-audit', payload: report, db });
  logger.info('schema audit complete', { count: generated.length });
  return report;
}

function statusExtras({ db }) { return { schema_items: db.count('schema_items') }; }

createAgent({ agentId: AGENT_ID, version: VERSION, port: PORT, agentDir: __dirname, runAudit, statusExtras }).start();
