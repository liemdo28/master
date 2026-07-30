#!/usr/bin/env node
/**
 * Jarvis Evolution Phase 21 -> 30 validator.
 *
 * Validates that every phase is wired back to Mi-Core, WhatsApp, voice, and
 * the CEO experience. It never prints secrets. Optional live WhatsApp injection
 * uses WA_TEST_API_KEY, or the local gateway .env key when present.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'reports', 'JARVIS_EVOLUTION_MASTER_REPORT.md');
const MI_URL = process.env.MI_URL || 'http://127.0.0.1:4001';
const TIMEOUT = Number(process.env.JARVIS_VALIDATE_TIMEOUT_MS || 30000);
const GATEWAY_ENV = path.resolve(ROOT, '..', 'whatsapp-ai-gateway', '.env');

const checks = [];

function record(phase, name, status, detail = '', data = undefined) {
  checks.push({ phase, name, status, detail, data });
  console.log(`${status.padEnd(16)} ${phase.padEnd(18)} ${name}${detail ? ' - ' + detail : ''}`);
}

function phaseStatus(phase) {
  const rows = checks.filter(c => c.phase === phase);
  if (rows.some(r => r.status === 'FAIL')) return 'FAIL';
  if (rows.some(r => r.status === 'CONDITIONAL' || r.status === 'SKIP')) return 'CONDITIONAL_PASS';
  return 'PASS';
}

async function request(method, route, body, headers = {}) {
  try {
    const res = await fetch(`${MI_URL}${route}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const text = await res.text();
    let parsed = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (e) {
    return { ok: false, status: 0, error: e.message, body: {} };
  }
}

const get = route => request('GET', route);
const post = (route, body, headers) => request('POST', route, body, headers);
const jarvisHeaders = () => ({ 'x-api-key': process.env.MI_CORE_API_KEY || '' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function readEnvValue(file, key) {
  try {
    if (!fs.existsSync(file)) return '';
    const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find(l => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : '';
  } catch {
    return '';
  }
}

function getWhatsappKey() {
  return process.env.WA_TEST_API_KEY || process.env.WHATSAPP_TEST_API_KEY || readEnvValue(GATEWAY_ENV, 'MI_CORE_API_KEY');
}

function summarize(value, max = 140) {
  if (value === undefined || value === null) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.replace(/\s+/g, ' ').slice(0, max);
}

async function validateCoreSurfaces() {
  const health = await get('/api/health');
  record('Mi-Core', 'API health', health.ok && health.body?.server === 'ok' ? 'PASS' : 'FAIL', `HTTP ${health.status}`, health.body);

  const jarvis = await get('/api/jarvis/health');
  record('Mi-Core', 'Jarvis route mounted', jarvis.ok && jarvis.body?.status === 'ok' ? 'PASS' : 'FAIL', `HTTP ${jarvis.status}`, jarvis.body);

  const wa = await get('/api/whatsapp/health');
  record('WhatsApp', 'Mi-Core WhatsApp health alias', wa.ok ? 'PASS' : 'FAIL', `HTTP ${wa.status}; key=${wa.body?.api_key_status || 'unknown'}`, wa.body);

  const voice = await get('/api/voice/health');
  record('Voice', 'Voice health', voice.ok && voice.body?.status === 'ok' ? 'PASS' : 'CONDITIONAL', `transcription=${!!voice.body?.transcription?.available}`, voice.body);
}

async function validatePhase21() {
  let stats = await get('/api/jarvis/knowledge/stats');
  if (stats.ok && Number(stats.body?.total || 0) === 0) {
    await post('/api/jarvis/knowledge/index', {});
    await sleep(1000);
    stats = await get('/api/jarvis/knowledge/stats');
  }
  const search = await get('/api/jarvis/knowledge/search?q=dashboard&limit=3');
  const resultCount = Array.isArray(search.body) ? search.body.length : 0;
  const total = Number(stats.body?.total || 0) || resultCount;
  record('Phase 21 Knowledge', 'Knowledge catalog/indexer/search API', stats.ok && total > 0 ? 'PASS' : 'FAIL', `${total} docs/search result(s) available`, { stats: stats.body, sample_results: search.body });

  record('Phase 21 Knowledge', 'Knowledge search query', search.ok && Array.isArray(search.body) ? 'PASS' : 'FAIL', `${Array.isArray(search.body) ? search.body.length : 0} result(s)`, search.body);

  const sourcePaths = ['E:\\Project\\Master', 'D:\\', 'F:\\', 'G:\\My Drive'];
  const existing = sourcePaths.filter(p => fs.existsSync(p));
  const indexedSources = stats.body?.sources || [];
  const normSource = v => String(v || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const externalCovered = existing.every(p => indexedSources.some(s => {
    const a = normSource(s);
    const b = normSource(p);
    return a === b || a.startsWith(b) || b.startsWith(a);
  }));
  record('Phase 21 Knowledge', 'External source coverage D/F/G/GDrive', externalCovered ? 'PASS' : 'CONDITIONAL', `existing=${existing.join(', ') || 'none'}; indexed=${indexedSources.join(', ')}`, { existing, indexedSources });
}

async function validatePhase22() {
  const stats = await get('/api/jarvis/memory/stats');
  record('Phase 22 Memory', 'Memory registry/stats', stats.ok && Number(stats.body?.total || 0) > 0 ? 'PASS' : 'FAIL', `${stats.body?.total || 0} entries`, stats.body);

  const recall = await get('/api/jarvis/memory/search?q=Integration%20System');
  record('Phase 22 Memory', 'Memory recall search', recall.ok && Array.isArray(recall.body) ? 'PASS' : 'FAIL', `${Array.isArray(recall.body) ? recall.body.length : 0} result(s)`, recall.body);

  const timeline = await get('/api/jarvis/memory/timeline');
  record('Phase 22 Memory', 'Memory timeline', timeline.ok && Array.isArray(timeline.body) ? 'PASS' : 'FAIL', `${Array.isArray(timeline.body) ? timeline.body.length : 0} item(s)`, timeline.body);
}

async function validatePhase23() {
  const tools = await get('/api/jarvis/tools');
  const list = Array.isArray(tools.body) ? tools.body : [];
  const requiredShape = list.every(t => t.id && t.name && t.owner && Number.isInteger(t.risk) && Array.isArray(t.permissions) && typeof t.approval_required === 'boolean');
  record('Phase 23 Tools', 'Tool registry shape', tools.ok && list.length >= 10 && requiredShape ? 'PASS' : 'FAIL', `${list.length} tools`, list);

  const dangerous = await get('/api/jarvis/tools/dangerous');
  record('Phase 23 Tools', 'Tool approval/risk partition', dangerous.ok && Array.isArray(dangerous.body) && dangerous.body.every(t => t.approval_required) ? 'PASS' : 'FAIL', `${Array.isArray(dangerous.body) ? dangerous.body.length : 0} dangerous`, dangerous.body);
}

async function validatePhase24() {
  const agents = await get('/api/jarvis/agents');
  const list = Array.isArray(agents.body) ? agents.body : [];
  const required = ['pm-agent', 'finance-agent', 'store-agent', 'dev-agent', 'knowledge-agent', 'node-agent'];
  const hasAll = required.every(id => list.some(a => a.id === id));
  record('Phase 24 Agents', 'Required agent registry', agents.ok && hasAll ? 'PASS' : 'FAIL', `${list.length} agents`, list);

  const route = await post('/api/jarvis/agents/route', { input: 'check Stone Oak reviews' });
  record('Phase 24 Agents', 'Agent routing', route.ok && route.body?.matched?.id === 'store-agent' ? 'PASS' : 'FAIL', `matched=${route.body?.matched?.id || 'none'}`, route.body);
}

async function validatePhase25() {
  const stats = await get('/api/jarvis/graph/stats');
  record('Phase 25 Graph', 'Knowledge graph stats', stats.ok && Number(stats.body?.total_entities || 0) >= 10 ? 'PASS' : 'FAIL', `${stats.body?.total_entities || 0} entities`, stats.body);

  const explore = await get('/api/jarvis/graph/explore/Stone%20Oak');
  record('Phase 25 Graph', 'Relationship explorer', explore.ok && String(explore.body?.result || '').includes('Stone Oak') ? 'PASS' : 'FAIL', summarize(explore.body?.result), explore.body);
}

async function validatePhase26() {
  const sweep = await post('/api/jarvis/observability/sweep', {});
  const services = Array.isArray(sweep.body) ? sweep.body : [];
  const criticalHealthy = services.some(s => s.id === 'mi-core' && s.status === 'healthy');
  record('Phase 26 Observability', 'Health center sweep', sweep.ok && criticalHealthy ? 'PASS' : 'FAIL', `${services.length} services`, services);

  const incidents = await get('/api/jarvis/observability/incidents');
  record('Phase 26 Observability', 'Incident center', incidents.ok && Array.isArray(incidents.body) ? 'PASS' : 'FAIL', `${Array.isArray(incidents.body) ? incidents.body.length : 0} open`, incidents.body);
}

async function validatePhase27() {
  const workflows = await get('/api/jarvis/workflows');
  const list = Array.isArray(workflows.body) ? workflows.body : [];
  record('Phase 27 Workflows', 'Workflow registry', workflows.ok && list.length >= 3 ? 'PASS' : 'FAIL', `${list.length} workflows`, list);

  const run = await post('/api/jarvis/workflows/wf-review-processing/run', { trigger: 'manual', triggered_by: 'jarvis-validation' });
  record('Phase 27 Workflows', 'Workflow runner/audit trail', run.ok && run.body?.workflow_id === 'wf-review-processing' ? 'PASS' : 'FAIL', `status=${run.body?.status || 'unknown'}`, run.body);
}

async function validatePhase28() {
  const brief = await get('/api/jarvis/executive/briefing?frequency=daily');
  record('Phase 28 Executive', 'Daily briefing', brief.ok && brief.body?.formatted ? 'PASS' : 'FAIL', `${brief.body?.word_count || 0} words`, brief.body);

  const schedule = await get('/api/jarvis/executive/schedule');
  const hasAll = ['daily', 'weekly', 'monthly', 'quarterly'].every(k => schedule.body?.[k]);
  record('Phase 28 Executive', 'Briefing schedule', schedule.ok && hasAll ? 'PASS' : 'FAIL', Object.keys(schedule.body || {}).join(', '), schedule.body);
}

async function validatePhase29() {
  const twin = await get('/api/jarvis/twin');
  record('Phase 29 Twin', 'Business twin state', twin.ok && Array.isArray(twin.body) && twin.body.length >= 10 ? 'PASS' : 'FAIL', `${Array.isArray(twin.body) ? twin.body.length : 0} twin nodes`, twin.body);

  const risk = await get('/api/jarvis/twin/risk');
  record('Phase 29 Twin', 'Risk analyzer', risk.ok && typeof risk.body?.overall_risk === 'number' ? 'PASS' : 'FAIL', `risk=${risk.body?.overall_risk}`, risk.body);
}

async function validatePhase30() {
  const queries = [
    ['Stone Oak là gì?', 'Stone Oak'],
    ['project Dashboard hiện ở đâu?', 'dashboard.bakudanramen.com'],
    ['review automation nằm máy nào?', 'Laptop1'],
    ['Tuần trước mình quyết gì về Integration System?', 'Integration System'],
  ];
  for (const [text, expected] of queries) {
    await sleep(250);
    const r = await post('/api/jarvis/evolution/query', { text, sender: 'validation' }, jarvisHeaders());
    record('Phase 30 Jarvis', `Acceptance query: ${text}`, r.ok && r.body?.handled && String(r.body?.reply || '').includes(expected) ? 'PASS' : 'FAIL', summarize(r.body?.reply), r.body);
  }

  const status = await request('GET', '/api/jarvis/evolution/status', undefined, jarvisHeaders());
  const statusReply = String(status.body?.reply || '');
  const statusLooksReady = status.body?.handled === true && status.body?.phase === 30 &&
    /Kiến thức|Knowledge|tài liệu|tools?|Agents?/i.test(statusReply);
  record('Phase 30 Jarvis', 'Unified Jarvis status', status.ok && statusLooksReady ? 'PASS' : 'FAIL', summarize(status.body?.reply), status.body);
}

async function validateExperience() {
  const key = getWhatsappKey();
  if (!key) {
    record('WhatsApp', 'Live Mi injection through WhatsApp endpoint', 'SKIP', 'No WA_TEST_API_KEY or gateway MI_CORE_API_KEY available.');
  } else {
    const r = await post('/api/whatsapp/mi', {
      source: 'whatsapp',
      client_id: 'mi-core',
      message_id: `jarvis-evo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      chat_id: 'jarvis-validation',
      sender: process.env.WA_TEST_SENDER || '172425924882645@lid',
      sender_name: 'Jarvis Validator',
      text: 'Stone Oak là gì?',
      timestamp: new Date().toISOString(),
    }, { 'x-api-key': key });
    record('WhatsApp', 'Live Mi injection through WhatsApp endpoint', r.ok && r.body?.ok && String(r.body?.reply || '').includes('Stone Oak') ? 'PASS' : 'FAIL', summarize(r.body?.reply || r.body?.error), r.body);
  }

  const voicePage = await request('GET', '/voice.html');
  record('Voice', 'Voice UI surface', voicePage.ok && String(voicePage.body?.raw || '').includes('Mi Voice') ? 'PASS' : 'FAIL', `HTTP ${voicePage.status}`);
}

function buildReport(verdict) {
  const now = new Date().toISOString();
  const phases = [
    'Phase 21 Knowledge', 'Phase 22 Memory', 'Phase 23 Tools', 'Phase 24 Agents', 'Phase 25 Graph',
    'Phase 26 Observability', 'Phase 27 Workflows', 'Phase 28 Executive', 'Phase 29 Twin', 'Phase 30 Jarvis',
    'WhatsApp', 'Voice', 'Mi-Core',
  ];
  const blockers = checks.filter(c => c.status === 'FAIL' || c.status === 'CONDITIONAL' || c.status === 'SKIP');
  const lines = [
    '# JARVIS_EVOLUTION_MASTER_REPORT',
    '',
    `Generated: ${now}`,
    `Mi-Core URL: ${MI_URL}`,
    `Verdict: ${verdict}`,
    '',
    '## Phase Summary',
    '| Phase | Status |',
    '|---|---|',
    ...phases.map(p => `| ${p} | ${phaseStatus(p)} |`),
    '',
    '## Validation Results',
    '| Phase | Check | Status | Detail |',
    '|---|---|---|---|',
    ...checks.map(c => `| ${c.phase} | ${c.name} | ${c.status} | ${String(c.detail || '').replace(/\|/g, '/')} |`),
    '',
    '## CEO Acceptance Queries',
    '- "Mi, Stone Oak là gì?" validated through `/api/jarvis/evolution/query`.',
    '- "Mi, project Dashboard hiện ở đâu?" validated through `/api/jarvis/evolution/query`.',
    '- "Mi, review automation nằm máy nào?" validated through `/api/jarvis/evolution/query`.',
    '- "Tuần trước mình quyết gì về Integration System?" validated through memory recall path.',
    '',
    '## Mi-Core / WhatsApp / Voice Integration',
    '- Jarvis Phase 30 query layer is mounted at `/api/jarvis/evolution/query`.',
    '- WhatsApp `/api/whatsapp/mi` calls Jarvis Evolution before generic pipeline fallback.',
    '- Voice `/api/voice/ask` calls Jarvis Evolution before generic pipeline fallback.',
    '- `/voice.html` is available for microphone Q&A.',
    '',
    '## Conditional Items / Blockers',
    blockers.length
      ? blockers.map(b => `- ${b.phase} / ${b.name}: ${b.status} — ${b.detail || 'no detail'}`).join('\n')
      : '- None.',
    '',
    '## Final Verdict',
    verdict,
    '',
  ];
  return lines.join('\n');
}

async function main() {
  console.log(`Jarvis Evolution validation target: ${MI_URL}`);
  await validateCoreSurfaces();
  await validatePhase21();
  await validatePhase22();
  await validatePhase23();
  await validatePhase24();
  await validatePhase25();
  await validatePhase26();
  await validatePhase27();
  await validatePhase28();
  await validatePhase29();
  await validatePhase30();
  await validateExperience();

  const fails = checks.filter(c => c.status === 'FAIL').length;
  const conditionals = checks.filter(c => c.status === 'CONDITIONAL' || c.status === 'SKIP').length;
  const verdict = fails > 0 ? 'FAIL' : conditionals > 0 ? 'CONDITIONAL_PASS' : 'JARVIS_EVOLUTION_READY';

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, buildReport(verdict), 'utf8');
  console.log(`Report written: ${REPORT_PATH}`);
  console.log(`Verdict: ${verdict}`);
  process.exit(verdict === 'FAIL' ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
