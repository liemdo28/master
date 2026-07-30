/**
 * Domain I — Agent Council V4 (CrewAI-style)
 * Extended council: PM, QA, Dev, Security, Ops, Marketing, Bookkeeper, Accountant, CFO
 * Each agent votes on tasks within their domain expertise.
 * Weighted votes. Quorum required for BLOCK.
 */

import type { CouncilRole, CouncilVote, CouncilDecision, CouncilStance } from './types';

// ── Agent definitions ──────────────────────────────────────────────────────

interface CouncilAgent {
  role:          CouncilRole;
  name_vi:       string;
  expertise:     string[];
  weight:        number;
  domains:       string[];  // keywords that activate this agent
}

const AGENTS: CouncilAgent[] = [
  {
    role: 'pm', name_vi: 'Quản lý Dự án', weight: 1.0,
    expertise: ['timeline', 'scope', 'resources', 'priorities', 'dependencies'],
    domains: ['project', 'task', 'deadline', 'priority', 'plan', 'roadmap', 'milestone'],
  },
  {
    role: 'qa', name_vi: 'Kiểm soát Chất lượng', weight: 1.0,
    expertise: ['testing', 'bugs', 'regressions', 'quality', 'validation', 'acceptance'],
    domains: ['test', 'bug', 'quality', 'release', 'deploy', 'regression', 'fix', 'audit'],
  },
  {
    role: 'dev', name_vi: 'Kỹ sư Phát triển', weight: 1.0,
    expertise: ['code', 'architecture', 'performance', 'scalability', 'technical debt'],
    domains: ['code', 'build', 'source', 'api', 'database', 'performance', 'refactor', 'patch'],
  },
  {
    role: 'security', name_vi: 'Bảo mật', weight: 1.2,
    expertise: ['vulnerabilities', 'data privacy', 'authentication', 'permissions', 'compliance'],
    domains: ['security', 'password', 'credential', 'auth', 'permission', 'secret', 'encrypt', 'pii'],
  },
  {
    role: 'ops', name_vi: 'Vận hành Hệ thống', weight: 1.0,
    expertise: ['infrastructure', 'uptime', 'monitoring', 'deployment', 'scaling'],
    domains: ['server', 'deploy', 'production', 'monitor', 'uptime', 'alert', 'infra', 'pm2'],
  },
  {
    role: 'marketing', name_vi: 'Marketing', weight: 1.0,
    expertise: ['brand', 'content', 'campaigns', 'seo', 'social', 'engagement'],
    domains: ['marketing', 'campaign', 'seo', 'social', 'facebook', 'instagram', 'tiktok', 'content', 'video', 'flyer', 'doordash'],
  },
  {
    role: 'bookkeeper', name_vi: 'Kế toán Viên', weight: 1.1,
    expertise: ['transactions', 'reconciliation', 'receipts', 'bills', 'payments', 'duplicates'],
    domains: ['transaction', 'bill', 'payment', 'receipt', 'reconcile', 'invoice', 'duplicate'],
  },
  {
    role: 'accountant', name_vi: 'Kế Toán Trưởng', weight: 1.2,
    expertise: ['p&l', 'balance sheet', 'month-end', 'adjustments', 'reporting'],
    domains: ['pl', 'p&l', 'balance', 'month end', 'journal', 'adjusting', 'financial statement', 'report'],
  },
  {
    role: 'cfo', name_vi: 'Giám đốc Tài chính', weight: 1.5,
    expertise: ['cash flow', 'forecast', 'strategy', 'investment', 'risk', 'store performance'],
    domains: ['cash flow', 'forecast', 'revenue', 'profit', 'store', 'investment', 'financial strategy', 'tax', 'budget'],
  },
];

// ── Vote logic per agent ───────────────────────────────────────────────────

