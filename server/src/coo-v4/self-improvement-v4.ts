/**
 * Domain X — Self-Improvement Engine V4
 * Detects: bad skills, slow skills, failed workflows, repeated errors.
 * Recommends upgrades. Writes improvement reports.
 */

import fs   from 'fs';
import path from 'path';
import { getAllSkills, getSkillStats } from './skill-marketplace';
import { listWorkflows } from './durable-workflow';

const GLOBAL_DIR = process.env.MI_CORE_ROOT
  ? path.join(process.env.MI_CORE_ROOT, '.local-agent-global')
  : 'E:/Project/Master/.local-agent-global';
const REPORT_DIR = path.join(GLOBAL_DIR, 'coo-v4', 'self-improvement');

export interface ImprovementFinding {
  type:           'bad_skill' | 'slow_skill' | 'failed_workflow' | 'repeated_error' | 'missing_skill' | 'upgrade_opportunity';
  severity:       'low' | 'medium' | 'high';
  target:         string;
  description:    string;
  recommendation: string;
  data:           Record<string, unknown>;
}

export interface ImprovementReport {
  generated_at:    string;
  period_days:     number;
  score:           number;   // 0-100, higher = better
  findings:        ImprovementFinding[];
  top_improvements:string[];
  skills_upgraded: number;
  workflows_fixed: number;
}

// ── Detection functions ────────────────────────────────────────────────────

function detectBadSkills(): ImprovementFinding[] {
  const skills = getAllSkills();
  const findings: ImprovementFinding[] = [];

  for (const skill of skills) {
    if (skill.executions < 5) continue; // need data
    const failure_rate = skill.failures / skill.executions;

    if (failure_rate > 0.5) {
      findings.push({
        type: 'bad_skill',
        severity: 'high',
        target: skill.id,
        description: `Skill "${skill.name}" has ${Math.round(failure_rate * 100)}% failure rate (${skill.failures}/${skill.executions})`,
        recommendation: `Disable or replace ${skill.id}. Consider upgrading to v${skill.version} + 1 with better error handling.`,
        data: { skill_id: skill.id, failure_rate, executions: skill.executions, failures: skill.failures },
      });
    } else if (failure_rate > 0.2) {
      findings.push({
        type: 'bad_skill',
        severity: 'medium',
        target: skill.id,
        description: `Skill "${skill.name}" has elevated failure rate: ${Math.round(failure_rate * 100)}%`,
        recommendation: `Review skill inputs and add better validation. Current trust score: ${skill.trust_score}`,
        data: { skill_id: skill.id, failure_rate },
      });
    }
  }
  return findings;
}

function detectSlowSkills(): ImprovementFinding[] {
  const skills = getAllSkills();
  const findings: ImprovementFinding[] = [];

  // Define expected durations per agent type
  const SLOW_THRESHOLDS_MS: Record<string, number> = {
    ai_developer:   30_000,
    browser:        15_000,
    workspace:       5_000,
    marketing:      60_000,
    social:         10_000,
    website:         8_000,
    bookkeeper:      3_000,
    accountant:      5_000,
    cfo:             5_000,
    tax:            10_000,
    council:         2_000,
    code_reviewer:  20_000,
    code_gate:      10_000,
  };

  for (const skill of skills) {
    if (skill.executions < 3 || skill.avg_duration_ms === 0) continue;
    const threshold = SLOW_THRESHOLDS_MS[skill.agent] || 30_000;
    if (skill.avg_duration_ms > threshold * 2) {
      findings.push({
        type: 'slow_skill',
        severity: skill.avg_duration_ms > threshold * 5 ? 'high' : 'medium',
        target: skill.id,
        description: `Skill "${skill.name}" averages ${Math.round(skill.avg_duration_ms / 1000)}s (expected <${threshold / 1000}s)`,
        recommendation: `Optimize ${skill.id}: add caching, reduce API calls, or increase parallelism.`,
        data: { skill_id: skill.id, avg_ms: skill.avg_duration_ms, threshold_ms: threshold },
      });
    }
  }
  return findings;
}

function detectFailedWorkflows(): ImprovementFinding[] {
  const findings: ImprovementFinding[] = [];
  try {
    const failed = listWorkflows('failed', 20);
    if (failed.length > 3) {
      findings.push({
        type: 'failed_workflow',
        severity: failed.length > 10 ? 'high' : 'medium',
        target: 'workflow_engine',
        description: `${failed.length} failed workflows detected in recent history`,
        recommendation: 'Review failed workflows, add retry logic, improve step error handling.',
        data: { count: failed.length, recent: failed.slice(0, 3).map(w => w.id) },
      });
    }
  } catch { /* db may not exist yet */ }
  return findings;
}

