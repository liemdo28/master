/**
 * YoLink Auth — OAuth2 client_credentials token management
 */
const { makeLogger } = require('../../logger');
const log = makeLogger('yolink');

const TOKEN_URL = 'https://api.yosmart.com/open/yolink/token';
const TOKEN_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry

let cachedToken = null;
let tokenExpiresAt = 0;

// Optional: pull credentials from settings service (DB-first).
// Avoid hard require to keep this module safe to load standalone.
let _settings = null;
function getSettings() {
  if (_settings !== null) return _settings;
  try { _settings = require('./yolink-api-settings'); } catch (_) { _settings = false; }
  return _settings || null;
}

async function getCredentialsAsync() {
  const settings = getSettings();
  if (settings) {
    const id = await settings.getClientId();
    const sec = await settings.getClientSecret();
    if (id && sec) return { clientId: id, clientSecret: sec };
  }
  return getCredentials();
}

function getCredentials() {
  const clientId = process.env.YOLINK_CLIENT_ID;
  const clientSecret = process.env.YOLINK_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function isConfigured() {
  return !!getCredentials();
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - TOKEN_MARGIN_MS) {
    return cachedToken;
  }
  return refreshToken();
}

async function refreshToken() {
  let creds = null;
  try {
    creds = await getCredentialsAsync();
  } catch (_) {
    creds = null;
  }
  if (!creds) creds = getCredentials();
  if (!creds) throw new Error('YoLink credentials not configured');

  const timeout = parseInt(process.env.YOLINK_TIMEOUT_SECONDS || '20', 10) * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`YoLink auth failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in || 7200) * 1000;
    log.info('YoLink token refreshed', { expiresIn: data.expires_in });
    return cachedToken;
  } finally {
    clearTimeout(timer);
  }
}

function clearToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

module.exports = { isConfigured, getToken, refreshToken, clearToken, getCredentials };
