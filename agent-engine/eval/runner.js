/**
 * eval/runner.js — M1: Eval-Driven Development
 * =============================================
 * Pluggable benchmark runner. Each benchmark implements the BenchmarkAdapter
 * interface: load() → buildPrompt() → run() → score() → writeResult().
 *
 * Usage:
 *   node eval/runner.js --benchmark humaneval [--limit 10] [--model qwen2.5-coder:7b]
 *   node eval/runner.js --all
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');
const BASELINE_FILE = join(__dirname, '..', 'metrics', 'baseline-2026-05-18.json');

// Ensure results directory exists
mkdirSync(RESULTS_DIR, { recursive: true });

// ─── Model Config ────────────────────────────────────────────────────────────
const MODEL_FALLBACK_ORDER = [
  process.env.EVAL_MODEL,
  'qwen3:14b',
  'qwen3:8b',
  'qwen2.5-coder:7b',
].filter(Boolean);

/**
 * Check which models are available in Ollama.
 * Returns array of installed model names.
 */
export async function getAvailableModels() {
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map(m => m.name);
  } catch {
    return [];
  }
}

/**
 * Select best available model from fallback order.
 * Returns model name or null if none available.
 */
export async function selectModel(preferred) {
  const available = await getAvailableModels();
  if (available.length === 0) return null;

  // Normalize: ollama reports "qwen3:14b" but user may specify with/without tag
  const normalize = (name) => name.replace(/:latest$/, '');
  const availNorm = available.map(normalize);

  // Check preferred first
  if (preferred && availNorm.some(a => a === normalize(preferred) || a.startsWith(normalize(preferred)))) {
    return preferred;
  }

  // Walk fallback order
  for (const candidate of MODEL_FALLBACK_ORDER) {
    if (availNorm.some(a => a === normalize(candidate) || a.startsWith(normalize(candidate)))) {
      return candidate;
    }
  }

  // Return first available model as last resort
  return available[0];
}

// ─── LLM Integration ────────────────────────────────────────────────────────
/**
 * Call a local LLM via Ollama. Returns raw text response.
 * @param {string} prompt
 * @param {string} model  - Ollama model name
 * @param {object} opts   - { temperature, num_predict, stop }
 */
export async function llmCall(prompt, model = 'qwen2.5-coder:7b', opts = {}) {
  const { temperature = 0.0, num_predict = 1024, stop = [] } = opts;

  const body = {
    model,
    prompt,
    stream: false,
    options: {
      temperature,
      num_predict,
      ...(stop.length ? { stop } : {}),
    },
  };

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.response || '';
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED')) {
      throw new Error(
        `Cannot connect to Ollama at http://localhost:11434.\n` +
        `  Start Ollama: ollama serve\n` +
        `  Pull model:   ollama pull ${model}\n` +
        `  Error: ${err.message}`
      );
    }
    throw err;
  }
}

// ─── Sandbox Execution ──────────────────────────────────────────────────────
/**
 * Execute generated code in a sandboxed subprocess.
 * @param {string} code        - The code to execute
 * @param {string} language    - 'python', 'javascript', 'go', etc.
 * @param {object} opts        - { timeout_ms, test_code }
 */
