/**
<<<<<<< a471ef81
 * Phase 0K — Division Router
 *
 * Route work to the correct operating division based on keywords + domains.
 * Falls back to "operations" if no match found.
 */
import { RouteResult, DivisionDefinition } from './types';

export const DIVISIONS: DivisionDefinition[] = [
  {
    id: 'engineering',
    name: 'Engineering Division',
    domains: ['code', 'build', 'deploy', 'test', 'integration', 'pr', 'merge', 'ci'],
    keywords: [
      'code', 'bug', 'fix', 'deploy', 'build', 'test', 'integration', 'merge',
      'pull request', 'pr ', 'compile', 'typescript', 'javascript', 'python',
      'api', 'endpoint', 'refactor', 'git commit', 'github', 'pipeline',
      'architecture', 'schema', 'migration', 'feature', 'release', 'regression',
      'dashboard approval bug', 'dashboard code', 'auth bug',
    ],
    parentDivision: null,
  },
  {
    id: 'computer-operator',
    name: 'Computer Operator Division',
    domains: ['browser', 'desktop', 'portal', 'login', 'workflow'],
    keywords: [
      'login', 'browser', 'click', 'portal', 'desktop', 'upload', 'download',
      'screenshot', 'workflow', 'campaign status', 'check status', 'check portal',
      'doordash portal', 'manual', 'two-factor', '2fa', 'captcha',
      'human browser', 'operator', 'check external',
    ],
    parentDivision: null,
  },
  {
    id: 'finance',
    name: 'Financial Intelligence Division',
    domains: ['qb', 'revenue', 'profit', 'payroll', 'forecasting', 'pnl'],
    keywords: [
      'revenue', 'profit', 'loss', 'payroll', 'quickbooks', 'qb ', 'p&l', 'pnl',
      'forecast', 'invoice', 'expense', 'cashflow', 'tax', 'cogs', 'gross margin',
      'revenue drop', 'revenue opportunity', 'financial', 'cost', 'budget',
      'why did revenue', 'revenue question', 'validate revenue',
    ],
    parentDivision: null,
  },
  {
    id: 'marketing',
    name: 'Marketing Intelligence Division',
    domains: ['seo', 'ga4', 'gsc', 'gbp', 'reviews', 'campaigns', 'content'],
    keywords: [
      'seo', 'ga4', 'gsc', 'gbp', 'google business profile', 'search console',
      'analytics', 'ctr', 'keyword', 'ranking', 'serp', 'backlink', 'reviews',
      'campaign', 'content', 'blog', 'landing page', 'meta description',
      'review management', 'review response', 'attribution', 'utm',
      'seo audit', 'seo improvement', 'analyze gsc', 'analyze ga4',
      'review ctr', 'review landing',
    ],
    parentDivision: null,
  },
  {
    id: 'it',
    name: 'IT Operations Division',
    domains: ['devices', 'network', 'accounts', 'backups', 'security'],
    keywords: [
      'device', 'laptop', 'network', 'wifi', 'vpn', 'tailscale', 'account',
      'permission', 'access', 'credential', 'backup', 'restore', 'monitoring',
      'firewall', 'ssh', 'ssl', 'tls', 'domain', 'dns', 'certificate',
      'security scan', 'password', 'mfa', 'data source availability',
      'validate data source',
    ],
    parentDivision: null,
  },
  {
    id: 'creative',
    name: 'Creative Media Division',
    domains: ['image', 'video', 'editing', 'assets', 'content_calendar', 'publishing'],
    keywords: [
      'image', 'photo', 'video', 'edit', 'editing', 'graphic', 'design',
      'asset', 'logo', 'banner', 'creative', 'illustration', 'thumbnail',
      'publish', 'content calendar', 'social media post', 'social post',
      'social media', 'video edit', 'voice over', 'tts',
    ],
    parentDivision: null,
  },
  {
    id: 'executive',
    name: 'Executive Office',
    domains: ['priorities', 'approvals', 'escalations', 'final_decisions'],
    keywords: [
      'company priority', 'company priorities', 'escalate', 'escalation',
      'final decision', 'ceo override', 'approve', 'approval', 'policy',
      'strategic decision', 'board', 'investor', 'acquisition',
    ],
    parentDivision: null,
  },
  {
    id: 'review',
    name: 'Review Management Division',
    domains: ['reviews', 'reputation', 'response'],
    keywords: [
      'review response', 'respond to review', 'reply review', 'reputation',
      'negative review', '5 star', 'google review', 'yelp review',
    ],
    parentDivision: 'marketing',
  },
  {
    id: 'doordash',
    name: 'DoorDash Operations',
    domains: ['doordash', 'delivery', 'storefront'],
    keywords: [
      'doordash', 'door dash', 'delivery', 'merchant portal', 'storefront',
      'doordash campaign', 'doordash menu', 'doordash pricing',
    ],
    parentDivision: 'operations',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Operations',
    domains: ['qb', 'accounting'],
    keywords: ['quickbooks heartbeat', 'qb sync', 'qb connection', 'qb online'],
    parentDivision: 'finance',
  },
];

const FALLBACK_DIVISION = 'operations';

export function routeTask(taskText: string): RouteResult {
  const text = taskText.toLowerCase();
  let bestMatch: { div: DivisionDefinition; score: number; matched: string[] } | null = null;

  for (const div of DIVISIONS) {
    let score = 0;
    const matched: string[] = [];
    for (const kw of div.keywords) {
      const k = kw.toLowerCase();
      if (text.includes(k)) {
        score += 1;
        matched.push(k);
      }
    }
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { div, score, matched };
    }
  }

  if (!bestMatch) {
    return {
      division: FALLBACK_DIVISION,
      confidence: 0.0,
      matchedKeywords: [],
      supportingDivisions: [],
    };
  }

  // Determine supporting divisions based on cross-domain signals
  const supporting: string[] = [];
  for (const div of DIVISIONS) {
    if (div.id === bestMatch.div.id) continue;
    let crossScore = 0;
    for (const kw of div.keywords) {
      if (text.includes(kw.toLowerCase())) crossScore++;
    }
    if (crossScore > 0) supporting.push(div.id);
  }

  const confidence = Math.min(0.99, bestMatch.score / Math.max(1, bestMatch.matched.length));
  return {
    division: bestMatch.div.id,
    confidence: Number(confidence.toFixed(2)),
    matchedKeywords: bestMatch.matched,
    supportingDivisions: supporting,
  };
}

export function getDivisions(): DivisionDefinition[] {
  return [...DIVISIONS];
}

export function getDivisionById(id: string): DivisionDefinition | null {
  return DIVISIONS.find(d => d.id === id) ?? null;
}
=======
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
>>>>>>> origin/seo/phase-29-revenue-execution-loop
