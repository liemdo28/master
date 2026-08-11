import * as assert from 'assert';
import { classifyFreshness } from '../freshness';

function main() {
  const now = new Date('2026-08-12T00:00:00.000Z');

  assert.strictEqual(classifyFreshness(null, 'FACT', now), 'UNKNOWN', 'missing timestamp must never be treated as FRESH');
  assert.strictEqual(classifyFreshness(undefined, 'DECISION', now), 'UNKNOWN');
  assert.strictEqual(classifyFreshness('not-a-real-date', 'HEALTH', now), 'UNKNOWN', 'unparseable timestamp must never be fabricated into a real freshness value');
  assert.strictEqual(classifyFreshness('2026-08-13T00:00:00.000Z', 'DECISION', now), 'UNKNOWN', 'a future-dated source must never claim FRESH');

  // HEALTH decays fastest (5m FRESH / 30m AGING / beyond STALE) — matches live-probe cadence.
  assert.strictEqual(classifyFreshness('2026-08-11T23:58:00.000Z', 'HEALTH', now), 'FRESH');
  assert.strictEqual(classifyFreshness('2026-08-11T23:50:00.000Z', 'HEALTH', now), 'AGING');
  assert.strictEqual(classifyFreshness('2026-08-11T23:00:00.000Z', 'HEALTH', now), 'STALE');

  // DECISION/APPROVAL/EXECUTION/SIDE_EFFECT/POLICY use a generous 1h/24h window —
  // these are point-in-time historical records, not live state.
  for (const category of ['DECISION', 'APPROVAL', 'EXECUTION', 'SIDE_EFFECT', 'POLICY'] as const) {
    assert.strictEqual(classifyFreshness('2026-08-11T23:30:00.000Z', category, now), 'FRESH', `${category} at 30m old should be FRESH`);
    assert.strictEqual(classifyFreshness('2026-08-11T12:00:00.000Z', category, now), 'AGING', `${category} at 12h old should be AGING`);
    assert.strictEqual(classifyFreshness('2026-08-01T00:00:00.000Z', category, now), 'STALE', `${category} at 11 days old should be STALE`);
  }

  // CONFLICT uses a wider window (24h FRESH / 7d AGING) — conflict *freshness* is
  // informational only; conflict *visibility* is governed separately by resolvedAt
  // (see evidence.test.ts / conflicts.test.ts), never by this time-decay.
  assert.strictEqual(classifyFreshness('2026-08-11T12:00:00.000Z', 'CONFLICT', now), 'FRESH');
  assert.strictEqual(classifyFreshness('2026-08-08T00:00:00.000Z', 'CONFLICT', now), 'AGING');
  assert.strictEqual(classifyFreshness('2026-07-01T00:00:00.000Z', 'CONFLICT', now), 'STALE');

  // Categories with no explicit TTL fall back to the same 1h/24h default as decisions.
  for (const category of ['FACT', 'INFERENCE', 'ASSUMPTION', 'UNKNOWN', 'SOURCE_REFERENCE'] as const) {
    assert.strictEqual(classifyFreshness('2026-08-11T23:30:00.000Z', category, now), 'FRESH');
    assert.strictEqual(classifyFreshness('2026-08-01T00:00:00.000Z', category, now), 'STALE');
  }

  console.log('[evidence-freshness] PASS');
}

main();