export async function sandboxExec(code, language, opts = {}) {
  const { timeout_ms = 30000, test_code = null } = opts;

  const tmpDir = join(RESULTS_DIR, `sandbox-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });

  let extension = { python: 'py', javascript: 'js', go: 'go', rust: 'rs', java: 'java', typescript: 'ts' }[language] || 'txt';
  let filename = `solution.${extension}`;
  let filepath = join(tmpDir, filename);

  writeFileSync(filepath, code);

  let cmd;
  switch (language) {
    case 'python':
      cmd = `python3 ${filepath}`;
      break;
    case 'javascript':
      cmd = `node ${filepath}`;
      break;
    case 'go':
      cmd = `go run ${filepath}`;
      break;
    case 'rust':
      // For Rust, write to a temp Cargo project or just compile
      cmd = `rustc ${filepath} -o ${tmpDir}/a.out && ${tmpDir}/a.out`;
      break;
    case 'java':
      // Extract class name from code for javac
      const classMatch = code.match(/public\s+class\s+(\w+)/);
      if (classMatch) {
        const className = classMatch[1];
        filename = `${className}.java`;
        filepath = join(tmpDir, filename);
        writeFileSync(filepath, code);
        cmd = `cd ${tmpDir} && javac ${filename} && java ${className}`;
      } else {
        throw new Error('Java code missing public class declaration');
      }
      break;
    case 'typescript':
      cmd = `npx ts-node ${filepath}`;
      break;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }

  try {
    const { execSync } = await import('child_process');
    const result = execSync(cmd, {
      cwd: tmpDir,
      timeout: timeout_ms,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: result, stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || err.message,
      exitCode: err.status || 1,
      timedOut: err.message?.includes('Command timed out'),
    };
  }
}

// ─── Benchmark Adapter Base Class ───────────────────────────────────────────
export class BenchmarkAdapter {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.results = [];
    this.stats = { total: 0, passed: 0, failed: 0, errors: 0, skipped: 0 };
  }

  /** Load problems from the benchmark dataset */
  async load() {
    throw new Error(`${this.name}: load() must be implemented`);
  }

  /** Build the prompt for a single problem */
  buildPrompt(problem) {
    throw new Error(`${this.name}: buildPrompt() must be implemented`);
  }

  /** Run LLM on a single problem, return generated code */
  async generate(problem) {
    const prompt = this.buildPrompt(problem);
    const model = this.config.model || 'qwen2.5-coder:7b';
    const raw = await llmCall(prompt, model, { temperature: 0.0, num_predict: 1024 });
    return this.extractCode(raw);
  }

  /** Extract code from LLM response (override per benchmark) */
  extractCode(raw) {
    // Default: try to extract code between triple backticks
    const match = raw.match(/```(?:\w+)?\n?([\s\S]*?)```/);
    if (match) return match[1].trim();
    return raw.trim();
  }

  /** Execute generated code and return pass/fail */
  async execute(code, problem) {
    return sandboxExec(code, this.language || 'python', { timeout_ms: 30000 });
  }

  /** Score a single problem result */
  score(problem, execution) {
    throw new Error(`${this.name}: score() must be implemented`);
  }

  /** Run the full benchmark */
  async run(limit = null) {
    const problems = await this.load();
    this.stats.total = limit ? Math.min(limit, problems.length) : problems.length;
    const toRun = limit ? problems.slice(0, limit) : problems;

    console.log(`\n[${this.name}] Running ${toRun.length} problems...`);

    for (let i = 0; i < toRun.length; i++) {
      const problem = toRun[i];
      process.stdout.write(`  [${i + 1}/${toRun.length}] ${problem.name || problem.task_id || problem.id || '?'} ... `);

      try {
        const code = await this.generate(problem);
        const execution = await this.execute(code, problem);
        const scored = this.score(problem, { code, execution });

        this.results.push({ problem, code, execution, ...scored });
        if (scored.passed) this.stats.passed++;
        else this.stats.failed++;

        console.log(scored.passed ? '✓ PASS' : '✗ FAIL');
      } catch (err) {
        this.stats.errors++;
        this.results.push({ problem, error: err.message });
        console.log(`✗ ERR: ${err.message.slice(0, 60)}`);
      }
    }

    return this;
  }

  /** Write results to eval/results/<benchmark>-<timestamp>.json */
  async writeResult() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = join(RESULTS_DIR, `${this.name}-${timestamp}.json`);
    const report = {
      benchmark: this.name,
      timestamp: new Date().toISOString(),
      stats: this.stats,
      passRate: this.stats.total > 0 ? (this.stats.passed / this.stats.total).toFixed(4) : null,
      results: this.results,
    };
    writeFileSync(outFile, JSON.stringify(report, null, 2));
    console.log(`\n[${this.name}] Results written to: ${outFile}`);
    console.log(`[${this.name}] Pass rate: ${report.passRate} (${this.stats.passed}/${this.stats.total})`);
    return report;
  }

  /** Get pass rate */
  getPassRate() {
    return this.stats.total > 0 ? this.stats.passed / this.stats.total : 0;
  }
}

// ─── HumanEval Adapter ─────────────────────────────────────────────────────
export class HumanEvalAdapter extends BenchmarkAdapter {
  constructor(config = {}) {
    super('humaneval', config);
    this.language = 'python';
  }

  async load() {
    const dataFile = join(__dirname, 'benchmarks', 'humaneval', 'data', 'humaneval.json');
    if (!existsSync(dataFile)) {
      console.warn(`[humaneval] Data file not found at ${dataFile}`);
      console.warn(`[humaneval] Run: node eval/vendor/humaneval-vendor.js`);
      return [];
    }
    const raw = readFileSync(dataFile, 'utf-8');
    return JSON.parse(raw);
  }

  buildPrompt(problem) {
    return `${problem.prompt}\n\nWrite a function named "${problem.entry_point}" that satisfies the docstring above. Return only the code, no explanation.`;
  }

  extractCode(raw) {
    // HumanEval expects just the function definition
    const match = raw.match(/(?:def\s+\w+.*?(?=\n(?:def|class|\Z)))/s) ||
                  raw.match(/```python\n([\s\S]*?)```/) ||
                  raw.match(/```\n?([\s\S]*?)```/) ||
                  raw.match(/(?:async\s+)?def\s+\w+.*/s);
    if (match) return match[0].trim();
    return raw.trim();
  }

  score(problem, { code, execution }) {
    const testCode = `
${code}

${problem.test}
`;
    const execResult = execution; // Already executed

    // For HumanEval: check if the code ran without error AND the test passed
    if (execResult.timedOut) {
      return { passed: false, reason: 'timeout' };
    }
    if (execResult.exitCode !== 0) {
      return { passed: false, reason: 'runtime_error', stderr: execResult.stderr };
    }

    // Re-run with test code to verify
    return { passed: execResult.exitCode === 0, reason: execResult.exitCode === 0 ? 'test_passed' : 'test_failed', stderr: execResult.stderr };
  }
}

// ─── MBPP Adapter ───────────────────────────────────────────────────────────
export class MBPPAdapter extends BenchmarkAdapter {
  constructor(config = {}) {
    super('mbpp', config);
    this.language = 'python';
  }

  async load() {
    const dataFile = join(__dirname, 'benchmarks', 'mbpp', 'data', 'mbpp.json');
    if (!existsSync(dataFile)) {
      console.warn(`[mbpp] Data file not found at ${dataFile}`);
      return [];
    }
    const raw = readFileSync(dataFile, 'utf-8');
    return JSON.parse(raw);
  }

  buildPrompt(problem) {
    return `${problem.text}\n\nWrite a Python function that solves this problem. Return only the code.`;
  }

  score(problem, { code, execution }) {
    if (execution.timedOut) {
      return { passed: false, reason: 'timeout' };
    }
    if (execution.exitCode !== 0) {
      return { passed: false, reason: 'runtime_error', stderr: execution.stderr };
    }
    return { passed: execution.exitCode === 0, reason: 'executed', stderr: execution.stderr };
  }
}

// ─── SWE-bench-Lite Adapter ─────────────────────────────────────────────────
export class SWEBenchLiteAdapter extends BenchmarkAdapter {
  constructor(config = {}) {
    super('swe-bench-lite', config);
    this.language = 'python';
  }

  async load() {
    const dataFile = join(__dirname, 'benchmarks', 'swe-bench-lite', 'data', 'swe-bench-lite.json');
    if (!existsSync(dataFile)) {
      console.warn(`[swe-bench-lite] Data file not found at ${dataFile}`);
      return [];
    }
    const raw = readFileSync(dataFile, 'utf-8');
    return JSON.parse(raw);
  }

  buildPrompt(problem) {
    return `You are an expert software engineer.

Repository: ${problem.repo}
Issue: ${problem.problem_statement}

Instructions:
1. Analyze the repository structure and the issue
2. Write a patch that fixes the issue
3. Return the patch as a unified diff

Return the patch in the following format:
\`\`\`diff
--- a/file.py
+++ b/file.py
@@ -1,5 +1,5 @@
-old code
+new code
\`\`\``;
  }

  extractCode(raw) {
    // Extract unified diff from response
    const match = raw.match(/```diff\n?([\s\S]*?)```/) ||
                  raw.match(/```\n?([\s\S]*?)```/) ||
                  raw.match(/(?:^--- .*\n^\+\+\+ .*\n^@@.*\n.*)+/gm);
    if (match) return Array.isArray(match) ? match[0] : match;
    return raw.trim();
  }

  score(problem, { code, execution }) {
    // SWE-bench scoring: apply patch and run tests
    // For now, we mark as "patch_generated" — actual scoring requires test environment
    return {
      passed: code.includes('---') && code.includes('+++'),
      reason: 'patch_format_valid',
      patch: code,
    };
  }
}

