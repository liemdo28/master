#!/usr/bin/env node
// bin/accounting.js - Accounting Engine CLI
import { Command }        from 'commander';
import { openDatabase, closeDatabase } from '../core/DatabaseManager.js';
import { appendAuditEvent }            from '../core/AuditLedger.js';
import { createPatchRecord, updatePatchStatus } from '../core/PatchLedger.js';
import { startQARun, completeQARun }   from '../core/QAAccounting.js';
import { getFullStats }                from '../analyzers/StatsAnalyzer.js';
import { verifyLedger, getLedgerSummary } from '../analyzers/LedgerVerifier.js';
import { MetricCollector }             from '../collectors/MetricCollector.js';
import { createApp }                   from '../api/server.js';
import { randomUUID }                  from 'crypto';

const program = new Command();
program.name('accounting').description('Offline accounting engine CLI').version('1.0.0');

// ── init ──────────────────────────────────────────────────────────────────────
program.command('init')
  .description('Initialise the SQLite database and apply schema')
  .action(() => {
    const db = openDatabase();
    appendAuditEvent(db, 'SYSTEM_INIT', { action: 'database initialised' });
    console.log('[init] Database ready at ledgers/accounting.db');
    closeDatabase();
  });

// ── stats ─────────────────────────────────────────────────────────────────────
program.command('stats')
  .description('Print aggregate stats (must complete < 3s)')
  .action(() => {
    const db    = openDatabase();
    const start = Date.now();
    const stats = getFullStats(db);
    const ms    = Date.now() - start;
    console.log(JSON.stringify(stats, null, 2));
    console.log(`\n[stats] completed in ${ms}ms`);
    if (ms > 3000) console.warn('[stats] WARNING: exceeded 3s target!');
    closeDatabase();
  });

// ── verify-ledger ─────────────────────────────────────────────────────────────
program.command('verify-ledger')
  .description('Verify hash-chain integrity of the audit ledger')
  .action(() => {
    const db     = openDatabase();
    const result = getLedgerSummary(db);
    console.log('[verify-ledger]', result.verification.summary);
    console.log('Recent events:', result.recentEvents.length);
    if (!result.verification.valid) process.exit(1);
    closeDatabase();
  });

// ── seed ──────────────────────────────────────────────────────────────────────
program.command('seed')
  .description('Seed test data')
  .option('--sessions <n>',  'sessions to create',  '1000')
  .option('--patches <n>',   'patches to create',   '10000')
  .option('--metrics <n>',   'metric rows to insert','100000')
  .action(async (opts) => {
    const sessions = parseInt(opts.sessions);
    const patches  = parseInt(opts.patches);
    const metrics  = parseInt(opts.metrics);
    console.log(`[seed] sessions=${sessions} patches=${patches} metrics=${metrics}`);
    const { seedDatabase } = await import('../tests/stress/seed-stress.js');
    const db = openDatabase();
    await seedDatabase(db, { sessions, patches, metrics });
    closeDatabase();
  });

// ── monitor ───────────────────────────────────────────────────────────────────
program.command('monitor')
  .description('Run resource monitor (use --duration to set run time)')
  .option('--duration <d>', 'duration like 24h, 60m, 30s', '60s')
  .action(async (opts) => {
    const durationMs = parseDuration(opts.duration);
    const db         = openDatabase();
    const collector  = new MetricCollector({ db });
    const sessionId  = collector.startSession();
    console.log(`[monitor] started session ${sessionId}, running for ${opts.duration}`);
    collector.monitor.on('sample', (r) =>
      process.stdout.write(`\r  cpu=${r.cpu_pct.toFixed(1)}%  mem=${r.memory_mb.toFixed(1)}MB  samples=${collector.monitor.getStats().samples}   `)
    );
    await sleep(durationMs);
    await collector.stopSession();
    console.log('\n[monitor] done. Stats:', JSON.stringify(collector.getStats()));
    closeDatabase();
  });

