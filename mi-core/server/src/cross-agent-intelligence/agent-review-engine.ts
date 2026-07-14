export interface ReviewTask { id: string; agentId: string; taskId: string; title: string; priority: string; status: 'pending-ceo-approval'; }
export function createReviewTask(agentId: string, taskId: string, title: string, priority = 'high'): ReviewTask { return { id: 'review-' + taskId, agentId, taskId, title, priority, status: 'pending-ceo-approval' }; }
export const agentReviewEngine = { createReviewTask };