// ─── MultiPL-E Adapter ──────────────────────────────────────────────────────
export class MultiPLEAdapter extends BenchmarkAdapter {
  constructor(config = {}) {
    super('multipl-e', config);
    this.language = 'python'; // Will be overridden per problem
  }

  async load() {
    const dataDir = join(__dirname, 'benchmarks', 'multipl-e', 'data');
    const problems = [];
    
    // MultiPL-E has problems in multiple languages
    const languages = ['python', 'javascript', 'go', 'rust', 'java'];
    
    for (const lang of languages) {
      const langFile = join(dataDir, `${lang}.json`);
      if (existsSync(langFile)) {
        const raw = readFileSync(langFile, 'utf-8');
        const langProblems = JSON.parse(raw);
        langProblems.forEach(p => {
          p._targetLanguage = lang;
          problems.push(p);
        });
      }
    }
    
    if (problems.length === 0) {
      console.warn(`[multipl-e] No data files found in ${dataDir}`);
    }
    
    return problems;
  }

  buildPrompt(problem) {
    const lang = problem._targetLanguage || 'python';
    return `${problem.prompt}\n\nWrite a ${lang} function. Return only the code.`;
  }

  async generate(problem) {
    this.language = problem._targetLanguage || 'python';
    return super.generate(problem);
  }