function voteForRequest(agent: CouncilAgent, request: string, risk_level: string): CouncilVote {
  const r = request.toLowerCase();

  // Check if agent's domain is relevant
  const relevance = agent.domains.some(d => r.includes(d));

  // Base stance from risk level
  let stance: CouncilStance = 'PROCEED';
  let reasoning = '';
  const conditions: string[] = [];

  if (risk_level === 'critical') {
    stance = 'ESCALATE_TO_CEO';
    reasoning = 'Mức độ rủi ro CRITICAL — cần CEO phê duyệt trực tiếp';
    conditions.push('CEO approval mandatory');
  } else if (risk_level === 'high') {
    stance = 'PROCEED_WITH_CONDITIONS';
    conditions.push('Document all changes', 'Have rollback plan ready');
    reasoning = 'Rủi ro cao — cần điều kiện cẩn thận';
  }

  // Domain-specific rules
  if (agent.role === 'security') {
    if (/password|credential|secret|api.?key|token/.test(r)) {
      stance = 'ESCALATE_TO_CEO';
      reasoning = 'Tác vụ liên quan đến bảo mật — yêu cầu CEO xác nhận';
      conditions.push('Security audit first', 'No secrets in logs');
    } else if (relevance) {
      conditions.push('Verify no PII exposure', 'Check OWASP compliance');
      reasoning = 'Cần kiểm tra bảo mật trước khi thực hiện';
      if (stance === 'PROCEED') stance = 'PROCEED_WITH_CONDITIONS';
    } else {
      reasoning = 'Không có rủi ro bảo mật rõ ràng';
    }
  } else if (agent.role === 'cfo') {
    if (/payment|transfer|pay|spend|charge|bill/.test(r)) {
      stance = 'ESCALATE_TO_CEO';
      reasoning = 'Giao dịch tài chính — CFO yêu cầu CEO ký duyệt';
      conditions.push('CFO review required', 'Board approval for >$10k');
    } else if (/report|analysis|forecast|cash flow/.test(r)) {
      reasoning = 'Báo cáo tài chính — tiến hành';
    } else if (relevance) {
      reasoning = 'Tác vụ tài chính — giám sát cẩn thận';
      conditions.push('Record in financial log');
      if (stance === 'PROCEED') stance = 'PROCEED_WITH_CONDITIONS';
    } else {
      reasoning = 'Không ảnh hưởng đến tài chính';
    }
  } else if (agent.role === 'bookkeeper') {
    if (/delete|remove|void/.test(r) && /transaction|invoice|payment/.test(r)) {
      stance = 'ESCALATE_TO_CEO';
      reasoning = 'Xóa bản ghi tài chính — yêu cầu CEO duyệt';
    } else if (relevance) {
      conditions.push('Keep audit trail');
      reasoning = 'Ghi lại đầy đủ trail kiểm toán';
      if (stance === 'PROCEED') stance = 'PROCEED_WITH_CONDITIONS';
    } else {
      reasoning = 'Không liên quan đến kế toán';
    }
  } else if (agent.role === 'qa') {
    if (/deploy|release|production|go live/.test(r)) {
      conditions.push('Full regression test required', 'Smoke test in staging first');
      reasoning = 'Cần test đầy đủ trước khi deploy production';
      if (stance === 'PROCEED') stance = 'PROCEED_WITH_CONDITIONS';
    } else if (/fix|bug|patch/.test(r)) {
      conditions.push('Add regression test for this bug');
      reasoning = 'Fix bug — cần có regression test';
      if (stance === 'PROCEED') stance = 'PROCEED_WITH_CONDITIONS';
    } else {
      reasoning = 'Không ảnh hưởng đến chất lượng hệ thống';
    }
  } else if (agent.role === 'marketing') {
    if (/publish|post|send.*email|blast/.test(r)) {
      conditions.push('Review content before publish', 'Check brand guidelines');
      reasoning = 'Nội dung marketing cần review trước khi đăng';
      if (stance === 'PROCEED') stance = 'PROCEED_WITH_CONDITIONS';
    } else if (relevance) {
      reasoning = 'Marketing task — tiến hành theo brand guidelines';
    } else {
      reasoning = 'Không liên quan đến marketing';
    }
  } else if (agent.role === 'ops') {
    if (/production|server|infra|deploy/.test(r)) {
      conditions.push('Check server load before', 'Alert on-call if risky');
      reasoning = 'Thay đổi infrastructure — cần giám sát';
      if (stance === 'PROCEED') stance = 'PROCEED_WITH_CONDITIONS';
    } else {
      reasoning = 'Không ảnh hưởng đến hạ tầng';
    }
  } else if (agent.role === 'pm') {
    if (/scope change|new feature|unplanned/.test(r)) {
      conditions.push('Add to backlog', 'Estimate effort before starting');
      reasoning = 'Thay đổi scope — cần cập nhật kế hoạch';
      if (stance === 'PROCEED') stance = 'PROCEED_WITH_CONDITIONS';
    } else {
      reasoning = relevance ? 'Trong phạm vi dự án — tiến hành' : 'Không ảnh hưởng đến project plan';
    }
  } else if (agent.role === 'dev') {
    if (/production|migrate|schema change/.test(r)) {
      conditions.push('Backup first', 'Test in staging', 'Have rollback script');
      reasoning = 'Thay đổi production — cần chuẩn bị kỹ';
      if (stance === 'PROCEED') stance = 'PROCEED_WITH_CONDITIONS';
    } else if (relevance) {
      reasoning = 'Tác vụ kỹ thuật — tiến hành';
    } else {
      reasoning = 'Không ảnh hưởng đến codebase';
    }
  }

  // Default reasoning if none set
  if (!reasoning) reasoning = relevance ? 'Trong chuyên môn — tiến hành' : 'Ngoài chuyên môn — không có ý kiến';

  return { role: agent.role, name_vi: agent.name_vi, stance, reasoning, conditions, weight: agent.weight };
}

