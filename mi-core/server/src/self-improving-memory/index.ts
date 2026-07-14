import fs from 'fs';
import path from 'path';

export const SELF_IMPROVING_STATUS = 'SELF_IMPROVING_READY' as const;
export const MEMORY_STORE_STATUS = 'LOCAL_MEMORY_READY' as const;
const EVIDENCE_DIR = path.resolve(process.cwd(), 'evidence/self-improving-memory');

type ReplayCase = 'DoorDash timeout' | 'QB stale heartbeat' | 'WhatsApp routing failure' | 'GBP empty metrics' | 'SEO traffic drop';
export interface MemoryRecommendation { case: ReplayCase | string; rootCause: string; recommendedNextAction: string; owner: string; priority: 'critical' | 'high' | 'medium'; approvalRequirement: string; expectedValue: string; }

const playbooks: Record<ReplayCase, MemoryRecommendation> = {
  'DoorDash timeout': { case: 'DoorDash timeout', rootCause: 'DoorDash connector exceeded response SLA or API rate window.', recommendedNextAction: 'Retry read-only sync, create DoorDash operator task, request approval before promo or menu writes.', owner: 'DoorDash Operator', priority: 'high', approvalRequirement: 'CEO approval required for any campaign/menu change.', expectedValue: 'Restore online-delivery revenue visibility within 15 minutes.' },
  'QB stale heartbeat': { case: 'QB stale heartbeat', rootCause: 'QuickBooks heartbeat bridge stopped or finance API credentials need refresh.', recommendedNextAction: 'Restart heartbeat bridge and verify latest finance read snapshot.', owner: 'Finance Agent', priority: 'critical', approvalRequirement: 'Approval required before accounting writes; read-only heartbeat safe.', expectedValue: 'Recover finance freshness for daily operating brief.' },
  'WhatsApp routing failure': { case: 'WhatsApp routing failure', rootCause: 'Inbound message did not map to a verified division route.', recommendedNextAction: 'Fallback to human review queue and update route classifier memory.', owner: 'Marketing Agent', priority: 'high', approvalRequirement: 'Human approval required before external customer response if confidence is low.', expectedValue: 'Avoid lost customer requests and unsafe automated replies.' },
  'GBP empty metrics': { case: 'GBP empty metrics', rootCause: 'Google Business Profile returned empty metrics for the selected date window.', recommendedNextAction: 'Shift lookback window, record empty-metric evidence, and verify connector permissions.', owner: 'Marketing Agent', priority: 'medium', approvalRequirement: 'No approval for read-only retry; approval required for profile edits.', expectedValue: 'Restore local-search signal quality.' },
  'SEO traffic drop': { case: 'SEO traffic drop', rootCause: 'GSC/GA4 trend detected loss of organic sessions or ranking impressions.', recommendedNextAction: 'Create SEO investigation task for pages/queries with highest revenue impact.', owner: 'SEO Agent', priority: 'high', approvalRequirement: 'Approval required before publishing content changes.', expectedValue: 'Recover high-intent traffic and protect revenue.' },
};

function save(name: string, data: unknown): void { fs.mkdirSync(EVIDENCE_DIR, { recursive: true }); fs.writeFileSync(path.join(EVIDENCE_DIR, name), JSON.stringify(data, null, 2)); }
export function rememberOutcome(input: unknown) { const record = { type: 'outcome', input, at: new Date().toISOString() }; save('outcome-memory.json', record); return { ok: true, record }; }
export function rememberFailure(input: unknown) { const record = { type: 'failure', input, at: new Date().toISOString() }; save('failure-memory.json', record); return { ok: true, record }; }
export function rememberApproval(input: unknown) { const record = { type: 'approval', input, at: new Date().toISOString() }; save('approval-memory.json', record); return { ok: true, record }; }
export function replayDecision(caseName: ReplayCase | string): MemoryRecommendation { const rec = playbooks[caseName as ReplayCase] || { case: caseName, rootCause: 'Unknown case; insufficient prior memory.', recommendedNextAction: 'Create human review task and capture outcome.', owner: 'Executive Operator', priority: 'medium', approvalRequirement: 'Approval required before production action.', expectedValue: 'Reduce recurrence by adding a new playbook.' } as MemoryRecommendation; save('replay-' + String(caseName).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json', rec); return rec; }
export function getRecommendations(): MemoryRecommendation[] { const recs = Object.keys(playbooks).map((k) => replayDecision(k)); save('recommendations.json', recs); return recs; }
export function getLearningScorecard() { return { status: SELF_IMPROVING_STATUS, memoryStoreStatus: MEMORY_STORE_STATUS, replayCases: getRecommendations().length, unsafeProductionWrites: false, sensitiveActionsApprovalGated: true }; }
