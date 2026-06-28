/**
 * workflow-intelligence/index.ts — semantic workflow public surface.
 *
 * Closes PR #25 blocker #2 ("workflow orchestration exists, but semantic routing
 * + OSS-worker selection are pending"). Everything is deterministic and runs on
 * the OSS runtime layer when present, degrading safely otherwise.
 */
export * from './semantic-objective-classifier';
export * from './business-intent-parser';
export * from './division-router';
export * from './oss-worker-selector';
export * from './human-agent-selector';
export * from './duplicate-task-resolver';
export * from './dependency-planner';
export * from './approval-policy-selector';
export * from './evidence-plan-builder';
export * from './semantic-workflow-orchestrator';
