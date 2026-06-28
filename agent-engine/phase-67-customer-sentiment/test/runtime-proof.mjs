// Phase 67 runtime proof - phase-67-customer-sentiment (real domain logic)
import * as assert from 'assert';
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 67 -- CustomerSentimentOS :: RUNTIME PROOF');

const { CustomerSentimentOS } = await import(`../src/orchestrator.js`);
const { SentimentEngine, TrendEngine } = await import(`../src/engines.js`);

const se = new SentimentEngine();
const a = se.analyze([{ rating: 5 }, { rating: 5 }, { rating: 4 }, { rating: 1 }]);
check('average rating computed', () => assert.strictEqual(a.avg, 3.75));
check('distribution counts 5-star', () => assert.strictEqual(a.dist[5], 2));
check('negative ratio computed', () => assert.strictEqual(a.negativeRatio, 0.25));
check('NPS computed (promoters-detractors)', () => assert.strictEqual(a.nps, 25)); // (2-1)/4*100
const pos = se.analyze([{ rating: 5 }, { rating: 5 }, { rating: 4 }, { rating: 5 }]);
check('high ratings -> POSITIVE band', () => assert.strictEqual(pos.band, 'POSITIVE'));
const neg = se.analyze([{ rating: 1 }, { rating: 2 }, { rating: 2 }, { rating: 3 }]);
check('low ratings -> NEGATIVE band', () => assert.strictEqual(neg.band, 'NEGATIVE'));

const te = new TrendEngine();
check('rising ratings -> improving', () => assert.strictEqual(te.detect([2, 2, 5, 5]).direction, 'improving'));
check('falling ratings -> declining', () => assert.strictEqual(te.detect([5, 5, 2, 2]).direction, 'declining'));

const os = new CustomerSentimentOS();
const growth = os.analyze({ reviews: [{ rating: 3 }, { rating: 4 }, { rating: 5 }, { rating: 5 }] });
check('positive + improving -> GROWTH posture', () => assert.strictEqual(growth.posture, 'GROWTH'));
const risk = os.analyze({ reviews: [{ rating: 2 }, { rating: 1 }, { rating: 2 }, { rating: 1 }] });
check('negative sentiment -> AT_RISK posture', () => assert.strictEqual(risk.posture, 'AT_RISK'));

const dash = os.dashboard();
check('dashboard() phase correct', () => assert.strictEqual(dash.phase, 67));
check('dashboard() reports nps', () => assert.ok(typeof dash.nps === 'number'));
check('dashboard() has status string', () => assert.ok(typeof dash.status === 'string'));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
