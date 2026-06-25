/**
 * Engineering Orchestrator — Mi CTO Brain
 * Single entry point: CEO gives objective → Mi classifies, routes, creates task,
 * dispatches, collects evidence, reviews, generates PR, requests approval.
 */

import { classifyTask }          from './task-classifier';
import { route }                 from './routing-engine';
import { createTask, updateStatus, getTask } from './engineering-queue';
import { reviewCode }            from './review-engine';
import { addEvidence, generateEvidenceReport } from './evidence-engine';
import { generatePR }            from './pr-generator';
import { escalateToHuman, notifyTaskComplete, notifyP0 } from './human-escalation';

export interface DispatchResult {
  task_id:       string;
  status:        string;
  selected_model: string;
  confidence:    number;
  classification: object;
  routing:       object;
  pr_spec?:      object;
  evidence_report?: string;
  next_action:   string;
  escalate_human: boolean;
}

export async function dispatch(
  objective: string,
  project:   string = 'mi-core',
  submittedCode?: string,
): Promise<DispatchResult> {
  // ── Step 1: Classify ────────────────────────────────────────────────────────
  const classification = classifyTask(objective);

  // ── Step 2: Route ───────────────────────────────────────────────────────────
  const routing = route(classification);

  // ── Step 3: Create task ─────────────────────────────────────────────────────
  const task = createTask(objective, project, classification, routing);

  // ── Step 4: Log dispatch evidence ───────────────────────────────────────────
  addEvidence({
    task_id: task.id,
    type:    'log',
    source:  'Mi CTO Orchestrator',
    content: `Task created. Model: ${routing.model_name} (${routing.confidence}%). Rationale: ${routing.rationale}`,
  });

  updateStatus(task.id, 'DISPATCHED');

  // ── P0 escalation — notify CEO immediately ──────────────────────────────────
  if (classification.is_p0) {
    notifyP0(task.id, objective).catch(() => {});
  }

  // ── Step 5: If code submitted, run review ───────────────────────────────────
  let prSpec;
  if (submittedCode) {
    updateStatus(task.id, 'REVIEW');

    const review = reviewCode(task.id, submittedCode);

    addEvidence({
      task_id: task.id,
      type:    'review',
      source:  'Review Engine',
      content: `Score: ${review.total_score}/100. Passed: ${review.passed}. Blockers: ${review.blockers.join(', ') || 'none'}`,
    });

    if (!review.passed) {
      updateStatus(task.id, 'FAILED', {
        error: `Review failed: score ${review.total_score}/100. Blockers: ${review.blockers.join('; ')}`,
      });
      const reportPath = generateEvidenceReport(task.id, objective, routing.model_name);
      return {
        task_id:        task.id,
        status:         'FAILED',
        selected_model: routing.selected_model,
        confidence:     routing.confidence,
        classification,
        routing,
        evidence_report: reportPath,
        next_action:    `Review failed (${review.total_score}/100). Fix blockers and resubmit: ${review.blockers.join('; ')}`,
        escalate_human: false,
      };
    }

    updateStatus(task.id, 'TESTING');

    // ── Step 6: Generate PR ──────────────────────────────────────────────────
    updateStatus(task.id, 'PR_READY');

    prSpec = generatePR(task.id, objective, project, classification, routing, review);

    addEvidence({
      task_id: task.id,
      type:    'pr',
      source:  'PR Generator',
      content: `Branch: ${prSpec.branch}\nTitle: ${prSpec.title}\nDraft: ${prSpec.is_draft}`,
    });

    const finalTaskStatus = routing.escalate_human ? 'APPROVAL_REQUIRED' : 'PR_READY';
    updateStatus(task.id, finalTaskStatus, { pr_branch: prSpec.branch });

    if (routing.escalate_human) {
      escalateToHuman(task.id, routing.escalation_reason || 'Human approval required').catch(() => {});
    } else {
      notifyTaskComplete(task.id, 'DONE').catch(() => {});
    }
  }

  // ── Step 7: Evidence report ─────────────────────────────────────────────────
  const reportPath = generateEvidenceReport(task.id, objective, routing.model_name);

  const finalStatus = routing.escalate_human ? 'APPROVAL_REQUIRED' :
                      submittedCode           ? 'PR_READY'          : 'DISPATCHED';

  const next_action = routing.escalate_human
    ? `APPROVAL REQUIRED — ${routing.escalation_reason}. CEO must approve before execution.`
    : submittedCode
    ? `PR ready on branch ${prSpec?.branch}. Run tests then merge.`
    : `Task dispatched to ${routing.model_name}. Waiting for code submission.`;

  return {
    task_id:         task.id,
    status:          finalStatus,
    selected_model:  routing.selected_model,
    confidence:      routing.confidence,
    classification,
    routing,
    ...(prSpec ? { pr_spec: prSpec } : {}),
    evidence_report: reportPath,
    next_action,
    escalate_human:  routing.escalate_human,
  };
}
