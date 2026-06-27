/**
 * Phase 10 - MI Company OS Operational
 *
 * Coordinates objective intake, division routing, evidence, approvals,
 * command-center truth, executive reporting, OSS governance, and scenario
 * certification without claiming live production proof that is not present.
 */

export {
  createExecutiveObjective,
  routeExecutiveObjective,
  buildObjectiveRoutingProof,
} from './objective-engine';

export {
  buildCommandCenterSnapshot,
  buildCommandCenterApiProof,
} from './command-center';

export {
  buildCrossDivisionCoordinationReport,
  buildDependencyGraphProof,
  buildDedupEngineProof,
} from './coordination-engine';

export {
  buildExecutiveReport,
  answerExecutiveQuestion,
  buildQuestionEngineProof,
} from './executive-reporting';

export {
  buildOssGlobalRegistry,
  buildOssLifecycleDashboard,
  buildOssGlobalScorecard,
  buildOssDependencyMap,
} from './oss-governance';

export {
  generateScenarioProof,
  runOperationalCertification,
} from './operational-certification';

export type * from './types';

import { createTask } from '../executive-coordination/task-registry';
import { createRegisteredObjective } from '../executive-coordination/objective-registry';
import { addEvidenceRecord } from '../executive-coordination/evidence-registry';
import { buildCommandCenterSnapshot } from './command-center';
import { buildCrossDivisionCoordinationReport } from './coordination-engine';
import { buildExecutiveReport } from './executive-reporting';
import { buildOssGlobalRegistry } from './oss-governance';
import { runOperationalCertification } from './operational-certification';
import type { CompanyOSOperationalStatus, Phase10RuntimeStatus } from './types';

export function bootstrapCompanyOSOperational(): Phase10RuntimeStatus {
  const objective = createRegisteredObjective('Phase 10 MI Company OS Operational', 'ceo');
  const task = createTask({
    objectiveId: objective.id,
    title: 'Bootstrap Phase 10 Company OS Operational loop',
    description: 'Wire Objective -> Strategy -> Projects -> Tasks -> Divisions -> Evidence -> Approval -> Metrics -> Outcome -> Executive Report.',
    division: 'it',
    owner: 'company-os-operational',
    approvalRequired: 'none',
  });

  const commandCenter = buildCommandCenterSnapshot();
  const coordination = buildCrossDivisionCoordinationReport();
  const executiveReport = buildExecutiveReport('daily');
  const ossRegistry = buildOssGlobalRegistry();
  const certification = runOperationalCertification();

  const blockers = [
    ...commandCenter.truthBlockers,
    ...executiveReport.revenueRisks,
    ...certification.blockers,
  ];

  const status: CompanyOSOperationalStatus = blockers.length === 0 && certification.status === 'MI_COMPANY_OS_OPERATIONAL'
    ? 'MI_COMPANY_OS_OPERATIONAL'
    : 'MI_COMPANY_OS_PARTIAL';

  addEvidenceRecord(task.id, {
    type: 'api-output',
    url: `phase10:status:${status};scenarios:${certification.scenarios.length};oss:${ossRegistry.projects.length}`,
    capturedAt: new Date().toISOString(),
  });

  return {
    status,
    generatedAt: new Date().toISOString(),
    objectiveId: objective.id,
    bootstrapTaskId: task.id,
    commandCenter,
    coordination,
    executiveReport,
    ossProjectCount: ossRegistry.projects.length,
    certification,
    blockers: Array.from(new Set(blockers)),
  };
}

export function getCompanyOSOperationalStatus(): Phase10RuntimeStatus {
  return bootstrapCompanyOSOperational();
}