// ── Main council function ──────────────────────────────────────────────────

export function runCouncilV4(request: string, riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'): CouncilDecision {
  const votes = AGENTS.map(agent => voteForRequest(agent, request, riskLevel));

  // Weighted vote tally
  let totalWeight = 0;
  let blockWeight = 0;
  let escalateWeight = 0;
  let conditionWeight = 0;
  const allConditions: string[] = [];

  for (const vote of votes) {
    totalWeight += vote.weight;
    if (vote.stance === 'BLOCK') blockWeight += vote.weight;
    else if (vote.stance === 'ESCALATE_TO_CEO') escalateWeight += vote.weight;
    else if (vote.stance === 'PROCEED_WITH_CONDITIONS') conditionWeight += vote.weight;
    allConditions.push(...vote.conditions);
  }

  // BLOCK: any single BLOCK vote (veto power)
  const hasBlock = votes.some(v => v.stance === 'BLOCK');
  // ESCALATE: if any escalate vote and risk high+
  const hasEscalate = votes.some(v => v.stance === 'ESCALATE_TO_CEO');
  const escalateRatio = escalateWeight / totalWeight;

  let outcome: CouncilStance;
  if (hasBlock) {
    outcome = 'BLOCK';
  } else if (hasEscalate || (riskLevel === 'critical' || (riskLevel === 'high' && escalateRatio > 0.2))) {
    outcome = 'ESCALATE_TO_CEO';
  } else if (conditionWeight / totalWeight > 0.3) {
    outcome = 'PROCEED_WITH_CONDITIONS';
  } else {
    outcome = 'PROCEED';
  }

  const uniqueConditions = [...new Set(allConditions)];

  const outcomeLabels: Record<CouncilStance, string> = {
    PROCEED:                '✅ Hội đồng đồng thuận TIẾN HÀNH',
    PROCEED_WITH_CONDITIONS:'🟡 TIẾN HÀNH với điều kiện kèm theo',
    ESCALATE_TO_CEO:        '⚠️ Cần CEO phê duyệt trước khi tiến hành',
    BLOCK:                  '🛑 Hội đồng BLOCK — không thực hiện',
  };

  const summary_vi = [
    outcomeLabels[outcome],
    uniqueConditions.length ? `\nĐiều kiện: ${uniqueConditions.slice(0,3).join('; ')}` : '',
    `\nRủi ro: ${riskLevel.toUpperCase()}`,
  ].filter(Boolean).join('');

  return {
    request,
    votes,
    outcome,
    summary_vi,
    conditions: uniqueConditions,
    requires_ceo: outcome === 'ESCALATE_TO_CEO' || outcome === 'BLOCK',
    risk_level: riskLevel,
  };
}

export function formatCouncilReport(decision: CouncilDecision): string {
  const icons: Record<CouncilStance, string> = {
    PROCEED: '🟢', PROCEED_WITH_CONDITIONS: '🟡', ESCALATE_TO_CEO: '🔴', BLOCK: '⛔',
  };
  const lines = [
    `🏛 *Agent Council V4*`,
    ``,
    `📋 "${decision.request.slice(0, 80)}"`,
    ``,
    ...decision.votes.map(v => `  ${icons[v.stance]} *${v.name_vi}*: ${v.reasoning.slice(0, 70)}`),
    ``,
    decision.summary_vi,
    decision.conditions.length ? `\n📌 Điều kiện:\n${decision.conditions.slice(0,4).map(c => `• ${c}`).join('\n')}` : '',
  ].filter(c => c !== undefined);
  return lines.join('\n');
}