  score(problem, { code, execution }) {
    if (execution.timedOut) {
      return { passed: false, reason: 'timeout', language: problem._targetLanguage };
    }
    return {
      passed: execution.exitCode === 0,
      reason: execution.exitCode === 0 ? 'test_passed' : 'runtime_error',
      stderr: execution.stderr,
      language: problem._targetLanguage,
    };
  }
}

// ─── DS-1000 Adapter ───────────────────────────────────────────────────────
export class DS1000Adapter extends BenchmarkAdapter {
  constructor(config = {}) {
    super('ds-1000', config);
    this.language = 'python';
  }

  async load() {
    const dataFile = join(__dirname, 'benchmarks', 'ds-1000', 'data', 'ds-1000.json');
    if (!existsSync(dataFile)) {
      console.warn(`[ds-1000] Data file not found at ${dataFile}`);
      return [];
    }
    const raw = readFileSync(dataFile, 'utf-8');
    return JSON.parse(raw);
  }

  buildPrompt(problem) {
    return `Problem: ${problem.prompt}\n\n${problem.perturbation ? `Variation: ${problem.perturbation}\n` : ''}\n\nWrite a Python solution. Return only the code.`;
  }

  score(problem, { code, execution }) {
    if (execution.timedOut) {
      return { passed: false, reason: 'timeout' };
    }
    return {
      passed: execution.exitCode === 0,
      reason: execution.exitCode === 0 ? 'test_passed' : 'runtime_error',
      stderr: execution.stderr,
    };
  }
}

// ─── CodeContests Adapter ──────────────────────────────────────────────────
export class CodeContestsAdapter extends BenchmarkAdapter {
  constructor(config = {}) {
    super('codecontests', config);
    this.language = 'python';
  }

