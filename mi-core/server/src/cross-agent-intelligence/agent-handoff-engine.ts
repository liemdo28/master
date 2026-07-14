export interface AgentHandoff { id: string; fromAgent: string; toAgent: string; task: string; status: 'completed'; }
export function createHandoff(fromAgent: string, toAgent: string, task: string): AgentHandoff { return { id: 'handoff-' + fromAgent + '-' + toAgent, fromAgent, toAgent, task, status: 'completed' }; }
export const agentHandoffEngine = { createHandoff };
