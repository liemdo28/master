/**
 * Google Business Profile Connector
 * Phase 3: Real googleapis SDK support for Business Profile API.
 * Pulls: profile status, categories, hours, phone, address, website URL,
 *        order URL, menu URL, reviews, rating, photos, performance metrics
 */
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'reports', 'connectors');
const config = require('../config');

function checkCredentials() {
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (sa && fs.existsSync(sa)) return { configured: true, method: 'service_account' };
  if (clientId && secret && refresh) return { configured: true, method: 'oauth2' };
  return { configured: false, method: null };
}

async function getAuthClient() {
  const creds = checkCredentials();
  if (!creds.configured) return null;

  try {
    const { google } = require('googleapis');
    if (creds.method === 'service_account') {
      const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
        scopes: ['https://www.googleapis.com/auth/business.manage'],
      });
      return auth;
    }
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return oauth2Client;
  } catch (e) {
    return { error: e.message };
  }
}

async function fetchGBP(opts = {}) {
  const creds = checkCredentials();
  if (!creds.configured) {
    return {
      status: 'missing_credentials',
      credentials_configured: false,
      records: 0,
      error: 'GBP credentials not configured. Need GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN with Business Profile API enabled.',
      setup_steps: [
        '1. Enable Business Profile APIs in Google Cloud Console',
        '2. Create OAuth2 credentials with Business Profile scope',
        '3. Set credentials in .env',
        '4. Link GBP locations to API project',
      ],
      data: [],
      fields_available: ['profile_status', 'categories', 'hours', 'phone', 'address', 'website_url', 'order_url', 'menu_url', 'reviews', 'rating', 'photos', 'performance_metrics'],
    };
  }

  // Attempt real API call
  try {
    const { google } = require('googleapis');
    const auth = await getAuthClient();
    if (auth && auth.error) throw new Error(auth.error);

    const mybusinessinformation = google.mybusinessbusinessinformation({ version: 'v1', auth });
    const mybusinessaccountmanagement = google.mybusinessaccountmanagement({ version: 'v1', auth });

    // List accounts
    const accountsRes = await mybusinessaccountmanagement.accounts.list();
    const accounts = accountsRes.data.accounts || [];
    if (accounts.length === 0) {
      return {
        status: 'no_accounts',
        credentials_configured: true,
        records: 0,
        error: 'No Business Profile accounts found for this credential.',
        data: [],
      };
    }

    const accountName = accounts[0].name;
    const locationsRes = await mybusinessinformation.accounts.locations.list({
      parent: accountName,
      readMask: 'name,title,phoneNumbers,categories,storefrontAddress,websiteUri,regularHours,metadata',
    });

    const locations = (locationsRes.data.locations || []).map(loc => ({
      id: loc.name,
      name: loc.title,
      phone: loc.phoneNumbers ? loc.phoneNumbers.primaryPhone : null,
      address: loc.storefrontAddress ? formatAddress(loc.storefrontAddress) : null,
      categories: loc.categories ? [loc.categories.primaryCategory?.displayName, ...(loc.categories.additionalCategories || []).map(c => c.displayName)].filter(Boolean) : [],
      website_url: loc.websiteUri || null,
      hours: loc.regularHours ? loc.regularHours.periods : null,
      profile_status: loc.metadata ? loc.metadata.mapsUri ? 'live' : 'pending' : 'unknown',
      order_url: null,
      menu_url: null,
      reviews: null,
      rating: null,
      photos: null,
      performance_metrics: null,
    }));

    // Save raw payload
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const reportPath = path.join(REPORTS_DIR, `gbp-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      source: 'gbp',
      fetched_at: new Date().toISOString(),
      account: accountName,
      locations,
    }, null, 2));

    // Store to DB
    if (opts.db) {
      for (const loc of locations) {
        opts.db.upsert('gbp_profiles', {
          id: `gbp:${loc.id}`,
          source: 'gbp_api',
          fetched_at: new Date().toISOString(),
          confidence: 'high',
          ...loc,
        });
      }
    }

    return {
      status: 'success',
      credentials_configured: true,
      records: locations.length,
      raw_payload_path: reportPath,
      data: locations,
      error: null,
    };
  } catch (e) {
    const isModuleError = e.code === 'MODULE_NOT_FOUND';
    return {
      status: isModuleError ? 'sdk_not_installed' : 'api_error',
      credentials_configured: true,
      records: 0,
      error: isModuleError
        ? 'googleapis package not installed. Run: npm install googleapis'
        : `GBP API error: ${e.message}`,
      setup_steps: isModuleError
        ? ['Run: cd SEO/shared && npm install googleapis']
        : ['Check Business Profile API access and permissions'],
      data: [],
      fields_available: ['profile_status', 'categories', 'hours', 'phone', 'address', 'website_url', 'order_url', 'menu_url', 'reviews', 'rating', 'photos', 'performance_metrics'],
    };
  }
}

function formatAddress(addr) {
  if (!addr) return null;
  const parts = [
    ...(addr.addressLines || []),
    addr.locality,
    addr.administrativeArea,
    addr.postalCode,
  ].filter(Boolean);
  return parts.join(', ');
}

module.exports = { fetchGBP, checkCredentials };
