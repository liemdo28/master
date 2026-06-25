/**
 * Phase 34E — Code Review Engine
 * Evaluates code submissions before they can proceed to testing.
 * Score < 80 → REJECTED. Score >= 80 → passes to test orchestrator.
 */

export interface ReviewCheck {
  name: string;
  passed: boolean;
  score: number;    // 0-20 each (5 checks × 20 = 100)
  detail: string;
}

export interface ReviewResult {
  task_id: string;
  total_score: number;
  passed: boolean;   // score >= 80
  checks: ReviewCheck[];
  blockers: string[];
  suggestions: string[];
  reviewed_at: string;
}

const SECURITY_PATTERNS = [
  { pattern: /eval\s*\(/, label: 'eval() usage' },
  { pattern: /exec\s*\(/, label: 'exec() usage' },
  { pattern: /child_process/, label: 'child_process without sanitization' },
  { pattern: /sql\s*\+\s*['"a-z$]/i, label: 'potential SQL concatenation' },
  { pattern: /password\s*=\s*['"][^'"]{1,20}['"]/i, label: 'hardcoded password' },
  { pattern: /api_?key\s*=\s*['"][^'"]+['"]/i, label: 'hardcoded API key' },
  { pattern: /innerHTML\s*=/, label: 'innerHTML assignment (XSS risk)' },
];

const PERFORMANCE_PATTERNS = [
  { pattern: /for\s*\(.*\.length.*\)/s, label: 'array.length in loop condition' },
  { pattern: /console\.(log|debug|info)\s*\(/, label: 'console.log left in code' },
  { pattern: /await\s+Promise\.all\(\[[\s\S]*?\]\)/s, label: 'good: parallel awaits' },
  { pattern: /SELECT\s+\*/i, label: 'SELECT * query' },
];

const ARCHITECTURE_PATTERNS = [
  { pattern: /require\s*\(\s*['"]\.\.\/\.\.\/\.\.\//, label: 'deep relative import (>3 levels)' },
  { pattern: /any\s*[;,)\]>]/, label: 'TypeScript any usage' },
  { pattern: /\/\/ TODO/i, label: 'unresolved TODO' },
  { pattern: /\/\/ HACK/i, label: 'HACK comment' },
  { pattern: /\/\/ FIXME/i, label: 'FIXME comment' },
];

function checkSyntax(code: string): ReviewCheck {
  const issues: string[] = [];
  if ((code.match(/\{/g) || []).length !== (code.match(/\}/g) || []).length) {
    issues.push('Unbalanced braces');
  }
  if ((code.match(/\(/g) || []).length !== (code.match(/\)/g) || []).length) {
    issues.push('Unbalanced parentheses');
  }
  if (code.includes('import ') && code.includes('require(')) {
    issues.push('Mixed ES modules and CommonJS');
  }
  const score = issues.length === 0 ? 20 : Math.max(0, 20 - issues.length * 8);
  return { name: 'Syntax', passed: issues.length === 0, score, detail: issues.join('; ') || 'OK' };
}

function checkSecurity(code: string): ReviewCheck {
  const hits = SECURITY_PATTERNS.filter(p => p.pattern.test(code));
  const blockers = hits.filter(h => ['hardcoded password', 'hardcoded API key', 'SQL concatenation'].some(b => h.label.includes(b)));
  const score = Math.max(0, 20 - hits.length * 5);
  return {
    name:   'Security',
    passed: blockers.length === 0 && score >= 10,
    score,
    detail: hits.length ? hits.map(h => h.label).join(', ') : 'No security issues found',
  };
}

function checkPerformance(code: string): ReviewCheck {
  const issues: string[] = [];
  if (/console\.(log|debug)\s*\(/.test(code)) issues.push('console.log in production code');
  if (/SELECT\s+\*/i.test(code))              issues.push('SELECT * query');
  if (/for\s*\(.*\.length/.test(code))        issues.push('array.length in loop condition');
  const score = Math.max(0, 20 - issues.length * 5);
  return { name: 'Performance', passed: score >= 10, score, detail: issues.join(', ') || 'OK' };
}

function checkRegression(code: string, priorCode?: string): ReviewCheck {
  const issues: string[] = [];
  if (!priorCode) {
    if (!code.includes('test(') && !code.includes('describe(') && !code.includes('expect(')) {
      issues.push('No test code found — ensure tests cover changed code');
    }
  } else {
    const removedExports = (priorCode.match(/^export\s+/gm) || []).length -
                           (code.match(/^export\s+/gm) || []).length;
    if (removedExports > 0) issues.push(`${removedExports} exports removed — check consumers`);
  }
  const score = issues.length === 0 ? 20 : 12;
  return { name: 'Regression', passed: issues.length === 0, score, detail: issues.join(', ') || 'OK' };
}

function checkArchitecture(code: string): ReviewCheck {
  const hits = ARCHITECTURE_PATTERNS.filter(p => p.pattern.test(code));
  const score = Math.max(0, 20 - hits.length * 4);
  return {
    name:   'Architecture',
    passed: score >= 12,
    score,
    detail: hits.length ? hits.map(h => h.label).join(', ') : 'OK',
  };
}

export function reviewCode(taskId: string, code: string, priorCode?: string): ReviewResult {
  const checks = [
    checkSyntax(code),
    checkSecurity(code),
    checkPerformance(code),
    checkRegression(code, priorCode),
    checkArchitecture(code),
  ];

  const total_score = checks.reduce((sum, c) => sum + c.score, 0);
  const passed      = total_score >= 80;

  const blockers    = checks.filter(c =