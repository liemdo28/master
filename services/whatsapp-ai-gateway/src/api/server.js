const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { isEnabled: tgEnabled } = require('../telegram/telegram-forwarder');
const { getTodayStats, getRecentConversations } = require('../storage/conversations');
const { renderDashboard } = require('../dashboard/admin-ui');
const { makeLogger } = require('../logger');
const log = makeLogger('whatsapp');
const packageJson = require('../../package.json');
const { getBuildInfo } = require('../runtime/build-info');
const fallbackAudit = (() => { try { return require('../audit/fallback-audit'); } catch (_) { return null; } })();
const rateLimiter = require('../safety/rate-limiter');
const businessHours = require('../safety/business-hours');
const aiControl = require('../safety/ai-control');
const reminderSvc = (() => { try { return require('../workflows/missing-submission-reminder'); } catch (_) { return null; } })();
const auditTrail = (() => { try { return require('../workflows/audit-trail'); } catch (_) { return null; } })();
const sheetQueueSvc = (() => { try { return require('../workflows/sheet-write-queue'); } catch (_) { return null; } })();
const dailyHealthReport = (() => { try { return require('../reports/daily-health-report'); } catch (_) { return null; } })();
const runtimeControl = (() => { try { return require('../runtime/windows-runtime-control'); } catch (_) { return null; } })();
const commandCenter = (() => { try { return require('../dashboard/food-safety-command-center'); } catch (_) { return null; } })();
const pilotValidation = (() => { try { return require('../pilot/food-safety-pilot-validation'); } catch (_) { return null; } })();

// Food safety storage — gracefully skip if not enabled
let fsStorage = null;
let sheetSource = null;
try { fsStorage = require('../storage/food-safety-storage'); } catch (_) {}
try { sheetSource = require('../food-safety/sheet-source'); } catch (_) {}
const storeRegistry = (() => { try { return require('../stores/store-registry'); } catch (_) { return null; } })();
const managerAlerts = (() => { try { return require('../alerts/manager-alert-service'); } catch (_) { return null; } })();
const templateOcrStorage = (() => { try { return require('../template-ocr/template-ocr-storage'); } catch (_) { return null; } })();
const templateOcrDeps = (() => { try { return require('../template-ocr/dependency-check'); } catch (_) { return null; } })();
const templateOcrGenerator = (() => { try { return require('../template-ocr/template-generator'); } catch (_) { return null; } })();
const dailyEntryTestForm = (() => { try { return require('../forms/daily-entry-test-form-generator'); } catch (_) { return null; } })();
const guideGenerator = (() => { try { return require('../forms/guide-generator'); } catch (_) { return null; } })();
const projectClientRegistry = (() => { try { return require('../security/project-client-registry'); } catch (_) { return null; } })();
const apiKeyAuditLog = (() => { try { return require('../security/api-key-audit-log'); } catch (_) { return null; } })();
const agentMiRouter = (() => { try { return require('../commands/agent-mi-router'); } catch (_) { return null; } })();
const agentMiForwarder = (() => { try { return require('../forwarding/agent-mi-forwarder'); } catch (_) { return null; } })();
const sqlite = (() => { try { return require('../storage/sqlite'); } catch (_) { return null; } })();
const buildInfo = getBuildInfo();
const startedAt = buildInfo.startedAt;
let whatsappSessionRef = null;

function setWhatsappSession(session) {
  whatsappSessionRef = session || null;
}

function getWhatsappStatusSafe() {
  const session = whatsappSessionRef;
  if (!session || typeof session.getStatus !== 'function') {
    return { status: 'unknown', connection_status: 'UNKNOWN' };
  }
  return session.getStatus();
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function extractSpreadsheetId(url) {
  if (!url) return null;
  // Matches /spreadsheets/d/<ID>/ or /spreadsheets/d/<ID>
  const m = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function keyStatus(name) {
  const value = process.env[name] || '';
  return {
    configured: !!value,
    prefix: value ? value.slice(0, 8) + '...' : '',
    length: value.length,
  };
}

function envUrlStatus(name) {
  const value = process.env[name] || '';
  return {
    configured: !!value,
    value: value ? value.replace(/\/+$/, '') : '',
  };
}

function httpGet(targetUrl, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const parsed = new URL(targetUrl);
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request({
      method: 'GET',
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      timeout: timeoutMs,
    }, (response) => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({
        ok: response.statusCode >= 200 && response.statusCode < 500,
        status: response.statusCode,
        body: body.slice(0, 500),
      }));
    });
    req.on('error', err => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
    req.end();
  });
}

async function checkServiceHealth(baseUrl) {
  if (!baseUrl) return { configured: false, reachable: false, error: 'not_configured' };
  const base = baseUrl.replace(/\/+$/, '');
  const paths = ['/api/health', '/health', '/'];
  const attempts = [];
  for (const suffix of paths) {
    const result = await httpGet(base + suffix);
    attempts.push({ url: base + suffix, ...result });
    if (result.ok) return { configured: true, reachable: true, matched_url: base + suffix, status: result.status };
  }
  return { configured: true, reachable: false, attempts };
}
const app = express();
app.use(express.json());

// Mount Backup / Restore API (added by Dev #2 Phase 2)
try { require('./backup-api')(app); } catch (e) { console.warn('backup-api mount failed:', e.message); }

// Mount Food Safety Command Center routes
try { app.use('/api/food-safety', require('./food-safety-command-center-routes')); } catch (e) { console.warn('food-safety-command-center-routes mount failed:', e.message); }

// Mount Stone Oak Pilot API
try { app.use('/api/pilot/stone-oak', require('../pilot/stone-oak-pilot-api')); } catch (e) { console.warn('stone-oak-pilot-api mount failed:', e.message); }

// Mount Production Metrics Dashboard (Phase 2)
try { app.use('/api/metrics', require('./production-metrics-routes')); } catch (e) { console.warn('production-metrics-routes mount failed:', e.message); }

// Mount Production Hardening Audit endpoint
app.get('/api/hardening/audit', async (_req, res) => {
  try {
    const { runAudit } = require('../hardening/production-hardening-audit');
    const report = await runAudit();
    res.json(report);
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Start pilot tracker background polling
try { require('../pilot/stone-oak-pilot-tracker').start(); } catch (e) { console.warn('pilot-tracker start failed:', e.message); }

// Agent-OS browser status endpoint
app.get('/api/agent-tools/browser/status', async (_req, res) => {
  try {
    const browserTool = (() => { try { return require('../agent-tools/browser/browser-tool'); } catch (_) { return null; } })();
    res.json({ ok: true, puppeteerAvailable: browserTool ? browserTool.isAvailable() : false });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Mi food-safety skill status
app.get('/api/mi/food-safety/status', async (_req, res) => {
  try {
    const { getMemoryStatus } = require('../agent-tools/memory/food-safety-memory-indexer');
    const mem = await getMemoryStatus();
    res.json({ ok: true, memory: mem });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Pilot metrics endpoint
app.get('/api/food-safety/pilot-metrics', async (_req, res) => {
  try {
    const pilotMetrics = require('../pilot/pilot-metrics');
    const summary = await pilotMetrics.getPilotSummary();
    res.json({ ok: true, ...summary });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ── Health ────────────────────────────────────────────────────────────────────
function safeBool(fn, fallback = false) {
  try { return !!fn(); } catch (_) { return fallback; }
}
function getRuntimeHealth() {
  // WhatsApp
  let waStatus = 'unknown';
  let whatsappReady = false;
  try { waStatus = getWhatsappStatusSafe().status || 'unknown'; whatsappReady = waStatus === 'ready'; } catch (_) {}

  // Template cache (never throws — uses lazy defaults snapshot)
  let templateReady = false;
  let templateItemCount = 0;
  try {
    const cache = require('../templates/template-cache');
    const cacheStatus = cache.getStatus() || {};
    templateItemCount = cacheStatus.rowCount || 0;
    templateReady = ['sqlite', 'sheet', 'test'].includes(cacheStatus.source) && templateItemCount > 0;
  } catch (_) {}

  // Google Sheets — enabled if env flag set OR sheet URL set
  let googleSheetsReady = false;
  try {
    googleSheetsReady =
      process.env.GOOGLE_SHEETS_ENABLED === 'true' ||
      !!(process.env.TEMPLATE_SHEET_URL) ||
      !!(process.env.LOG_SHEET_URL);
  } catch (_) {}

  // OCR — module available
  let ocrReady = false;
  let ocrMissing = [];
  try {
    const ocrDeps = require('../template-ocr/dependency-check');
    const r = ocrDeps.checkOcrDeps() || {};
    ocrReady = !!r.ok;
    ocrMissing = r.notes || r.missing || [];
  } catch (_) {
    ocrReady = false;
    ocrMissing = ['Template OCR module unavailable'];
  }

  // YoLink — module present + credentials configured (or explicitly disabled)
  let yolinkReady = false;
  let yolinkConfigured = false;
  try {
    const yolinkAuth = require('../integrations/yolink/yolink-auth');
    yolinkConfigured = yolinkAuth.isConfigured();
    yolinkReady = yolinkConfigured;
  } catch (_) {
    yolinkReady = false;
    yolinkConfigured = false;
  }

  return {
    ok: true,
    name: packageJson.name || 'whatsapp-ai-gateway',
    build: buildInfo.name,
    version: buildInfo.version,
    commit: buildInfo.commit,
    build_id: buildInfo.build_id,
    build_time: buildInfo.build_time,
    language_engine: buildInfo.language_engine,
    pid: buildInfo.pid,
    cwd: buildInfo.cwd,
    node: buildInfo.node,
    started_at: startedAt,
    uptime_seconds: Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
    dashboard_ready: true,
    admin_control_ready: templateReady,                  // admin UI needs template cache
    template_cache_ready: templateReady,
    template_item_count: templateItemCount,
    whatsapp_ready: whatsappReady,
    whatsapp_status: waStatus,
    google_sheets_ready: googleSheetsReady,
    ocr_ready: ocrReady,
    ocr_missing: ocrMissing,
    yolink_ready: yolinkReady,
    yolink_configured: yolinkConfigured,
    business_hours_open: safeBool(() => businessHours.isOpen()),
    ai_paused: safeBool(() => aiControl.isAIPaused()),
    time: new Date().toISOString(),
  };
}

app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    res.json(getRuntimeHealth());
  } catch (err) {
    // Health endpoint must NEVER throw — return degraded state.
    res.status(200).json({
      ok: false,
      version: buildInfo.version,
      build_id: buildInfo.build_id,
      build_time: buildInfo.build_time,
      commit: buildInfo.commit,
      language_engine: buildInfo.language_engine,
      pid: buildInfo.pid,
      started_at: startedAt,
      dashboard_ready: true,
      admin_control_ready: false,
      template_cache_ready: false,
      whatsapp_ready: false,
      google_sheets_ready: false,
      ocr_ready: false,
      yolink_ready: false,
      error: err.message,
      time: new Date().toISOString(),
    });
  }
});

app.get('/health', (req, res) => {
  const { status } = getWhatsappStatusSafe();
  res.set('Cache-Control', 'no-store');
  res.json({
    ok: status === 'ready',
    runtime: getRuntimeHealth(),
    whatsapp: status,
    telegram: tgEnabled(),
    ai_paused: aiControl.isAIPaused(),
    business_hours_open: businessHours.isOpen(),
    food_safety_enabled: process.env.FOOD_SAFETY_ENABLED === 'true',
    time: new Date().toISOString(),
  });
});

app.get('/api/whatsapp/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(getWhatsappStatusSafe());
});

// Canonical session endpoint — returns extended status including heartbeat + backoff state
app.get('/api/whatsapp/session', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const session = whatsappSessionRef;
  if (!session) return res.json({ ok: true, session: getWhatsappStatusSafe() });
  const fn = session.getDetailedStatus || session.getStatus;
  res.json({ ok: true, session: fn.call(session) });
});

app.post('/api/whatsapp/connect', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const session = whatsappSessionRef || require('../whatsapp/session-manager');
    const status = await session.connect();
    whatsappSessionRef = session;
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, status: getWhatsappStatusSafe() });
  }
});

app.post('/api/whatsapp/restart', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const session = whatsappSessionRef || require('../whatsapp/session-manager');
    const status = await session.restart();
    whatsappSessionRef = session;
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, status: getWhatsappStatusSafe() });
  }
});

app.post('/api/whatsapp/reconnect', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const session = whatsappSessionRef || require('../whatsapp/session-manager');
    const status = await session.reconnect();
    whatsappSessionRef = session;
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, status: getWhatsappStatusSafe() });
  }
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const session = whatsappSessionRef || require('../whatsapp/session-manager');
    const status = await session.disconnect();
    whatsappSessionRef = session;
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, status: getWhatsappStatusSafe() });
  }
});

app.post('/api/whatsapp/reset-session', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const session = whatsappSessionRef || require('../whatsapp/session-manager');
    const status = await session.resetSession();
    whatsappSessionRef = session;
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, status: getWhatsappStatusSafe() });
  }
});

app.post('/api/whatsapp/clear-session', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const session = whatsappSessionRef || require('../whatsapp/session-manager');
    const status = await session.clearSession();
    whatsappSessionRef = session;
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, status: getWhatsappStatusSafe() });
  }
});

app.get('/api/router/status', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const agentEnv = envUrlStatus('AGENT_CODING_URL');
  const miEnv = envUrlStatus('MI_CORE_URL');
  const status = {
    ok: true,
    router_enabled: !!agentMiRouter && !!agentMiForwarder,
    agent_handler_loaded: !!agentMiRouter?.isAgentCommand,
    mi_handler_loaded: !!agentMiRouter?.isMiCommand,
    forwarder_loaded: !!agentMiForwarder?.forward,
    message_listener_loaded: true,
    commands: {
      agent: '/agent',
      mi: '/mi',
    },
    env: {
      agent_coding_url: agentEnv,
      mi_core_url: miEnv,
      agent_coding_api_key: keyStatus('AGENT_CODING_API_KEY'),
      mi_core_api_key: keyStatus('MI_CORE_API_KEY'),
    },
    endpoints: {
      agent_coding: await checkServiceHealth(agentEnv.value),
      mi_core: await checkServiceHealth(miEnv.value),
    },
    time: new Date().toISOString(),
  };
  res.json(status);
});

