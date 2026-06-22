export class AutoRetryPatchLoop {
  constructor({ planner, validator, applier, evidenceStore, qa, gitTracker, maxIterations = 5, projectVerifier = null } = {}) {
    this.planner = planner;
    this.validator = validator;
    this.applier = applier;
    this.evidenceStore = evidenceStore;
    this.qa = qa;
    this.gitTracker = gitTracker;
    this.maxIterations = maxIterations;
    this.projectVerifier = projectVerifier;
  }

  async run(input = {}) {
    if (this.projectVerifier && input.projectName) {
      const eligibility = this.projectVerifier.verify(input.projectName);
      if (!eligibility.ok) {
        return {
          ok: false,
          status: 'PATCH_BLOCKED',
          reason: eligibility.reason,
          eligibility,
        };
      }
    }

    const history = [];
    const seenFailures = new Map();
    let nextInput = input;

    for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
      const plan = this.planner.createPlan(nextInput);
      const validation = this.validator.validatePlan(plan);
      const { patchId, dir } = this.evidenceStore.createPatchDir(input.patchId);
      this.evidenceStore.writeText(dir, 'patch-plan.md', this.planner.toMarkdown(plan));
      this.evidenceStore.writeJson(dir, 'qa-before.md', nextInput.qaFailure || { ok: null, note: 'No pre-patch QA supplied' });

      if (!validation.ok) {
        const result = { ok: false, status: validation.requiresApproval ? 'CEO_APPROVAL_REQUIRED' : 'BLOCKED', patchId, iteration, validation };
        this.evidenceStore.writeJson(dir, 'result.json', result);
        return result;
      }

      const gitBefore = this.gitTracker?.capture?.() || null;
      const applied = this.applier.apply(plan, { patchId });
      const combinedDiff = applied.files.map((file) => file.diff).join('\n');
      const changedFiles = applied.files.map((file) => ({
        ...file.summary,
        workflowId: plan.workflowId,
        taskId: plan.taskId,
      }));

      this.evidenceStore.writeText(dir, 'before.diff', gitBefore?.diff?.stdout || '');
      this.evidenceStore.writeText(dir, 'after.diff', combinedDiff);
      this.evidenceStore.writeJson(dir, 'changed-files.json', changedFiles);

      const qaAfter = await this.qa.run();
      this.evidenceStore.writeJson(dir, 'qa-after.md', qaAfter);
      const gitAfter = this.gitTracker?.capture?.() || null;

      const iterationResult = {
        ok: qaAfter.ok === true,
        patchId,
        workflowId: plan.workflowId,
        taskId: plan.taskId,
        filesChanged: changedFiles,
        qaResult: qaAfter,
        iteration,
        risk: validation.risk,
        git: gitAfter,
        nextAction: qaAfter.ok ? 'Complete' : 'Retry patch with latest QA failure',
      };
      this.evidenceStore.writeJson(dir, 'result.json', iterationResult);
      history.push(iterationResult);

      if (qaAfter.ok) return { ok: true, status: 'PASS', patchId, iterations: iteration, history, latest: iterationResult };

      const key = JSON.stringify({ severity: qaAfter.highestSeverity, stderr: String(qaAfter.stderr || '').slice(0, 500), error: qaAfter.error });
      seenFailures.set(key, (seenFailures.get(key) || 0) + 1);
      if (seenFailures.get(key) >= 3) {
        return { ok: false, status: 'STOPPED_REPEATED_QA_FAILURE', patchId, iterations: iteration, history };
      }
      nextInput = { ...input, qaFailure: qaAfter, previousPlan: plan, iteration: iteration + 1 };
    }

    return { ok: false, status: 'MAX_ITERATIONS_REACHED', iterations: this.maxIterations, history };
  }
}
