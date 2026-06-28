/**
 * Phase P10 — Production Hardening
 * OpenTelemetry tracing, retry policies, flow gap detection, 24h burn-in
 * Target: PRODUCTION_HARDENED
 * Run: node tests/cert-p10-production-hardening.mjs
 */
import { createRequire } from 'module';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require   = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST      = path.resolve(__dirname, '../server/dist');
const EVIDENCE  = path.resolve(__dirname, '../reports/evidence/p10-hardening');
fs.mkdirSync(EVIDENCE, { recursive: true });

const {
  OtelTracer, withRetry,
  detectFlowGaps, runBurnInCheck,
  getPerformanceDashboard, formatPerformanceDashboard,
  DEFAULT_RETRY, AGGRESSIVE_RETRY, CONSERVATIVE_RETRY,
} = require(`${DIST}/coo-v4/production-hardening.js`);

let passed = 0, failed = 0;

async function check(name, fn) {
  try {
    const ok = await fn();
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    if (ok) passed++; else failed++;
    return ok;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
    return false;
  }
}

console.log('\n⚡ Phase P10 — Production Hardening Certification');
console.log('   OTel Tracing  |  Retry Policies  |  Burn-in  |  Flow Gaps');
console.log('═'.repeat(60));

// ── [1] OpenTelemetry Tracing ──────────────────────────────────────────────
console.log('\n[1] OpenTelemetry Tracing');

let traceResult;
await check('OtelTracer creates trace with spans', async () => {
  const tracer = new OtelTracer('p10-certification-run');
  const span1  = tracer.startSpan('ceo_command_parse', { command: 'Audit Dashboard', language: 'vi' });
  await new Promise(r => setTimeout(r, 20));
  span1.addEvent('nlp_complete', { action: 'audit', confidence: 0.92 });
  span1.end('OK');

  const span2 = tracer.startSpan('agent_execute', { agent: 'ai_developer' }, span1['span'].span_id);
  await new Promise(r => setTimeout(r, 30));
  span2.addEvent('code_reviewed', { files: 3 });
  span2.end('OK');

  traceResult = tracer.finish('OK');
  return traceResult.spans.length === 2 && traceResult.status === 'OK' && traceResult.total_ms >= 50;
});

await check('Trace has correct structure (trace_id, spans, timing)', () => {
  return !!(traceResult?.trace_id?.startsWith('tr_') &&
    traceResult.spans[0]?.span_id?.startsWith('sp_') &&
    traceResult.spans[0]?.duration_ms >= 0 &&
    traceResult.spans[1]?.parent_id);
});

await check('Trace persisted to traces.json', () => {
  const p = 'D:/Project/Master/.local-agent-global/coo-v4/traces.json';
  if (!fs.existsSync(p)) return false;
  const traces = JSON.parse(fs.readFileSync(p, 'utf8'));
  return traces.some(t => t.trace_id === traceResult.trace_id);
});

await check('ERROR trace records failure correctly', () => {
  const tracer = new OtelTracer('p10-error-trace');
  const span = tracer.startSpan('failing_agent', { agent: 'social' });
  span.addEvent('error_occurred', { error: 'FB_PAGE_TOKEN not set' });
  span.end('ERROR');
  const t = tracer.finish('ERROR');
  return t.status === 'ERROR' && t.spans[0].status === 'ERROR';
});

// ── [2] Retry Policies ─────────────────────────────────────────────────────
console.log('\n[2] Retry Policies');

await check('withRetry succeeds on first try', async () => {
  let calls = 0;
  const r = await withRetry(() => { calls++; return Promise.resolve('done'); }, DEFAULT_RETRY, 'test-op');
  return r === 'done' && calls === 1;
});

await check('withRetry retries on failure then succeeds', async () => {
  let calls = 0;
  const r = await withRetry(
    () => { calls++; if (calls < 3) throw new Error('temp fail'); return Promise.resolve('ok'); },
    { ...DEFAULT_RETRY, initial_delay_ms: 10 },
    'retry-test',
  );
  return r === 'ok' && calls === 3;
});

await check('withRetry throws after max_attempts', async () => {
  let calls = 0;
  try {
    await withRetry(
      () => { calls++; throw new Error('permanent fail'); },
      { max_attempts: 2, initial_delay_ms: 10, backoff_factor: 1, max_delay_ms: 100 },
      'max-retry-test',
    );
    return false;
  } catch (e) {
    return e.message === 'permanent fail' && calls === 2;
  }
});

await check('AGGRESSIVE_RETRY has more attempts than DEFAULT_RETRY', () => {
  return AGGRESSIVE_RETRY.max_attempts > DEFAULT_RETRY.max_attempts &&
    AGGRESSIVE_RETRY.initial_delay_ms < DEFAULT_RETRY.initial_delay_ms;
});

await check('CONSERVATIVE_RETRY has longer delays than DEFAULT_RETRY', () => {
  return CONSERVATIVE_RETRY.initial_delay_ms > DEFAULT_RETRY.initial_delay_ms;
});

// ── [3] Flow Gap Detector ──────────────────────────────────────────────────
console.log('\n[3] Flow Gap Detector');

let gaps;
await check('detectFlowGaps runs without error', () => {
  gaps = detectFlowGaps();
  return Array.isArray(gaps);
});

await check('Flow gaps have correct structure', () => {
  if (gaps.length === 0) return true; // no gaps is fine
  const g = gaps[0];
  return !!(g.type && g.severity && g.target && g.description && g.suggested_fix && g.detected_at);
});

await check('Gap severities are valid', () => {
  return gaps.every(g => ['high', 'medium', 'low'].includes(g.severity));
});

await check('Gap types are valid', () => {
  const valid = ['stuck_workflow', 'open_circuit', 'orphan_workflow', 'missing_evidence', 'stale_trace'];
  return gaps.every(g => valid.includes(g.type));
});

