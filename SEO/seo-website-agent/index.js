const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createAgent } = require('../shared/base/base-agent');
const config = require('../shared/config');

const AGENT_ID = 'seo-website-agent';
const VERSION = '1.0.0';
const PORT = parseInt(process.env.PORT || '4002', 10);

async function runAudit({ db, logger, bus, saveReport }) {
  const pages = config.pages.pages;
  const keywords = config.keywords;
  const results = [];

  for (const page of pages) {
    const entry = {
      id: page.id,
      url: page.url,
      type: page.type,
      title_tag: page.title_tag || `Bakudan Ramen | Authentic Japanese Ramen in San Antonio`,
      meta_description: page.meta_description || `Bakudan Ramen serves authentic Japanese ramen in San Antonio with locations in Bandera, Stone Oak, and The Rim. Slow-simmered broths, fresh noodles, bold flavors.`,
      h1: page.h1 || `Bakudan Ramen`,
      h2_structure: [],
      internal_links: [],
      target_keyword: page.target_keyword || null,
      score: 0,
      issues: [],
    };
    db.upsert('pages', entry);
    results.push(entry);
  }

  // Build keyword map
  const keywordMap = keywords.primary_keywords.map((kw, i) => ({
    keyword: kw,
    assigned_page: pages.find((p) => p.target_keyword === kw)?.url || null,
    priority: i + 1,
  }));
  for (const km of keywordMap) {
    db.upsert('keywords', { id: `kw:${km.keyword}`, ...km });
  }

  // Publish pages to schema + technical agents
  bus.publish({ from: AGENT_ID, to: 'seo-schema-agent', type: 'pages.list', payload: { pages: results }, db });
  bus.publish({ from: AGENT_ID, to: 'seo-technical-agent', type: 'pages.list', payload: { pages: results }, db });
  // Publish keyword map to content agent
  bus.publish({ from: AGENT_ID, to: 'seo-content-agent', type: 'keyword.map', payload: { keyword_map: keywordMap }, db });

  const report = {
    summary: `Audited ${results.length} pages, mapped ${keywordMap.length} keywords`,
    pages: results,
    keyword_map: keywordMap,
    internal_linking_plan: 'pending',
  };

  saveReport({ agentId: AGENT_ID, type: 'website-seo-audit', payload: report, db });
  logger.info('audit complete', { pages: results.length });
  return report;
}

function statusExtras({ db }) {
  return {
    pages_tracked: db.count('pages'),
    keywords_mapped: db.count('keywords'),
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
