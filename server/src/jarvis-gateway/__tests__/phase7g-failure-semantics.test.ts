/**
 * Phase 7G §6-10 — failure semantics certification. Deterministic,
 * non-production-destructive: every DB scenario below uses a disposable
 * tmpdir copy, never a real production database file.
 *
 * This file adds coverage for the categories not already exercised by an
 * existing, passing suite (cited inline where reused rather than
 * duplicated):
 *
 * - §8 DB unavailable / corrupt: a genuinely corrupted SQLite file must
 *   fail closed (constructor throws) rather than silently starting from an
 *   empty/fresh state that looks identical to "no data yet."
 * - §9 Authority failure (provenance mismatch): already reproduced LIVE
 *   during this phase's own §4-5 journey-matrix run (this isolated
 *   worktree has no MI_DEPLOYED_SOURCE_SHA/_ROOT set, so AUTHORITY
 *   genuinely reports UNAVAILABLE/PROVENANCE_MISMATCH) — re-asserted here
 *   as a named, permanent scenario instead of an incidental side effect of
 *   another script.
 * - §10 Provider ambiguity/reconciliation: ALREADY covered by
 *   `personal-os/actions/__tests__/controlled-actions.test.ts` (`execute()`
 *   called twice on one proposal returns the identical execution record
 *   and `executions.length === 1` — idempotency-key-based reconciliation,
 *   not a blind retry). Not duplicated here; re-run as part of full
 *   regression (§27).
 * - §11 project ambiguity / expired session: ALREADY covered by
 *   `phase7d-jarvis-session.test.ts`. Not duplicated here.
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function run(): Promise<void> {
  let scenarios = 0;
  let passed = 0;

  // ── §8: corrupted DB file must fail closed (throw), not silently start empty ──
  {
    scenarios++;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-7g-db-corrupt-'));
    fs.writeFileSync(path.join(root, 'tasks.db'), Buffer.from('this is not a valid sqlite file, just garbage bytes to force SQLITE_NOTADB'));
    delete require.cache[require.resolve('../../task-runtime/store')];
    const { TaskStore } = require('../../task-runtime/store');
    let threw = false;
    try {
      new TaskStore(root);
    } catch (err) {
      threw = true;
      // The specific error class doesn't matter — what matters is it's a
      // real, propagated exception, not a silently-swallowed one that
      // leaves an empty-looking store indistinguishable from "no data yet."
      assert.ok(err instanceof Error);
    }
    assert.ok(threw, 'TaskStore must throw when its underlying DB file is corrupt, never silently start fresh over unreadable data');
    passed++;
  }

  // ── §8: a HEALTHY disposable DB copy must still work normally afterward
  //    (proves the corrupt-file test above isn't a false positive caused by
  //    e.g. a broken constructor path unrelated to corruption) ──────────────
  {
    scenarios++;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-7g-db-healthy-'));
    delete require.cache[require.resolve('../../task-runtime/store')];
    const { TaskStore } = require('../../task-runtime/store');
    const store = new TaskStore(root);
    const tasks = store.listTasks();
    assert.deepStrictEqual(tasks, [], 'a fresh, healthy disposable DB must open and query cleanly (control case for the corruption test above)');
    passed++;
  }

  // ── §9: authority provenance mismatch -> AUTHORITY UNAVAILABLE, overall
  //    BLOCKED, honest reasonCode — re-verified as a named permanent case ──
  {
    scenarios++;
    const savedSha = process.env.MI_DEPLOYED_SOURCE_SHA;
    const savedRoot = process.env.MI_DEPLOYED_SOURCE_ROOT;
    delete process.env.MI_DEPLOYED_SOURCE_SHA;
    delete process.env.MI_DEPLOYED_SOURCE_ROOT;
    delete require.cache[require.resolve('../../health-truth/probes')];
    const { probeProvenance } = require('../../health-truth/probes');
    const result = probeProvenance();
    assert.strictEqual(result.ok, false, 'probeProvenance() must fail closed (ok=false) when the deployed-source markers are absent, never assume clean provenance by default');
    assert.match(result.detail, /not set/i);
    if (savedSha) process.env.MI_DEPLOYED_SOURCE_SHA = savedSha; else delete process.env.MI_DEPLOYED_SOURCE_SHA;
    if (savedRoot) process.env.MI_DEPLOYED_SOURCE_ROOT = savedRoot; else delete process.env.MI_DEPLOYED_SOURCE_ROOT;
    passed++;
  }

  assert.strictEqual(passed, scenarios);
  console.log(`[phase7g-failure-semantics] PASS — ${passed}/${scenarios} scenarios verified`);
}

run().catch(err => { console.error(err); process.exit(1); });
