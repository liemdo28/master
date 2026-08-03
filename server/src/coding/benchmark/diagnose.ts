/**
 * Single-fixture diagnostic trace.
 *
 * Dumps every intermediate the engine produced — ranked candidates with their
 * scores, the exact context handed to the model, the plan, the raw patch, the
 * resulting diff, validation output and each repair attempt — so a failure can
 * be attributed to a stage rather than guessed at.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { selectCandidateFiles, enforceCandidateFileLimits } from '../candidate-selector';
import { LlmCodingEngine } from '../llm/engine';
import { CodingEngineError } from '../llm/types';
import { resolveNpmInvocation } from '../validation-runner';
import { getFixture } from '../__fixtures__/fixtures';
import { materializeFixture } from '../__fixtures__/materialize';
import type { CodingModelRoles } from '../types';
import type { ContextPack } from '../../project-registry/types';

function run(cwd: string, command: string): { exitCode: number; output: string } {
  const parts = command.split(' ').filter(Boolean);
  let bin = parts[0];
  let args = parts.slice(1);
  if (bin === 'npm') {
    const npm = resolveNpmInvocation();
    bin = npm.command;
    args = [...npm.args, ...args];
  }
  try {
    return { exitCode: 0, output: execFileSync(bin, args, { cwd, encoding: 'utf8', timeout: 180_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { exitCode: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
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

async function main(): Promise<void> {
  const [fixtureId, model = 'qwen3:8b'] = process.argv.slice(2);
  if (!fixtureId) throw new Error('Usage: diagnose <fixtureId> [model]');
  const fixture = getFixture(fixtureId);

  const m = materializeFixture(fixture);
  if (fixture.category === 'type-repair') linkTypescript(m.root);

  const pack: ContextPack = {
    id: `pack-${fixture.id}`, projectId: fixture.id, mapVersion: 'fixture-map-1', sourceSha: null,
    mapStatus: 'FRESH', policy: 'MAP_PLUS_TARGETED_READ', summary: fixture.summary,
    moduleSummaries: fixture.moduleSummaries, includedPaths: fixture.includedPaths,
    excludedPaths: fixture.excludedPaths, relevanceHints: [], resumeContextId: null,
    createdAt: new Date().toISOString(),
  };

  const candidates = enforceCandidateFileLimits(m.root, selectCandidateFiles(pack, fixture.userRequest));
  console.log(`\n### ${fixture.id} / ${model}`);
  console.log(`\nREQUEST: ${fixture.userRequest}`);
  console.log('\nCANDIDATES:');
  for (const c of candidates.candidates) console.log(`  ${c.confidence.toFixed(2)}  ${c.path.padEnd(40)} ${c.reason}`);
  if (candidates.excluded.length) console.log(`EXCLUDED: ${candidates.excluded.join(', ')}`);

  const roles: CodingModelRoles = {
    coding_fast: model, coding_primary: model, coding_review: model,
    locality: 'local-first', offlineReady: true,
  };
  const engine = new LlmCodingEngine({
    project: { id: fixture.id, displayName: fixture.title, canonicalRoot: m.root } as never,
    contextPack: pack, sourceSha: m.baseCommit, validationCommands: fixture.validationCommands,
  });

  try {
    const inspected = await engine.inspect({ worktreePath: m.root, candidates, userRequest: fixture.userRequest, modelRoles: roles });
    console.log(`\nFILES READ: ${inspected.filesRead.join(', ')}`);
    if (inspected.expansions?.length) console.log(`EXPANSIONS: ${JSON.stringify(inspected.expansions)}`);

    const plan = await engine.plan({ worktreePath: m.root, candidates, userRequest: fixture.userRequest, modelRoles: roles });
    console.log('\nPLAN:');
    console.log(`  summary       ${plan.summary}`);
    console.log(`  filesToChange ${plan.filesToChange.join(', ')}`);
    console.log(`  confidence    ${plan.confidence}`);
    console.log(`  steps         ${JSON.stringify((plan as { steps?: string[] }).steps ?? [])}`);

    const applied = await engine.apply({ worktreePath: m.root, plan, userRequest: fixture.userRequest, modelRoles: roles });
    console.log(`\nAPPLIED: ${applied.changedFiles.join(', ')}`);
    console.log(`  summary  ${(applied.evidence as { summary?: string }).summary}`);
    console.log(`  beyondPlan ${JSON.stringify((applied.evidence as { beyondPlan?: string[] }).beyondPlan ?? [])}`);

    console.log('\nDIFF:');
    console.log(run(m.root, 'git diff').output.slice(0, 6000));

    let attempt = 0;
    for (;;) {
      let worst = 0;
      let combined = '';
      for (const command of fixture.validationCommands) {
        const r = run(m.root, command);
        worst = Math.max(worst, r.exitCode);
        combined += r.output;
      }
      console.log(`\nVALIDATION (after ${attempt} repair): exit=${worst}`);
      console.log(combined.slice(0, 5000));
      if (worst === 0 || attempt >= 3) break;
      attempt += 1;
      try {
        await engine.continue({
          worktreePath: m.root, plan, attempt, validationSummary: fixture.validationCommands.join(', '),
          validationOutput: combined, userRequest: fixture.userRequest, modelRoles: roles,
        });
        console.log(`\nREPAIR ${attempt} diff:`);
        console.log(run(m.root, 'git diff').output.slice(0, 4000));
      } catch (err) {
        console.log(`\nREPAIR ${attempt} FAILED: ${err instanceof CodingEngineError ? `${err.category}: ${err.message}` : String(err)}`);
        break;
      }
    }
  } catch (err) {
    console.log(`\nFAILED: ${err instanceof CodingEngineError ? `${err.category}: ${err.message}` : String(err)}`);
  } finally {
    m.cleanup();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
