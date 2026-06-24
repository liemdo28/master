/**
 * API key rotation cooldown policy tests.
 *
 * Run after npm run build:
 *   node tests/api-key-rotation-policy.mjs
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

const { ApiKeyRotationService } = await import('../dist/runtime/api-key-rotation-service.js');
const service = new ApiKeyRotationService();
const nkqKey = { id: 'db-20', value: 'AGOP-B0D9-test' };
const otherKey = { id: 'other', value: 'test' };

service.markFailure('antigravity', nkqKey.id, 'provider_down', 'AI service temporarily unavailable.');
assert(
  service.isKeyUsable('antigravity', nkqKey) === true,
  'NKQ key remains usable after transient provider_down',
  JSON.stringify(service.getProviderKeyHealth('antigravity', [nkqKey])),
);

service.markFailure('antigravity', nkqKey.id, 'rate_limited', 'HTTP 429');
assert(
  service.isKeyUsable('antigravity', nkqKey) === false,
  'NKQ rate limit still applies cooldown',
  JSON.stringify(service.getProviderKeyHealth('antigravity', [nkqKey])),
);

service.markFailure('other-provider', otherKey.id, 'provider_down', 'HTTP 503');
assert(
  service.isKeyUsable('other-provider', otherKey) === false,
  'Other providers keep the normal provider_down cooldown',
  JSON.stringify(service.getProviderKeyHealth('other-provider', [otherKey])),
);

if (failed > 0) {
  console.error(`\n${failed} API key rotation policy test(s) failed`);
  process.exit(1);
}

console.log('\nAll API key rotation policy tests passed');
