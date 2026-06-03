"use strict";
// ============================================================
// Agent OS - Approval Routes
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const approvalEngine_1 = require("../services/approvalEngine");
const taskQueue_1 = require("../services/taskQueue");
const journal_1 = require("../services/journal");
const router = (0, express_1.Router)();
router.get('/', (_req, res) => {
    res.json({ approvals: (0, approvalEngine_1.getAllApprovals)() });
});
router.get('/pending', (_req, res) => {
    res.json({ approvals: (0, approvalEngine_1.getPendingApprovals)() });
});
router.get('/task/:taskId', (req, res) => {
    res.json({ approval: (0, approvalEngine_1.getApprovalForTask)(req.params.taskId) });
});
router.post('/task/:taskId/approve', (req, res) => {
    const actor = req.headers['x-user-id'] || req.body.actor || 'ceo';
    const approval = (0, approvalEngine_1.approveTask)(req.params.taskId, actor);
    if (!approval) {
        return res.status(404).json({ error: 'Pending approval not found' });
    }
    taskQueue_1.taskQueue.approveTask(req.params.taskId);
    const decisionPath = (0, journal_1.writeDecision)({
        taskId: req.params.taskId,
        decision: 'approved',
        reason: req.body.reason || 'CEO approved task execution.',
        actor,
        risk: approval.riskLevel,
        rollbackPlan: req.body.rollbackPlan,
    });
    (0, journal_1.writeJournalEvent)({ type: 'approval_approved', taskId: req.params.taskId, actor, risk: approval.riskLevel, data: { decisionPath } });
    res.json({ approval, decisionPath });
});
router.post('/task/:taskId/deny', (req, res) => {
    const actor = req.headers['x-user-id'] || req.body.actor || 'ceo';
    const reason = req.body.reason || 'CEO denied task execution.';
    const approval = (0, approvalEngine_1.denyTask)(req.params.taskId, actor, reason);
    if (!approval) {
        return res.status(404).json({ error: 'Pending approval not found' });
    }
    taskQueue_1.taskQueue.updateTaskStatus(req.params.taskId, 'cancelled', reason);
    const decisionPath = (0, journal_1.writeDecision)({
        taskId: req.params.taskId,
        decision: 'denied',
        reason,
        actor,
        risk: approval.riskLevel,
        rollbackPlan: 'No execution occurred. No rollback required.',
    });
    (0, journal_1.writeJournalEvent)({ type: 'approval_denied', taskId: req.params.taskId, actor, risk: approval.riskLevel, data: { decisionPath } });
    res.json({ approval, decisionPath });
});
exports.default = router;
//# sourceMappingURL=approvals.js.map