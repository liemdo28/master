/**
 * eval/scoreboard.js — M1: Scoreboard
 * ====================================
 * Aggregates all benchmark results into a single scorecard.
 * Generates HTML report and writes delta vs baseline.
 *
 * Usage:
 *   node eval/scoreboard.js
 *   node eval/scoreboard.js --html
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');
const BASELINE_FILE = join(__dirname, '..', 'metrics', 'baseline-2026-05-18.json');
const REPORT_DIR = join(__dirname, 'reports');
mkdirSync(REPORT_DIR, { recursive: true });

// ─── Load Latest Results ────────────────────────────────────────────────────
function loadLatestResults() {
  if (!existsSync(RESULTS_DIR)) {
    console.warn('[scoreboard] No results directory found. Run benchmarks first.');
    return {};
  }

  const benchmarks = {};
  const files = readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    // Extract benchmark name (everything before the first -timestamp.json)
    const match = file.match(/^(.+?)-\\d{4}-\\d{2}-\\d{2}T.+\\.json$/);
    if (!match) continue;
    
    const name = match[1];
    const filepath = join(RESULTS_DIR, file);
    const stat = readFileSync(filepath, 'utf-8');
    const data = JSON.parse(stat);
    
    // Keep the latest result for each benchmark
    if (!benchmarks[name] || data.timestamp > benchmarks[name].timestamp) {
      benchmarks[name] = data;
    }
  }
  
  return benchmarks;
}

// ─── Load Baseline ──────────────────────────────────────────────────────────
function loadBaseline() {
  if (!existsSync(BASELINE_FILE)) {
    console.warn(`[scoreboard] Baseline file not found: ${BASELINE_FILE}`);
    return null;
  }
  return JSON.parse(readFileSync(BASELINE_FILE, 'utf-8'));
}

// ─── Compute Delta ───────────────────────────────────────────────────────────
function computeDelta(current, baseline, key) {
  const currentVal = current?.[key] ?? null;
  const baselineVal = baseline?.[key] ?? null;
  
  if (currentVal === null || baselineVal === null) {
    return { current: currentVal, baseline: baselineVal, delta: null, direction: 'neutral' };
  }
  
  const delta = currentVal - baselineVal;
  return {
    current: currentVal,
    baseline: baselineVal,
    delta: delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral',
  };
}

// ─── Generate HTML Report ───────────────────────────────────────────────────
function generateHTML(scorecard) {
  const timestamp = new Date().toISOString();
  const benchmarks = scorecard.benchmarks;
  const baseline = scorecard.baseline;
  
  const rows = Object.entries(benchmarks).map(([name, data]) => {
    const passRate = data.stats ? (data.stats.passed / data.stats.total).toFixed(4) : 'N/A';
    const delta = data.delta;
    const deltaStr = delta !== null ? (delta >= 0 ? `+${delta.toFixed(4)}` : delta.toFixed(4)) : '—';
    const deltaColor = delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : '#6b7280';
    const status = data.stats ? `${data.stats.passed}/${data.stats.total}` : 'N/A';
    
    return `    <tr>
      <td><code>${name}</code></td>
      <td class="num">${passRate}</td>
      <td class="num">${data.baseline !== null ? data.baseline.toFixed(4) : '—'}</td>
      <td class="num" style="color:${deltaColor}">${deltaStr}</td>
      <td class="num">${status}</td>
      <td>${data.stats ? `${data.stats.errors} errors, ${data.stats.skipped} skipped` : '—'}</td>
      <td>${data.timestamp || '—'}</td>
    </tr>`;
  }).join('\n');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Local Agent — Eval Scorecard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; padding: 2rem; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; }
    .subtitle { color: #94a3b8; font-size: 0.875rem; margin-bottom: 2rem; }
    .card { background: #1e293b; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .card h2 { font-size: 1rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.5rem 0.75rem; border-bottom: 1px solid #334155; }
    td { padding: 0.75rem; border-bottom: 1px solid #1e293b; font-size: 0.875rem; }
    td code { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem; color: #38bdf8; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .up { color: #16a34a; }
    .down { color: #dc2626; }
    .neutral { color: #6b7280; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .metric { background: #0f172a; border-radius: 8px; padding: 1rem; }
    .metric .label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .metric .value { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; }
    .metric .sub { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; }
    .status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .status-pass { background: #052e16; color: #16a34a; }
    .status-fail { background: #450a0a; color: #dc2626; }
    .status-neutral { background: #1e293b; color: #6b7280; }
    .footer { text-align: center; color: #475569; font-size: 0.75rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Local Agent — Eval Scorecard</h1>
    <p class="subtitle">Generated: ${timestamp} | Branch: ${scorecard.branch} | Commit: ${scorecard.commit}</p>
    
    <div class="summary-grid">
      <div class="metric">
        <div class="label">Benchmarks Run</div>
        <div class="value">${Object.keys(benchmarks).length}</div>
        <div class="sub">of 6 total</div>
      </div>
      <div class="metric">
        <div class="label">HumanEval pass@1</div>
        <div class="value">${benchmarks.humaneval ? (benchmarks.humaneval.stats.passed / benchmarks.humaneval.stats.total).toFixed(4) : '—'}</div>
        <div class="sub">V1 target: 0.85</div>
      </div>
      <div class="metric">
        <div class="label">MBPP pass@1</div>
        <div class="value">${benchmarks.mbpp ? (benchmarks.mbpp.stats.passed / benchmarks.mbpp.stats.total).toFixed(4) : '—'}</div>
        <div class="sub">V1 target: 0.80</div>
      </div>
      <div class="metric">
        <div class="label">SWE-bench-Lite</div>
        <div class="value">${benchmarks['swe-bench-lite'] ? (benchmarks['swe-bench-lite'].stats.passed / benchmarks['swe-bench-lite'].stats.total).toFixed(4) : '—'}</div>
        <div class="sub">V1 target: 0.35</div>
      </div>
    </div>
    
    <div class="card" style="margin-top: 1.5rem;">
      <h2>Detailed Results</h2>
      <table>
        <thead>
          <tr>
            <th>Benchmark</th>
            <th class="num">pass@1</th>
            <th class="num">baseline</th>
            <th class="num">delta</th>
            <th class="num">passed/total</th>
            <th>notes</th>
            <th>last run</th>
          </tr>
        </thead>
        <tbody>
${rows || '          <tr><td colspan="7" style="text-align:center;color:#64748b">No benchmark results yet. Run: npm run eval:all</td></tr>'}
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      Local Agent — Sovereign Engineering Intelligence<br>
      See eval/results/ for raw JSON results. | Metrics: metrics/baseline-*.json
    </div>
  </div>
</body>
</html>`;
}

// ─── Main Scoreboard Function ────────────────────────────────────────────────
export async function scoreboard({ model, limit } = {}) {
  console.log('\\n=== Local Agent Scoreboard ===\\n');
  
  const results = loadLatestResults();
  const baseline = loadBaseline();
  
  if (Object.keys(results).length === 0) {
    console.warn('No benchmark results found in eval/results/.');
    console.warn('Run benchmarks first:');
    console.warn('  node eval/runner.js --benchmark humaneval --limit 10');
    console.warn('  node eval/runner.js --benchmark mbpp --limit 10');
    console.warn('  node eval/runner.js --all');
    
    // Still generate scorecard with null values
    const scorecard = {
      timestamp: new Date().toISOString(),
      branch: 'unknown',
      commit: 'unknown',
      benchmarks: {},
      baseline: baseline?.benchmarks || {},
      summary: { totalBenchmarks: 0, benchmarksWithData: 0 },
    };
    
    return scorecard;
  }
  
  // Build scorecard
  const scorecard = {
    timestamp: new Date().toISOString(),
    branch: baseline?.branch || 'unknown',
    commit: baseline?.commit || 'unknown',
    benchmarks: {},
    baseline: baseline?.benchmarks || {},
    summary: { totalBenchmarks: 0, benchmarksWithData: 0 },
  };
  
  const BENCHMARK_KEYS = ['humaneval', 'mbpp', 'swe-bench-lite', 'multipl-e', 'ds-1000', 'codecontests'];
  
  for (const name of BENCHMARK_KEYS) {
    const result = results[name];
    const baselineBench = baseline?.benchmarks?.[name.replace(/-/g, '_') + '_pass_at_1'] ?? null;
    
    if (result && result.stats) {
      const passRate = result.stats.total > 0 ? result.stats.passed / result.stats.total : null;
      scorecard.benchmarks[name] = {
        ...result,
        passRate,
        baseline: baselineBench,
        delta: baselineBench !== null && passRate !== null ? passRate - baselineBench : null,
      };
      scorecard.summary.benchmarksWithData++;
    } else {
      scorecard.benchmarks[name] = {
        stats: null,
        passRate: null,
        baseline: baselineBench,
        delta: null,
        timestamp: null,
      };
    }
    scorecard.summary.totalBenchmarks++;
  }
  
  // Print summary
  console.log('Benchmark Results:');
  console.log('─'.repeat(70));
  
  for (const [name, data] of Object.entries(scorecard.benchmarks)) {
    if (data.stats) {
      const passRate = (data.passRate * 100).toFixed(2);
      const delta = data.delta !== null ? `${data.delta >= 0 ? '+' : ''}${(data.delta * 100).toFixed(2)}pp` : '(no baseline)';
      const bar = '█'.repeat(Math.round(data.passRate * 20)) + '░'.repeat(20 - Math.round(data.passRate * 20));
      console.log(`  ${name.padEnd(18)} ${bar} ${passRate.padStart(7)}%  ${delta}`);
    } else {
      console.log(`  ${name.padEnd(18)} ${'░'.repeat(20)}   NOT RUN`);
    }
  }
  
  console.log('─'.repeat(70));
  console.log(`  Total benchmarks: ${scorecard.summary.totalBenchmarks}`);
  console.log(`  Benchmarks run:   ${scorecard.summary.benchmarksWithData}`);
  
  // Write scorecard JSON
  const scorecardFile = join(RESULTS_DIR, `scorecard-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(scorecardFile, JSON.stringify(scorecard, null, 2));
  console.log(`\\nScorecard JSON: ${scorecardFile}`);
  
  // Write latest scorecard as current
  const currentScorecardFile = join(RESULTS_DIR, 'scorecard-current.json');
  writeFileSync(currentScorecardFile, JSON.stringify(scorecard, null, 2));
  console.log(`Current scorecard: ${currentScorecardFile}`);
  
  return scorecard;
}

// ─── CLI ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const flags = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      flags[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    }
  }
  
  const scorecard = await scoreboard({});
  
  if (flags.html) {
    const html = generateHTML(scorecard);
    const htmlFile = join(REPORT_DIR, `scorecard-${new Date().toISOString().replace(/[:.]/g, '-')}.html`);
    writeFileSync(htmlFile, html);
    console.log(`\\nHTML Report: ${htmlFile}`);
    
    // Also write latest
    const latestHTML = join(REPORT_DIR, 'scorecard.html');
    writeFileSync(latestHTML, html);
    console.log(`Latest HTML:  ${latestHTML}`);
  }
  
  console.log('\\nDone.');
}

main().catch(err => {
  console.error(`[scoreboard] Error: ${err.message}`);
  process.exit(1);
});