/**
 * Domain W — Production Governor
 * Classifies every action before execution.
 * Gate: SAFE | REQUIRES_APPROVAL | DANGEROUS | BLOCKED
 */

import type { GovernorClass, GovernorDecision, PlanStep } from './types';

// ── Risk rules ─────────────────────────────────────────────────────────────

interface RiskRule {
  pattern:   RegExp;
  class:     GovernorClass;
  reason:    string;
  risk_tags: string[];
}

const RISK_RULES: RiskRule[] = [
  // BLOCKED — absolute no-go
  { pattern: /delete.*database|drop.*table|truncate|rm -rf|format.*drive|wipe/i,
    class: 'BLOCKED', reason: 'Destructive data operation', risk_tags: ['data_loss', 'irreversible'] },
  { pattern: /wire transfer|send money|ach transfer|bank transfer.*(\$|usd|vnd)/i,
    class: 'BLOCKED', reason: 'Financial transfer blocked — CEO must initiate', risk_tags: ['financial', 'irreversible'] },
  { pattern: /fire|terminate.*employee|lay off/i,
    class: 'BLOCKED', reason: 'Personnel action requires direct CEO involvement', risk_tags: ['hr', 'legal'] },

  // DANGEROUS — always approval
  { pattern: /submit.*tax|file.*tax|irs.*submit|ftb.*submit|e-file/i,
    class: 'REQUIRES_APPROVAL', reason: 'Tax filing — CEO approval required before submission', risk_tags: ['tax', 'legal', 'financial'] },
  { pattern: /deploy.*production|push.*prod|release.*v\d|go.*live/i,
    class: 'REQUIRES_APPROVAL', reason: 'Production deployment — review required', risk_tags: ['production', 'downtime_risk'] },
  { pattern: /send.*email.*all|blast.*email|mass.*email/i,
    class: 'REQUIRES_APPROVAL', reason: 'Mass email — approval before send', risk_tags: ['reputation', 'marketing'] },
  { pattern: /delete.*file|remove.*folder|uninstall/i,
    class: 'REQUIRES_APPROVAL', reason: 'File deletion — confirm intent', risk_tags: ['data'] },
  { pattern: /pay.*invoice|process.*payment|charge.*card/i,
    class: 'REQUIRES_APPROVAL', reason: 'Payment processing requires CEO approval', risk_tags: ['financial'] },
  { pattern: /hire|job posting|onboard.*employee/i,
    class: 'REQUIRES_APPROVAL', reason: 'Hiring requires CEO approval', risk_tags: ['hr', 'financial'] },
  { pattern: /password.*change|reset.*password|update.*credential/i,
    class: 'REQUIRES_APPROVAL', reason: 'Credential change — security review needed', risk_tags: ['security'] },
  { pattern: /public.*api.*key|expose.*secret|commit.*env/i,
    class: 'BLOCKED', reason: 'Secret exposure blocked', risk_tags: ['security', 'critical'] },

  // REQUIRES_APPROVAL — review first
  { pattern: /social.*media.*post|publish.*facebook|publish.*instagram|post.*tiktok/i,
    class: 'REQUIRES_APPROVAL', reason: 'Social media post — content review before publish', risk_tags: ['reputation', 'marketing'] },
  { pattern: /website.*publish|blog.*publish|wordpress.*publish/i,
    class: 'REQUIRES_APPROVAL', reason: 'Website content publish — review before going live', risk_tags: ['reputation', 'seo'] },
  { pattern: /quickbooks|accounting.*entry|journal.*entry|reconcil/i,
    class: 'REQUIRES_APPROVAL', reason: 'Accounting entry — review before commit', risk_tags: ['financial', 'audit'] },
  { pattern: /price.*change|discount.*update|menu.*price/i,
    class: 'REQUIRES_APPROVAL', reason: 'Pricing change — CEO sign-off required', risk_tags: ['revenue', 'financial'] },
  { pattern: /refund|chargeback/i,
    class: 'REQUIRES_APPROVAL', reason: 'Refund/chargeback — CEO approval', risk_tags: ['financial'] },

  // SAFE — execute immediately
  { pattern: /read|fetch|get|list|show|display|check.*status|monitor|search|find|query|report|analyze|audit(?!.*production)/i,
    class: 'SAFE', reason: 'Read-only operation', risk_tags: [] },
  { pattern: /draft|preview|prepare|plan|schedule(?!.*delete)/i,
    class: 'SAFE', reason: 'Non-destructive preparation', risk_tags: [] },
  { pattern: /test|validate|lint|type.*check|compile|build(?!.*production)/i,
    class: 'SAFE', reason: 'Development/testing operation', risk_tags: [] },
  { pattern: /send.*report|send.*briefing|whatsapp.*send/i,
    class: 'SAFE', reason: 'Internal reporting — always safe', risk_tags: [] },
];

