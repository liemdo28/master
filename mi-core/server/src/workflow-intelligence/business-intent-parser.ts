/**
 * business-intent-parser.ts — turn an objective into a structured business intent.
 *
 * Extracts: action verb, target entity/brand, metric, magnitude, timeframe, and
 * whether it is a growth/cost/risk/quality intent. Deterministic regex + lexicon.
 */

export interface BusinessIntent {
  raw: string;
  action: string;
  entity: string | null;
  metric: string | null;
  magnitude: { value: number; unit: '%' | 'abs' } | null;
  direction: 'increase' | 'decrease' | 'maintain' | 'investigate';
  intentType: 'growth' | 'cost' | 'risk' | 'quality' | 'general';
}

const KNOWN_ENTITIES = ['raw sushi', 'bakudan', 'stone oak', 'doordash', 'website', 'google business profile'];
const METRICS = ['revenue', 'traffic', 'orders', 'rating', 'cost', 'cogs', 'labor', 'sentiment', 'sessions', 'clicks'];

export function parseBusinessIntent(objective: string): BusinessIntent {
  const lc = objective.toLowerCase();
  const entity = KNOWN_ENTITIES.find((e) => lc.includes(e)) || null;
  const metric = METRICS.find((m) => lc.includes(m)) || null;

  const pctMatch = lc.match(/(\d+(?:\.\d+)?)\s*%/);
  const absMatch = lc.match(/\$?\s*(\d[\d,]*(?:\.\d+)?)/);
  let magnitude: BusinessIntent['magnitude'] = null;
  if (pctMatch) magnitude = { value: Number(pctMatch[1]), unit: '%' };
  else if (absMatch) magnitude = { value: Number(absMatch[1].replace(/,/g, '')), unit: 'abs' };

  let direction: BusinessIntent['direction'] = 'investigate';
  if (/increase|grow|boost|raise|improve|up\b/.test(lc)) direction = 'increase';
  else if (/decrease|reduce|cut|lower|down\b/.test(lc)) direction = 'decrease';
  else if (/maintain|keep|hold/.test(lc)) direction = 'maintain';

  let intentType: BusinessIntent['intentType'] = 'general';
  if (/revenue|sales|grow|upsell|traffic|orders/.test(lc)) intentType = 'growth';
  else if (/cost|cogs|waste|labor|expense/.test(lc)) intentType = 'cost';
  else if (/risk|breach|incident|down|compliance|secret/.test(lc)) intentType = 'risk';
  else if (/quality|freshness|accuracy|sentiment|rating/.test(lc)) intentType = 'quality';

  const action = (lc.match(/^\s*(\w+)/)?.[1]) || 'execute';

  return { raw: objective, action, entity, metric, magnitude, direction, intentType };
}
