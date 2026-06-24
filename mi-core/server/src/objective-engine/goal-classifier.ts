/**
 * Phase 25A — Goal Classifier
 * Converts IntentAnalysis into a structured Goal (quantitative/qualitative/binary).
 */

import type { Goal, IntentAnalysis, QuantitativeGoal, QualitativeGoal, BinaryGoal } from './types';

const DEFAULT_TIMEFRAMES: Record<string, number> = {
  'traffic-growth': 30,
  'revenue-growth': 30,
  'brand-expansion': 60,
  'customer-experience': 30,
  'operational-optimization': 14,
  'risk-mitigation': 7,
  'compliance': 14,
  'technology-upgrade': 14,
};

export function classifyGoal(intent: IntentAnalysis): Goal {
  const defaultDays = DEFAULT_TIMEFRAMES[intent.category] || 30;

  // ── Quantitative: has a numeric target ───────────────────────────────────
  if (intent.targetValue !== null && intent.targetValue > 0) {
    const timeframeDays = intent.timeframe
      ? parseInt(intent.timeframe) || defaultDays
      : defaultDays;

    const quantitativeGoal: QuantitativeGoal = {
      type: 'quantitative',
      metric: intent.targetMetric,
      currentBaseline: 0, // will be populated by execution orchestrator
      targetValue: intent.targetValue,
      unit: intent.targetMetric === 'organic-traffic' ? '%-increase' : 'units',
      timeframeDays,
    };
    return quantitativeGoal;
  }

  // ── Binary: "fix X", "ensure Y", "audit Z" — success or not ────────────
  if (['fix', 'ensure', 'audit', 'deploy', 'launch', 'create'].includes(intent.actionVerb)) {
    const binaryGoal: BinaryGoal = {
      type: 'binary',
      description: intent.rawObjective,
      successCondition: `${intent.actionVerb} completed and verified`,
    };
    return binaryGoal;
  }

  // ── Qualitative: "improve X", "grow Y" without specific target ──────────
  const timeframeDays = intent.timeframe
    ? parseInt(intent.timeframe) || defaultDays
    : defaultDays;

  const qualitativeGoal: QualitativeGoal = {
    type: 'qualitative',
    metric: intent.targetMetric,
    currentState: 'baseline-pending',
    targetState: `${intent.actionVerb} ${intent.targetMetric}`,
    timeframeDays,
  };
  return qualitativeGoal;
}
