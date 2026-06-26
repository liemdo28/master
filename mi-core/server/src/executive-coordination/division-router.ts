/**
 * Phase 0 — Division Router
 * 
 * Routes work to the correct division based on task intent/title.
 */

import type { Division, ApprovalType } from './types';

interface RouteResult {
  division: Division;
  owner: string;
  approvalRequired: ApprovalType;
  reason: string;
}

const ROUTES: Array<{ pattern: RegExp; division: Division; owner: string; approvalRequired: ApprovalType; reason: string }> = [
  { pattern: /(deploy|merge|backend|api|code|bug|fix|engineering|dashboard)/i, division: 'engineering', owner: 'eng-lead', approvalRequired: 'merge', reason: 'Engineering implementation work' },
  { pattern: /(server|infrastructure|device|operator|runtime|service|restart|pm2)/i, division: 'computer-operator', owner: 'ops-operator', approvalRequired: 'none', reason: 'Operator/runtime work' },
  { pattern: /(invoice|payment|payroll|finance|expense|budget|profit|revenue.sheet)/i, division: 'finance', owner: 'finance-lead', approvalRequired: 'financial', reason: 'Finance-controlled work' },
  { pattern: /(marketing|campaign|seo|traffic|ctr|ads|funnel|growth)/i, division: 'marketing', owner: 'marketing-lead', approvalRequired: 'none', reason: 'Marketing/growth work' },
  { pattern: /(credential|access|security|dns|domain|network|it|ga4|gsc)/i, division: 'it', owner: 'it-admin', approvalRequired: 'credentials', reason: 'IT/security/access work' },
  { pattern: /(creative|design|banner|flyer|image|video|brand|content)/i, division: 'creative', owner: 'creative-lead', approvalRequired: 'none', reason: 'Creative asset production' },
];

export function routeTask(title: string, description = ''): RouteResult {
  const text = `${title} ${description}`;
  for (const route of ROUTES) {
    if (route.pattern.test(text)) {
      return {
        division: route.division,
        owner: route.owner,
        approvalRequired: route.approvalRequired,
        reason: route.reason,
      };
    }
  }

  return {
    division: 'operations',
    owner: 'executive-coordinator',
    approvalRequired: 'none',
    reason: 'Fallback route for uncategorized work',
  };
}
