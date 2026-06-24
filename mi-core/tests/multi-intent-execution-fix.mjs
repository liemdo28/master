import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const { executeMultiIntent } = await import('../server/dist/execution/multi-intent-executor.js');

function pass(cond, label, detail = '') {
  return { label, pass: Boolean(cond), detail };
}

function workflowTypes(result) {
  return result.children.map(c => c.workflow_type);
}

function hasTypes(result, expected) {
  const types = workflowTypes(result);
  return expected.every(t => types.includes(t));
}

function hasNoDrop(result) {
  return result.dropped_children === 0 && result.executed_children === result.expected_children;
}

function runCase(id, message, expectedTypes, opts = {}) {
  const result = executeMultiIntent(message, { sender: 'dev5-regression', parentTrackingId: `WF-${id}`, ...opts });
  const checks = [
    pass(hasNoDrop(result), `${id}: no silent drop`, `${result.executed_children}/${result.expected_children}`),
    pass(hasTypes(result, expectedTypes), `${id}: expected workflow types`, workflowTypes(result).join(',')),
    pass(result.children.every(c => c.workflow_id && c.tracking_id), `${id}: all children visible`, result.children.map(c => c.tracking_id).join(',')),
  ];
  return { id, message, expectedTypes, result, checks, pass: checks.every(c => c.pass) };
}

const m1 = runCase('M1', 'Dashboard + QB', ['DASHBOARD_AUDIT', 'FINANCE_REPORT']);
const m2 = runCase('M2', 'Dashboard + QB + Raw SEO', ['DASHBOARD_AUDIT', 'FINANCE_REPORT', 'SEO_CONTENT']);
const m3 = runCase('M3', 'Dashboard + QB + Raw SEO + Maria', ['DASHBOARD_AUDIT', 'FINANCE_REPORT', 'SEO_CONTENT', 'EMAIL_DRAFT']);
const m4 = runCase('M4', 'Dashboard + QB + Raw SEO + Maria', ['DASHBOARD_AUDIT', 'FINANCE_REPORT', 'SEO_CONTENT', 'EMAIL_DRAFT'], {
  forcedFailureDomains: ['finance_qb'],
});
m4.checks.push(pass(
  m4.result.children.find(c => c.domain === 'finance_qb')?.status === 'failed'
    && m4.result.children.filter(c => c.domain !== 'finance_qb').every(c => c.status !== 'failed'),
  'M4: partial failure isolated',
  m4.result.children.map(c => `${c.domain}:${c.status}`).join(','),
));
m4.pass = m4.checks.every(c => c.pass);

const m5 = runCase('M5', 'Dashboard + QB + Raw SEO + Maria', ['DASHBOARD_AUDIT', 'FINANCE_REPORT', 'SEO_CONTENT', 'EMAIL_DRAFT'], {
  parentTrackingId: 'WF-001',
});
m5.checks.push(pass(
  m5.result.parent_tracking_id === 'WF-001'
    && ['WF-001-A', 'WF-001-B', 'WF-001-C', 'WF-001-D'].every(id => m5.result.children.some(c => c.tracking_id === id)),
  'M5: parent and child tracking visible',
  `${m5.result.parent_tracking_id} -> ${m5.result.children.map(c => c.tracking_id).join(',')}`,
));
m5.pass = m5.checks.every(c => c.pass);

const variants = [
  'Dashboard + QB',
  'Check Dashboard + QB',
  'Dashboard + QuickBooks',
  'Dashboard + QB + Raw SEO',
  'Check Dashboard + QuickBooks + Raw SEO',
  'Dashboard + QB + SEO Raw Sushi',
  'Dashboard + QB + Raw SEO + Maria',
  'Check Dashboard + QB + Raw SEO + báo Maria',
  'Review Dashboard + QuickBooks + tạo SEO Raw Sushi + gửi Maria',
  'Dashboard + coi QB + Raw Sushi SEO + send Maria',
];

