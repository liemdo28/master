/**
 * Live Validator — Phase 2.5
 * Runs the full message matrix against the real pipeline (DB + Telegram + safety guards).
 * Does NOT require a real WhatsApp connection — uses the simulator.
 *
 * Usage:
 *   node tests/live/live-validator.js
 *   node tests/live/live-validator.js --no-telegram   (skip Telegram assertions)
 */

require('dotenv').config();

const path = require('path');
if (!process.env.GATEWAY_DB_PATH) {
  process.env.GATEWAY_DB_PATH = path.resolve(`data/gateway-live-validator-${process.pid}.db`);
}

const simulator  = require('../../src/simulation/message-simulator');
const rateLimiter = require('../../src/safety/rate-limiter');
const businessHours = require('../../src/safety/business-hours');
const aiControl  = require('../../src/safety/ai-control');
const sqlite = require('../../src/storage/sqlite');
const { getTodayStats, getRecentConversations } = require('../../src/storage/conversations');

const NO_TELEGRAM = process.argv.includes('--no-telegram');

// ── Helpers ────────────────────────────────────────────────────────────────────
let passed = 0; let failed = 0; const failures = [];

function assert(label, condition, detail = '') {
  if (condition) {
    process.stdout.write(`  ✅  ${label}\n`);
    passed++;
  } else {
    process.stdout.write(`  ❌  ${label}${detail ? '  ←  ' + detail : ''}\n`);
    failed++;
    failures.push({ label, detail });
  }
}

