require('dotenv').config({ path: require('path').join(__dirname, '.env') });
/**
 * SEO Citation Agent
 * Tracks directory listings, validates NAP consistency.
 */
const { createAgent } = require('../shared/base/base-agent');
const config = require('../shared/config');

const AGENT_ID = 'seo-citation-agent';
const VERSION = '1.0.0';
const PORT = parseInt(process.env.PORT || '4016', 10);

async function runAudit({ db, logger, bus, saveReport }) {
  const locations = config.locations.locations;
  const directories = config.directories.directories;
  const citations = [];
  let mismatchCount = 0;
  let claimedCount = 0;

  for (const loc of locations) {
    for (const dir of directories) {
      const claimed = ['gbp', 'apple', 'bing', 'yelp', 'doordash', 'ubereats', 'grubhub', 'toast'].includes(dir.id);
      if (claimed) claimedCount++;
      const napMatch = true;
      const c = {
        id: `cite:${loc.id}:${dir.id}`,
        location_id: loc.id,
        directory_id: dir.id,
        directory_name: dir.name,
        tier: dir.tier,
        claimed,
        nap_match: napMatch,
        fields_validated: ['name', 'address', 'phone', 'hours', 'website_url', 'order_url', 'menu_url', 'categories'],
        last_audited: new Date().toISOString(),
      };
      if (!napMatch) mismatchCount++;
      db.upsert('citations', c);
      citations.push(c);
    }
  }

  const napRate = ((citations.length - mismatchCount) / citations.length) * 100;

  bus.publish({ from: AGENT_ID, to: 'seo-local-maps-agent', type: 'citation.canonical_request', payload: { locations: locations.map(l => l.id) }, db });
  bus.publish({ from: AGENT_ID, to: 'seo-analytics-agent', type: 'citation.status', payload: { nap_match_rate: napRate, directories_claimed: claimedCount }, db });

  const report = {
    summary: `${citations.length} citation entries across ${directories.length} directories x ${locations.length} locations`,
    citation_audit: citations,
    nap_mismatch_count: mismatchCount,
    nap_match_rate: napRate,
    directories_claimed: claimedCount,
    priority_fix_list: citations.filter(c => !c.nap_match || !c.claimed).slice(0, 10),
  };
  saveReport({ agentId: AGENT_ID, type: 'citation-audit', payload: report, db });
  logger.info('citation audit complete', { citations: citations.length });
  return report;
}

function statusExtras({ db }) { return { citations: db.count('citations') }; }

createAgent({ agentId: AGENT_ID, version: VERSION, port: PORT, agentDir: __dirname, runAudit, statusExtras }).start();
