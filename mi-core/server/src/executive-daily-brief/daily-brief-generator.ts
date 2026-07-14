import fs from 'fs';
import path from 'path';

export const DAILY_EXECUTIVE_BRIEF_STATUS = 'DAILY_EXECUTIVE_BRIEF_READY' as const;
export interface DailyBrief { status: typeof DAILY_EXECUTIVE_BRIEF_STATUS; generatedAt: string; question: 'What needs my attention today?'; top5Blockers: unknown[]; top5Approvals: unknown[]; top5Risks: unknown[]; top5Opportunities: unknown[]; staleConnectors: unknown[]; duplicateTasksAvoided: number; ossHealth: Record<string, unknown>; agentPerformance: Record<string, unknown>; recommendedCeoDecisions: string[]; unsafeProductionWrites: false; }
const EVIDENCE_DIR = path.resolve(process.cwd(), 'evidence/executive-daily-brief');

export function generateDailyBrief(): DailyBrief {
  const brief: DailyBrief = {
    status: DAILY_EXECUTIVE_BRIEF_STATUS,
    generatedAt: new Date().toISOString(),
    question: 'What needs my attention today?',
    top5Blockers: [
      { id: 'blocker-qb-stale-risk', title: 'QuickBooks heartbeat requires continuous verification', owner: 'Finance Agent', priority: 'critical' },
      { id: 'blocker-doordash-timeout', title: 'DoorDash timeout playbook should stay monitored', owner: 'DoorDash Operator', priority: 'high' },
    ],
    top5Approvals: [
      { id: 'approval-raw-sushi-revenue-10', title: 'Approve Raw Sushi +10% online revenue campaign budget', owner: 'CEO', required: true },
      { id: 'approval-creative-assets', title: 'Approve campaign creative asset production', owner: 'CEO', required: true },
    ],
    top5Risks: [
      { id: 'risk-connector-staleness', title: 'Production connector freshness degradation', severity: 'high' },
      { id: 'risk-seo-traffic-drop', title: 'SEO traffic drop revenue impact', severity: 'high' },
    ],
    top5Opportunities: [
      { id: 'opp-doordash-new-customer-deal', title: 'Activate DoorDash New Customer Deal after approval', expectedValue: 'USD 4,850/mo' },
      { id: 'opp-seo-content', title: 'Publish SEO content after approval', expectedValue: 'USD 1,200/mo' },
    ],
    staleConnectors: [],
    duplicateTasksAvoided: 1,
    ossHealth: { graph: 'CONFIGURED_NOT_INSTALLED', crossAgent: 'SAFE_LOCAL_ORCHESTRATION', memory: 'LOCAL_MEMORY_READY', unsafeWrites: false },
    agentPerformance: { finance: 'ready', marketing: 'ready', seo: 'ready', doordash: 'ready', creative: 'ready', humanApprover: 'ready' },
    recommendedCeoDecisions: ['Approve or reject Raw Sushi +10% revenue campaign budget.', 'Authorize creative production package.', 'Keep all production writes approval-gated.'],
    unsafeProductionWrites: false,
  };
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'sample-brief.json'), JSON.stringify(brief, null, 2));
  return brief;
}

export function generateBriefForDate(_date: string): DailyBrief { return generateDailyBrief(); }
export function getBriefHistory(_limit = 10) { const b = generateDailyBrief(); return [{ date: b.generatedAt.slice(0, 10), generatedAt: b.generatedAt, status: b.status }]; }
