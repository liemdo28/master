/**
 * WhatsApp Routing Component Tests
 * Tests message-router-owner.js and message-dedup-store.js
 */

const assert = require('assert');
const path = require('path');

// ── Test helpers ──────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, status: 'PASS' });
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

// ── Dedup Store Tests ─────────────────────────────────────────────────
console.log('\n═══ Suite 1: Message Dedup Store ═══');

// Create a fresh dedup store for testing (not the singleton)
const dedupModule = require('../src/routing/message-dedup-store');

test('T01: New message can be claimed', () => {
  const dedup = require('../src/routing/message-dedup-store');
  // Clean state by using a unique ID
  const msgId = 'test_dedup_001_' + Date.now();
  const r = dedup.claim(msgId, 'g1@', 'mi_core');
  assert.strictEqual(r.claimed, true);
});

test('T02: Duplicate message is rejected', () => {
  const dedup = require('../src/routing/message-dedup-store');
  const msgId = 'test_dedup_002_' + Date.now();
  const r1 = dedup.claim(msgId, 'g1@', 'mi_core');
  assert.strictEqual(r1.claimed, true);
  const r2 = dedup.claim(msgId, 'g1@', 'food_safety');
  assert.strictEqual(r2.claimed, false);
  assert.strictEqual(r2.existing.owner_handler, 'mi_core');
});

test('T03: isDuplicate returns true for claimed message', () => {
  const dedup = require('../src/routing/message-dedup-store');
  const msgId = 'test_dedup_003_' + Date.now();
  dedup.claim(msgId, 'g1@', 'mi_core');
  assert.strictEqual(dedup.isDuplicate(msgId), true);
});

test('T04: isDuplicate returns false for unknown message', () => {
  const dedup = require('../src/routing/message-dedup-store');
  assert.strictEqual(dedup.isDuplicate('totally_unknown_' + Date.now()), false);
});

test('T05: Empty messageId is always claimable', () => {
  const dedup = require('../src/routing/message-dedup-store');
  const r = dedup.claim('', 'g1@', 'mi_core');
  assert.strictEqual(r.claimed, true);
});

test('T06: updateStatus persists in store', () => {
  const dedup = require('../src/routing/message-dedup-store');
  const msgId = 'test_dedup_006_' + Date.now();
  dedup.claim(msgId, 'g1@', 'mi_core');
  dedup.updateStatus(msgId, 'completed', { response_sent: true });
  const entry = dedup.get(msgId);
  assert.strictEqual(entry.status, 'completed');
});

test('T07: getStats returns valid stats', () => {
  const dedup = require('../src/routing/message-dedup-store');
  const stats = dedup.getStats();
  assert.strictEqual(typeof stats.size, 'number');
  assert.strictEqual(stats.ttl_ms, 24 * 60 * 60 * 1000);
});

// ── Router Owner Tests ────────────────────────────────────────────────
console.log('\n═══ Suite 2: Message Router Owner ═══');

const { routeMessage, OWNER_HANDLERS, resolveGroupPolicy, detectIntent } = require('../src/routing/message-router-owner');

test('T08: "Mi ơi" → mi_core', () => {
  const d = routeMessage({
    messageId: 'test_router_008_' + Date.now(),
    chatId: 'g1@g.us',
    groupName: 'Team Chat',
    sender: '123',
    text: 'Mi ơi',
    timestamp: new Date().toISOString(),
  });
  assert.strictEqual(d.owner_handler, OWNER_HANDLERS.MI_CORE);
  assert.strictEqual(d.response_allowed, true);
});

test('T09: "/mi hello" → mi_core', () => {
  const d = routeMessage({
    messageId: 'test_router_009_' + Date.now(),
    chatId: 'g1@g.us',
    groupName: 'Team Chat',
    sender: '123',
    text: '/mi what tasks do I have',
    timestamp: new Date().toISOString(),
  });
  assert.strictEqual(d.owner_handler, OWNER_HANDLERS.MI_CORE);
});

