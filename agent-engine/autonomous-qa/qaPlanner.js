// autonomous-qa/qaPlanner.js — plans autonomous QA runs based on project and changed files
// Phase 14: weights: Stability 25%, UX 20%, Core Flow 20%, Role Coverage 15%, Security 10%, Perf 5%, Docs 5%

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const QA_WEIGHTS = {
  stability:     0.25,
  ux:            0.20,
  coreFlow:      0.20,
  roleCoverage:  0.15,
  security:      0.10,
  performance:   0.05,
  documentation: 0.05,
};

const QA_CHECKS = [
  { id: 'unit-tests',     category: 'stability',     label: 'Unit Tests',           estimateMs: 30_000 },
  { id: 'integration',    category: 'coreFlow',      label: 'Integration Tests',    estimateMs: 60_000 },
  { id: 'e2e',            category: 'ux',            label: 'E2E Smoke Tests',      estimateMs: 120_000 },
  { id: 'accessibility',  category: 'ux',            label: 'Accessibility Scan',   estimateMs: 10_000 },
  { id: 'seo',            category: 'documentation', label: 'SEO Analysis',         estimateMs: 5_000  },
  { id: 'security-scan',  category: 'security',      label: 'Security Pattern Scan',estimateMs: 15_000 },
  { id: 'perf-budget',    category: 'performance',   label: 'Performance Budget',   estimateMs: 20_000 },
  { id: 'role-coverage',  category: 'roleCoverage',  label: 'Role Test Coverage',   estimateMs: 20_000 },
  { id: 'lint',           category: 'stability',     label: 'Lint / Static Analysis',estimateMs: 10_000 },
  { id: 'visual-regression', category: 'ux',         label: 'Visual Regression',    estimateMs: 30_000 },
];

/**
 * Plan a QA run based on project root and changed files.
 * @param {string} projectRoot
 * @param {string[]} changedFiles
 * @param {{ skipCategories?: string[], onlyCategories?: string[] }} options
 * @returns {{ checks: object[], estimatedTotalMs: number, categories: string[] }}
 */
export function planQARun(projectRoot, changedFiles = [], options = {}) {
  const { skipCategories = [], onlyCategories = null } = options;

  const riskMap = buildRiskMap(changedFiles);
  let checks    = [...QA_CHECKS];

  // Filter by options
  if (onlyCategories) checks = checks.filter(c => onlyCategories.includes(c.category));
  checks = checks.filter(c => !skipCategories.includes(c.category));

  // Check which test tools are available
  const hasTestScript = hasScript(projectRoot, 'test');
  const hasBuildScript = hasScript(projectRoot, 'build');
  const hasLintScript  = hasScript(projectRoot, 'lint');
  const hasBuildDir    = existsSync(join(projectRoot, 'dist')) || existsSync(join(projectRoot, 'build')) || existsSync(join(projectRoot, '.next'));

  // Mark checks as enabled/disabled based on availability
  checks = checks.map(c => ({
    ...c,
    enabled: isCheckEnabled(c.id, { hasTestScript, hasBuildScript, hasLintScript, hasBuildDir }),
    priority: riskMap[c.category] ?? 'normal',
  }));

  return prioritizeChecks(checks, riskMap);
}

/**
 * Sort checks by risk priority.
 * @param {object[]} checks
 * @param {object} riskMap  category → priority
 * @returns {{ checks: object[], estimatedTotalMs: number, categories: string[] }}
 */
export function prioritizeChecks(checks, riskMap) {
  const ORDER = { high: 0, elevated: 1, normal: 2 };
  const sorted = [...checks].sort((a, b) => (ORDER[a.priority] ?? 2) - (ORDER[b.priority] ?? 2));
  const estimatedTotalMs = sorted.filter(c => c.enabled).reduce((s, c) => s + c.estimateMs, 0);
  const categories = [...new Set(sorted.map(c => c.category))];
  return { checks: sorted, estimatedTotalMs, categories };
}

/**
 * Estimate total QA time in human-readable form.
 * @param {{ estimatedTotalMs: number }} plan
 * @returns {string}
 */
export function estimateQATime(plan) {
  const ms  = plan.estimatedTotalMs ?? 0;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

/**
 * Generate a QA report from results.
 * @param {Array<{ checkId: string, category: string, passed: boolean, score?: number, message?: string }>} results
 * @returns {{ score: number, breakdown: object, passed: number, failed: number }}
 */
export function generateQAReport(results) {
  const byCategory = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  }

  const breakdown = {};
  let compositeScore = 0;

  for (const [cat, weight] of Object.entries(QA_WEIGHTS)) {
    const catResults = byCategory[cat] ?? [];
    if (catResults.length === 0) {
      breakdown[cat] = { score: 100, weight, contribution: weight * 100 };
      compositeScore += weight * 100;
    } else {
      const catScore = catResults.reduce((s, r) => s + (r.score ?? (r.passed ? 100 : 0)), 0) / catResults.length;
      breakdown[cat] = { score: Math.round(catScore), weight, contribution: +(weight * catScore).toFixed(1) };
      compositeScore += weight * catScore;
    }
  }

  return {
    score:    Math.round(compositeScore),
    breakdown,
    passed:   results.filter(r => r.passed).length,
    failed:   results.filter(r => !r.passed).length,
    total:    results.length,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hasScript(projectRoot, scriptName) {
  try {
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
    return !!(pkg.scripts?.[scriptName]);
  } catch { return false; }
}

function buildRiskMap(changedFiles) {
  const riskMap = {};
  const AUTH_RE = /auth|login|password|token/i;
  const UX_RE   = /component|page|view|style|css/i;
  const SEC_RE  = /security|permission|acl|policy/i;

  for (const f of changedFiles) {
    if (AUTH_RE.test(f)) { riskMap.security = 'high'; riskMap.coreFlow = 'high'; }
    if (UX_RE.test(f))   { riskMap.ux = 'elevated'; }
    if (SEC_RE.test(f))  { riskMap.security = 'high'; }
  }

  return riskMap;
}

function isCheckEnabled(checkId, flags) {
  switch (checkId) {
    case 'unit-tests':        return flags.hasTestScript;
    case 'lint':              return flags.hasLintScript;
    case 'e2e':               return flags.hasTestScript;
    case 'seo':               return flags.hasBuildDir;
    case 'accessibility':     return flags.hasBuildDir;
    case 'visual-regression': return flags.hasBuildDir;
    default:                  return true;
  }
}
