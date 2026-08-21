// Phase 9F — proves the KB-ingest scheduler no longer blocks the event loop.
// Run directly with tsx (matches this repo's existing tests/ convention), not jest.
//
// Root cause this closes: fullIngest() -> ingestDirectory(MASTER_ROOT, ...) walked the
// filesystem and wrote to SQLite entirely synchronously, with zero yield points, for the
// walk's whole duration (observed live: ~30-35 minutes). During that window nothing else
// — no other scheduler, no HTTP request — could run on Node's single JS thread.
//
// This test proves, without touching any real production directory:
//   1. ingestDirectory() genuinely yields to the event loop periodically during a walk
//      (not just an async wrapper around still-synchronous work).
//   2. A concurrent, independent timer keeps ticking *while* a real ingest is running —
//      direct behavioral proof the event loop is not blocked.
//   3. fullIngest() coalesces overlapping callers onto one real run — no overlapping
//      ingest runs.
//   4. After a run completes, the timer/module is usable again — a later call starts a
//      genuinely fresh run, not stuck on the previous one.
//   5. Errors are bounded and reported truthfully in the return value, not thrown.
//   6. None of the above ever produces an unhandled promise rejection.

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function log(message: string) {
  console.log(`[kb-ingest-nonblocking] ${message}`);
}

// Must be set before knowledge-db.ts is first imported — GLOBAL_DIR/DB_PATH are computed
// as module-level consts at import time, the same pattern this repo's other evaluation
// harnesses already use (e.g. self-healing-restart-evaluation.ts, qb-online-watcher tests).
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-kb-ingest-nonblocking-'));
process.env.GLOBAL_DIR = path.join(tmpRoot, 'global');
process.env.MASTER_ROOT = path.join(tmpRoot, 'unused-master-root');
fs.mkdirSync(process.env.MASTER_ROOT, { recursive: true });

let unhandledRejection: unknown = null;
process.on('unhandledRejection', (reason) => { unhandledRejection = reason; });

async function run(): Promise<void> {
  const { ingestDirectory, fullIngest } = await import('../knowledge-db');

  // ── 1. Genuine yielding ──────────────────────────────────────────────────────────
  const dirA = fs.mkdtempSync(path.join(tmpRoot, 'src-a-'));
  const FILE_COUNT_A = 120;
  for (let i = 0; i < FILE_COUNT_A; i++) {
    fs.writeFileSync(path.join(dirA, `doc-${i}.md`), `# Doc ${i}\n\nReal content padding well above the 30-character minimum ingest threshold.\n`);
  }
  let yieldCount = 0;
  const resultA = await ingestDirectory(dirA, 'test-a', 2000, () => { yieldCount++; });
  assert.strictEqual(resultA.ingested, FILE_COUNT_A, `expected all ${FILE_COUNT_A} synthetic docs to be ingested`);
  assert.ok(yieldCount >= 4, `expected multiple yield points across ${FILE_COUNT_A} files (got ${yieldCount})`);
  log(`confirmed ${yieldCount} real yield points across ${FILE_COUNT_A} files (structural proof, not a cosmetic async wrapper)`);

  // ── 2. Event loop genuinely free during a real ingest ───────────────────────────
  const dirB = fs.mkdtempSync(path.join(tmpRoot, 'src-b-'));
  const FILE_COUNT_B = 400;
  for (let i = 0; i < FILE_COUNT_B; i++) {
    fs.writeFileSync(path.join(dirB, `doc-${i}.md`), `# Doc ${i}\n\nReal content padding well above the 30-character minimum ingest threshold.\n`);
  }
  let ticks = 0;
  const ticker = setInterval(() => { ticks++; }, 1);
  await ingestDirectory(dirB, 'test-b', 2000);
  clearInterval(ticker);
  assert.ok(ticks > 0, `expected a concurrent 1ms timer to fire during a ${FILE_COUNT_B}-file ingest (got ${ticks} ticks) — 0 would mean the event loop was blocked`);
  log(`confirmed ${ticks} independent timer ticks fired during a ${FILE_COUNT_B}-file ingest — event loop was not blocked`);

  // ── 3. No overlapping ingest runs (coalescing) ──────────────────────────────────
  // fullIngest() always walks the fixed MASTER_ROOT captured at module-import time
  // (process.env.MASTER_ROOT set at the top of this file) — populate that directory
  // directly rather than trying to redirect it after the fact.
  for (let i = 0; i < 150; i++) {
    fs.writeFileSync(path.join(process.env.MASTER_ROOT!, `doc-${i}.md`), `# Doc ${i}\n\nReal content padding well above the 30-character minimum ingest threshold.\n`);
  }
  const p1 = fullIngest();
  const p2 = fullIngest(); // called synchronously right after — must not start a second real walk
  assert.strictEqual(p1, p2, 'concurrent fullIngest() calls must coalesce onto the exact same in-flight promise, not start a second walk');
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.deepStrictEqual(r1, r2, 'coalesced callers must observe the identical result');
  log('confirmed concurrent fullIngest() calls coalesce onto a single real run — no overlapping ingest runs');

  // ── 4. Timer/module usable again after a completed run ──────────────────────────
  const p3 = fullIngest();
  assert.notStrictEqual(p3, p1, 'a call after the previous run finished must start a genuinely fresh run, not return a stale promise');
  await p3;
  log('confirmed a subsequent call after completion starts a fresh run — the ingest capability remains usable after success');

  // ── 5. Errors bounded and truthful, never thrown ─────────────────────────────────
  const missingDir = path.join(tmpRoot, 'does-not-exist-at-all');
  const resultMissing = await ingestDirectory(missingDir, 'test-missing');
  assert.strictEqual(resultMissing.ingested, 0);
  assert.strictEqual(resultMissing.errors, 1, 'a missing root directory must be reported as exactly one bounded, truthful error — not thrown');
  log('confirmed a missing/unreadable directory is reported truthfully in the result, not thrown');

  // ── 6. No unhandled rejection across any of the above ────────────────────────────
  await new Promise(resolve => setImmediate(resolve)); // let any pending rejection surface
  assert.strictEqual(unhandledRejection, null, `expected no unhandled promise rejection, got: ${String(unhandledRejection)}`);
  log('confirmed zero unhandled promise rejections across all scenarios above');

  log('PASS');
}

run()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    // better-sqlite3 keeps its WAL-mode file handle open for the life of this module
    // (knowledge-db.ts never exports a close function, matching its role as a long-lived
    // singleton in the real server process) — Windows won't release the directory lock
    // until the process exits, so cleanup here is best-effort, matching this repo's own
    // established pattern (e.g. coding-workflow.test.ts's safeRm) rather than a real failure.
    try { fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
    catch { console.warn(`[kb-ingest-nonblocking] temp cleanup skipped: ${tmpRoot}`); }
  });
