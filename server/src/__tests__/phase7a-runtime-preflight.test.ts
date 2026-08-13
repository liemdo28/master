/**
 * Phase 7A.9 — runtime preflight validator tests. Purely against synthetic
 * fixture directories under os.tmpdir() — never touches the real production
 * runtime root or any real database.
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { runPreflight } from '../runtime-preflight/validator';

function mkfixture(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-7a-preflight-'));
}

function writeMinimalGoodFixture(root: string): void {
  fs.mkdirSync(path.join(root, 'server', 'dist'), { recursive: true });
  fs.mkdirSync(path.join(root, 'server', 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'server', 'node_modules'), { recursive: true });
  fs.mkdirSync(path.join(root, 'command-center', 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'server', 'dist', 'index.js'), '// entrypoint');
  fs.writeFileSync(path.join(root, 'server', 'src', 'index.ts'), '// source');

  const globalDir = path.join(root, '.local-agent-global');
  fs.mkdirSync(path.join(globalDir, 'personal-os'), { recursive: true });
  fs.mkdirSync(path.join(globalDir, 'task-runtime'), { recursive: true });
  fs.mkdirSync(path.join(globalDir, 'project-registry'), { recursive: true });

  const personalOsDb = new Database(path.join(globalDir, 'personal-os', 'personal-os.db'));
  personalOsDb.exec('CREATE TABLE schema_migrations (version INTEGER)');
  personalOsDb.exec('INSERT INTO schema_migrations (version) VALUES (10)');
  personalOsDb.close();
  new Database(path.join(globalDir, 'task-runtime', 'tasks.db')).close();
  new Database(path.join(globalDir, 'project-registry', 'projects.db')).close();

  const sha = 'a'.repeat(40);
  const snapshotRoot = path.join(root, 'deployed-source', sha);
  fs.mkdirSync(snapshotRoot, { recursive: true });
  fs.writeFileSync(path.join(root, 'server', 'snapshot-manifest.json'), JSON.stringify({ deployedSha: sha }));
  fs.writeFileSync(path.join(root, 'server', 'authority-manifest.json'), JSON.stringify({ counts: { unknownMutations: 0, unresolvedLegacyMutations: 0 } }));

  fs.writeFileSync(
    path.join(root, '.env'),
    [
      `MI_DEPLOYED_SOURCE_SHA=${sha}`,
      `MI_DEPLOYED_SOURCE_ROOT=${snapshotRoot}`,
      `GLOBAL_DIR=${globalDir}`,
      `MI_CORE_API_KEY=test-key-not-a-real-secret`,
    ].join('\n'),
  );

  fs.writeFileSync(
    path.join(root, 'ecosystem.config.js'),
    `module.exports = { apps: [
      { name: 'mi-core', script: 'server/dist/index.js', cwd: ${JSON.stringify(root)} },
      { name: 'mi-ceo-observer', script: 'src/index.js', cwd: ${JSON.stringify(path.join(root, 'services', 'mi-ceo-observer'))} },
    ] };`,
  );
}

async function run(): Promise<void> {
  let scenarios = 0;
  let passed = 0;

  // ── Scenario 1: fully valid fixture → overall PASS ─────────────────────
  {
    const root = mkfixture();
    writeMinimalGoodFixture(root);
    const report = await runPreflight(root);
    scenarios++;
    assert.strictEqual(report.overall, 'WARN', 'valid fixture with one intentionally-stopped, missing service → WARN not FAIL');
    assert.ok(report.checks.find(c => c.id === 'db-personal-os' && c.status === 'PASS'));
    assert.ok(report.checks.find(c => c.id === 'schema-version' && c.status === 'PASS'));
    assert.ok(report.checks.find(c => c.id === 'deploy-snapshot' && c.status === 'PASS'));
    assert.ok(report.checks.find(c => c.id === 'authority-manifest' && c.status === 'PASS'));
    assert.ok(report.checks.find(c => c.id === 'pm2-app:mi-ceo-observer' && c.status === 'WARN'), 'intentionally-stopped missing service must be WARN, not FAIL');
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* best-effort cleanup; must not fail the assertions above */ }
    passed++;
  }

  // ── Scenario 2: missing runtime root → FAIL, no crash ──────────────────
  {
    const report = await runPreflight(path.join(os.tmpdir(), 'mi-7a-does-not-exist-' + Date.now()));
    scenarios++;
    assert.strictEqual(report.overall, 'FAIL');
    assert.strictEqual(report.checks.length, 1, 'must fail fast on missing runtime root, not attempt downstream checks');
    passed++;
  }

  // ── Scenario 3: missing .env required keys → FAIL ───────────────────────
  {
    const root = mkfixture();
    writeMinimalGoodFixture(root);
    fs.writeFileSync(path.join(root, '.env'), 'SOME_OTHER_KEY=x\n');
    const report = await runPreflight(root);
    scenarios++;
    assert.strictEqual(report.checks.find(c => c.id === 'env-presence')!.status, 'FAIL');
    assert.strictEqual(report.overall, 'FAIL');
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* best-effort cleanup; must not fail the assertions above */ }
    passed++;
  }

  // ── Scenario 4: provenance mismatch (deployedSha != .env) → FAIL ───────
  {
    const root = mkfixture();
    writeMinimalGoodFixture(root);
    fs.writeFileSync(path.join(root, 'server', 'snapshot-manifest.json'), JSON.stringify({ deployedSha: 'b'.repeat(40) }));
    const report = await runPreflight(root);
    scenarios++;
    assert.strictEqual(report.checks.find(c => c.id === 'deploy-snapshot')!.status, 'FAIL');
    assert.strictEqual(report.overall, 'FAIL');
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* best-effort cleanup; must not fail the assertions above */ }
    passed++;
  }

  // ── Scenario 5: unknownMutations > 0 → FAIL ─────────────────────────────
  {
    const root = mkfixture();
    writeMinimalGoodFixture(root);
    fs.writeFileSync(path.join(root, 'server', 'authority-manifest.json'), JSON.stringify({ counts: { unknownMutations: 1, unresolvedLegacyMutations: 0 } }));
    const report = await runPreflight(root);
    scenarios++;
    assert.strictEqual(report.checks.find(c => c.id === 'authority-manifest')!.status, 'FAIL');
    assert.strictEqual(report.overall, 'FAIL');
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* best-effort cleanup; must not fail the assertions above */ }
    passed++;
  }

  // ── Scenario 6: stale D:/E: path in ecosystem.config.js → FAIL ─────────
  {
    const root = mkfixture();
    writeMinimalGoodFixture(root);
    fs.writeFileSync(
      path.join(root, 'ecosystem.config.js'),
      `module.exports = { apps: [{ name: 'mi-core', script: 'server/dist/index.js', cwd: 'D:\\\\Project\\\\Mi-core-system\\\\Master\\\\mi-core' }] };`,
    );
    const report = await runPreflight(root);
    scenarios++;
    assert.strictEqual(report.checks.find(c => c.id === 'pm2-stale-paths')!.status, 'FAIL');
    assert.strictEqual(report.overall, 'FAIL');
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* best-effort cleanup; must not fail the assertions above */ }
    passed++;
  }

  // ── Scenario 7: duplicate PM2 app names → FAIL ──────────────────────────
  {
    const root = mkfixture();
    writeMinimalGoodFixture(root);
    fs.writeFileSync(
      path.join(root, 'ecosystem.config.js'),
      `module.exports = { apps: [
        { name: 'mi-core', script: 'server/dist/index.js', cwd: ${JSON.stringify(root)} },
        { name: 'mi-core', script: 'server/dist/index.js', cwd: ${JSON.stringify(root)} },
      ] };`,
    );
    const report = await runPreflight(root);
    scenarios++;
    assert.strictEqual(report.checks.find(c => c.id === 'pm2-unique-names')!.status, 'FAIL');
    assert.strictEqual(report.overall, 'FAIL');
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* best-effort cleanup; must not fail the assertions above */ }
    passed++;
  }

  // ── Scenario 8: core service (not intentionally stopped) missing script → FAIL, not WARN ──
  {
    const root = mkfixture();
    writeMinimalGoodFixture(root);
    fs.writeFileSync(
      path.join(root, 'ecosystem.config.js'),
      `module.exports = { apps: [{ name: 'mi-core', script: 'server/dist/does-not-exist.js', cwd: ${JSON.stringify(root)} }] };`,
    );
    const report = await runPreflight(root);
    scenarios++;
    assert.strictEqual(report.checks.find(c => c.id === 'pm2-app:mi-core')!.status, 'FAIL', 'a CORE service missing its script must be FAIL, never downgraded to WARN');
    assert.strictEqual(report.overall, 'FAIL');
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* best-effort cleanup; must not fail the assertions above */ }
    passed++;
  }

  // ── Scenario 9: DB integrity corruption is detected, never crashes ─────
  {
    const root = mkfixture();
    writeMinimalGoodFixture(root);
    fs.writeFileSync(path.join(root, '.local-agent-global', 'personal-os', 'personal-os.db'), 'not a real sqlite file');
    const report = await runPreflight(root);
    scenarios++;
    assert.strictEqual(report.checks.find(c => c.id === 'db-personal-os')!.status, 'FAIL');
    assert.strictEqual(report.overall, 'FAIL');
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* best-effort cleanup; must not fail the assertions above */ }
    passed++;
  }

  // ── Scenario 10: wrong schema version → WARN, not silently accepted ────
  {
    const root = mkfixture();
    writeMinimalGoodFixture(root);
    const globalDir = path.join(root, '.local-agent-global');
    const db = new Database(path.join(globalDir, 'personal-os', 'personal-os.db'));
    db.exec('DELETE FROM schema_migrations');
    db.exec('INSERT INTO schema_migrations (version) VALUES (9)');
    db.close();
    const report = await runPreflight(root);
    scenarios++;
    assert.strictEqual(report.checks.find(c => c.id === 'schema-version')!.status, 'WARN');
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* best-effort cleanup; must not fail the assertions above */ }
    passed++;
  }

  // ── 7A.7/7A.8: recovery-cli plan-building logic (pure, no PM2/process calls) ──
  {
    const { buildPlan } = await import('../runtime-preflight/recovery-cli');
    const goodReport = {
      runtimeRoot: '/x', generatedAt: 'x', overall: 'WARN' as const,
      checks: [
        { id: 'pm2-app:mi-core', status: 'PASS' as const, detail: 'ok' },
        { id: 'pm2-app:mi-ai-service', status: 'PASS' as const, detail: 'ok' },
        { id: 'pm2-app:mi-ceo-observer', status: 'WARN' as const, detail: 'missing, intentionally stopped' },
        { id: 'pm2-app:mi-whatsapp-gateway', status: 'WARN' as const, detail: 'missing, intentionally stopped' },
        { id: 'pm2-app:mi-n8n', status: 'WARN' as const, detail: 'missing, intentionally stopped' },
      ],
    };

    // Scenario: cold boot, nothing running yet → everything core should start,
    // nothing intentionally-stopped should ever appear in toStart.
    {
      const plan = buildPlan(goodReport, []);
      scenarios++;
      assert.deepStrictEqual(plan.toStart.sort(), ['mi-ai-service', 'mi-core']);
      assert.strictEqual(plan.intentionallySkipped.includes('mi-ceo-observer'), true);
      assert.strictEqual(plan.intentionallySkipped.includes('mi-whatsapp-gateway'), true);
      assert.strictEqual(plan.intentionallySkipped.includes('mi-n8n'), true);
      assert.strictEqual(plan.toStart.includes('mi-ceo-observer'), false, 'intentionally-stopped service must never appear in toStart');
      assert.strictEqual(plan.toStart.includes('mi-whatsapp-gateway'), false, 'intentionally-stopped service must never appear in toStart');
      assert.strictEqual(plan.toStart.includes('mi-n8n'), false, 'intentionally-stopped service must never appear in toStart');
      passed++;
    }

    // Scenario: already fully online → idempotent no-op.
    {
      const online: Array<{ name: string; pm2_env: { status: string } }> = [
        { name: 'mi-core', pm2_env: { status: 'online' } },
        { name: 'mi-ai-service', pm2_env: { status: 'online' } },
      ];
      const plan = buildPlan(goodReport, online);
      scenarios++;
      assert.deepStrictEqual(plan.toStart, []);
      assert.deepStrictEqual(plan.alreadyOnline.sort(), ['mi-ai-service', 'mi-core']);
      passed++;
    }

    // Scenario: duplicate PM2 entries → blocker, never silently started.
    {
      const dup = [
        { name: 'mi-core', pm2_env: { status: 'online' } },
        { name: 'mi-core', pm2_env: { status: 'errored' } },
      ];
      const plan = buildPlan(goodReport, dup);
      scenarios++;
      assert.ok(plan.duplicates.some(d => d.includes('mi-core')));
      passed++;
    }

    // Scenario: a core service failed preflight → blocker, not started.
    {
      const failReport = {
        ...goodReport,
        checks: goodReport.checks.map(c => c.id === 'pm2-app:mi-core' ? { ...c, status: 'FAIL' as const, detail: 'script missing' } : c),
      };
      const plan = buildPlan(failReport, []);
      scenarios++;
      assert.strictEqual(plan.toStart.includes('mi-core'), false, 'a FAILing core service must never be planned to start');
      assert.ok(plan.blockers.some(b => b.includes('mi-core')));
      passed++;
    }
  }

  assert.strictEqual(passed, scenarios);
  console.log(`[phase7a-runtime-preflight] PASS — ${passed}/${scenarios} fixture scenarios verified`);
}

run().catch(err => { console.error(err); process.exit(1); });
