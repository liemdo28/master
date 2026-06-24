#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..', '..');
const mapPath = path.join(root, 'SEO', 'shared', 'config', 'credentials-map.json');
const brandArg = (process.argv.find(a => a.startsWith('--brand=')) || '--brand=all').split('=')[1];
const cfg = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const brands = cfg.brands || {};
const profiles = cfg.credential_profiles || {};
const targets = brandArg === 'all' ? Object.keys(brands) : [brandArg];
const results = {};
console.log('=== Google Credential Readiness ===');
for (const bid of targets) {
  const b = brands[bid];
  if (!b) { console.log(bid + ': not_found'); continue; }
  results[bid] = {};
  for (const c of ['gsc', 'ga4', 'gbp']) {
    const conn = b[c] || {};
    const prof = conn.credentials_profile || '';
    const inactive = conn.status === 'not_applicable';
    let status = 'configured';
    const missing = [];
    if (!inactive && !prof) { status = 'needs_config'; missing.push('no_profile'); }
    else if (!inactive) {
      const env = profiles[prof]?.env_var || prof.toUpperCase() + '_CREDS';
      if (!process.env[env]) { status = 'missing_credentials'; missing.push(env); }
    }
    if (c === 'gsc' && !inactive && !conn.site_url) { status = 'needs_config'; missing.push('no_site_url'); }
    if (c === 'ga4' && !inactive && !conn.property_id) { if (status === 'configured') status = 'needs_config'; missing.push('no_property_id'); }
    if (c === 'gbp' && !inactive && !conn.account_id) { if (status === 'configured') status = 'needs_config'; missing.push('no_account_id'); }
    results[bid][c] = { status, missing };
    console.log(bid + '.' + c + ': ' + status + (missing.length ? ' [' + missing.join(',') + ']' : ''));
  }
}
console.log('\nResults: ' + JSON.stringify(results));
