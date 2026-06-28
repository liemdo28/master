/**
 * runtime-proof.mjs — Phase 21 Customer Experience OS.
 * Scenario: negative review spike -> sentiment risk -> recovery task -> approval -> response draft.
 */
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';
import CustomerExperienceOS from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase21-'));
const cx = new CustomerExperienceOS({ dataDir: DATA_DIR });
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log(`  ✅ ${n}`); } catch (e) { failed++; console.error(`  ❌ ${n} — ${e.message}`); } };

console.log('PHASE 21 — CUSTOMER EXPERIENCE OS :: RUNTIME PROOF\n');

cx.profiles.upsert({ customerId: 'c1', orders: 22 });
check('loyalty: 22 orders -> vip', () => assert.strictEqual(cx.loyalty.signal({ customerId: 'c1', orders: 22 }).tier, 'vip'));

// Negative review spike for Raw Sushi
['Food was cold and late', 'Worst service, rude staff', 'Got the wrong order, want a refund', 'Great sushi'].forEach((text, i) =>
  cx.feedback.ingest({ source: 'gbp', brand: 'raw_sushi', customerId: `c${i}`, text, rating: i === 3 ? 5 : 1 }));
check('feedback ingested (4)', () => assert.strictEqual(cx.feedback.recent('raw_sushi').length, 4));

const result = cx.processBrandFeedback('raw_sushi');
check('reviews analyzed with polarity', () => assert.ok(result.analyzed.every((a) => ['positive', 'negative', 'neutral'].includes(a.polarity))));
check('3 negative reviews detected', () => assert.strictEqual(result.risk.negatives, 3));
check('sentiment risk = HIGH (negative spike)', () => assert.strictEqual(result.risk.level, 'HIGH'));
check('recovery task created on HIGH risk', () => assert.ok(result.recovery && result.recovery.id));
check('recovery is approval-gated (not auto-sent)', () => assert.ok(result.recovery.approvalRequired === true && result.recovery.autoSent === false));
check('recovery includes a response DRAFT', () => assert.ok(/DRAFT/.test(result.recovery.responseDraft)));
check('recovery is in pending_approval', () => assert.strictEqual(result.recovery.status, 'pending_approval'));

const dash = cx.dashboard();
check('dashboard status AT_RISK', () => assert.strictEqual(dash.status, 'AT_RISK'));
check('dashboard counts pending recoveries', () => assert.ok(dash.pendingRecoveries >= 1));

const cx2 = new CustomerExperienceOS({ dataDir: DATA_DIR });
check('feedback persisted across restart', () => assert.ok(cx2.feedback.all().length >= 4));
check('recoveries persisted across restart', () => assert.ok(cx2.recovery.all().length >= 1));

console.log(`\n  RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
