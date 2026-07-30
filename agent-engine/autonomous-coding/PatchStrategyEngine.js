export class PatchStrategyEngine {
  createPlan({ issue, workflowReport, fixPrompt, projectBrain, memory, qaFailure, changes = [], workflowId, taskId } = {}) {
    const inferredIssue = issue || qaFailure?.summary || fixPrompt?.title || 'Patch requested';
    const knownFiles = changes.length ? changes : this.inferChangesFromText(`${inferredIssue}\n${JSON.stringify(qaFailure || {})}\n${fixPrompt || ''}`);

    return {
      issue: inferredIssue,
      workflowId: workflowId || workflowReport?.workflowId || `WORKFLOW-${Date.now()}`,
      taskId: taskId || workflowReport?.taskId || `TASK-${Date.now()}`,
      risk: knownFiles.some((c) => /production|migration|secret/i.test(c.filePath || '')) ? 'approval-required' : 'low',
      expectedResult: qaFailure?.expectedResult || 'Patch removes the QA failure and preserves existing behavior',
      changes: knownFiles,
      context: { workflowReport, fixPrompt, projectBrain, memory, qaFailure },
    };
  }

  inferChangesFromText(text) {
    const value = String(text || '').toLowerCase();
    if (value.includes('modal') && value.includes('overlay')) {
      return [
        {
          filePath: 'assets/css/modal.css',
          type: 'append',
          content: '\n.modal-overlay.is-passive { pointer-events: none; }\n.modal-dialog { pointer-events: auto; }\n',
          reason: 'Allow overlay to stop blocking modal controls while keeping dialog interactive',
        },
      ];
    }
    return [];
  }
}