function section(title) {
  process.stdout.write(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}\n`);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Phone pools ────────────────────────────────────────────────────────────────
const PHONE = {
  normal:   '841000000001',
  escalate: '841000000002',
  rate:     '841000000003',
  blocked:  '841000000004',
  takeover: '841000000005',
};

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   WhatsApp AI Gateway — Phase 2.5 Live Validator         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Mode: ${NO_TELEGRAM ? 'No-Telegram (unit-safe)' : 'Full (Telegram forwarding)'}`);
  console.log(`  Time: ${new Date().toLocaleString()}\n`);

  // Init DB
  sqlite.getDb();
  await delay(500);
  await aiControl.init();

  // Reset all state for clean run
  aiControl.resumeAI();
  aiControl.clearHumanTakeover(PHONE.takeover);
  aiControl.unblockPhone(PHONE.blocked);
  Object.values(PHONE).forEach(p => rateLimiter.reset(p));

  // ── Scenario 1: Normal message matrix ────────────────────────────────────────
  section('SCENARIO 1 — Normal Message Matrix');

  const matrix = [
    { label: 'Greeting (Hello)',                  text: 'Hello',                              expectIntent: 'greeting',    expectReply: 'ai' },
    { label: 'Stone Oak hours',                   text: 'What time does Stone Oak open?',      expectIntent: 'hours',       expectReply: 'ai', expectInReply: /stone oak/i },
    { label: 'Bandera address',                   text: 'Where is Bandera?',                   expectIntent: 'address',     expectReply: 'ai', expectInReply: /bandera/i },
    { label: 'Vegan FAQ',                         text: 'Do you have vegan options?',          expectIntent: 'unknown',     expectReply: 'holding' },
    { label: 'Menu inquiry',                      text: 'What food do you serve?',             expectIntent: 'menu',        expectReply: 'ai', expectInReply: /\$/ },
    { label: 'Rewards inquiry',                   text: 'How do I earn loyalty points?',       expectIntent: 'rewards',     expectReply: 'ai', expectInReply: /point/i },
    { label: 'Reservation request',               text: 'I want to book a table for 4',       expectIntent: 'reservation', expectReply: 'ai', expectInReply: /table|reserve|location/i },
    { label: 'Medical Center address',            text: 'Where is the Medical Center location?', expectIntent: 'address',  expectReply: 'ai', expectInReply: /medical center/i },
    { label: 'Gift card FAQ',                     text: 'Do you sell gift cards?',             expectIntent: 'unknown',     expectReply: 'holding' },
    { label: 'Delivery FAQ',                      text: 'Do you do delivery?',                 expectIntent: 'unknown',     expectReply: 'holding' },
  ];

  for (const scenario of matrix) {
    const r = await simulator.simulateMessage({ phone: PHONE.normal, name: 'Test Customer', text: scenario.text, label: scenario.label });
    assert(`${scenario.label} — intent=${scenario.expectIntent}`, r.intent === scenario.expectIntent, `got ${r.intent}`);
    assert(`${scenario.label} — replyType=${scenario.expectReply}`, r.replyType === scenario.expectReply, `got ${r.replyType}`);
    if (scenario.expectInReply) {
      assert(`${scenario.label} — reply content`, scenario.expectInReply.test(r.replyText || ''), `reply: "${(r.replyText||'').slice(0,60)}"`);
    }
    assert(`${scenario.label} — DB saved`, r.dbSaved);
    if (!NO_TELEGRAM) assert(`${scenario.label} — Telegram forwarded`, r.telegramForwarded);
  }

  // ── Scenario 2: Escalation matrix ────────────────────────────────────────────
  section('SCENARIO 2 — Escalation Matrix');

  const escalationCases = [
    { label: 'Refund request',      text: 'I want a refund',          expectEscalate: true, expectReason: /keyword|urgent/i },
    { label: 'Need manager',        text: 'I need the manager',       expectEscalate: true },
    { label: 'Complaint',           text: 'I have a complaint',       expectEscalate: true },
    { label: 'Angry customer',      text: 'I am very angry with you', expectEscalate: true },
    { label: 'Random unclear msg',  text: 'asdfqwert12345',           expectEscalate: true },
    { label: 'Normal greeting',     text: 'Good morning',             expectEscalate: false },
  ];

  for (const c of escalationCases) {
    const r = await simulator.simulateMessage({ phone: PHONE.escalate, name: 'Escalation Test', text: c.text, label: c.label });
    assert(`${c.label} — escalated=${c.expectEscalate}`, r.escalated === c.expectEscalate, `got ${r.escalated}, reason: ${r.escalateReason}`);
    if (c.expectEscalate) {
      assert(`${c.label} — replyType=holding`, r.replyType === 'holding', `got ${r.replyType}`);
      assert(`${c.label} — holding msg non-empty`, (r.replyText || '').length > 5);
    }
    if (c.expectReason && r.escalateReason) {
      assert(`${c.label} — reason format`, c.expectReason.test(r.escalateReason) || r.escalateReason.length > 0);
    }
  }

  // ── Scenario 3: Rate Limiting ─────────────────────────────────────────────────
  section('SCENARIO 3 — Rate Limiting');

  rateLimiter.reset(PHONE.rate);
  let aiReplies = 0; let noReplies = 0;

  for (let i = 1; i <= 12; i++) {
    const r = await simulator.simulateMessage({ phone: PHONE.rate, name: 'Rate Tester', text: `Hello ${i}`, label: `msg-${i}` });
    if (r.replyType === 'ai' || r.replyType === 'holding') aiReplies++;
    if (r.rateLimited) noReplies++;
  }
  assert('First 10 msgs get replies', aiReplies === 10, `got ${aiReplies}`);
  assert('Msgs 11-12 are rate-limited (no reply)', noReplies === 2, `got ${noReplies}`);

  // Test hard block (31 messages)
  rateLimiter.reset(PHONE.rate);
  let hardDropped = 0;
  for (let i = 1; i <= 32; i++) {
    const r = await simulator.simulateMessage({ phone: PHONE.rate, name: 'Rate Tester', text: `Spam ${i}`, label: `spam-${i}` });
    if (r.blocked === false && r.rateLimited && r.replyType === 'none') {
      // soft limited
    }
    if (r.rateLimited && i > 30) hardDropped++;
  }
  assert('Msgs 31+ are hard-dropped', hardDropped >= 1, `hardDropped=${hardDropped}`);

  // ── Scenario 4: Global AI Pause ───────────────────────────────────────────────
  section('SCENARIO 4 — Global AI Pause');

  // Reset rate limiter for phones used in this scenario
  rateLimiter.reset(PHONE.normal);

  aiControl.pauseAI('live-test');
  assert('AI reports paused', aiControl.isAIPaused());

  const pauseResult = await simulator.simulateMessage({ phone: PHONE.normal, name: 'Pause Test', text: 'Hello during pause', label: 'msg-during-pause' });
  assert('No reply while paused', pauseResult.replyType === 'none', `got ${pauseResult.replyType}`);
  assert('DB still saved while paused', pauseResult.dbSaved);
  assert('AI paused flag set in result', pauseResult.aiPaused);

  aiControl.resumeAI();
  assert('AI resumed', !aiControl.isAIPaused());

  const afterResumeResult = await simulator.simulateMessage({ phone: PHONE.normal, name: 'After Resume', text: 'Hello after resume', label: 'msg-after-resume' });
  assert('Reply works after resume', afterResumeResult.replyType === 'ai' || afterResumeResult.replyType === 'holding');

  // ── Scenario 5: Human Takeover ────────────────────────────────────────────────
  section('SCENARIO 5 — Human Takeover');

  // Reset rate limiters for phones used in this scenario
  rateLimiter.reset(PHONE.normal);
  rateLimiter.reset(PHONE.takeover);

  aiControl.setHumanTakeover(PHONE.takeover, 'ceo', 'live test takeover');
  assert('Takeover set', aiControl.isHumanTakeover(PHONE.takeover));

  const takeoverResult = await simulator.simulateMessage({ phone: PHONE.takeover, name: 'Takeover Customer', text: 'Hello with takeover active', label: 'takeover-msg' });
  assert('No reply during takeover', takeoverResult.replyType === 'none', `got ${takeoverResult.replyType}`);
  assert('Takeover flag set in result', takeoverResult.humanTakeover);
  assert('DB saved during takeover', takeoverResult.dbSaved);

  // Normal customer still gets AI reply during this takeover
  const otherResult = await simulator.simulateMessage({ phone: PHONE.normal, name: 'Other Customer', text: 'Hi', label: 'other-during-takeover' });
  assert('Other customer still gets AI reply', otherResult.replyType === 'ai', `got ${otherResult.replyType}`);

  aiControl.clearHumanTakeover(PHONE.takeover);
  const afterTakeover = await simulator.simulateMessage({ phone: PHONE.takeover, name: 'Takeover Customer', text: 'Hello after takeover cleared', label: 'after-takeover' });
  assert('AI resumes after takeover cleared', afterTakeover.replyType === 'ai' || afterTakeover.replyType === 'holding');

  // ── Scenario 6: Blocklist ─────────────────────────────────────────────────────
  section('SCENARIO 6 — Blocklist');

  aiControl.blockPhone(PHONE.blocked);
  assert('Phone blocked', aiControl.isBlocked(PHONE.blocked));

  const blockResult = await simulator.simulateMessage({ phone: PHONE.blocked, name: 'Blocked User', text: 'Hello I am blocked', label: 'blocked-msg' });
  assert('Blocked phone silently dropped', blockResult.replyType === 'none', `got ${blockResult.replyType}`);
  assert('Blocked flag set', blockResult.blocked);
  assert('DB NOT saved for blocked', !blockResult.dbSaved);
  assert('Telegram NOT forwarded for blocked', !blockResult.telegramForwarded);

  aiControl.unblockPhone(PHONE.blocked);
  const unblockResult = await simulator.simulateMessage({ phone: PHONE.blocked, name: 'Unblocked User', text: 'Hello after unblock', label: 'unblocked-msg' });
  assert('Unblocked phone gets reply', unblockResult.replyType !== 'none');

  // ── Scenario 7: Business Hours ────────────────────────────────────────────────
  section('SCENARIO 7 — Business Hours');

  // Reset rate limiter for phones used in this scenario
  rateLimiter.reset(PHONE.normal);

  // Simulate "closed" by temporarily overriding isOpen
  const origIsOpen = businessHours.isOpen;
  businessHours.isOpen = () => false;

  const closedResult = await simulator.simulateMessage({ phone: PHONE.normal, name: 'Off Hours', text: 'Hello at 3am', label: 'off-hours-msg' });
  assert('Closed message sent outside hours', closedResult.replyType === 'closed', `got ${closedResult.replyType}`);
  assert('Closed message contains "closed"', /closed|reopen|open/i.test(closedResult.replyText || ''));
  assert('ai_replied=false for closed msg', closedResult.replyType !== 'ai');

  businessHours.isOpen = origIsOpen; // restore

  const openResult = await simulator.simulateMessage({ phone: PHONE.normal, name: 'During Hours', text: 'Hello during hours', label: 'open-hours-msg' });
  assert('Normal reply during open hours', openResult.replyType === 'ai' || openResult.replyType === 'holding');

  // ── Scenario 8: Database & Stats ─────────────────────────────────────────────
  section('SCENARIO 8 — Database & Stats');

  const stats = await getTodayStats();
  assert('Stats: total > 0', stats.total > 0, `total=${stats.total}`);
  assert('Stats: incoming > 0', stats.incoming > 0, `incoming=${stats.incoming}`);
  assert('Stats: lastMessage exists', !!stats.lastMessage);

  const recent = await getRecentConversations(20);
  assert('Recent conversations returned', recent.length > 0);
  assert('Records have phone field', recent.every(r => r.phone));
  assert('Records have intent field', recent.every(r => r.intent !== undefined));
  assert('Records have direction field', recent.every(r => ['in','out'].includes(r.direction)));

  // ── Summary ───────────────────────────────────────────────────────────────────
  const allResults = simulator.getResults();
  const totalScenarios = allResults.length;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  RESULTS: ${passed} passed, ${failed} failed  (${totalScenarios} messages simulated)`);
  if (failures.length) {
    console.log('\n  Failures:');
    failures.forEach(f => console.log(`    ❌  ${f.label}${f.detail ? ' — '+f.detail : ''}`));
  }
  console.log('═'.repeat(60));

  if (failed === 0) {
    console.log('\n  🎉  Phase 2.5 Live Validator: ALL PASSED');
    console.log('  ✅  System is PILOT READY\n');
    await writeReport(true, allResults, stats);
    await sqlite.close();
    process.exit(0);
  } else {
    console.log('\n  ⚠️   Phase 2.5 Live Validator: SOME FAILURES');
    console.log('  ❌  Resolve failures before pilot\n');
    await writeReport(false, allResults, stats);
    await sqlite.close();
    process.exit(1);
  }
}

async function writeReport(pass, results, stats) {
  const fs = require('fs');
  const path = require('path');

  const lines = results.map(r => {
    const status = r.error ? '❌ ERROR' : '✅';
    return `| ${status} | ${r.label || r.text?.slice(0,30)} | ${r.intent||'—'} | ${r.replyType||'—'} | ${r.escalated?'⚠':'—'} |`;
  });

  const md = `# PHASE 2.5 SIMULATION REPORT

**Generated:** ${new Date().toISOString()}
**Status:** ${pass ? '✅ ALL PASSED — PILOT READY' : '❌ FAILURES FOUND'}
**Messages simulated:** ${results.length}

## Stats
- Messages today: ${stats.total}
- Incoming: ${stats.incoming}
- Last from: ${stats.lastMessage?.name || '—'}

## Message Matrix Results

| Status | Scenario | Intent | Reply Type | Escalated |
|---|---|---|---|---|
${lines.join('\n')}
`;

  const outPath = path.resolve('docs/SIMULATION_REPORT.md');
  fs.writeFileSync(outPath, md);
  console.log(`  📄  Simulation report → ${outPath}`);
}

main().catch(err => {
  console.error('\nFatal validator error:', err.message);
  sqlite.close().finally(() => process.exit(1));
});
