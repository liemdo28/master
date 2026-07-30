/**
 * Domain D — AI Developer Agent (OpenHands-style)
 * Reads source, modifies code, runs tests, creates patches.
 * Wraps: OpenHands CLI / local dev tools.
 */

import { execSync, exec } from 'child_process';
import fs   from 'fs';
import path from 'path';
import type { AgentResult } from '../types';

const PROJECT_ROOT = process.env.MI_PROJECT_ROOT || 'E:/Project/Master';

// ── Read source ────────────────────────────────────────────────────────────

export async function readSource(filePath: string, pattern?: string): Promise<AgentResult> {
  const t0 = Date.now();
  try {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath);
    if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
    const content = fs.readFileSync(abs, 'utf8');
    const filtered = pattern
      ? content.split('\n').filter(l => new RegExp(pattern, 'i').test(l)).join('\n')
      : content;
    const summary = `${filtered.split('\n').length} lines, ${filtered.length} chars`;
    return { success: true, output: { content: filtered, summary, lines: filtered.split('\n').length }, duration_ms: Date.now() - t0, agent: 'ai_developer', metadata: { file: filePath } };
  } catch (e: any) {
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'ai_developer', metadata: {} };
  }
}

// ── Modify source ──────────────────────────────────────────────────────────

export async function modifySource(filePath: string, oldStr: string, newStr: string, reason: string): Promise<AgentResult> {
  const t0 = Date.now();
  try {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath);
    if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
    const original = fs.readFileSync(abs, 'utf8');
    if (!original.includes(oldStr)) throw new Error(`Pattern not found in ${filePath}`);
    const modified = original.replace(oldStr, newStr);
    // Backup
    fs.writeFileSync(`${abs}.bak`, original);
    fs.writeFileSync(abs, modified);
    const diff = `--- ${filePath}\n+++ ${filePath}\n-${oldStr.slice(0,200)}\n+${newStr.slice(0,200)}`;
    return { success: true, output: { diff, applied: true, backup: `${abs}.bak` }, duration_ms: Date.now() - t0, agent: 'ai_developer', metadata: { reason } };
  } catch (e: any) {
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'ai_developer', metadata: {} };
  }
}

// ── Run tests ──────────────────────────────────────────────────────────────

export async function runTests(projectPath: string, testCmd?: string): Promise<AgentResult> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const abs = path.isAbsolute(projectPath) ? projectPath : path.join(PROJECT_ROOT, projectPath);
    const cmd = testCmd || 'node tests/ceo-os-master-validation.mjs';
    exec(cmd, { cwd: abs, timeout: 120_000, env: { ...process.env } }, (err, stdout, stderr) => {
      const output = (stdout + stderr).slice(0, 5000);
      const passed = (output.match(/✅/g) || []).length;
      const failed = (output.match(/❌/g) || []).length;
      resolve({
        success: !err || failed === 0,
        output: { passed, failed, output, cmd },
        error: err?.message,
        duration_ms: Date.now() - t0,
        agent: 'ai_developer',
        metadata: { project: projectPath },
      });
    });
  });
}

// ── Create patch ───────────────────────────────────────────────────────────

export async function createPatch(description: string, files: string[]): Promise<AgentResult> {
  const t0 = Date.now();
  try {
    const patchDir = path.join(PROJECT_ROOT, 'mi-core/.local-agent-global/coo-v4/patches');
    if (!fs.existsSync(patchDir)) fs.mkdirSync(patchDir, { recursive: true });
    const patchId = `patch_${Date.now()}`;
    const patchPath = path.join(patchDir, `${patchId}.patch`);

    // Generate git diff for the specified files
    const fileArgs = files.map(f => `"${f}"`).join(' ');
    let diff = '';
    try {
      diff = execSync(`git diff HEAD -- ${fileArgs}`, { cwd: PROJECT_ROOT, encoding: 'utf8' });
    } catch {
      diff = `# Patch: ${description}\n# Files: ${files.join(', ')}\n# Generated: ${new Date().toISOString()}\n`;
    }
    fs.writeFileSync(patchPath, `# ${description}\n\n${diff}`);

    return { success: true, output: { patch_path: patchPath, patch_id: patchId, diff: diff.slice(0, 2000) }, duration_ms: Date.now() - t0, agent: 'ai_developer', metadata: { files } };
  } catch (e: any) {
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'ai_developer', metadata: {} };
  }
}

// ── Domain D + E combined: diagnose + fix bug ──────────────────────────────

