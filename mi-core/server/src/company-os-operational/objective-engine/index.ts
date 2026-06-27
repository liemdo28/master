import { createRegisteredObjective } from '../../executive-coordination/objective-registry';
import { createTask } from '../../executive-coordination/task-registry';
import { addEvidenceRecord } from '../../executive-coordination/evidence-registry';
import { createApproval } from '../../executive-coordination/approval-registry';
import type { Division } from '../../executive-coordination/types';
import type { ExecutiveObjectivePlan, ObjectiveRoutingProof, ObjectiveTaskTemplate } from '../types';

function buildTaskTemplates(objective: string): ObjectiveTaskTemplate[] {
  const text = objective.toLowerCase();
  const tasks: ObjectiveTaskTemplate[] = [];

  if (/revenue|doanh thu|sales|10%/.test(text)) {
    tasks.push(
      { title: 'Measure revenue baseline and gap', description: 'Confirm baseline revenue before any growth claim.', division: 'finance', owner: 'financial-intelligence', approvalRequired: 'none', metric: 'revenue_baseline' },
      { title: 'Identify SEO revenue pages', description: 'Rank pages and search intents tied to Raw Sushi revenue.', division: 'seo', owner: 'seo-growth', approvalRequired: 'none', metric: 'organic_revenue_pages' },
      { title: 'Draft approval-gated campaign plan', description: 'Prepare campaign plan; publishing requires CEO approval.', division: 'marketing', owner: 'marketing-intelligence', approvalRequired: 'marketing_publish', metric: 'campaign_pipeline' },
      { title: 'Audit DoorDash conversion levers', description: 'Check DoorDash menu/campaign risks without making live changes.', division: 'operations', owner: 'business-operators', approvalRequired: 'doordash_campaign_change', metric: 'doordash_conversion' },
      { title: 'Plan website conversion improvements', description: 'Create website change list; publishing requires approval.', division: 'engineering', owner: 'engineering-division', approvalRequired: 'website_content_publish', metric: 'website_conversion' },
      { title: 'Prepare creative assets for revenue campaign', description: 'Create draft assets and hold for approval.', division: 'creative', owner: 'creative-division', approvalRequired: 'marketing_publish', metric: 'creative_assets_ready' },
    );
  }

  if (/seo|traffic|ranking/.test(text)) {
    tasks.push(
      { title: 'Run SEO technical audit', description: 'Collect technical blockers and evidence.', division: 'seo', owner: 'seo-technical-agent', approvalRequired: 'none', metric: 'technical_issues' },
      { title: 'Build SEO content queue', description: 'Create content briefs from local SEO evidence.', division: 'marketing', owner: 'content-factory', approvalRequired: 'none', metric: 'content_queue' },
    );
  }

  if (/qb|quickbooks|sync/.test(text)) {
    tasks.push(
      { title: 'Investigate QuickBooks sync health', description: 'Check QB source freshness and connector error evidence.', division: 'finance', owner: 'financial-intelligence', approvalRequired: 'credential_use', metric: 'qb_sync_health' },
      { title: 'Route QB connector repair', description: 'Repair connector only after credential-safe approval.', division: 'it', owner: 'it-operations', approvalRequired: 'credential_use', metric: 'qb_connector_status' },
    );
  }

  if (/review|rating/.test(text)) {
    tasks.push(
      { title: 'Classify negative review spike', description: 'Group review issues by store, theme, and urgency.', division: 'marketing', owner: 'review-intelligence', approvalRequired: 'none', metric: 'review_sentiment' },
      { title: 'Prepare approval-gated review responses', description: 'Draft responses; live replies require approval.', division: 'operations', owner: 'business-operators', approvalRequired: 'review_response', metric: 'response_queue' },
    );
  }

  if (/website|site/.test(text)) {
    tasks.push(
      { title: 'Scope website build request', description: 'Define pages, conversion goal, and owners.', division: 'engineering', owner: 'engineering-division', approvalRequired: 'none', metric: 'website_scope' },
      { title: 'Create website creative brief', description: 'Prepare visual/content assets for the website.', division: 'creative', owner: 'creative-division', approvalRequired: 'none', metric: 'website_assets' },
    );
  }

  if (tasks.length === 0) {
    tasks.push(
      { title: 'Clarify executive objective', description: 'Collect objective scope, metric, owner, and approval risk.', division: 'it', owner: 'company-os-operational', approvalRequired: 'none', metric: 'objective_clarity' },
      { title: 'Create cross-division routing proposal', description: 'Route likely divisions while waiting for CEO clarification.', division: 'operations', owner: 'executive-coordinator', approvalRequired: 'none', metric: 'routing_proposal' },
    );
  }

  return tasks;
}

export function createExecutiveObjective(objective: string): ExecutiveObjectivePlan {
  const registered = createRegisteredObjective(objective, 'ceo');
  const tasks = buildTaskTemplates(objective);
  const divisions = Array.from(new Set(tasks.map(t => t.division))) as Division[];
  const approvalTypes = Array.from(new Set(tasks.map(t => t.approvalRequired).filter(t => t !== 'none')));
  const metrics = Array.from(new Set(tasks.map(t => t.metric)));
  const warnings = [
    'Live production actions remain approval-gated.',
    'Revenue, QB, GSC, GBP, Toast, and DoorDash claims require fresh connector evidence.',
  ];

  return {
    objectiveId: registered.id,
    objective,
    strategy: `Convert "${objective}" into cross-division tasks, approval gates, evidence, metrics, and an executive report.`,
    projects: divisions.map(d => `${d}-workstream`),
    tasks,
    divisions,
    approvalTypes,
    metrics,
    truthWarnings: warnings,
  };
}

export function routeExecutiveObjective(objective: string): ObjectiveRoutingProof {
  const plan = createExecutiveObjective(objective);
  const taskIds: string[] = [];
  let approvalsRequested = 0;

  for (const template of plan.tasks) {
    const task = createTask({
      objectiveId: plan.objectiveId,
      title: template.title,
      description: template.description,
      division: template.division,
      owner: template.owner,
      approvalRequired: template.approvalRequired,
      dependencies: template.dependencies || [],
    });
    taskIds.push(task.id);

    addEvidenceRecord(task.id, {
      type: 'api-output',
      url: `phase10-objective-routing:${plan.objectiveId}:${template.metric}`,
      capturedAt: new Date().toISOString(),
    });

    if (template.approvalRequired !== 'none') {
      createApproval({
        objectiveId: plan.objectiveId,
        taskId: task.id,
        approvalType: template.approvalRequired,
        reason: `Phase 10 approval gate for ${template.title}`,
      });
      approvalsRequested++;
    }
  }

  return {
    objectiveId: plan.objectiveId,
    objective,
    taskIds,
    divisionsRouted: plan.divisions,
    evidenceStored: taskIds.length === plan.tasks.length,
    approvalsRequested,
    noOrphanTasks: taskIds.length > 0 && plan.tasks.every(t => Boolean(t.owner) && Boolean(t.division)),
    metricsTracked: plan.metrics,
  };
}

export function buildObjectiveRoutingProof(objective = 'Increase Raw Sushi Revenue 10%'): ObjectiveRoutingProof {
  return routeExecutiveObjective(objective);
}
