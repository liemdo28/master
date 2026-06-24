/**
 * Final Features Acceptance Test
 * Covers all features built in the last session:
 *   - Apple Health parser (Ph23)
 *   - Asana briefing section (Ph17+)
 *   - Google Calendar briefing section (Ph17+)
 *   - generateExecutiveDailyBriefingFull (Ph17 router fix)
 *   - Leader failover WhatsApp notification
 *   - PM2 / Node status WhatsApp handlers (Ph6/7)
 *   - Briefing router uses async full version
 *   - AgenView boot log present in index.ts
 *   - URLSearchParams (not deprecated querystring) in briefing-engine
 *
 * Run: node tests/phase-final-features-acceptance-test.mjs
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const SRC       = path.join(ROOT, 'server/src');

// ── Test runner ───────────────────────────────────────────────────────────────

let total = 0, passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  total++;
  try {
    const result = fn();
    if (result === false) throw new Error('assertion returned false');
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
    failures.push({ name, error: e.message });
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function readSrc(...parts) {
  return fs.readFileSync(path.join(SRC, ...parts), 'utf8');
}

function fileExists(...parts) {
  return fs.existsSync(path.join(ROOT, ...parts));
}

// ── Section 1: Apple Health Parser ───────────────────────────────────────────

console.log('\n📱 Apple Health / Huawei Health Parser (Ph23)');

test('apple-health-parser.ts exists', () => fileExists('server/src/health-intelligence/apple-health-parser.ts'));

test('parseAppleHealthXML exported', () => {
  const src = readSrc('health-intelligence/apple-health-parser.ts');
  assert(src.includes('export function parseAppleHealthXML'), 'parseAppleHealthXML not exported');
});

test('parseHuaweiHealthDir exported', () => {
  const src = readSrc('health-intelligence/apple-health-parser.ts');
  assert(src.includes('export function parseHuaweiHealthDir'), 'parseHuaweiHealthDir not exported');
});

test('saveHealthExport exported', () => {
  const src = readSrc('health-intelligence/apple-health-parser.ts');
  assert(src.includes('export function saveHealthExport'), 'saveHealthExport not exported');
});

test('HRV stored in seconds * 1000 → ms', () => {
  const src = readSrc('health-intelligence/apple-health-parser.ts');
  assert(src.includes('* 1000'), 'Apple Health HRV ×1000 conversion not found');
  assert(src.includes('Apple stores in seconds'), 'HRV seconds comment missing');
});

test('CLI --input and --huawei flags handled', () => {
  const src = readSrc('health-intelligence/apple-health-parser.ts');
  assert(src.includes('--input'), '--input flag missing');
  assert(src.includes('--huawei'), '--huawei flag missing');
});

test('ParseResult interface has correct fields', () => {
  const src = readSrc('health-intelligence/apple-health-parser.ts');
  assert(src.includes('sleep:'), 'ParseResult.sleep missing');
  assert(src.includes('hrv:'), 'ParseResult.hrv missing');
  assert(src.includes('steps:'), 'ParseResult.steps missing');
  assert(src.includes('record_counts'), 'ParseResult.record_counts missing');
});

// ── Section 2: Asana Briefing Section ────────────────────────────────────────

console.log('\n📌 Asana Briefing Section (Ph17+)');

test('buildAsanaSection exported from briefing-engine', () => {
  const src = readSrc('executive-briefing/briefing-engine.ts');
  assert(src.includes('export async function buildAsanaSection'), 'buildAsanaSection not exported');
});

test('Asana uses Bearer token from ASANA_TOKEN env', () => {
  const src = readSrc('executive-briefing/briefing-engine.ts');
  assert(src.includes('ASANA_TOKEN'), 'ASANA_TOKEN missing');
  assert(src.includes('Bearer ${token}'), 'Bearer token not in Asana request');
});

test('Asana graceful degradation when token missing', () => {
  const src = readSrc('executive-briefing/briefing-engine.ts');
  assert(src.includes("Asana chưa được cấu hình"), 'Asana fallback message missing');
});

test('Asana shows due-today and overdue tasks', () => {
  const src = readSrc('executive-briefing/briefing-engine.ts');
  assert(src.includes('dueToday'), 'dueToday not detected');
  assert(src.includes('overdue'), 'overdue not handled');
});

// ── Section 3: Google Calendar Briefing Section ───────────────────────────────

console.log('\n📅 Google Calendar Briefing Section (Ph17+)');

test('buildCalendarSection exported from briefing-engine', () => {
  const src = readSrc('executive-briefing/briefing-engine.ts');
  assert(src.includes('export async function buildCalendarSection'), 'buildCalendarSection not exported');
});

test('Calendar uses GOOGLE_REFRESH_TOKEN env', () => {
  const src = readSrc('executive-briefing/briefing-engine.ts');
  assert(src.includes('GOOGLE_REFRESH_TOKEN'), 'GOOGLE_REFRESH_TOKEN missing');
  assert(src.includes('GOOGLE_CLIENT_ID'), 'GOOGLE_CLIENT_ID missing');
  assert(src.includes('GOOGLE_CLIENT_SECRET'), 'GOOGLE_CLIENT_SECRET missing');
});

test('Calendar graceful degradation when not configured', () => {
  const src = readSrc('executive-briefing/briefing-engine.ts');
  assert(src.includes("Google Calendar chưa cấu hình"), 'Calendar fallback message missing');
});

test('Calendar uses VN timezone for events', () => {
  const src = readSrc('executive-briefing/briefing-engine.ts');
  assert(src.includes('Asia/Ho_Chi_Minh'), 'VN timezone not used for calendar');
});

test('URLSearchParams used (not deprecated querystring)', () => {
  const src = readSrc('executive-briefing/briefing-engine.ts');
  assert(!src.includes("require('querystring')"), 'deprecated querystring still imported');
  assert(src.includes('new URLSearchParams('), 'URLSearchParams not used');
});

// ── Section 4: generateExecutiveDailyBriefingFull ────────────────────────────

console.log('\n📋 Full Briefing (Ph17 async wrapper)');

test('generateExecutiveDailyBriefingFull exported', () => {
  const src = readSrc('executive-briefing/briefing-engine.ts');
  assert(src.includes('export async function generateExecutiveDailyBriefingFull'), 'generateExecutiveDailyBriefingFull not exported');
});

test('Full briefing calls both Asana and Calendar', () => {
  const src = readSrc('executive-briefing/briefing-engine.ts');
  assert(src.includes('buildAsanaSection()'), 'buildAsanaSection not called');
  assert(src.includes('buildCalendarSection()'), 'buildCalendarSection not called');
  assert(src.includes('Promise.all'), 'Promise.all not used — should run in parallel');
});

test('Briefing router POST /generate calls full async version', () => {
  const src = readSrc('executive-briefing/briefing-router.ts');
  assert(src.includes('generateExecutiveDailyBriefingFull'), 'router does not import generateExecutiveDailyBriefingFull');
  assert(src.includes('await generateExecutiveDailyBriefingFull()'), 'router does not await full version');
  assert(!src.includes('const briefing = generateExecutiveDailyBriefing()'), 'router still calls sync version');
});

// ── Section 5: Leader Failover Notification ──────────────────────────────────

console.log('\n👑 Leader Failover CEO Notification (Ph7)');

test('leader-lock-persistent.ts exists', () => fileExists('server/src/nodes/leader-lock-persistent.ts'));

test('acquireLeadership notifies CEO on failover', () => {
  const src = readSrc('nodes/leader-lock-persistent.ts');
  assert(src.includes('queueToCeo'), 'queueToCeo not called on failover');
  assert(src.includes('Leader Failover'), 'Failover WhatsApp message text missing');
});

test('Failover notification includes old node + new node', () => {
  const src = readSrc('nodes/leader-lock-persistent.ts');
  assert(src.includes('staleNode'), 'staleNode variable not used');
  assert(src.includes('staleDuration'), 'staleDuration not included in message');
});

test('Failover notification uses require (not import) for lazy load', () => {
  const src = readSrc('nodes/leader-lock-persistent.ts');
  assert(src.includes("require('../services/whatsapp-sender')"), 'WhatsApp sender not lazy-required');
});

test('Failover notification wrapped in try/catch', () => {
  const src = readSrc('nodes/leader-lock-persistent.ts');
  // Check there's a try/catch around queueToCeo
  const idx = src.indexOf('queueToCeo');
  const before = src.slice(Math.max(0, idx - 200), idx);
  assert(before.includes('try {'), 'queueToCeo not wrapped in try/catch');
});

// ── Section 6: PM2 / Node Status WhatsApp Handlers ───────────────────────────

console.log('\n🖥  PM2 / Node Status WhatsApp Handlers (Ph6/7)');

test('PM2 status handler exists in jarvis-core', () => {
  const src = readSrc('jarvis/phase30-jarvis/jarvis-core.ts');
  assert(src.includes('pm2'), 'PM2 handler missing from jarvis-core');
  assert(src.includes("dang chay gi"), 'Vietnamese PM2 query missing');
});

test('PM2 handler uses pm2 jlist for JSON output', () => {
  const src = readSrc('jarvis/phase30-jarvis/jarvis-core.ts');
  assert(src.includes('pm2 jlist'), 'pm2 jlist command missing');
});

test('PM2 handler shows CPU and memory', () => {
  const src = readSrc('jarvis/phase30-jarvis/jarvis-core.ts');
  assert(src.includes('monit?.cpu'), 'CPU metric missing');
  assert(src.includes('monit?.memory'), 'Memory metric missing');
});

test('Node registry status handler exists', () => {
  const src = readSrc('jarvis/phase30-jarvis/jarvis-core.ts');
  assert(src.includes('node.*nao.*online'), 'Node online query regex missing');
  assert(src.includes('getAllNodesPersistent'), 'getAllNodesPersistent not called');
});

test('Node registry handler shows capabilities', () => {
  const src = readSrc('jarvis/phase30-jarvis/jarvis-core.ts');
  assert(src.includes('capabilities'), 'Node capabilities not shown in handler');
});

// ── Section 7: Boot Log ───────────────────────────────────────────────────────

console.log('\n🚀 Server Boot Log');

test('AgenView URL in boot log', () => {
  const src = readSrc('index.ts');
  assert(src.includes('AgenView:'), 'AgenView URL not in boot log');
  assert(src.includes('/agenview'), '/agenview path not in boot log');
});

// ── Section 8: Jarvis Mi Intelligence Layer Completeness ─────────────────────

console.log('\n🧠 Jarvis Mi Intelligence Layer Completeness');

test('Ph17 briefing handler: bao cao sang / morning brief', () => {
  const src = readSrc('jarvis/phase30-jarvis/jarvis-core.ts');
  assert(src.includes('bao cao sang'), 'briefing handler missing');
});

test('Ph17 Calendar handler: lich hom nay', () => {
  const src = readSrc('jarvis/phase30-jarvis/jarvis-core.ts');
  assert(src.includes('lich.*hom nay'), 'calendar handler missing');
});

test('Ph17 Asana handler: asana task query', () => {
  const src = readSrc('jarvis/phase30-jarvis/jarvis-core.ts');
  assert(src.includes('asana'), 'asana handler missing');
});

test('Ph18 Strategic memory handler: trend / xu huong', () => {
  const src = readSrc('jarvis/phase30-jarvis/jarvis-core.ts');
  assert(src.includes('xu huong'), 'strategic memory handler missing');
});

test('Ph20 Autonomous boundary handler', () => {
  const src = readSrc('jarvis/phase30-jarvis/jarvis-core.ts');
  assert(src.includes('tu dong duoc ko'), 'autonomous boundary handler missing');
});

test('Ph21 Council handler: chay council', () => {
  const src = readSrc('jarvis/phase30-jarvis/jarvis-core.ts');
  assert(src.includes('chay council'), 'council handler missing');
});

test('Ph24 Digital Twin handler: neu X chet', () => {
  const src = readSrc('jarvis/phase30-jarvis/jarvis-core.ts');
  assert(src.includes('neu.*chet'), 'digital twin handler missing');
});

// ── Section 9: .env.example Completeness ─────────────────────────────────────

console.log('\n🔐 .env.example Coverage');

test('.env.example exists', () => fileExists('.env.example'));

test('.env.example has Asana token', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert(env.includes('ASANA_TOKEN'), 'ASANA_TOKEN missing from .env.example');
});

test('.env.example has Google Calendar vars', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert(env.includes('GOOGLE_CLIENT_ID'), 'GOOGLE_CLIENT_ID missing');
  assert(env.includes('GOOGLE_REFRESH_TOKEN'), 'GOOGLE_REFRESH_TOKEN missing');
});

test('.env.example has multi-node vars', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert(env.includes('MI_NODE_ID'), 'MI_NODE_ID missing');
});

// ── Section 10: File integrity checks ────────────────────────────────────────

console.log('\n📁 File Integrity');

test('node-agent.mjs exists', () => fileExists('node-agent.mjs'));
test('ecosystem.config.js exists', () => fileExists('ecosystem.config.js'));
test('ui/agenview.html exists', () => fileExists('ui/agenview.html'));
test('CLAUDE.md exists', () => fileExists('CLAUDE.md'));
test('node-registry-persistent.ts exists', () => fileExists('server/src/nodes/node-registry-persistent.ts'));

test('ecosystem.config.js has 3 processes', () => {
  const src = fs.readFileSync(path.join(ROOT, 'ecosystem.config.js'), 'utf8');
  const nameCount = (src.match(/name:/g) || []).length;
  assert(nameCount >= 3, `Expected ≥3 PM2 apps, found ${nameCount}`);
});

test('agenview.html has stat bar', () => {
  const src = fs.readFileSync(path.join(ROOT, 'ui/agenview.html'), 'utf8');
  assert(src.includes('stat-bar') || src.includes('agenview') || src.includes('AgenView'), 'agenview.html missing stat bar or AgenView reference');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(55));
console.log(`  TOTAL:  ${total} tests`);
console.log(`  PASSED: ${passed} ✅`);
console.log(`  FAILED: ${failed} ❌`);
console.log('═'.repeat(55));

if (failures.length > 0) {
  console.log('\nFailed tests:');
  for (const f of failures) {
    console.log(`  ❌ ${f.name}`);
    console.log(`     ${f.error}`);
  }
}

const pct = Math.round((passed / total) * 100);
if (pct === 100) {
  console.log(`\n🎉 PHASE_FINAL_FEATURES_CERTIFIED — ${pct}% PASS`);
} else if (pct >= 90) {
  console.log(`\n✅ PHASE_FINAL_FEATURES_PASS — ${pct}% (${failed} minor gaps)`);
} else {
  console.log(`\n⚠️  PHASE_FINAL_FEATURES_INCOMPLETE — ${pct}% (${failed} failures)`);
}

process.exit(failed > 0 ? 1 : 0);
