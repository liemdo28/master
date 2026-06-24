/**
 * Google Search Console Connector
 * Phase 3: Real googleapis SDK support with OAuth2/Service Account auth.
 * Pulls: clicks, impressions, CTR, average position, query, page, device, date
 */
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'reports', 'connectors');

function checkCredentials() {
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  const siteUrl = process.env.GSC_SITE_URL || 'sc-domain:bakudanramen.com';
  if (sa && fs.existsSync(sa)) return { configured: true, method: 'service_account', site_url: siteUrl };
  if (clientId && secret && refresh) return { configured: true, method: 'oauth2', site_url: siteUrl };
  return { configured: false, method: null, missing: getMissing() };
}

function getMissing() {
  const missing = [];
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID or GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
  if (!process.env.GOOGLE_REFRESH_TOKEN) missing.push('GOOGLE_REFRESH_TOKEN');
  return missing;
}

async function getAuthClient() {
  const creds = checkCredentials();
  if (!creds.configured) return null;

  try {
    const { google } = require('googleapis');
    if (creds.method === 'service_account') {
      const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      const auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
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

async function fetchGSC(opts = {}) {
  const creds = checkCredentials();
  if (!creds.configured) {
    return {
      status: 'missing_credentials',
      credentials_configured: false,
      records: 0,
      error: `GSC credentials not configured. Missing: ${creds.missing.join(', ')}`,
      setup_steps: [
        '1. Create a Google Cloud project',
        '2. Enable Search Console API',
        '3. Create OAuth2 credentials or Service Account',
        '4. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in SEO agent .env files',
        '5. Verify property sc-domain:bakudanramen.com in GSC',
      ],
      data: [],
    };
  }

  // Attempt real API call with googleapis
  try {
    const { google } = require('googleapis');
    const auth = await getAuthClient();
    if (auth && auth.error) throw new Error(auth.error);

    const searchconsole = google.searchconsole({ version: 'v1', auth });
    const siteUrl = process.env.GSC_SITE_URL || 'sc-domain:bakudanramen.com';

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);

    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: ['query', 'page', 'device', 'date'],
        rowLimit: 100,
      },
    });

    const rows = (response.data.rows || []).map(row => ({
      query: row.keys[0],
      page: row.keys[1],
      device: row.keys[2],
      date: row.keys[3],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));

    // Save raw payload
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const reportPath = path.join(REPORTS_DIR, `gsc-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      source: 'gsc',
      fetched_at: new Date().toISOString(),
      site_url: siteUrl,
      date_range: { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] },
      rows,
    }, null, 2));

    // Store to DB if available
    if (opts.db) {
      for (const row of rows) {
        opts.db.upsert('keywords', {
          id: `gsc:${row.query}:${row.page}:${row.date}`,
          source: 'gsc',
          fetched_at: new Date().toISOString(),
          ...row,
        }, 'id');
      }
    }

    return {
      status: 'success',
      credentials_configured: true,
      records: rows.length,
      raw_payload_path: reportPath,
      data: rows,
      error: null,
    };
  } catch (e) {
    // googleapis not installed or API error
    const isModuleError = e.code === 'MODULE_NOT_FOUND';
    return {
      status: isModuleError ? 'sdk_not_installed' : 'api_error',
      credentials_configured: true,
      records: 0,
      error: isModuleError
        ? 'googleapis package not installed. Run: npm install googleapis'
        : `GSC API error: ${e.message}`,
      setup_steps: isModuleError
        ? ['Run: cd SEO/shared && npm install googleapis']
        : ['Check API permissions and quota'],
      data: [],
      fields_available: ['clicks', 'impressions', 'ctr', 'position', 'query', 'page', 'device', 'date'],
    };
  }
}

module.exports = { fetchGSC, checkCredentials };
