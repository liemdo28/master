require('dotenv').config({ path: require('path').join(__dirname, '.env') });
/**
 * SEO Analytics Agent
 * Aggregates data from all other agents, builds weekly KPI report,
 * pushes dashboard payload to Mi-Core.
 */
const { createAgent } = require('../shared/base/base-agent');
const config = require('../shared/config');

const AGENT_ID = 'seo-analytics-agent';
const VERSION = '1.0.0';
const PORT = parseInt(process.env.PORT || '4007', 10);

async function runAudit({ db, logger, bus, mi, saveReport }) {
  // Collect cross-agent state
  const locations = db.all('locations');
  const gbp = db.all('gbp_profiles');
  const pages = db.all('pages');
  const keywords = db.all('keywords');
  const techIssues = db.all('technical_issues');
  const citations = db.all('citations');
  const briefs = db.all('content_briefs');
  const reviews = db.all('reviews');

  // Snapshot ranking placeholders (real impl reads GSC/SerpAPI; here we generate scaffold rows)
  for (const k of keywords) {
    db.insert('ranking_snapshots', {
      keyword: k.keyword,
      position: null,
      impressions: null,
      clicks: null,
      ctr: null,
      url: k.assigned_page,
    });
  }

  const metrics = {
    locations_count: locations.length,
    gbp_profiles: gbp.length,
    pages_audited: pages.length,
    keywords_tracked: keywords.length,
    technical_issues: techIssues.length,
    citations_tracked: citations.length,
    content_briefs: briefs.length,
    reviews_tracked: reviews.length,
  };
  db.insert('analytics_metrics', { snapshot: 'weekly', metrics });

  // Opportunity surfacing
  const opportunities = {
    high_impressions_low_ctr_pages: [],
    keywords_pos_4_to_15: [],
    weak_map_locations: [],
  };

  const dashboardPayload = {
    weekly_kpis: metrics,
    rankings: db.all('ranking_snapshots').slice(-50),
    opportunities,
    generated_at: new Date().toISOString(),
  };

  // Push dashboard data to Mi
  await mi.pushDashboard(dashboardPayload);
  await mi.pushReport({ type: 'weekly_kpi', payload: dashboardPayload });

  bus.publish({ from: AGENT_ID, to: 'mi-core', type: 'dashboard.payload', payload: dashboardPayload, db });

  const report = {
    summary: `Weekly KPI snapshot - ${metrics.pages_audited} pages, ${metrics.keywords_tracked} keywords, ${metrics.technical_issues} technical issues`,
    metrics,
    opportunities,
    dashboard_payload: dashboardPayload,
  };
  saveReport({ agentId: AGENT_ID, type: 'weekly-kpi', payload: report, db });
  logger.info('analytics complete', metrics);
  return report;
}

function statusExtras({ db }) {
  return {
    metrics_snapshots: db.count('analytics_metrics'),
    ranking_snapshots: db.count('ranking_snapshots'),
  };
}

createAgent({ agentId: AGENT_ID, version: VERSION, port: PORT, agentDir: __dirname, runAudit, statusExtras }).start();
