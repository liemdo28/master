/**
 * semantic-objective-classifier.ts — classify a CEO objective by meaning.
 *
 * Upgrade over keyword-only routing: scores an objective against weighted
 * concept lexicons (revenue, marketing, ops, cx, cost, hr, creative, data,
 * security) and returns a ranked, confidence-scored classification. Deterministic
 * and dependency-free (the OSS NLP substrate is governed but optional).
 */

export interface ObjectiveClass {
  primaryDomain: string;
  confidence: number; // 0..1
  ranked: Array<{ domain: string; score: number }>;
  matchedConcepts: string[];
}

const LEXICON: Record<string, string[]> = {
  revenue: ['revenue', 'sales', 'grow', 'growth', 'online', 'upsell', 'promotion', 'offer', 'profit', 'aov', 'conversion'],
  marketing: ['marketing', 'seo', 'traffic', 'campaign', 'ads', 'brand', 'social', 'reach', 'impressions', 'ctr'],
  operations: ['operation', 'store', 'staffing', 'checklist', 'incident', 'service', 'delivery', 'doordash', 'kitchen'],
  cx: ['customer', 'review', 'complaint', 'feedback', 'sentiment', 'loyalty', 'experience', 'rating', 'recovery'],
  cost: ['cost', 'cogs', 'inventory', 'vendor', 'procurement', 'waste', 'ingredient', 'expense', 'margin'],
  hr: ['labor', 'staff', 'schedule', 'attendance', 'onboarding', 'training', 'employee', 'payroll', 'shift'],
  creative: ['photo', 'video', 'asset', 'creative', 'design', 'flyer', 'content', 'media', 'banner'],
  data: ['data', 'quality', 'freshness', 'lineage', 'schema', 'catalog', 'metric', 'connector', 'sync'],
  security: ['security', 'access', 'secret', 'compliance', 'audit', 'risk', 'breach', 'permission', 'token'],
};

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s%]/g, ' ').split(/\s+/).filter(Boolean);
}

export function classifyObjective(objective: string, description = ''): ObjectiveClass {
  const tokens = new Set(tokenize(`${objective} ${description}`));
  const matched: string[] = [];
  const scores: Array<{ domain: string; score: number }> = [];

  for (const [domain, concepts] of Object.entries(LEXICON)) {
    let hits = 0;
    for (const c of concepts) {
      if (tokens.has(c) || [...tokens].some((t) => t.includes(c))) { hits++; matched.push(c); }
    }
    if (hits > 0) scores.push({ domain, score: hits });
  }

  scores.sort((a, b) => b.score - a.score);
  const total = scores.reduce((s, x) => s + x.score, 0) || 1;
  const primary = scores[0] || { domain: 'general', score: 0 };

  return {
    primaryDomain: primary.domain,
    confidence: Number((primary.score / total).toFixed(3)),
    ranked: scores.map((s) => ({ domain: s.domain, score: s.score })),
    matchedConcepts: [...new Set(matched)],
  };
}
