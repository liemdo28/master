import type { ActionProposal, ActionRiskClass } from '../types';
import type { RiskAssessment, SensitivityClass } from './types';

const RISK_ORDER: ActionRiskClass[] = ['R0', 'R1', 'R2', 'R3', 'R4'];

export class RiskEvaluator {
  assess(proposal: ActionProposal): RiskAssessment {
    const factors: string[] = [];
    const warnings: string[] = [];
    let score = 0;
    let riskClass: ActionRiskClass = proposal.riskClass;
    const sensitivity = sensitivityOf(proposal);
    const externalTargets = externalTargetCount(proposal);
    const externalImpact = ['gmail', 'google-calendar'].includes(proposal.targetSystem) && proposal.actionType !== 'CALENDAR_EVENT_PROPOSAL';
    const reversible = proposal.actionType !== 'GMAIL_SEND_DRAFT';

    score += RISK_ORDER.indexOf(proposal.riskClass) * 20;
    factors.push(`base:${proposal.riskClass}`);
    if (externalImpact) { score += 15; factors.push('external-impact'); }
    if (externalTargets > 1) { score += Math.min(20, externalTargets * 2); factors.push(`target-count:${externalTargets}`); }
    if (!reversible) { score += 30; factors.push('irreversible'); }
    if (sensitivity === 'PRIVATE') { score += 10; factors.push('private-content'); }
    if (sensitivity === 'SECRET') { score = 100; riskClass = 'R4'; factors.push('secret-content'); warnings.push('SECRET payloads are denied for external actions.'); }
    if (proposal.actionType === 'CALENDAR_CREATE_EVENT') riskClass = maxRisk(riskClass, 'R3');
    if (proposal.actionType === 'GMAIL_CREATE_DRAFT') riskClass = maxRisk(riskClass, 'R2');
    if (proposal.actionType === 'GMAIL_SEND_DRAFT') riskClass = 'R4';

    return {
      riskClass,
      score: Math.min(100, score),
      factors,
      reversible,
      externalImpact,
      sensitivity,
      requiresStrongApproval: riskClass === 'R3' || score >= 70,
      warnings,
    };
  }
}

function sensitivityOf(proposal: ActionProposal): SensitivityClass {
  const explicit = String(proposal.normalizedPayload.sensitivity || '').toUpperCase();
  if (['PUBLIC', 'INTERNAL', 'PRIVATE', 'SECRET'].includes(explicit)) return explicit as SensitivityClass;
  const text = JSON.stringify(proposal.normalizedPayload);
  if (/(BEGIN (RSA|OPENSSH|PRIVATE) KEY|bearer\s+[A-Za-z0-9._-]{20,}|sk-[A-Za-z0-9]{20,}|password\s*=|token\s*=|api[_-]?key\s*=|postgres:\/\/|mysql:\/\/|mongodb(\+srv)?:\/\/|\.env\s*(contents|file)?)/i.test(text)) {
    return 'SECRET';
  }
  if (/private|confidential|personal|phone|address/i.test(text)) return 'PRIVATE';
  return 'INTERNAL';
}

export function externalTargetCount(proposal: ActionProposal): number {
  const p = proposal.normalizedPayload;
  if (proposal.actionType === 'GMAIL_CREATE_DRAFT') {
    return [...((p.to as string[]) ?? []), ...((p.cc as string[]) ?? []), ...((p.bcc as string[]) ?? [])].length;
  }
  if (proposal.actionType.startsWith('CALENDAR')) return ((p.attendees as string[]) ?? []).length;
  return 0;
}

function maxRisk(a: ActionRiskClass, b: ActionRiskClass): ActionRiskClass {
  return RISK_ORDER[Math.max(RISK_ORDER.indexOf(a), RISK_ORDER.indexOf(b))];
}
