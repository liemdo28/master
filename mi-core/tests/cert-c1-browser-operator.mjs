/**
 * Phase C1 — Browser Operator Certification
 * Target: BROWSER_OPERATOR_CERTIFIED
 *
 * Run: node tests/cert-c1-browser-operator.mjs
 */

import { createRequire } from 'module';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require    = createRequire(import.meta.url);
const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DIST       = path.resolve(__dirname, '../server/dist');
const EVIDENCE   = path.resolve(__dirname, '../reports/evidence');

if (!fs.existsSync(EVIDENCE)) fs.mkdirSync(EVIDENCE, { recursive: true });

const {
  navigate, fillForm, login, screenshot, upload, logout, playwrightAvailable,
} = require(`${DIST}/coo-v4/agents/browser-operator.js`);

let passed = 0, failed = 0;
const log = [];

function step(name, fn) {
  try {
    const r = fn();
    const ok = r !== false && r !== null;
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    log.push({ step: name, status: ok ? 'PASS' : 'FAIL', result: r });
    if (ok) passed++; else failed++;
    return r;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    log.push({ step: name, status: 'ERROR', error: e.message });
    failed++;
    return null;
  }
}

async function astep(name, fn) {
  try {
    const r = await fn();
    const ok = r && (r.success !== false);
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    if (r?.output) console.log(`     → ${String(r.output).slice(0, 120)}`);
    log.push({ step: name, status: ok ? 'PASS' : 'FAIL', result: r });
    if (ok) passed++; else failed++;
    return r;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    log.push({ step: name, status: 'ERROR', error: e.message });
    failed++;
    return null;
  }
}

console.log('\n🌐 Phase C1 — Browser Operator Certification');
console.log('═'.repeat(55));

// ── Check 1: Module loads and function signatures present ──────────────────
console.log('\n[1] Module integrity check');
step('navigate() function exported', () => typeof navigate === 'function');
step('fillForm() function exported', () => typeof fillForm === 'function');
step('login() function exported', () => typeof login === 'function');
step('screenshot() function exported', () => typeof screenshot === 'function');
step('upload() function exported', () => typeof upload === 'function');
step('logout() function exported', () => typeof logout === 'function');
step('playwrightAvailable() function exported', () => typeof playwrightAvailable === 'function');

// ── Check 2: Environment check ─────────────────────────────────────────────
console.log('\n[2] Environment detection');
const pwAvailable = step('Playwright availability check runs without crash', () => {
  const r = playwrightAvailable();
  return typeof r === 'boolean';
});
const pwState = playwrightAvailable();
console.log(`     → Playwright installed: ${pwState}`);
log.push({ step: 'playwright_installed', value: pwState });

// ── Check 3: Graceful degradation or real execution ────────────────────────
console.log('\n[3] Open browser / Navigate');
const navResult = await astep('navigate(url) returns structured AgentResult', async () => {
  return navigate('https://httpbin.org/get');
});

console.log('\n[4] Login flow');
const loginResult = await astep('login(url, user, pass) returns structured AgentResult', async () => {
  return login('https://httpbin.org/basic-auth/admin/pass', 'admin', 'pass');
});

console.log('\n[5] Fill form / Submit draft');
const fillResult = await astep('fillForm(url, fields) returns structured AgentResult', async () => {
  return fillForm('https://httpbin.org/post', { name: 'Liem Do', subject: 'Test Draft' }, false);
});

const submitResult = await astep('fillForm with submit=true (submit draft)', async () => {
  return fillForm('https://httpbin.org/post', { title: 'Draft Post', body: 'Content here' }, true);
});

console.log('\n[6] Screenshot');
const screenshotResult = await astep('screenshot(url) returns structured AgentResult', async () => {
  return screenshot('https://httpbin.org/html');
});

console.log('\n[7] Upload');
const uploadResult = await astep('upload(url, filePath, field) returns structured AgentResult', async () => {
  const testFile = path.join(EVIDENCE, 'test-upload.txt');
  fs.writeFileSync(testFile, 'Browser Operator Upload Test — ' + new Date().toISOString());
  return upload('https://httpbin.org/post', testFile, 'file');
});

console.log('\n[8] Logout');
const logoutResult = await astep('logout() returns structured AgentResult', async () => {
  return logout('https://httpbin.org/get');
});

// ── Evidence file ──────────────────────────────────────────────────────────
const evidence = {
  phase:          'C1',
  target:         'BROWSER_OPERATOR_CERTIFIED',
  generated_at:   new Date().toISOString(),
  playwright_available: pwState,
  results: {
    navigate:   navResult,
    login:      loginResult,
    fill_form:  fillResult,
    submit:     submitResult,
    screenshot: screenshotResult,
    upload:     uploadResult,
    logout:     logoutResult,
  },
  steps: log,
  passed,
  failed,
  total: passed + failed,
};

const evidencePath = path.join(EVIDENCE, 'c1-browser-operator.json');
fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

console.log('\n' + '═'.repeat(55));
console.log(`  PASSED: ${passed}  FAILED: ${failed}  TOTAL: ${passed + failed}`);
console.log(`  Playwright: ${pwState ? '🟢 INSTALLED' : '🟡 GRACEFUL-DEGRADATION MODE'}`);
console.log(`  Evidence:   reports/evidence/c1-browser-operator.json`);
console.log('═'.repeat(55));

const cert = failed === 0;
if (cert) {
  console.log('\n🎉 BROWSER_OPERATOR_CERTIFIED');
} else {
  console.log(`\n⚠️  BROWSER_OPERATOR_PARTIAL — ${failed} step(s) failed`);
}

process.exit(cert ? 0 : 1);
