import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT_DIR = path.join(ROOT, '.local-agent-global', 'coding-brain-benchmark');
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODELS = ['qwen2.5-coder:7b', 'qwen3:8b', 'qwen3:14b', 'deepseek-coder:6.7b'];
const RUN_SEEDS = [16, 17, 18];
const TSC = path.join(ROOT, 'node_modules', '.bin', 'tsc.cmd');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx.cmd');

const tasks = [
  {
    id: 'bug-fix',
    label: 'Bug fix',
    prompt: `
Fix this TypeScript function. It must return one record per id, preserving the
FIRST occurrence and input order. It must not mutate input.

type Item = { id: string; value: number };
export function uniqueById(items: Item[]): Item[] {
  return items.filter((item, index) =>
    items.findIndex(other => other.value === item.value) === index
  );
}

Return only the complete TypeScript module. No markdown.`,
    runner: `
import assert from 'node:assert/strict';
import { uniqueById } from './candidate';
const input = [
  { id: 'a', value: 1 },
  { id: 'b', value: 1 },
  { id: 'a', value: 9 },
  { id: 'c', value: 3 },
];
const before = JSON.stringify(input);
assert.deepEqual(uniqueById(input), [
  { id: 'a', value: 1 },
  { id: 'b', value: 1 },
  { id: 'c', value: 3 },
]);
assert.equal(JSON.stringify(input), before);
console.log('PASS');
`,
  },
  {
    id: 'typescript-refactor',
    label: 'TypeScript refactor',
    prompt: `
Refactor this TypeScript into a type-safe generic function. Requirements:
- export function groupBy<T, K extends PropertyKey>
- key selector is (item: T) => K
- return type is Record<K, T[]>
- preserve input order
- do not mutate input
- do not use any or type assertions

export function groupByStatus(items: { status: string }[]) {
  const result: any = {};
  items.forEach(item => {
    (result[item.status] ||= []).push(item);
  });
  return result;
}

Return only the complete TypeScript module. No markdown.`,
    runner: `
import assert from 'node:assert/strict';
import { groupBy } from './candidate';
const input = [
  { status: 'open' as const, n: 1 },
  { status: 'closed' as const, n: 2 },
  { status: 'open' as const, n: 3 },
];
const before = JSON.stringify(input);
assert.deepEqual(groupBy(input, x => x.status), {
  open: [input[0], input[2]],
  closed: [input[1]],
});
assert.equal(JSON.stringify(input), before);
console.log('PASS');
`,
  },
  {
    id: 'api-implementation',
    label: 'API implementation',
    prompt: `
Implement this TypeScript API helper:

export type Pagination = { page: number; limit: number; offset: number };
export function parsePagination(query: Record<string, unknown>): Pagination

Rules:
- page defaults to 1
- limit defaults to 20
- accept decimal integer strings or finite integer numbers
- page must be >= 1
- limit must be between 1 and 100
- invalid values throw new Error("Invalid pagination")
- offset is (page - 1) * limit
- do not use any

Return only the complete TypeScript module. No markdown.`,
    runner: `
import assert from 'node:assert/strict';
import { parsePagination } from './candidate';
assert.deepEqual(parsePagination({}), { page: 1, limit: 20, offset: 0 });
assert.deepEqual(parsePagination({ page: '3', limit: '25' }), { page: 3, limit: 25, offset: 50 });
assert.deepEqual(parsePagination({ page: 2, limit: 100 }), { page: 2, limit: 100, offset: 100 });
for (const query of [
  { page: '0' }, { page: '1.5' }, { page: 'abc' }, { page: Infinity },
  { limit: '0' }, { limit: '101' }, { limit: 2.2 }, { limit: null },
]) {
  assert.throws(() => parsePagination(query), /Invalid pagination/);
}
console.log('PASS');
`,
  },
  {
    id: 'unit-test-generation',
    label: 'Unit test generation',
    prompt: `
Write a complete TypeScript test module for this function using only
node:test and node:assert/strict. Import clamp from "./clamp".

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error("finite numbers required");
  }
  if (min > max) throw new Error("min must be <= max");
  return Math.min(max, Math.max(min, value));
}

Tests must cover: below range, inside range, above range, equal bounds,
min greater than max, and non-finite input. Return only the complete test
module. No markdown.`,
    isTestModule: true,
  },
  {
    id: 'code-review',
    label: 'Code review',
    prompt: `
Review this TypeScript Express handler. Return a JSON array only. Each item:
{"severity":"critical|high|medium|low","issue":"short description"}.
Report concrete bugs/security risks, not style.

app.get('/api/users/:id', async (req, res) => {
  const sql = "SELECT * FROM users WHERE id = " + req.params.id;
  const user = await db.query(sql);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    password_hash: user.password_hash,
    email: user.email,
    profile: JSON.parse(user.profile_json)
  });
});

Identify at least these categories when applicable: injection, secret exposure,
authorization, missing-record handling, unsafe JSON parsing/error handling.`,
    reviewExpected: [
      /sql injection|injection/i,
      /password|secret|hash/i,
      /authori[sz]ation|access control|authentication/i,
      /not found|missing|null|undefined/i,
      /json\.parse|parse|error handling|exception/i,
    ],
  },
];

