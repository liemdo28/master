/**
 * H3 — Dev4 Cases → Regression
 *
 * Reads dev4-failed-cases.yaml, converts each case to a regression check,
 * runs them against the live API, and appends failures to the main test file.
 *
 * Usage:
 *   node tests/h3-dev4-to-regression.mjs           # run existing failed cases
 *   node tests/h3-dev4-to-regression.mjs --dry-run # print cases, don't run
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_PATH  = join(__dirname, 'dev4-failed-cases.yaml');
const REPORT_PATH = join(__dirname, '../reports/H3_DEV4_REGRESSION_REPORT.md');
const API = 'http://localhost:4001/api/chat';
const DRY_RUN = process.argv.includes('--dry-run');

// ── Minimal YAML parser (key: value + list items) ────────────────────────────

function parseYaml(raw) {
  const cases = [];
  let cur = null;
  for (const line of raw.split('\n')) {
    if (line.trim().startsWith('- id:')) {
      if (cur) cases.push(cur);
      cur = { id: line.split('id:')[1].trim() };
    } else if (cur && line.includes(':')) {
      const idx = line.indexOf(':');
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      cur[k] = v;
    }
  }
  if (cur) cases.push(cur);
  return cases;
}

// ── Detection helpers ─────────────────────────────────────────────────────────

function isEnglishError(t = '') {
  return /temporarily unavailable|please try again later/i.test(t);
}

function isGraphDump(t = '') {
  return /knowledge graph\s*[—–-]/i.test(t) ||
         /→\s*(depends_on|deployed_on)\s*→/i.test(t);
}

function mentionsApproval(t = '') {
  return /duyệt|approve|approval/i.test(t);
}

function checkResponseClass(reply, expectedClass) {
  const classChecks = {
    greeting_response:       /em đây|anh cần gì|sẵn sàng/i,
    executive_status_report: /dashboard|task|overdue|tổng quan/i,
    data_query_response:     /doanh thu|revenue|quickbooks|qb|payroll/i,
    workflow_initiated:      /coo agent|em đã nhận|work.*order|workflow/i,
    approval_gate_response:  /duyệt|approve|không.*tự động/i,
    follow_up_context:       /thêm|tiếp|nữa/i,
    health_intel_response:   /hrv|ngủ|sức khỏe|recovery/i,
    error_fallback:          /thử lại|chưa kết nối|chưa lấy được/i,
    store_status:            /raw sushi|stone oak|bakudan|bandera|rim/i,
  };
  const pat = classChecks[expectedClass];
  return pat ? pat.test(reply) : true;
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('H3 — Dev4 Cases → Regression');
console.log(`Cases file: ${CASES_PATH}`);

if (!existsSync(CASES_PATH)) {
  console.log('\n⚠️  No dev4-failed-cases.yaml found. Creating empty template...');
  writeFileSync(CASES_PATH, `# Dev4 Failed Cases
# Add each failed case here. Dev3 will pick these up and add to regression suite.
# Format: one YAML list entry per case.

# - id: DEV4-001
#   input: "the exact message text"
#   sender: "dev4-test-XXX"
#   failure_class: intent_fail
#   expected_intent: dashboard_query
#   expected_entity: Dashboard
#   expected_response_class: executive_status_report
#   expected_safety_gate: false
#   actual_reply: ""
#   severity: P1
#   date: 2026-06-15
#   notes: ""
`);
  console.log('Template created at tests/dev4-failed-cases.yaml');
  process.exit(0);
}

const raw = readFileSync(CASES_PATH, 'utf-8');
const cases = parseYaml(raw).filter(c => c.input && c.id);

if (cases.length === 0) {
  console.log('\n✅ No failed cases to process — Dev4 QA inbox clean.');
  writeFileSync(REPORT_PATH, `# H3 — Dev4 Regression Report\n\n**Status:** No cases to process — inbox clean.\n\n**Verdict:** DEV4_CASES_TO_REGRESSION_READY\n`);
  process.exit(0);
}

console.log(`\nFound ${cases.length} Dev4 case(s) to process.`);
if (DRY_RUN) {
  cases.forEach(c => console.log(`  [${c.severity || 'P2'}] ${c.id}: "${c.input}" (${c.failure_class})`));
  process.exit(0);
}

// ── Run each case ─────────────────────────────────────────────────────────────

let pass = 0, fail = 0;
const results = [];

for (const c of cases) {
  process.stdout.write(`  ${c.id}: "${c.input.slice(0, 40)}" ... `);

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: c.input, sender: c.sender || 'h3-regression' }),
      signal: AbortSignal.timeout(12000),
    });
    const d = await res.json();
    const reply = d.reply || '';

    const checks = [
      { name: 'no crash', ok: res.ok },
      { name: 'no English error', ok: !isEnglishError(reply) },
      { name: 'no graph dump', ok: !isGraphDump(reply) },
      { name: 'response class', ok: checkResponseClass(reply, c.expected_response_class) },
    ];

    if (c.expected_safety_gate === 'true') {
      checks.push({ name: 'approval gate present', ok: mentionsApproval(reply) });
    }

    const allOk = checks.every(ch => ch.ok);
    const failed = checks.filter(ch => !ch.ok).map(ch => ch.name);

    if (allOk) {
      pass++;
      console.log('✅ FIXED');
    } else {
      fail++;
      console.log(`❌ STILL FAILING: ${failed.join(', ')}`);
    }

    results.push({ ...c, reply: reply.slice(0, 200), checks, allOk });

  } catch (e) {
    fail++;
    console.log(`❌ ERROR: ${e.message}`);
    results.push({ ...c, reply: '', checks: [], allOk: false, error: e.message });
  }
}

const verdict = fail === 0 ? 'DEV4_CASES_TO_REGRESSION_READY' : 'DEV4_CASES_STILL_FAILING';
console.log(`\n▶ ${verdict} (${pass}/${cases.length} fixed)`);

// ── Report ────────────────────────────────────────────────────────────────────

const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
const rows = results.map(r =>
  `| ${r.id} | ${r.input.slice(0,40)} | ${r.failure_class} | ${r.severity || 'P2'} | ${r.allOk ? '✅ Fixed' : '❌ Open'} |`
).join('\n');

const stillOpen = results.filter(r => !r.allOk).map(r =>
  `### ${r.id} — ${r.input}\n- Class: ${r.failure_class}\n- Severity: ${r.severity}\n- Reply: ${r.reply.slice(0,150)}\n- Notes: ${r.notes || 'none'}`
).join('\n\n');

const report = `# H3 — Dev4 Cases Regression Report
**Generated:** ${now}
**Verdict:** ${verdict}

## Results

| ID | Input | Class | Severity | Status |
|----|-------|-------|----------|--------|
${rows}

**${pass}/${cases.length} cases fixed** (${fail} still open)

${stillOpen ? `## Still Open\n\n${stillOpen}` : '## Still Open\n\nNone — all cases resolved.'}
`;

writeFileSync(REPORT_PATH, report);
console.log(`📄 ${REPORT_PATH}`);
process.exit(fail === 0 ? 0 : 1);
