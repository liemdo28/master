#!/usr/bin/env node
/**
 * Validates Google API credentials for SEO connectors.
 * Run: node SEO/shared/base/validate-google-credentials.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const results = [];
let allValid = true;

function check(name, configured, detail) {
  const status = configured ? 'PASS' : 'MISSING';
  if (!configured) allValid = false;
  results.push({ name, status, detail });
  console.log(`[${status}] ${name}: ${detail}`);
}

// GSC
const gscSA = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const gscClient = process.env.GOOGLE_CLIENT_ID;
const gscSecret = process.env.GOOGLE_CLIENT_SECRET;
const gscRefresh = process.env.GOOGLE_REFRESH_TOKEN;
const gscSite = process.env.GSC_SITE_URL || 'sc-domain:bakudanramen.com';
const gscCreds = (gscSA && fs.existsSync(gscSA)) || (gscClient && gscSecret && gscRefresh);
check('GSC Credentials', gscCreds, gscCreds ? 'Configured' : 'Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN');
check('GSC Site URL', !!gscSite, gscSite);

// GBP
const gbpCreds = (gscSA && fs.existsSync(gscSA)) || (gscClient && gscSecret && gscRefresh);
check('GBP Credentials', gbpCreds, gbpCreds ? 'Configured (uses same Google auth)' : 'Missing Google credentials');

// GA4
const ga4Prop = process.env.GA4_PROPERTY_ID;
const ga4Creds = gbpCreds && !!ga4Prop;
check('GA4 Credentials', ga4Creds, ga4Creds ? 'Configured' : (gbpCreds ? 'Missing GA4_PROPERTY_ID' : 'Missing Google credentials'));
check('GA4 Property ID', !!ga4Prop, ga4Prop || 'Not set');

console.log('\n--- Summary ---');
console.log(`All configured: ${allValid}`);
if (!allValid) {
  console.log('Set missing credentials in .env files (see SEO/GOOGLE_API_CREDENTIALS_SETUP.md)');
}
