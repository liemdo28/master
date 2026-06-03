/**
 * Provider fallback policy tests.
 *
 * Run after npm run build:
 *   node tests/provider-fallback-policy.mjs
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

const modelMap = await import('../dist/runtime/provider-model-map.js');
const classifier = await import('../dist/runtime/upstream-error-classifier.js');
const keyRotation = await import('../dist/runtime/api-key-rotation-service.js');

{
  const resolved = modelMap.resolveRuntimeModelDetailed('opusmax', 'claude-opus-4-7');
  assert(resolved.resolvedModel === 'gpt-5.4', 'Opus 4.7 request resolves to OpusMax STANDARD runtime alias', JSON.stringify(resolved));
  assert(resolved.reason === 'opusmax_standard_alias', 'STANDARD alias reason is visible in diagnostics', JSON.stringify(resolved));
}

{
  const resolved = modelMap.resolveRuntimeModelDetailed('opusmax', 'claude-opus-4-8');
  assert(resolved.resolvedModel === 'gpt-5.4', 'Opus 4.8 request resolves to OpusMax STANDARD runtime alias', JSON.stringify(resolved));
}

{
  const err = classifier.classifyUpstreamError(403, '{"error":"model_locked: claude-opus-4.7 requires premium tier"}');
  assert(err.type === 'model_locked', '403 model_locked is not treated as invalid auth', JSON.stringify(err));
  assert(classifier.shouldDisableKeyForError(err.type) === false, 'model_locked does not disable key');
  assert(classifier.shouldTripProviderForError(err.type) === false, 'model_locked does not trip provider health');
}

{
  const err = classifier.classifyUpstreamError(400, '{"error":"model_not_allowed"}');
  assert(err.type === 'model_not_allowed', 'model_not_allowed is classified exactly', JSON.stringify(err));
  assert(classifier.shouldDisableKeyForError(err.type) === false, 'model_not_allowed leaves key healthy');
}

{
  const err = classifier.classifyUpstreamError(402, '{"error":"quota exceeded"}');
  assert(err.type === 'quota_exceeded', 'quota exhausted is classified exactly', JSON.stringify(err));
  assert(classifier.shouldDisableKeyForError(err.type) === true, 'quota exhausted disables/cools down key');
}

{
  const err = classifier.classifyUpstreamError(401, '{"error":"invalid_api_key"}');
  assert(err.type === 'auth_failed', 'invalid key is classified as auth_failed', JSON.stringify(err));
  assert(classifier.shouldDisableKeyForError(err.type) === true, 'invalid key disables key');
}

{
  const svc = new keyRotation.ApiKeyRotationService();
  const key = { id: 'k1', value: 'secret', active: true };
  svc.markFailure('opusmax', key.id, 'model_not_allowed', 'model_not_allowed');
  assert(svc.isKeyUsable('opusmax', key) === true, 'model_not_allowed does not make key unusable');
  svc.markFailure('opusmax', key.id, 'auth_failed', 'invalid key');
  assert(svc.isKeyUsable('opusmax', key) === false, 'auth_failed makes key unusable');
}

if (failed > 0) {
  console.error(`\n${failed} provider fallback policy test(s) failed`);
  process.exit(1);
}

console.log('\nAll provider fallback policy tests passed');
