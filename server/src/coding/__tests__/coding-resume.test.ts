/**
 * Phase 4 interruption and resume tests.
 *
 * Each scenario drives a task to a specific stage, abandons the workflow object
 * to simulate a process death, then resumes with a freshly constructed workflow
 * and store — the same thing that happens after a restart. The invariant that
 * matters most is "at most one commit": a resume that re-applies or re-commits
 * is worse than one that refuses to continue.
 *
 * Stage transitions use the deterministic engine so the assertions are about
 * recovery behaviour rather than model variance. Engine-side context
 * reconstruction is covered separately against the real LLM adapter.
 */

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

import { CodingWorkflow, INTERNAL_ENGINE_ID } from '../workflow';
import { ProjectRegistryService } from '../../project-registry/service';
import { TaskEngine } from '../../task-runtime/engine';
import { TaskStore } from '../../task-runtime/store';
import { LlmCodingEngine } from '../llm/engine';
import { sessionFilePath } from '../llm/context-bridge';
import type { CandidateSelection } from '../types';

let checks = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (!condition) throw new Error(`FAILED: ${label} ${detail}`);
  checks += 1;
  console.log(`[coding-resume] ok  ${label}`);
}

function gitSync(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

const REQUEST = 'Add a read-only endpoint that returns the active coding engine registry and model roles';

/** Mirrors the Phase 3 fixture so validation resolves the same registered scripts. */
function createFixtureProject(root: string): string {
  fs.mkdirSync(path.join(root, 'server', 'src', 'routes'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'server', 'package.json'),
    JSON.stringify(
      { scripts: { build: 'node -e "process.exit(0)"', 'test:coding': 'node -e "process.exit(0)"' } },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(root, 'server', 'src', 'routes', 'coding.ts'),
    [
      "import { Router, Request, Response } from 'express';",
      '',
      'export function createCodingRouter(): Router {',
      '  const router = Router();',
      '',
      "  router.get('/model-roles', async (_req: Request, res: Response) => {",
      '    res.json({});',
      '  });',
      '',
      '  return router;',
      '}',
      '',
    ].join('\n')
  );
  fs.writeFileSync(path.join(root, 'README.md'), '# resume fixture\n');
  gitSync(root, ['init', '--initial-branch=master']);
  gitSync(root, ['config', 'user.name', 'Phase4 Resume']);
  gitSync(root, ['config', 'user.email', 'resume@example.invalid']);
  gitSync(root, ['add', '--', '.']);
  gitSync(root, ['commit', '-m', 'seed']);
  return fs.realpathSync.native(root);
}

function commitCount(worktreePath: string, baseCommit: string): number {
  const out = gitSync(worktreePath, ['rev-list', '--count', `${baseCommit}..HEAD`]);
  return Number(out) || 0;
}

async function run(): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-phase4-resume-'));
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(tmpDir, 'registry');
  process.env.MI_TASK_RUNTIME_DIR = path.join(tmpDir, 'tasks');
  process.env.MI_CODING_WORKTREE_ROOT = path.join(tmpDir, 'worktrees');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = tmpDir;
  process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS = tmpDir;

  const service = new ProjectRegistryService();

  const plan = async (id: string) => {
    const root = createFixtureProject(path.join(tmpDir, id));
    const project = service.registerProject({
      id,
      displayName: id,
      canonicalRoot: root,
      testCommands: ['npm run test:coding'],
      buildCommands: ['npm run build'],
    });
    const map = service.generateProjectMap(project.id);
    const pack = service.buildContextPack(project.id, 'coding engine registry model roles endpoint');
    const workflow = new CodingWorkflow();
    const planned = await workflow.planTask({
      projectId: project.id,
      contextPackId: pack.id,
      mapVersion: map.mapVersion,
      userRequest: REQUEST,
      maxRetries: 1,
      engineId: INTERNAL_ENGINE_ID,
    });
    workflow.close();
    return planned;
  };

  try {
    // ── Scenario 1: interrupted after plan (task left READY) ─────────────────
    {
      const planned = await plan('resume-after-plan');
      check('planned task parked in READY', planned.task.status === 'READY');
      check('worktree exists on disk after plan', fs.existsSync(String(planned.task.worktreePath)));

      // Fresh workflow + fresh store == a new process.
      const resumed = await new CodingWorkflow().resumeTask(planned.task.id);
      check('resume from READY completes', resumed.task.status === 'COMPLETED');
      check('resume from READY produced a commit', Boolean(resumed.commitSha));
      check(
        'exactly one commit created',
        commitCount(String(planned.task.worktreePath), String(planned.task.baseCommit)) === 1
      );
    }

    // ── Scenario 2: interrupted after apply, before validation ───────────────
    {
      const planned = await plan('resume-after-apply');
      const store = new TaskStore();
      const engine = new TaskEngine(store);
      engine.transition(planned.task.id, 'RUNNING');

      // Perform the apply, then die before validation runs.
      const adapterWorkflow = new CodingWorkflow(store);
      const applied = await (adapterWorkflow as unknown as {
        adapter: { apply(input: unknown): Promise<{ changedFiles: string[] }> };
      }).adapter.apply({
        worktreePath: planned.task.worktreePath,
        plan: planned.plan,
        userRequest: REQUEST,
      });
      store.updateCodingFields(planned.task.id, { filesChanged: JSON.stringify(applied.changedFiles) });
      store.close();

      const resumed = await new CodingWorkflow().resumeTask(planned.task.id);
      check('resume after apply completes', resumed.task.status === 'COMPLETED');

      const events = new TaskStore().listEvents(planned.task.id);
      check(
        'apply is skipped rather than repeated on resume',
        events.some(event => event.type === 'coding.engine.apply_skipped_on_resume')
      );
      check(
        'no duplicate apply event recorded',
        events.filter(event => event.type === 'coding.engine.applied').length === 0
      );
      check(
        'still exactly one commit',
        commitCount(String(planned.task.worktreePath), String(planned.task.baseCommit)) === 1
      );
    }

    // ── Scenario 3: interrupted mid-validation (status left VALIDATING) ──────
    {
      const planned = await plan('resume-mid-validation');
      const store = new TaskStore();
      const engine = new TaskEngine(store);
      engine.transition(planned.task.id, 'RUNNING');
      engine.transition(planned.task.id, 'VALIDATING');
      store.close();

      const resumed = await new CodingWorkflow().resumeTask(planned.task.id);
      check('resume from VALIDATING completes', resumed.task.status === 'COMPLETED');
      check(
        'one commit after mid-validation resume',
        commitCount(String(planned.task.worktreePath), String(planned.task.baseCommit)) === 1
      );
    }

    // ── Scenario 4: a second resume must not create a second commit ──────────
    {
      const planned = await plan('resume-double');
      const first = await new CodingWorkflow().resumeTask(planned.task.id);
      check('first resume completes', first.task.status === 'COMPLETED');

      let secondRejected = false;
      try {
        await new CodingWorkflow().resumeTask(planned.task.id);
      } catch (err) {
        secondRejected = /cannot resume from COMPLETED/.test(err instanceof Error ? err.message : String(err));
      }
      check('resuming a COMPLETED task is refused', secondRejected);
      check(
        'still exactly one commit after double resume',
        commitCount(String(planned.task.worktreePath), String(planned.task.baseCommit)) === 1
      );
    }

    // ── Scenario 5: cancellation before commit leaves no commit ──────────────
    {
      const planned = await plan('resume-cancel');
      const store = new TaskStore();
      new TaskEngine(store).cancelTask(planned.task.id, 'cancelled before run');
      store.close();

      let refused = false;
      try {
        await new CodingWorkflow().resumeTask(planned.task.id);
      } catch (err) {
        refused = /cannot resume from CANCELLED/.test(err instanceof Error ? err.message : String(err));
      }
      check('cancelled task refuses to resume', refused);
      check(
        'cancelled task produced no commit',
        commitCount(String(planned.task.worktreePath), String(planned.task.baseCommit)) === 0
      );
    }

    // ── Scenario 6: engine-side context reconstruction ──────────────────────
    {
      const planned = await plan('resume-engine-context');
      const worktreePath = String(planned.task.worktreePath);
      const candidates = JSON.parse(String(planned.task.candidateFiles)) as CandidateSelection;

      const engine = new LlmCodingEngine();
      // status() is the "is the engine still running" probe a supervisor uses
      // after a restart; a cold engine must report not-running rather than
      // leaving a task believed to be in flight.
      check('cold engine reports task not running', !(await engine.status(planned.task.id)).running);

      await engine.cancel(planned.task.id);
      check('cancel on a cold engine is safe', !(await engine.status(planned.task.id)).running);

      // Reconstruct context from the plan alone, with no prior session in memory.
      const evidence = (await engine.collectEvidence(worktreePath)) as { contextFiles: string[] };
      check('cold engine reports empty context before reconstruction', evidence.contextFiles.length === 0);

      const reconstructed = new LlmCodingEngine();
      await (reconstructed as unknown as {
        mustGetSession(worktreePath: string, userRequest: string, plan: unknown): { state: { files: Map<string, unknown> } };
      }).mustGetSession(worktreePath, REQUEST, planned.plan);
      const after = (await reconstructed.collectEvidence(worktreePath)) as { contextFiles: string[] };
      check('context reconstructed from the persisted plan', after.contextFiles.length > 0, JSON.stringify(after.contextFiles));

      // The session sidecar must never become part of the task's diff.
      const sidecar = sessionFilePath(worktreePath);
      check('session sidecar lives outside the worktree', !path.resolve(sidecar).startsWith(path.resolve(worktreePath) + path.sep));
      const status = gitSync(worktreePath, ['status', '--porcelain']);
      check('sidecar does not appear in git status', !status.includes('.mi-engine-sessions'), status);

      // Cancellation must interrupt an in-flight inference.
      const cancelling = new LlmCodingEngine();
      const controller = new AbortController();
      controller.abort();
      let aborted = false;
      try {
        await cancelling.plan({
          worktreePath,
          candidates,
          userRequest: REQUEST,
          modelRoles: { coding_fast: 'qwen3:8b', coding_primary: 'qwen3:8b', coding_review: 'qwen3:8b', locality: 'local-first', offlineReady: true },
          signal: controller.signal,
        });
      } catch (err) {
        aborted = /cancelled|abort/i.test(err instanceof Error ? err.message : String(err));
      }
      check('pre-aborted signal stops inference', aborted);
    }

    console.log(`\n[coding-resume] PASS — ${checks} recovery assertions`);
  } finally {
    service.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    } catch {
      console.warn(`[coding-resume] temp cleanup skipped: ${tmpDir}`);
    }
  }
}

run().catch(err => {
  console.error(`[coding-resume] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