function detectMissingSkills(): ImprovementFinding[] {
  const findings: ImprovementFinding[] = [];
  const stats = getSkillStats();

  // Agents with no skills registered
  const ALL_AGENTS = ['ai_developer', 'browser', 'workspace', 'bookkeeper', 'accountant', 'cfo', 'tax', 'marketing', 'website', 'social'];
  for (const agent of ALL_AGENTS) {
    if (!stats.by_agent[agent] || stats.by_agent[agent] === 0) {
      findings.push({
        type: 'missing_skill',
        severity: 'low',
        target: agent,
        description: `Agent "${agent}" has no registered skills`,
        recommendation: `Register skills for ${agent} in skill-marketplace.ts`,
        data: { agent },
      });
    }
  }
  return findings;
}

function detectUpgradeOpportunities(): ImprovementFinding[] {
  const findings: ImprovementFinding[] = [];
  const skills = getAllSkills();

  // Skills with high usage and old versions
  for (const skill of skills) {
    if (skill.executions > 20 && skill.version === '1.0' && skill.trust_score > 80) {
      findings.push({
        type: 'upgrade_opportunity',
        severity: 'low',
        target: skill.id,
        description: `Skill "${skill.name}" has ${skill.executions} executions and is stable — ready for v2.0 with extended capabilities`,
        recommendation: `Upgrade ${skill.id} to v2.0: add streaming, better error messages, timeout handling.`,
        data: { skill_id: skill.id, executions: skill.executions, trust_score: skill.trust_score },
      });
    }
  }
  return findings;
}

// ── Score calculation ──────────────────────────────────────────────────────

function calculateScore(findings: ImprovementFinding[]): number {
  const penalties = { high: 15, medium: 7, low: 3 };
  const total = findings.reduce((p, f) => p + (penalties[f.severity] || 0), 0);
  return Math.max(0, 100 - total);
}

// ── Main report ────────────────────────────────────────────────────────────

export function generateSelfImprovementReportV4(periodDays = 30): ImprovementReport {
  const findings: ImprovementFinding[] = [
    ...detectBadSkills(),
    ...detectSlowSkills(),
    ...detectFailedWorkflows(),
    ...detectMissingSkills(),
    ...detectUpgradeOpportunities(),
  ];

  // Sort by severity
  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  const score = calculateScore(findings);
  const top_improvements = findings.slice(0, 5).map(f => f.recommendation);

  const report: ImprovementReport = {
    generated_at:    new Date().toISOString(),
    period_days:     periodDays,
    score,
    findings,
    top_improvements,
    skills_upgraded: 0,
    workflows_fixed: 0,
  };

  // Save report
  try {
    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(REPORT_DIR, `report_${Date.now()}.json`),
      JSON.stringify(report, null, 2),
    );
  } catch { /* non-critical */ }

  return report;
}

export function formatSelfImprovementReport(report: ImprovementReport): string {
  const scoreIcon = report.score >= 80 ? '🟢' : report.score >= 60 ? '🟡' : '🔴';
  const lines = [
    `🔄 *Self-Improvement V4*`,
    ``,
    `${scoreIcon} Score: ${report.score}/100`,
    `📊 ${report.findings.length} findings — ${report.findings.filter(f => f.severity === 'high').length} critical`,
    ``,
    report.findings.length === 0 ? '✅ Hệ thống hoạt động tốt — không có cải tiến cấp bách.' : '',
    ...report.top_improvements.slice(0, 3).map(imp => `• ${imp.slice(0, 80)}`),
  ].filter(l => l !== undefined);
  return lines.join('\n');
}

// ── Auto-apply safe improvements ───────────────────────────────────────────

export function autoApplyImprovements(report: ImprovementReport): string[] {
  const applied: string[] = [];

  // Only auto-disable skills with >80% failure rate
  for (const finding of report.findings) {
    if (finding.type === 'bad_skill' && finding.severity === 'high') {
      const failRate = finding.data.failure_rate as number;
      if (failRate > 0.8) {
        try {
          const { getSkill } = require('./skill-marketplace');
          const skill = getSkill(finding.target);
          if (skill) {
            skill.enabled = false;
            applied.push(`Disabled skill ${finding.target} (${Math.round(failRate * 100)}% failure rate)`);
          }
        } catch { /* ok */ }
      }
    }
  }

  return applied;
}
