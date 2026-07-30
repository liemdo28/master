export class CodePatchPlanner {
  constructor({ strategyEngine } = {}) {
    this.strategyEngine = strategyEngine;
  }

  createPlan(input = {}) {
    if (input.plan) return input.plan;
    if (this.strategyEngine) return this.strategyEngine.createPlan(input);

    return {
      issue: input.issue || input.command || 'Unspecified patch request',
      workflowId: input.workflowId || `WORKFLOW-${Date.now()}`,
      taskId: input.taskId || `TASK-${Date.now()}`,
      expectedResult: input.expectedResult || 'Source change validates under QA',
      risk: 'low',
      changes: Array.isArray(input.changes) ? input.changes : [],
      context: {
        qaFailure: input.qaFailure || null,
        fixPrompt: input.fixPrompt || null,
        projectBrain: input.projectBrain || null,
        memory: input.memory || null,
      },
    };
  }

  toMarkdown(plan) {
    const lines = [
      `# Patch Plan`,
      '',
      `Issue: ${plan.issue}`,
      `Workflow ID: ${plan.workflowId || 'n/a'}`,
      `Task ID: ${plan.taskId || 'n/a'}`,
      `Risk: ${plan.risk || 'unknown'}`,
      '',
      '## Changes',
    ];

    for (const [index, change] of (plan.changes || []).entries()) {
      lines.push('', `${index + 1}. File: \`${change.filePath}\``, `   Type: ${change.type}`, `   Reason: ${change.reason || 'not specified'}`);
    }

    lines.push('', '## Expected Result', '', plan.expectedResult || 'QA passes');
    return lines.join('\n');
  }
}
