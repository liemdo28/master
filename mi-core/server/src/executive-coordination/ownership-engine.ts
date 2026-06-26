/**
 * Phase 0D — Ownership Engine
 *
 * Every objective and task must have a clear owner.
 * Routing rules decide WHO owns what based on the task text.
 */
import { OwnershipRule, OwnershipResolution } from './types';
import { routeTask } from './division-router';

const RULES: OwnershipRule[] = [
  {
    division: 'engineering',
    keywords: ['code', 'pr', 'merge', 'build', 'deploy', 'test', 'integration', 'bug', 'api', 'endpoint', 'typescript', 'github'],
    domains: ['code', 'build', 'test', 'deploy', 'integration', 'pr'],
    description: 'Engineering owns code, PR, build, test, deploy, integration',
  },
  {
    division: 'computer-operator',
    keywords: ['browser', 'portal', 'login', 'manual', 'click', 'screenshot', 'two-factor', '2fa'],
    domains: ['browser_tasks', 'desktop_tasks', 'manual_web_portals', 'login_workflows', 'file_download_upload'],
    description: 'Computer Operator owns browser tasks, desktop tasks, manual web portals',
  },
  {
    division: 'finance',
    keywords: ['quickbooks', 'qb', 'revenue', 'profit', 'payroll', 'forecast', 'p&l', 'invoice', 'tax'],
    domains: ['quickbooks', 'revenue', 'profit', 'payroll', 'forecasting', 'p_and_l'],
    description: 'Financial Intelligence owns QuickBooks, revenue, profit, payroll',
  },
  {
    division: 'marketing',
    keywords: ['seo', 'ga4', 'gsc', 'gbp', 'review', 'campaign', 'content', 'keyword', 'ctr', 'ranking'],
    domains: ['seo', 'ga4', 'gsc', 'gbp', 'reviews', 'campaigns', 'content'],
    description: 'Marketing Intelligence owns SEO, GA4, GSC, GBP, reviews, campaigns, content',
  },
  {
    division: 'it',
    keywords: ['device', 'laptop', 'network', 'account', 'permission', 'backup', 'credential', 'ssl', 'dns', 'firewall'],
    domains: ['devices', 'network', 'accounts', 'backups', 'security', 'monitoring'],
    description: 'IT Operations owns devices, network, accounts, backups, security, monitoring',
  },
  {
    division: 'creative',
    keywords: ['image', 'photo', 'video', 'edit', 'design', 'asset', 'logo', 'creative', 'illustration'],
    domains: ['image', 'video', 'editing', 'assets', 'content_calendar', 'publishing'],
    description: 'Creative Media owns image, video, editing, assets, content calendar, publishing',
  },
  {
    division: 'executive',
    keywords: ['priority', 'escalate', 'final decision', 'ceo override', 'policy', 'strategic'],
    domains: ['company_priorities', 'approvals', 'escalations', 'final_decisions'],
    description: 'Executive Office owns company priorities, approvals, escalations, final decisions',
  },
];

export function resolveOwnership(taskText: string): OwnershipResolution {
  const text = taskText.toLowerCase();
  const matchedKeywords: string[] = [];
  let bestDivision = '';
  let bestCount = 0;

  for (const rule of RULES) {
    let count = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) {
        count++;
        matchedKeywords.push(kw);
      }
    }
    if (count > bestCount) {
      bestCount = count;
      bestDivision = rule.division;
    }
  }

  if (bestCount === 0) {
    return { taskText, resolvedDivision: 'operations', confidence: 0.0, matchedKeywords: [], fallback: true };
  }

  const route = routeTask(taskText);
  const confirmed = route.division === bestDivision;
  const confidence = Math.min(0.99, bestCount * 0.2 + (confirmed ? 0.3 : 0.0));

  return {
    taskText,
    resolvedDivision: bestDivision,
    confidence: Number(confidence.toFixed(2)),
    matchedKeywords: [...new Set(matchedKeywords)].slice(0, 10),
    fallback: false,
  };
}

export function getOwnershipRules(): OwnershipRule[] {
  return [...RULES];
}

export function updateOwnershipRules(rules: OwnershipRule[]): void {
  RULES.length = 0;
  RULES.push(...rules);
}

export function resolveOwnerEscalation(taskText: string): {
  primary: OwnershipResolution;
  fallback: string;
} {
  const primary = resolveOwnership(taskText);
  const fallback = primary.confidence < 0.3 ? 'executive' : primary.resolvedDivision;
  return { primary, fallback };
}