/**
 * SEO Connectors Registry
 * Manages all data connectors: crawler, GSC, GBP, GA4, citation checker.
 */
const { crawl } = require('./crawler');
const { fetchGSC } = require('./gsc');
const { fetchGBP } = require('./gbp');
const { fetchGA4 } = require('./ga4');
const { scanCitations } = require('./citation-checker');

const CONNECTORS = [
  { id: 'crawler', name: 'Website Crawler', run: crawl },
  { id: 'gsc', name: 'Google Search Console', run: fetchGSC },
  { id: 'gbp', name: 'Google Business Profile', run: fetchGBP },
  { id: 'ga4', name: 'Google Analytics 4', run: fetchGA4 },
  { id: 'citation_scan', name: 'Citation Checker', run: scanCitations },
];

const connectorState = {};
for (const c of CONNECTORS) {
  connectorState[c.id] = {
    id: c.id,
    name: c.name,
    status: 'idle',
    last_success: null,
    last_error: null,
    last_run: null,
    records_fetched: 0,
    credentials_configured: false,
  };
}

function getStatus() {
  return Object.values(connectorState);
}

function getLatest() {
  return Object.values(connectorState).map(c => ({
    id: c.id,
    name: c.name,
    last_success: c.last_success,
    last_error: c.last_error,
    records_fetched: c.records_fetched,
  }));
}

async function runAll(opts = {}) {
  const results = {};
  for (const c of CONNECTORS) {
    try {
      connectorState[c.id].status = 'running';
      connectorState[c.id].last_run = new Date().toISOString();
      const result = await c.run(opts);
      connectorState[c.id].status = result.status || 'success';
      connectorState[c.id].last_success = result.status === 'success' ? new Date().toISOString() : connectorState[c.id].last_success;
      connectorState[c.id].last_error = result.error || null;
      connectorState[c.id].records_fetched = result.records || 0;
      connectorState[c.id].credentials_configured = result.credentials_configured !== false;
      results[c.id] = result;
    } catch (e) {
      connectorState[c.id].status = 'error';
      connectorState[c.id].last_error = e.message;
      results[c.id] = { status: 'error', error: e.message };
    }
  }
  return results;
}

async function runOne(connectorId, opts = {}) {
  const c = CONNECTORS.find(x => x.id === connectorId);
  if (!c) return { status: 'error', error: `Unknown connector: ${connectorId}` };
  try {
    connectorState[c.id].status = 'running';
    connectorState[c.id].last_run = new Date().toISOString();
    const result = await c.run(opts);
    connectorState[c.id].status = result.status || 'success';
    connectorState[c.id].last_success = result.status === 'success' ? new Date().toISOString() : connectorState[c.id].last_success;
    connectorState[c.id].last_error = result.error || null;
    connectorState[c.id].records_fetched = result.records || 0;
    connectorState[c.id].credentials_configured = result.credentials_configured !== false;
    return result;
  } catch (e) {
    connectorState[c.id].status = 'error';
    connectorState[c.id].last_error = e.message;
    return { status: 'error', error: e.message };
  }
}

module.exports = { CONNECTORS, getStatus, getLatest, runAll, runOne, connectorState };
