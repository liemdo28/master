import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { randomUUID, createHash } from 'crypto';
import { ProjectRegistryStore } from './store';
import { assertInsideAllowedRegistryRoots, assertInsideRoot, realPathIfExists, toPosixRelative } from './paths';
import { scorePathAgainstHints } from '../coding/candidate-selector';
import { retrieve } from '../coding/retrieval';
import type { RetrievalResult } from '../coding/retrieval/types';
import type {
  ContextPack,
  ProjectMap,
  ProjectMapModule,
  ProjectRecord,
  RegisterProjectInput,
  ResumeContext,
  ValidateCodingTaskInput,
} from './types';

const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.next', '.local-agent-global', 'coverage', 'logs']);

export class ProjectRegistryService {
  /** Retrieval result behind the most recent context pack, for evidence and events. */
  private lastRetrieval: RetrievalResult | null = null;

  getLastRetrieval(): RetrievalResult | null {
    return this.lastRetrieval;
  }

  constructor(private store = new ProjectRegistryStore()) {}

  registerProject(input: RegisterProjectInput): ProjectRecord {
    if (!input.displayName?.trim()) throw new Error('displayName is required');
    if (!input.canonicalRoot?.trim()) throw new Error('canonicalRoot is required');

    const canonicalRoot = assertInsideAllowedRegistryRoots(input.canonicalRoot);
    if (!fs.existsSync(canonicalRoot) || !fs.statSync(canonicalRoot).isDirectory()) {
      throw new Error('canonicalRoot must be an existing directory');
    }

    const git = detectGit(canonicalRoot) ?? detectSingleNestedGitRoot(canonicalRoot);
    const projectRoot = git.gitRoot ?? canonicalRoot;
    assertInsideAllowedRegistryRoots(projectRoot);
    const detected = detectProjectShape(projectRoot);
    const now = new Date().toISOString();
    const existing = input.id ? this.store.getProject(input.id) : null;
    const id = input.id ?? slugify(input.displayName);
    const rootOwner = this.store.getProjectByCanonicalRoot(projectRoot);
    if (rootOwner && rootOwner.id !== id) {
      throw new Error(`canonicalRoot is already registered to project ${rootOwner.id}`);
    }
    const project: ProjectRecord = {
      id,
      displayName: input.displayName.trim(),
      canonicalRoot: projectRoot,
      gitRoot: git.gitRoot,
      repositoryUrl: input.repositoryUrl ?? git.repositoryUrl,
      defaultBranch: input.defaultBranch ?? git.defaultBranch,
      owner: input.owner ?? null,
      businessPurpose: input.businessPurpose ?? null,
      runtimeHints: unique([...(input.runtimeHints ?? []), ...detected.runtimeHints]),
      packageManagers: detected.packageManagers,
      frameworks: detected.frameworks,
      testCommands: input.testCommands ?? detected.testCommands,
      buildCommands: input.buildCommands ?? detected.buildCommands,
      deploymentNotes: input.deploymentNotes ?? null,
      runtimeProcesses: detectPm2Processes(projectRoot),
      importantPaths: {
        ...(input.importantPaths ?? {}),
        projectRoot,
        gitRoot: git.gitRoot ?? '',
      },
      status: 'ACTIVE',
      mapStatus: existing?.mapStatus ?? 'NOT_GENERATED',
      mapVersion: existing?.mapVersion ?? null,
      mapGeneratedAt: existing?.mapGeneratedAt ?? null,
      mapSourceSha: existing?.mapSourceSha ?? null,
      lastVerifiedAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    return this.store.upsertProject(project);
  }

  listProjects(): ProjectRecord[] {
    return this.store.listProjects();
  }

  getProject(id: string): ProjectRecord | null {
    return this.store.getProject(id);
  }

  updateProject(id: string, patch: Partial<RegisterProjectInput>): ProjectRecord {
    const existing = this.mustGetProject(id);
    return this.registerProject({
      id,
      displayName: patch.displayName ?? existing.displayName,
      canonicalRoot: patch.canonicalRoot ?? existing.canonicalRoot,
      repositoryUrl: patch.repositoryUrl ?? existing.repositoryUrl,
      defaultBranch: patch.defaultBranch ?? existing.defaultBranch,
      owner: patch.owner ?? existing.owner,
      businessPurpose: patch.businessPurpose ?? existing.businessPurpose,
      runtimeHints: patch.runtimeHints ?? existing.runtimeHints,
      testCommands: patch.testCommands ?? existing.testCommands,
      buildCommands: patch.buildCommands ?? existing.buildCommands,
      deploymentNotes: patch.deploymentNotes ?? existing.deploymentNotes,
      importantPaths: patch.importantPaths ?? existing.importantPaths,
    });
  }

  verifyProject(id: string): ProjectRecord {
    const project = this.mustGetProject(id);
    const now = new Date().toISOString();
    const exists = fs.existsSync(project.canonicalRoot) && fs.statSync(project.canonicalRoot).isDirectory();
    this.store.markVerified(id, exists ? 'ACTIVE' : 'MISSING', now);
    return this.mustGetProject(id);
  }

  generateProjectMap(id: string): ProjectMap {
    const project = this.mustGetProject(id);
    const generatedAt = new Date().toISOString();
    try {
      const root = realPathIfExists(project.canonicalRoot);
      if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
        throw new Error('canonical project root is missing');
      }
      assertInsideRoot(root, project.canonicalRoot, 'map root');
      const sourceSha = currentSourceSha(root);
      const modules = discoverModules(root);
      const routes = discoverRoutes(root);
      const commands = discoverCommands(root);
      const risks = discoverRisks(root);
      const versionSeed = `${sourceSha ?? 'nogit'}:${JSON.stringify(modules)}:${JSON.stringify(routes)}:${JSON.stringify(commands)}`;
      const mapVersion = `map-${hash(versionSeed).slice(0, 12)}`;
      const map: ProjectMap = {
        projectId: id,
        mapVersion,
        sourceSha,
        status: 'FRESH',
        summary: `${project.displayName}: ${modules.length} mapped modules, ${routes.length} route signals, ${commands.length} command signals.`,
        modules,
        routes,
        commands,
        risks,
        generatedAt,
      };
      return this.store.insertProjectMap(map);
    } catch (err) {
      const failure: ProjectMap = {
        projectId: id,
        mapVersion: `failed-${Date.now()}`,
        sourceSha: null,
        status: 'FAILED',
        summary: err instanceof Error ? err.message : String(err),
        modules: [],
        routes: [],
        commands: [],
        risks: ['Project map generation failed; last valid map was preserved.'],
        generatedAt,
      };
      this.store.insertProjectMap(failure);
      throw err;
    }
  }

