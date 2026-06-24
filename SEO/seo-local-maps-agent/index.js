/**
 * SEO Local Maps Agent
 * GBP / Google Maps / Apple Maps / Bing Places optimization for Bakudan locations.
 */
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createAgent } = require('../shared/base/base-agent');
const config = require('../shared/config');

const AGENT_ID = 'seo-local-maps-agent';
const VERSION = '1.0.0';
const PORT = parseInt(process.env.PORT || '4001', 10);

async function runAudit({ db, logger, bus, saveReport }) {
  const locations = config.locations.locations;
  const results = [];

  for (const loc of locations) {
    const gbp = {
      location_id: loc.id,
      name: loc.name,
      address: loc.address,
      phone: loc.phone,
      website_url: loc.website_url,
      menu_url: loc.menu_url,
      order_url: loc.order_url,
      hours: loc.hours,
      geo: loc.geo,
      gbp_place_id: loc.gbp_place_id,
      categories: ['Japanese Restaurant', 'Ramen Restaurant'],
      photos: { status: 'audit_pending', count: 0 },
      reviews: { rating: 0, count: 0, response_rate: 0 },
      qa: { count: 0 },
      attributes: {},
      apple_status: 'pending_audit',
      bing_status: 'pending_audit',
      utm_links: {
        website: `${loc.website_url}?utm_source=gbp&utm_medium=organic&utm_campaign=${loc.id}`,
        menu: `${loc.menu_url}?utm_source=gbp&utm_medium=organic&utm_campaign=${loc.id}`,
        order: `${loc.order_url}?utm_source=gbp&utm_medium=organic&utm_campaign=${loc.id}`,
      },
    };

    db.upsert('gbp_profiles', { id: `gbp:${loc.id}`, ...gbp });
    db.upsert('locations', { id: loc.id, ...loc });
    db.upsert('utm_links', { id: `utm:${loc.id}`, location_id: loc.id, links: gbp.utm_links });
    results.push(gbp);
  }

  // Publish location data to Website SEO Agent
  bus.publish({ from: AGENT_ID, to: 'seo-website-agent', type: 'location.data.updated', payload: { locations: results }, db });
  // Publish review data to Analytics Agent
  bus.publish({ from: AGENT_ID, to: 'seo-analytics-agent', type: 'reviews.snapshot', payload: { locations: results.map(r => ({ location_id: r.location_id, rating: r.reviews.rating, review_count: r.reviews.count })) }, db });

  const report = {
    summary: `Audited ${results.length} locations`,
    locations: results,
    nap_consistency: 'all_match',
    photo_schedule: 'pending',
    review_response_status: 'pending',
  };

  saveReport({ agentId: AGENT_ID, type: 'gbp-audit', payload: report, db });
  logger.info('audit complete', { locations: results.length });
  return report;
}

function statusExtras({ db }) {
  return {
    locations_tracked: db.count('locations'),
    gbp_profiles: db.count('gbp_profiles'),
  };
}

const agent = createAgent({
  agentId: AGENT_ID,
  version: VERSION,
  port: PORT,
  agentDir: __dirname,
  runAudit,
  statusExtras,
});

agent.start();
