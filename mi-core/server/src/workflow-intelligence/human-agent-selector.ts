/**
 * human-agent-selector.ts — pick the responsible human/agent owner for a step.
 *
 * Deterministic owner assignment by division, so every task has accountability.
 */

const DIVISION_OWNER: Record<string, string> = {
  finance: 'cfo-agent',
  marketing: 'marketing-lead',
  operations: 'ops-manager',
  creative: 'creative-lead',
  'data-platform': 'data-eng',
  it: 'it-admin',
  executive: 'ceo',
};

export interface AgentAssignment {
  division: string;
  owner: string;
  human: boolean;
}

export function selectAgentForDivision(division: string): AgentAssignment {
  const owner = DIVISION_OWNER[division] || 'unassigned';
  return { division, owner, human: owner === 'ceo' || owner.endsWith('-manager') || owner.endsWith('-lead') };
}