export async function diagnoseBug(error: string, context: string): Promise<AgentResult> {
  const t0 = Date.now();
  // Pattern-based diagnosis — can integrate with OpenHands API when available
  const patterns: Array<{ pattern: RegExp; cause: string; fix: string }> = [
    { pattern: /cannot read propert/i, cause: 'Null/undefined access', fix: 'Add null check: if (obj?.prop)' },
    { pattern: /module not found/i, cause: 'Missing npm package or wrong import path', fix: 'Check import path or run npm install' },
    { pattern: /type.*is not assignable/i, cause: 'TypeScript type mismatch', fix: 'Check type definitions, cast with as or add type guard' },
    { pattern: /eaddrinuse/i, cause: 'Port already in use', fix: 'Kill process on that port or use different port' },
    { pattern: /sqlite.*busy/i, cause: 'SQLite database locked', fix: 'Enable WAL mode: db.pragma("journal_mode = WAL")' },
    { pattern: /enoent/i, cause: 'File or directory not found', fix: 'Check path exists, create directories with mkdir -p' },
    { pattern: /timeout/i, cause: 'Operation timed out', fix: 'Increase timeout or add retry logic' },
    { pattern: /401|unauthorized/i, cause: 'Authentication failed', fix: 'Check API key/token, refresh if expired' },
    { pattern: /429|rate limit/i, cause: 'Rate limit exceeded', fix: 'Add exponential backoff and retry logic' },
  ];

  const match = patterns.find(p => p.pattern.test(error + context));
  return {
    success: true,
    output: {
      root_cause: match?.cause || 'Unknown — requires manual inspection',
      fix_suggestion: match?.fix || `Search codebase for: ${error.slice(0, 50)}`,
      confidence: match ? 0.85 : 0.30,
    },
    duration_ms: Date.now() - t0,
    agent: 'swe_agent',
    metadata: { error: error.slice(0, 200) },
  };
}

// ── Code review (Domain F — Aider-style) ──────────────────────────────────

export async function reviewCode(filePath: string, focus?: string): Promise<AgentResult> {
  const t0 = Date.now();
  try {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath);
    if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
    const code = fs.readFileSync(abs, 'utf8');
    const findings: string[] = [];
    let score = 100;

    // Static analysis rules
    if (/console\.log/.test(code)) { findings.push('Remove console.log statements before production'); score -= 5; }
    if (/TODO|FIXME|HACK/.test(code)) { findings.push('Address TODO/FIXME/HACK comments'); score -= 3; }
    if (/require\(.*\.\.\/.*\.\.\/.*\.\.\//.test(code)) { findings.push('Deep relative imports — consider path aliases'); score -= 5; }
    if (/any\b/.test(code)) { findings.push('TypeScript: avoid excessive use of any type'); score -= 5; }
    if (code.split('\n').some(l => l.length > 200)) { findings.push('Lines exceeding 200 chars — consider breaking up'); score -= 3; }
    if (/password|secret|api.?key/i.test(code) && /=\s*["'][^"']{8,}/.test(code)) { findings.push('⚠️ Potential hardcoded secret detected'); score -= 20; }
    if (/catch\s*\(\s*\)\s*\{[\s]*\}/.test(code)) { findings.push('Empty catch block — handle or log errors'); score -= 10; }

    if (findings.length === 0) findings.push('Code looks clean — no major issues found');

    return { success: true, output: { findings, score, file: filePath, focus }, duration_ms: Date.now() - t0, agent: 'code_reviewer', metadata: {} };
  } catch (e: any) {
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'code_reviewer', metadata: {} };
  }
}

// ── Production gate (Domain G) ─────────────────────────────────────────────

export async function productionGate(code: string, language = 'typescript'): Promise<AgentResult> {
  const t0 = Date.now();
  const issues: string[] = [];
  let pass = true;

  // Security checks (OWASP Top 10)
  if (/eval\(/.test(code)) { issues.push('CRITICAL: eval() usage — code injection risk'); pass = false; }
  if (/innerHTML\s*=/.test(code)) { issues.push('HIGH: innerHTML assignment — XSS risk'); pass = false; }
  if (/exec\(.*req\.|execSync\(.*req\./.test(code)) { issues.push('CRITICAL: Command injection risk — never exec user input'); pass = false; }
  if (/SELECT.*\+.*req\.|INSERT.*\+.*req\./.test(code)) { issues.push('CRITICAL: SQL injection risk — use parameterized queries'); pass = false; }
  if (/password.*=.*req\.|secret.*=.*req\./.test(code)) { issues.push('HIGH: Credentials from request — validate carefully'); }
  // Logic checks
  if (/process\.exit/.test(code)) { issues.push('WARN: process.exit() in non-CLI code — avoid in server context'); }
  if (/throw new Error\('.*'\);/.test(code) && !/try\s*\{/.test(code)) { issues.push('INFO: Uncaught throw — ensure error handling'); }

  const severity = issues.some(i => i.startsWith('CRITICAL')) ? 'critical'
    : issues.some(i => i.startsWith('HIGH')) ? 'high'
    : issues.length > 0 ? 'medium' : 'none';

  return {
    success: pass,
    output: { pass, issues, severity, language },
    error: pass ? undefined : `Production gate failed: ${issues.length} issue(s)`,
    duration_ms: Date.now() - t0,
    agent: 'code_gate',
    metadata: { checks_run: 7 },
  };
}