  getProjectMap(id: string): ProjectMap | null {
    return this.store.latestProjectMap(id);
  }

  getMapStatus(id: string): { projectId: string; mapStatus: ProjectRecord['mapStatus']; mapVersion: string | null; sourceSha: string | null; generatedAt: string | null } {
    const project = this.mustGetProject(id);
    const mapStatus = this.effectiveMapStatus(project);
    return {
      projectId: id,
      mapStatus,
      mapVersion: project.mapVersion,
      sourceSha: project.mapSourceSha,
      generatedAt: project.mapGeneratedAt,
    };
  }

  buildResumeContext(projectId: string, taskId: string | null, summary?: string): ResumeContext {
    this.mustGetProject(projectId);
    return this.store.saveResumeContext({
      projectId,
      taskId,
      summary: sanitizeSummary(summary ?? 'Resume context created from project registry API.'),
      openItems: [],
      lastKnownStatus: null,
    });
  }

  getLatestResumeContext(projectId: string): ResumeContext | null {
    this.mustGetProject(projectId);
    return this.store.latestResumeContext(projectId);
  }

  buildContextPack(projectId: string, userRequest = '', resumeContextId: string | null = null): ContextPack {
    const project = this.mustGetProject(projectId);
    if (resumeContextId) {
      const resume = this.store.getResumeContext(resumeContextId);
      if (!resume || resume.projectId !== projectId) {
        throw new Error('resumeContextId must belong to the same project');
      }
    }
    const map = project.mapVersion ? this.store.getProjectMap(projectId, project.mapVersion) : this.store.latestProjectMap(projectId);
    const mapStatus = this.effectiveMapStatus(project);
    const hints = tokenize(userRequest);

    // Structural retrieval chooses the pack contents.
    //
    // Lexical ranking over module paths could not tell a request's vocabulary
    // from a filename: a request about "the engine id in a plan response"
    // ranked an engine implementation above the route that serves the plan.
    // Retrieval ranks by route, symbol, response-shape and dependency evidence
    // instead, and returns a small explainable set rather than a fixed slice.
    // Retrieval enumerates source files itself rather than reading the map's
    // module lists. The map is deliberately a bounded *summary* (25 paths per
    // module), which is the right contract for a map and the wrong input for
    // retrieval: a file past that bound would be unreachable however exactly
    // it matched.
    const universe = [
      ...new Set([
        ...listProjectSourceFiles(project.canonicalRoot, 4000),
        ...(map?.modules ?? []).flatMap(module => module.paths),
      ]),
    ];
    let includedPaths: string[] = [];
    let retrieval: RetrievalResult | null = null;

    if (map && universe.length && userRequest.trim()) {
      try {
        retrieval = retrieve({
          projectId,
          sourceSha: map.sourceSha,
          worktreePath: project.canonicalRoot,
          userRequest,
          filePaths: universe,
        });
        includedPaths = retrieval.selected.map(candidate => candidate.path);
        for (const candidate of retrieval.selected) {
          for (const test of candidate.relatedTests) {
            if (!includedPaths.includes(test)) includedPaths.push(test);
          }
        }
      } catch {
        // Retrieval is an improvement over lexical ranking, not a dependency.
        retrieval = null;
      }
    }

    if (!includedPaths.length && map) {
      // Fallback: relevance-ranked module paths, as before retrieval existed.
      const matchedPaths = new Set<string>();
      for (const module of map.modules) {
        const haystack = `${module.name} ${module.purpose} ${module.paths.join(' ')}`.toLowerCase();
        if (hints.length && !hints.some(hint => haystack.includes(hint))) continue;
        [...module.paths]
          .map(modulePath => ({ modulePath, score: scorePathAgainstHints(modulePath, hints) }))
          .sort((a, b) => b.score - a.score || a.modulePath.localeCompare(b.modulePath))
          .slice(0, 8)
          .forEach(entry => matchedPaths.add(entry.modulePath));
      }
      includedPaths = [...matchedPaths].slice(0, 40);
    }

    this.lastRetrieval = retrieval;
    const moduleSummaries = map?.modules.map(module => `${module.name}: ${module.purpose}`).slice(0, 20) ?? [];
    const excludedPaths = ['node_modules', 'dist', 'build', '.git', '.local-agent-global', '.env', 'server/.env'];
    const pack: ContextPack = {
      id: `ctx-${randomUUID()}`,
      projectId,
      mapVersion: map?.mapVersion ?? null,
      sourceSha: map?.sourceSha ?? null,
      mapStatus,
      policy: !map || mapStatus !== 'FRESH' ? 'REMAP_REQUIRED' : includedPaths.length ? 'MAP_PLUS_TARGETED_READ' : 'MAP_ONLY',
      summary: map ? map.summary : 'No valid project map is available yet.',
      moduleSummaries,
      includedPaths,
      excludedPaths,
      relevanceHints: hints.slice(0, 20),
      resumeContextId,
      createdAt: new Date().toISOString(),
    };
    return this.store.saveContextPack(pack);
  }