// ── api ───────────────────────────────────────────────────────────────────────
program.command('api')
  .description('Start the API server on 127.0.0.1:8844')
  .action(() => {
    const db  = openDatabase();
    const app = createApp(db);
    app.listen(8844, '127.0.0.1', () => {
      console.log('[api] listening on http://127.0.0.1:8844');
    });
  });

// ── patch simulate ────────────────────────────────────────────────────────────
const patchCmd = program.command('patch').description('Patch lifecycle commands');

patchCmd.command('simulate')
  .description('Simulate patch creation and state transitions')
  .option('--count <n>', 'number of patches', '100')
  .action((opts) => {
    const count = parseInt(opts.count);
    const db    = openDatabase();
    console.log(`[patch simulate] creating ${count} patches...`);
    const statuses = ['applied', 'rejected', 'rolled_back', 'failed'];
    let parentId = null;
    for (let i = 0; i < count; i++) {
      const patch_id = `patch-${Date.now()}-${i}-${randomUUID().slice(0, 6)}`;
      createPatchRecord(db, {
        patch_id,
        parent_patch: parentId,
        branch_name: `branch-${i % 10}`,
        deployment_target: i % 3 === 0 ? 'staging' : 'local',
        affected_modules: [`module-${i % 5}`],
        task: `task-${i}`,
        risk_level: i % 4 === 0 ? 'high' : 'low',
        files_changed: [`src/file-${i}.js`],
      });
      const status = statuses[i % statuses.length];
      updatePatchStatus(db, patch_id, status, {
        rollback_reason: status === 'rolled_back' ? 'test rollback' : undefined,
        approval_status: status === 'applied' ? 'approved' : 'pending',
      });
      if (i % 10 === 0) parentId = patch_id;
    }
    console.log(`[patch simulate] done. ${count} patches created.`);
    closeDatabase();
  });

patchCmd.command('rollback')
  .description('Rollback random patches')
  .option('--random <n>', 'number of patches to rollback', '10')
  .action((opts) => {
    const n  = parseInt(opts.random);
    const db = openDatabase();
    const applied = db.prepare(
      "SELECT patch_id FROM patch_ledger WHERE status = 'applied' ORDER BY RANDOM() LIMIT ?"
    ).all(n);
    let rolled = 0;
    for (const { patch_id } of applied) {
      updatePatchStatus(db, patch_id, 'rolled_back', { rollback_reason: 'manual rollback via CLI' });
      rolled++;
    }
    console.log(`[patch rollback] rolled back ${rolled} patches`);
    closeDatabase();
  });

// ── qa simulate ───────────────────────────────────────────────────────────────
const qaCmd = program.command('qa').description('QA run commands');

qaCmd.command('simulate')
  .description('Simulate QA runs')
  .option('--count <n>', 'number of runs', '10')
  .option('--project <p>', 'project name', 'test-project')
  .action((opts) => {
    const count   = parseInt(opts.count);
    const project = opts.project;
    const db      = openDatabase();
    for (let i = 0; i < count; i++) {
      const run_id = startQARun(db, project);
      completeQARun(db, run_id, {
        total_tests:    100 + Math.floor(Math.random() * 200),
        failed_tests:   Math.floor(Math.random() * 10),
        flaky_tests:    Math.floor(Math.random() * 5),
        qa_reruns:      Math.floor(Math.random() * 3),
        regression_score: Math.random() * 0.5,
        fix_time_minutes: Math.random() * 30,
        build_success:  true,
        test_success:   Math.random() > 0.2,
        qa_score:       60 + Math.random() * 40,
        qa_grade:       Math.random() > 0.2 ? 'PASS' : 'FAIL',
        total_cost_cents: Math.floor(Math.random() * 1000),
      });
    }
    console.log(`[qa simulate] ${count} QA runs created for "${project}"`);
    closeDatabase();
  });

// ── helpers ───────────────────────────────────────────────────────────────────
function parseDuration(s) {
  const m = s.match(/^(\d+)(h|m|s)$/);
  if (!m) return 60000;
  const n = parseInt(m[1]);
  return m[2] === 'h' ? n * 3600000 : m[2] === 'm' ? n * 60000 : n * 1000;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

program.parseAsync(process.argv);
