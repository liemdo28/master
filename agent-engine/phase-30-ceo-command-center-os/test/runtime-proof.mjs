/**
 * runtime-proof.mjs — Phase 30 CEO Command Center 2.0.
 * Scenario: CEO asks "What needs my attention today?" -> returns blockers, approvals, risks, stale data, next decisions.
 */
import { mkdtempSync } from 'fs'; import { tmpdir } from 'os'; import { join } from 'path'; import assert from 'assert';
import DailyBriefingEngine from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase30-'));
const ceo = new DailyBriefingEngine({ dataDir: DATA_DIR });
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  ✅ ' + n); } catch (e) { failed++; console.error('  ❌ ' + n + ' — ' + e.message); } };
console.log('PHASE 30 — CEO COMMAND CENTER 2.0 :: RUNTIME PROOF\n');

// Set up: active objectives, pending approvals, critical risks
ceo.objectives.add({ objective: 'Increase Raw Sushi online revenue 10%', priority: 'P1', owner: 'ceo', division: 'executive' });
ceo.objectives.addBlocker(ceo.objectives.active()[0].id, 'Awaiting CFO sign-off on DoorDash promotional budget');
ceo.approvals.add({ title: 'Approve 15% off promotion for Raw Sushi', division: 'marketing', owner: 'marketing-lead', reason: 'revenue growth campaign', urgency: 'high' });
ceo.risks.add({ title: 'Salmon COGS up 38.9%', category: 'cost', level: 'HIGH', owner: 'procurement', division: 'finance' });
ceo.workforce.report({ activeEmployees: 24, laborCostPct: 88, openShifts: 3, atRiskStores: 1, status: 'AT_RISK' });
ceo.oss.record({ workers: 19, phasesCovered: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], running: 0, configuredNotInstalled: 19, flaggedLicenses: 6 });
ceo.kpis.record({ name: 'monthly_revenue', value: 48500, unit: 'USD', target: 53000, division: 'finance' });
ceo.kpis.record({ name: 'avg_rating', value: 4.1, unit: 'stars', target: 4.5, division: 'operations' });
ceo.autonomy.log({ action: 'Auto-approve refunds under $10', status: 'executed', approved: false, outcome: 'action withheld pending CEO approval' });

const brief = ceo.generateBriefing();
check('briefing has timestamp', () => assert.ok(brief.timestamp && brief.timestamp.length > 0));
check('briefing lists active objectives', () => assert.ok(brief.activeObjectives >= 1));
check('briefing includes blockers', () => assert.ok(brief.blockers.length >= 1));
check('briefing includes pending approvals', () => assert.ok(brief.pendingApprovals.length >= 1));
check('briefing includes critical risks', () => assert.ok(brief.criticalRisks.length >= 1));
check('briefing includes workforce report', () => assert.ok(brief.workforce !== null && brief.workforce.atRiskStores >= 1));
check('briefing includes OSS health summary', () => assert.ok(brief.ossHealth !== null && brief.ossHealth.workers === 19));
check('briefing includes next decisions', () => assert.ok(Array.isArray(brief.nextDecisions) && brief.nextDecisions.length >= 2));
check('briefing includes executive summary', () => assert.ok(brief.summary && brief.summary.length > 0));
check('briefing lists unapproved autonomous actions', () => assert.ok(brief.unapprovedAutonomy.length >= 1));

// KPIs accessible
const rev = ceo.kpis.latest('monthly_revenue');
check('KPI latest accessible by name', () => assert.ok(rev !== null && rev.value === 48500));

const ceo2 = new DailyBriefingEngine({ dataDir: DATA_DIR });
check('objectives persisted across restart', () => assert.ok(ceo2.objectives.active().length >= 1));
check('risks persisted across restart', () => assert.ok(ceo2.risks.critical().length >= 1));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);