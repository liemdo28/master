#!/usr/bin/env node
// tests/stress/certification-24h.js - 24h runtime certification
// Run with: node tests/stress/certification-24h.js
// Fast mode (compressed, ~2min): node tests/stress/certification-24h.js --fast

import { openDatabase, closeDatabase } from '../../core/DatabaseManager.js';
import { MetricCollector }             from '../../collectors/MetricCollector.js';
import { GPUMonitor }                  from '../../collectors/GPUMonitor.js';
import { PowerEstimator }              from '../../collectors/PowerEstimator.js';
import { verifyChain }                 from '../../core/AuditLedger.js';
import { appendAuditEvent }            from '../../core/AuditLedger.js';
import { createApp }                   from '../../api/server.js';
import { seedDatabase }                from './seed-stress.js';

const FAST_MODE    = process.argv.includes('--fast');
const DURATION_MS  = FAST_MODE ? 2 * 60 * 1000 : 24 * 60 * 60 * 1000;
const CHECK_EVERY  = FAST_MODE ? 10 * 1000       : 5  * 60 * 1000;   // check every 10s (fast) / 5min (24h)
const LABEL        = FAST_MODE ? 'FAST (2min)'   : '24H';

const LIMITS = {
  memoryDeltaPct: 8,    // < 8% heap growth from baseline
  cpuPct:         5,    // < 5% average CPU overhead
  queueOverflow:  false,
};

async function run() {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  ACCOUNTING ENGINE — ${LABEL} CERTIFICATION      `);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  const db        = openDatabase();
  const collector = new MetricCollector({ db, monitorIntervalMs: FAST_MODE ? 1000 : 5000 });
  const gpu       = new GPUMonitor({ intervalMs: FAST_MODE ? 2000 : 10000 });
  const power     = new PowerEstimator();
  const sessionId = collector.startSession();
  gpu.start();

  // Start API
  const app  = createApp(db);
  const port = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s.address().port));
    Object.assign(app, { _server: s });
  });
  const server = app._server;
  console.log(`[cert] API running on http://127.0.0.1:${port}`);
  console.log(`[cert] Session: ${sessionId}`);
  console.log(`[cert] Duration: ${DURATION_MS / 60000} minutes\n`);

  // Seed initial data
  if (FAST_MODE) {
    console.log('[cert] Seeding initial data (fast mode)...');
    await seedDatabase(db, { sessions: 10, patches: 100, metrics: 1000 });
  }

  const baselineHeap = process.memoryUsage().heapUsed;
  const startTime    = Date.now();
  const violations   = [];
  let   checkCount   = 0;
  let   cpuSamples   = [];

  // Record metrics during run
  collector.monitor.on('sample', (row) => {
    power.record(row.cpu_pct, null);
    cpuSamples.push(row.cpu_pct);
    if (cpuSamples.length > 1000) cpuSamples.shift(); // rolling window
  });

  // Periodic certification checks
  const checkInterval = setInterval(() => {
    checkCount++;
    const elapsed      = ((Date.now() - startTime) / 60000).toFixed(1);
    const heapNow      = process.memoryUsage().heapUsed;
    const memDeltaPct  = ((heapNow - baselineHeap) / baselineHeap) * 100;
    const avgCpu       = cpuSamples.length > 0
      ? cpuSamples.reduce((s, v) => s + v, 0) / cpuSamples.length
      : 0;
    const writerStats  = collector.writer.getStats();
    const ledger       = verifyChain(db);
    const powerReport  = power.getSession();

    const pass = {
      memory:  memDeltaPct < LIMITS.memoryDeltaPct,
      cpu:     avgCpu      < LIMITS.cpuPct,
      ledger:  ledger.valid,
      queue:   writerStats.pending ? Object.values(writerStats.pending).every((v) => v < 5000) : true,
    };

    const allPass = Object.values(pass).every(Boolean);
    const status  = allPass ? '✅ PASS' : '❌ FAIL';

    console.log(`[${elapsed}min] Check #${checkCount} ${status}`);
    console.log(`  Memory delta: ${memDeltaPct.toFixed(2)}% (limit: <${LIMITS.memoryDeltaPct}%) ${pass.memory ? '✅' : '❌'}`);
    console.log(`  Avg CPU:      ${avgCpu.toFixed(2)}%  (limit: <${LIMITS.cpuPct}%)  ${pass.cpu    ? '✅' : '❌'}`);
    console.log(`  Ledger:       ${ledger.valid ? 'valid' : 'TAMPERED'} (${ledger.rowsChecked} rows) ${pass.ledger ? '✅' : '❌'}`);
    console.log(`  Power:        ${powerReport.total_wh.toFixed(3)} Wh total`);
    console.log(`  Flushed:      ${writerStats.totalFlushed} rows, errors: ${writerStats.errorCount}`);
    console.log();

    if (!allPass) {
      violations.push({ check: checkCount, elapsed, pass, memDeltaPct, avgCpu });
    }

    // Simulate ongoing activity in fast mode
    if (FAST_MODE) {
      for (let i = 0; i < 50; i++) {
        appendAuditEvent(db, 'CERT_ACTIVITY', { check: checkCount, i });
      }
    }
  }, CHECK_EVERY);

  // Wait for duration
  await new Promise((resolve) => setTimeout(resolve, DURATION_MS));
  clearInterval(checkInterval);

  // Final flush + checks
  await collector.stopSession();
  gpu.stop();
  await new Promise((resolve) => server.close(resolve));

  const finalLedger = verifyChain(db);
  const finalPower  = power.getSession();
  const finalMem    = ((process.memoryUsage().heapUsed - baselineHeap) / baselineHeap) * 100;
  const finalCpu    = cpuSamples.length > 0
    ? cpuSamples.reduce((s, v) => s + v, 0) / cpuSamples.length : 0;

  const RESULT = violations.length === 0 && finalLedger.valid ? 'CERTIFIED ✅' : 'FAILED ❌';

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║  CERTIFICATION RESULT: ${RESULT}`);
  console.log('╚══════════════════════════════════════════════════╝\n');
  console.log(`Duration:        ${((Date.now() - startTime) / 60000).toFixed(1)} minutes`);
  console.log(`Checks run:      ${checkCount}`);
  console.log(`Violations:      ${violations.length}`);
  console.log(`Final mem delta: ${finalMem.toFixed(2)}% (limit <${LIMITS.memoryDeltaPct}%)`);
  console.log(`Final avg CPU:   ${finalCpu.toFixed(2)}% (limit <${LIMITS.cpuPct}%)`);
  console.log(`Ledger:          ${finalLedger.valid ? 'VALID' : 'TAMPERED'} (${finalLedger.rowsChecked} rows)`);
  console.log(`Power consumed:  ${finalPower.total_wh.toFixed(3)} Wh (~$${finalPower.cost_usd})`);
  console.log(`GPU available:   ${gpu.available ?? false}`);

  if (violations.length > 0) {
    console.log('\nViolations:');
    violations.forEach((v) => console.log(' ', JSON.stringify(v)));
  }

  closeDatabase();
  process.exit(violations.length === 0 && finalLedger.valid ? 0 : 1);
}

run().catch((err) => { console.error('[cert] FATAL:', err.message); process.exit(1); });