// ── Domain-level risk overrides ────────────────────────────────────────────

const DOMAIN_RISK: Record<string, GovernorClass> = {
  tax:         'REQUIRES_APPROVAL',
  payment:     'REQUIRES_APPROVAL',
  social:      'REQUIRES_APPROVAL',
  website:     'REQUIRES_APPROVAL',
  bookkeeper:  'REQUIRES_APPROVAL',
  accountant:  'REQUIRES_APPROVAL',
  deploy:      'REQUIRES_APPROVAL',
  computer:    'REQUIRES_APPROVAL',
  browser:     'SAFE',
  workspace:   'SAFE',
  cfo:         'SAFE',
  marketing:   'REQUIRES_APPROVAL',
};

// ── Governor ───────────────────────────────────────────────────────────────

export function classify(description: string, domains: string[] = []): GovernorDecision {
  // Check domain-level risk first
  let domainClass: GovernorClass = 'SAFE';
  for (const d of domains) {
    const dc = DOMAIN_RISK[d];
    if (dc === 'BLOCKED') return { class: 'BLOCKED', reason: `Domain '${d}' is permanently blocked`, domains, risk_tags: ['blocked'] };
    if (dc === 'DANGEROUS') domainClass = 'DANGEROUS';
    else if (dc === 'REQUIRES_APPROVAL' && domainClass !== 'DANGEROUS') domainClass = 'REQUIRES_APPROVAL';
  }

  // Check pattern rules
  for (const rule of RISK_RULES) {
    if (rule.pattern.test(description)) {
      // BLOCKED always wins
      if (rule.class === 'BLOCKED') {
        return { class: 'BLOCKED', reason: rule.reason, domains, risk_tags: rule.risk_tags };
      }
      // DANGEROUS > REQUIRES_APPROVAL > SAFE
      const ruleWeight = { BLOCKED: 4, DANGEROUS: 3, REQUIRES_APPROVAL: 2, SAFE: 1 };
      if (ruleWeight[rule.class] > ruleWeight[domainClass]) {
        domainClass = rule.class;
      }
      if (domainClass !== 'SAFE') {
        return { class: domainClass, reason: rule.reason, domains, risk_tags: rule.risk_tags };
      }
    }
  }

  return { class: domainClass || 'SAFE', reason: 'No risk patterns matched', domains, risk_tags: [] };
}

export function classifyStep(step: PlanStep): GovernorDecision {
  return classify(`${step.name} ${step.description}`, [step.agent]);
}

export function formatGovernorDecision(d: GovernorDecision): string {
  const icons: Record<GovernorClass, string> = {
    SAFE: '🟢',
    REQUIRES_APPROVAL: '🟠',
    DANGEROUS: '🔴',
    BLOCKED: '⛔',
  };
  return `${icons[d.class]} ${d.class}: ${d.reason}${d.risk_tags.length ? ` [${d.risk_tags.join(', ')}]` : ''}`;
}

export function requiresApproval(description: string, domains?: string[]): boolean {
  const d = classify(description, domains);
  return d.class === 'REQUIRES_APPROVAL' || d.class === 'DANGEROUS';
}

export function isBlocked(description: string, domains?: string[]): boolean {
  return classify(description, domains).class === 'BLOCKED';
}
