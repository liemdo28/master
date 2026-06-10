"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalRouter = void 0;
const express_1 = require("express");
const gate_1 = require("../approval/gate");
const google_executor_1 = require("../actions/google-executor");
exports.approvalRouter = (0, express_1.Router)();
exports.approvalRouter.get('/', (_req, res) => {
    res.json((0, gate_1.getAll)());
});
exports.approvalRouter.get('/pending', (_req, res) => {
    res.json((0, gate_1.getPending)());
});
exports.approvalRouter.get('/:id', (req, res) => {
    const action = (0, gate_1.getById)(req.params.id);
    if (!action)
        return res.status(404).json({ error: 'Not found' });
    res.json(action);
});
exports.approvalRouter.post('/request', (req, res) => {
    const { risk_level, category, description, target, before_state, after_state, rollback_plan } = req.body;
    if (!risk_level || !category || !description || !target) {
        return res.status(400).json({ error: 'risk_level, category, description, target required' });
    }
    if ((0, gate_1.isAutoAllowed)(category)) {
        return res.json({ auto_allowed: true, category });
    }
    const action = (0, gate_1.enqueue)({ risk_level, category, description, target, before_state, after_state, rollback_plan });
    res.status(201).json(action);
});
exports.approvalRouter.post('/:id/approve', async (req, res) => {
    const action = (0, gate_1.approve)(req.params.id);
    if (!action)
        return res.status(404).json({ error: 'Action not found or not pending' });
    // If fully approved (L2 single / L3 double), execute immediately
    if (action.status === 'approved' && action.category && action.after_state) {
        try {
            const payload = JSON.parse(action.after_state);
            const result = await (0, google_executor_1.executeApprovedAction)(action.category, payload);
            (0, gate_1.markExecuted)(action.id, result.detail || result.error);
            return res.json({ ...action, execution: result });
        }
        catch (e) {
            return res.json({ ...action, execution: { success: false, error: String(e) } });
        }
    }
    res.json(action);
});
exports.approvalRouter.post('/:id/reject', (req, res) => {
    const action = (0, gate_1.reject)(req.params.id);
    if (!action)
        return res.status(404).json({ error: 'Action not found or not pending' });
    res.json(action);
});
