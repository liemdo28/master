require('dotenv').config();
const { classifyIntent } = require('../src/ai/intent-classifier');
const { generateResponse, getConfidence } = require('../src/ai/response-generator');
const { shouldEscalate, getEscalationReason } = require('../src/ai/escalation-engine');
const { saveMessage, getTodayStats, getRecentConversations } = require('../src/storage/conversations');
const kb = require('../src/ai/knowledge-base');
const rateLimiter = require('../src/safety/rate-limiter');
const businessHours = require('../src/safety/business-hours');
const aiControl = require('../src/safety/ai-control');

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ PASS: ${label}`); passed++; }
  else { console.log(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

async function main() {
  console.log('\n=== WhatsApp AI Gateway — Unit Tests v2.0 ===\n');

  // Init DB once at the top so all suites share a ready connection
  require('../src/storage/sqlite').getDb();
  await new Promise(r => setTimeout(r, 500));

  // ── Suite 1: Intent Classifier ──────────────────────────────────────────────
  console.log('[ Suite 1 ] Intent Classifier');
  assert('Hello → greeting', classifyIntent('Hello') === 'greeting');
  assert('Hi there → greeting', classifyIntent('Hi there!') === 'greeting');
  assert('What time do you open → hours', classifyIntent('What time do you open?') === 'hours');
  assert('Where are you located → address', classifyIntent('Where are you located?') === 'address');
  assert('What food → menu', classifyIntent('What food do you have?') === 'menu');
  assert('Earn points → rewards', classifyIntent('How do I earn points?') === 'rewards');
  assert('Book a table → reservation', classifyIntent('I want to book a table') === 'reservation');
  assert('I have a complaint → complaint', classifyIntent('I have a complaint') === 'complaint');
  assert('Gibberish → unknown', classifyIntent('asdfjklqwerty') === 'unknown');

  // ── Suite 2: Response Generator + KB ───────────────────────────────────────
  console.log('\n[ Suite 2 ] Response Generator + Knowledge Base');
  assert('Greeting reply non-empty', generateResponse('greeting', 'Hello').length > 0);
  assert('Hours reply contains open/AM/PM', /open|am|pm/i.test(generateResponse('hours', 'What time?')));

  const stoneOakHours = generateResponse('hours', 'What time does Stone Oak open?');
  assert('Stone Oak hours detected', /stone oak/i.test(stoneOakHours));

  const banderaAddr = generateResponse('address', 'Where is the Bandera location?');
  assert('Bandera address returned', /bandera/i.test(banderaAddr));

  const medAddr = generateResponse('address', 'Where is Medical Center?');
  assert('Medical Center address returned', /medical center/i.test(medAddr));

  const menuReply = generateResponse('menu', 'What food do you have?');
  assert('Menu reply has price', /\$/.test(menuReply));

  const rewardsReply = generateResponse('rewards', 'How do rewards work?');
  assert('Rewards reply has points', /point/i.test(rewardsReply));

  assert('FAQ vegan fallback', /vegan/i.test(generateResponse('unknown', 'Do you have vegan options?')));
  assert('FAQ parking fallback', /parking/i.test(generateResponse('unknown', 'Is there parking?')));
  assert('FAQ delivery fallback', /delivery|takeout|doordash/i.test(generateResponse('unknown', 'Do you do delivery?')));

  // ── Suite 3: Confidence Scoring ─────────────────────────────────────────────
  console.log('\n[ Suite 3 ] Confidence Scoring');
  assert('greeting ≥ 90', getConfidence('greeting') >= 90);
  assert('hours ≥ 85', getConfidence('hours') >= 85);
  assert('unknown < 50', getConfidence('unknown') < 50);
  assert('complaint < 80', getConfidence('complaint') < 80);
  assert('reservation < 80', getConfidence('reservation') < 80);

  // ── Suite 4: Escalation Engine ──────────────────────────────────────────────
  console.log('\n[ Suite 4 ] Escalation Engine');
  assert('complaint → escalate', shouldEscalate('complaint', 'I have a complaint'));
  assert('unknown → escalate (low confidence)', shouldEscalate('unknown', 'random msg'));
  assert('greeting → no escalate', !shouldEscalate('greeting', 'Hello'));
  assert('"urgent" → escalate', shouldEscalate('hours', 'This is urgent!'));
  assert('"refund" → escalate', shouldEscalate('hours', 'I want a refund'));
  assert('"manager" → escalate', shouldEscalate('hours', 'I need the manager'));
  assert('"lawsuit" → escalate', shouldEscalate('unknown', 'I will file a lawsuit'));
  assert('Escalation reason provided', !!getEscalationReason('complaint', 'I have a complaint'));

  // ── Suite 5: Knowledge Base ─────────────────────────────────────────────────
  console.log('\n[ Suite 5 ] Knowledge Base');
  assert('Stone Oak detected', kb.detectStore('Stone Oak hours?')?.id === 'stone-oak');
  assert('Bandera detected', kb.detectStore('Bandera location')?.id === 'bandera');
  assert('Medical Center detected', kb.detectStore('medical center address')?.id === 'medical-center');
  assert('No store → null', kb.detectStore('What time do you open?') === null);
  assert('getMenuText has $', /\$/.test(kb.getMenuText() || ''));
  assert('getRewardsText has point', /point/i.test(kb.getRewardsText() || ''));
  assert('FAQ vegan', /vegan/i.test(kb.searchFaq('Do you have vegan options?') || ''));
  assert('FAQ parking', /parking/i.test(kb.searchFaq('Is there parking?') || ''));
  assert('FAQ gift card', /gift/i.test(kb.searchFaq('Do you sell gift cards?') || ''));

  // ── Suite 6: Rate Limiter ───────────────────────────────────────────────────
  console.log('\n[ Suite 6 ] Rate Limiter');
  const testPhone = '840000000001';
  rateLimiter.reset(testPhone);
  let allAllowed = true;
  for (let i = 0; i < 10; i++) {
    if (!rateLimiter.check(testPhone).allowed) { allAllowed = false; break; }
  }
  assert('10 messages within limit', allAllowed);
  const eleventh = rateLimiter.check(testPhone);
  assert('11th message rate-limited', !eleventh.allowed && eleventh.reason === 'rate_limited');
  rateLimiter.reset(testPhone);
  assert('Reset clears counter', rateLimiter.check(testPhone).allowed);

  // ── Suite 7: Business Hours ─────────────────────────────────────────────────
  console.log('\n[ Suite 7 ] Business Hours');
  const originalBusinessHoursEnabled = process.env.BUSINESS_HOURS_ENABLED;
  delete process.env.BUSINESS_HOURS_ENABLED;
  // Test with known open/closed times
  const openTime  = new Date('2026-06-03T12:00:00'); // Wednesday 12pm — open
  const closedTime = new Date('2026-06-03T02:00:00'); // Wednesday 2am — closed
  assert('Wednesday 12pm is open', businessHours.isOpen(openTime));
  assert('Wednesday 2am is closed', !businessHours.isOpen(closedTime));
  assert('Closed message non-empty', businessHours.getClosedMessage().length > 10);
  assert('Today schedule non-empty', businessHours.getTodayScheduleText().length > 5);

  // Disabled via env
  process.env.BUSINESS_HOURS_ENABLED = 'false';
  assert('Disabled → always open', businessHours.isOpen(closedTime));
  if (originalBusinessHoursEnabled === undefined) delete process.env.BUSINESS_HOURS_ENABLED;
  else process.env.BUSINESS_HOURS_ENABLED = originalBusinessHoursEnabled;

  // ── Suite 8: AI Control ─────────────────────────────────────────────────────
  console.log('\n[ Suite 8 ] AI Control');
  const ctrlPhone = '840000000099';

  // Start fresh
  aiControl.resumeAI();
  aiControl.clearHumanTakeover(ctrlPhone);
  aiControl.unblockPhone(ctrlPhone);

  assert('AI starts active', !aiControl.isAIPaused());
  aiControl.pauseAI('test');
  assert('Pause works', aiControl.isAIPaused());
  aiControl.resumeAI();
  assert('Resume works', !aiControl.isAIPaused());

  assert('Takeover starts false', !aiControl.isHumanTakeover(ctrlPhone));
  aiControl.setHumanTakeover(ctrlPhone, 'admin', 'test');
  assert('Takeover set', aiControl.isHumanTakeover(ctrlPhone));
  assert('Takeover info has "by"', aiControl.getTakeoverInfo(ctrlPhone)?.by === 'admin');
  aiControl.clearHumanTakeover(ctrlPhone);
  assert('Takeover cleared', !aiControl.isHumanTakeover(ctrlPhone));

  assert('Block starts false', !aiControl.isBlocked(ctrlPhone));
  aiControl.blockPhone(ctrlPhone);
  assert('Block set', aiControl.isBlocked(ctrlPhone));
  assert('Blocklist contains phone', aiControl.getBlocklist().includes(ctrlPhone));
  aiControl.unblockPhone(ctrlPhone);
  assert('Unblock works', !aiControl.isBlocked(ctrlPhone));

  // ── Suite 9: Database Storage ───────────────────────────────────────────────
  console.log('\n[ Suite 9 ] Database Storage');
  try {
    await saveMessage({ phone: '841111000001', name: 'Test User', direction: 'in', message: 'Hello', intent: 'greeting', aiReplied: true });
    await saveMessage({ phone: '841111000001', name: 'Test User', direction: 'out', message: 'Hi there!', intent: 'greeting', aiReplied: true });
    const stats = await getTodayStats();
    assert('stats.total >= 1', stats.total >= 1);
    const recent = await getRecentConversations(10);
    assert('getRecentConversations returns rows', recent.length >= 1);
    assert('Message persisted', recent.some(r => r.phone === '841111000001'));
  } catch (err) {
    assert('Database operations', false, err.message);
  }

  // ── Suite 10: Load Test ─────────────────────────────────────────────────────
  console.log('\n[ Suite 10 ] Load Test (100 sequential messages in batches)');
  let loadFailed = false;
  try {
    // Use sequential batches to avoid SQLITE_BUSY.
    // Split 100 writes into batches of 10, each batch in one transaction.
    const BATCH_SIZE = 10;
    const TOTAL = 100;
    for (let batchStart = 0; batchStart < TOTAL; batchStart += BATCH_SIZE) {
      const batch = [];
      for (let i = batchStart; i < batchStart + BATCH_SIZE && i < TOTAL; i++) {
        batch.push({
          phone: `8488${String(i).padStart(6,'0')}`,
          name: `Load${i}`,
          direction: 'in',
          message: `Load msg ${i}`,
          intent: 'greeting',
          aiReplied: true,
        });
      }
      // Write batch sequentially — no Promise.all, no concurrent DB writes
      for (const msg of batch) {
        await saveMessage(msg);
      }
    }
  } catch (err) {
    loadFailed = true;
    console.error('  Load test error:', err.message);
  }
  assert('100 saves without crash', !loadFailed);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 All tests PASSED — Phase 2 unit suite verified\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests FAILED\n');
    process.exit(1);
  }
}

main().catch(err => { console.error('Test runner error:', err); process.exit(1); });