  getContextPack(projectId: string, contextPackId: string): ContextPack | null {
    this.mustGetProject(projectId);
    const pack = this.store.getContextPack(contextPackId);
    if (!pack || pack.projectId !== projectId) return null;
    return pack;
  }

  validateCodingTaskStart(input: ValidateCodingTaskInput): void {
    if (!input.projectId) throw new Error('coding tasks require projectId');
    if (!input.workingDirectory) throw new Error('coding tasks require workingDirectory');
    if (!input.mapVersion) throw new Error('coding tasks require mapVersion');
    if (!input.contextPackId) throw new Error('coding tasks require contextPackId');

    const project = this.mustGetProject(input.projectId);
    if (project.status !== 'ACTIVE') throw new Error(`project ${project.id} is not ACTIVE`);
    if (this.effectiveMapStatus(project) !== 'FRESH' || project.mapVersion !== input.mapVersion) {
      throw new Error('coding task mapVersion must match the active fresh project map');
    }
    const pack = this.store.getContextPack(input.contextPackId);
    if (!pack || pack.projectId !== project.id || pack.mapVersion !== input.mapVersion) {
      throw new Error('coding task contextPackId must belong to the same project map');
    }
    const root = realPathIfExists(project.canonicalRoot);
    const cwd = realPathIfExists(input.workingDirectory);
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      throw new Error('coding task workingDirectory must exist');
    }
    if (!isInside(cwd, root)) {
      throw new Error('coding task workingDirectory must stay inside canonical project root');
    }
  }

  close(): void {
    this.store.close();
  }

  private mustGetProject(id: string): ProjectRecord {
    const project = this.store.getProject(id);
    if (!project) throw new Error(`project not found: ${id}`);
    return project;
  }

  private effectiveMapStatus(project: ProjectRecord): ProjectRecord['mapStatus'] {
    const currentSha = currentSourceSha(project.canonicalRoot);
    if (project.mapStatus === 'FRESH' && project.mapSourceSha && currentSha && project.mapSourceSha !== currentSha) {
      return 'STALE';
    }
    return project.mapStatus;
  }
}

