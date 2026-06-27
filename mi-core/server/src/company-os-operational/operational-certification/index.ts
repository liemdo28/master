import { routeExecutiveObjective } from '../objective-engine';
import { buildExecutiveReport } from '../executive-reporting';
import type { OperationalCertification, ScenarioId, ScenarioProof } from '../types';

const SCENARIOS: Array<{ id: ScenarioId; name: string; objective: string; blockers: string[] }> = [
  {
    id: 'scenario_1',
    name: 'Increase Raw Sushi Revenue 10%',
    objective: 'Increase Raw Sushi Revenue 10%',
    blockers: ['Live QB/POS revenue proof missing', 'Publishing actions require approval'],
  },
  {
    id: 'scenario_2',
    name: 'QB Offline',
    objective: 'Fix QB Sync',
    blockers: ['Credential-safe QuickBooks repair requires explicit approval'],
  },
  {
    id: 'scenario_3',
    name: 'SEO Traffic Drop',
    objective: 'Investigate SEO Traffic Drop',
    blockers: ['Fresh GSC/GA4 evidence missing'],
  },
  {
    id: 'scenario_4',
    name: 'DoorDash Campaign Problem',
    objective: 'Fix DoorDash Campaign Problem',
    blockers: ['Live DoorDash mutation requires approval and connector certification'],
  },
  {
    id: 'scenario_5',
    name: 'Negative Reviews Spike',
    objective: 'Improve Review Rating after Negative Reviews Spike',
    blockers: ['Live review responses require approval'],
  },
];

export function generateScenarioProof(id: ScenarioId): ScenarioProof {
  const scenario = SCENARIOS.find(s => s.id === id);
  if (!scenario) throw new Error(`Unknown scenario: ${id}`);

  const routing = routeExecutiveObjective(scenario.objective);
  const report = buildExecutiveReport('incident');
  const approvalRequired = routing.approvalsRequested > 0;
  const passed = routing.taskIds.length > 0
    && routing.divisionsRouted.length > 0
    && routing.evidenceStored
    && routing.metricsTracked.length > 0
    && report.whatHappened.length > 0;

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    objective: scenario.objective,
    objectiveCreated: Boolean(routing.objectiveId),
    tasksCreated: routing.taskIds.length,
    divisionRouted: routing.divisionsRouted.length > 0,
    evidenceStored: routing.evidenceStored,
    approvalRequired,
    metricsUpdated: routing.metricsTracked.length > 0,
    executiveReportGenerated: report.whatHappened.length > 0,
    passed,
    blockers: scenario.blockers,
  };
}

export function runOperationalCertification(): OperationalCertification {
  const scenarios = SCENARIOS.map(s => generateScenarioProof(s.id));
  const blockers = Array.from(new Set(scenarios.flatMap(s => s.blockers)));
  const passedScenarios = scenarios.filter(s => s.passed).length;
  return {
    status: blockers.length === 0 && passedScenarios === scenarios.length
      ? 'MI_COMPANY_OS_OPERATIONAL'
      : 'MI_COMPANY_OS_PARTIAL',
    generatedAt: new Date().toISOString(),
    scenarios,
    passedScenarios,
    totalScenarios: scenarios.length,
    blockers,
  };
}
