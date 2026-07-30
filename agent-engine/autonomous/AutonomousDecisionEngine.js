/**
 * local-agent/autonomous/AutonomousDecisionEngine.js
 * Phase 21: Autonomous Operation Core
 * 
 * Decision engine for autonomous agent operations with goal tracking,
 * context awareness, and self-correction capabilities.
 */

import { EventEmitter } from 'events';
import { GoalTracker } from './GoalTracker.js';
import { ExecutionContext } from './ExecutionContext.js';

export class DecisionNode {
    constructor({ type, priority = 0, action, condition, rollback }) {
        this.id = crypto.randomUUID();
        this.type = type;
        this.priority = priority;
        this.action = action;
        this.condition = condition;
        this.rollback = rollback;
        this.status = 'pending';
        this.result = null;
        this.timestamp = Date.now();
    }
}

export class DecisionTree {
    constructor(root) {
        this.root = root;
        this.nodes = new Map();
        this._index(root);
    }

    _index(node) {
        if (!node) return;
        this.nodes.set(node.id, node);
        if (node.children) node.children.forEach(c => this._index(c));
    }

    get(id) { return this.nodes.get(id); }

    allNodes() { return [...this.nodes.values()]; }

    leafNodes() { return this.allNodes().filter(n => !n.children || n.children.length === 0); }

    prune(nodeId) {
        const node = this.get(nodeId);
        if (!node) return false;
        node.status = 'pruned';
        return true;
    }
}

export class DecisionResult {
    constructor({ decision, outcome, confidence, reasoning, metadata = {} }) {
        this.decision = decision;
        this.outcome = outcome; // 'approved' | 'rejected' | 'deferred' | 'escalated'
        this.confidence = confidence; // 0.0 - 1.0
        this.reasoning = reasoning;
        this.metadata = metadata;
        this.timestamp = Date.now();
    }
}

export class AutonomousDecisionEngine extends EventEmitter {
    /**
     * @param {Object} config
     * @param {string} config.workspaceRoot
     * @param {Object} [config.policy] - Decision policy overrides
     */
    constructor({ workspaceRoot, policy = {} } = {}) {
        super();
        this.root = workspaceRoot;
        this.policy = {
            maxRetries: 3,
            confidenceThreshold: 0.7,
            riskThreshold: 0.5,
            requireApprovalAboveRisk: 0.8,
            autonomousMode: true,
            ...policy,
        };

        this.goalTracker = new GoalTracker(workspaceRoot);
        this.executionContext = new ExecutionContext(workspaceRoot);

        this.decisionHistory = [];
        this.activeDecisions = new Map();
        this.decisionTrees = new Map();
    }

    // ─── Goal Management ────────────────────────────────────────────────────────

    async createGoal({ description, target, deadline, priority = 'normal', metadata = {} }) {
        return this.goalTracker.createGoal({ description, target, deadline, priority, metadata });
    }

    async getGoal(id) { return this.goalTracker.getGoal(id); }

    async listGoals(filter = {}) { return this.goalTracker.listGoals(filter); }

    async updateGoalProgress(goalId, progress) {
        return this.goalTracker.updateProgress(goalId, progress);
    }

    async completeGoal(goalId, result) {
        return this.goalTracker.complete(goalId, result);
    }

    async failGoal(goalId, reason) {
        return this.goalTracker.fail(goalId, reason);
    }

    // ─── Decision Making ────────────────────────────────────────────────────────

    /**
     * Make an autonomous decision based on context and policy
     * @param {Object} context - Decision context
     * @param {Function} decisionFn - Async function that evaluates and returns a DecisionResult
     */
    async decide(context, decisionFn) {
        const id = crypto.randomUUID();
        const ctx = await this.executionContext.capture(context);

        const decision = await decisionFn({
            context: ctx,
            policy: this.policy,
            goalTracker: this.goalTracker,
            executionContext: this.executionContext,
        });

        const result = new DecisionResult({
            decision: id,
            outcome: decision.outcome,
            confidence: decision.confidence,
            reasoning: decision.reasoning,
            metadata: { context: ctx.summary(), ...decision.metadata },
        });

        this.decisionHistory.push(result);
        this.activeDecisions.set(id, { context: ctx, result, tree: null });

        this.emit('decision', result);
        return result;
    }

