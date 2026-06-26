import { createRegisteredObjective } from '../executive-coordination/objective-registry';
import { createTask, addEvidence } from '../executive-coordination/task-registry';
import { getFinanceSourceHealth } from './source-health';
import { buildRevenueSummary } from './revenue-engine';
import { rankStores } from './store-ranking';
import { evaluateFinanceRisk } from './risk-engine';
import { answerFinanceQuestion } from './question-engine';
import type { FinancialIntelligenceDashboard } from './types';

export { getFinanceSourceHealth } from './source-health';
export { buildRevenueSummary } from './revenue-engine';
export { rankStores } from './store-ranking';
export { evaluateFinanceRisk } from './risk-engine';
export { answerFinanceQuestion } from './question-engine';
export { getLocalCertifiedLedger } from './sample-ledger';
export type * from './types';

export function buildFinancialIntelligenceDashboard(): FinancialIntelligenceDashboard {
  const sourceHealth = getFinanceSourceHealth();
  const revenue = buildRevenueSummary(sourceHealth);
  const rankings = rankStores(revenue);
  const risk = evaluateFinanceRisk(sourceHealth, revenue);
  const questionExamples = [
    answerFinanceQuestion('Raw Sushi revenue today?', sourceHealth, revenue, rankings),
    answerFinanceQuestion('Store ranking?', sourceHealth, revenue, rankings),
    answerFinanceQuestion('QB sync status?', sourceHealth, revenue, rankings),
  ];
  return { sourceHealth, revenue, rankings, risk, questionExamples };
}

export function runFinancialIntelligenceBootstrap() {
  const objective = createRegisteredObjective('Phase 3B Financial Intelligence', 'ceo');
  const task = createTask({
    objectiveId: objective.id,
    title: 'Create Financial Intelligence Engines',
    description: 'Revenue Engine, Store Ranking, Source Health, Risk Engine, and Question Engine.',
    division: 'finance',
    owner: 'financial-intelligence',
    approvalRequired: 'none',
  });
  const dashboard = buildFinancialIntelligenceDashboard();
  addEvidence(task.id, {
    type: 'api-output',
    url: `financial-intelligence:source:${dashboard.sourceHealth.status};risk:${dashboard.risk.level};stores:${dashboard.rankings.length}`,
    capturedAt: new Date().toISOString(),
  });
  return { objective, task, dashboard };
}
