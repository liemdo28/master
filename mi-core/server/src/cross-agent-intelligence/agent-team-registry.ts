export const requiredAgents = ['Finance Agent', 'Marketing Agent', 'SEO Agent', 'DoorDash Operator', 'Creative Agent', 'Human Approver'];
export interface TeamAgent { id: string; name: string; status: 'ready'; }
export function getAgentTeam(): TeamAgent[] { return requiredAgents.map((name) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, status: 'ready' })); }
export function listAgents(): TeamAgent[] { return getAgentTeam(); }
export function getAgent(agentId: string): TeamAgent | undefined { return getAgentTeam().find((a) => a.id === agentId || a.name === agentId); }
export function getSystemStatus() { return { totalAgents: requiredAgents.length, overallStatus: 'healthy' }; }
export const agentTeamRegistry = { getAgentTeam, listAgents, getAgent, getSystemStatus };
