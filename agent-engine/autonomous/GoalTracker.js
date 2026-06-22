/**
 * local-agent/autonomous/GoalTracker.js
 * Phase 21: Goal tracking for autonomous operations
 */

export class GoalTracker {
    constructor(workspaceRoot) {
        this.root = workspaceRoot;
        this.goals = new Map();
        this.history = [];
    }

    async createGoal({ description, target, deadline, priority = 'normal', metadata = {} }) {
        const goal = {
            id: crypto.randomUUID(),
            description,
            target,
            deadline: deadline ? new Date(deadline) : null,
            priority,
            status: 'active',
            progress: 0,
            metadata,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            checkpoints: [],
            completedAt: null,
            failedAt: null,
            failureReason: null,
        };

        this.goals.set(goal.id, goal);
        return goal;
    }

    async getGoal(id) {
        return this.goals.get(id) || null;
    }

    async listGoals(filter = {}) {
        let goals = [...this.goals.values()];

        if (filter.status) {
            goals = goals.filter(g => g.status === filter.status);
        }
        if (filter.priority) {
            goals = goals.filter(g => g.priority === filter.priority);
        }
        if (filter.overdue) {
            const now = Date.now();
            goals = goals.filter(g => g.deadline && g.deadline.getTime() < now && g.status === 'active');
        }

        return goals.sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
            return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        });
    }

    async updateProgress(goalId, progress, checkpoint = null) {
        const goal = this.goals.get(goalId);
        if (!goal) throw new Error(`Goal ${goalId} not found`);

        goal.progress = Math.max(0, Math.min(100, progress));
        goal.updatedAt = Date.now();

        if (checkpoint) {
            goal.checkpoints.push({
                timestamp: Date.now(),
                progress: goal.progress,
                note: checkpoint,
            });
        }

        if (goal.progress >= 100) {
            return this.complete(goalId);
        }

        return goal;
    }

    async complete(goalId, result = {}) {
        const goal = this.goals.get(goalId);
        if (!goal) throw new Error(`Goal ${goalId} not found`);

        goal.status = 'completed';
        goal.progress = 100;
        goal.completedAt = Date.now();
        goal.result = result;
        goal.updatedAt = Date.now();

        this.history.push({ type: 'completed', goal: { ...goal }, timestamp: Date.now() });

        return goal;
    }

    async fail(goalId, reason) {
        const goal = this.goals.get(goalId);
        if (!goal) throw new Error(`Goal ${goalId} not found`);

        goal.status = 'failed';
        goal.failedAt = Date.now();
        goal.failureReason = reason;
        goal.updatedAt = Date.now();

        this.history.push({ type: 'failed', goal: { ...goal }, timestamp: Date.now() });

        return goal;
    }

    async pause(goalId) {
        const goal = this.goals.get(goalId);
        if (!goal) throw new Error(`Goal ${goalId} not found`);

        goal.status = 'paused';
        goal.updatedAt = Date.now();
        return goal;
    }

    async resume(goalId) {
        const goal = this.goals.get(goalId);
        if (!goal) throw new Error(`Goal ${goalId} not found`);

        goal.status = 'active';
        goal.updatedAt = Date.now();
        return goal;
    }

    getStats() {
        const goals = [...this.goals.values()];
        const total = goals.length;

        if (total === 0) return { total: 0 };

        const byStatus = goals.reduce((acc, g) => {
            acc[g.status] = (acc[g.status] || 0) + 1;
            return acc;
        }, {});

        const avgProgress = goals.reduce((sum, g) => sum + g.progress, 0) / total;

        const overdue = goals.filter(g =>
            g.deadline &&
            g.deadline.getTime() < Date.now() &&
            g.status === 'active'
        ).length;

        return { total, byStatus, avgProgress, overdue };
    }
}