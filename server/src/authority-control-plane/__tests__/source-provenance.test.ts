import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildSourceSnapshot, resolveAuthorityRepoRoot, verifySnapshot } from '../source-provenance';
import { generateAuthorityManifest } from '../scanner';

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-source-provenance-'));
}

function rm(p: string): void {
  fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function makeFakeServerRoot(root: string): void {
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'index.ts'), "import express from 'express';\nconst app = express();\napp.get('/api/health', (_req, res) => res.json({ ok: true }));\n");
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fake-server', scripts: {} }, null, 2));
}

async function main(): Promise<void> {
  const REAL_SERVER_ROOT = path.resolve(__dirname, '../../..');

  // 1. Dev/test mode: env var unset -> resolveAuthorityRepoRoot returns fallback unchanged.
  {
    delete process.env.MI_DEPLOYED_SOURCE_ROOT;
    delete process.env.MI_DEPLOYED_SOURCE_SHA;
    const resolved = resolveAuthorityRepoRoot('/some/dev/fallback/root');
    assert.strictEqual(resolved, '/some/dev/fallback/root', 'unset MI_DEPLOYED_SOURCE_ROOT must preserve exact prior dev/test behavior');
  }

  // 2. buildSourceSnapshot + verifySnapshot round-trip against a real server root produces
  //    a manifest whose scanner output matches the manifest generated directly against
  //    that same source (the core provenance invariant).
  {
    const dest = path.join(tempRoot(), 'snapshot-good');
    try {
      const sha = 'deadbeef00112233445566778899aabbccddeeff';
      const built = buildSourceSnapshot(REAL_SERVER_ROOT, dest, sha);
      assert.strictEqual(built.deployedSha, sha);
      assert.ok(built.fileCount > 0);
      assert.ok(fs.existsSync(path.join(dest, 'snapshot-manifest.json')));
      assert.ok(fs.existsSync(path.join(dest, 'src', 'index.ts')));

      const verified = verifySnapshot(dest, sha);
      assert.strictEqual(verified.treeChecksum, built.treeChecksum);

      const directManifest = generateAuthorityManifest(REAL_SERVER_ROOT);
      const snapshotManifest = generateAuthorityManifest(dest);
      assert.strictEqual(snapshotManifest.counts.total, directManifest.counts.total, 'snapshot-derived manifest must match direct-source manifest counts exactly');
      assert.strictEqual(snapshotManifest.counts.mutations, directManifest.counts.mutations);

      process.env.MI_DEPLOYED_SOURCE_ROOT = dest;
      process.env.MI_DEPLOYED_SOURCE_SHA = sha;
      const resolved = resolveAuthorityRepoRoot('/irrelevant/dirty/checkout/that/must/never/be/consulted');
      assert.strictEqual(resolved, dest, 'when a valid snapshot is configured, an unrelated dirty fallback must never be consulted');
    } finally {
      delete process.env.MI_DEPLOYED_SOURCE_ROOT;
      delete process.env.MI_DEPLOYED_SOURCE_SHA;
      rm(path.dirname(dest));
    }
  }

  // 3. Missing snapshot directory entirely -> fail closed.
  {
    const missing = path.join(tempRoot(), 'does-not-exist');
    rm(missing);
    assert.throws(() => verifySnapshot(missing, 'anysha'), /AUTHORITY_SNAPSHOT_MISSING/);
    process.env.MI_DEPLOYED_SOURCE_ROOT = missing;
    process.env.MI_DEPLOYED_SOURCE_SHA = 'anysha';
    try {
      assert.throws(() => resolveAuthorityRepoRoot('/some/fallback'), /AUTHORITY_SNAPSHOT_MISSING/);
    } finally {
      delete process.env.MI_DEPLOYED_SOURCE_ROOT;
      delete process.env.MI_DEPLOYED_SOURCE_SHA;
    }
  }

  // 4. Snapshot present but manifest file missing -> fail closed.
  {
    const root = tempRoot();
    try {
      makeFakeServerRoot(root);
      assert.throws(() => verifySnapshot(root, 'anysha'), /AUTHORITY_SNAPSHOT_MANIFEST_MISSING/);
    } finally {
      rm(root);
    }
  }

  // 5. Snapshot manifest present but malformed JSON -> fail closed.
  {
    const root = tempRoot();
    try {
      makeFakeServerRoot(root);
      fs.writeFileSync(path.join(root, 'snapshot-manifest.json'), '{ not valid json');
      assert.throws(() => verifySnapshot(root, 'anysha'), /AUTHORITY_SNAPSHOT_MANIFEST_MALFORMED/);
    } finally {
      rm(root);
    }
  }

  // 6. Snapshot SHA mismatch -> fail closed, even though the tree itself is internally consistent.
  {
    const dest = path.join(tempRoot(), 'snapshot-sha-mismatch');
    try {
      const built = buildSourceSnapshot(REAL_SERVER_ROOT, dest, 'sha-A-1111111111111111111111111111111111');
      assert.ok(built);
      assert.throws(() => verifySnapshot(dest, 'sha-B-2222222222222222222222222222222222'), /AUTHORITY_SNAPSHOT_SHA_MISMATCH/);
    } finally {
      rm(path.dirname(dest));
    }
  }

  // 7. Snapshot incomplete (no src/index.ts) -> fail closed.
  {
    const root = tempRoot();
    try {
      fs.mkdirSync(path.join(root, 'src'), { recursive: true });
      fs.writeFileSync(path.join(root, 'package.json'), '{}');
      fs.writeFileSync(path.join(root, 'snapshot-manifest.json'), JSON.stringify({
        deployedSha: 'anysha', sourceSnapshotRoot: root, generatedAt: new Date().toISOString(), fileCount: 1, treeChecksum: 'irrelevant',
      }));
      assert.throws(() => verifySnapshot(root, 'anysha'), /AUTHORITY_SNAPSHOT_INCOMPLETE/);
    } finally {
      rm(root);
    }
  }

  // 8. Tampered snapshot: file content changed after the manifest was written -> checksum
  //    mismatch caught, fail closed (this is the exact "dirty tree silently substituted"
  //    bug class this hotfix exists to close).
  {
    const dest = path.join(tempRoot(), 'snapshot-tampered');
    try {
      const sha = 'tamper-test-sha-0000000000000000000000000';
      buildSourceSnapshot(REAL_SERVER_ROOT, dest, sha);
      fs.appendFileSync(path.join(dest, 'src', 'index.ts'), '\n// unreviewed tampering after snapshot was built\n');
      assert.throws(() => verifySnapshot(dest, sha), /AUTHORITY_SNAPSHOT_TAMPERED/);
    } finally {
      rm(path.dirname(dest));
    }
  }

  // 9. buildSourceSnapshot refuses to overwrite an existing snapshot in place.
  {
    const dest = path.join(tempRoot(), 'snapshot-no-overwrite');
    try {
      buildSourceSnapshot(REAL_SERVER_ROOT, dest, 'sha-first-0000000000000000000000000000');
      assert.throws(() => buildSourceSnapshot(REAL_SERVER_ROOT, dest, 'sha-second-000000000000000000000000000'), /SNAPSHOT_ALREADY_EXISTS/);
    } finally {
      rm(path.dirname(dest));
    }
  }

  // 10. Deterministic reproduction of the original production bug: cwd points at an
  //     unrelated "dirty" tree missing a route the reviewed snapshot has. With no
  //     snapshot configured, the scanner reads the dirty tree (old, buggy behavior,
  //     preserved intentionally for dev mode). With a valid snapshot configured, the
  //     dirty tree has zero effect and the scanner reads the reviewed snapshot instead.
  {
    const dirty = tempRoot();
    const dest = path.join(tempRoot(), 'snapshot-vs-dirty');
    try {
      fs.mkdirSync(path.join(dirty, 'src'), { recursive: true });
      fs.writeFileSync(path.join(dirty, 'src', 'index.ts'), "import express from 'express';\nconst app = express();\napp.get('/api/health', (_req, res) => res.json({ ok: true }));\n");
      fs.writeFileSync(path.join(dirty, 'package.json'), JSON.stringify({ name: 'dirty', scripts: {} }, null, 2));

      const dirtyManifest = generateAuthorityManifest(dirty);
      const sha = 'scenario-10-sha-0000000000000000000000';
      buildSourceSnapshot(REAL_SERVER_ROOT, dest, sha);

      delete process.env.MI_DEPLOYED_SOURCE_ROOT;
      delete process.env.MI_DEPLOYED_SOURCE_SHA;
      assert.strictEqual(resolveAuthorityRepoRoot(dirty), dirty, 'dev mode (no snapshot configured) uses the fallback root as before');

      process.env.MI_DEPLOYED_SOURCE_ROOT = dest;
      process.env.MI_DEPLOYED_SOURCE_SHA = sha;
      const resolvedInProdMode = resolveAuthorityRepoRoot(dirty);
      assert.strictEqual(resolvedInProdMode, dest, 'with a valid snapshot configured, the dirty fallback is never used');
      const resolvedManifest = generateAuthorityManifest(resolvedInProdMode);
      assert.notStrictEqual(resolvedManifest.counts.total, dirtyManifest.counts.total, 'resolved manifest must reflect the full reviewed source, not the stale dirty tree');
    } finally {
      delete process.env.MI_DEPLOYED_SOURCE_ROOT;
      delete process.env.MI_DEPLOYED_SOURCE_SHA;
      rm(dirty);
      rm(path.dirname(dest));
    }
  }

  console.log('[source-provenance] PASS');
}

main().catch(err => {
  console.error('[source-provenance] FAIL:', err);
  process.exitCode = 1;
});