function cleanCode(text) {
  const fenced = text.match(/```(?:typescript|ts)?\s*([\s\S]*?)```/i);
  let code = fenced ? fenced[1] : text;
  const start = code.search(/(?:export|import|type|interface|const|function)\s/);
  if (start > 0) code = code.slice(start);
  return code.trim();
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 45_000,
    windowsHide: true,
    shell: process.platform === 'win32',
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout?.trim() || '',
    stderr: result.stderr?.trim() || '',
  };
}

async function generate(model, prompt, seed, numPredict = 900) {
  const started = performance.now();
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      think: false,
      keep_alive: '10m',
      options: {
        temperature: 0.1,
        seed,
        num_predict: numPredict,
      },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const data = await response.json();
  return {
    ok: response.ok,
    response: String(data.response || ''),
    latency_ms: Math.round(performance.now() - started),
    prompt_tokens: Number(data.prompt_eval_count || 0),
    output_tokens: Number(data.eval_count || 0),
    total_duration_ns: Number(data.total_duration || 0),
    eval_duration_ns: Number(data.eval_duration || 0),
  };
}

function compileAndTest(task, model, runNumber, response) {
  const taskDir = path.join(
    OUTPUT_DIR,
    model.replace(/[:.]/g, '_'),
    `run-${runNumber}`,
    task.id,
  );
  fs.mkdirSync(taskDir, { recursive: true });

  if (task.reviewExpected) {
    fs.writeFileSync(path.join(taskDir, 'response.txt'), response, 'utf8');
    const hits = task.reviewExpected.map(pattern => pattern.test(response));
    return {
      compile_success: null,
      test_pass: hits.every(Boolean),
      correctness_checks: hits,
      correctness_score: hits.filter(Boolean).length / hits.length,
    };
  }

  const code = cleanCode(response);
  fs.writeFileSync(path.join(taskDir, task.isTestModule ? 'candidate.test.ts' : 'candidate.ts'), code, 'utf8');

  if (task.isTestModule) {
    fs.writeFileSync(path.join(taskDir, 'clamp.ts'), `
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error("finite numbers required");
  }
  if (min > max) throw new Error("min must be <= max");
  return Math.min(max, Math.max(min, value));
}
`, 'utf8');
  } else {
    fs.writeFileSync(path.join(taskDir, 'runner.ts'), task.runner, 'utf8');
  }

  const files = task.isTestModule
    ? ['candidate.test.ts', 'clamp.ts']
    : ['candidate.ts', 'runner.ts'];
  const compile = run(TSC, [
    '--noEmit', '--strict', '--target', 'ES2022', '--module', 'CommonJS',
    '--moduleResolution', 'node', '--esModuleInterop', '--skipLibCheck',
    '--types', 'node', ...files,
  ], taskDir);

  const test = compile.ok
    ? run(TSX, [task.isTestModule ? '--test' : '', task.isTestModule ? 'candidate.test.ts' : 'runner.ts'].filter(Boolean), taskDir)
    : { ok: false, status: null, stdout: '', stderr: 'Skipped because compile failed' };

  fs.writeFileSync(path.join(taskDir, 'compile.json'), JSON.stringify(compile, null, 2), 'utf8');
  fs.writeFileSync(path.join(taskDir, 'test.json'), JSON.stringify(test, null, 2), 'utf8');
  return {
    compile_success: compile.ok,
    test_pass: test.ok,
    correctness_checks: [compile.ok, test.ok],
    correctness_score: (Number(compile.ok) + Number(test.ok)) / 2,
  };
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const results = [];

for (const model of MODELS) {
  console.log(`Warm-up: ${model}`);
  await generate(model, 'Reply only with OK.', RUN_SEEDS[0], 16);

  for (let runIndex = 0; runIndex < RUN_SEEDS.length; runIndex += 1) {
    const runNumber = runIndex + 1;
    const seed = RUN_SEEDS[runIndex];
    for (const task of tasks) {
      console.log(`${model} run ${runNumber}: ${task.label}`);
      try {
        const generation = await generate(model, task.prompt, seed);
        const validation = compileAndTest(task, model, runNumber, generation.response);
        results.push({
          model,
          run: runNumber,
          seed,
          task: task.id,
          label: task.label,
          ...generation,
          ...validation,
        });
      } catch (error) {
        results.push({
          model,
          run: runNumber,
          seed,
          task: task.id,
          label: task.label,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          latency_ms: 180_000,
          prompt_tokens: 0,
          output_tokens: 0,
          compile_success: false,
          test_pass: false,
          correctness_score: 0,
        });
      }
    }
  }
}

const summaries = MODELS.map(model => {
  const rows = results.filter(row => row.model === model);
  const compilable = rows.filter(row => row.compile_success !== null);
  const latencies = rows.map(row => row.latency_ms);
  const taskStability = tasks.map(task => {
    const taskRows = rows.filter(row => row.task === task.id);
    return {
      task: task.id,
      pass_runs: taskRows.filter(row => row.test_pass).length,
      total_runs: taskRows.length,
      average_correctness_percent: Math.round(
        taskRows.reduce((sum, row) => sum + row.correctness_score, 0) / taskRows.length * 1000,
      ) / 10,
    };
  });
  return {
    model,
    runs: RUN_SEEDS.length,
    task_attempts: rows.length,
    correctness_percent: Math.round(rows.reduce((sum, row) => sum + row.correctness_score, 0) / rows.length * 1000) / 10,
    average_latency_ms: Math.round(rows.reduce((sum, row) => sum + row.latency_ms, 0) / rows.length),
    min_latency_ms: Math.min(...latencies),
    max_latency_ms: Math.max(...latencies),
    total_tokens: rows.reduce((sum, row) => sum + row.prompt_tokens + row.output_tokens, 0),
    output_tokens: rows.reduce((sum, row) => sum + row.output_tokens, 0),
    compile_success_rate: compilable.length
      ? Math.round(compilable.filter(row => row.compile_success).length / compilable.length * 1000) / 10
      : 0,
    test_pass_rate: Math.round(rows.filter(row => row.test_pass).length / rows.length * 1000) / 10,
    task_stability: taskStability,
  };
});

const artifact = {
  generated_at: new Date().toISOString(),
  methodology: {
    models: MODELS,
    run_seeds: RUN_SEEDS,
    runs_per_model: RUN_SEEDS.length,
    tasks: tasks.map(({ id, label }) => ({ id, label })),
    temperature: 0.1,
    num_predict: 900,
    warmup_excluded: true,
  },
  summaries,
  results,
};

fs.writeFileSync(path.join(OUTPUT_DIR, 'results.json'), JSON.stringify(artifact, null, 2), 'utf8');
console.log(JSON.stringify(summaries, null, 2));
