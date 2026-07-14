import assert from 'node:assert/strict';
import { section, check, finalize } from './_harness.mjs';

process.env.NODE_ENV = 'test';
process.env.SEO_SECURITY_TEST_MODE = '1';

const mod = await import('../ai-providers/provider-gateway.ts');

section('Provider attribution and structured JSON');
{
  mod.__setLocalTextOverrideForTests(async () => ({
    text: '{"test_id":"seo-provider-probe","ok":true}',
    model: 'test-model',
  }));
  const result = await mod.generateStructured(
    [{ role: 'user', content: 'json please' }],
    { required: { test_id: 'string', ok: 'boolean' } },
    { promptVersion: 'test-v1' },
  );
  check('structured generation succeeds', result.ok === true);
  check('local model is attributed', result.provider === 'local_model' && result.model === 'test-model');
  check('schema fields parsed', result.parsed?.test_id === 'seo-provider-probe' && result.parsed?.ok === true);
  check('checksum recorded', typeof result.checksum === 'string' && result.checksum.length === 64);
}

section('Malformed output repair');
{
  let calls = 0;
  mod.__setLocalTextOverrideForTests(async () => {
    calls += 1;
    if (calls === 1) return { text: 'not json', model: 'test-model' };
    return { text: '```json\n{"test_id":"repaired","ok":true}\n```', model: 'test-model' };
  });
  const result = await mod.generateStructured(
    [{ role: 'user', content: 'json please' }],
    { required: { test_id: 'string', ok: 'boolean' } },
    { promptVersion: 'test-repair-v1' },
  );
  check('repair called provider twice', calls === 2);
  check('repaired JSON succeeds', result.ok === true && result.parsed?.test_id === 'repaired');
}

section('Fallback is explicit, not silent AI success');
{
  mod.__setLocalTextOverrideForTests(async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:11434');
  });
  const result = await mod.generateText(
    [{ role: 'user', content: 'hello' }],
    { fallbackText: 'template fallback', promptVersion: 'test-fallback-v1' },
  );
  check('fallback returns ok because fallback text supplied', result.ok === true);
  check('fallback provider is explicit', result.provider === 'policy_template');
  check('fallback status is explicit', result.provider_status === 'FALLBACK_ACTIVE' && result.fallback_used === true);
  check('network error category preserved', result.error_category === 'FAILED_NETWORK');
}

mod.__setLocalTextOverrideForTests(null);

const result = finalize('provider-gateway.mjs');
assert.equal(result.fail, 0);

