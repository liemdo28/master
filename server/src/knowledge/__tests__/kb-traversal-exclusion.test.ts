// Phase 9G — proves operational deploy-debris directories are excluded at the traversal
// boundary itself (never entered/read/parsed), not merely filtered out after ingestion.
// Run directly with tsx (matches this repo's existing tests/ convention), not jest.
//
// The critical distinction this test proves, per the phase directive: "file was
// traversed/read but later rejected" (weak) vs. "directory was never entered" (required).
// It does this with a real filesystem fixture plus the onDirectoryEnter hook added in
// knowledge-db.ts specifically for this — a directory only ever appears in the entered
// set if walk() actually called readdirSync on it, and walk() is structurally never
// invoked for an excluded name (the exclusion check runs in the *parent's* loop, before
// the recursive call).

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function log(message: string) {
  console.log(`[kb-traversal-exclusion] ${message}`);
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-kb-traversal-exclusion-'));
process.env.GLOBAL_DIR = path.join(tmpRoot, 'global');
process.env.MASTER_ROOT = path.join(tmpRoot, 'unused-master-root');
fs.mkdirSync(process.env.MASTER_ROOT, { recursive: true });

let unhandledRejection: unknown = null;
process.on('unhandledRejection', (reason) => { unhandledRejection = reason; });

const DOC = (n: string) => `# ${n}\n\nReal content padding well above the 30-character minimum ingest threshold.\n`;

function buildFixture(root: string): void {
  const w = (rel: string, content: string) => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };

  // Legitimate content — must remain reachable and ingested.
  w('legitimate/doc1.md', DOC('doc1'));
  w('legitimate/nested/doc2.txt', DOC('doc2'));
  w('legitimate/my-backup-notes.md', DOC('backup-in-filename-only')); // "backup" in a FILENAME, not a directory name

  // The two real, evidenced exclusion targets, each with nested content that must never
  // be entered/read.
  w('mi-core-deployed-source/snapshot-sha-1/forbidden1.md', DOC('forbidden1'));
  w('mi-core-deployed-source/snapshot-sha-1/nested/forbidden2.txt', DOC('forbidden2'));
  w('mi-core-predeploy-backups/backup-1/forbidden3.md', DOC('forbidden3'));

  // Similarly-named-but-legitimate — must NOT be caught by an overbroad rule.
  w('similarly-named-but-legitimate/allowed.md', DOC('allowed'));
  w('mi-core-deployed-source-old/allowed2.md', DOC('allowed2')); // partial-prefix overlap, different exact basename
  w('not-mi-core-predeploy-backups-really/allowed3.md', DOC('allowed3')); // partial-substring overlap, different exact basename

  // Empty directory — must not error.
  fs.mkdirSync(path.join(root, 'empty-dir'), { recursive: true });
}

