/**
 * Executive Decision Engine — Phase 21F
 * Prioritizes issues and recommends decisions based on multi-factor impact analysis.
 *
 * Receives a list of issues/signals and ranks them by:
 * - Revenue impact
 * - Operational impact
 * - Customer impact
 * - Compliance impact
 * - Strategic alignment
 *
 * Produces an actionable priority matrix for CEO.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';
export type ImpactDimension = 'revenue' | 'operational' | 'customer' | 'compliance' | 'strategic' | 'technical' | 'reputational';

export interface ImpactScore {
  dimension: ImpactDimension;
  score: number;         // 0.0 – 1.0
  reasoning: string;
}

export interface DecisionIssue {
  id: string;
  title: string;
  description: string;
  category: string;
  impacts: ImpactScore[];
  time_sensitivity: 'immediate' | 'this_week' | 'this_month' | 'whenever';
  reversible: boolean;
  estimated_effort: 'trivial' | 'small' | 'medium' | 'large' | 'massive';
  data_confidence: number;  // 0.0 – 1.0
}

export interface PrioritizedIssue {
  issue: DecisionIssue;
  composite_score: number;   // 0.0 – 1.0
  priority: PriorityLevel;
  rank: number;
  reasoning: string;
  recommended_approach: string;
}

export interface DecisionMatrix {
  input_count: number;
  prioritized: PrioritizedIssue[];
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  summary: string;
  recommended_ceo_focus: string[];
  generated_at: string;
}

// ── Impact dimension weights ───────────────────────────────────────────────────

const DIMENSION_WEIGHTS: Record<ImpactDimension, number> = {
  revenue: 0.25,
  operational: 0.20,
  customer: 0.20,
  compliance: 0.15,
  strategic: 0.10,
  technical: 0.05,
  reputational: 0.05,
};

const TIME_SENSITIVITY_MULTIPLIER: Record<DecisionIssue['time_sensitivity'], number> = {
  immediate: 1.5,
  this_week: 1.2,
  this_month: 1.0,
  whenever: 0.8,
};

const EFFORT_PENALTY: Record<DecisionIssue['estimated_effort'], number> = {
  trivial: 0.0,
  small: 0.05,
  medium: 0.10,
  large: 0.20,
  massive: 0.35,
};

// ── Scoring functions ──────────────────────────────────────────────────────────

function computeCompositeScore(issue: DecisionIssue): number {
  // Weighted sum of impact scores
  let weightedSum = 0;
  let totalWeight = 0;

  for (const impact of issue.impacts) {
    const weight = DIMENSION_WEIGHTS[impact.dimension] || 0.05;
    weightedSum += impact.score * weight;
    totalWeight += weight;
  }

  let base = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

  // Apply time sensitivity multiplier
  base *= TIME_SENSITIVITY_MULTIPLIER[issue.time_sensitivity];

  // Apply effort penalty (easier = slightly more likely to recommend)
  base *= (1 - EFFORT_PENALTY[issue.estimated_effort]);

  // Apply confidence adjustment
  base *= issue.data_confidence;

  // Apply reversibility bonus (reversible decisions are safer to act on)
  if (issue.reversible) base *= 1.1;

  return Math.min(1.0, Math.max(0.0, base));
}

function scoreToPriority(score: number): PriorityLevel {
  if (score >= 0.7) return 'critical';
  if (score >= 0.5) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

function generateRecommendation(issue: DecisionIssue, priority: PriorityLevel): string {
  if (priority === 'critical') {
    return `🔴 CRITICAL — Cần CEO xử lý ngay. ${issue.reversible ? '(Reversible - safe to act)' : '(Irreversible - confirm before acting)'}`;
  }
  if (priority === 'high') {
    return `🟠 HIGH — Nên xử lý trong tuần này. Effort: ${issue.estimated_effort}`;
  }
  if (priority === 'medium') {
    return `🟡 MEDIUM — Lên lịch xử lý trong tháng. Có thể giao cho bộ phận.`;
  }
  return `🟢 LOW — Xử lý khi rảnh, hoặc delegate.`;
}

// ── Engine ─────────────────────────────────────────────────────────────────────

export function prioritizeIssues(issues: DecisionIssue[]): DecisionMatrix {
  const scored = issues.map(issue => {
    const composite = computeCompositeScore(issue);
    return {
      issue,
      composite_score: composite,
      priority: scoreToPriority(composite),
      rank: 0,
      reasoning: generateIssueReasoning(issue, composite),
      recommended_approach: generateRecommendation(issue, scoreToPriority(composite)),
    };
  });

  // Sort by composite score descending
  scored.sort((a, b) => b.composite_score - a.composite_score);

  // Assign ranks
  scored.forEach((item, idx) => { item.rank = idx + 1; });

  const critical = scored.filter(s => s.priority === 'critical');
  const high = scored.filter(s => s.priority === 'high');
  const medium = scored.filter(s => s.priority === 'medium');
  const low = scored.filter(s => s.priority === 'low');

  // CEO focus = critical + high
  const ceoFocus = [...critical, ...high].slice(0, 5).map(s => s.recommended_approach);

  const summary = [
    `📊 Decision Matrix: ${issues.length} issues analyzed`,
    `🔴 Critical: ${critical.length} | 🟠 High: ${high.length} | 🟡 Medium: ${medium.length} | 🟢 Low: ${low.length}`,
    critical.length > 0
      ? `⚠️ ${critical.length} critical issue(s) require immediate CEO attention`
      : '✅ No critical issues detected',
  ].join('\n');

  return {
    input_count: issues.length,
    prioritized: scored,
    critical_count: critical.length,
    high_count: high.length,
    medium_count: medium.length,
    low_count: low.length,
    summary,
    recommended_ceo_focus: ceoFocus,
    generated_at: new Date().toISOString(),
  };
}

function generateIssueReasoning(issue: DecisionIssue, score: number): string {
  const topImpacts = issue.impacts
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(i => `${i.dimension} (${Math.round(i.score * 100)}%)`)
    .join(', ');

  return `Composite: ${Math.round(score * 100)}% — Top impacts: ${topImpacts} — Time: ${issue.time_sensitivity}`;
}

// ── Quick helper: create issue from description ────────────────────────────────

export function createIssueFromDescription(
  title: string,
  description: string,
  category: string,
  impactOverrides: Partial<Record<ImpactDimension, number>> = {},
): DecisionIssue {
  const impacts: ImpactScore[] = (Object.keys(DIMENSION_WEIGHTS) as ImpactDimension[]).map(dim => ({
    dimension: dim,
    score: impactOverrides[dim] ?? 0.3, // default moderate
    reasoning: `Default score for ${dim}`,
  }));

  return {
    id: `issue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    description,
    category,
    impacts,
    time_sensitivity: 'this_week',
    reversible: true,
    estimated_effort: 'medium',
    data_confidence: 0.6,
  };
}

// ── Format for CEO ─────────────────────────────────────────────────────────────

export function formatDecisionMatrix(matrix: DecisionMatrix): string {
  const lines: string[] = [
    '🎯 *Decision Matrix — Prioritized Issues*',
    '',
    matrix.summary,
    '',
    '---',
    '',
  ];

  for (const item of matrix.prioritized.slice(0, 10)) {
    const icon = item.priority === 'critical' ? '🔴' : item.priority === 'high' ? '🟠' : item.priority === 'medium' ? '🟡' : '🟢';
    lines.push(`${icon} *#${item.rank} ${item.issue.title}*`);
    lines.push(`  Score: ${Math.round(item.composite_score * 100)}% | ${item.issue.category}`);
    lines.push(`  ${item.reasoning}`);
    lines.push(`  → ${item.recommended_approach}`);
    lines.push('');
  }

  if (matrix.recommended_ceo_focus.length > 0) {
    lines.push('*CEO Focus Areas:*');
    for (const focus of matrix.recommended_ceo_focus) {
      lines.push(`• ${focus}`);
    }
  }

  return lines.join('\n');
}
