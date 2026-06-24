#!/usr/bin/env node
/**
 * Validates Google API credentials for SEO connectors.
 * Run: node SEO/shared/base/validate-google-credentials.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const results = [];
let allValid = true;

function check(name, configured, detail) {
  const status = configured ? 'PASS' : 'MISSING';
  if (!configured) allValid = false;
  results.push({ name, status, detail });
  console.log(`[${status}] ${name}: ${detail}`);
}

const gscSA = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const gscClient = process.env.GOOGLE_CLIENT_ID;
const gscSecret = process.env.GOOGLE_CLIENT_SECRET;
const gscRefresh = process.env.GOOGLE_REFRESH_TOKEN;
const gscSite = process.env.GSC_SITE_URL || 'sc-domain:bakudanramen.com';
const ga4Prop = process.env.GA4_PROPERTY_ID;

const googleCreds = (gscSA && fs.existsSync(gscSA)) || (gscClient && gscSecret && gscRefresh);
check('GSC Credentials', googleCreds, googleCreds ? 'Configured' : 'Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN');
check('GSC Site URL', !!gscSite, gscSite);
check('GBP Credentials', googleCreds, googleCreds ? 'Configured (uses same Google auth)' : 'Missing Google credentials');
check('GA4 Property ID', !!ga4Prop, ga4Prop || 'Not set');
check('GA4 Ready', googleCreds && !!ga4Prop, googleCreds && ga4Prop ? 'Ready' : 'Need Google creds + GA4_PROPERTY_ID');

console.log('\n--- Summary ---');
console.log(`All configured: ${allValid}`);
if (!allValid) {
  console.log('Set missing credentials in .env files (see SEO/GOOGLE_API_CREDENTIALS_SETUP.md)');
}
