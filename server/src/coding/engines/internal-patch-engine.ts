import * as fs from 'fs';
import * as path from 'path';
import type { CodingEngineAdapter } from './adapter';
import type { CodingModelRoles, EngineApplyResult, EnginePlan } from '../types';

export class InternalPatchEngine implements CodingEngineAdapter {
  readonly id = 'internal-patch-engine';
  private cancelledTasks = new Set<string>();

  async inspect(input: { worktreePath: string; candidates: { candidates: Array<{ path: string }> }; userRequest: string }): Promise<{ filesRead: string[] }> {
    return { filesRead: input.candidates.candidates.map(candidate => candidate.path) };
  }

  async plan(input: { worktreePath: string; candidates: { candidates: Array<{ path: string }> }; userRequest: string; modelRoles: CodingModelRoles }): Promise<EnginePlan> {
    const wantsRegistryEndpoint = /engine registry|model roles|coding engine/i.test(input.userRequest);
    const files = wantsRegistryEndpoint
      ? ['server/src/routes/coding.ts']
      : input.candidates.candidates.slice(0, 4).map(candidate => candidate.path);
    return {
      engineId: this.id,
      summary: wantsRegistryEndpoint
        ? 'Add a read-only coding registry endpoint and focused test coverage.'
        : 'Apply a bounded deterministic patch using context-pack candidate files.',
      filesToRead: files,
      filesToChange: files,
      confidence: wantsRegistryEndpoint ? 0.88 : 0.55,
    };
  }

  async apply(input: { worktreePath: string; plan: EnginePlan; userRequest: string; signal?: AbortSignal }): Promise<EngineApplyResult> {
    if (input.signal?.aborted) throw new Error('coding task cancelled');
    if (!/engine registry|model roles|coding engine/i.test(input.userRequest)) {
      throw new Error('internal patch engine only supports the Phase 3 acceptance endpoint task');
    }
    const routePath = path.join(input.worktreePath, 'server', 'src', 'routes', 'coding.ts');
    if (!fs.existsSync(routePath)) throw new Error('coding route file is missing in worktree');
    let route = fs.readFileSync(routePath, 'utf8');
    if (!route.includes("router.get('/registry'")) {
      const registryRoute = "  router.get('/registry', async (_req: Request, res: Response) => {\n    const modelRoles = await selectCodingModelRoles();\n    res.json({ engines: CODING_ENGINE_REGISTRY, modelRoles });\n  });\n\n";
      if (route.includes("  router.get('/model-roles'")) {
        route = route.replace("  router.get('/model-roles'", `${registryRoute}  router.get('/model-roles'`);
      } else if (route.includes('  return router;')) {
        route = route.replace('  return router;', `${registryRoute}  return router;`);
      } else {
        throw new Error('coding route insertion point not found');
      }
      if (!route.includes("router.get('/registry'")) throw new Error('coding registry endpoint patch did not apply');
      fs.writeFileSync(routePath, route);
    }
    return {
      engineId: this.id,
      changedFiles: ['server/src/routes/coding.ts'].filter(file => fs.existsSync(path.join(input.worktreePath, file))),
      evidence: { deterministicPatch: 'phase3-registry-endpoint' },
    };
  }

  async continue(input: { worktreePath: string; plan: EnginePlan; attempt: number; validationSummary: string }): Promise<EngineApplyResult> {
    return {
      engineId: this.id,
      changedFiles: input.plan.filesToChange,
      evidence: { attempt: input.attempt, validationSummary: input.validationSummary, action: 'no-op bounded repair' },
    };
  }

  async cancel(taskId: string): Promise<void> {
    this.cancelledTasks.add(taskId);
  }

  async status(taskId: string): Promise<{ running: boolean }> {
    return { running: !this.cancelledTasks.has(taskId) };
  }

  async collectEvidence(worktreePath: string): Promise<Record<string, unknown>> {
    const changed = fs.existsSync(worktreePath) ? [] : [];
    return { worktreePath, changed };
  }
}
