#!/usr/bin/env node
/**
 * Quick test: run the citation scanner
 */
const path = require('path');
process.chdir(path.join(__dirname));
const c = require('./shared/connectors/citation-checker');

(async () => {
  console.log('Starting citation scan...');
  const result = await c.scanCitations({});
  console.log(JSON.stringify({
    status: result.status,
    records: result.records,
    confirmed_listings: result.confirmed_listings,
    unconfirmed: result.unconfirmed,
    nap_consistent_count: result.nap_consistent_count,
    nap_inconsistent_count: result.nap_inconsistent_count,
    credentials_configured: result.credentials_configured,
    raw_payload_path: result.raw_payload_path,
    citations: (result.data || []).map(c => ({
      id: c.id,
      directory: c.directory,
      status_code: c.status_code,
      listing_status: c.listing_status,
      brand_found: c.brand_found,
      nap_consistent: c.nap_validation ? c.nap_validation.nap_consistent : false,
      fields_validated: c.nap_validation ? c.nap_validation.fields_validated : 0,
      error: c.error,
    })),
  }, null, 2));
})().catch(e => { console.error('CITATION ERROR:', e.message); process.exit(1); });