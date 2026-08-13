/**
 * Phase 7A.9 — runtime preflight CLI. Read-only diagnostics.
 * Usage: tsx src/runtime-preflight/cli.ts [runtimeRoot]
 * Defaults to the current server's parent directory (i.e. the runtime root
 * this process is itself running from).
 */
import path from 'path';
import { runPreflight } from './validator';

async function main(): Promise<void> {
  const runtimeRoot = process.argv[2] || path.resolve(__dirname, '..', '..', '..');
  const report = await runPreflight(runtimeRoot);

  console.log(`[runtime-preflight] root: ${report.runtimeRoot}`);
  console.log(`[runtime-preflight] generated: ${report.generatedAt}`);
  for (const c of report.checks) {
    const marker = c.status === 'PASS' ? '✓' : c.status === 'WARN' ? '⚠' : c.status === 'SKIP' ? '·' : '✗';
    console.log(`  ${marker} ${c.id}: ${c.detail}`);
  }
  console.log(`[runtime-preflight] overall: ${report.overall}`);

  if (report.overall === 'FAIL') process.exitCode = 1;
}

if (require.main === module) {
  main().catch(err => { console.error('[runtime-preflight] fatal:', err); process.exitCode = 1; });
}