app.get('/api/clients', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!projectClientRegistry) return res.status(503).json({ ok: false, error: 'Project client registry not available' });
  try {
    const clients = await projectClientRegistry.listClients();
    const byId = Object.fromEntries((clients || []).map(client => [client.client_id, client]));
    res.json({
      ok: true,
      clients,
      required: {
        'agent-coding': {
          exists: !!byId['agent-coding'],
          status: byId['agent-coding']?.status || 'missing',
          key_prefix: byId['agent-coding']?.key_prefix || '',
          env_key_configured: !!process.env.AGENT_CODING_API_KEY,
          last_used_at: byId['agent-coding']?.last_used_at || null,
        },
        'mi-core': {
          exists: !!byId['mi-core'],
          status: byId['mi-core']?.status || 'missing',
          key_prefix: byId['mi-core']?.key_prefix || '',
          env_key_configured: !!process.env.MI_CORE_API_KEY,
          last_used_at: byId['mi-core']?.last_used_at || null,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/clients', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!projectClientRegistry) return res.status(503).json({ ok: false, error: 'Project client registry not available' });
  try {
    const clientId = String(req.body?.client_id || req.body?.clientId || '').trim();
    if (!clientId) return res.status(400).json({ ok: false, error: 'client_id is required' });
    const existing = await projectClientRegistry.getClient(clientId);
    if (existing) return res.status(409).json({ ok: false, error: 'client already exists', client: existing });
    const result = await projectClientRegistry.createClient({
      clientId,
      allowedCommands: req.body?.allowed_commands || req.body?.allowedCommands || '/agent,/mi',
      callbackUrl: req.body?.callback_url || req.body?.callbackUrl || '',
      rateLimit: parseInt(req.body?.rate_limit || req.body?.rateLimit || '60', 10),
      permissions: req.body?.permissions || 'read',
      description: req.body?.description || '',
    });
    res.status(201).json({
      ok: true,
      client: result.client,
      raw_key_once: result.rawKey,
      key_prefix: result.keyPrefix,
      warning: 'Store raw_key_once securely. It cannot be recovered later.',
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/clients/:clientId/health', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!projectClientRegistry) return res.status(503).json({ ok: false, error: 'Project client registry not available' });
  try {
    const clientId = req.params.clientId;
    const client = await projectClientRegistry.getClient(clientId);
    if (!client) return res.status(404).json({ ok: false, error: 'client not found' });
    const envName = clientId === 'agent-coding' ? 'AGENT_CODING_URL' : (clientId === 'mi-core' ? 'MI_CORE_URL' : '');
    const keyName = clientId === 'agent-coding' ? 'AGENT_CODING_API_KEY' : (clientId === 'mi-core' ? 'MI_CORE_API_KEY' : '');
    const env = envName ? envUrlStatus(envName) : { configured: false, value: client.callback_url || '' };
    res.json({
      ok: true,
      client,
      key: keyName ? keyStatus(keyName) : { configured: false, prefix: '', length: 0 },
      endpoint: await checkServiceHealth(env.value || client.callback_url || ''),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/clients/:clientId/rotate', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!projectClientRegistry) return res.status(503).json({ ok: false, error: 'Project client registry not available' });
  try {
    const result = await projectClientRegistry.rotateClientKey(req.params.clientId);
    res.json({
      ok: true,
      client_id: req.params.clientId,
      raw_key_once: result.rawKey,
      key_prefix: result.keyPrefix,
      warning: 'Store raw_key_once securely and update the matching service/env. It cannot be recovered later.',
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/clients/:clientId/revoke', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!projectClientRegistry) return res.status(503).json({ ok: false, error: 'Project client registry not available' });
  try {
    await projectClientRegistry.revokeClient(req.params.clientId);
    res.json({ ok: true, client_id: req.params.clientId, status: 'revoked' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/audit/api-keys', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!apiKeyAuditLog) return res.status(503).json({ ok: false, error: 'API key audit log not available' });
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
    const clientId = req.query.client_id || req.query.clientId || undefined;
    res.json({ ok: true, logs: await apiKeyAuditLog.getLogs({ clientId, limit }) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/audit/messages', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const limit = Math.min(parseInt(req.query.limit || '25', 10) || 25, 100);
  try {
    const routed = sqlite
      ? await sqlite.all(
          `SELECT id, source_chat, command_prefix, target_project, response_body, action_taken, approval_status, timestamp, client_id, duration_ms, success
           FROM routed_messages ORDER BY id DESC LIMIT ?`,
          [limit]
        ).catch(err => ({ error: err.message }))
      : [];
    const apiKeyAudit = apiKeyAuditLog
      ? await apiKeyAuditLog.getLogs({ limit }).catch(err => ({ error: err.message }))
      : [];
    res.json({ ok: true, routed_messages: routed, api_key_audit: apiKeyAudit });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/router/test', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!agentMiRouter || !agentMiForwarder) return res.status(503).json({ ok: false, error: 'Agent/MI router not available' });
  const command = String(req.body?.command || req.body?.text || '').trim();
  const timestamp = new Date().toISOString();
  try {
    let route = null;
    let parsed = null;
    let forwarded = null;
    if (agentMiRouter.isAgentCommand(command)) {
      parsed = await agentMiRouter.handleAgentMessage({
        chatId: 'diagnostic@localhost',
        groupId: '',
        sender: 'diagnostic',
        senderName: 'Diagnostic',
        text: command,
        timestamp,
      });
      route = {
        command_prefix: '/agent',
        target_project: 'agent-coding',
        target_url: await agentMiForwarder.getTargetUrl('agent-coding'),
      };
      if (parsed.payload) forwarded = await agentMiForwarder.forwardToAgent(parsed.payload);
    } else if (agentMiRouter.isMiCommand(command)) {
      parsed = await agentMiRouter.handleMiMessage({
        chatId: 'diagnostic@localhost',
        groupId: '',
        sender: 'diagnostic',
        senderName: 'Diagnostic',
        text: command,
        timestamp,
      });
      route = {
        command_prefix: '/mi',
        target_project: 'mi-core',
        target_url: await agentMiForwarder.getTargetUrl('mi-core'),
      };
      if (parsed.payload) forwarded = await agentMiForwarder.forwardToMi(parsed.payload);
    } else {
      return res.status(400).json({ ok: false, error: 'Use /mi <message> or /agent <message>' });
    }
    res.json({
      ok: !!forwarded?.ok,
      incoming_message: command,
      router_decision: route,
      payload: parsed?.payload ? { ...parsed.payload, api_key: '***REDACTED***' } : null,
      result: forwarded || { ok: true, reply: parsed?.reply || '' },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Routing isolation validation — verifies /agent, /mi, food-safety do NOT cross-route
app.get('/api/router/validate', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!agentMiRouter) return res.status(503).json({ ok: false, error: 'Router not loaded' });

  const checks = [];
  function check(name, pass, detail) { checks.push({ name, pass, detail }); }

  // 1. /agent routes to agent-coding only
  check('isAgentCommand("/agent hello")', agentMiRouter.isAgentCommand('/agent hello'), '/agent prefix detected correctly');
  check('isMiCommand("/agent hello") is false', !agentMiRouter.isMiCommand('/agent hello'), '/agent not mis-routed to mi-core');

  // 2. /mi routes to mi-core only
  check('isMiCommand("/mi status")', agentMiRouter.isMiCommand('/mi status'), '/mi prefix detected correctly');
  check('isAgentCommand("/mi status") is false', !agentMiRouter.isAgentCommand('/mi status'), '/mi not mis-routed to agent-coding');

  // 3. neither command routes food-safety
  check('Food safety photo (no prefix) not agent', !agentMiRouter.isAgentCommand('photo message no prefix'), 'Unprefix message stays in food-safety pipeline');
  check('Food safety photo not mi', !agentMiRouter.isMiCommand('photo message no prefix'), 'Unprefix message stays in food-safety pipeline');

  // 4. Target URL isolation
  let agentUrl = '', miUrl = '';
  try {
    if (agentMiForwarder) {
      agentUrl = await agentMiForwarder.getTargetUrl('agent-coding');
      miUrl    = await agentMiForwarder.getTargetUrl('mi-core');
    }
  } catch (_) {}
  check('agent-coding URL configured', !!agentUrl, agentUrl || '(not set)');
  check('mi-core URL configured', !!miUrl, miUrl || '(not set)');
  check('agent-coding and mi-core URLs are distinct', agentUrl !== miUrl, `${agentUrl} vs ${miUrl}`);

  // 5. Client registry isolation
  let agentClient = null, miClient = null;
  try {
    if (projectClientRegistry) {
      agentClient = await projectClientRegistry.getClient('agent-coding');
      miClient    = await projectClientRegistry.getClient('mi-core');
    }
  } catch (_) {}
  check('agent-coding client exists in registry', !!agentClient, agentClient?.status || 'missing');
  check('mi-core client exists in registry', !!miClient, miClient?.status || 'missing');
  check('agent-coding allowed_commands is /agent', agentClient?.allowed_commands?.includes('/agent'), agentClient?.allowed_commands || 'n/a');
  check('mi-core allowed_commands is /mi', miClient?.allowed_commands?.includes('/mi'), miClient?.allowed_commands || 'n/a');
  check('mi-core is NOT allowed /agent', !miClient?.allowed_commands?.includes('/agent') || miClient?.allowed_commands === '/mi', 'No cross-permission');

  const pass = checks.filter(c => c.pass).length;
  const fail = checks.filter(c => !c.pass).length;
  res.json({ ok: fail === 0, summary: { pass, fail, total: checks.length }, checks });
});

app.get('/api/runtime-truth', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const health = getRuntimeHealth();
  let links = { template_sheet_url: process.env.TEMPLATE_SHEET_URL || '', log_sheet_url: process.env.LOG_SHEET_URL || '' };
  try {
    if (storeRegistry) links = await storeRegistry.getGoogleSheetLinks();
  } catch (_) {}
  res.json({
    build_id: health.build_id,
    git_commit: health.commit,
    build_time: health.build_time,
    project_path: health.cwd,
    node_pid: health.pid,
    port: parseInt(process.env.DASHBOARD_PORT || '3210', 10),
    whatsapp_status: health.whatsapp_status,
    template_item_count: health.template_item_count,
    template_source: (() => { try { return require('../templates/template-cache').getStatus().source; } catch (_) { return 'unknown'; } })(),
    template_version: (() => { try { return require('../templates/template-cache').getStatus().version; } catch (_) { return null; } })(),
    language_engine_status: health.language_engine,
    google_sheet_template_url: links.template_sheet_url || '',
    google_sheet_log_url: links.log_sheet_url || '',
    admin_control_ready: health.admin_control_ready,
  });
});

app.get('/api/runtime/control/status', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!runtimeControl) return res.status(503).json({ ok: false, error: 'Runtime control unavailable' });
  const status = await runtimeControl.getStatus();
  res.json({ ...status, project_root: runtimeControl.PROJECT_ROOT, scripts: runtimeControl.SCRIPTS });
});

app.post('/api/runtime/control/:action', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!runtimeControl) return res.status(503).json({ ok: false, error: 'Runtime control unavailable' });
  const actionMap = {
    start: 'start',
    stop: 'stop',
    install_autostart: 'installAutostart',
    uninstall_autostart: 'uninstallAutostart',
    status: 'status',
  };
  const scriptAction = actionMap[req.params.action];
  if (!scriptAction) return res.status(400).json({ ok: false, error: 'Unknown runtime control action' });
  const result = await runtimeControl.runScript(scriptAction, scriptAction === 'start' ? 45000 : 30000);
  res.json(result);
});

// ── Dashboard (HTML) ──────────────────────────────────────────────────────────
app.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const waDiagnostics = getWhatsappStatusSafe();
    const { status, qrData } = waDiagnostics;
    const stats = await getTodayStats().catch(() => ({}));
    const recent = await getRecentConversations(50).catch(() => []);
    const safetyState = {
      aiPaused: aiControl.isAIPaused(),
      businessHoursOpen: businessHours.isOpen(),
      todaySchedule: businessHours.getTodayScheduleText(),
      takeovers: aiControl.getAllTakeovers(),
      blocklist: aiControl.getBlocklist(),
    };
    // Food safety data
    let fsData = null;
    if (fsStorage && process.env.FOOD_SAFETY_ENABLED === 'true') {
      try {
        const fsStats = await fsStorage.getCheckStats();
        const lastCheck = await fsStorage.getLastCheck();
        const lastWarning = await fsStorage.getLastWarning();
        const sheetQueue = await fsStorage.getSheetQueueStatus();
        const lastBrothLog = await fsStorage.getLastBrothLog();
        fsData = {
          enabled: true,
          testMode: process.env.FOOD_SAFETY_TEST_MODE === 'true',
          allowedChatIds: process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS || '',
          replyMode: process.env.FOOD_SAFETY_REPLY_MODE || 'warning_only',
          stats: fsStats,
          lastCheck,
          lastWarning,
          sheetQueue,
          lastSynced: sheetSource ? sheetSource.getLastSynced() : null,
          visionConfigured: !!(process.env.VISION_API_URL && process.env.VISION_API_KEY),
          sheetEnabled: process.env.GOOGLE_SHEETS_ENABLED === 'true',
          lastBrothLog,
        };
      } catch (_) {}
    }
    // Template data
    let templateData = null;
    const dashboardTemplateCache = (() => { try { return require('../templates/template-cache'); } catch (_) { return null; } })();
    if (dashboardTemplateCache) {
      const syncLog = templateSyncSvc ? await templateSyncSvc.getRecentSyncLog(3).catch(() => []) : [];
      templateData = {
        status: dashboardTemplateCache.getStatus(),
        items: dashboardTemplateCache.getItemNames(),
        thresholds: dashboardTemplateCache.getThresholds(),
        syncing: templateSyncSvc?.isSyncing() || false,
        lastSyncResult: templateSyncSvc?.getLastResult() || null,
        recentSyncLog: syncLog,
      };
    }
    let templateOcrData = null;
    if (templateOcrStorage) {
      templateOcrData = {
        stats: await templateOcrStorage.getStats().catch(() => null),
        lastRun: await templateOcrStorage.getLastRun().catch(() => null),
        deps: templateOcrDeps ? templateOcrDeps.checkOcrDeps() : { ok: false, notes: ['Template OCR module unavailable'] },
      };
    }
    // Agent session data
    const agentData = agentMgr ? {
      sessions: agentMgr.getAllActiveSessions(),
      count: agentMgr.getActiveCount(),
      config: {
        group_quiet_mode:         process.env.GROUP_QUIET_MODE !== 'false',
        non_owner_reply_mode:     process.env.NON_OWNER_REPLY_MODE || 'silent',
        session_timeout_minutes:  parseInt(process.env.SESSION_TIMEOUT_MINUTES || '5', 10),
        session_end_message:      process.env.SESSION_END_MESSAGE_ENABLED !== 'false',
        passive_image_monitoring: process.env.PASSIVE_IMAGE_MONITORING === 'true',
      },
    } : null;
    const storeGroupData = storeRegistry ? { mappings: await storeRegistry.listMappings().catch(() => []) } : null;
    const managerAlertData = managerAlerts ? {
      stats: await managerAlerts.getStats().catch(() => null),
      recent: await managerAlerts.getRecentAlerts(10).catch(() => []),
      group: storeRegistry ? await storeRegistry.getManagerAlertGroup().catch(() => null) : null,
    } : null;
    // Incident data
    let incidentData = null;
    if (incidentReportSvc) {
      try {
        const incStats = await incidentReportSvc.getIncidentStats();
        const incRecent = await incidentReportSvc.getRecentIncidents(10);
        const incSheetQueue = incidentSheetWriter ? await incidentSheetWriter.getQueueStats().catch(() => ({})) : {};
        incidentData = { stats: incStats, recent: incRecent, sheetQueue: incSheetQueue };
      } catch (_) {}
    }
    // Compliance data
    let complianceData = null;
    if (photoAuditSvc || complianceScoreSvc) {
      try {
        const auditStats = photoAuditSvc ? await photoAuditSvc.getAuditStats().catch(() => ({})) : {};
        const pending = photoAuditSvc ? await photoAuditSvc.getPendingAudits().catch(() => []) : [];
        const scores = complianceScoreSvc ? await complianceScoreSvc.getTopOffenders(null, 10).catch(() => []) : [];
        complianceData = { auditStats, pending, scores };
      } catch (_) {}
    }
    // Pilot data
    let pilotData = null;
    if (pilotMetrics) {
      try {
        pilotData = await pilotMetrics.getPilotSummary();
        if (pilotValidation) {
          pilotData.validation = await pilotValidation.getProductionReadiness().catch(() => null);
        }
      } catch (_) {}
    }
    const unknownData = fallbackAudit ? {
      path: fallbackAudit.AUDIT_PATH,
      top: fallbackAudit.getTopUnknownMessages(10),
    } : null;
    // Admin Setup data — build inline without local HTTP fetch
    let adminSetupData = null;
    if (storeRegistry) {
      try {
        const mappings = await storeRegistry.listMappings();
        const activeMappings = mappings.filter(m => m.active);
        const storeIds = activeMappings.map(m => m.store_id);
        const mag = await storeRegistry.getManagerAlertGroup();
        const links = await storeRegistry.getGoogleSheetLinks();
        const setupTemplateCache = (() => { try { return require('../templates/template-cache'); } catch (_) { return null; } })();
        const waStatus = getWhatsappStatusSafe();
        const checks = [
          { id: 'whatsapp_connected', label: 'WhatsApp connected', status: waStatus.status === 'ready' ? 'PASS' : 'FAIL', note: waStatus.status },
          { id: 'stone_oak_mapped', label: 'Stone Oak group mapped', status: storeIds.includes('stone_oak') ? 'PASS' : 'NEEDS_ACTION' },
          { id: 'bandera_mapped', label: 'Bandera group mapped', status: storeIds.includes('bandera') ? 'PASS' : 'NEEDS_ACTION' },
          { id: 'rim_mapped', label: 'Rim group mapped', status: storeIds.includes('rim') ? 'PASS' : 'NEEDS_ACTION' },
          { id: 'manager_alert_group', label: 'Manager alert group set', status: mag.chat_id && mag.enabled ? 'PASS' : 'NEEDS_ACTION', note: mag.chat_id || 'not set' },
          { id: 'google_sheet_links', label: 'Google Sheet links set', status: !!(links.template_sheet_url && links.log_sheet_url) ? 'PASS' : 'NEEDS_ACTION' },
          { id: 'store_mappings_locked', label: 'Store mappings locked', status: activeMappings.filter(m => m.locked).length >= 3 ? 'PASS' : 'NEEDS_ACTION', note: `${activeMappings.filter(m => m.locked).length}/3 locked` },
          { id: 'template_sync', label: 'Template sync OK', status: setupTemplateCache && setupTemplateCache.getItemNames().length > 0 ? 'PASS' : 'NEEDS_ACTION' },
        ];
        const allRequiredPass = checks.every(c => c.status === 'PASS');
        const sheetQueueData = sheetQueueSvc?.getStats
          ? await sheetQueueSvc.getStats().catch(() => ({}))
          : {};
        const templateSyncStatus = templateSyncSvc ? { lastSync: templateSyncSvc.getLastResult()?.syncedAt || null, itemCount: setupTemplateCache?.getItemNames().length || 0 } : {};
        adminSetupData = {
          setupStatus: { checks, allPass: checks.every(c => c.status === 'PASS'), readyForPilot: allRequiredPass },
          stores: storeRegistry.STORES || [],
          sheetLinks: links,
          managerAlert: mag,
          sheetQueue: sheetQueueData,
          templateSyncStatus,
        };
      } catch (err) {
        log.warn('Admin setup dashboard data unavailable', { error: err.message });
        adminSetupData = {
          setupStatus: {
            checks: [
              { id: 'dashboard_render', label: 'Dashboard render', status: 'PASS', note: 'Safe fallback active' },
              { id: 'setup_data', label: 'Setup data', status: 'NEEDS_ACTION', note: err.message },
            ],
            allPass: false,
            readyForPilot: false,
          },
          stores: storeRegistry.STORES || [],
          sheetLinks: {},
          managerAlert: {},
          sheetQueue: {},
          templateSyncStatus: {},
        };
      }
    }
    // YoLink device data
    let yolinkData = null;
    const yolinkDeviceSvc = (() => { try { return require('../integrations/yolink/yolink-device-service'); } catch (_) { return null; } })();
    const yolinkTemplateCache = (() => { try { return require('../templates/template-cache'); } catch (_) { return null; } })();
    if (yolinkDeviceSvc) {
      try {
        const devices = await yolinkDeviceSvc.listDevices();
        const credentials = await yolinkDeviceSvc.getCredentialsStatus();
        const templateItems = yolinkTemplateCache ? yolinkTemplateCache.getItemNames() : [];
        const isDevMode = process.env.NODE_ENV !== 'production';
        yolinkData = { devices, credentials, templateItems, isDevMode };
      } catch (_) {}
    }
    // Build parallel validation panel data (Phases C/D/K)
    let parallelData = null;
    try {
      const panel = require('../dashboard/parallel-validation-panel');
      const [apiSettingsPanel, sensorMappingPanel, validationPanel] = await Promise.all([
        panel.renderApiSettingsPanel().catch(e => `<div class="dim">API panel error: ${esc(e.message)}</div>`),
        panel.renderSensorMappingPanel().catch(e => `<div class="dim">Mapping panel error: ${esc(e.message)}</div>`),
        panel.renderValidationPanel().catch(e => `<div class="dim">Validation panel error: ${esc(e.message)}</div>`),
      ]);
      parallelData = { apiSettingsPanel, sensorMappingPanel, validationPanel };
    } catch (e) {
      log.warn('Parallel validation panel build failed', { error: e.message });
    }

    const runtimeData = runtimeControl ? await runtimeControl.getStatus().catch(err => ({ ok: false, error: err.message })) : null;
    // Form Photo data for dashboard (Option B)
    let formPhotoData = null;
    try {
      const formPhotoStorage = require('../workflows/form-photo-storage');
      const stats = await formPhotoStorage.getSubmissionStats().catch(() => null);
      const submissions = await formPhotoStorage.getRecentSubmissions(30).catch(() => []);
      const commandCenterData = commandCenter ? await commandCenter.getCommandCenterData().catch(() => null) : null;
      formPhotoData = { stats, submissions, commandCenter: commandCenterData };
    } catch (_) {}

    // Build transport panels (session hardening, clients, routing, traffic, audit)
    let transportPanels = '';
    try {
      const { renderTransportPanels } = require('../dashboard/transport-panels');
      const whatsappSession = whatsappSessionRef;
      const [sessionData, clientsData, routerData, validationData, messagesData] = await Promise.all([
        whatsappSession
          ? (whatsappSession.getDetailedStatus ? Promise.resolve(whatsappSession.getDetailedStatus()) : Promise.resolve(whatsappSession.getStatus()))
          : Promise.resolve(getWhatsappStatusSafe()),
        projectClientRegistry ? projectClientRegistry.listClients().then(clients => {
          const byId = Object.fromEntries((clients||[]).map(c => [c.client_id, c]));
          return { clients, required: {
            'agent-coding': { exists: !!byId['agent-coding'], env_key_configured: !!process.env.AGENT_CODING_API_KEY },
            'mi-core': { exists: !!byId['mi-core'], env_key_configured: !!process.env.MI_CORE_API_KEY },
          }};
        }).catch(() => null) : Promise.resolve(null),
        agentMiForwarder ? agentMiForwarder.getTargetUrl('agent-coding').then(agentUrl =>
          agentMiForwarder.getTargetUrl('mi-core').then(miUrl => ({
            env: {
              agent_coding_url: { value: agentUrl, configured: !!process.env.AGENT_CODING_URL },
              mi_core_url: { value: miUrl, configured: !!process.env.MI_CORE_URL },
              agent_coding_api_key: { configured: !!process.env.AGENT_CODING_API_KEY },
              mi_core_api_key: { configured: !!process.env.MI_CORE_API_KEY },
            },
            endpoints: { agent_coding: {}, mi_core: {} },
          }))
        ).catch(() => null) : Promise.resolve(null),
        sqlite ? sqlite.all(
          `SELECT ok, summary, checks FROM (SELECT 1) -- placeholder; validation runs on-demand`,
          []
        ).then(() => null).catch(() => null) : Promise.resolve(null),
        sqlite ? sqlite.all(
          `SELECT id, source_chat, command_prefix, target_project, action_taken, approval_status, timestamp, client_id, duration_ms, success FROM routed_messages ORDER BY id DESC LIMIT 20`,
          []
        ).then(routed => ({ routed_messages: routed })).catch(() => ({ routed_messages: [] })) : Promise.resolve({ routed_messages: [] }),
      ]);
      // Merge api_key_audit into messagesData
      let fullMessages = messagesData || { routed_messages: [] };
      if (apiKeyAuditLog) {
        const audit = await apiKeyAuditLog.getLogs({ limit: 20 }).catch(() => []);
        fullMessages = { ...fullMessages, api_key_audit: audit };
      }
      transportPanels = await renderTransportPanels({ session: sessionData, clients: clientsData, router: routerData, validation: null, messages: fullMessages });
    } catch (tpErr) {
      log.warn('Transport panels build failed', { error: tpErr.message });
    }

    const html = await renderDashboard({ waStatus: status, waDiagnostics, telegramEnabled: tgEnabled(), stats, recent, qrData, safetyState, fsData, templateData, templateOcrData, agentData, storeGroupData, managerAlertData, incidentData, complianceData, pilotData, adminSetupData, yolinkData, parallelData, unknownData, runtimeData, formPhotoData, buildInfo, transportPanels });
    res.send(html);
  } catch (err) {
    log.error('Dashboard render error', { error: err.message });
    res.status(500).send('Dashboard error: ' + err.message);
  }
});

// ── Messages API ──────────────────────────────────────────────────────────────
app.get('/api/messages', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json(await getRecentConversations(limit));
});

app.get('/api/stats', async (req, res) => {
  res.json({ ...(await getTodayStats()), whatsapp: getWhatsappStatusSafe().status, telegram: tgEnabled() });
});

app.get('/qr', async (req, res) => {
  const QRCode = require('qrcode');
  const { qrData } = getWhatsappStatusSafe();
  if (!qrData) return res.status(404).json({ error: 'No QR available' });
  const img = await QRCode.toBuffer(qrData);
  res.set('Content-Type', 'image/png').send(img);
});

// ── Safety Controls API ────────────────────────────────────────────────────────

// GET  /api/safety          — full safety state
app.get('/api/safety', (req, res) => {
  res.json({
    ai_paused: aiControl.isAIPaused(),
    business_hours_open: businessHours.isOpen(),
    today_schedule: businessHours.getTodayScheduleText(),
    takeovers: aiControl.getAllTakeovers(),
    blocklist: aiControl.getBlocklist(),
  });
});

// POST /api/safety/pause    — pause AI globally
app.post('/api/safety/pause', (req, res) => {
  aiControl.pauseAI(req.body?.note || '');
  log.warn('AI paused via API');
  res.json({ ok: true, ai_paused: true });
});

// POST /api/safety/resume   — resume AI
app.post('/api/safety/resume', (req, res) => {
  aiControl.resumeAI();
  log.info('AI resumed via API');
  res.json({ ok: true, ai_paused: false });
});

// POST /api/safety/takeover         — { phone, by?, note? }
app.post('/api/safety/takeover', (req, res) => {
  const { phone, by = 'admin', note = '' } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'phone required' });
  aiControl.setHumanTakeover(phone, by, note);
  res.json({ ok: true, phone, takeover: true });
});

// DELETE /api/safety/takeover/:phone
app.delete('/api/safety/takeover/:phone', (req, res) => {
  aiControl.clearHumanTakeover(req.params.phone);
  res.json({ ok: true, phone: req.params.phone, takeover: false });
});

// POST /api/safety/block    — { phone }
app.post('/api/safety/block', (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'phone required' });
  aiControl.blockPhone(phone);
  res.json({ ok: true, phone, blocked: true });
});

// DELETE /api/safety/block/:phone
app.delete('/api/safety/block/:phone', (req, res) => {
  aiControl.unblockPhone(req.params.phone);
  res.json({ ok: true, phone: req.params.phone, blocked: false });
});

// POST /api/safety/rate-reset  — { phone }
app.post('/api/safety/rate-reset', (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'phone required' });
  rateLimiter.reset(phone);
  res.json({ ok: true, phone, rate_reset: true });
});

// ── Template API ──────────────────────────────────────────────────────────────
const templateCache   = (() => { try { return require('../templates/template-cache'); } catch (_) { return null; } })();
const templateSyncSvc = (() => { try { return require('../templates/template-sync-service'); } catch (_) { return null; } })();
const dailyTemplateSvc = (() => { try { return require('../templates/daily-entry-template-service'); } catch (_) { return null; } })();

// GET /api/template/status
app.get('/api/template/status', async (req, res) => {
  if (!templateCache) return res.status(503).json({ error: 'Template module not available' });
  const syncLog = templateSyncSvc ? await templateSyncSvc.getRecentSyncLog(5).catch(() => []) : [];
  res.json({
    ...templateCache.getStatus(),
    items: templateCache.getItemNames(),
    thresholds: templateCache.getThresholds(),
    syncing: templateSyncSvc?.isSyncing() || false,
    lastSyncResult: templateSyncSvc?.getLastResult() || null,
    recentSyncLog: syncLog,
    sheetUrl: process.env.TEMPLATE_SHEET_URL || null,
  });
});

// POST /api/template/sync — force sync now
app.post('/api/template/sync', async (req, res) => {
  if (!templateSyncSvc) return res.status(503).json({ error: 'Template sync not available' });
  if (templateSyncSvc.isSyncing()) return res.json({ ok: true, status: 'already_syncing' });
  const result = await templateSyncSvc.syncOnce().catch(err => ({ status: 'FAILED', error: err.message }));
  res.json({ ok: result.status === 'SUCCESS', ...result });
});

// POST /api/admin/google-sheets/sync-template — force sync for Admin Control Center
app.post('/api/admin/google-sheets/sync-template', async (req, res) => {
  if (!templateSyncSvc) return res.status(503).json({ error: 'Template sync not available' });
  if (templateSyncSvc.isSyncing()) return res.json({ ok: true, status: 'already_syncing' });
  const result = await templateSyncSvc.syncOnce().catch(err => ({ status: 'FAILED', error: err.message }));
  res.json({ ok: result.status === 'SUCCESS', ...result });
});

// GET /api/template/current — full current runtime template payload
app.get('/api/template/current', async (req, res) => {
  if (!dailyTemplateSvc) return res.status(503).json({ error: 'Daily entry template service not available' });
  const template = dailyTemplateSvc.getCurrentTemplate();
  res.json({ ok: !!template.available, ...template });
});

// GET /api/template/validate — validate the current runtime template
app.get('/api/template/validate', async (req, res) => {
  if (!dailyTemplateSvc) return res.status(503).json({ error: 'Daily entry template service not available' });
  const template = dailyTemplateSvc.getCurrentTemplate();
  const validation = dailyTemplateSvc.validateTemplate(template);
  res.json({ ok: validation.ok, template_version: template.template_version, item_count: template.item_count, validation });
});

// ── Printable Forms + Guides API ─────────────────────────────────────────────
async function ensureDailyEntryTestForm() {
  if (!dailyEntryTestForm) throw new Error('Daily entry test form generator not available');
  if (!fs.existsSync(dailyEntryTestForm.PDF_PATH) || !fs.existsSync(dailyEntryTestForm.XLSX_PATH)) {
    await dailyEntryTestForm.generateDailyEntryTestForm();
  }
}

function ensureGuides() {
  if (!guideGenerator) throw new Error('Guide generator not available');
  if (!fs.existsSync(guideGenerator.STAFF_MD_PATH) || !fs.existsSync(guideGenerator.STAFF_PDF_PATH) || !fs.existsSync(guideGenerator.MANAGER_MD_PATH)) {
    guideGenerator.generateGuides();
  }
}

app.get('/api/forms/daily-entry-test-form.pdf', async (req, res) => {
  try {
    await ensureDailyEntryTestForm();
    res.sendFile(dailyEntryTestForm.PDF_PATH);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/forms/daily-entry-test-form.xlsx', async (req, res) => {
  try {
    await ensureDailyEntryTestForm();
    res.download(dailyEntryTestForm.XLSX_PATH, 'BAKUDAN_DAILY_ENTRY_TEST_FORM.xlsx');
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/forms/regenerate', async (req, res) => {
  try {
    const form = await dailyEntryTestForm.generateDailyEntryTestForm();
    const guides = guideGenerator ? guideGenerator.generateGuides() : null;
    res.json({ ok: true, form, guides });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/guides/staff-en', (req, res) => {
  try {
    ensureGuides();
    res.sendFile(guideGenerator.STAFF_PDF_PATH);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/guides/manager-en', (req, res) => {
  try {
    ensureGuides();
    res.type('text/markdown').sendFile(guideGenerator.MANAGER_MD_PATH);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Template OCR API ─────────────────────────────────────────────────────────
app.get('/api/template-ocr/status', async (req, res) => {
  if (!templateOcrStorage) return res.status(503).json({ error: 'Template OCR module not available' });
  res.json({
    stats: await templateOcrStorage.getStats(),
    lastRun: await templateOcrStorage.getLastRun(),
    recent: await templateOcrStorage.getRecentRuns(10),
    deps: templateOcrDeps ? templateOcrDeps.checkOcrDeps() : null,
  });
});

app.post('/api/template-ocr/generate', async (req, res) => {
  if (!templateOcrGenerator) return res.status(503).json({ error: 'Template generator not available' });
  try {
    const result = templateOcrGenerator.generateDailyEntryTemplate();
    res.json({ ok: true, pdf: result.pdfPath, json: result.jsonPath, template_id: result.template.template_id, items: result.template.fields.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/template-ocr/template.pdf', (req, res) => {
  const file = path.resolve('./docs/templates/daily-entry-template.pdf');
  if (!fs.existsSync(file) && templateOcrGenerator) {
    try { templateOcrGenerator.generateDailyEntryTemplate(); } catch (_) {}
  }
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'template pdf not found' });
  res.sendFile(file);
});

app.get('/api/template-ocr/image', (req, res) => {
  const requested = String(req.query.path || '');
  if (!requested) return res.status(400).json({ error: 'path required' });
  const uploadsRoot = path.resolve('./data/uploads/template-ocr');
  const resolved = path.resolve(requested);
  if (!resolved.startsWith(uploadsRoot + path.sep) || !fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'image not found' });
  }
  res.sendFile(resolved);
});

// GET /api/form-photo/image — secure image serving for form photos
app.get('/api/form-photo/image', (req, res) => {
  const requested = String(req.query.path || '');
  if (!requested) return res.status(400).json({ error: 'path required' });
  const uploadsRoot = path.resolve('./data/uploads/form-photo');
  const resolved = path.resolve(requested);
  if (!resolved.startsWith(uploadsRoot + path.sep) || !fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'image not found' });
  }
  res.sendFile(resolved);
});

// ── Broth Command API ─────────────────────────────────────────────────────────
const brothCommand = (() => { try { return require('../commands/broth-command'); } catch (_) { return null; } })();

// GET /api/broth/sessions — active session count + details
app.get('/api/broth/sessions', (req, res) => {
  if (!brothCommand) return res.status(503).json({ error: 'Broth module not available' });
  res.json({
    active_sessions: brothCommand.getActiveSessions(),
    sessions: brothCommand.getAllSessions(),
  });
});

// DELETE /api/broth/sessions/:key — force-clear a session
app.delete('/api/broth/sessions/:key', (req, res) => {
  if (!brothCommand) return res.status(503).json({ error: 'Broth module not available' });
  const key = decodeURIComponent(req.params.key);
  const [chatId, sender] = key.split(':');
  if (!chatId || !sender) return res.status(400).json({ error: 'Invalid session key (expected chatId:sender)' });
  brothCommand.clearSession(chatId, sender);
  res.json({ ok: true, cleared: key });
});

// ── Agent Session API ─────────────────────────────────────────────────────────
const agentMgr = (() => { try { return require('../sessions/agent-session-manager'); } catch (_) { return null; } })();

// GET /api/agent/sessions — active agent sessions
app.get('/api/agent/sessions', (req, res) => {
  if (!agentMgr) return res.status(503).json({ error: 'Agent module not available' });
  res.json({ sessions: agentMgr.getAllActiveSessions(), count: agentMgr.getActiveCount() });
});

// DELETE /api/agent/sessions/:chatId — force-close a session
app.delete('/api/agent/sessions/:chatId', async (req, res) => {
  if (!agentMgr) return res.status(503).json({ error: 'Agent module not available' });
  const chatId = decodeURIComponent(req.params.chatId);
  const closed = await agentMgr.closeSession(chatId, agentMgr.CLOSE_REASONS.FORCE_CLOSE);
  if (!closed) return res.status(404).json({ error: 'Session not found' });
  res.json({ ok: true, closed: chatId });
});

// GET /api/agent/config — current quiet mode config
app.get('/api/agent/config', (req, res) => {
  res.json({
    group_quiet_mode:         process.env.GROUP_QUIET_MODE !== 'false',
    non_owner_reply_mode:     process.env.NON_OWNER_REPLY_MODE || 'silent',
    session_timeout_minutes:  parseInt(process.env.SESSION_TIMEOUT_MINUTES || '5', 10),
    session_end_message:      process.env.SESSION_END_MESSAGE_ENABLED !== 'false',
    passive_image_monitoring: process.env.PASSIVE_IMAGE_MONITORING === 'true',
  });
});

// ── Store Group Mapping API ─────────────────────────────────────────────────
app.get('/api/store-groups', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  res.json({ stores: storeRegistry.STORES, mappings: await storeRegistry.listMappings() });
});

app.post('/api/store-groups', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const { chat_id, group_name = '', store_id, store_name, active = true } = req.body || {};
  if (!chat_id) return res.status(400).json({ error: 'chat_id required' });
  try {
    await storeRegistry.upsertMapping({ chat_id, group_name, store_id, store_name, active: active ? 1 : 0 });
    res.json({ ok: true, mappings: await storeRegistry.listMappings() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/store-groups/:chatId', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  await storeRegistry.unlink(decodeURIComponent(req.params.chatId));
  res.json({ ok: true });
});

app.post('/api/store-groups/test', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const mapping = await storeRegistry.resolveGroup(req.body?.chat_id || '');
  res.json({ ok: !!mapping, mapping, message: mapping ? `Mapped to ${mapping.store_name}` : storeRegistry.unmappedGroupReply() });
});

// ── Manager Alerts API ──────────────────────────────────────────────────────
app.get('/api/manager-alerts', async (req, res) => {
  if (!managerAlerts) return res.status(503).json({ error: 'Manager alerts not available' });
  res.json({ stats: await managerAlerts.getStats(), recent: await managerAlerts.getRecentAlerts(25) });
});

// ── Missing Submission Reminder API ──────────────────────────────────────────
app.get('/api/reminders/pending', async (req, res) => {
  if (!reminderSvc) return res.status(503).json({ error: 'Reminder service not available' });
  res.json({ pending: await reminderSvc.getPendingReminders() });
});

app.get('/api/reminders/stats', async (req, res) => {
  if (!reminderSvc) return res.status(503).json({ error: 'Reminder service not available' });
  res.json({ stats: await reminderSvc.getReminderStats(), enabled: reminderSvc.isEnabled() });
});

// POST /api/reminders/check — trigger immediate check
app.post('/api/reminders/check', async (req, res) => {
  if (!reminderSvc) return res.status(503).json({ error: 'Reminder service not available' });
  await reminderSvc.checkMissingSubmissions();
  res.json({ ok: true, checked: new Date().toISOString() });
});

// ── Guided Workflow API ──────────────────────────────────────────────────────
const guidedEngine = (() => { try { return require('../workflows/guided/guided-workflow-engine'); } catch (_) { return null; } })();
const tempWorkflow = (() => { try { return require('../workflows/guided/temperature-workflow'); } catch (_) { return null; } })();

app.get('/api/workflows/active', (req, res) => {
  const guided = guidedEngine?.getAllSessions ? guidedEngine.getAllSessions() : {};
  const temp = tempWorkflow?.getAllTempSessions ? tempWorkflow.getAllTempSessions() : {};
  res.json({ guided, temperature: temp });
});

// ── Audit Trail API ──────────────────────────────────────────────────────────
app.get('/api/audit/logs', async (req, res) => {
  if (!auditTrail) return res.status(503).json({ error: 'Audit trail not available' });
  const storeId = req.query.store_id || null;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  res.json(await auditTrail.getAuditLogs({ storeId, limit }));
});

app.get('/api/audit/logs/:id', async (req, res) => {
  if (!auditTrail) return res.status(503).json({ error: 'Audit trail not available' });
  const log = await auditTrail.getAuditLogWithEdits(parseInt(req.params.id));
  if (!log) return res.status(404).json({ error: 'Audit log not found' });
  res.json(log);
});

app.get('/api/audit/stats', async (req, res) => {
  if (!auditTrail) return res.status(503).json({ error: 'Audit trail not available' });
  res.json(await auditTrail.getAuditStats());
});

app.get('/api/audit/today', async (req, res) => {
  if (!auditTrail) return res.status(503).json({ error: 'Audit trail not available' });
  res.json(await auditTrail.getTodayAuditSummary());
});

// ── Sheet Write Queue API ────────────────────────────────────────────────────
app.get('/api/sheet-queue', async (req, res) => {
  if (!sheetQueueSvc) return res.status(503).json({ error: 'Sheet queue not available' });
  res.json(await sheetQueueSvc.getQueue());
});

app.get('/api/sheet-queue/stats', async (req, res) => {
  if (!sheetQueueSvc) return res.status(503).json({ error: 'Sheet queue not available' });
  res.json(await sheetQueueSvc.getStats());
});

app.post('/api/sheet-queue/retry', async (req, res) => {
  if (!sheetQueueSvc) return res.status(503).json({ error: 'Sheet queue not available' });
  const result = await sheetQueueSvc.retryAll();
  res.json({ ok: true, ...result });
});

app.post('/api/sheet-queue/:id/retry', async (req, res) => {
  if (!sheetQueueSvc) return res.status(503).json({ error: 'Sheet queue not available' });
  const result = await sheetQueueSvc.retryItem(parseInt(req.params.id));
  res.json({ ok: true, ...result });
});

app.post('/api/sheet-queue/:id/mark-resolved', async (req, res) => {
  if (!sheetQueueSvc) return res.status(503).json({ error: 'Sheet queue not available' });
  await sheetQueueSvc.markResolved(parseInt(req.params.id));
  res.json({ ok: true });
});

// ── Daily Health Report API ─────────────────────────────────────────────────
app.get('/api/health-report/status', (req, res) => {
  if (!dailyHealthReport) return res.status(503).json({ error: 'Daily health report not available' });
  res.json(dailyHealthReport.getStatus());
});

app.post('/api/health-report/send', async (req, res) => {
  if (!dailyHealthReport) return res.status(503).json({ error: 'Daily health report not available' });
  const result = await dailyHealthReport.sendReport();
  res.json({ ok: result.status === 'SENT', ...result });
});

app.post('/api/health-report/test', async (req, res) => {
  if (!dailyHealthReport) return res.status(503).json({ error: 'Daily health report not available' });
  const reportText = await dailyHealthReport.buildReport();
  res.json({ ok: true, report: reportText });
});

// ── Food Safety API ───────────────────────────────────────────────────────────

// GET /api/food-safety/status
app.get('/api/food-safety/status', (req, res) => {
  if (!fsStorage) return res.status(503).json({ error: 'Food safety module not available' });
  res.json({
    enabled: process.env.FOOD_SAFETY_ENABLED === 'true',
    test_mode: process.env.FOOD_SAFETY_TEST_MODE === 'true',
    allowed_chat_ids: (process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS || '').split(',').filter(Boolean),
    reply_mode: process.env.FOOD_SAFETY_REPLY_MODE || 'warning_only',
    vision_configured: !!(process.env.VISION_API_URL && process.env.VISION_API_KEY),
    vision_status: (process.env.VISION_API_URL && process.env.VISION_API_KEY) ? 'configured' : 'Vision API not configured — image will be marked NEEDS_REVIEW.',
    google_sheets_enabled: process.env.GOOGLE_SHEETS_ENABLED === 'true',
    last_synced: sheetSource ? sheetSource.getLastSynced() : null,
    sheet_url: process.env.FOOD_SAFETY_SHEET_URL ? '(configured)' : '(not set — using hardcoded rules)',
  });
});

// GET /api/food-safety/checks
app.get('/api/food-safety/checks', async (req, res) => {
  if (!fsStorage) return res.status(503).json({ error: 'Food safety module not available' });
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  try {
    const checks = await fsStorage.getRecentChecks(limit);
    res.json(checks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/food-safety/stats
app.get('/api/food-safety/stats', async (req, res) => {
  if (!fsStorage) return res.status(503).json({ error: 'Food safety module not available' });
  try {
    const stats = await fsStorage.getCheckStats();
    const lastWarning = await fsStorage.getLastWarning();
    const sheetQueue = await fsStorage.getSheetQueueStatus();
    res.json({ stats, lastWarning, sheetQueue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/food-safety/image?path=<saved image path>
app.get('/api/food-safety/image', (req, res) => {
  const requested = String(req.query.path || '');
  if (!requested) return res.status(400).json({ error: 'path required' });

  const uploadsRoot = path.resolve('./data/uploads/food-safety');
  const resolved = path.resolve(requested);
  if (!resolved.startsWith(uploadsRoot + path.sep) || !fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'image not found' });
  }

  res.sendFile(resolved);
});

// ── Incident Reports API ────────────────────────────────────────────────────
const incidentReportSvc = (() => { try { return require('../incidents/incident-report-service'); } catch (_) { return null; } })();
const incidentSheetWriter = (() => { try { return require('../incidents/incident-sheet-writer'); } catch (_) { return null; } })();

app.get('/api/incidents', async (req, res) => {
  if (!incidentReportSvc) return res.status(503).json({ error: 'Incident module not available' });
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  res.json({ incidents: await incidentReportSvc.getRecentIncidents(limit) });
});

app.get('/api/incidents/stats', async (req, res) => {
  if (!incidentReportSvc) return res.status(503).json({ error: 'Incident module not available' });
  const stats = await incidentReportSvc.getIncidentStats();
  const sheetQueue = incidentSheetWriter ? await incidentSheetWriter.getQueueStats().catch(() => ({})) : {};
  res.json({ stats, sheetQueue });
});

app.get('/api/incidents/open', async (req, res) => {
  if (!incidentReportSvc) return res.status(503).json({ error: 'Incident module not available' });
  res.json({ incidents: await incidentReportSvc.getOpenIncidents() });
});

app.get('/api/incidents/:id', async (req, res) => {
  if (!incidentReportSvc) return res.status(503).json({ error: 'Incident module not available' });
  const incident = await incidentReportSvc.getIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  const actions = await incidentReportSvc.getIncidentActions(req.params.id);
  res.json({ incident, actions });
});

app.post('/api/incidents/:id/close', async (req, res) => {
  if (!incidentReportSvc) return res.status(503).json({ error: 'Incident module not available' });
  await incidentReportSvc.closeIncident(req.params.id, 'admin', 'Admin', req.body?.notes || '');
  res.json({ ok: true });
});

app.post('/api/incidents/:id/escalate', async (req, res) => {
  if (!incidentReportSvc) return res.status(503).json({ error: 'Incident module not available' });
  await incidentReportSvc.escalateIncident(req.params.id, 'admin', 'Admin', req.body?.reason || '');
  res.json({ ok: true });
});

app.post('/api/incidents/:id/ignore', async (req, res) => {
  if (!incidentReportSvc) return res.status(503).json({ error: 'Incident module not available' });
  await incidentReportSvc.ignoreIncident(req.params.id, 'admin', 'Admin', req.body?.reason || '');
  res.json({ ok: true });
});

// ── History API (CEO Directive — Historical Log Access) ─────────────────────────
const historyService = (() => { try { return require('../history/history-service'); } catch (_) { return null; } })();
const roleService = (() => { try { return require('../auth/role-service'); } catch (_) { return null; } })();

// GET /api/history/logs
app.get('/api/history/logs', async (req, res) => {
  if (!historyService) return res.status(503).json({ error: 'History service not available' });
  const { store_id, employee, start_date, end_date, status, workflow_type, source_type, limit = '20', offset = '0' } = req.query;
  const logs = await historyService.getRecentLogs({
    storeId: store_id || null,
    employeeId: employee || null,
    status: status || null,
    workflowType: workflow_type || null,
    sourceType: source_type || null,
    startDate: start_date ? start_date + 'T00:00:00.000Z' : null,
    endDate: end_date ? end_date + 'T23:59:59.999Z' : null,
    limit: Math.min(parseInt(limit) || 20, 200),
    offset: parseInt(offset) || 0,
  });
  res.json({ logs, count: logs.length });
});

// GET /api/history/logs/:id
app.get('/api/history/logs/:id', async (req, res) => {
  if (!historyService) return res.status(503).json({ error: 'History service not available' });
  const log = await historyService.getLogDetail(parseInt(req.params.id, 10));
  if (!log) return res.status(404).json({ error: 'Log not found' });
  res.json({ log });
});

// GET /api/history/logs/:id/edits
app.get('/api/history/logs/:id/edits', async (req, res) => {
  if (!historyService) return res.status(503).json({ error: 'History service not available' });
  const edits = await historyService.getEditHistoryForLog(parseInt(req.params.id, 10));
  res.json({ edits });
});

// GET /api/history/summary/daily?date=YYYY-MM-DD
app.get('/api/history/summary/daily', async (req, res) => {
  if (!historyService) return res.status(503).json({ error: 'History service not available' });
  const rows = await historyService.getDailySummary(req.query.date || null);
  res.json({ date: req.query.date || new Date().toISOString().slice(0, 10), entries: rows });
});

// GET /api/history/summary/weekly?week=YYYY-WW
app.get('/api/history/summary/weekly', async (req, res) => {
  if (!historyService) return res.status(503).json({ error: 'History service not available' });
  const summary = await historyService.getWeeklySummary(req.query.week || null);
  res.json(summary);
});

// GET /api/history/who-recorded?store_id=&item=&date=
app.get('/api/history/who-recorded', async (req, res) => {
  if (!historyService) return res.status(503).json({ error: 'History service not available' });
  const { store_id, item, date } = req.query;
  const who = await historyService.getWhoRecorded({ storeId: store_id || null, itemName: item || null, date: date || null });
  res.json({ who });
});

// GET /api/history/stats
app.get('/api/history/stats', async (req, res) => {
  if (!historyService) return res.status(503).json({ error: 'History service not available' });
  const stats = await historyService.getHistoryStats();
  res.json(stats);
});

// GET /api/history/missing-today
app.get('/api/history/missing-today', async (req, res) => {
  if (!historyService) return res.status(503).json({ error: 'History service not available' });
  const allStores = ['stone_oak', 'bandera', 'rim'];
  const storeNames = { stone_oak: 'Stone Oak', bandera: 'Bandera', rim: 'Rim' };
  const submitted = await historyService.getStoresSubmittedToday();
  const submittedIds = new Set(submitted.map(s => s.store_id));
  const missing = allStores.filter(id => !submittedIds.has(id));
  res.json({ submitted, missing: missing.map(id => ({ store_id: id, store_name: storeNames[id] })) });
});

// GET /api/history/export.csv
app.get('/api/history/export.csv', async (req, res) => {
  if (!historyService) return res.status(503).json({ error: 'History service not available' });
  const { store_id, start_date, end_date, limit = '1000' } = req.query;
  const rows = await historyService.exportLogsAsRows({
    storeId: store_id || null,
    startDate: start_date ? start_date + 'T00:00:00.000Z' : null,
    endDate: end_date ? end_date + 'T23:59:59.999Z' : null,
    limit: Math.min(parseInt(limit) || 1000, 5000),
  });
  const headers = 'timestamp,store,employee,phone,workflow,item,original_value,final_value,target_min,target_max,status,warning,edited,edited_by,sheet_status,manager_alert,source_type';
  const csv = [headers, ...rows.map(r =>
    [r.timestamp, r.store, r.employee, r.phone, r.workflow, r.item, r.original_value, r.final_value, r.target_min, r.target_max, r.status, r.warning, r.edited, r.edited_by, r.sheet_status, r.manager_alert, r.source_type]
      .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  )].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="history-export-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(csv);
});

// ── Sensor API (Phase 1.2D–1.2F) ───────────────────────────────────────────
const sensorPoller = (() => { try { return require('../integrations/yolink/yolink-poller'); } catch (_) { return null; } })();
const sensorDeviceSync = (() => { try { return require('../integrations/yolink/yolink-device-sync'); } catch (_) { return null; } })();
const sensorClient = (() => { try { return require('../integrations/yolink/yolink-client'); } catch (_) { return null; } })();
const sensorAlertsSvc = (() => { try { return require('../alerts/sensor-alert-service'); } catch (_) { return null; } })();
const crossValSvc = (() => { try { return require('../compliance/cross-validation-service'); } catch (_) { return null; } })();
const trustSvc = (() => { try { return require('../compliance/trust-score-service'); } catch (_) { return null; } })();
const sensorDashboardPanel = (() => { try { return require('../compliance/sensor-dashboard-panel'); } catch (_) { return null; } })();

// GET /api/sensors/status
app.get('/api/sensors/status', (req, res) => {
  const status = sensorPoller ? sensorPoller.getStatus() : {};
  res.json({ ...status, panel_html: sensorDashboardPanel ? null : null });
});

// POST /api/sensors/test — test YoLink connection
app.post('/api/sensors/test', async (req, res) => {
  if (!sensorClient) return res.status(503).json({ error: 'YoLink client not available' });
  const result = await sensorClient.testConnection();
  res.json(result);
});

// POST /api/sensors/sync — discover and sync devices
app.post('/api/sensors/sync', async (req, res) => {
  if (!sensorDeviceSync) return res.status(503).json({ error: 'YoLink device sync not available' });
  const result = await sensorDeviceSync.syncDevices().catch(err => ({ error: err.message }));
  res.json(result);
});

// POST /api/sensors/force-poll — force immediate poll
app.post('/api/sensors/force-poll', async (req, res) => {
  if (!sensorPoller) return res.status(503).json({ error: 'YoLink poller not available' });
  const result = await sensorPoller.forcePoll().catch(err => ({ error: err.message }));
  res.json({ ok: true, result });
});

// GET /api/sensors/readings — recent sensor readings
app.get('/api/sensors/readings', async (req, res) => {
  if (!sensorClient) return res.status(503).json({ error: 'YoLink not available' });
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  let readingSvc;
  try { readingSvc = require('../integrations/yolink/yolink-reading-service'); } catch (_) {}
  if (!readingSvc) return res.status(503).json({ error: 'Reading service not available' });
  const readings = await readingSvc.getRecentReadings(limit);
  res.json({ readings });
});

// GET /api/sensors/alerts — active sensor alerts
app.get('/api/sensors/alerts', async (req, res) => {
  if (!sensorAlertsSvc) return res.status(503).json({ error: 'Sensor alerts not available' });
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  res.json({ alerts: await sensorAlertsSvc.getRecentAlerts(limit), stats: await sensorAlertsSvc.getAlertStats() });
});

// POST /api/sensors/alerts/:id/resolve — resolve an alert
app.post('/api/sensors/alerts/:id/resolve', async (req, res) => {
  if (!sensorAlertsSvc) return res.status(503).json({ error: 'Sensor alerts not available' });
  const { run, get } = require('../storage/sqlite');
  await run("UPDATE sensor_alerts SET status = 'RESOLVED', resolved_at = datetime('now') WHERE id = ?", [parseInt(req.params.id)]);
  res.json({ ok: true });
});

// GET /api/sensors/cross-validation — cross-validation results
app.get('/api/sensors/cross-validation', async (req, res) => {
  if (!crossValSvc) return res.status(503).json({ error: 'Cross-validation not available' });
  const storeId = req.query.store_id || null;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const recent = await crossValSvc.getRecentResults(storeId, limit);
  const stats = await crossValSvc.getStats();
  res.json({ recent, stats });
});

// GET /api/sensors/trust — trust scores
app.get('/api/sensors/trust', async (req, res) => {
  if (!trustSvc) return res.status(503).json({ error: 'Trust service not available' });
  const topEmployees = await trustSvc.getTopEmployees(20);
  const storeScores = await trustSvc.getAllStoreScores();
  res.json({ topEmployees, storeScores });
});

// GET /api/sensors/trust/employee/:id — employee trust score
app.get('/api/sensors/trust/employee/:id', async (req, res) => {
  if (!trustSvc) return res.status(503).json({ error: 'Trust service not available' });
  const score = await trustSvc.getEmployeeStats(req.params.id);
  res.json(score);
});

// POST /api/sensors/mapping — map sensor to item
app.post('/api/sensors/mapping', async (req, res) => {
  const { sensor_id, store_id, item_name } = req.body || {};
  if (!sensor_id || !store_id || !item_name) return res.status(400).json({ error: 'sensor_id, store_id, item_name required' });
  const { run } = require('../storage/sqlite');
  await run(
    'INSERT OR REPLACE INTO sensor_item_mapping (sensor_id, store_id, item_name, active) VALUES (?, ?, ?, 1)',
    [sensor_id, store_id, item_name]
  );
  res.json({ ok: true, sensor_id, store_id, item_name });
});

// DELETE /api/sensors/mapping/:id — disable mapping
app.delete('/api/sensors/mapping/:id', async (req, res) => {
  const { run } = require('../storage/sqlite');
  await run('UPDATE sensor_item_mapping SET active = 0 WHERE id = ?', [parseInt(req.params.id)]);
  res.json({ ok: true });
});

// GET /api/sensors/mappings — list all sensor-item mappings
app.get('/api/sensors/mappings', async (req, res) => {
  const { all } = require('../storage/sqlite');
  const mappings = await all('SELECT * FROM sensor_item_mapping WHERE active = 1');
  res.json({ mappings });
});

// GET /api/sensors/devices — list all known sensors
app.get('/api/sensors/devices', async (req, res) => {
  const { all } = require('../storage/sqlite');
  const sensors = await all('SELECT * FROM sensors ORDER BY created_at DESC');
  res.json({ sensors });
});

// POST /api/sensors/devices/:sensorId/disable — disable a sensor
app.post('/api/sensors/devices/:sensorId/disable', async (req, res) => {
  if (!sensorDeviceSync) return res.status(503).json({ error: 'Device sync not available' });
  await sensorDeviceSync.disableSensor(req.params.sensorId);
  res.json({ ok: true, sensor_id: req.params.sensorId, disabled: true });
});

// POST /api/sensors/devices/:sensorId/enable — re-enable a sensor
app.post('/api/sensors/devices/:sensorId/enable', async (req, res) => {
  if (!sensorDeviceSync) return res.status(503).json({ error: 'Device sync not available' });
  await sensorDeviceSync.enableSensor(req.params.sensorId);
  res.json({ ok: true, sensor_id: req.params.sensorId, enabled: true });
});

// ── Compliance & Photo Audit API ─────────────────────────────────────────────
const photoAuditSvc = (() => { try { return require('../compliance/photo-audit-service'); } catch (_) { return null; } })();
const complianceScoreSvc = (() => { try { return require('../compliance/compliance-score-service'); } catch (_) { return null; } })();

// ── Pilot Metrics API ─────────────────────────────────────────────────────────
const pilotMetrics = (() => { try { return require('../pilot/pilot-metrics'); } catch (_) { return null; } })();

app.get('/api/photo-audits', async (req, res) => {
  if (!photoAuditSvc) return res.status(503).json({ error: 'Photo audit module not available' });
  res.json({ audits: await photoAuditSvc.getPendingAudits() });
});

app.get('/api/photo-audits/stats', async (req, res) => {
  if (!photoAuditSvc) return res.status(503).json({ error: 'Photo audit module not available' });
  res.json({ stats: await photoAuditSvc.getAuditStats() });
});

app.get('/api/compliance/scores', async (req, res) => {
  if (!complianceScoreSvc) return res.status(503).json({ error: 'Compliance module not available' });
  const storeId = req.query.store_id || null;
  const scores = storeId
    ? await complianceScoreSvc.getStoreScores(storeId)
    : await complianceScoreSvc.getTopOffenders(null, 20);
  res.json({ scores });
});

app.get('/api/compliance/stats', async (req, res) => {
  if (!complianceScoreSvc) return res.status(503).json({ error: 'Compliance module not available' });
  res.json({ stats: await complianceScoreSvc.getScoreStats() });
});

// ── Pilot Metrics Endpoints ──────────────────────────────────────────────────
app.get('/api/pilot/status', async (req, res) => {
  if (!pilotMetrics) return res.status(503).json({ error: 'Pilot metrics not available' });
  res.json(await pilotMetrics.getPilotSummary());
});

app.get('/api/pilot/logs', async (req, res) => {
  if (!pilotMetrics) return res.status(503).json({ error: 'Pilot metrics not available' });
  res.json({ logs: await pilotMetrics.getAllDailyLogs() });
});

app.post('/api/pilot/start', async (req, res) => {
  if (!pilotMetrics) return res.status(503).json({ error: 'Pilot metrics not available' });
  const startDate = req.body?.start_date || new Date().toISOString().slice(0, 10);
  await pilotMetrics.setPilotStartDate(startDate);
  res.json({ ok: true, start_date: startDate });
});

app.post('/api/pilot/record', async (req, res) => {
  if (!pilotMetrics) return res.status(503).json({ error: 'Pilot metrics not available' });
  const { store_id, store_name, started, completed, completion_time_sec, warnings, manager_alerts, language, sheet_queue_ok, sheet_queue_fail, notes } = req.body || {};
  if (!store_id) return res.status(400).json({ error: 'store_id required' });
  const id = await pilotMetrics.recordEntry({
    storeId: store_id, storeName: store_name || store_id,
    started: !!started, completed: !!completed,
    completionTimeSec: completion_time_sec || 0,
    warnings: warnings || 0, managerAlerts: manager_alerts || 0,
    language: language || 'en',
    sheetQueueOk: !!sheet_queue_ok, sheetQueueFail: !!sheet_queue_fail,
    notes: notes || '',
  });
  if (id === null) return res.json({ ok: false, reason: 'Pilot not active' });
  res.json({ ok: true, id });
});

app.get('/api/pilot/store/:storeId', async (req, res) => {
  if (!pilotMetrics) return res.status(503).json({ error: 'Pilot metrics not available' });
  const kpi = await pilotMetrics.getStoreKPIs(req.params.storeId);
  if (!kpi) return res.status(404).json({ error: 'No data for store' });
  res.json(kpi);
});

// ── YoLink Device Service API ────────────────────────────────────────────────
const yolinkDeviceSvc = (() => { try { return require('../integrations/yolink/yolink-device-service'); } catch (_) { return null; } })();

// GET  /api/admin/yolink/devices
// POST /api/admin/yolink/devices
// GET  /api/admin/yolink/devices/:id
// PATCH /api/admin/yolink/devices/:id
// DELETE /api/admin/yolink/devices/:id
// POST /api/admin/yolink/devices/:id/disable
// POST /api/admin/yolink/devices/:id/test-reading
// POST /api/admin/yolink/devices/:id/remap
// GET  /api/admin/yolink/devices/:id/warning-check
// GET  /api/admin/yolink/seed-drafts
// GET  /api/admin/yolink/credentials-status
// POST /api/admin/yolink/test-api
// POST /api/admin/yolink/sync-devices
// POST /api/admin/yolink/force-poll

app.get('/api/admin/yolink/devices', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink service not available' });
  const devices = await yolinkDeviceSvc.listDevices();
  res.json({ devices, count: devices.length });
});

app.post('/api/admin/yolink/devices', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink service not available' });
  try {
    const device = await yolinkDeviceSvc.addDevice(req.body || {});
    res.json({ ok: true, device });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/yolink/devices/:id', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink service not available' });
  const device = await yolinkDeviceSvc.getDevice(parseInt(req.params.id));
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(device);
});

app.patch('/api/admin/yolink/devices/:id', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink service not available' });
  try {
    const device = await yolinkDeviceSvc.updateDevice(parseInt(req.params.id), req.body || {});
    res.json({ ok: true, device });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.delete('/api/admin/yolink/devices/:id', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink service not available' });
  try {
    await yolinkDeviceSvc.deleteDevice(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/yolink/devices/:id/disable', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink service not available' });
  try {
    const device = await yolinkDeviceSvc.disableDevice(parseInt(req.params.id));
    res.json({ ok: true, device });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/yolink/devices/:id/test-reading', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink service not available' });
  const result = await yolinkDeviceSvc.testReading(parseInt(req.params.id));
  res.json(result);
});

app.post('/api/admin/yolink/devices/:id/remap', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink service not available' });
  try {
    const device = await yolinkDeviceSvc.remapDevice(parseInt(req.params.id), req.body || {});
    res.json({ ok: true, device });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/yolink/devices/:id/warning-check', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink service not available' });
  const result = await yolinkDeviceSvc.checkItemTemplateWarning(parseInt(req.params.id));
  res.json(result || { warning: false, message: 'Item exists in template' });
});

app.get('/api/admin/yolink/seed-drafts', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink service not available' });
  const drafts = await yolinkDeviceSvc.getSeedDrafts();
  res.json({ drafts });
});

app.get('/api/admin/yolink/seed-rim-devices', async (req, res) => {
  const drafts = [
    {
      device_name: 'Beer Walk-In',
      model: 'MANUAL-TEMP',
      device_eui: 'rim-beer-walkin-manual',
      serial_number: 'RIM-MANUAL-1',
      room: 'Rim',
      store_id: 'rim',
      store_name: 'Rim',
      item_name: 'Beer Walk-In / Walk-in Cooler',
      mapped_item: 'Beer Walk-In / Walk-in Cooler',
      sensor_type: 'temperature',
      active: true,
      hardware_status: 'HARDWARE_VERIFIED',
      api_status: 'NOT_CONFIGURED',
      manual_mode_enabled: true,
      verified_status: 'HARDWARE_VERIFIED',
    },
    {
      device_name: 'Freezer',
      model: 'MANUAL-TEMP',
      device_eui: 'rim-freezer-manual',
      serial_number: 'RIM-MANUAL-2',
      room: 'Rim',
      store_id: 'rim',
      store_name: 'Rim',
      item_name: 'Freezer',
      mapped_item: 'Freezer',
      sensor_type: 'temperature',
      active: true,
      hardware_status: 'HARDWARE_VERIFIED',
      api_status: 'NOT_CONFIGURED',
      manual_mode_enabled: true,
      verified_status: 'HARDWARE_VERIFIED',
    },
    {
      device_name: 'Kitchen Walk-In',
      model: 'MANUAL-TEMP',
      device_eui: 'rim-kitchen-walkin-manual',
      serial_number: 'RIM-MANUAL-3',
      room: 'Rim',
      store_id: 'rim',
      store_name: 'Rim',
      item_name: 'Kitchen Walk-In / Walk-in Cooler',
      mapped_item: 'Kitchen Walk-In / Walk-in Cooler',
      sensor_type: 'temperature',
      active: true,
      hardware_status: 'HARDWARE_VERIFIED',
      api_status: 'NOT_CONFIGURED',
      manual_mode_enabled: true,
      verified_status: 'HARDWARE_VERIFIED',
    },
    {
      device_name: 'YoLink Hub',
      model: 'MANUAL-HUB',
      device_eui: 'rim-yolink-hub-manual',
      serial_number: 'RIM-MANUAL-HUB',
      room: 'Rim',
      store_id: 'rim',
      store_name: 'Rim',
      sensor_type: 'hub',
      is_hub: true,
      active: true,
      hardware_status: 'HARDWARE_VERIFIED',
      api_status: 'NOT_CONFIGURED',
      manual_mode_enabled: true,
      verified_status: 'HARDWARE_VERIFIED',
    },
  ];
  res.json({ drafts });
});

app.post('/api/admin/yolink/manual-reading', async (req, res) => {
  if (!yolinkDeviceSvc || !parallelSvc) return res.status(503).json({ error: 'YoLink manual mode not available' });
  const { sensor_id, value, unit = 'F', reading_time, entered_by, notes, validate = false } = req.body || {};
  if (!sensor_id || value == null || value === '') return res.status(400).json({ error: 'sensor_id and value required' });
  try {
    const sensor = await yolinkDeviceSvc.getDevice(sensor_id);
    if (!sensor) return res.status(404).json({ error: 'Sensor not found' });
    if (sensor.is_hub) return res.status(400).json({ error: 'Hub cannot receive temperature reading' });
    const rec = await parallelSvc.saveSensorReading({
      sensor,
      value: parseFloat(value),
      unit,
      onlineStatus: true,
      providerTimestamp: reading_time || new Date().toISOString(),
      readingSource: 'manual',
      enteredBy: entered_by || null,
      notes: notes || null,
      rawPayload: { manual_mode: true },
    });
    let validation = null;
    if (validate) {
      const latestHuman = await measurementSvc.getLatestHuman({ storeId: sensor.store_id, itemName: sensor.item_name || sensor.mapped_item });
      if (latestHuman) {
        validation = await parallelSvc.crossValidateHumanVsSensor({
          storeId: sensor.store_id,
          itemName: sensor.item_name || sensor.mapped_item,
          humanValue: latestHuman.value,
          unit: latestHuman.unit || 'F',
        });
      }
    }
    res.json({ ok: true, record: rec, validation });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/yolink/credentials-status', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink service not available' });
  const status = await yolinkDeviceSvc.getCredentialsStatus();
  res.json(status);
});

app.post('/api/admin/yolink/test-api', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink service not available' });
  const yolinkAuth = (() => { try { return require('../integrations/yolink/yolink-auth'); } catch (_) { return null; } })();
  if (!yolinkAuth?.isConfigured()) {
    return res.json({ ok: false, error: 'YoLink API credentials not configured' });
  }
  try {
    const token = await yolinkAuth.getToken();
    await yolinkDeviceSvc.setAppConfig('YOLINK_LAST_AUTH_TEST', 'OK:' + new Date().toISOString());
    res.json({ ok: true, message: 'API credentials are valid' });
  } catch (err) {
    await yolinkDeviceSvc.setAppConfig('YOLINK_LAST_AUTH_TEST', 'FAIL:' + err.message);
    res.json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/yolink/sync-devices', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink service not available' });
  await yolinkDeviceSvc.setAppConfig('YOLINK_LAST_SYNC', new Date().toISOString());
  res.json({ ok: true, message: 'Sync triggered. Devices will be synced from YoLink API.' });
});

app.post('/api/admin/yolink/force-poll', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink service not available' });
  await yolinkDeviceSvc.setAppConfig('YOLINK_LAST_POLL', new Date().toISOString());
  res.json({ ok: true, message: 'Force poll triggered. Latest readings will be fetched.' });
});

// ── Admin Setup API ──────────────────────────────────────────────────────────

// WhatsApp groups discovery
app.get('/api/admin/whatsapp-groups', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const { getStatus, getClient } = require('../whatsapp/session-manager');
  const waStatus = getStatus();
  if (waStatus.status !== 'ready') {
    return res.json({ groups: [], status: 'WA_NOT_READY', message: 'WhatsApp is not connected. Scan QR first.' });
  }

  const client = getClient();
  if (!client) {
    return res.json({ groups: [], status: 'WA_NOT_READY', message: 'WhatsApp client not available.' });
  }

  try {
    const allChats = await client.getChats();
    const existingMappings = await storeRegistry.listMappings();
    const mappingByChatId = new Map(existingMappings.map(m => [m.chat_id, m]));

    // Filter groups only (@g.us)
    const groups = allChats
      .filter(chat => chat.id?.server === 'g.us')
      .map(chat => {
        const chatId = chat.id?._serialized || chat.id?.user || String(chat.id);
        const existingMapping = mappingByChatId.get(chatId);
        return {
          name: chat.name || 'Unknown Group',
          chat_id: chatId,
          participant_count: chat.metadata?.participants?.length || 0,
          is_group: true,
          last_message_at: chat.lastMessage?.timestamp ? new Date(chat.lastMessage.timestamp * 1000).toISOString() : null,
          unread_count: chat.unreadCount || 0,
          store_mapped: existingMapping?.store_id || null,
          store_name: existingMapping?.store_name || null,
          locked: existingMapping ? !!existingMapping.locked : false,
          active: existingMapping ? !!existingMapping.active : false,
          last_test_at: existingMapping?.last_test_at || null,
          last_test_status: existingMapping?.last_test_status || null,
        };
      });

    // Also include already-mapped groups (which might not appear in getChats yet)

    // Also include already-mapped groups (which might not appear in getChats yet)
    for (const m of existingMappings) {
      if (!groups.find(g => g.chat_id === m.chat_id)) {
        groups.push({
          name: m.group_name || 'Unknown',
          chat_id: m.chat_id,
          participant_count: 0,
          is_group: true,
          last_message_at: null,
          unread_count: 0,
          store_mapped: m.store_id,
          store_name: m.store_name,
          locked: !!m.locked,
          active: !!m.active,
          last_test_at: m.last_test_at || null,
          last_test_status: m.last_test_status || null,
        });
      }
    }

    res.json({ groups, status: 'OK', count: groups.length });
  } catch (err) {
    log.warn('WhatsApp group discovery failed', { error: err.message });
    // Fall back to DB mappings
    const mappings = await storeRegistry.listMappings();
    res.json({
      groups: mappings.map(m => ({
        name: m.group_name || 'Unknown',
        chat_id: m.chat_id,
        participant_count: 0,
        is_group: true,
        last_message_at: null,
        unread_count: 0,
        store_mapped: m.store_id,
        store_name: m.store_name,
        locked: !!m.locked,
        active: !!m.active,
        last_test_at: m.last_test_at || null,
        last_test_status: m.last_test_status || null,
      })),
      status: 'FALLBACK',
      message: 'Could not query WhatsApp directly. Showing DB mappings.',
    });
  }
});

app.post('/api/admin/whatsapp-groups/test', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const { chatId } = req.body || {};
  if (!chatId) return res.status(400).json({ error: 'chatId required' });

  const { getStatus, getClient } = require('../whatsapp/session-manager');
  const waStatus = getStatus();
  if (waStatus.status !== 'ready' || !getClient()) {
    return res.status(503).json({ error: 'WhatsApp is not connected. Scan QR first.' });
  }

  const replyService = require('../whatsapp/reply-service');
  const client = getClient();
  const groupName = req.body.group_name || 'Unknown Group';

  const text = [
    '✅ WhatsApp Group Test',
    '',
    'Gateway can send messages to this group.',
    '',
    `Group: ${groupName}`,
    `Chat ID: ${chatId}`,
  ].join('\n');

  try {
    await replyService.send(client, chatId, text);
    res.json({ ok: true, sent: true, chat_id: chatId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message, sent: false });
  }
});

app.post('/api/admin/whatsapp-groups/refresh', async (req, res) => {
  // Refresh = re-discover from WhatsApp then merge DB
  const { getStatus, getClient } = require('../whatsapp/session-manager');
  const waStatus = getStatus();
  if (waStatus.status !== 'ready' || !getClient()) {
    return res.status(503).json({ ok: false, status: 'WA_NOT_READY', message: 'WhatsApp not connected' });
  }
  // Trigger re-discovery by calling GET
  req.method = 'GET';
  const newReq = { ...req, query: {} };
  // Re-use the GET logic by redirecting
  const groups = [];
  try {
    const client = getClient();
    const allChats = await client.getChats();
    const waGroups = allChats.filter(c => c.id?.server === 'g.us').map(c => ({
      name: c.name || 'Unknown', chat_id: c.id?._serialized || String(c.id), is_group: true,
    }));
    groups.push(...waGroups);
  } catch (_) {}

  const mappings = await storeRegistry.listMappings();
  for (const m of mappings) {
    if (!groups.find(g => g.chat_id === m.chat_id)) {
      groups.push({ name: m.group_name || 'Unknown', chat_id: m.chat_id, is_group: true });
    }
  }
  res.json({ ok: true, groups, count: groups.length });
});

// Store Group Mapping CRUD
app.get('/api/admin/store-groups', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const mappings = await storeRegistry.listMappings();
  res.json({ mappings, stores: storeRegistry.STORES });
});

app.post('/api/admin/store-groups', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const { chat_id, group_name, store_id, store_name, active, locked } = req.body || {};
  if (!chat_id) return res.status(400).json({ error: 'chat_id required' });
  if (!store_id) return res.status(400).json({ error: 'store_id required' });
  try {
    await storeRegistry.upsertMapping({
      chat_id, group_name: group_name || '', store_id, store_name: store_name || store_id,
      active: active !== false, locked: !!locked,
    });
    const mappings = await storeRegistry.listMappings();
    res.json({ ok: true, mappings });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/admin/store-groups/:id', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const mapping = await storeRegistry.getMappingById(parseInt(req.params.id));
  if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
  const { group_name, active } = req.body || {};
  try {
    await storeRegistry.upsertMapping({
      chat_id: mapping.chat_id, group_name: group_name ?? mapping.group_name,
      store_id: mapping.store_id, store_name: mapping.store_name,
      active: active !== undefined ? !!active : !!mapping.active,
      locked: !!mapping.locked,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/store-groups/:id/lock', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const mapping = await storeRegistry.getMappingById(parseInt(req.params.id));
  if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
  await storeRegistry.lockMapping(mapping.chat_id);
  res.json({ ok: true });
});

app.post('/api/admin/store-groups/:id/unlock', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const mapping = await storeRegistry.getMappingById(parseInt(req.params.id));
  if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
  await storeRegistry.unlockMapping(mapping.chat_id);
  res.json({ ok: true });
});

app.delete('/api/admin/store-groups/:id', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const mapping = await storeRegistry.getMappingById(parseInt(req.params.id));
  if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
  await storeRegistry.removeMapping(mapping.chat_id);
  res.json({ ok: true });
});

app.post('/api/admin/store-groups/:id/test', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const mapping = await storeRegistry.getMappingById(parseInt(req.params.id));
  if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
  // Get WhatsApp send function from index.js or session-manager
  let sendFn = null;
  try {
    const idx = require('../index');
    sendFn = idx.sendMessage || idx.sendWhatsAppMessage || null;
  } catch (_) {}
  const result = await storeRegistry.testMapping(mapping.chat_id, sendFn);
  res.json(result);
});

// Manager Alert Group
app.get('/api/admin/manager-alert-group', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const group = await storeRegistry.getManagerAlertGroup();
  res.json(group);
});

app.post('/api/admin/manager-alert-group', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const { chat_id, group_name, enabled } = req.body || {};
  if (!chat_id) return res.status(400).json({ error: 'chat_id required' });
  await storeRegistry.setManagerAlertGroup({ chat_id, group_name: group_name || '', enabled: enabled !== false });
  const group = await storeRegistry.getManagerAlertGroup();
  res.json({ ok: true, ...group });
});

app.post('/api/admin/manager-alert-group/test', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const group = await storeRegistry.getManagerAlertGroup();
  if (!group.chat_id || !group.enabled) return res.json({ ok: false, error: 'Manager alert group not configured or disabled' });
  const { getStatus, getClient } = require('../whatsapp/session-manager');
  const waStatus = getStatus();
  const client = getClient();
  if (waStatus.status !== 'ready' || !client) {
    return res.json({ ok: false, error: 'WhatsApp is not connected. Scan QR first.' });
  }
  const replyService = require('../whatsapp/reply-service');
  try {
    const sent = await replyService.send(client, group.chat_id, '✅ Manager Alert Test\n\nThis confirms WhatsApp AI Gateway can send alerts to this group.\n\nIf you receive this, the manager alert group is correctly configured.');
    if (!sent) return res.json({ ok: false, error: 'WhatsApp send failed' });
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/manager-alert-group/disable', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const group = await storeRegistry.getManagerAlertGroup();
  await storeRegistry.setManagerAlertGroup({ ...group, enabled: false });
  res.json({ ok: true });
});

// Google Sheet Links
app.get('/api/admin/google-sheet-links', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  res.json(await storeRegistry.getGoogleSheetLinks());
});

app.post('/api/admin/google-sheet-links', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const { template_sheet_url, log_sheet_url } = req.body || {};
  try {
    await storeRegistry.setGoogleSheetLinks({ template_sheet_url, log_sheet_url });
    res.json({ ok: true, ...await storeRegistry.getGoogleSheetLinks() });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/google-sheet-links/test', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });
  const links = await storeRegistry.getGoogleSheetLinks();

  // Real Google Sheets test — authenticate and read template tab
  const templateResults = { ok: false, sheet: 'template', tab: 'Daily_Entry_Template', item_count: 0, error: null };
  if (links.template_sheet_url) {
    try {
      const { getSheetsClient } = require('../google/sheets-client');
      const sheetsClient = await getSheetsClient();
      if (!sheetsClient) {
        templateResults.error = 'GOOGLE_SERVICE_ACCOUNT_JSON missing or not accessible';
      } else {
        const spreadId = extractSpreadsheetId(links.template_sheet_url);
        if (spreadId) {
          const rows = await sheetsClient.getValues({ spreadsheetId: spreadId, tab: 'Daily_Entry_Template', range: 'B11:B35' });
          templateResults.ok = true;
          templateResults.item_count = (rows || []).filter(row => String(row?.[0] || '').trim()).length;
        } else {
          templateResults.error = 'Invalid URL format';
        }
      }
    } catch (err) {
      templateResults.error = err.message;
    }
  } else {
    templateResults.error = 'Template sheet URL not set';
  }

  // Real log test — authenticate and check write access using safe test tab
  const safeTestTab = process.env.BROTH_LOG_TAB || 'WhatsApp_AI_Daily_Log';
  const logResults = { ok: false, sheet: 'log', tab: safeTestTab, range: 'A:I', error: null };
  if (links.log_sheet_url) {
    try {
      const { getSheetsClient } = require('../google/sheets-client');
      const sheetsClient = await getSheetsClient();
      if (!sheetsClient) {
        logResults.error = 'GOOGLE_SERVICE_ACCOUNT_JSON missing or inaccessible.';
      } else {
        const spreadId = extractSpreadsheetId(links.log_sheet_url);
        if (spreadId) {
          const testRow = [[
            new Date().toISOString(),
            'TEST',
            'Dashboard Test',
            'Test Item',
            '—',
            '—',
            '—',
            'Dashboard Test Write',
            'DASHBOARD_TEST',
          ]];
          await sheetsClient.appendValues({ spreadsheetId: spreadId, tab: safeTestTab, range: 'A:I', values: testRow });
          logResults.ok = true;
        } else {
          logResults.error = 'Invalid URL format';
        }
      }
    } catch (err) {
      logResults.error = err.message;
    }
  } else {
    logResults.error = 'Log sheet URL not set';
  }

  res.json({
    ok: templateResults.ok && logResults.ok,
    template_sheet_url: templateResults.ok ? 'PASS' : 'FAIL',
    template_item_count: templateResults.item_count,
    template_last_sync_at: new Date().toISOString(),
    template_error: templateResults.error,
    log_sheet_url: logResults.ok ? 'PASS' : 'FAIL',
    log_tab: logResults.tab,
    log_range: logResults.range,
    log_error: logResults.error,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/admin/google-sheet-links/sync-template', async (req, res) => {
  const templateSyncSvc = (() => { try { return require('../templates/template-sync-service'); } catch (_) { return null; } })();
  if (!templateSyncSvc) return res.status(503).json({ error: 'Template sync service not available' });
  try {
    const result = await templateSyncSvc.syncOnce();
    res.json({ ok: result.status === 'SUCCESS', ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/google-sheet-links/test-write', async (req, res) => {
  const links = await (async () => {
    if (!storeRegistry) return null;
    return storeRegistry.getGoogleSheetLinks();
  })();
  if (!links) return res.status(503).json({ error: 'Store registry not available' });

  try {
    const { getSheetsClient } = require('../google/sheets-client');
    const sheetsClient = await getSheetsClient();
    if (!sheetsClient) {
      return res.json({ ok: false, error: 'GOOGLE_SERVICE_ACCOUNT_JSON missing or not accessible' });
    }
    const spreadId = extractSpreadsheetId(links.log_sheet_url || '');
    if (!spreadId) {
      return res.json({ ok: false, error: 'Invalid log sheet URL' });
    }
    const safeTestTab = process.env.BROTH_LOG_TAB || 'WhatsApp_AI_Daily_Log';
    const explicitOverride = req.body?.admin_test_mode === true && typeof req.body?.tab === 'string' && req.body.tab.trim();
    const targetTab = explicitOverride ? req.body.tab.trim() : safeTestTab;
    const testRow = [[
      new Date().toISOString(),
      'TEST',
      'Dashboard Test',
      'Test Item',
      '—',
      '—',
      '—',
      'DASHBOARD_TEST',
      'DASHBOARD_TEST',
    ]];
    await sheetsClient.appendValues({ spreadsheetId: spreadId, tab: targetTab, range: 'A:I', values: testRow });
    res.json({
      ok: true,
      sheet: links.log_sheet_url,
      tab: targetTab,
      range: 'A:I',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/sheet-queue/retry', async (req, res) => {
  if (!sheetQueueSvc) return res.status(503).json({ error: 'Sheet queue service not available' });
  try {
    await sheetQueueSvc.retryAll();
    const stats = await sheetQueueSvc.getQueueStats();
    res.json({ ok: true, pending: stats.pending_count, failed: stats.failed_count, sent: stats.sent_count });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Phase 1.5: Language endpoints ───────────────────────────────────────────
const langMem = (() => { try { return require('../i18n/language-memory'); } catch (_) { return null; } })();
const { SUPPORTED: LANG_SUPPORTED, t: tI18n } = require('../i18n/translations');
const { detectWithConfidence: detectLangConfidence } = require('../i18n/detector');

app.get('/api/admin/languages/status', async (req, res) => {
  if (!langMem) return res.status(503).json({ error: 'language-memory not available' });
  try {
    const userCount = await langMem.countUserLanguages();
    const users = await langMem.listUserLanguages({ limit: 20 });
    const stores = await langMem.listStoreLanguages();
    return res.json({
      ok: true,
      supported: LANG_SUPPORTED,
      userCount,
      recentUsers: users,
      storeLanguages: stores,
      lastDetected: users[0] ? { language: users[0].language, source: users[0].source, confidence: users[0].confidence } : null,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/languages/users', async (req, res) => {
  if (!langMem) return res.status(503).json({ error: 'language-memory not available' });
  try {
    const users = await langMem.listUserLanguages({ limit: parseInt(req.query.limit || '100', 10) });
    res.json({ ok: true, users });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/languages/users/:waId/reset', async (req, res) => {
  if (!langMem) return res.status(503).json({ error: 'language-memory not available' });
  try {
    const ok = await langMem.clearUserLanguage(req.params.waId);
    res.json({ ok });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/languages/users/:waId', async (req, res) => {
  if (!langMem) return res.status(503).json({ error: 'language-memory not available' });
  try {
    const { language, displayName } = req.body || {};
    if (!LANG_SUPPORTED.includes(language)) {
      return res.status(400).json({ ok: false, error: `Unsupported language: ${language}. Supported: ${LANG_SUPPORTED.join(', ')}` });
    }
    const ok = await langMem.setUserLanguage(req.params.waId, language, { displayName, confidence: 1.0, source: 'admin' });
    res.json({ ok });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/languages/stores', async (req, res) => {
  if (!langMem) return res.status(503).json({ error: 'language-memory not available' });
  try {
    const stores = await langMem.listStoreLanguages();
    res.json({ ok: true, stores });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/languages/stores/:storeId', async (req, res) => {
  if (!langMem) return res.status(503).json({ error: 'language-memory not available' });
  try {
    const { defaultLanguage, secondaryLanguages } = req.body || {};
    if (!LANG_SUPPORTED.includes(defaultLanguage)) {
      return res.status(400).json({ ok: false, error: `Unsupported defaultLanguage: ${defaultLanguage}` });
    }
    const ok = await langMem.setStoreLanguage(req.params.storeId, defaultLanguage, secondaryLanguages);
    res.json({ ok });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/languages/test-detect', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ ok: false, error: 'text required' });
    const result = detectLangConfidence(text);
    res.json({ ok: true, ...result, questionDetected: langMem ? langMem.detectLanguageQuestion(text) : null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Phase 1.5: Language panel HTML fragment for the Admin Control Center
const langPanel = (() => { try { return require('../dashboard/language-panel'); } catch (_) { return null; } })();
app.get('/api/admin/languages/panel-html', async (req, res) => {
  if (!langPanel || !langMem) {
    return res.status(503).type('text/html').send('<p>Language panel unavailable.</p>');
  }
  try {
    const userCount = await langMem.countUserLanguages();
    const recentUsers = await langMem.listUserLanguages({ limit: 10 });
    const storeLanguages = await langMem.listStoreLanguages();
    const lastDetected = recentUsers[0]
      ? { language: recentUsers[0].language, source: recentUsers[0].source, confidence: recentUsers[0].confidence }
      : null;
    const html = langPanel.renderLanguagePanel({
      userCount, recentUsers, storeLanguages, lastDetected, supported: LANG_SUPPORTED,
    });
    res.type('text/html').send(html);
  } catch (err) {
    res.status(500).type('text/html').send(`<p>Error: ${err.message}</p>`);
  }
});

// Setup Status Checklist — returns the 14 checks required by the CEO directive
// (section 11) so the Admin Control Center can render a real, live checklist.
app.get('/api/admin/setup-status', async (req, res) => {
  if (!storeRegistry) return res.status(503).json({ error: 'Store registry not available' });

  const checks = [];

  // 1. WhatsApp Connected
  const { getStatus: waGetStatus } = require('../whatsapp/session-manager');
  const waStatus = waGetStatus();
  checks.push({
    id: 'whatsapp_connected',
    label: 'WhatsApp connected',
    status: waStatus.status === 'ready' ? 'PASS' : 'FAIL',
    note: waStatus.status,
  });

  // Store mappings
  const mappings = await storeRegistry.listMappings();
  const activeMappings = mappings.filter(m => m.active);
  const storeIds = activeMappings.map(m => m.store_id);
  const storeByName = (n) => activeMappings.find(m => m.store_id === n);

  // 6–9. Test / Stone Oak / Bandera / Rim group mapped
  checks.push({ id: 'test_mapped',      label: 'Test group mapped',      status: storeByName('test')      ? 'PASS' : 'NEEDS_ACTION' });
  checks.push({ id: 'stone_oak_mapped', label: 'Stone Oak group mapped', status: storeByName('stone_oak') ? 'PASS' : 'NEEDS_ACTION' });
  checks.push({ id: 'bandera_mapped',   label: 'Bandera group mapped',   status: storeByName('bandera')   ? 'PASS' : 'NEEDS_ACTION' });
  checks.push({ id: 'rim_mapped',       label: 'Rim group mapped',       status: storeByName('rim')       ? 'PASS' : 'NEEDS_ACTION' });

  // 10. Manager Alert Group Set
  const mag = await storeRegistry.getManagerAlertGroup();
  checks.push({
    id: 'manager_alert_group',
    label: 'Manager alert group set',
    status: mag.chat_id && mag.enabled ? 'PASS' : 'NEEDS_ACTION',
    note: mag.chat_id || 'not set',
  });

  // Google Sheet links
  const links = await storeRegistry.getGoogleSheetLinks();
  const templateUrlSet = !!links.template_sheet_url;
  const logUrlSet = !!links.log_sheet_url;
  // 2. Template Sheet URL Set
  checks.push({ id: 'template_sheet_url', label: 'Template Sheet URL set', status: templateUrlSet ? 'PASS' : 'NEEDS_ACTION' });
  // 3. Daily Log URL Set
  checks.push({ id: 'daily_log_url',      label: 'Daily Log URL set',      status: logUrlSet      ? 'PASS' : 'NEEDS_ACTION' });

  // 11. Store Mappings Locked
  const lockedCount = activeMappings.filter(m => m.locked).length;
  checks.push({
    id: 'store_mappings_locked',
    label: 'Store mappings locked',
    status: lockedCount >= 4 ? 'PASS' : 'NEEDS_ACTION',
    note: `${lockedCount}/${activeMappings.length || 0} locked`,
  });

  // 4. Template Sync PASS
  const templateCache = (() => { try { return require('../templates/template-cache'); } catch (_) { return null; } })();
  const templateReady = !!(templateCache && templateCache.getItemNames().length > 0);
  checks.push({
    id: 'template_sync',
    label: 'Template sync OK',
    status: templateReady ? 'PASS' : 'NEEDS_ACTION',
  });

  // 5. Sheet Write PASS — only when a log sheet URL is configured AND Google Sheets
  // credentials are present. We treat absence of either as `NEEDS_ACTION` (not FAIL)
  // because the feature is intentionally optional in dev.
  let sheetWritePass = false;
  try {
    const { getSheetsClient } = require('../google/sheets-client');
    const sheetsClient = await getSheetsClient();
    sheetWritePass = !!(sheetsClient && logUrlSet);
  } catch (_) {}
  checks.push({
    id: 'sheet_write',
    label: 'Sheet write ready',
    status: sheetWritePass ? 'PASS' : (logUrlSet ? 'NEEDS_ACTION' : 'NOT_CONFIGURED'),
    note: logUrlSet ? (sheetWritePass ? 'sheets client reachable' : 'credentials not loaded') : 'no log sheet URL',
  });

  // 12. OCR — PASS or disabled. Per directive, disabled counts as PASS.
  let ocrCheckStatus = 'DISABLED';
  try {
    const ocrDeps = require('../template-ocr/dependency-check');
    ocrCheckStatus = ocrDeps.checkOcrDeps()?.ok ? 'PASS' : 'DISABLED';
  } catch (_) {}
  checks.push({
    id: 'ocr',
    label: 'OCR ready (or disabled)',
    status: ocrCheckStatus === 'PASS' || ocrCheckStatus === 'DISABLED' ? 'PASS' : 'FAIL',
    note: ocrCheckStatus,
  });

  // 13. YoLink — PASS or disabled. Per directive, disabled counts as PASS.
  let yolinkCheck = 'DISABLED';
  try {
    const yolinkAuth = require('../integrations/yolink/yolink-auth');
    yolinkCheck = yolinkAuth.isConfigured() ? 'PASS' : 'DISABLED';
  } catch (_) {}
  checks.push({
    id: 'yolink',
    label: 'YoLink configured (or disabled)',
    status: yolinkCheck === 'PASS' || yolinkCheck === 'DISABLED' ? 'PASS' : 'FAIL',
    note: yolinkCheck,
  });

  // 14. Pilot Ready — requires WhatsApp + at least the 3 real stores mapped + manager alert
  // + template sync + sheet URLs. We treat the absence of pilot metrics as "not started"
  // rather than FAIL.
  const pilotReady =
    waStatus.status === 'ready' &&
    storeByName('stone_oak') && storeByName('bandera') && storeByName('rim') &&
    mag.chat_id && mag.enabled &&
    templateReady && templateUrlSet && logUrlSet;
  checks.push({
    id: 'pilot_ready',
    label: 'Pilot ready',
    status: pilotReady ? 'PASS' : 'NEEDS_ACTION',
  });

  const allPass = checks.every(c => c.status === 'PASS');

  res.json({ checks, allPass, readyForPilot: pilotReady });
});

// ── Vision Image Serving ─────────────────────────────────────────────────────
app.get('/api/vision/image', (req, res) => {
  const requested = String(req.query.path || '');
  if (!requested) return res.status(400).json({ error: 'path required' });
  const uploadsRoot = path.resolve('./data/uploads/vision');
  const resolved = path.resolve(requested);
  if (!resolved.startsWith(uploadsRoot + path.sep) || !fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'image not found' });
  }
  res.sendFile(resolved);
});

// ═══════════════════════════════════════════════════════════════════════════
// CEO Directive — Human + YoLink Parallel Validation API
// ═══════════════════════════════════════════════════════════════════════════
const yolinkApiSettings = (() => { try { return require('../integrations/yolink/yolink-api-settings'); } catch (_) { return null; } })();
const parallelSvc = (() => { try { return require('../compliance/parallel-validation-service'); } catch (_) { return null; } })();
const measurementSvc = (() => { try { return require('../compliance/measurement-records'); } catch (_) { return null; } })();

// YoLink API Settings endpoints
app.get('/api/admin/yolink/api-status', async (req, res) => {
  if (!yolinkApiSettings) return res.status(503).json({ error: 'YoLink API settings not available' });
  res.json(await yolinkApiSettings.getStatus());
});

app.post('/api/admin/yolink/save-credentials', async (req, res) => {
  if (!yolinkApiSettings) return res.status(503).json({ error: 'YoLink API settings not available' });
  const { client_id, client_secret } = req.body || {};
  if (!client_id || !client_secret) {
    return res.status(400).json({ error: 'client_id and client_secret required' });
  }
  try {
    const result = await yolinkApiSettings.saveCredentials({ clientId: client_id, clientSecret: client_secret });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/yolink/test-connection', async (req, res) => {
  if (!yolinkApiSettings) return res.status(503).json({ error: 'YoLink API settings not available' });
  const auth = (() => { try { return require('../integrations/yolink/yolink-auth'); } catch (_) { null; } })();
  if (!auth) return res.status(503).json({ error: 'YoLink auth not available' });
  auth.clearToken();
  try {
    const token = await auth.refreshToken();
    await yolinkApiSettings.recordAuthTest('PASS');
    res.json({ ok: true, status: 'PASS', token_acquired: !!token });
  } catch (err) {
    await yolinkApiSettings.recordAuthTest('FAIL');
    res.json({ ok: false, status: 'FAIL', error: err.message });
  }
});

app.post('/api/admin/yolink/clear-credentials', async (req, res) => {
  if (!yolinkApiSettings) return res.status(503).json({ error: 'YoLink API settings not available' });
  const result = await yolinkApiSettings.clearCredentials();
  res.json(result);
});

app.post('/api/admin/yolink/set-enabled', async (req, res) => {
  if (!yolinkApiSettings) return res.status(503).json({ error: 'YoLink API settings not available' });
  const enabled = !!req.body?.enabled;
  const result = await yolinkApiSettings.setEnabled(enabled);
  // Stop/start poller
  if (sensorPoller) {
    if (enabled) sensorPoller.start();
    else sensorPoller.stop();
  }
  res.json(result);
});

// Sensor Mapping endpoints (Phase D)
app.get('/api/admin/yolink/mappings', async (req, res) => {
  if (!parallelSvc) return res.status(503).json({ error: 'Parallel service not available' });
  const storeId = req.query.store_id || null;
  res.json({ mappings: await parallelSvc.getActiveMappings(storeId) });
});

app.post('/api/admin/yolink/mappings', async (req, res) => {
  if (!parallelSvc) return res.status(503).json({ error: 'Parallel service not available' });
  const { sensor_id, store_id, item_name, template_item_id, confidence } = req.body || {};
  if (!sensor_id || !store_id || !item_name) {
    return res.status(400).json({ error: 'sensor_id, store_id, item_name required' });
  }
  try {
    const result = await parallelSvc.mapSensorToItem({
      sensorId: sensor_id,
      storeId: store_id,
      itemName: item_name,
      templateItemId: template_item_id || null,
      confidence: typeof confidence === 'number' ? confidence : 1.0,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/yolink/mappings/:id', async (req, res) => {
  if (!parallelSvc) return res.status(503).json({ error: 'Parallel service not available' });
  try {
    const result = await parallelSvc.unmapSensor(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Device registry endpoints (Phase B)
app.post('/api/admin/yolink/devices', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink device service not available' });
  try {
    const payload = { ...(req.body || {}), verified_status: req.body?.verified_status || 'HARDWARE_VERIFIED' };
    const device = await yolinkDeviceSvc.addDevice(payload);
    res.json({ ok: true, device });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/yolink/devices/:id/verify', async (req, res) => {
  if (!yolinkDeviceSvc) return res.status(503).json({ error: 'YoLink device service not available' });
  try {
    const device = await yolinkDeviceSvc.setVerifiedStatus(req.params.id, 'HARDWARE_VERIFIED');
    res.json({ ok: true, device });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/yolink/validation-panel', async (req, res) => {
  if (!parallelSvc || !measurementSvc) return res.status(503).json({ error: 'Parallel service not available' });
  const storeId = req.query.store_id || null;
  const itemName = req.query.item_name || null;
  if (!storeId || !itemName) {
    return res.status(400).json({ error: 'store_id and item_name required' });
  }
  const matchWindowMinutes = parseInt(req.query.window_minutes || '10', 10);
  const pair = await measurementSvc.getLatestPair({ storeId, itemName, matchWindowMinutes });
  // Also fetch sensor health
  let sensor = null;
  try {
    sensor = await yolinkDeviceSvc.findSensorForStoreItem(storeId, itemName);
  } catch (_) {}
  res.json({ pair, sensor });
});

app.get('/api/admin/yolink/validation-summary', async (req, res) => {
  if (!parallelSvc || !measurementSvc) return res.status(503).json({ error: 'Parallel service not available' });
  const storeId = req.query.store_id || null;
  const stats = await measurementSvc.getStats(storeId);
  const apiConfigured = await yolinkApiSettings?.isConfigured().catch(() => false) || false;
  let sensors = [];
  try {
    sensors = await yolinkDeviceSvc.listDevices();
  } catch (_) {}
  res.json({ stats, apiConfigured, sensors });
});

app.get('/api/admin/yolink/parallel-readiness', async (req, res) => {
  if (!parallelSvc) return res.status(503).json({ error: 'Parallel service not available' });
  const apiConfigured = await yolinkApiSettings?.isConfigured().catch(() => false) || false;
  const enabled = await yolinkApiSettings?.isEnabledFlag().catch(() => false) || false;
  let devices = [];
  let mappings = [];
  try {
    devices = await yolinkDeviceSvc.listDevices();
    mappings = await parallelSvc.getActiveMappings();
  } catch (_) {}
  const tempSensors = devices.filter(d => !d.is_hub);
  const hubs = devices.filter(d => d.is_hub);
  res.json({
    api_configured: apiConfigured,
    enabled,
    api_status: await yolinkApiSettings?.getStatus().catch(() => ({})),
    devices_total: devices.length,
    temperature_sensors: tempSensors.length,
    hubs: hubs.length,
    active_mappings: mappings.length,
    sensors: tempSensors.map(s => ({
      id: s.id,
      sensor_id: s.sensor_id,
      device_name: s.device_name,
      store_id: s.store_id,
      store_name: s.store_name,
      item_name: s.item_name || s.mapped_item,
      verified_status: s.verified_status,
      is_hub: s.is_hub,
      device_state: s.device_state,
      last_reading_value: s.last_reading_value,
      last_reading_at: s.last_reading_at,
      battery_level: s.battery_level,
      signal_status: s.signal_status,
    })),
    message: !apiConfigured
      ? 'YoLink API not configured. Human workflow remains active.'
      : (mappings.length === 0 ? 'API ready, no sensors mapped yet.' : 'API ready, sensors mapped.'),
  });
});

// Mismatch prompt preview (Phase H)
app.get('/api/admin/yolink/mismatch-prompt', (req, res) => {
  if (!parallelSvc) return res.status(503).json({ error: 'Parallel service not available' });
  const { item_name, human_value, sensor_value, difference, unit } = req.query;
  if (!item_name || !human_value || !sensor_value) {
    return res.status(400).json({ error: 'item_name, human_value, sensor_value required' });
  }
  const prompt = parallelSvc.buildMismatchPrompt({
    itemName: item_name,
    humanValue: parseFloat(human_value),
    sensorValue: parseFloat(sensor_value),
    difference: parseFloat(difference || Math.abs(parseFloat(human_value) - parseFloat(sensor_value))),
    unit: unit || 'F',
  });
  res.json({ prompt });
});

// ═══════════════════════════════════════════════════════════════════════════
// End of CEO Parallel Validation API
// ═══════════════════════════════════════════════════════════════════════════

// ── System Updates API ────────────────────────────────────────────────────────
const updateService = (() => { try { return require('../updater/update-service'); } catch (_) { return null; } })();
const autoUpdater   = (() => { try { return require('../updater/auto-updater-service').getInstance(); } catch (_) { return null; } })();

app.get('/api/updates/status', async (req, res) => {
  if (!updateService) return res.json({ ok: false, error: 'Update service unavailable' });
  res.json(updateService.getLastCheckResult());
});

app.post('/api/updates/check', async (req, res) => {
  if (!updateService) return res.json({ ok: false, error: 'Update service unavailable' });
  try {
    const result = await updateService.checkForUpdates();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/updates/log', (req, res) => {
  if (!updateService) return res.json([]);
  res.json(updateService.readUpdateLog());
});

// ── One-click Install / Rollback (streams PS1 stdout as SSE) ─────────────────
const { spawn } = require('child_process');

function spawnUpdaterSSE(res, command, rollbackTarget = '') {
  const ps1 = path.join(process.cwd(), 'updater', 'bakudan-updater.ps1');
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, command];
  if (command === 'rollback' && rollbackTarget) args.push(rollbackTarget);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({ type: 'start', command });

  const child = spawn('powershell.exe', args, { cwd: process.cwd() });

  child.stdout.on('data', chunk => {
    String(chunk).split('\n').filter(l => l.trim()).forEach(line => {
      send({ type: 'log', line: line.replace(/\x1B\[[0-9;]*m/g, '') });
      if (updateService) {
        updateService.appendUpdateLog({ action: `${command}/stdout`, from: '', to: '', status: 'running', note: line.trim().slice(0, 200) });
      }
    });
  });

  child.stderr.on('data', chunk => {
    String(chunk).split('\n').filter(l => l.trim()).forEach(line => {
      send({ type: 'error', line: line.replace(/\x1B\[[0-9;]*m/g, '') });
    });
  });

  child.on('close', code => {
    send({ type: 'done', exitCode: code, ok: code === 0 });
    if (updateService) {
      updateService.appendUpdateLog({ action: command, from: '', to: '', status: code === 0 ? 'ok' : 'failed', note: `exit ${code}` });
    }
    res.end();
  });

  child.on('error', err => {
    send({ type: 'error', line: `Failed to launch updater: ${err.message}` });
    res.end();
  });
}

app.post('/api/updates/install', (req, res) => {
  spawnUpdaterSSE(res, 'update');
});

app.post('/api/updates/rollback', (req, res) => {
  const target = String(req.body?.target || 'latest').replace(/[^a-zA-Z0-9_\-]/g, '');
  spawnUpdaterSSE(res, 'rollback', target || 'latest');
});

// Extended version + backup info from AutoUpdaterService
app.get('/api/updates/version', (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    if (autoUpdater) return res.json({ ok: true, ...autoUpdater.getVersionInfo() });
    if (updateService) return res.json({ ok: true, ...updateService.readVersionFile() });
    res.json({ ok: false, error: 'Updater unavailable' });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

app.get('/api/updates/backups', (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const backups = autoUpdater ? autoUpdater.listBackups() : [];
    res.json({ ok: true, backups });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ── Start ─────────────────────────────────────────────────────────────────────
function start() {
  const port = parseInt(process.env.DASHBOARD_PORT) || 3210;
  const host = process.env.DASHBOARD_HOST || '0.0.0.0';
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      log.info(`Dashboard running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
      log.info(`SERVER_READY_PORT_${port}`);
      console.log(`SERVER_READY_PORT_${port}`);
      resolve(server);
    });
    server.on('error', (err) => {
      log.error('Dashboard listen failed', { error: err.message, port, host });
      reject(err);
    });
  });
}

// ── Send Media (Voice Note) ──────────────────────────────────────────────────
// POST /api/send-media — send audio/media file to WhatsApp contact
// Body: { to: string, caption?: string }
// Multipart: file field "media" containing the audio file
const multer = (() => { try { return require('multer'); } catch (_) { return null; } })();
if (multer) {
  const upload = multer({ dest: path.join(process.cwd(), 'data', 'tmp-media'), limits: { fileSize: 20 * 1024 * 1024 } });
  app.post('/api/send-media', upload.single('media'), async (req, res) => {
    try {
      const to = req.body?.to;
      if (!to) return res.status(400).json({ ok: false, error: 'to is required' });
      const filePath = req.file?.path;
      if (!filePath || !fs.existsSync(filePath)) return res.status(400).json({ ok: false, error: 'media file required' });
      const client = whatsappSession.getClient?.() || null;
      if (!client) return res.status(503).json({ ok: false, error: 'WhatsApp client not connected' });
      const { sendMediaFile } = require('../whatsapp/reply-service');
      const caption = req.body?.caption || '';
      const sent = await sendMediaFile(client, to, filePath, caption);
      // Clean up temp file
      try { fs.unlinkSync(filePath); } catch (_) {}
      res.json({ ok: sent, to, caption, media: req.file?.originalname || 'voice.mp3' });
    } catch (err) {
      log.error('Send media failed', { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { start, app, setWhatsappSession };
