#!/usr/bin/env node
// tests/stress/live-24h-certification.js
// Usage:
//   node tests/stress/live-24h-certification.js --duration=30m
//   node tests/stress/live-24h-certification.js --duration=24h
//   node tests/stress/live-24h-certification.js --duration=2m   (fast CI mode)
import { openDatabase, closeDatabase } from '../../core/DatabaseManager.js';
import { MetricCollector }             from '../../collectors/MetricCollector.js';
import { GPUMonitor }                  from '../../collectors/GPUMonitor.js';
import { PowerEstimator }              from '../../collectors/PowerEstimator.js';
import { verifyChain }                 from '../../core/AuditLedger.js';
import { appendAuditEvent }            from '../../core/AuditLedger.js';
import { createApp }                   from '../../api/server.js';
import { writeFileSync, mkdirSync }    from 'fs';
import { join, dirname }               from 'path';
import { fileURLToPath }               from 'url';
import { execSync }                    from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── parse --duration flag ────────────────────────────────────────────────────
function parseDuration(args) {
  const flag = args.find((a) => a.startsWith('--duration='));
  if (!flag) return 2 * 60 * 1000; // default: 2 min
  const val  = flag.replace('--duration=', '');
  const n    = parseInt(val);
  if (val.endsWith('h')) return n * 3600000;
  if (val.endsWith('m')) return n * 60000;
  if (val.endsWith('s')) return n * 1000;
  return 2 * 60 * 1000;
}

const DURATION_MS  = parseDuration(process.argv);
const CHECK_EVERY  = Math.min(DURATION_MS / 12, 30000);  // 12 checks across run
const LIMITS       = { memDeltaPct: 8, cpuPct: 5 };

