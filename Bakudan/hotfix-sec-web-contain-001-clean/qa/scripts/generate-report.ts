/**
 * Failure Report Generator
 * Reads Playwright JSON results and generates qa/reports/failure-report.md
 * Run after tests complete: npx ts-node qa/scripts/generate-report.ts
 */
import fs from 'fs';
import path from 'path';

const __dirname = path.join(process.cwd(), 'qa', 'scripts');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts');
const RESULTS_FILE = path.join(REPORTS_DIR, 'results.json');

interface TestResult {
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  errors?: Array<{ message: string; stack?: string }>;
}

interface Suite {
  title: string;
  specs: Array<{
    title: string;
    tests: Array<{
      status: string;
      duration: number;
      results: Array<{
        status: string;
        duration: number;
        errors?: Array<{ message: string; stack?: string }>;
        attachments?: Array<{ name: string; path: string }>;
      }>;
    }>;
  }>;
  suites?: Suite[];
}

interface PlaywrightReport {
  suites: Suite[];
  stats: {
    startTime: string;
    duration: number;
    expected: number;
    unexpected: number;
    skipped: number;
  };
}

function collectTests(suite: Suite, results: TestResult[]): void {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      const lastResult = test.results?.[test.results.length - 1];
      results.push({
        title: `${suite.title} > ${spec.title}`,
        status: (lastResult?.status || test.status) as TestResult['status'],
        duration: lastResult?.duration || test.duration,
        errors: lastResult?.errors,
      });
    }
  }
  for (const child of suite.suites || []) {
    collectTests(child, results);
  }
}

function generateReport(): void {
  if (!fs.existsSync(RESULTS_FILE)) {
    console.error('No results.json found. Run tests first.');
    process.exit(1);
  }

  const report: PlaywrightReport = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
  const allTests: TestResult[] = [];

  for (const suite of report.suites) {
    collectTests(suite, allTests);
  }

  const passed = allTests.filter((t) => t.status === 'passed');
  const failed = allTests.filter((t) => t.status === 'failed' || t.status === 'timedOut');
  const skipped = allTests.filter((t) => t.status === 'skipped');

  const lines: string[] = [
    '# QA Workflow Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Target: ${process.env.BASE_URL || 'https://preview.dashboard.bakudanramen.com'}`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Total Tests | ${allTests.length} |`,
    `| ✅ Passed | ${passed.length} |`,
    `| ❌ Failed | ${failed.length} |`,
    `| ⏭️ Skipped | ${skipped.length} |`,
    `| Duration | ${(report.stats?.duration / 1000).toFixed(1)}s |`,
    '',
    '## Workflow Steps',
    '',
    '| Step | Status | Duration |',
    '|------|--------|----------|',
  ];

  for (const t of allTests) {
    const icon = t.status === 'passed' ? '✅' : t.status === 'skipped' ? '⏭️' : '❌';
    lines.push(`| ${t.title} | ${icon} ${t.status} | ${(t.duration / 1000).toFixed(1)}s |`);
  }

  // Failure details
  if (failed.length > 0) {
    lines.push('', '## ❌ Failures', '');

    for (const t of failed) {
      lines.push(`### ${t.title}`, '');
      if (t.errors && t.errors.length > 0) {
        for (const err of t.errors) {
          lines.push('**Error:**', '```', err.message, '```', '');
          if (err.stack) {
            lines.push('**Stack trace:**', '```', err.stack, '```', '');
          }
        }
      }

      // Check for associated evidence files
      const safeName = t.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const today = new Date().toISOString().slice(0, 10);
      const evidencePath = path.join(ARTIFACTS_DIR, today, `${safeName}_evidence.json`);
      if (fs.existsSync(evidencePath)) {
        const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
        if (evidence.consoleLogs?.length) {
          lines.push('**Console Errors:**', '```', ...evidence.consoleLogs.slice(-20), '```', '');
        }
        if (evidence.networkLogs?.length) {
          lines.push('**Network Errors:**', '```', ...evidence.networkLogs.slice(-20), '```', '');
        }
        if (evidence.screenshots?.length) {
          lines.push('**Screenshots:**');
          for (const ss of evidence.screenshots) {
            lines.push(`- ${path.basename(ss)}`);
          }
          lines.push('');
        }
      }
    }
  }

  // Evidence artifacts
  lines.push('', '## Artifacts', '');
  const today = new Date().toISOString().slice(0, 10);
  const todayDir = path.join(ARTIFACTS_DIR, today);
  if (fs.existsSync(todayDir)) {
    const files = fs.readdirSync(todayDir);
    lines.push(`Found ${files.length} artifacts in \`qa/artifacts/${today}/\`:`, '');
    for (const f of files.sort()) {
      lines.push(`- ${f}`);
    }
  }

  // Write report
  const reportContent = lines.join('\n');
  const failureReportPath = path.join(REPORTS_DIR, 'failure-report.md');
  fs.writeFileSync(failureReportPath, reportContent);

  // Also copy to artifacts
  if (fs.existsSync(todayDir)) {
    fs.writeFileSync(path.join(todayDir, 'failure-report.md'), reportContent);
  }

  console.log(`\nReport generated: ${failureReportPath}`);
  console.log(`  Total: ${allTests.length} | Passed: ${passed.length} | Failed: ${failed.length} | Skipped: ${skipped.length}`);

  if (failed.length > 0) {
    console.log('\n❌ WORKFLOW FAILED - See failure-report.md for details');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED');
  }
}

generateReport();