export function seedMiCoreProject(root: string): RegisterProjectInput {
  return {
    id: 'mi-core',
    displayName: 'Mi Core System',
    canonicalRoot: root,
    repositoryUrl: 'https://github.com/liemdo28/master.git',
    defaultBranch: 'master',
    owner: 'Liem',
    businessPurpose: 'Canonical personal operating system backend and task runtime.',
    runtimeHints: ['pm2:mi-core', 'node', 'express', 'typescript'],
    testCommands: ['npm run test:ci', 'npm run test:task-runtime'],
    buildCommands: ['npm run build'],
    importantPaths: {
      workspaceRoot: path.resolve(root, '..', '..'),
      server: path.join(root, 'server'),
    },
  };
}

function detectGit(root: string): { gitRoot: string | null; repositoryUrl: string | null; defaultBranch: string | null } | null {
  const gitRoot = gitOutput(root, ['rev-parse', '--show-toplevel']);
  if (!gitRoot) return null;
  const realRoot = realPathIfExists(root);
  const realGitRoot = realPathIfExists(gitRoot);
  if (!isInside(realGitRoot, realRoot)) return null;
  return {
    gitRoot: realGitRoot,
    repositoryUrl: gitOutput(root, ['remote', 'get-url', 'origin']),
    defaultBranch: gitOutput(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
  };
}

function detectSingleNestedGitRoot(root: string): { gitRoot: string | null; repositoryUrl: string | null; defaultBranch: string | null } {
  const candidates: string[] = [];
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
  let visited = 0;
  while (queue.length && visited < 200) {
    const { dir, depth } = queue.shift() as { dir: string; depth: number };
    visited += 1;
    if (fs.existsSync(path.join(dir, '.git'))) {
      candidates.push(dir);
      continue;
    }
    if (depth >= 4) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || IGNORE_DIRS.has(entry.name)) continue;
      queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
    }
  }
  if (candidates.length > 1) {
    throw new Error(`canonicalRoot contains multiple nested Git roots: ${candidates.length}`);
  }
  if (candidates.length === 0) {
    return { gitRoot: null, repositoryUrl: null, defaultBranch: null };
  }
  return detectGit(candidates[0]) ?? { gitRoot: realPathIfExists(candidates[0]), repositoryUrl: null, defaultBranch: null };
}

function detectProjectShape(root: string): Pick<ProjectRecord, 'runtimeHints' | 'packageManagers' | 'frameworks' | 'testCommands' | 'buildCommands'> {
  const packageManagers: string[] = [];
  const frameworks: string[] = [];
  const runtimeHints: string[] = [];
  const testCommands: string[] = [];
  const buildCommands: string[] = [];
  const packageJsonPath = findFirstExisting([path.join(root, 'package.json'), path.join(root, 'server', 'package.json')]);
  if (fs.existsSync(path.join(root, 'package-lock.json')) || fs.existsSync(path.join(root, 'server', 'package-lock.json'))) packageManagers.push('npm');
  if (packageJsonPath) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const name of ['express', 'react', 'vite', 'next', 'typescript', 'tsx', 'better-sqlite3']) {
      if (deps[name]) frameworks.push(name);
    }
    if (pkg.scripts?.build) buildCommands.push('npm run build');
    for (const script of ['test:ci', 'test:unit', 'test:task-runtime', 'test:project-registry']) {
      if (pkg.scripts?.[script]) testCommands.push(`npm run ${script}`);
    }
  }
  if (fs.existsSync(path.join(root, 'server', 'src', 'index.ts'))) runtimeHints.push('express-api');
  return { runtimeHints, packageManagers, frameworks, testCommands, buildCommands };
}