test('T10: No mention, no session → unknown_no_reply', () => {
  const d = routeMessage({
    messageId: 'test_router_010_' + Date.now(),
    chatId: 'g1@g.us',
    groupName: 'Team Chat',
    sender: '123',
    text: 'hello everyone',
    timestamp: new Date().toISOString(),
    hasActiveSession: false,
  });
  assert.strictEqual(d.owner_handler, OWNER_HANDLERS.UNKNOWN_NO_REPLY);
  assert.strictEqual(d.response_allowed, false);
});

test('T11: Food safety group + image → food_safety', () => {
  const d = routeMessage({
    messageId: 'test_router_011_' + Date.now(),
    chatId: 'g1@g.us',
    groupName: 'Food Safety Team',
    sender: '123',
    text: '',
    timestamp: new Date().toISOString(),
    hasImage: true,
    hasActiveSession: false,
  });
  assert.strictEqual(d.owner_handler, OWNER_HANDLERS.FOOD_SAFETY);
  assert.strictEqual(d.response_allowed, true);
});

test('T12: Duplicate message blocked', () => {
  const msgId = 'test_router_012_' + Date.now();
  // First call claims it
  const d1 = routeMessage({
    messageId: msgId,
    chatId: 'g1@g.us',
    groupName: 'Team',
    sender: '123',
    text: 'Mi ơi',
    timestamp: new Date().toISOString(),
  });
  // Second call should be blocked
  const d2 = routeMessage({
    messageId: msgId,
    chatId: 'g1@g.us',
    groupName: 'Team',
    sender: '456',
    text: 'Mi ơi',
    timestamp: new Date().toISOString(),
  });
  assert.strictEqual(d2.intent, 'duplicate_blocked');
  assert.strictEqual(d2.response_allowed, false);
});

test('T13: resolveGroupPolicy detects food_safety', () => {
  assert.strictEqual(resolveGroupPolicy('Food Safety Team', ''), 'food_safety');
  assert.strictEqual(resolveGroupPolicy('An toàn thực phẩm', ''), 'food_safety');
});

test('T14: resolveGroupPolicy detects marketing', () => {
  assert.strictEqual(resolveGroupPolicy('Marketing Content', ''), 'marketing');
});

test('T15: resolveGroupPolicy detects admin', () => {
  assert.strictEqual(resolveGroupPolicy('CEO Admin', ''), 'admin');
});

test('T16: resolveGroupPolicy defaults to general', () => {
  assert.strictEqual(resolveGroupPolicy('Random Chat', ''), 'general');
  assert.strictEqual(resolveGroupPolicy('', ''), 'general');
});

test('T17: detectIntent with Mi ơi pattern', () => {
  const result = detectIntent('Mi ơi', 'Team', false, false);
  assert.strictEqual(result.owner, OWNER_HANDLERS.MI_CORE);
  assert.strictEqual(result.confidence, 1.0);
});

test('T18: detectIntent with no session and no mention', () => {
  const result = detectIntent('random message', 'Team', false, false);
  assert.strictEqual(result.owner, OWNER_HANDLERS.UNKNOWN_NO_REPLY);
  assert.strictEqual(result.reason, 'no_active_session_no_mention');
});

test('T19: detectIntent with bot mention in food_safety group', () => {
  const result = detectIntent('mi check temperatures?', 'Food Safety Team', false, false);
  assert.strictEqual(result.owner, OWNER_HANDLERS.UNKNOWN_NO_REPLY);
  assert.strictEqual(result.reason, 'bot_mentioned_wrong_group');
});

test('T20: detectIntent with active food_safety session', () => {
  const result = detectIntent('38F walk-in cooler', 'Food Safety Team', false, true);
  assert.strictEqual(result.owner, OWNER_HANDLERS.FOOD_SAFETY);
  assert.strictEqual(result.reason, 'food_safety_active_session');
});