// ── [4] 24h Burn-in Health Check ──────────────────────────────────────────
console.log('\n[4] 24h Burn-in Health Check');

let burnIn;
await check('runBurnInCheck executes successfully', () => {
  burnIn = runBurnInCheck();
  return typeof burnIn.score === 'number' && Array.isArray(burnIn.checks) && burnIn.status;
});

await check('Burn-in score is 0–100', () => {
  return burnIn.score >= 0 && burnIn.score <= 100;
});

await check('Status is HEALTHY, DEGRADED, or CRITICAL', () => {
  return ['HEALTHY', 'DEGRADED', 'CRITICAL'].includes(burnIn.status);
});

await check('All check items have ok + detail fields', () => {
  return burnIn.checks.every(c => typeof c.ok === 'boolean' && typeof c.detail === 'string');
});

await check('Executive memory check passes', () => {
  const mem = burnIn.checks.find(c => c.name === 'executive_memory');
  return mem?.ok === true;
});

await check('Google tokens check passes', () => {
  const tok = burnIn.checks.find(c => c.name === 'google_tokens');
  return tok?.ok === true;
});

// ── [5] Performance Dashboard ──────────────────────────────────────────────
console.log('\n[5] Performance Dashboard');

let dash;
await check('getPerformanceDashboard runs', () => {
  dash = getPerformanceDashboard();
  return !!(dash.generated_at && dash.burn_in && dash.flow_gaps && dash.traces_summary && dash.circuit_breakers);
});

await check('formatPerformanceDashboard returns readable string', () => {
  const txt = formatPerformanceDashboard(dash);
  return typeof txt === 'string' && txt.length > 100 && txt.includes('System:') && txt.includes('Health Checks:');
});

await check('Circuit breakers have state + failures', () => {
  return Object.values(dash.circuit_breakers).every(cb => cb.state && typeof cb.failures === 'number');
});

await check('Traces summary has required fields', () => {
  const ts = dash.traces_summary;
  return typeof ts.total === 'number' && typeof ts.avg_ms === 'number' && typeof ts.error_rate === 'number';
});

// ── [6] Production Integration Test ───────────────────────────────────────
console.log('\n[6] Production Integration — Traced Jarvis Execution');

await check('Full traced CEO command pipeline', async () => {
  const { parseIntent }  = require(`${DIST}/coo-v4/nlp-engine.js`);
  const { quickPlan }    = require(`${DIST}/coo-v4/intent-engine.js`);
  const { classify }     = require(`${DIST}/coo-v4/production-governor.js`);

  const tracer = new OtelTracer('production-integration-test');

  const s1 = tracer.startSpan('nlp_parse');
  const intent = parseIntent('Audit Dashboard an toan?');
  s1.setAttribute('action',     intent.action);
  s1.setAttribute('confidence', intent.confidence);
  s1.addEvent('parsed', { language: intent.language });
  s1.end('OK');

  const s2 = tracer.startSpan('plan');
  const plan = quickPlan('Audit Dashboard an toan?');
  s2.setAttribute('steps', (plan.steps || []).length);
  s2.end('OK');

  const s3 = tracer.startSpan('governor');
  const gov = classify('Audit Dashboard', (plan.steps || []).map((s) => s.agent));
  s3.setAttribute('class', gov.class);
  s3.end(gov.class === 'BLOCKED' ? 'ERROR' : 'OK');

  const t = tracer.finish(gov.class === 'BLOCKED' ? 'ERROR' : 'OK');
  return t.spans.length === 3 && t.spans.every(s => s.duration_ms >= 0);
});

await check('Retry wrapped agent call succeeds', async () => {
  const { storeAnalysis } = require(`${DIST}/coo-v4/agents/business-agents.js`);
  const result = await withRetry(
    () => storeAnalysis('bakudan_ramen', 'last_30_days'),
    DEFAULT_RETRY,
    'store-analysis',
  );
  return result?.success !== false;
});

// ── Evidence ───────────────────────────────────────────────────────────────
const dashFormatted = formatPerformanceDashboard(dash);
console.log('\n' + dashFormatted.split('\n').slice(0, 12).map(l => '  ' + l).join('\n'));

const evidence = {
  phase:       'P10',
  target:      'PRODUCTION_HARDENED',
  passed, failed,
  burn_in:     burnIn,
  flow_gaps:   gaps,
  dashboard:   dash,
  traces_total: JSON.parse(fs.existsSync('D:/Project/Master/.local-agent-global/coo-v4/traces.json')
    ? fs.readFileSync('D:/Project/Master/.local-agent-global/coo-v4/traces.json', 'utf8')
    : '[]').length,
  generated_at: new Date().toISOString(),
};
fs.writeFileSync(path.join(EVIDENCE, 'evidence.json'), JSON.stringify(evidence, null, 2));
fs.writeFileSync(path.join(EVIDENCE, 'performance-dashboard.txt'), dashFormatted);

console.log('\n' + '═'.repeat(60));
console.log(`  PASSED: ${passed}  FAILED: ${failed}  TOTAL: ${passed + failed}`);
console.log(`  Burn-in: ${burnIn.status} (${burnIn.score}/100)`);
console.log(`  Flow gaps: ${gaps.length}`);
console.log(`  Evidence: reports/evidence/p10-hardening/`);
console.log('═'.repeat(60));

console.log(failed === 0
  ? '\n🎉 PRODUCTION_HARDENED\n   OTel ✅  Retry ✅  Flow-Gap ✅  Burn-in ✅  Dashboard ✅  Integration ✅'
  : `\n⚠️  P10_PARTIAL — ${failed} checks failed`);
process.exit(failed === 0 ? 0 : 1);
