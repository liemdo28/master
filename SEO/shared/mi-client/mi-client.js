/**
 * Mi-Core HTTP client. Uses native http/https - no extra deps required.
 * - registers agent
 * - pushes health/status/report
 * - polls for tasks/config
 * Falls back to local-only mode if MI_CORE_URL is empty (logs the attempt).
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');

class MiClient {
  constructor({ baseUrl, apiKey, agentId, db, logger }) {
    this.baseUrl = baseUrl || '';
    this.apiKey = apiKey || '';
    this.agentId = agentId;
    this.db = db;
    this.logger = logger;
  }

  enabled() { return !!this.baseUrl; }

  _request(method, path, body) {
    return new Promise((resolve) => {
      if (!this.enabled()) {
        this._logSync(method, path, body, { skipped: true, reason: 'MI_CORE_URL not set' });
        return resolve({ ok: false, skipped: true });
      }
      let url;
      try { url = new URL(this.baseUrl.replace(/\/$/, '') + path); }
      catch (e) {
        this._logSync(method, path, body, { error: e.message });
        return resolve({ ok: false, error: e.message });
      }
      const lib = url.protocol === 'https:' ? https : http;
      const data = body ? JSON.stringify(body) : null;
      const opts = {
        method,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'X-Agent-Id': this.agentId,
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
        timeout: 5000,
      };
      const req = lib.request(opts, (res) => {
        let chunks = '';
        res.on('data', (d) => (chunks += d));
        res.on('end', () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          this._logSync(method, path, body, { status: res.statusCode, ok });
          resolve({ ok, status: res.statusCode, body: chunks });
        });
      });
      req.on('error', (e) => {
        this._logSync(method, path, body, { error: e.message });
        resolve({ ok: false, error: e.message });
      });
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
      if (data) req.write(data);
      req.end();
    });
  }

  _logSync(method, path, body, result) {
    try {
      if (this.db) {
        this.db.insert('mi_sync_logs', {
          agent: this.agentId, method, path, ok: !!result.ok, result,
        });
      }
      if (this.logger) this.logger.debug('mi sync', { method, path, result });
    } catch (_) { /* ignore */ }
  }

  register(meta)        { return this._request('POST', '/api/seo/agents/register', { agent: this.agentId, ...meta }); }
  pushHealth(payload)   { return this._request('POST', `/api/seo/agents/${this.agentId}/health`, payload); }
  pushStatus(payload)   { return this._request('POST', `/api/seo/agents/${this.agentId}/status`, payload); }
  pushReport(payload)   { return this._request('POST', `/api/seo/agents/${this.agentId}/reports`, payload); }
  pushDashboard(payload){ return this._request('POST', `/api/seo/dashboard/${this.agentId}`, payload); }
  pullTasks()           { return this._request('GET',  `/api/seo/agents/${this.agentId}/tasks`); }
  pullConfig()          { return this._request('GET',  `/api/seo/agents/${this.agentId}/config`); }
}

module.exports = { MiClient };
