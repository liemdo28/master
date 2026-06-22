export class ClineControlBridge {
  constructor({ loop, planner, evidenceStore } = {}) {
    this.loop = loop;
    this.planner = planner;
    this.evidenceStore = evidenceStore;
  }

  async run(input = {}, mode = 'A') {
    if (mode === 'A') return this.loop.run(input);
    const plan = this.planner.createPlan(input);
    const { patchId, dir } = this.evidenceStore.createPatchDir(input.patchId);
    this.evidenceStore.writeText(dir, 'patch-plan.md', this.planner.toMarkdown(plan));
    this.evidenceStore.writeJson(dir, 'cline-task-package.json', { mode, plan, rules: ['Do not push', 'Do not deploy', 'Return diff and QA evidence'] });
    if (mode === 'B') return { ok: true, mode, patchId, artifactDir: dir, status: 'CLINE_TASK_PACKAGE_CREATED' };
    return { ok: true, mode, patchId, artifactDir: dir, status: 'HYBRID_PLAN_READY' };
  }
}
