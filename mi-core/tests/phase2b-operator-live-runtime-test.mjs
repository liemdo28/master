/**
 * Phase 2B - Operator Live Execution Runtime Test
 *
 * Certifies safe local browser control only. No SaaS login, MFA, CAPTCHA,
 * production write, credential storage, or external business action.
 */

import http from 'http';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const OPERATOR_DATA_DIR = join(PROJECT_ROOT, '.local-agent-global', 'operator-runtime');

if (existsSync(OPERATOR_DATA_DIR)) rmSync(OPERATOR_DATA_DIR, { recursive: true, force: true });
mkdirSync(OPERATOR_DATA_DIR, { recursive: true });

const server = http.createServer((req, res) => {
  if (req.url === '/download.txt') {
    res.writeHead(200, {
      'content-type': 'text/plain',
      'content-disposition': 'attachment; filename="phase2b-download.txt"',
    });
    res.end('phase 2b download proof\n');
    return;
  }
  if (req.url === '/crawl-target') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>Crawl Target</title><main id="target">crawl target reached</main>');
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(`<!doctype html>
    <html>
      <head><title>Phase 2B Operator Test</title></head>
      <body>
        <main>
          <h1>Phase 2B Operator Test</h1>
          <form id="demo-form" onsubmit="event.preventDefault(); document.querySelector('#result').textContent = 'submitted: ' + document.querySelector('#name').value;">
            <label>Name <input id="name" name="name" /></label>
            <button id="submit" type="submit">Submit</button>
          </form>
          <p id="result">waiting</p>
          <a id="crawl-link" href="/crawl-target">Crawl Target</a>
          <a id="download-link" href="/download.txt">Download Proof</a>
        </main>
      </body>
    </html>`);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase2b', 'operator-runtime');
const { runOperatorTask } = await import(pathToFileURL(join(dist, 'task-runner.js')).href);
const { evaluatePolicy } = await import(pathToFileURL(join(dist, 'policy-guard.js')).href);

let passed = 0;
let failed = 0;
function assert(label, condition) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

try {
  console.log('\n=== TEST 1: Policy Gate Blocks Production Targets ===');
  const blocked = evaluatePolicy({
    task_id: 'OP-POLICY-001',
    objective_id: 'OBJ-P2B',
    mode: 'FINANCIAL_ACTION',
    adapter: 'playwright',
    target: { type: 'web', url: 'https://quickbooks.intuit.com', category: 'quickbooks' },
    actions: [{ type: 'navigate', url: 'https://quickbooks.intuit.com' }],
    evidence_required: true,
  });
  console.log(JSON.stringify(blocked, null, 2));
  assert('QuickBooks financial action blocked', blocked.ok === false && blocked.status === 'BLOCKED_BY_POLICY');

  console.log('\n=== TEST 2: Local Browser Control/Form/Crawl/Download/Telemetry ===');
  const result = await runOperatorTask({
    task_id: 'OP-2B-001',
    objective_id: 'OBJ-P2B',
    mode: 'SAFE_WRITE_TEST_ONLY',
    adapter: 'playwright',
    target: { type: 'web', url: baseUrl, category: 'local-test' },
    actions: [
      { type: 'navigate', url: baseUrl },
      { type: 'read_title' },
      { type: 'fill', selector: '#name', value: 'Mi Operator' },
      { type: 'click', selector: '#submit' },
      { type: 'read_text', selector: '#result' },
      { type: 'extract_links' },
      { type: 'screenshot' },
      { type: 'download', url: `${baseUrl}/download.txt`, filename: 'phase2b-download.txt' },
    ],
    evidence_required: true,
  });
  console.log(JSON.stringify({
    ok: result.ok,
    status: result.status,
    title: result.result?.title,
    text: result.result?.text,
    links: Array.isArray(result.result?.links) ? result.result.links.length : 0,
    evidence: result.evidence?.length || 0,
    errors: result.errors || [],
  }, null, 2));

  assert('Operator task completed', result.ok === true && result.status === 'DONE');
  assert('Browser title read', result.result?.title === 'Phase 2B Operator Test');
  assert('Form submit observed', String(result.result?.text || '').includes('submitted: Mi Operator'));
  assert('Crawl links extracted', Array.isArray(result.result?.links) && result.result.links.some((link) => String(link.href).includes('/crawl-target')));
  assert('Evidence captured', Array.isArray(result.evidence) && result.evidence.length >= 4);
  assert('Screenshot evidence captured', result.evidence.some((path) => String(path).endsWith('.png') || String(path).includes('screenshots.json')));
  assert('Download evidence captured', result.evidence.some((path) => String(path).includes('phase2b-download.txt') || String(path).includes('downloads.json')));
  assert('Telemetry log captured', result.evidence.some((path) => String(path).endsWith('log.json')));
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 2B OPERATOR LIVE EXECUTION: ' + (failed === 0 ? 'OPERATIONAL' : 'PARTIAL'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'OPERATIONAL' : 'PARTIAL'));
console.log('============================================================\n');

process.exit(failed === 0 ? 0 : 1);
