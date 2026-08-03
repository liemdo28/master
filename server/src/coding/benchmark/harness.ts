/**
 * Phase 4 model benchmark.
 *
 * Runs the *real* engine — same context bridge, same boundary checks, same
 * patch applier, same repair loop — against every fixture, once per candidate
 * model. Nothing here is model-aware: swapping the model name is the only
 * difference between runs, so the numbers reflect model capability rather than
 * per-model prompt tuning.
 *
 * Models are run strictly one at a time and unloaded in between: this machine
 * has 8 GB of VRAM and two resident 9 GB models would thrash.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import type { CandidateSelection, CodingModelRoles, EnginePlan } from '../types';
import type { ContextPack } from '../../project-registry/types';
import { selectCandidateFiles, enforceCandidateFileLimits } from '../candidate-selector';
import { LlmCodingEngine } from '../llm/engine';
import { CodingEngineError, type FailureCategory } from '../llm/types';
import { loadedModels, unloadModel } from '../llm/ollama-client';
import { resolveNpmInvocation } from '../validation-runner';
import { FIXTURES, type Fixture } from '../__fixtures__/fixtures';
import { materializeFixture } from '../__fixtures__/materialize';

export interface TaskOutcome {
  model: string;
  fixtureId: string;
  category: Fixture['category'];
  planValid: boolean;
  planConfidence: number;
  hallucinatedPaths: string[];
  hallucinatedPathRate: number;
  patchValid: boolean;
  filesChanged: string[];
  outOfScopeEdits: string[];
  validationPassed: boolean;
  repairAttempts: number;
  repairSucceeded: boolean;
  contextFailure: boolean;
  failureCategory: FailureCategory | null;
  failureMessage: string | null;
  totalMs: number;
  modelMs: number;
  promptTokens: number;
  evalTokens: number;
  tokensPerSecond: number;
  peakVramBytes: number;
  testsWeakened: boolean;
  succeeded: boolean;
}

export interface ModelReport {
  model: string;
  outcomes: TaskOutcome[];
  tasksAttempted: number;
  tasksSucceeded: number;
  planValidRate: number;
  patchValidRate: number;
  hallucinatedPathRate: number;
  validationPassRate: number;
  repairSuccessRate: number;
  contextFailureRate: number;
  meanTokensPerSecond: number;
  meanTaskSeconds: number;
  peakVramGb: number;
}

const MAX_REPAIRS = 3;

function runCommand(cwd: string, command: string, timeoutMs = 180_000): { exitCode: number; output: string } {
  const parts = command.split(' ').filter(Boolean);
  let bin = parts[0];
  let args = parts.slice(1);
  if (bin === 'npm') {
    const npm = resolveNpmInvocation();
    if (!npm.configured) return { exitCode: 1, output: 'npm could not be resolved' };
    bin = npm.command;
    args = [...npm.args, ...args];
  }
  try {
    const out = execFileSync(bin, args, {
      cwd,
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DO_NOT_TRACK: '1', NPM_CONFIG_FUND: 'false', NPM_CONFIG_AUDIT: 'false' },
    });
    return { exitCode: 0, output: out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string; message?: string };
    return {
      exitCode: e.status ?? 1,
      output: `${e.stdout ?? ''}${e.stderr ?? ''}${e.status === undefined ? `\nspawn error: ${e.message ?? ''}` : ''}`,
    };
  }
}

function linkTypescript(root: string): void {
  const serverModules = path.resolve(__dirname, '..', '..', '..', 'node_modules');
  if (!fs.existsSync(path.join(serverModules, 'typescript'))) return;
  const target = path.join(root, 'node_modules');
  fs.mkdirSync(target, { recursive: true });
  for (const name of ['typescript', '.bin']) {
    const from = path.join(serverModules, name);
    const to = path.join(target, name);
    if (fs.existsSync(from) && !fs.existsSync(to)) {
      try {
        fs.symlinkSync(from, to, 'junction');
      } catch {
        fs.cpSync(from, to, { recursive: true });
      }
    }
  }
}

/** Builds a context pack equivalent to what the registry would emit for a fixture. */
function fixtureContextPack(fixture: Fixture): ContextPack {
  return {
    id: `pack-${fixture.id}`,
    projectId: fixture.id,
    mapVersion: 'fixture-map-1',
    sourceSha: null,
    mapStatus: 'FRESH',
    policy: 'MAP_PLUS_TARGETED_READ',
    summary: fixture.summary,
    moduleSummaries: fixture.moduleSummaries,
    includedPaths: fixture.includedPaths,
    excludedPaths: fixture.excludedPaths,
    relevanceHints: [],
    resumeContextId: null,
    createdAt: new Date().toISOString(),
  };
}

