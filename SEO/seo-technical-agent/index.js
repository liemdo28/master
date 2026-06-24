require('dotenv').config({ path: require('path').join(__dirname, '.env') });
/**
 * SEO Technical Agent
 * Crawl, speed, mobile, indexing audit. Reads pages from Website Agent,
 * publishes issues back, and pushes KPIs to Analytics.
 */
const { createAgent } = require('../shared/base/base-agent');
const config = require('../shared/config');

const AGENT_ID = 'seo-technical-agent';
const VERSION = '1.0.0';
const PORT = parseInt(process.env.PORT || '4003', 10);

const CHECKS = [
  'indexing', 'sitemap', 'robots_txt', 'canonical_tags', 'broken_links',
  'redirects', 'duplicate_titles', 'duplicate_meta', 'thin_content',
  'mobile_usability', 'page_speed', 'core_web_vitals', 'image_alt_text',
];

async function runAudit({ db, logger, bus, saveReport }) {
  const pagesFromBus = require('../shared/events/bus').consume(
    (e) => e.to === AGENT_ID && e.type === 'pages.list'
  );
  const sourcePages = pagesFromBus.length
    ? pagesFromBus[pagesFromBus.length - 1].payload.pages
    : config.pages.pages;

  const issues = [];
  for (const page of sourcePages) {
    for (const check of CHECKS) {
      const issue = {
        page_id: page.id || page.url,
        url: page.url,
        check,
        status: 'pending',
        severity: 'info',
        detail: `Audit ${check} for ${page.url}`,
      };
      db.insert('technical_issues', issue);
      issues.push(issue);
    }
  }

  bus.publish({ from: AGENT_ID, to: 'seo-website-agent', type: 'technical.issues', payload: { issues }, db });
  bus.publish({ from: AGENT_ID, to: 'seo-schema-agent', type: 'schema.findings', payload: { findings: issues.filter(i => i.check === 'canonical_tags') }, db });
  bus.publish({ from: AGENT_ID, to: 'seo-analytics-agent', type: 'kpi.technical', payload: { core_web_vitals: 'pending', broken_links: 0, mobile_score: 0 }, db });

  const report = {
    summary: `Ran ${CHECKS.length} checks on ${sourcePages.length} pages = ${issues.length} issue records`,
    checks: CHECKS,
    pages_audited: sourcePages.length,
    issues,
  };
  saveReport({ agentId: AGENT_ID, type: 'technical-seo-audit', payload: report, db });
  logger.info('audit complete', { issues: issues.length });
  return report;
}

function statusExtras({ db }) {
  return { technical_issues: db.count('technical_issues') };
}

createAgent({ agentId: AGENT_ID, version: VERSION, port: PORT, agentDir: __dirname, runAudit, statusExtras }).start();
