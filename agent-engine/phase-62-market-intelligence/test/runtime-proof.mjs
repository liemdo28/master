// Phase 62 runtime proof - phase-62-market-intelligence (real domain logic)
import * as assert from 'assert';
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 62 -- MarketIntelligenceOS :: RUNTIME PROOF');

const { MarketIntelligenceOS } = await import(`../src/orchestrator.js`);
const { DemandTrendEngine, OpportunityEngine } = await import(`../src/engines.js`);

const dt = new DemandTrendEngine();
check('rising demand -> up trend', () => assert.strictEqual(dt.analyze([10, 20, 30, 40]).trend, 'up'));
check('falling demand -> down trend', () => assert.strictEqual(dt.analyze([40, 30, 20, 10]).trend, 'down'));
check('flat demand -> flat trend', () => assert.strictEqual(dt.analyze([20, 20, 20]).trend, 'flat'));
check('single point -> flat', () => assert.strictEqual(dt.analyze([5]).trend, 'flat'));
check('slope of perfectly linear is exact', () => assert.strictEqual(dt.analyze([10, 20, 30, 40]).slope, 10));

const op = new OpportunityEngine();
const hot = op.score({ demandTrendRate: 12, marketGrowth: 20, competitorGap: 0.8 });
check('strong market scores HOT', () => assert.strictEqual(hot.band, 'HOT'));
check('opportunity score is 0..100', () => assert.ok(hot.score >= 0 && hot.score <= 100));
const cold = op.score({ demandTrendRate: -10, marketGrowth: 0, competitorGap: 0.05 });
check('weak market scores COLD', () => assert.strictEqual(cold.band, 'COLD'));

const os = new MarketIntelligenceOS();
const snap = os.analyze({ demandHistory: [10, 20, 30, 40], marketGrowth: 20, competitorGap: 0.8 });
check('analyze computes up trend', () => assert.strictEqual(snap.trend.trend, 'up'));
check('analyze computes opportunity score', () => assert.ok(snap.opportunity.score > 0));

const dash = os.dashboard();
check('dashboard() phase correct', () => assert.strictEqual(dash.phase, 62));
check('dashboard() reports demandTrend', () => assert.strictEqual(dash.demandTrend, 'up'));
check('dashboard() reports opportunityScore', () => assert.ok(typeof dash.opportunityScore === 'number'));
check('dashboard() has status string', () => assert.ok(typeof dash.status === 'string'));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