test('T21: routing decision has all required fields', () => {
  const d = routeMessage({
    messageId: 'test_router_021_' + Date.now(),
    chatId: 'g1@g.us',
    groupName: 'Team',
    sender: '123',
    text: 'Mi ơi help me',
    timestamp: new Date().toISOString(),
  });
  assert.strictEqual(typeof d.message_id, 'string');
  assert.strictEqual(typeof d.chat_id, 'string');
  assert.strictEqual(typeof d.group_name, 'string');
  assert.strictEqual(typeof d.sender, 'string');
  assert.strictEqual(typeof d.timestamp, 'string');
  assert.strictEqual(typeof d.normalized_text, 'string');
  assert.strictEqual(typeof d.policy, 'string');
  assert.strictEqual(typeof d.intent, 'string');
  assert.strictEqual(typeof d.owner_handler, 'string');
  assert.strictEqual(typeof d.decision_reason, 'string');
  assert.strictEqual(typeof d.response_allowed, 'boolean');
  assert.strictEqual(typeof d.dedup_key, 'string');
});

test('T22: "mi ơi, service nào đang down?" → mi_core', () => {
  const d = routeMessage({
    messageId: 'test_router_022_' + Date.now(),
    chatId: 'g1@g.us',
    groupName: 'Team',
    sender: '123',
    text: 'Mi ơi, service nào đang down?',
    timestamp: new Date().toISOString(),
  });
  assert.strictEqual(d.owner_handler, OWNER_HANDLERS.MI_CORE);
  assert.strictEqual(d.response_allowed, true);
});

test('T23: Bot mention pattern "mi có task gì" in non-food group', () => {
  const d = routeMessage({
    messageId: 'test_router_023_' + Date.now(),
    chatId: 'g1@g.us',
    groupName: 'Team',
    sender: '123',
    text: 'mi help me with this task',
    timestamp: new Date().toISOString(),
    hasActiveSession: false,
  });
  assert.strictEqual(d.owner_handler, OWNER_HANDLERS.MI_CORE);
});

// ── Handler Response Format Tests ─────────────────────────────────────
console.log('\n═══ Suite 3: Handler Response Format ═══');

const { executeHandler } = require('../src/routing/message-router-owner');

test('T24: executeHandler with non-allowed decision returns no-send', async () => {
  const decision = {
    owner_handler: OWNER_HANDLERS.UNKNOWN_NO_REPLY,
    response_allowed: false,
    decision_reason: 'test',
  };
  const result = await executeHandler(decision, async () => ({
    response: 'should not happen',
    shouldSend: true,
  }));
  assert.strictEqual(result.shouldSend, false);
  assert.strictEqual(result.response, null);
});

test('T25: executeHandler with valid handler returns response', async () => {
  const decision = {
    owner_handler: OWNER_HANDLERS.MI_CORE,
    response_allowed: true,
    decision_reason: 'test',
  };
  const result = await executeHandler(decision, async () => ({
    response: 'Hello from Mi',
    confidence: 0.95,
    evidence: 'test',
    shouldSend: true,
  }));
  assert.strictEqual(result.response, 'Hello from Mi');
  assert.strictEqual(result.shouldSend, true);
  assert.strictEqual(result.owner, OWNER_HANDLERS.MI_CORE);
});

test('T26: executeHandler catches exceptions', async () => {
  const decision = {
    owner_handler: OWNER_HANDLERS.MI_CORE,
    response_allowed: true,
    decision_reason: 'test',
  };
  const result = await executeHandler(decision, async () => {
    throw new Error('handler crashed');
  });
  assert.strictEqual(result.response, null);
  assert.strictEqual(result.shouldSend, false);
  assert.ok(result.evidence.includes('handler_exception'));
});

test('T27: executeHandler handles invalid return', async () => {
  const decision = {
    owner_handler: OWNER_HANDLERS.MI_CORE,
    response_allowed: true,
    decision_reason: 'test',
  };
  const result = await executeHandler(decision, async () => null);
  assert.strictEqual(result.response, null);
  assert.strictEqual(result.shouldSend, false);
});

// ── Summary ───────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`WhatsApp Routing Tests: ${passed}/${passed + failed} PASSED`);
if (failed > 0) {
  console.log(`${failed} FAILED:`);
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  ❌ ${r.name}: ${r.error}`);
  });
}
console.log(`${'═'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