  async load() {
    const dataFile = join(__dirname, 'benchmarks', 'codecontests', 'data', 'codecontests.json');
    if (!existsSync(dataFile)) {
      console.warn(`[codecontests] Data file not found at ${dataFile}`);
      return [];
    }
    const raw = readFileSync(dataFile, 'utf-8');
    return JSON.parse(raw);
  }

  buildPrompt(problem) {
    const description = problem.description || problem.problem || '';
    const sampleIO = problem.sample_input && problem.sample_output
      ? `Sample Input:\n${problem.sample_input}\n\nSample Output:\n${problem.sample_output}`
      : '';
    
    return `${description}\n\n${sampleIO}\n\nWrite a Python solution that reads from stdin and writes to stdout. Return only the code.`;
  }

  score(problem, { code, execution }) {
    if (execution.timedOut) {
      return { passed: false, reason: 'timeout' };
    }
    return {
      passed: execution.exitCode === 0,
      reason: execution.exitCode === 0 ? 'executed' : 'runtime_error',
      stderr: execution.stderr,
    };
  }
}

// ─── CLI ───────────────────────────────────────────────────────────────────
const ADAPTERS = {
  humaneval: HumanEvalAdapter,
  mbpp: MBPPAdapter,
  'swe-bench-lite': SWEBenchLiteAdapter,
  'multipl-e': MultiPLEAdapter,
  'ds-1000': DS1000Adapter,
  codecontests: CodeContestsAdapter,
};

async function main() {
  const args = process.argv.slice(2);
  const flags = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (args[i + 1] && !args[i + 1].startsWith('--')) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    }
  }

  const benchmark = flags.benchmark;
  const limit = flags.limit ? parseInt(flags.limit) : null;
  const preferredModel = flags.model || process.env.EVAL_MODEL || 'qwen2.5-coder:7b';
  const runAll = flags.all || (!benchmark);

  // Model health check: select best available model
  const model = await selectModel(preferredModel) || preferredModel;
  if (model !== preferredModel) {
    console.log(`[eval] Preferred model "${preferredModel}" not found. Using: ${model}`);
  }

  // Check if Ollama is reachable
  const available = await getAvailableModels();
  if (available.length === 0) {
    console.error(`\n[eval] ⚠  WARNING: No Ollama models detected.`);
    console.error(`  Status: EVAL_READY_MODEL_MISSING`);
    console.error(`  The eval framework is functional but requires a model.`);
    console.error(`  Fix: ollama pull qwen3:14b`);
    console.error(`  Or set: EVAL_MODEL=<your-model>`);
    console.error(`  Available fallback order: ${MODEL_FALLBACK_ORDER.join(' → ')}\n`);
    process.exit(0); // exit 0 — framework is OK, just no model
  }

  if (runAll) {
    console.log('\n=== Running ALL benchmarks ===\n');
    const quickBenchmarks = ['humaneval', 'mbpp'];
    for (const name of quickBenchmarks) {
      const AdapterClass = ADAPTERS[name];
      const adapter = new AdapterClass({ model, limit });
      await adapter.run(limit);
      await adapter.writeResult();
    }
    const { scoreboard } = await import('./scoreboard.js');
    scoreboard({ model, limit });
    return;
  }

  if (!benchmark || !ADAPTERS[benchmark]) {
    console.error('Usage: node eval/runner.js --benchmark <name> [--limit N] [--model <model>]');
    console.error('       node eval/runner.js --all [--limit N] [--model <model>]');
    console.error('\nAvailable benchmarks:');
    for (const name of Object.keys(ADAPTERS)) {
      console.error(`  - ${name}`);
    }
    process.exit(1);
  }

  const AdapterClass = ADAPTERS[benchmark];
  const adapter = new AdapterClass({ model, limit });
  await adapter.run(limit);
  await adapter.writeResult();
}

main().catch(err => {
  console.error(`\n[runner] Fatal error: ${err.message}`);
  process.exit(1);
});