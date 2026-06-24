/**
 * Phase 25A — Intent Analyzer
 * Parses CEO natural language objective into structured IntentAnalysis.
 */

import type { IntentAnalysis, IntentCategory } from './types';

// ── Keyword → Intent Category mapping ────────────────────────────────────────

const INTENT_PATTERNS: { pattern: RegExp; category: IntentCategory; actionVerb: string }[] = [
  { pattern: /increase\s+.*?(organic\s+)?traffic/i,       category: 'traffic-growth',          actionVerb: 'increase' },
  { pattern: /grow\s+.*?traffic/i,                         category: 'traffic-growth',          actionVerb: 'grow' },
  { pattern: /boost\s+.*?(organic\s+)?traffic/i,           category: 'traffic-growth',          actionVerb: 'boost' },
  { pattern: /improve\s+rankings?/i,                       category: 'traffic-growth',          actionVerb: 'improve' },
  { pattern: /rank\s+(higher|better|#1|first)/i,           category: 'traffic-growth',          actionVerb: 'rank' },
  { pattern: /increase\s+revenue/i,                        category: 'revenue-growth',          actionVerb: 'increase' },
  { pattern: /grow\s+revenue/i,                            category: 'revenue-growth',          actionVerb: 'grow' },
  { pattern: /increase\s+sales/i,                          category: 'revenue-growth',          actionVerb: 'increase' },
  { pattern: /expand\s+(brand|locations?)/i,               category: 'brand-expansion',         actionVerb: 'expand' },
  { pattern: /improve\s+(reviews?|ratings?)/i,             category: 'customer-experience',     actionVerb: 'improve' },
  { pattern: /reduce\s+(cost|waste|errors?)/i,             category: 'operational-optimization', actionVerb: 'reduce' },
  { pattern: /optimize\s+(operations?|process)/i,          category: 'operational-optimization', actionVerb: 'optimize' },
  { pattern: /fix\s+(website|site|blog|404|error)/i,       category: 'technology-upgrade',      actionVerb: 'fix' },
  { pattern: /audit\s+(seo|site|technical|schema)/i,       category: 'traffic-growth',          actionVerb: 'audit' },
  { pattern: /ensure\s+compliance/i,                       category: 'compliance',              actionVerb: 'ensure' },
  { pattern: /improve\s+(conversion|ux)/i,                 category: 'customer-experience',     actionVerb: 'improve' },
];

// ── Metric extraction patterns ───────────────────────────────────────────────

const METRIC_PATTERNS = [
  { pattern: /(\d+)%\s*(increase|boost|grow|more)/i,                    metric: 'percentage', extract: (m: RegExpMatchArray) => parseInt(m[1]) },
  { pattern: /increase\s+\w*\s*(by\s+)?(\d+)%/i,                       metric: 'percentage', extract: (m: RegExpMatchArray) => parseInt(m[2]) },
  { pattern: /(\d+)\s*(percent|pct)/i,                                  metric: 'percentage', extract: (m: RegExpMatchArray) => parseInt(m[1]) },
  { pattern: /by\s+(\d+)%/i,                                            metric: 'percentage', extract: (m: RegExpMatchArray) => parseInt(m[1]) },
];

// ── Entity extraction ────────────────────────────────────────────────────────

const KNOWN_ENTITIES = [
  { name: 'Bakudan', patterns: [/bakudan/i] },
  { name: 'Bakudan Ramen', patterns: [/bakudan\s*ramen/i] },
];

const TIMEFRAME_PATTERNS = [
  { pattern: /in\s+(\d+)\s+weeks?/i,         extract: (m: RegExpMatchArray) => parseInt(m[1]) * 7 },
  { pattern: /in\s+(\d+)\s+months?/i,         extract: (m: RegExpMatchArray) => parseInt(m[1]) * 30 },
  { pattern: /within\s+(\d+)\s+days?/i,       extract: (m: RegExpMatchArray) => parseInt(m[1]) },
  { pattern: /by\s+(end\s+of\s+)?month/i,     extract: () => 30 },
  { pattern: /this\s+quarter/i,                extract: () => 90 },
  { pattern: /weekly/i,                        extract: () => 7 },
  { pattern: /monthly/i,                       extract: () => 30 },
];

// ── Main function ────────────────────────────────────────────────────────────

export function analyzeIntent(objective: string): IntentAnalysis {
  const normalizedObjective = objective.toLowerCase().trim();

  // Classify intent category
  let category: IntentCategory = 'operational-optimization';
  let actionVerb = 'execute';
  for (const { pattern, category: cat, actionVerb: verb } of INTENT_PATTERNS) {
    if (pattern.test(normalizedObjective)) {
      category = cat;
      actionVerb = verb;
      break;
    }
  }

  // Extract business entity
  let businessEntity = 'company';
  for (const entity of KNOWN_ENTITIES) {
    if (entity.patterns.some(p => p.test(normalizedObjective))) {
      businessEntity = entity.name;
      break;
    }
  }

  // Extract target metric
  let targetMetric = 'unknown';
  if (/traffic/i.test(normalizedObjective))        targetMetric = 'organic-traffic';
  else if (/revenue/i.test(normalizedObjective))    targetMetric = 'revenue';
  else if (/sales/i.test(normalizedObjective))      targetMetric = 'sales';
  else if (/ranking/i.test(normalizedObjective))    targetMetric = 'keyword-rankings';
  else if (/reviews?/i.test(normalizedObjective))   targetMetric = 'review-count';
  else if (/rating/i.test(normalizedObjective))     targetMetric = 'average-rating';
  else if (/conversion/i.test(normalizedObjective)) targetMetric = 'conversion-rate';

  // Extract target value
  let targetValue: number | null = null;
  for (const { pattern, metric, extract } of METRIC_PATTERNS) {
    const match = normalizedObjective.match(pattern);
    if (match) {
      targetValue = extract(match);
      break;
    }
  }

  // Extract timeframe
  let timeframe: string | null = null;
  for (const { pattern, extract } of TIMEFRAME_PATTERNS) {
    const match = normalizedObjective.match(pattern);
    if (match) {
      const days = extract(match);
      timeframe = `${days} days`;
      break;
    }
  }
  if (!timeframe) timeframe = '30 days'; // default

  // Compute confidence
  let confidence = 0.5;
  if (targetValue !== null)      confidence += 0.2;
  if (businessEntity !== 'company') confidence += 0.1;
  if (timeframe !== '30 days')   confidence += 0.1;
  if (category !== 'operational-optimization') confidence += 0.1;

  return {
    rawObjective: objective,
    normalizedObjective,
    category,
    businessEntity,
    actionVerb,
    targetMetric,
    targetValue,
    timeframe,
    confidence: Math.min(confidence, 1.0),
  };
}
