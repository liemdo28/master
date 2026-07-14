export function getPerformanceScorecard() {
  return { status: 'CROSS_AGENT_READY', duplicateTasksCreated: 0, agents: ['Finance Agent','Marketing Agent','SEO Agent','DoorDash Operator','Creative Agent','Human Approver'] };
}
export const agentPerformanceScorecard = { getPerformanceScorecard };
