require('dotenv').config({ path: require('path').join(__dirname, '.env') });
/**
 * SEO Content Agent
 * Manages topical authority, content briefs, calendar, publish tracking.
 */
const { createAgent } = require('../shared/base/base-agent');
const config = require('../shared/config');

const AGENT_ID = 'seo-content-agent';
const VERSION = '1.0.0';
const PORT = parseInt(process.env.PORT || '4005', 10);

const INITIAL_TOPICS = [
  { topic: 'Best Ramen in San Antonio', target_keyword: 'Best Ramen in San Antonio', intent: 'commercial' },
  { topic: 'Tonkotsu vs Miso Ramen', target_keyword: 'Tonkotsu vs Miso Ramen', intent: 'informational' },
  { topic: 'Ramen Near The Rim and La Cantera', target_keyword: 'Ramen Near The Rim', intent: 'commercial' },
  { topic: 'Japanese Food Near Stone Oak', target_keyword: 'Japanese Food in San Antonio', intent: 'commercial' },
  { topic: 'Ramen Near UTSA', target_keyword: 'Ramen Near UTSA', intent: 'commercial' },
  { topic: 'Vegetarian Ramen Options', target_keyword: 'Vegetarian Ramen in San Antonio', intent: 'informational' },
  { topic: 'Happy Hour with Ramen and Cocktails', target_keyword: 'Happy Hour Ramen San Antonio', intent: 'commercial' },
  { topic: 'Garlic Tonkotsu Ramen', target_keyword: 'Garlic Tonkotsu Ramen', intent: 'informational' },
  { topic: 'Spicy Ramen in San Antonio', target_keyword: 'Spicy Ramen in San Antonio', intent: 'commercial' },
];

async function runAudit({ db, logger, bus, saveReport }) {
  // Read keyword map from website agent
  const keywordEvents = require('../shared/events/bus').consume(
    (e) => e.to === AGENT_ID && e.type === 'keyword.map'
  );
  const keywordMap = keywordEvents.length ? keywordEvents[keywordEvents.length - 1].payload.keyword_map : [];

  const briefs = [];
  for (const t of INITIAL_TOPICS) {
    const brief = {
      id: `brief:${t.target_keyword.toLowerCase().replace(/\s+/g, '-')}`,
      topic: t.topic,
      target_keyword: t.target_keyword,
      intent: t.intent,
      outline: ['Intro', 'Why this matters', 'Bakudan picks', 'Locations', 'CTA'],
      cta: 'Order online or visit a Bakudan location.',
      internal_links: [],
      publish_status: 'planned',
      update_status: 'pending',
      assigned_keyword_priority: keywordMap.find(k => k.keyword === t.target_keyword)?.priority || null,
    };
    db.upsert('content_briefs', brief);
    briefs.push(brief);
  }

  bus.publish({ from: AGENT_ID, to: 'seo-website-agent', type: 'content.published', payload: { drafts: briefs.map(b => ({ topic: b.topic, status: b.publish_status })) }, db });
  bus.publish({ from: AGENT_ID, to: 'seo-analytics-agent', type: 'content.performance_request', payload: { topics: briefs.map(b => b.topic) }, db });

  const report = {
    summary: `${briefs.length} content briefs created`,
    content_calendar: briefs.map(b => ({ topic: b.topic, status: b.publish_status })),
    briefs,
    publish_tracker: 'pending',
    internal_linking_tracker: 'pending',
  };
  saveReport({ agentId: AGENT_ID, type: 'content-plan', payload: report, db });
  logger.info('content plan ready', { count: briefs.length });
  return report;
}

function statusExtras({ db }) { return { content_briefs: db.count('content_briefs') }; }

createAgent({ agentId: AGENT_ID, version: VERSION, port: PORT, agentDir: __dirname, runAudit, statusExtras }).start();
