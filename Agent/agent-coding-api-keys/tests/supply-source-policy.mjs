/**
 * Source-level supply pool policy tests.
 *
 * Run after npm run build:
 *   node tests/supply-source-policy.mjs
 */

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';

let failed = 0;
function assert(condition, message, detail = '') {
  if (condition) {
    console.log(`${PASS} ${message}`);
  } else {
    failed++;
    console.error(`${FAIL} ${message}${detail ? `\n  ${detail}` : ''}`);
  }
}

const { modelQuotaService } = await import('../dist/runtime/model-quota-service.js');

const realNow = Date.now;
const key1 = { id: 'db-1', value: 'AGOP-6094-test-key1', active: true, label: 'NKQ Key 1' };
const key2 = { id: 'db-15', value: 'AGOP-7B43-test-key2', active: true, label: 'NKQ Key 2' };
const opus = { id: 'opus-key', value: 'sk-opusmax-test-key', active: true, label: 'OpusMax' };

function ids(candidates) {
  return candidates.map((candidate) => candidate.sourceId);
}

try {
  {
    const c = modelQuotaService.getSourceCandidates('antigravity', [key1, key2], 'claude-opus-4-6', 'claude-opus-4-6');
    const sourceIds = ids(c);
    assert(sourceIds.includes('nkq-key1-opus-4-7'), 'NKQ key1 Opus 4.7 appears as separate supply source', JSON.stringify(sourceIds));
    assert(sourceIds.includes('nkq-key1-opus-4-6'), 'NKQ key1 Opus 4.6 appears as separate supply source', JSON.stringify(sourceIds));
    assert(sourceIds.includes('nkq-key2-opus-4-6'), 'NKQ key2 Opus 4.6 appears as separate supply source', JSON.stringify(sourceIds));
  }

  {
    const c = modelQuotaService.getSourceCandidates('antigravity', [key2], 'claude-opus-4-7', 'claude-opus-4-7');
    assert(c.length === 0, 'NKQ key2 is not selected for Opus 4.7', JSON.stringify(c));
  }

  {
    const c = modelQuotaService.getSourceCandidates('opusmax', [opus], 'claude-opus-4-6', 'claude-opus-4-6');
    const models = c.map((candidate) => candidate.model);
    assert(models.includes('claude-opus-4-6'), 'OpusMax standard request tries raw 4.6 first', JSON.stringify(models));
    assert(models.includes('claude-opus-4-6-standard'), 'OpusMax standard request keeps standard as fallback', JSON.stringify(models));
    assert(models.includes('claude-opus-4-7') && models.includes('claude-opus-4-8') && models.includes('auto'), 'OpusMax standard request can switch to raw alternate pools and auto', JSON.stringify(models));
    assert(ids(c).includes('opusmax-opus-4-7') && ids(c).includes('opusmax-opus-4-8'), 'OpusMax fallback can switch model account pool', JSON.stringify(ids(c)));
  }

  {
    const c = modelQuotaService.getSourceCandidates('opusmax', [opus], 'claude-opus-4-6-thinking', 'claude-opus-4-6-thinking');
    const models = c.map((candidate) => candidate.model);
    assert(models.includes('claude-opus-4-6-thinking'), 'OpusMax thinking request tries thinking model first', JSON.stringify(models));
    assert(models.includes('claude-opus-4-6'), 'OpusMax thinking request falls back to raw when thinking pool is unavailable', JSON.stringify(models));
    assert(models.includes('claude-opus-4-7') && models.includes('claude-opus-4-8') && models.includes('auto'), 'OpusMax thinking request includes raw alternate pools and auto', JSON.stringify(models));
  }

  {
    Date.now = () => 0;
    const w0 = modelQuotaService.getCurrentSourceWindow([
      'nkq-key1-opus-4-7',
      'nkq-key1-opus-4-6',
      'nkq-key2-opus-4-6',
      'opusmax-opus-4-6',
      'opusmax-opus-4-7',
      'opusmax-opus-4-8',
    ]);
    Date.now = () => 5 * 60 * 1000;
    const w1 = modelQuotaService.getCurrentSourceWindow([
      'nkq-key1-opus-4-7',
      'nkq-key1-opus-4-6',
      'nkq-key2-opus-4-6',
      'opusmax-opus-4-6',
      'opusmax-opus-4-7',
      'opusmax-opus-4-8',
    ]);
    assert(w0.activeSource === 'nkq-key1-opus-4-7', 'Source rotation starts at NKQ key1 Opus 4.7', JSON.stringify(w0));
    assert(w1.activeSource === 'nkq-key1-opus-4-6', 'Source rotation advances after 5 minutes', JSON.stringify(w1));
  }

  {
    Date.now = () => 1_000_000;
    const [source] = modelQuotaService.getSourceCandidates('opusmax', [opus], 'claude-opus-4-6', 'claude-opus-4-6-standard');
    modelQuotaService.resetSource(source.sourceId);
    modelQuotaService.markSourceFailure(source, 'rate_limited', 'HTTP 429');
    assert(modelQuotaService.canUseSource(source) === false, 'Rate-limited source is skipped immediately');
    Date.now = () => 1_061_000;
    assert(modelQuotaService.canUseSource(source) === true, 'Cooldown source auto-returns after cooldown expires');
  }

  {
    Date.now = () => 2_000_000;
    const [source] = modelQuotaService.getSourceCandidates('opusmax', [opus], 'claude-opus-4-6', 'claude-opus-4-6-standard');
    modelQuotaService.resetSource(source.sourceId);
    modelQuotaService.markSourceFailure(source, 'provider_down', 'HTTP 502 upstream_err');
    assert(modelQuotaService.canUseSource(source) === true, 'OpusMax provider_down remains callable because quota may still be available');
  }

  {
    Date.now = () => 3_000_000;
    const [source] = modelQuotaService.getSourceCandidates('opusmax', [opus], 'claude-opus-4-6', 'claude-opus-4-6-standard');
    modelQuotaService.resetSource(source.sourceId);
    modelQuotaService.markSourceFailure(source, 'timeout', 'AbortError: timed out');
    assert(modelQuotaService.canUseSource(source) === true, 'OpusMax timeout remains callable because quota may still be available');
  }
} finally {
  Date.now = realNow;
}

if (failed > 0) {
  console.error(`\n${failed} supply source policy test(s) failed`);
  process.exit(1);
}

console.log('\nAll supply source policy tests passed');
