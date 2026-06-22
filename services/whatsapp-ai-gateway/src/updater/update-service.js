'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { makeLogger } = require('../logger');

const log = makeLogger('updater');

const VERSION_FILE = path.join(process.cwd(), 'version.json');
const UPDATE_LOG = path.join(
  process.env.LOG_DIR || path.join(process.cwd(), 'logs'),
  'updates.log'
);

// Manifest URL — set via env. MI_CORE_UPDATE_MANIFEST_URL is the packaged
// default so installed laptops can pull future source updates without copying.
const MANIFEST_URL = process.env.UPDATE_MANIFEST_URL || process.env.MI_CORE_UPDATE_MANIFEST_URL || '';

let _lastCheck = null;
let _lastResult = null;

function readVersionFile() {
  try {
    return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
  } catch (_) {
    return { version: '0.0.0', build: 'unknown', channel: 'stable' };
  }
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    if (!url.startsWith('https://')) {
      return reject(new Error('Only HTTPS manifest URLs are allowed'));
    }
    const mod = url.startsWith('https://') ? https : http;
    const req = mod.get(url, { timeout: 10000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} fetching manifest`));
      }
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Manifest fetch timed out')); });
  });
}

async function checkForUpdates() {
  _lastCheck = new Date().toISOString();
  const current = readVersionFile();

  if (!MANIFEST_URL) {
    _lastResult = { ok: false, error: 'UPDATE_MANIFEST_URL not configured', current };
    return _lastResult;
  }

  try {
    const body = await httpsGet(MANIFEST_URL);
    const manifest = JSON.parse(body);

    const updateAvailable = compareVersions(manifest.latestVersion, current.version) > 0;
    const channelMatch = !manifest.channel || manifest.channel === current.channel;
    const minOk = !manifest.minSupportedVersion ||
      compareVersions(current.version, manifest.minSupportedVersion) >= 0;

    _lastResult = {
      ok: true,
      current,
      manifest,
      updateAvailable: updateAvailable && channelMatch,
      channelMatch,
      minVersionOk: minOk,
      checkedAt: _lastCheck,
    };
  } catch (err) {
    log.error(`Update check failed: ${err.message}`);
    _lastResult = { ok: false, error: err.message, current, checkedAt: _lastCheck };
  }

  return _lastResult;
}

function getLastCheckResult() {
  return _lastResult || { ok: false, error: 'No check performed yet', current: readVersionFile() };
}

function appendUpdateLog(entry) {
  try {
    const logDir = path.dirname(UPDATE_LOG);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(UPDATE_LOG, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n');
  } catch (_) {}
}

function readUpdateLog() {
  try {
    return fs.readFileSync(UPDATE_LOG, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch (_) { return null; } })
      .filter(Boolean)
      .slice(-50);
  } catch (_) {
    return [];
  }
}

// Download a file to disk, streaming with progress
function downloadFile(url, destPath, expectedSha256) {
  return new Promise((resolve, reject) => {
    if (!url.startsWith('https://')) {
      return reject(new Error('Only HTTPS download URLs are allowed'));
    }
    const tmp = destPath + '.tmp';
    const file = fs.createWriteStream(tmp);
    const hash = crypto.createHash('sha256');
    let received = 0;

    function doGet(targetUrl) {
      https.get(targetUrl, { timeout: 300000 }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doGet(res.headers.location);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(tmp, () => {});
          return reject(new Error(`HTTP ${res.statusCode} downloading update`));
        }
        res.on('data', chunk => { hash.update(chunk); file.write(chunk); received += chunk.length; });
        res.on('end', () => {
          file.close(err => {
            if (err) return reject(err);
            const digest = hash.digest('hex');
            if (expectedSha256 && digest.toLowerCase() !== expectedSha256.toLowerCase()) {
              fs.unlink(tmp, () => {});
              return reject(new Error(`SHA256 mismatch: expected ${expectedSha256}, got ${digest}`));
            }
            fs.rename(tmp, destPath, renameErr => {
              if (renameErr) reject(renameErr);
              else resolve({ path: destPath, sha256: digest, size: received });
            });
          });
        });
        res.on('error', err => { file.close(); fs.unlink(tmp, () => {}); reject(err); });
      }).on('error', err => { file.close(); fs.unlink(tmp, () => {}); reject(err); });
    }

    doGet(url);
  });
}

// ── Background auto-check scheduler ──────────────────────────────────────────
const AUTO_CHECK_INTERVAL_MS = parseInt(process.env.UPDATE_CHECK_INTERVAL_HOURS || '6', 10) * 60 * 60 * 1000;
let _autoCheckTimer = null;

function startAutoCheck() {
  if (!MANIFEST_URL) return; // no URL configured — skip silently
  if (_autoCheckTimer) return; // already running

  // Check once shortly after startup (60s delay — let app fully boot first)
  setTimeout(async () => {
    log.info('Auto-update check (startup)');
    const result = await checkForUpdates().catch(err => {
      log.warn('Auto-update check failed', { error: err.message });
      return null;
    });
    if (result?.updateAvailable) {
      log.info(`Update available: v${result.manifest?.latestVersion} (current: v${result.current?.version})`);
      appendUpdateLog({ action: 'auto_check', from: result.current?.version, to: result.manifest?.latestVersion, status: 'update_available' });
    }
  }, 60_000);

  // Then repeat every N hours
  _autoCheckTimer = setInterval(async () => {
    log.info('Auto-update check (scheduled)');
    const result = await checkForUpdates().catch(() => null);
    if (result?.updateAvailable) {
      log.info(`Update available: v${result.manifest?.latestVersion}`);
      appendUpdateLog({ action: 'auto_check', from: result.current?.version, to: result.manifest?.latestVersion, status: 'update_available' });
    }
  }, AUTO_CHECK_INTERVAL_MS);
}

function stopAutoCheck() {
  if (_autoCheckTimer) { clearInterval(_autoCheckTimer); _autoCheckTimer = null; }
}

module.exports = {
  checkForUpdates,
  getLastCheckResult,
  readVersionFile,
  downloadFile,
  appendUpdateLog,
  readUpdateLog,
  startAutoCheck,
  stopAutoCheck,
};
