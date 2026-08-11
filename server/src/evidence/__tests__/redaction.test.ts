import * as assert from 'assert';
import { classifyRedaction, containsSecret, sanitizeCanonicalReference, sanitizeClaim } from '../redaction';

function main() {
  // ---- containsSecret: every pattern class from the shared secret-pattern set ----
  assert.ok(containsSecret('sk-abcdefghijklmnopqrstuvwx'));
  assert.ok(containsSecret('AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz0123456'));
  assert.ok(containsSecret('-----BEGIN RSA PRIVATE KEY-----'));
  assert.ok(containsSecret('refresh_token: "abc"'));
  assert.ok(containsSecret("client_secret='abc'"));
  assert.ok(containsSecret('api_key: "abcdefghijklmnop1234"'));
  assert.ok(containsSecret('password = "hunter2222"'));
  assert.ok(!containsSecret('a perfectly ordinary evidence claim about a proposal'));
  assert.ok(!containsSecret('the word password appears with no assignment'));
  console.log('[evidence-redaction] PASS: containsSecret matches every pattern class and no plain text');

  // ---- sanitizeClaim: full replacement, never partial masking, never leaks the match ----
  const withSecret = sanitizeClaim('client_secret: "abcdefghijklmnopqrstuvwx"');
  assert.ok(withSecret.startsWith('[redacted'));
  assert.ok(!withSecret.includes('abcdefghijklmnopqrstuvwx'));
  const plain = sanitizeClaim('a plain, ordinary claim');
  assert.strictEqual(plain, 'a plain, ordinary claim');
  const long = sanitizeClaim('x'.repeat(1000));
  assert.ok(long.length <= 501, 'claims must be bounded in length, never a full raw payload');
  console.log('[evidence-redaction] PASS: sanitizeClaim fully replaces secret-bearing text and bounds length');

  // ---- sanitizeCanonicalReference: never a credential-bearing string ----
  assert.strictEqual(sanitizeCanonicalReference('sk-abcdefghijklmnopqrstuvwx'), null);
  assert.strictEqual(sanitizeCanonicalReference(null), null);
  assert.strictEqual(sanitizeCanonicalReference('docs/architecture.md'), 'docs/architecture.md');
  console.log('[evidence-redaction] PASS: sanitizeCanonicalReference strips secret-bearing references entirely');

  // ---- classifyRedaction: deterministic default per (sourceSystem, category) ----
  assert.strictEqual(classifyRedaction('TASK_RUNTIME', 'HEALTH'), 'PUBLIC_SAFE');
  assert.strictEqual(classifyRedaction('GOVERNANCE', 'HEALTH'), 'SENSITIVE', 'governance anomalies must not default to PUBLIC_SAFE like a plain health counter');
  assert.strictEqual(classifyRedaction('CONTROLLED_ACTIONS', 'DECISION'), 'OPERATOR_SAFE');
  assert.strictEqual(classifyRedaction('KNOWLEDGE', 'FACT'), 'OPERATOR_SAFE');
  // classifyRedaction never returns SECRET_NEVER_RENDER on its own — that upgrade only
  // happens in normalize.ts's baseRecord(), driven by the raw claim's actual content,
  // never by a static (sourceSystem, category) lookup.
  for (const category of ['FACT', 'INFERENCE', 'ASSUMPTION', 'UNKNOWN', 'CONFLICT', 'DECISION', 'SIDE_EFFECT', 'POLICY', 'APPROVAL', 'EXECUTION', 'SOURCE_REFERENCE'] as const) {
    assert.notStrictEqual(classifyRedaction('CONTROLLED_ACTIONS', category), 'SECRET_NEVER_RENDER');
  }
  console.log('[evidence-redaction] PASS: classifyRedaction is deterministic and never itself assigns SECRET_NEVER_RENDER');

  console.log('[evidence-redaction] ALL PASS');
}

main();