/** Detects the classic cheat: making validation pass by gutting the tests. */
function testsWereWeakened(root: string, fixture: Fixture): boolean {
  const testPaths = fixture.includedPaths.filter(p => /(^|\/)(test|spec|t)\//.test(p) || /\.(test|spec)\./.test(p));
  for (const relative of testPaths) {
    const original = fixture.files.find(f => f.path === relative)?.content;
    const current = fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
    if (original === undefined) continue;
    if (current.length < original.length * 0.85) return true;
    if (/\.skip\(|\bxtest\(|\btodo:\s*true|assert\.ok\(true\)/.test(current) && !/\.skip\(|\bxtest\(/.test(original)) {
      return true;
    }
  }
  return false;
}

async function peakVram(): Promise<number> {
  try {
    const models = await loadedModels();
    return models.reduce((max, m) => Math.max(max, m.vramBytes), 0);
  } catch {
    return 0;
  }
}

export async function runFixtureWithModel(fixture: Fixture, model: string): Promise<TaskOutcome> {
  const startedAt = Date.now();
  const outcome: TaskOutcome = {
    model,
    fixtureId: fixture.id,
    category: fixture.category,
    planValid: false,
    planConfidence: 0,
    hallucinatedPaths: [],
    hallucinatedPathRate: 0,
    patchValid: false,
    filesChanged: [],
    outOfScopeEdits: [],
    validationPassed: false,
    repairAttempts: 0,
    repairSucceeded: false,
    contextFailure: false,
    failureCategory: null,
    failureMessage: null,
    totalMs: 0,
    modelMs: 0,
    promptTokens: 0,
    evalTokens: 0,
    tokensPerSecond: 0,
    peakVramBytes: 0,
    testsWeakened: false,
    succeeded: false,
  };

  const materialized = materializeFixture(fixture);
  try {
    if (fixture.category === 'type-repair') linkTypescript(materialized.root);

    const pack = fixtureContextPack(fixture);
    const rawSelection: CandidateSelection = selectCandidateFiles(pack, fixture.userRequest);
    const candidates = enforceCandidateFileLimits(materialized.root, rawSelection);

    const roles: CodingModelRoles = {
      coding_fast: model,
      coding_primary: model,
      coding_review: model,
      locality: 'local-first',
      offlineReady: true,
    };

    const engine = new LlmCodingEngine({
      project: {
        id: fixture.id,
        displayName: fixture.title,
        canonicalRoot: materialized.root,
      } as never,
      contextPack: pack,
      sourceSha: materialized.baseCommit,
      validationCommands: fixture.validationCommands,
    });

    let plan: EnginePlan;
    try {
      await engine.inspect({
        worktreePath: materialized.root,
        candidates,
        userRequest: fixture.userRequest,
        modelRoles: roles,
      });
      plan = await engine.plan({
        worktreePath: materialized.root,
        candidates,
        userRequest: fixture.userRequest,
        modelRoles: roles,
      });
      outcome.planValid = true;
      outcome.planConfidence = plan.confidence;
      const hallucinated = (plan as EnginePlan & { hallucinatedPaths?: string[] }).hallucinatedPaths ?? [];
      outcome.hallucinatedPaths = hallucinated;
      const proposed = hallucinated.length + plan.filesToChange.length;
      outcome.hallucinatedPathRate = proposed ? hallucinated.length / proposed : 0;
    } catch (err) {
      recordFailure(outcome, err);
      return finish(outcome, startedAt, engine, materialized.root);
    }

    try {
      const applied = await engine.apply({
        worktreePath: materialized.root,
        plan,
        userRequest: fixture.userRequest,
        modelRoles: roles,
      });
      outcome.patchValid = true;
      outcome.filesChanged = applied.changedFiles;
      const allowed = new Set([...plan.filesToChange, ...candidates.candidates.map(c => c.path)]);
      outcome.outOfScopeEdits = applied.changedFiles.filter(f => !allowed.has(f));
    } catch (err) {
      recordFailure(outcome, err);
      return finish(outcome, startedAt, engine, materialized.root);
    }

    const validate = (): { passed: boolean; output: string; failed: string } => {
      let combined = '';
      let failedName = '';
      for (const command of fixture.validationCommands) {
        const result = runCommand(materialized.root, command);
        combined += `\n$ ${command}\n${result.output}`;
        if (result.exitCode !== 0 && !failedName) failedName = command;
      }
      return { passed: !failedName, output: combined, failed: failedName };
    };

    let validation = validate();
    outcome.validationPassed = validation.passed;

    while (!validation.passed && outcome.repairAttempts < MAX_REPAIRS) {
      outcome.repairAttempts += 1;
      try {
        await engine.continue({
          worktreePath: materialized.root,
          plan,
          attempt: outcome.repairAttempts,
          validationSummary: validation.failed,
          validationOutput: validation.output,
          userRequest: fixture.userRequest,
          modelRoles: roles,
        });
      } catch (err) {
        recordFailure(outcome, err);
        break;
      }
      validation = validate();
      outcome.validationPassed = validation.passed;
      if (validation.passed) outcome.repairSucceeded = true;
    }

    outcome.testsWeakened = testsWereWeakened(materialized.root, fixture);
    outcome.succeeded = outcome.validationPassed && !outcome.testsWeakened && outcome.outOfScopeEdits.length === 0;
    return finish(outcome, startedAt, engine, materialized.root);
  } finally {
    materialized.cleanup();
  }
}

function recordFailure(outcome: TaskOutcome, err: unknown): void {
  if (err instanceof CodingEngineError) {
    outcome.failureCategory = err.category;
    outcome.failureMessage = err.message;
    if (err.category === 'CONTEXT_INSUFFICIENT') outcome.contextFailure = true;
  } else {
    outcome.failureCategory = 'ENGINE_CRASHED';
    outcome.failureMessage = err instanceof Error ? err.message : String(err);
  }
}

async function finish(
  outcome: TaskOutcome,
  startedAt: number,
  engine: LlmCodingEngine,
  worktreePath: string
): Promise<TaskOutcome> {
  outcome.totalMs = Date.now() - startedAt;
  const evidence = (await engine.collectEvidence(worktreePath)) as { telemetry?: Array<Record<string, number>> };
  const telemetry = evidence.telemetry ?? [];
  outcome.modelMs = telemetry.reduce((sum, t) => sum + (t.latencyMs ?? 0), 0);
  outcome.promptTokens = telemetry.reduce((sum, t) => sum + (t.promptTokens ?? 0), 0);
  outcome.evalTokens = telemetry.reduce((sum, t) => sum + (t.evalTokens ?? 0), 0);
  const rates = telemetry.map(t => t.tokensPerSecond ?? 0).filter(v => v > 0);
  outcome.tokensPerSecond = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  outcome.peakVramBytes = await peakVram();
  return outcome;
}

export function summarize(model: string, outcomes: TaskOutcome[]): ModelReport {
  const n = outcomes.length || 1;
  const planned = outcomes.filter(o => o.planValid);
  const repairsAttempted = outcomes.filter(o => o.repairAttempts > 0);
  return {
    model,
    outcomes,
    tasksAttempted: outcomes.length,
    tasksSucceeded: outcomes.filter(o => o.succeeded).length,
    planValidRate: planned.length / n,
    patchValidRate: outcomes.filter(o => o.patchValid).length / n,
    hallucinatedPathRate: planned.length
      ? planned.reduce((sum, o) => sum + o.hallucinatedPathRate, 0) / planned.length
      : 0,
    validationPassRate: outcomes.filter(o => o.validationPassed).length / n,
    repairSuccessRate: repairsAttempted.length
      ? repairsAttempted.filter(o => o.repairSucceeded).length / repairsAttempted.length
      : 0,
    contextFailureRate: outcomes.filter(o => o.contextFailure).length / n,
    meanTokensPerSecond: avg(outcomes.map(o => o.tokensPerSecond).filter(v => v > 0)),
    meanTaskSeconds: avg(outcomes.map(o => o.totalMs / 1000)),
    peakVramGb: Math.max(0, ...outcomes.map(o => o.peakVramBytes)) / 1e9,
  };
}

function avg(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export async function runBenchmark(models: string[], fixtures: Fixture[] = FIXTURES): Promise<ModelReport[]> {
  const reports: ModelReport[] = [];
  for (const model of models) {
    process.stderr.write(`\n=== benchmarking ${model} ===\n`);
    const outcomes: TaskOutcome[] = [];
    for (const fixture of fixtures) {
      process.stderr.write(`  ${fixture.id} ... `);
      let outcome: TaskOutcome;
      try {
        outcome = await runFixtureWithModel(fixture, model);
      } catch (err) {
        outcome = {
          model,
          fixtureId: fixture.id,
          category: fixture.category,
          planValid: false,
          planConfidence: 0,
          hallucinatedPaths: [],
          hallucinatedPathRate: 0,
          patchValid: false,
          filesChanged: [],
          outOfScopeEdits: [],
          validationPassed: false,
          repairAttempts: 0,
          repairSucceeded: false,
          contextFailure: false,
          failureCategory: 'ENGINE_CRASHED',
          failureMessage: err instanceof Error ? err.message : String(err),
          totalMs: 0,
          modelMs: 0,
          promptTokens: 0,
          evalTokens: 0,
          tokensPerSecond: 0,
          peakVramBytes: 0,
          testsWeakened: false,
          succeeded: false,
        };
      }
      outcomes.push(outcome);
      process.stderr.write(
        `${outcome.succeeded ? 'PASS' : 'FAIL'} (${(outcome.totalMs / 1000).toFixed(0)}s` +
          `${outcome.failureCategory ? `, ${outcome.failureCategory}` : ''}` +
          `${outcome.repairAttempts ? `, ${outcome.repairAttempts} repair` : ''})\n`
      );
    }
    reports.push(summarize(model, outcomes));
    // Free VRAM before the next model claims it.
    await unloadModel(model);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  return reports;
}

export function writeReport(reports: ModelReport[], outputDir: string): string {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'benchmark-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2));

  const lines: string[] = [];
  lines.push('| model | tasks passed | plan valid | patch valid | halluc. paths | validation pass | repair success | ctx fail | tok/s | mean s | peak VRAM |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of reports) {
    lines.push(
      `| ${r.model} | ${r.tasksSucceeded}/${r.tasksAttempted} | ${pct(r.planValidRate)} | ${pct(r.patchValidRate)} | ` +
        `${pct(r.hallucinatedPathRate)} | ${pct(r.validationPassRate)} | ${pct(r.repairSuccessRate)} | ${pct(r.contextFailureRate)} | ` +
        `${r.meanTokensPerSecond.toFixed(1)} | ${r.meanTaskSeconds.toFixed(0)} | ${r.peakVramGb.toFixed(2)} GB |`
    );
  }
  lines.push('');
  lines.push('| model | fixture | category | result | failure | repairs | s |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of reports) {
    for (const o of r.outcomes) {
      lines.push(
        `| ${o.model} | ${o.fixtureId} | ${o.category} | ${o.succeeded ? 'PASS' : 'FAIL'} | ${o.failureCategory ?? '-'} | ${o.repairAttempts} | ${(o.totalMs / 1000).toFixed(0)} |`
      );
    }
  }
  const mdPath = path.join(outputDir, 'benchmark-results.md');
  fs.writeFileSync(mdPath, lines.join('\n') + '\n');
  return jsonPath;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

if (require.main === module) {
  const models = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  if (!models.length) {
    console.error('Usage: benchmark <model> [model...] [--fixtures=a,b] [--repeat=N]');
    process.exit(1);
  }
  // Repeated runs matter for the categories that sit near the model's limit;
  // a single sample there says very little about whether a fix actually held.
  const only = process.argv.find(arg => arg.startsWith('--fixtures='))?.split('=')[1]?.split(',') ?? [];
  const repeat = Number(process.argv.find(arg => arg.startsWith('--repeat='))?.split('=')[1] ?? 1) || 1;
  const selected = only.length ? FIXTURES.filter(f => only.some(id => f.id.includes(id))) : FIXTURES;
  const expanded = Array.from({ length: repeat }, () => selected).flat();

  runBenchmark(models, expanded)
    .then(reports => {
      const dir = process.env.MI_BENCHMARK_OUT ?? path.join(os.tmpdir(), 'mi-phase4-benchmark');
      const jsonPath = writeReport(reports, dir);
      console.log(fs.readFileSync(path.join(path.dirname(jsonPath), 'benchmark-results.md'), 'utf8'));
      console.log(`\nArtifacts: ${dir}`);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