function detectPm2Processes(root: string): ProjectRecord['runtimeProcesses'] {
  try {
    const raw = execFileSync('pm2', ['jlist'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    const processes = JSON.parse(raw) as Array<{ name?: string; pm2_env?: { cwd?: string; pm_cwd?: string; status?: string; pm_exec_path?: string } }>;
    const realRoot = realPathIfExists(root);
    return processes
      .map(proc => ({
        name: proc.name ?? '',
        cwd: proc.pm2_env?.cwd ?? proc.pm2_env?.pm_cwd ?? null,
        script: proc.pm2_env?.pm_exec_path ?? null,
        status: proc.pm2_env?.status ?? null,
      }))
      .filter(proc => {
        const cwd = proc.cwd ? realPathIfExists(proc.cwd) : null;
        const script = proc.script ? realPathIfExists(proc.script) : null;
        return (cwd && isInside(cwd, realRoot)) || (script && isInside(script, realRoot));
      });
  } catch {
    return [];
  }
}

const KNOWN_MI_MODULE_DIRS = [
  'server/src/project-registry',
  'server/src/task-runtime',
  'server/src/coding',
  'server/src/routes',
  'server/src/projects',
  'server/src/company-os',
  'server/src/graph',
];

function discoverModules(root: string): ProjectMapModule[] {
  const modules: ProjectMapModule[] = [];
  for (const dir of KNOWN_MI_MODULE_DIRS) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    modules.push({
      name: dir.replace(/^server\/src\//, ''),
      purpose: inferPurpose(dir),
      paths: listFiles(abs, root, 25),
      signals: moduleSignals(abs),
    });
  }
  // The named list above only matches Mi's own layout. Any other repository —
  // which is precisely what a general-purpose coding engine has to handle —
  // would otherwise map to zero modules and produce an empty context pack, so
  // fall back to discovering the repository's actual source directories.
  if (!modules.length) modules.push(...discoverGenericModules(root));
  return modules;
}

/** Structure-agnostic discovery for repositories that are not Mi Core. */
function discoverGenericModules(root: string): ProjectMapModule[] {
  const modules: ProjectMapModule[] = [];
  const rootFiles: string[] = [];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return modules;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') || IGNORE_DIRS.has(entry.name)) continue;
    const abs = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const paths = listFiles(abs, root, 25);
      if (!paths.length) continue;
      modules.push({
        name: entry.name,
        purpose: inferGenericPurpose(entry.name),
        paths,
        signals: moduleSignals(abs),
      });
    } else if (/\.(ts|tsx|js|json|md|yml|yaml)$/.test(entry.name)) {
      rootFiles.push(toPosixRelative(root, abs));
    }
  }

  if (rootFiles.length) {
    modules.push({
      name: 'root',
      purpose: 'Top-level project files including manifests and configuration.',
      paths: rootFiles.slice(0, 25),
      signals: rootFiles.slice(0, 20).map(file => path.posix.basename(file)),
    });
  }
  return modules.slice(0, 20);
}

function inferGenericPurpose(name: string): string {
  const lower = name.toLowerCase();
  if (/^(test|tests|spec|specs|__tests__|t)$/.test(lower)) return 'Automated tests and specifications.';
  if (/^(src|lib|app|source)$/.test(lower)) return 'Primary application source.';
  if (/^(routes?|controllers?|api|handlers?)$/.test(lower)) return 'Request handling and API surface.';
  if (/^(services?|domain|core|business)$/.test(lower)) return 'Business and domain logic.';
  if (/^(models?|entities|schema|types?)$/.test(lower)) return 'Data models and type definitions.';
  if (/^(utils?|helpers?|common|shared)$/.test(lower)) return 'Shared utilities and helpers.';
  if (/^(config|configuration|settings)$/.test(lower)) return 'Configuration.';
  if (/^(scripts?|bin|tools?)$/.test(lower)) return 'Operational scripts and tooling.';
  if (/^(docs?|documentation)$/.test(lower)) return 'Documentation.';
  if (/^(pipeline|stages?|jobs?|workers?)$/.test(lower)) return 'Processing pipeline stages.';
  return `Source module: ${name}.`;
}

