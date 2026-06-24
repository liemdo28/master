const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

let cachedToken = null;

function isConfigured() {
  return process.env.GOOGLE_SHEETS_ENABLED === 'true' && !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
}

function loadServiceAccount() {
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!file) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(serviceAccount.private_key, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.accessToken;
  }
  const serviceAccount = loadServiceAccount();
  const assertion = signJwt(serviceAccount);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  }).toString();

  const token = await postForm(new URL(serviceAccount.token_uri || 'https://oauth2.googleapis.com/token'), body);
  cachedToken = {
    accessToken: token.access_token,
    expiresAt: Date.now() + ((token.expires_in || 3600) * 1000),
  };
  return cachedToken.accessToken;
}

function postForm(url, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch (err) { reject(new Error(`Google auth returned non-JSON: ${err.message}`)); return; }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Google auth failed HTTP ${res.statusCode}: ${parsed.error_description || parsed.error || data}`));
          return;
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Google auth timeout')); });
    req.write(body);
    req.end();
  });
}

function clearTokenForTests() {
  cachedToken = null;
}

module.exports = { isConfigured, getAccessToken, clearTokenForTests };