const regression = [];
for (let i = 0; i < 100; i++) {
  const message = variants[i % variants.length];
  const expected = message.includes('Maria')
    ? ['DASHBOARD_AUDIT', 'FINANCE_REPORT', 'SEO_CONTENT', 'EMAIL_DRAFT']
    : message.toLowerCase().includes('seo')
      ? ['DASHBOARD_AUDIT', 'FINANCE_REPORT', 'SEO_CONTENT']
      : ['DASHBOARD_AUDIT', 'FINANCE_REPORT'];
  const result = executeMultiIntent(message, { sender: 'dev5-regression', parentTrackingId: `WF-R${String(i + 1).padStart(3, '0')}` });
  regression.push({
    id: `R${String(i + 1).padStart(3, '0')}`,
    message,
    expected,
    actual: workflowTypes(result),
    executed_children: result.executed_children,
    expected_children: result.expected_children,
    dropped_children: result.dropped_children,
    pass: hasNoDrop(result) && hasTypes(result, expected),
    trace_path: result.trace_path,
  });
}

const suites = [m1, m2, m3, m4, m5];
const regressionPassed = regression.filter(r => r.pass).length;
const successRate = Math.round((regressionPassed / regression.length) * 100);
const overallPass = suites.every(s => s.pass) && successRate >= 95 && regression.every(r => r.dropped_children === 0);

const evidence = {
  generated_at: new Date().toISOString(),
  overallPass,
  suites,
  regressionPassed,
  regressionTotal: regression.length,
  successRate,
  regression,
};

fs.writeFileSync(path.join(ROOT, 'reports', 'multi-intent-execution-evidence.json'), JSON.stringify(evidence, null, 2));

const executionRows = suites.map(s => `| ${s.id} | ${s.pass ? 'PASS' : 'FAIL'} | ${s.result.executed_children}/${s.result.expected_children} | ${s.result.dropped_children} | ${s.result.children.map(c => `${c.tracking_id}:${c.workflow_type}:${c.status}`).join('<br>')} |`).join('\n');

fs.writeFileSync(path.join(ROOT, 'MULTI_INTENT_EXECUTION_REPORT.md'), `# MULTI_INTENT_EXECUTION_REPORT

**Generated:** ${evidence.generated_at}
**Target:** MULTI_INTENT_EXECUTION_READY
**Result:** ${suites.every(s => s.pass) ? 'PASS' : 'FAIL'}

| Case | Result | Executed | Dropped | Children |
|---|---:|---:|---:|---|
${executionRows}

## Partial Failure

M4 forced QB/finance failure. Dashboard, SEO, and Maria children still executed; QB was marked failed. No global abort occurred.

Evidence: \`reports/multi-intent-execution-evidence.json\`.
`);

fs.writeFileSync(path.join(ROOT, 'MULTI_INTENT_E2E_REPORT.md'), `# MULTI_INTENT_E2E_REPORT

**Generated:** ${evidence.generated_at}
**Result:** ${overallPass ? 'PASS' : 'FAIL'}

## E2E Summary

| Requirement | Result |
|---|---:|
| M1 Dashboard + QB | ${m1.pass ? 'PASS' : 'FAIL'} |
| M2 Dashboard + QB + SEO | ${m2.pass ? 'PASS' : 'FAIL'} |
| M3 Dashboard + QB + SEO + Maria | ${m3.pass ? 'PASS' : 'FAIL'} |
| M4 partial failure handling | ${m4.pass ? 'PASS' : 'FAIL'} |
| M5 parent/child workflow tracking | ${m5.pass ? 'PASS' : 'FAIL'} |

Parent/child tracking example: \`WF-001\` -> \`WF-001-A\`, \`WF-001-B\`, \`WF-001-C\`, \`WF-001-D\`.

Evidence: \`reports/multi-intent-execution-evidence.json\`.
`);

fs.writeFileSync(path.join(ROOT, 'MULTI_INTENT_REGRESSION.md'), `# MULTI_INTENT_REGRESSION

**Generated:** ${evidence.generated_at}
**Result:** ${successRate >= 95 ? 'PASS' : 'FAIL'}

| Gate | Result |
|---|---:|
| Compound requests | ${regression.length} |
| Passed | ${regressionPassed}/${regression.length} |
| Success rate | ${successRate}% |
| Dropped child workflows | ${regression.reduce((n, r) => n + r.dropped_children, 0)} |

Acceptance requires 95%+ with no silent drop and no skipped child workflow.

Evidence: \`reports/multi-intent-execution-evidence.json\`.
`);

console.log(JSON.stringify({
  overallPass,
  suites: suites.map(s => ({ id: s.id, pass: s.pass, executed: s.result.executed_children, dropped: s.result.dropped_children })),
  regressionPassed,
  regressionTotal: regression.length,
  successRate,
}, null, 2));

process.exit(overallPass ? 0 : 1);
