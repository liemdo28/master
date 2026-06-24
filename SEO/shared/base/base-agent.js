/**
 * Base SEO Agent factory.
 * Builds an HTTP server with all required endpoints, wires the shared db,
 * logger, reports, mi-client, and event bus. Each agent passes a `runAudit`
 * function and a `context` mapper for `/status` extras.
 */
const http = require('http');
const path = require('path');

const config = require('../config');
const { getDatabase } = require('../database');
const { makeLogger } = require('../logs/logger');
const { saveReport, latestReport } = require('../reports/reports');
const { MiClient } = require('../mi-client/mi-client');
const bus = require('../events/bus');
const queue = require('../queue/queue');

function loadAgentEnv(agentDir) {
  try {
    const dotenv = require('dotenv');
    dotenv.config({ path: path.join(agentDir, '.env') });
  } catch (_) { /* dotenv may be missing - rely on real env */ }
}

function readBody(req) {
  return new Promise((resolve) => {
    let chunks = '';
    req.on('data', (d) => (chunks += d));
    req.on('end', () => {
      try { resolve(chunks ? JSON.parse(chunks) : {}); }
      catch { resolve({}); }
    });
  });
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function createAgent({ agentId, version, port, agentDir, runAudit, statusExtras }) {
  loadAgentEnv(agentDir);
  const startedAt = Date.now();
  const db = getDatabase(config.resolveSharedDbPath());
  const logger = makeLogger(agentId);
  const mi = new MiClient({
    baseUrl: process.env.MI_CORE_URL || '',
    apiKey: process.env.MI_API_KEY || '',
    agentId: process.env.SEO_AGENT_ID || agentId,
    db,
    logger,
  });

  // Heartbeat into shared DB
  function writeStatus(extra = {}) {
    return db.upsert('agent_status', {
      id: `status:${agentId}`,
      agent: agentId,
      version,
      uptime_s: Math.floor((Date.now() - startedAt) / 1000),
      port,
      mi_enabled: mi.enabled(),
      pid: process.pid,
      last_seen: new Date().toISOString(),
      ...extra,
    });
  }

  async function syncToMi(reason = 'heartbeat') {
    const status = writeStatus();
    const r = await mi.pushStatus({ status, reason });
    return r;
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        const status = writeStatus();
        return json(res, 200, { ok: true, agent: agentId, version, status });
      }
      if (req.method === 'GET' && req.url === '/status') {
        const status = writeStatus();
        const extras = typeof statusExtras === 'function' ? await statusExtras({ db, logger }) : {};
        const lastSync = db.latest('mi_sync_logs', (r) => r.agent === agentId);
        return json(res, 200, {
          agent: agentId,
          version,
          uptime_s: status.uptime_s,
          mi_enabled: mi.enabled(),
          mi_last_sync: lastSync ? lastSync._ts : null,
          mi_last_ok: lastSync ? !!lastSync.ok : null,
          ...extras,
        });
      }
      if (req.method === 'POST' && req.url === '/run/audit') {
        const body = await readBody(req);
        logger.info('audit triggered', body);
        const result = await runAudit({ db, logger, bus, queue, mi, params: body, saveReport });
        bus.publish({ from: agentId, to: '*', type: 'audit.completed', payload: { agent: agentId, summary: result.summary || null }, db });
        // Push report to Mi-Core
        mi.pushReport({ type: 'audit', summary: result.summary || null, payload: result }).catch(() => {});
        return json(res, 200, { ok: true, result });
      }
      if (req.method === 'POST' && req.url === '/sync/mi') {
        const r = await syncToMi('manual');
        return json(res, 200, { ok: true, mi: r });
      }
      if (req.method === 'GET' && req.url === '/reports/latest') {
        const r = latestReport(agentId);
        return json(res, 200, { ok: true, report: r });
      }
      if (req.method === 'GET' && req.url.startsWith('/run/connectors')) {
        try {
          const connectors = require('../connectors');
          const url = new (require('url').URL)('http://x' + req.url);
          const connectorId = url.searchParams.get('connector');
          const results = connectorId ? { [connectorId]: await connectors.runOne(connectorId) } : await connectors.runAll();
          return json(res, 200, { ok: true, results, connector_status: connectors.getStatus() });
        } catch (e) {
          return json(res, 200, { ok: false, error: e.message });
        }
      }
      json(res, 404, { ok: false, error: 'not_found' });
    } catch (err) {
      logger.error('request failed', { error: err.message, stack: err.stack });
      json(res, 500, { ok: false, error: err.message });
    }
  });

  function start() {
    server.listen(port, () => {
      logger.info(`agent listening`, { port, mi: mi.enabled() });
      writeStatus({ state: 'started' });
      mi.register({ version, port }).catch(() => {});
      // Periodic heartbeat to Mi every 30s; do not crash if it fails.
      const hb = setInterval(() => {
        syncToMi('heartbeat').catch((e) => logger.warn('mi sync failed', { e: e.message }));
      }, 30000);
      hb.unref && hb.unref();
    });
    process.on('uncaughtException', (e) => logger.error('uncaught', { error: e.message }));
    process.on('unhandledRejection', (e) => logger.error('unhandled', { error: String(e) }));
  }

  return { server, start, db, logger, mi, writeStatus, syncToMi };
}

module.exports = { createAgent };
