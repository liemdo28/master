#!/usr/bin/env node
/**
 * Test all 5 connectors to capture real status
 */
const path = require('path');
process.chdir(path.join(__dirname));
const { runAll, getStatus } = require('./shared/connectors');

(async () => {
  console.log('Starting all connectors...');
  const results = await runAll({});
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    results: Object.fromEntries(
      Object.entries(results).map(([k, v]) => [k, {
        status: v.status,
        credentials_configured: v.credentials_configured,
        records: v.records || 0,
        confirmed_listings: v.confirmed_listings,
        nap_consistent_count: v.nap_consistent_count,
        error: v.error,
        raw_payload_path: v.raw_payload_path,
      }])
    ),
    connector_status: getStatus(),
  }, null, 2));
})().catch(e => { console.error('CONNECTORS ERROR:', e.message); process.exit(1); });