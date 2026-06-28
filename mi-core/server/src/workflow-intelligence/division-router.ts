/**
 * division-router.ts — semantic division routing for a workflow step.
 *
 * Maps a domain (from the semantic classifier) or a step title to the owning
 * division, with a confidence and the reasoning. This is the workflow-intelligence
 * router (distinct from the coordination-layer keyword router) — it routes by
 * classified concept, not raw keyword.
 */
import { classifyObjective } from './semantic-objective-classifier';

const DOMAIN_TO_DIVISION: Record<string, string> = {
  revenue: 'finance',
  marketing: 'marketing',
  operations: 'operations',
  cx: 'operations',
  cost: 'finance',
  hr: 'operations',
  creative: 'creative',
  data: 'data-platform',
  security: 'it',
  general: 'executive',
};

export interface DivisionRoute {
  step: string;
  domain: string;
  division: string;
  confidence: number;
  reason: string;
}

export function routeStep(stepTitle: string, description = ''): DivisionRoute {
  const cls = classifyObjective(stepTitle, description);
  const division = DOMAIN_TO_DIVISION[cls.primaryDomain] || 'executive';
  return {
    step: stepTitle,
    domain: cls.primaryDomain,
    division,
    confidence: cls.confidence,
    reason: `classified as '${cls.primaryDomain}' (concepts: ${cls.matchedConcepts.slice(0, 4).join(', ') || 'none'}) → ${division}`,
  };
}
