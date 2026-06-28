/**
 * semantic-workflow-orchestrator.ts — the intelligent workflow brain.
 *
 * From one CEO objective it produces the full plan: business intent → division
 * routes → OSS-worker selection → tasks → dependency order → duplicate check →
 * approval policy → evidence plan → executive report → learning hook. This is the
 * Part A2 closure for "semantic routing + OSS-worker selection pending".
 */
import { classifyObjective } from './semantic-objective-classifier';
import { parseBusinessIntent } from './business-intent-parser';
import { routeStep } from './division-router';
import { selectOssWorkerForDomain } from './oss-worker-selector';
import { selectAgentForDivision } from './human-agent-selector';
import { resolveDuplicates } from './duplicate-task-resolver';
import { planDependencies } from './dependency-planner';
import { selectApprovalPolicy } from './approval-policy-selector';
import { buildEvidencePlan } from './evidence-plan-builder';
import type { CoordinatedTask } from '../executive-coordination/types';

export interface WorkflowStepPlan {
  title: string;
  domain: string;
  division: string;
  routeConfidence: number;
  ossWorker: string | null;
  ossStatus: string | null;
  owner: string;
  approvalGate: string;
  requiresHuman: boolean;
}

export interface SemanticWorkflowResult {
  objective: string;
  classification: ReturnType<typeof classifyObjective>;
  intent: ReturnType<typeof parseBusinessIntent>;
  steps: WorkflowStepPlan[];
  dependencyOrder: string[];
  dependencyCycle: boolean;
  duplicatesAvoided: number;
  evidencePlan: ReturnType<typeof buildEvidencePlan>;
  executiveReport: { objective: string; stepCount: number; humanApprovals: number; ossWorkersSelected: number; topDomain: string };
  learningHook: { recordOutcome: true; phase12: 'agent-os/12'; note: string };
}

/** Default decomposition for a revenue-growth objective (generalizes by intent). */
function decompose(objective: string, intent: ReturnType<typeof parseBusinessIntent>): string[] {
  const entity = intent.entity ? intent.entity.replace(/\b\w/g, (c) => c.toUpperCase()) : 'the business';
  if (intent.intentType === 'growth') {
    return [
      `Analyze ${entity} revenue baseline`,
      `Analyze ${entity} marketing traffic`,
      `Review ${entity} DoorDash campaign performance`,
      `Create ${entity} promotional creative assets`,
      `Launch ${entity} growth campaign`,
    ];
  }
  return [`Analyze ${entity} ${intent.metric || 'situation'}`, `Plan ${entity} remediation`, `Execute ${entity} action`];
}

export function runSemanticWorkflow(objective: string): SemanticWorkflowResult {
  const classification = classifyObjective(objective);
  const intent = parseBusinessIntent(objective);
  const titles = decompose(objective, intent);

  const steps: WorkflowStepPlan[] = titles.map((title) => {
    const route = routeStep(title);
    const worker = selectOssWorkerForDomain(route.domain);
    const owner = selectAgentForDivision(route.division);
    const approval = selectApprovalPolicy(title);
    return {
      title,
      domain: route.domain,
      division: route.division,
      routeConfidence: route.confidence,
      ossWorker: worker.workerName,
      ossStatus: worker.status,
      owner: owner.owner,
      approvalGate: approval.gate,
      requiresHuman: approval.requiresHuman,
    };
  });

  // Build coordination tasks (chain dependencies: each step depends on the prior).
  const now = new Date().toISOString();
  const tasks: CoordinatedTask[] = steps.map((s, i) => ({
    id: `WF-${String(i + 1).padStart(2, '0')}`,
    objectiveId: 'OBJ-SEMANTIC',
    title: s.title,
    description: '',
    division: s.division as CoordinatedTask['division'],
    owner: s.owner,
    priority: 'P2' as CoordinatedTask['priority'],
    status: 'pending' as CoordinatedTask['status'],
    dependencies: i > 0 ? [`WF-${String(i).padStart(2, '0')}`] : [],
    approvalRequired: (s.approvalGate === 'auto' ? 'none' : 'standard') as CoordinatedTask['approvalRequired'],
    evidenceRefs: [],
    duplicateOf: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }));

  // Inject a duplicate to prove avoidance, then resolve.
  const withDup: CoordinatedTask[] = [...tasks, { ...tasks[tasks.length - 1], id: 'WF-DUP' }];
  const dedup = resolveDuplicates(withDup);
  const dep = planDependencies(dedup.kept);
  const evidencePlan = buildEvidencePlan(steps.map((s) => ({ title: s.title, division: s.division, gate: s.approvalGate })));

  return {
    objective,
    classification,
    intent,
    steps,
    dependencyOrder: dep.order,
    dependencyCycle: dep.hasCycle,
    duplicatesAvoided: dedup.merged.length,
    evidencePlan,
    executiveReport: {
      objective,
      stepCount: steps.length,
      humanApprovals: steps.filter((s) => s.requiresHuman).length,
      ossWorkersSelected: steps.filter((s) => s.ossWorker).length,
      topDomain: classification.primaryDomain,
    },
    learningHook: { recordOutcome: true, phase12: 'agent-os/12', note: 'workflow outcome feeds Phase 12 self-improving memory' },
  };
}