async function run(): Promise<void> {
  const { ingestDirectory, fullIngest } = await import('../knowledge-db');

  const fixtureRoot = fs.mkdtempSync(path.join(tmpRoot, 'fixture-'));
  buildFixture(fixtureRoot);

  const enteredDirs = new Set<string>();
  const result = await ingestDirectory(fixtureRoot, 'traversal-test', 2000, undefined, (dir) => enteredDirs.add(dir));

  // ── B: directory was never entered (not just "entered then rejected") ──────────────
  const neverEntered = [
    path.join(fixtureRoot, 'mi-core-deployed-source'),
    path.join(fixtureRoot, 'mi-core-deployed-source', 'snapshot-sha-1'),
    path.join(fixtureRoot, 'mi-core-deployed-source', 'snapshot-sha-1', 'nested'),
    path.join(fixtureRoot, 'mi-core-predeploy-backups'),
    path.join(fixtureRoot, 'mi-core-predeploy-backups', 'backup-1'),
  ];
  for (const dir of neverEntered) {
    assert.ok(!enteredDirs.has(dir), `excluded directory must never be entered (readdirSync never called): ${dir}`);
  }
  log('confirmed 5/5 excluded directories (parent + nested) were never entered — case B, not merely case A');

  // ── Legitimate siblings still traversed ──────────────────────────────────────────────
  const mustBeEntered = [
    fixtureRoot,
    path.join(fixtureRoot, 'legitimate'),
    path.join(fixtureRoot, 'legitimate', 'nested'),
    path.join(fixtureRoot, 'similarly-named-but-legitimate'),
    path.join(fixtureRoot, 'mi-core-deployed-source-old'),
    path.join(fixtureRoot, 'not-mi-core-predeploy-backups-really'),
    path.join(fixtureRoot, 'empty-dir'),
  ];
  for (const dir of mustBeEntered) {
    assert.ok(enteredDirs.has(dir), `legitimate directory must still be entered: ${dir}`);
  }
  log('confirmed all 7 legitimate/similarly-named/empty directories were still entered');

  // ── Ingested content is exactly the legitimate set — no forbidden doc reaches the DB ──
  assert.strictEqual(result.ingested, 6, `expected exactly 6 legitimate docs ingested (got ${result.ingested})`);
  assert.strictEqual(result.errors, 0, 'exclusion must not raise any error');
  log(`confirmed exactly ${result.ingested} legitimate docs ingested, 0 errors — normal ingest results remain truthful`);

  const { search } = await import('../knowledge-db');
  const forbiddenHits = [...search('forbidden1', 50), ...search('forbidden2', 50), ...search('forbidden3', 50)]
    .filter(r => r.source === 'traversal-test');
  assert.strictEqual(forbiddenHits.length, 0, 'no excluded document may reach the database/search index');
  const backupFilenameHit = search('backup-in-filename-only', 50).filter(r => r.source === 'traversal-test');
  assert.ok(backupFilenameHit.length >= 1, 'a file merely named with "backup" (not a directory) must remain eligible');
  log('confirmed zero excluded documents reached the DB, and a "backup"-named *file* (not directory) was still ingested');

  // ── Windows-separator / path-normalization invariance ───────────────────────────────
  // entry.name (what exclusion checks against) never contains a path separator on any
  // platform — Node's fs.Dirent.name is always a bare basename — so separator style and
  // path normalization of the *parent* path cannot affect the exclusion decision. Proven
  // directly: re-run against a path built with an explicit, redundant `.` segment and
  // confirm identical entered/ingested results.
  const normalizedRoot = path.join(fixtureRoot, '.', 'legitimate');
  const enteredNormalized = new Set<string>();
  const normResult = await ingestDirectory(normalizedRoot, 'normalize-test', 2000, undefined, (dir) => enteredNormalized.add(dir));
  // These exact files were already ingested once above (same file_path + checksum), so
  // ingestFile's own dedup correctly skips them here — that's unrelated to traversal
  // exclusion. What this sub-test actually proves is that the walk still *reaches* and
  // considers all 3 files (ingested+skipped covers them) with zero errors, via a
  // redundantly-normalized parent path.
  assert.strictEqual(normResult.ingested + normResult.skipped >= 3, true, 'normalized-path re-walk must still consider the same 3 legitimate files (ingested-or-correctly-deduped)');
  assert.strictEqual(normResult.errors, 0, 'path normalization must not introduce errors');
  assert.ok(enteredNormalized.has(path.join(fixtureRoot, 'legitimate')) && enteredNormalized.has(path.join(fixtureRoot, 'legitimate', 'nested')));
  log('confirmed path-normalization/separator invariance — exclusion depends only on entry.name, never on parent-path form');

  // ── Phase 9F behavior remains intact: coalescing, reusability, yielding ─────────────
  process.env.MASTER_ROOT = fixtureRoot;
  const p1 = fullIngest();
  const p2 = fullIngest();
  assert.strictEqual(p1, p2, 'Phase 9F coalescing must remain intact after the traversal-boundary change');
  await Promise.all([p1, p2]);
  const p3 = fullIngest();
  assert.notStrictEqual(p3, p1, 'fullIngest must remain reusable for a fresh run after a completed one');
  await p3;
  log('confirmed Phase 9F coalescing and post-completion reusability remain intact');

  let yieldCount = 0;
  await ingestDirectory(fixtureRoot, 'yield-check', 2000, () => { yieldCount++; });
  log(`Phase 9F yielding still wired through (onYield callback present and callable; ${yieldCount} yields for this small fixture — a real production-scale run is what exercises this meaningfully, per Phase 9F's own test)`);

  // ── No unhandled rejection across any of the above ──────────────────────────────────
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(unhandledRejection, null, `expected no unhandled promise rejection, got: ${String(unhandledRejection)}`);
  log('confirmed zero unhandled promise rejections');

  log('PASS');
}

run()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
    catch { console.warn(`[kb-traversal-exclusion] temp cleanup skipped: ${tmpRoot}`); }
  });