    /**
     * Approve a deferred decision
     */
    async approve(decisionId, overrides = {}) {
        const active = this.activeDecisions.get(decisionId);
        if (!active) throw new Error(`Decision ${decisionId} not found`);

        active.result.outcome = 'approved';
        active.result.metadata.approvedAt = Date.now();
        active.result.metadata.approver = overrides.approver || 'human';
        active.result.metadata.overrides = overrides;

        this.emit('approved', active.result);
        return active.result;
    }

    /**
     * Reject a decision
     */
    async reject(decisionId, reason) {
        const active = this.activeDecisions.get(decisionId);
        if (!active) throw new Error(`Decision ${decisionId} not found`);

        active.result.outcome = 'rejected';
        active.result.metadata.rejectedAt = Date.now();
        active.result.metadata.rejectionReason = reason;

        this.emit('rejected', active.result);
        return active.result;
    }

    // ─── Decision Trees ─────────────────────────────────────────────────────────

    buildTree(rootNode) {
        const tree = new DecisionTree(rootNode);
        const id = crypto.randomUUID();
        this.decisionTrees.set(id, tree);
        return id;
    }

    evaluateTree(treeId) {
        const tree = this.decisionTrees.get(treeId);
        if (!tree) throw new Error(`Tree ${treeId} not found`);
        return this._evaluateNode(tree.root);
    }

    _evaluateNode(node) {
        if (!node) return { status: 'skipped' };

        if (node.condition && !node.condition()) {
            node.status = 'condition_failed';
            return { status: 'skipped', node: node.id };
        }

        node.status = 'ready';
        return { status: 'ready', node: node.id, priority: node.priority };
    }

    // ─── Risk Assessment ────────────────────────────────────────────────────────

    assessRisk(action, context) {
        const riskFactors = [];
        let score = 0;

        // File system risk
        if (action.type === 'file_write' || action.type === 'file_delete') {
            riskFactors.push({ factor: 'file_mutation', weight: 0.3, score: 0.6 });
            score += 0.3 * 0.6;
        }

        // Network risk
        if (action.type === 'network_request') {
            riskFactors.push({ factor: 'network_egress', weight: 0.4, score: 1.0 });
            score += 0.4 * 1.0;
        }

        // Execution risk
        if (action.type === 'execute_command') {
            riskFactors.push({ factor: 'command_execution', weight: 0.3, score: 0.5 });
            score += 0.3 * 0.5;
        }

        // Rollback availability
        if (!action.rollback) {
            riskFactors.push({ factor: 'no_rollback', weight: 0.2, score: 0.8 });
            score += 0.2 * 0.8;
        }

        // Check against policy
        const requiresApproval = score >= this.policy.requireApprovalAboveRisk;

        return {
            score: Math.min(score, 1.0),
            factors: riskFactors,
            requiresApproval,
            autonomousEligible: !requiresApproval && score < this.policy.riskThreshold,
        };
    }

    // ─── Context Management ──────────────────────────────────────────────────────

    async snapshot(label = 'manual') {
        return this.executionContext.snapshot(label);
    }

    async restore(snapshotId) {
        return this.executionContext.restore(snapshotId);
    }

    // ─── History & Analytics ────────────────────────────────────────────────────

    getHistory({ limit = 100, outcome } = {}) {
        let history = [...this.decisionHistory];
        if (outcome) history = history.filter(h => h.outcome === outcome);
        return history.slice(-limit);
    }

    getStats() {
        const total = this.decisionHistory.length;
        if (total === 0) return { total: 0 };

        const byOutcome = this.decisionHistory.reduce((acc, d) => {
            acc[d.outcome] = (acc[d.outcome] || 0) + 1;
            return acc;
        }, {});

        const avgConfidence = this.decisionHistory.reduce((sum, d) => sum + d.confidence, 0) / total;

        return { total, byOutcome, avgConfidence };
    }
}