import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

import { ProjectRegistryService } from '../project-registry/service';
import type { ValidationProfile } from '../project-registry/types';
import { TaskStore } from '../task-runtime/store';
import { CodingWorkflow } from './workflow';
import { LLM_ENGINE_ID } from './llm/engine';

interface RealProjectCase {
  id: string;
  displayName: string;
  root: string;
  request: string;
  profile: ValidationProfile;
}

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function requiredEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`${name} is required`);
  return path.resolve(value);
}

function ensureCleanGitRoot(root: string): void {
  const gitRoot = git(root, ['rev-parse', '--show-toplevel']);
  if (path.resolve(gitRoot) !== path.resolve(root)) throw new Error(`expected ${root} to be a git root; got ${gitRoot}`);
  const dirty = git(root, ['status', '--porcelain']);
  if (dirty) throw new Error(`source checkout is dirty before certification: ${root}\n${dirty}`);
}

async function runCase(item: RealProjectCase, service: ProjectRegistryService): Promise<Record<string, unknown>> {
  ensureCleanGitRoot(item.root);
  const headBefore = git(item.root, ['rev-parse', 'HEAD']);
  const branchBefore = git(item.root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const project = service.registerProject({
    id: item.id,
    displayName: item.displayName,
    canonicalRoot: item.root,
    defaultBranch: branchBefore,
    validationProfile: item.profile,
    testCommands: item.profile.testCommands,
    buildCommands: item.profile.buildCommands,
  });
  const map = service.generateProjectMap(project.id);
  const pack = service.buildContextPack(project.id, item.request);

  const planner = new CodingWorkflow(undefined, service);
  const planned = await planner.planTask({
    projectId: project.id,
    contextPackId: pack.id,
    mapVersion: map.mapVersion,
    userRequest: item.request,
    commitPolicy: 'local-only',
    maxRetries: 2,
    engineId: LLM_ENGINE_ID,
  });
  planner.close();

  const resumer = new CodingWorkflow(undefined, service);
  const result = await resumer.resumeTask(planned.task.id);
  resumer.close();

  const store = new TaskStore();
  const events = store.listEvents(planned.task.id);
  store.close();
  const parsedEvents = events.map(event => {
    try {
      return { ...event, parsed: JSON.parse(event.detail) };
    } catch {
      return { ...event, parsed: null };
    }
  });
  const strategy = parsedEvents.find(event => event.type === 'coding.strategy.selected')?.parsed as Record<string, unknown> | undefined;
  const retrievalCandidates = parsedEvents
    .filter(event => event.type === 'coding.retrieval.candidate.selected')
    .map(event => event.parsed);
  const artifactReport = parsedEvents.find(event => event.type === 'coding.validation.artifacts.classified')?.parsed as Record<string, unknown> | undefined;

  const headAfter = git(item.root, ['rev-parse', 'HEAD']);
  const branchAfter = git(item.root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const dirtyAfter = git(item.root, ['status', '--porcelain']);
  const ok = result.task.status === 'COMPLETED' &&
    result.review.status === 'PASS' &&
    Boolean(result.commitSha) &&
    result.validation.every(entry => entry.configured && entry.exitCode === 0) &&
    parsedEvents.some(event => event.type === 'coding.models.selected') &&
    parsedEvents.some(event => event.type === 'coding.engine.applied') &&
    parsedEvents.some(event => event.type === 'coding.validation.artifacts.classified') &&
    headBefore === headAfter &&
    branchBefore === branchAfter &&
    !dirtyAfter;

  return {
    projectId: item.id,
    status: ok ? 'PASS' : 'FAIL',
    map: { version: map.mapVersion, status: map.status, sourceSha: map.sourceSha },
    contextPack: { id: pack.id, includedPaths: pack.includedPaths },
    retrievalCandidates,
    selectedFiles: result.candidates.candidates.map(candidate => candidate.path),
    strategy,
    validation: result.validation.map(entry => ({ name: entry.name, configured: entry.configured, exitCode: entry.exitCode, timedOut: entry.timedOut })),
    review: result.review,
    commitSha: result.commitSha,
    worktreePath: result.task.worktreePath,
    baseCheckout: { headUnchanged: headBefore === headAfter, branchUnchanged: branchBefore === branchAfter, clean: !dirtyAfter },
    restartRecovery: parsedEvents.some(event => event.type === 'coding.engine.applied') && planned.task.status === 'READY',
    artifactReport,
  };
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(process.cwd(), '..');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-real-certification-'));
  const miAcademyRoot = requiredEnv('MI_ACADEMY_ROOT', 'D:/phase4-10-mi-academy-source');
  const healthyLdRoot = requiredEnv('HEALTHY_LD_ROOT', 'D:/phase4-11-healthy-ld-source');
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(tmpDir, 'registry');
  process.env.MI_TASK_RUNTIME_DIR = path.join(tmpDir, 'tasks');
  process.env.MI_CODING_WORKTREE_ROOT = path.join(tmpDir, 'worktrees');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = [repoRoot, miAcademyRoot, healthyLdRoot, tmpDir].join(path.delimiter);
  process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS = [repoRoot, miAcademyRoot, healthyLdRoot, tmpDir].join(path.delimiter);

  const nodeProfile: ValidationProfile = {
    language: 'typescript',
    framework: 'node',
    installCommands: ['npm ci'],
    buildCommands: ['npm run build'],
    lintCommands: [],
    testCommands: ['npm run test:coding'],
    artifactPaths: [],
    generatedOutputPaths: ['server/dist', 'dist', 'build', 'coverage'],
    cleanupPolicy: 'none',
    successCriteria: ['build, coding tests, and diff check pass'],
  };
  const flutterProfile: ValidationProfile = {
    language: 'dart',
    framework: 'flutter',
    installCommands: ['flutter pub get'],
    buildCommands: [],
    lintCommands: ['flutter analyze'],
    testCommands: ['flutter test'],
    artifactPaths: [],
    generatedOutputPaths: ['.dart_tool', 'build'],
    cleanupPolicy: 'none',
    successCriteria: ['flutter analyze and flutter test pass'],
  };
  const healthyProfile: ValidationProfile = {
    language: 'javascript',
    framework: 'vite',
    installCommands: ['npm ci'],
    buildCommands: ['npm run build'],
    lintCommands: [],
    testCommands: ['npm run test:unit'],
    artifactPaths: [],
    generatedOutputPaths: ['dist-pages', 'data'],
    cleanupPolicy: 'none',
    successCriteria: ['build and unit tests pass; generated data/dist changes are classified as expected artifacts'],
  };

  const cases: RealProjectCase[] = [
    {
      id: 'mi-core-real-cert',
      displayName: 'Mi Core Real Certification',
      root: repoRoot,
      profile: nodeProfile,
      request: 'In server/src/coding/validation-runner.ts and server/src/coding/__tests__/validation-profile.test.ts, add concise comments documenting that validation profiles own command selection. Do not change behavior.',
    },
    {
      id: 'mi-academy-real-cert',
      displayName: 'Mi Academy Real Certification',
      root: miAcademyRoot,
      profile: flutterProfile,
      request: 'In apps/mobile/lib/services/api_service.dart and apps/mobile/test/api_paths_test.dart, add concise comments documenting that API path constants mirror the FastAPI route contract. Do not change behavior.',
    },
    {
      id: 'healthy-ld-real-cert',
      displayName: 'Healthy-LD Real Certification',
      root: healthyLdRoot,
      profile: healthyProfile,
      request: 'In js/dashboard.js and tests/unit/planner.test.mjs, add concise comments documenting that dashboard planner summaries rely on deterministic planner fixtures. Do not change behavior.',
    },
  ];

  const service = new ProjectRegistryService();
  try {
    const results = [];
    for (const item of cases) {
      console.log(`\n[real-certification] running ${item.id}`);
      const result = await runCase(item, service);
      results.push(result);
      console.log(JSON.stringify(result, null, 2));
      if (result.status !== 'PASS') throw new Error(`${item.id} failed certification`);
    }
    console.log('\n[real-certification] PASS');
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  } finally {
    service.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
