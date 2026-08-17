/**
 * Phase 7G §25 — SessionStore bounds must hold under sustained load: no
 * unbounded conversation-state growth. `MAX_SESSIONS = 1000` and its
 * eviction path already exist in session-store.ts (Phase 7D) — this proves
 * it live rather than trusting the constant alone.
 */
import assert from 'assert';
import { getOrCreateSession, peekSession, _clearForTests } from '../session-store';

async function run(): Promise<void> {
  let scenarios = 0;
  let passed = 0;
  _clearForTests();

  // ── Creating 1500 distinct sessions must never let the store exceed its
  //    bound — the oldest sessions must be evicted, not accumulate forever ──
  {
    scenarios++;
    for (let i = 0; i < 1500; i++) {
      getOrCreateSession(`explicit:phase7g-bounds-${i}`);
    }
    // The store's own internal size isn't exported directly; infer the
    // bound held by checking that a sufficiently early session no longer
    // exists (evicted) while a recent one does.
    const earlySession = peekSession('explicit:phase7g-bounds-0');
    const recentSession = peekSession('explicit:phase7g-bounds-1499');
    assert.strictEqual(earlySession, null, 'an early session must have been evicted once the bound was exceeded — unbounded growth would keep it alive');
    assert.ok(recentSession !== null, 'the most recently created session must still exist');
    passed++;
  }

  _clearForTests();
  assert.strictEqual(passed, scenarios);
  console.log(`[phase7g-session-bounds] PASS — ${passed}/${scenarios} scenarios verified (1500 sessions created, bound held)`);
}

run().catch(err => { console.error(err); process.exit(1); });