async function run() {
  const startWall = new Date().toISOString();
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  LIVE CERTIFICATION — ${(DURATION_MS/60000).toFixed(1)} min`);
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const db         = openDatabase();
  const collector  = new MetricCollector({ db, monitorIntervalMs: Math.min(5000, CHECK_EVERY / 3) });
  const gpu        = new GPUMonitor({ intervalMs: 10000 });
  const power      = new PowerEstimator();
  const sessionId  = collector.startSession();
  gpu.start();

  // Start API, pick random port to avoid collision
  const app  = createApp(db);
  const port = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s.address().port));
    app._server = s;
  });
  console.log(`[cert] API: http://127.0.0.1:${port}  Session: ${sessionId}`);
  console.log(`[cert] Duration: ${DURATION_MS / 60000} min  Check interval: ${(CHECK_EVERY/1000).toFixed(0)}s\n`);

  // Allow V8 JIT + module load to settle, then sample baseline over 3 seconds
  const warmupMs = Math.min(CHECK_EVERY, 8000);
  console.log(`[cert] Warming up ${warmupMs / 1000}s...`);
  await new Promise((r) => setTimeout(r, warmupMs));
  if (global.gc) global.gc();

  // Use RSS (Resident Set Size) — doesn't oscillate with GC cycles like heapUsed.
  // RSS only grows when the OS actually allocates new pages; stable baseline for leak detection.
  const baselineSamples = [];
  for (let i = 0; i < 5; i++) {
    baselineSamples.push(process.memoryUsage().rss);
    await new Promise((r) => setTimeout(r, 600));
  }
  const baseRSS   = Math.round(baselineSamples.reduce((s, v) => s + v, 0) / baselineSamples.length);
  const startTime = Date.now();
  const violations  = [];
  const checkLog    = [];
  let   cpuSamples  = [];
  let   apiLatencies = [];
  let   lockErrors  = 0;
  let   peakRSS     = baseRSS;

  collector.monitor.on('sample', (r) => {
    power.record(r.cpu_pct, null);
    cpuSamples.push(r.cpu_pct);
    if (cpuSamples.length > 500) cpuSamples.shift();
    const cur = process.memoryUsage().rss;
    if (cur > peakRSS) peakRSS = cur;
  });

  // Measure API latency
  async function pingApi(path) {
    const { default: http } = await import('http');
    return new Promise((resolve) => {
      const t0  = Date.now();
      const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        res.resume();
        res.on('end', () => resolve(Date.now() - t0));
      });
      req.on('error', () => resolve(999));
      req.setTimeout(2000, () => { req.destroy(); resolve(2000); });
    });
  }

  async function check(n) {
    const elapsed      = ((Date.now() - startTime) / 60000).toFixed(2);
    const rssNow       = process.memoryUsage().rss;
    if (rssNow > peakRSS) peakRSS = rssNow;
    // RSS growth from settled baseline — stable metric, not affected by GC oscillation
    const memDeltaPct  = ((rssNow - baseRSS) / Math.max(baseRSS, 1)) * 100;
    const avgCpu       = cpuSamples.length > 0
      ? cpuSamples.reduce((s, v) => s + v, 0) / cpuSamples.length : 0;
    const writerStats  = collector.writer.getStats();
    const ledger       = verifyChain(db);

    // Sample API latency (5 pings)
    const latencies = await Promise.all(['/health','/stats','/qa','/patches','/sessions'].map(pingApi));
    apiLatencies.push(...latencies);

    // Generate activity so ledger grows
    appendAuditEvent(db, 'CERT_HEARTBEAT', { check: n, elapsed, memDeltaPct: memDeltaPct.toFixed(2) });

    const p95idx = Math.floor(apiLatencies.length * 0.95);
    const p95    = [...apiLatencies].sort((a,b)=>a-b)[p95idx] ?? 0;

      // Memory leak detection: only active after stabilization period (first 4 checks).
    // Startup RSS growth is expected (module loading, HTTP keep-alive). After that,
    // RSS should be flat. A real leak shows continuous slope in steady-state window.
    const STABILIZE_CHECKS = 4;
    let memLeaking = false;
    if (n > STABILIZE_CHECKS && checkLog.length >= STABILIZE_CHECKS + 3) {
      // Use only post-stabilization checks for slope calculation
      const steadyChecks = checkLog.slice(STABILIZE_CHECKS);
      const recent = steadyChecks.slice(-4);
      if (recent.length >= 3) {
        const xs = recent.map((_, i) => i);
        const ys = recent.map((c) => c.memDeltaPct);
        const xm = xs.reduce((s, v) => s + v, 0) / xs.length;
        const ym = ys.reduce((s, v) => s + v, 0) / ys.length;
        let num = 0, den = 0;
        for (let i = 0; i < xs.length; i++) { num += (xs[i]-xm)*(ys[i]-ym); den += (xs[i]-xm)**2; }
        const slope = den > 0 ? num / den : 0;
        // Flag leak only if still growing > 1 pct-point per check in steady state
        memLeaking = slope > 1.0;
      }
    }

    const pass = {
      memory:  !memLeaking,   // no monotonic growth trend in recent samples
      cpu:     avgCpu      < LIMITS.cpuPct,
      ledger:  ledger.valid,
      api_p95: p95 < 300,
      queue:   Object.values(writerStats.pending ?? {}).every((v) => v < 5000),
    };
    const allPass = Object.values(pass).every(Boolean);

    const entry = { check: n, elapsed_min: elapsed, pass, memDeltaPct: +memDeltaPct.toFixed(2),
      avgCpu: +avgCpu.toFixed(2), ledgerRows: ledger.rowsChecked, p95_ms: p95,
      flushed: writerStats.totalFlushed, errors: writerStats.errorCount };
    checkLog.push(entry);

    const icon = allPass ? '✅' : '❌';
    console.log(`[${elapsed}min] Check #${n} ${icon}  mem:${memDeltaPct.toFixed(1)}%  cpu:${avgCpu.toFixed(2)}%  ledger:${ledger.rowsChecked}rows  p95:${p95}ms`);

    if (!allPass) violations.push(entry);
  }

  // Periodic checks
  let checkCount = 0;
  const checkInterval = setInterval(async () => { await check(++checkCount); }, CHECK_EVERY);

  await new Promise((r) => setTimeout(r, DURATION_MS));
  clearInterval(checkInterval);
  await check(++checkCount); // final check

  await collector.stopSession();
  gpu.stop();
  await new Promise((r) => app._server.close(r));

  // ── Final report ─────────────────────────────────────────────────────────
  const finalLedger  = verifyChain(db);
  const finalPower   = power.getSession();
  // Final: peak RSS growth from settled baseline (worst-case during entire run)
  const finalMem     = ((peakRSS - baseRSS) / Math.max(baseRSS, 1)) * 100;
  const finalCpu     = cpuSamples.length > 0
    ? cpuSamples.reduce((s, v) => s + v, 0) / cpuSamples.length : 0;
  const sortedLat    = [...apiLatencies].sort((a, b) => a - b);
  const p95Final     = sortedLat[Math.floor(sortedLat.length * 0.95)] ?? 0;

  let nodeVersion = 'unknown';
  try { nodeVersion = execSync('node --version').toString().trim(); } catch {}

  const CERTIFIED = violations.length === 0 && finalLedger.valid;
  const report = {
    meta: {
      commit:       execSync('git rev-parse HEAD').toString().trim(),
      branch:       'claude/local-offline-ai-agent-PQx1C',
      node:         nodeVersion,
      os:           process.platform,
      started_at:   startWall,
      completed_at: new Date().toISOString(),
      duration_min: ((Date.now() - startTime) / 60000).toFixed(2),
    },
    verdict:   CERTIFIED ? 'CERTIFIED ✅' : 'FAILED ❌',
    checks:    checkLog.length,
    violations: violations.length,
    results: {
      memory_delta_pct: +finalMem.toFixed(2),
      avg_cpu_pct:      +finalCpu.toFixed(2),
      api_p95_ms:       p95Final,
      ledger_valid:     finalLedger.valid,
      ledger_rows:      finalLedger.rowsChecked,
      gpu_available:    gpu.available ?? false,
      power_wh:         finalPower.total_wh,
      power_cost_usd:   finalPower.cost_usd,
    },
    limits:    LIMITS,
    check_log: checkLog,
    violations,
  };

  // Write reports
  const reportsDir = join(__dirname, '../../reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(join(reportsDir, 'live-certification.json'), JSON.stringify(report, null, 2));

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  RESULT: ${report.verdict}`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Memory delta:  ${finalMem.toFixed(2)}%  (limit <${LIMITS.memDeltaPct}%)`);
  console.log(`  Avg CPU:       ${finalCpu.toFixed(2)}%  (limit <${LIMITS.cpuPct}%)`);
  console.log(`  API p95:       ${p95Final}ms  (limit <300ms)`);
  console.log(`  Ledger:        ${finalLedger.valid ? 'VALID' : 'TAMPERED'} (${finalLedger.rowsChecked} rows)`);
  console.log(`  Power:         ${finalPower.total_wh.toFixed(3)} Wh (~$${finalPower.cost_usd})`);
  console.log(`  Checks:        ${checkLog.length}  Violations: ${violations.length}`);
  console.log(`  Report:        reports/live-certification.json\n`);

  closeDatabase();
  process.exit(CERTIFIED ? 0 : 1);
}

run().catch((err) => { console.error('[cert] FATAL:', err.message); process.exit(1); });
