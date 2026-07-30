/**
 * Multi-Agent Council — Phase 21
 * Structured agent discussion → consensus → execution.
 * Each agent reviews the request from its domain perspective.
 * CEO sees the discussion + consensus before Mi acts.
 */

export type AgentId = 'pm' | 'qa' | 'dev' | 'security' | 'ops' | 'knowledge';

export interface AgentVote {
  agent: AgentId;
  name_vi: string;
  stance: 'APPROVE' | 'CONCERN' | 'BLOCK';
  reasoning: string;
  conditions?: string[];   // if CONCERN: what must be true before proceeding
}

export interface CouncilDecision {
  request: string;
  votes: AgentVote[];
  consensus: 'PROCEED' | 'PROCEED_WITH_CONDITIONS' | 'ESCALATE_TO_CEO' | 'BLOCK';
  summary_vi: string;
  conditions: string[];
  blocked_by?: AgentId;
  confidence: number;
}

// ── Agent perspectives ────────────────────────────────────────────────────────

export const AGENT_PROFILES: Record<AgentId, { name_vi: string; cares_about: RegExp[]; blocks_on: RegExp[] }> = {
  pm: {
    name_vi: 'PM Agent',
    cares_about: [/scope|requirement|acceptance|criteria|user.*story|stakeholder/],
    blocks_on:   [/undefined.*scope|no.*requirement|no.*acceptance/],
  },
  qa: {
    name_vi: 'QA Agent',
    cares_about: [/test|regression|quality|evidence|certification|verify/],
    blocks_on:   [/no.*test|untested|skip.*qa|bypass.*qa/],
  },
  dev: {
    name_vi: 'Dev Agent',
    cares_about: [/code|build|implementation|architecture|dependency/],
    blocks_on:   [/unsafe.*code|security.*hole|hard.*delete|rm -rf/],
  },
  security: {
    name_vi: 'Security Agent',
    cares_about: [/auth|credential|secret|token|permission|access|vulnerability/],
    blocks_on:   [/expose.*secret|leak.*credential|bypass.*auth|disable.*security/],
  },
  ops: {
    name_vi: 'Ops Agent',
    cares_about: [/deploy|pm2|process|uptime|health|infrastructure|rollback/],
    blocks_on:   [/deploy.*without.*test|no.*rollback.*plan|force.*deploy/],
  },
  knowledge: {
    name_vi: 'Knowledge Agent',
    cares_about: [/document|knowledge.*base|precedent|history|pattern/],
    blocks_on:   [],
  },
};

function evaluateAgent(agentId: AgentId, request: string): AgentVote {
  const profile = AGENT_PROFILES[agentId];
  const text = request.toLowerCase();

  // Hard block
  for (const pattern of profile.blocks_on) {
    if (pattern.test(text)) {
      return {
        agent: agentId, name_vi: profile.name_vi,
        stance: 'BLOCK',
        reasoning: `${profile.name_vi} phát hiện rủi ro nghiêm trọng trong yêu cầu này`,
      };
    }
  }

  // Domain concern
  const hasConcern = profile.cares_about.some(p => p.test(text));
  if (hasConcern) {
    return {
      agent: agentId, name_vi: profile.name_vi,
      stance: 'APPROVE',
      reasoning: `${profile.name_vi}: Yêu cầu trong phạm vi an toàn, tiến hành được`,
    };
  }

  // Neutral approval
  return {
    agent: agentId, name_vi: profile.name_vi,
    stance: 'APPROVE',
    reasoning: `${profile.name_vi}: Không có vấn đề gì từ góc độ ${profile.name_vi}`,
  };
}

// ── Council session ────────────────────────────────────────────────────────────

export function runCouncilSession(request: string, requiredAgents?: AgentId[]): CouncilDecision {
  const agents: AgentId[] = requiredAgents || ['pm', 'qa', 'dev', 'security', 'ops', 'knowledge'];
  const votes: AgentVote[] = agents.map(id => evaluateAgent(id, request));

  const blocks = votes.filter(v => v.stance === 'BLOCK');
  const concerns = votes.filter(v => v.stance === 'CONCERN');
  const approves = votes.filter(v => v.stance === 'APPROVE');

  let consensus: CouncilDecision['consensus'];
  let summary_vi: string;
  const conditions: string[] = concerns.flatMap(c => c.conditions || []);

  if (blocks.length > 0) {
    consensus = 'BLOCK';
    summary_vi = `🚫 Council đề nghị BLOCK — ${blocks[0].name_vi} phát hiện rủi ro nghiêm trọng`;
  } else if (concerns.length >= 2) {
    consensus = 'ESCALATE_TO_CEO';
    summary_vi = `⏳ Council đề nghị CEO quyết định — ${concerns.length} agent có điều kiện`;
  } else if (concerns.length === 1) {
    consensus = 'PROCEED_WITH_CONDITIONS';
    summary_vi = `✅ Council đồng ý tiến hành có điều kiện — ${concerns[0].name_vi} yêu cầu xem xét thêm`;
  } else {
    consensus = 'PROCEED';
    summary_vi = `✅ Council đồng thuận — ${approves.length}/${votes.length} agent approve`;
  }

  const confidence = Math.round((approves.length / votes.length) * 100);

  return {
    request: request.slice(0, 100),
    votes,
    consensus,
    summary_vi,
    conditions,
    blocked_by: blocks[0]?.agent,
    confidence,
  };
}

// ── Fast-path for simple tasks ─────────────────────────────────────────────────

const SKIP_COUNCIL_PATTERNS = [
  /health.*check|pm2.*status|log.*scan|audit.*read|knowledge.*search|daily.*report/,
];

export function needsCouncil(request: string): boolean {
  const text = request.toLowerCase();
  return !SKIP_COUNCIL_PATTERNS.some(p => p.test(text));
}
