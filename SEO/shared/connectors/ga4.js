/**
 * Google Analytics 4 Connector
 * Phase 3: Real googleapis SDK support for Analytics Data API.
 * Pulls: organic traffic, landing pages, conversions/events, source/medium, UTM performance
 */
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'reports', 'connectors');

function checkCredentials() {
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  const propertyId = process.env.GA4_PROPERTY_ID;
  const hasCreds = !!((sa && fs.existsSync(sa)) || (clientId && secret && refresh));
  return { configured: hasCreds && !!propertyId, has_credentials: hasCreds, has_property_id: !!propertyId };
}

async function getAuthClient() {
  const creds = checkCredentials();
  if (!creds.configured) return null;

  try {
    const { google } = require('googleapis');
    const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (sa && fs.existsSync(sa)) {
      const auth = new google.auth.GoogleAuth({
        keyFile: sa,
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
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

async function fetchGA4(opts = {}) {
  const creds = checkCredentials();
  const missing = [];
  if (!creds.has_credentials) missing.push('GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!creds.has_property_id) missing.push('GA4_PROPERTY_ID');

  if (!creds.configured) {
    return {
      status: 'missing_credentials',
      credentials_configured: false,
      records: 0,
      error: `GA4 not configured. Missing: ${missing.join(', ')}`,
      setup_steps: [
        '1. Enable Google Analytics Data API in Cloud Console',
        '2. Set up OAuth2 or Service Account credentials',
        '3. Find GA4 Property ID (numeric, e.g. 123456789)',
        '4. Set GA4_PROPERTY_ID in .env',
        '5. Grant analytics read access to the service account or OAuth user',
      ],
      data: [],
      fields_available: ['organic_traffic', 'landing_pages', 'conversions', 'source_medium', 'utm_performance'],
    };
  }

  // Attempt real API call
  try {
    const { google } = require('googleapis');
    const auth = await getAuthClient();
    if (auth && auth.error) throw new Error(auth.error);
    const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });
    const rawPropertyId = process.env.GA4_PROPERTY_ID;
    const propertyName = rawPropertyId.startsWith('properties/')
      ? rawPropertyId
      : `properties/${rawPropertyId}`;

    // Organic traffic report
    const organicResponse = await analyticsdata.properties.runReport({
      property: propertyName,
      requestBody: {
        dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
        dimensions: [
          { name: 'sessionDefaultChannelGroup' },
          { name: 'landingPage' },
          { name: 'sessionSourceMedium' },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'conversions' },
          { name: 'bounceRate' },
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'sessionDefaultChannelGroup',
            stringFilter: { value: 'Organic Search' },
          },
        },
      },
    });

    const rows = (organicResponse.data.rows || []).map(row => ({
      channel: row.dimensionValues[0].value,
      landing_page: row.dimensionValues[1].value,
      source_medium: row.dimensionValues[2].value,
      sessions: parseInt(row.metricValues[0].value),
      users: parseInt(row.metricValues[1].value),
      conversions: parseInt(row.metricValues[2].value),
      bounce_rate: parseFloat(row.metricValues[3].value),
    }));

    // UTM performance report
    const utmResponse = await analyticsdata.properties.runReport({
      property: propertyName,
      requestBody: {
        dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
        dimensions: [
          { name: 'sessionCampaignName' },
          { name: 'sessionSourceMedium' },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'conversions' },
        ],
      },
    });

    const utmRows = (utmResponse.data.rows || []).map(row => ({
      campaign: row.dimensionValues[0].value,
      source_medium: row.dimensionValues[1].value,
      sessions: parseInt(row.metricValues[0].value),
      conversions: parseInt(row.metricValues[1].value),
    }));

    // Save raw payload
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const reportPath = path.join(REPORTS_DIR, `ga4-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      source: 'ga4',
      fetched_at: new Date().toISOString(),
      property_id: propertyName,
      organic_traffic: rows,
      utm_performance: utmRows,
    }, null, 2));

    // Store to DB
    if (opts.db) {
      opts.db.upsert('analytics_metrics', {
        id: `ga4:organic:${new Date().toISOString().split('T')[0]}`,
        source: 'ga4',
        fetched_at: new Date().toISOString(),
        type: 'organic_traffic',
        total_sessions: rows.reduce((sum, r) => sum + r.sessions, 0),
        total_users: rows.reduce((sum, r) => sum + r.users, 0),
        total_conversions: rows.reduce((sum, r) => sum + r.conversions, 0),
        landing_pages: rows.length,
        confidence: 'high',
      });
    }

    return {
      status: 'success',
      credentials_configured: true,
      records: rows.length + utmRows.length,
      raw_payload_path: reportPath,
      data: { organic_traffic: rows, utm_performance: utmRows },
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
        : `GA4 API error: ${e.message}`,
      setup_steps: isModuleError
        ? ['Run: cd SEO/shared && npm install googleapis']
        : ['Check Analytics Data API permissions and property ID'],
      data: [],
      fields_available: ['organic_traffic', 'landing_pages', 'conversions', 'source_medium', 'utm_performance'],
    };
  }
}

module.exports = { fetchGA4, checkCredentials };
