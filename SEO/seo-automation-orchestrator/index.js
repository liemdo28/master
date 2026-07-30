#!/usr/bin/env node
/**
 * SEO Automation Orchestrator
 * Phase 5: Schedules daily/weekly/monthly jobs, dispatches to agents,
 * retries failed jobs, logs execution, pushes summaries to Mi-Core.
 * Phase 7: Real cron scheduler (node-cron) + retry, dedup, persistence.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MI_CORE_URL = process.env.MI_CORE_URL || 'http://localhost:4001';
const MI_API_KEY = process.env.MI_API_KEY || 'seo-internal-key';
const LOG_DIR = path.join(__dirname, 'logs');
const JOBS_FILE = path.join(__dirname, 'job-state.json');
const PORT = parseInt(process.env.PORT || '4020', 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);
const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS || '5000', 10);

// ── Job Definitions ─────────────────────────────────────────────────────────
const JOB_DEFINITIONS = {
  'daily-website-crawl':           { schedule: 'daily',  agent_port: 4011, endpoint: '/run/connectors?connector=crawler',          method: 'GET'  },
  'daily-gbp-sync':                { schedule: 'daily',  agent_port: 4011, endpoint: '/run/connectors?connector=gbp',              method: 'GET'  },
  'daily-gsc-sync':                { schedule: 'daily',  agent_port: 4011, endpoint: '/run/connectors?connector=gsc',              method: 'GET'  },
  'daily-ga4-sync':                { schedule: 'daily',  agent_port: 4011, endpoint: '/run/connectors?connector=ga4',              method: 'GET'  },
  'daily-schema-validation':       { schedule: 'daily',  agent_port: 4014, endpoint: '/run/audit',                                method: 'POST' },
  'daily-technical-audit':         { schedule: 'daily',  agent_port: 4013, endpoint: '/run/audit',                                method: 'POST' },
  'weekly-citation-scan':          { schedule: 'weekly', agent_port: 4011, endpoint: '/run/connectors?connector=citation_scan',   method: 'GET'  },
  'weekly-content-plan':           { schedule: 'weekly', agent_port: 4015, endpoint: '/run/audit',                                method: 'POST' },
  'weekly-executive-seo-report':   { schedule: 'weekly', agent_port: 4017, endpoint: '/run/audit',                                method: 'POST' },
  'monthly-full-seo-audit':        { schedule: 'monthly',agent_port: 4013, endpoint: '/run/audit',                                method: 'POST' },
};

let jobState = loadJobState();
let runningJobs = new Set();

function loadJobState() {
  try {
    if (fs.existsSync(JOBS_FILE)) return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
  } catch (_) {}
  return {};
}

function saveJobState() {
  try {
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobState, null, 2));
  } catch (e) { log('error', 'Failed to save job state', { error: e.message }); }
}

function log(level, message, data = {}) {
  const entry = { ts: new Date().toISOString(), level, message, ...data };
  console.log(JSON.stringify(entry));
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const logFile = path.join(LOG_DIR, `orchestrator-${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch (_) {}
}

// ── HTTP Helpers ────────────────────────────────────────────────────────────
function httpRequest(url, method, body, timeout = 120000) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? require('https') : http;
      const data = body ? JSON.stringify(body) : null;
      const opts = {
        method, hostname: parsed.hostname, port: parsed.port,
        path: parsed.pathname + parsed.search,
        headers: { 'Content-Type': 'application/json', 'X-API-Key': MI_API_KEY, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
        timeout,
      };
      const req = lib.request(opts, (res) => {
        let chunks = '';
        res.on('data', (d) => chunks += d);
        res.on('end', () => { try { resolve(JSON.parse(chunks)); } catch { resolve({ ok: false, raw: chunks }); } });
      });
      req.on('error', (e) => resolve({ ok: false, error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
      if (data) req.write(data);
      req.end();
    } catch (e) { resolve({ ok: false, error: e.message }); }
  });
}

async function pushToMi(path, payload) {
  return httpRequest(MI_CORE_URL + path, 'POST', payload);
}

// ── Job Execution ───────────────────────────────────────────────────────────
async function executeJob(jobId) {
  if (runningJobs.has(jobId)) { log('warn', 'Job already running, skipping', { jobId }); return null; }
  const def = JOB_DEFINITIONS[jobId];
  if (!def) { log('error', 'Unknown job', { jobId }); return null; }

  runningJobs.add(jobId);
  const runId = `${jobId}-${Date.now()}`;
  const startTime = Date.now();
  let attempt = 0;
  let lastError = null;
  let result = null;

  log('info', 'Job started', { jobId, runId, attempt: attempt + 1 });

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      const url = `http://localhost:${def.agent_port}${def.endpoint}`;
      result = await httpRequest(url, def.method, null);
      if (result.ok) break;
      lastError = result.error || 'Job returned ok=false';
      log('warn', 'Job attempt failed, retrying', { jobId, attempt, error: lastError });
    } catch (e) {
      lastError = e.message;
      log('warn', 'Job attempt error, retrying', { jobId, attempt, error: lastError });
    }
    if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
  }

  const duration_ms = Date.now() - startTime;
  const status = result && result.ok ? 'completed' : 'failed';
  runningJobs.delete(jobId);

  const jobRecord = {
    jobId, runId, status, attempts: attempt, duration_ms,
    started_at: new Date(startTime).toISOString(),
    completed_at: new Date().toISOString(),
    error: status === 'failed' ? lastError : null,
    result_summary: result ? { ok: result.ok, records: result.result?.records || result.results?.crawler?.records || 0 } : null,
  };

  jobState[jobId] = jobRecord;
  saveJobState();

  log('info', 'Job completed', { jobId, status, attempts: attempt, duration_ms });

  // Push summary to Mi-Core
  pushToMi('/api/seo/orchestrator/run/' + jobId, {}).catch(() => {});

  return jobRecord;
}

// ── Health Check ────────────────────────────────────────────────────────────
async function checkAgentHealth(port) {
  try {
    const result = await httpRequest(`http://localhost:${port}/health`, 'GET', null, 5000);
    return result.ok ? 'online' : 'error';
  } catch { return 'offline'; }
}

// ── HTTP Server ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const respond = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };

  if (req.method === 'GET' && req.url === '/health') {
    return respond(200, { ok: true, service: 'seo-automation-orchestrator', uptime_s: Math.floor(process.uptime()), jobs_defined: Object.keys(JOB_DEFINITIONS).length, jobs_running: runningJobs.size });
  }

  if (req.method === 'GET' && req.url === '/status') {
    const agentStatus = {};
    const ports = [...new Set(Object.values(JOB_DEFINITIONS).map(j => j.agent_port))];
    for (const p of ports) { agentStatus[p] = await checkAgentHealth(p); }
    return respond(200, { ok: true, job_state: jobState, agent_health: agentStatus, running_jobs: [...runningJobs], job_definitions: Object.keys(JOB_DEFINITIONS) });
  }

  if (req.method === 'POST' && req.url.startsWith('/run/')) {
    const jobId = req.url.replace('/run/', '').split('?')[0];
    if (!JOB_DEFINITIONS[jobId]) return respond(400, { ok: false, error: `Unknown job: ${jobId}` });
    const result = await executeJob(jobId);
    return respond(200, { ok: true, result });
  }

  if (req.method === 'POST' && req.url === '/run-all') {
    const results = {};
    for (const jobId of Object.keys(JOB_DEFINITIONS)) { results[jobId] = await executeJob(jobId); }
    return respond(200, { ok: true, results });
  }

  if (req.method === 'GET' && req.url === '/jobs') {
    return respond(200, { ok: true, definitions: JOB_DEFINITIONS, state: jobState });
  }

  respond(404, { ok: false, error: 'not_found' });
});

// ── Cron Scheduler ──────────────────────────────────────────────────────────
const CRON_SCHEDULES = {
  'daily':  '0 3 * * *',     // Every day at 3:00 AM
  'weekly': '0 4 * * 1',     // Every Monday at 4:00 AM
  'monthly': '0 5 1 * *',    // 1st of month at 5:00 AM
};

const scheduledTasks = {};

function startScheduler() {
  for (const [jobId, def] of Object.entries(JOB_DEFINITIONS)) {
    const pattern = CRON_SCHEDULES[def.schedule];
    if (!pattern) { log('warn', 'No cron pattern for schedule', { schedule: def.schedule, jobId }); continue; }
    if (!cron.validate(pattern)) { log('error', 'Invalid cron pattern', { pattern, jobId }); continue; }

    const task = cron.schedule(pattern, async () => {
      log('info', 'Cron triggered', { jobId, schedule: def.schedule });
      try { await executeJob(jobId); } catch (e) { log('error', 'Cron job failed', { jobId, error: e.message }); }
    }, { timezone: 'America/Chicago' });  // Central Time for Texas

    scheduledTasks[jobId] = { task, schedule: pattern, nextRun: 'per cron' };
    log('info', 'Job scheduled', { jobId, cron: pattern, schedule: def.schedule });
  }
  log('info', 'Scheduler started', { jobs: Object.keys(scheduledTasks).length });
}

// ── Start ───────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  startScheduler();
  log('info', 'SEO Automation Orchestrator started', { port: PORT, jobs: Object.keys(JOB_DEFINITIONS).length, scheduled: Object.keys(scheduledTasks).length });
  console.log(`[SEO Orchestrator] listening on port ${PORT}`);
  console.log(`[SEO Orchestrator] ${Object.keys(scheduledTasks).length} cron jobs scheduled`);
});

process.on('uncaughtException', (e) => log('error', 'uncaught', { error: e.message }));
process.on('unhandledRejection', (e) => log('error', 'unhandled', { error: String(e) }));

module.exports = { executeJob, JOB_DEFINITIONS };