function discoverRoutes(root: string): string[] {
  const indexPath = path.join(root, 'server', 'src', 'index.ts');
  if (!fs.existsSync(indexPath)) return [];
  const text = fs.readFileSync(indexPath, 'utf8');
  return [...text.matchAll(/app\.use\('([^']+)'/g)].map(match => match[1]).slice(0, 120);
}

function discoverCommands(root: string): string[] {
  const pkgPath = findFirstExisting([path.join(root, 'server', 'package.json'), path.join(root, 'package.json')]);
  if (!pkgPath) return [];
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> };
  return Object.keys(pkg.scripts ?? {}).map(name => `npm run ${name}`).sort();
}

function discoverRisks(root: string): string[] {
  const risks: string[] = [];
  if (fs.existsSync(path.join(root, '.env'))) risks.push('Root .env exists; never include secrets in context packs.');
  if (fs.existsSync(path.join(root, 'server', '.env'))) risks.push('Server .env exists; API must keep secrets out of generated context.');
  risks.push('Project maps are summaries only; targeted reads are required before editing source.');
  return risks;
}

/**
 * Bounded repository-wide source enumeration for retrieval.
 *
 * Separate from listFiles so the project map keeps its summary bound while
 * retrieval still sees the whole tree.
 */
function listProjectSourceFiles(root: string, limit: number): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (out.length >= limit) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= limit) return;
      if (entry.name.startsWith('.') || IGNORE_DIRS.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (/.[cm]?[jt]sx?$/.test(entry.name)) out.push(toPosixRelative(root, abs));
    }
  };
  walk(root);
  return out;
}

function listFiles(start: string, root: string, limit: number): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (out.length >= limit) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (out.length >= limit || IGNORE_DIRS.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (/\.(ts|tsx|js|json|md|yml|yaml)$/.test(entry.name)) out.push(toPosixRelative(root, abs));
    }
  };
  walk(start);
  return out;
}

function moduleSignals(dir: string): string[] {
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).slice(0, 20) : [];
  return names.filter(name => !IGNORE_DIRS.has(name));
}

function inferPurpose(dir: string): string {
  if (dir.includes('project-registry')) return 'Canonical project metadata, map, resume, and context-pack services.';
  if (dir.includes('task-runtime')) return 'Durable task lifecycle and read-only command evidence runtime.';
  if (dir.includes('coding')) return 'Context-enforced offline coding workflow, worktree, adapter, validation, and review services.';
  if (dir.includes('routes')) return 'Express API surface mounted by server/src/index.ts.';
  if (dir.includes('projects')) return 'Legacy local project scanner and connector routing evidence.';
  if (dir.includes('company-os')) return 'Static company operating inventory and dashboards.';
  if (dir.includes('graph')) return 'Existing code graph intelligence adapter.';
  return 'Mapped source module.';
}

function gitOutput(cwd: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    return null;
  }
}

function currentSourceSha(cwd: string): string | null {
  const deployedSha = process.env.MI_DEPLOYED_SOURCE_SHA || process.env.MI_PROJECT_REGISTRY_SOURCE_SHA;
  if (deployedSha && /^[0-9a-f]{40}$/i.test(deployedSha) && isDeployedSourceRoot(cwd)) return deployedSha;
  return gitOutput(cwd, ['rev-parse', 'HEAD']);
}

function isDeployedSourceRoot(cwd: string): boolean {
  const configuredRoot = process.env.MI_DEPLOYED_SOURCE_ROOT;
  const deployedRoot = realPathIfExists(configuredRoot || process.cwd());
  return realPathIfExists(cwd) === deployedRoot;
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `project-${randomUUID()}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(v => v.trim()).filter(Boolean))];
}

function findFirstExisting(paths: string[]): string | null {
  return paths.find(p => fs.existsSync(p)) ?? null;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function tokenize(value: string): string[] {
  return unique(value.toLowerCase().split(/[^a-z0-9:_-]+/).filter(v => v.length > 2));
}

function sanitizeSummary(value: string): string {
  return value.replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi, '$1=[redacted]').slice(0, 4000);
}

function isInside(target: string, root: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}
